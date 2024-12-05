import { IntegrationSyncSessionHandler } from './integrationSyncSessionHandler'
import { OrphansHandler } from "./orphansHandler"
import { syncFiles } from "./syncFiles"
import { createClient } from "redis"

export default function createActivities(redisClient: ReturnType<typeof createClient>) {
    const syncSessionHandler = new IntegrationSyncSessionHandler()
    const orphanHandler = new OrphansHandler()

    return {
        createIntegrationSyncSession: syncSessionHandler.create,
        markIntegrationSyncSessionFinished: syncSessionHandler.markFinished,
        detectOrphans: orphanHandler.detect,
        cleanupOrphans: orphanHandler.cleanup,
        syncFiles: async (integrationId: string, syncSessionId: string, batchId: string) => {
            return syncFiles(redisClient, integrationId, syncSessionId, batchId)
        }
    }
}
