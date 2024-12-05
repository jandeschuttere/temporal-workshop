package main

import (
	"context"
	"flag"
	"fmt"
	"github.com/redis/go-redis/v9"
	"go.temporal.io/sdk/activity"
	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/worker"
	"log/slog"
	"os"
	"time"

	"goactivity/dmsclient"
)

func main() {
	var temporalHost string
	var temporalPort string
	var temporalQueue string
	var redisHost string
	var redisPort string

	flag.StringVar(&temporalHost, "temporal-host", "temporal", "Temporal host")
	flag.StringVar(&temporalPort, "temporal-port", "7233", "Temporal port")
	flag.StringVar(&temporalQueue, "temporal-queue", "workshop", "Temporal queue")
	flag.StringVar(&redisHost, "redis-host", "redis", "Redis host")
	flag.StringVar(&redisPort, "redis-port", "6379", "Redis port")
	flag.Parse()

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelDebug}))
	redisClient := initRedis(logger, redisHost, redisPort)

	temporalHostPort := temporalHost + ":" + temporalPort
	logger.Debug("booting temporal", "temporal.hostport", temporalHostPort)
	// Naieve wait because sometimes we can boot too fast for temporal to be up and running, even with the healthcheck
	var c client.Client
	var err error
	for _ = range 3 {
		c, err = initTemporalConnection(logger, temporalHostPort)
		if err == nil {
			break
		}
		time.Sleep(1 * time.Second)
	}
	if err != nil {
		logger.Error("Unable to create client", err)
		os.Exit(1)
	}
	defer c.Close()

	// Time to listen on the Temporal queue
	logger.Info("starting worker")
	waitForBoot := 5

	// Naieve wait for temporal to be provisioned
	errChan := make(chan error)
	go func() {
		for _ = range waitForBoot {
			w := worker.New(c, temporalQueue, worker.Options{})

			// Boot the DMS client handler, add the dependencies for the activities it handles
			dmsActivityHandler := dmsclient.NewDmsClient(redisClient, logger.With("handler", "DmsActivity"))
			// Register the activities through which it will act
			w.RegisterActivityWithOptions(dmsActivityHandler.SyncDrivesAndBatch, activity.RegisterOptions{
				Name: "syncDrivesAndBatch",
			})
			w.RegisterActivityWithOptions(dmsActivityHandler.ReleaseBatches, activity.RegisterOptions{
				Name: "releaseBatches",
			})

			err = w.Run(worker.InterruptCh())
			if err == nil {
				break
			}
			time.Sleep(1 * time.Second)
		}
		errChan <- err
	}()

	select {
	case err := <-errChan:
		if err != nil {
			logger.Error("unable to start worker", err)
			os.Exit(1)
		}
	case <-time.After(time.Duration(waitForBoot) * time.Second):
		// boot was successful, any errors after this will be because of an error on the worker during execution
	}

	// Any error coming through the channel at this point means it was after it was booted
	err = <-errChan
	if err != nil {
		logger.Error("unable to start worker", err)
		os.Exit(1)
	}
	logger.Info("worker finished")
}

func initRedis(logger *slog.Logger, redisHost string, redisPort string) *redis.Client {
	redisAddress := fmt.Sprintf("%s:%s", redisHost, redisPort)
	logger.Debug("booting redis", "redis.hostport", redisAddress)
	redisClient := redis.NewClient(&redis.Options{Addr: redisAddress})

	// Ping the Redis server to check the connection
	_, err := redisClient.Ping(context.Background()).Result()
	if err != nil {
		logger.Error("error pinging redis client", err)
		os.Exit(1)
	}

	return redisClient
}

func initTemporalConnection(logger *slog.Logger, temporalHostPort string) (client.Client, error) {
	c, err := client.Dial(client.Options{
		HostPort: temporalHostPort,
		Logger:   logger,
	})
	if err != nil {
		return nil, err
	}
	return c, nil
}
