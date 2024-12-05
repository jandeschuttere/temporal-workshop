package dmsclient

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"slices"
	"time"

	"github.com/redis/go-redis/v9"
)

type (
	// SyncSettings is the wrapper message to control the sync
	SyncSettings struct {
		DriveSettings []DriveSyncSettings `json:"driveSettings"`
		BatchSize     int                 `json:"batchSize"`
	}
	// DriveSyncSettings will identify which drives are of interest and what file settings are applicable to the drives
	// returned.
	DriveSyncSettings struct {
		NamePatterns []string           `json:"namePatterns"`
		FileSettings []FileSyncSettings `json:"fileSettings"`
	}
	// FileSyncSettings configures what settings are applied to the files in one or more drives
	FileSyncSettings struct {
		SinceDateTime time.Time `json:"sinceDateTime"`
		IgnorePrivate bool      `json:"ignorePrivate"`
		IgnoreDeleted bool      `json:"ignoreDeleted"`
	}
	DmsClient struct {
		httpClientBuilder func(integrationConfig any) *http.Client // just a fake, not going to be used for now
		redisClient       *redis.Client
		logger            *slog.Logger
	}
)

// NewDmsClient boots a DMSClient activity handler, at this stage it does not really do anything
func NewDmsClient(redisClient *redis.Client, logger *slog.Logger) *DmsClient {
	return &DmsClient{
		httpClientBuilder: func(integrationConfig any) *http.Client { panic("not implemented") },
		redisClient:       redisClient,
		logger:            logger,
	}
}

// SyncDrivesAndBatch mimicks retrieving drives from the API and store them in batches so the actual file sync can be
// done in a horizontal way (which isn't going to be the case in this case but ok).
// We do not return the drives, it could potentially take too much memory and it's not really something for the state
// of the workflow to keep track of, instead we rely on communicating it to the next step through a Redis.
func (dc DmsClient) SyncDrivesAndBatch(ctx context.Context, integrationId string, syncSessionId string, settings SyncSettings) ([]string, error) {
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}
	if dc.redisClient == nil {
		return nil, errors.New("redis client not initialized")
	}

	batchSize := settings.BatchSize
	if batchSize == 0 {
		batchSize = 200
	}
	dc.logger.Debug("fetching drives", "settings", settings)
	var drives []string
	// We've got 1000 drives, hooray
	for i := range 1000 {
		drives = append(drives, fmt.Sprintf("drive-%d", i))
	}
	dc.logger.Debug("finished fetching drives", "drivesCount", len(drives))

	dc.logger.Debug("creating batches")
	var batchIds []string
	for batchIdCntr, chunk := range slices.Collect(slices.Chunk(drives, batchSize)) {
		batchId := fmt.Sprintf("%s-%s-batch-%d", integrationId, syncSessionId, batchIdCntr)
		batchIds = append(batchIds, batchId)

		serialized, err := json.Marshal(chunk)
		if err != nil {
			return nil, fmt.Errorf("failed to serialize chunk: %w", err)
		}

		if err := dc.redisClient.Set(ctx, batchId, serialized, 14*24*time.Hour).Err(); err != nil {
			return nil, err
		}
	}
	dc.logger.Debug("batches created", "batchCount", len(batchIds))

	return batchIds, nil
}

func (dc DmsClient) ReleaseBatches(ctx context.Context, batchIds []string) error {
	if ctx.Err() != nil {
		return ctx.Err()
	}
	if dc.redisClient == nil {
		return errors.New("redis client not initialized")
	}
	return dc.redisClient.Del(ctx, batchIds...).Err()
}

// Merge maps the other setting into a sensible outcome, the original setting will be updated in place.
func (f *FileSyncSettings) Merge(o *FileSyncSettings) {
	// If one allows all, we should always allow all
	if !f.SinceDateTime.IsZero() {
		if o.SinceDateTime.IsZero() {
			f.SinceDateTime = time.Time{}
		} else if o.SinceDateTime.Before(f.SinceDateTime) {
			f.SinceDateTime = o.SinceDateTime
		}
	}
	if f.IgnorePrivate && !o.IgnorePrivate {
		f.IgnorePrivate = false
	}
	if f.IgnoreDeleted && !o.IgnoreDeleted {
		f.IgnoreDeleted = false
	}
}
