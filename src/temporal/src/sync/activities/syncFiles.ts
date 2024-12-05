import {activityInfo, heartbeat, log, sleep} from '@temporalio/activity'
import {createClient} from 'redis'

export async function syncFiles(redisClient: ReturnType<typeof createClient>, integrationId: string, syncSessionId: string, batchId: string): Promise<void> {
    const activity = "syncFiles"
    log.info("start", {activity, integrationId, syncSessionId, batchId})
    try {
        // Reconnect in case we don't have a connection but handle concurrency in which we are having a connection
        // by some other instantiation
        await redisClient.connect()
    } catch (err) {
        if (!(
            (typeof err === "string" && err.includes('already opened')) ||
            (err instanceof Error && err.message.includes('already opened'))
        )) {
            throw err
        }
    }
    const result = await redisClient.get(batchId)
    if (!result) {
        throw new Error(`Batch ${batchId} not found`)
    }
    const processedDriveKey = activityInfo().heartbeatDetails || -1

    const driveIds: string[] = JSON.parse(result)
    for (let key = 0; key < driveIds.length; key++) {
        const driveId = driveIds[key]
        if (key <= processedDriveKey) {
            log.debug("Skipping drive, already processed", {activity, integrationId, syncSessionId, batchId, driveId})
            return
        }
        // Do something here
        log.debug("Processing drive", {activity, integrationId, syncSessionId, batchId, driveId})
        heartbeat(key)
        await sleep(250)
    }
    await sleep(1000)

    log.info("finished", {activity, integrationId, syncSessionId, batchId})
}