import {DefaultLogger, NativeConnection, Runtime, Worker} from '@temporalio/worker'
import { createClient } from 'redis'
import { createLogger } from './logger'
import createActivities from "./sync/activities"

const winstonLogger = createLogger({
    isProduction: process.env.NODE_ENV === 'production',
    logFilePath: process.env.WORKER_LOG_PATH || '/var/log/worker.log',
})

async function main() {
    Runtime.install({
        logger: new DefaultLogger('DEBUG', (entry) => {
            winstonLogger.log({
                label: entry.meta?.activityId ? 'activity' : entry.meta?.workflowId ? 'workflow' : 'worker',
                level: entry.level.toLowerCase(),
                message: entry.message,
                timestamp: Number(entry.timestampNanos / 1_000_000n),
                ...entry.meta,
            })
        }),
    })
    const redisHost = process.env.REDIS_HOST || 'localhost'
    const redisPort = process.env.REDIS_PORT || 6379
    const redisClient = createClient({ url: `redis://${redisHost}:${redisPort}` })

    const temporalAddress = process.env.TEMPORAL_ADDRESS || 'localhost:7233'
    const temporalConnection = await NativeConnection.connect({ address: temporalAddress, tls: false })

    // Create a worker that uses the Runtime instance installed above
    const worker = await Worker.create({
        connection: temporalConnection,
        workflowsPath: require.resolve('./sync/workflow'),
        activities: createActivities(redisClient),
        taskQueue: 'sync',
        maxConcurrentActivityTaskExecutions: 2,
    })
    await worker.run()
}

main().then(
    () => void process.exit(0),
    (err) => {
        winstonLogger.error('Process failed', err)
        process.exit(1)
    }
)