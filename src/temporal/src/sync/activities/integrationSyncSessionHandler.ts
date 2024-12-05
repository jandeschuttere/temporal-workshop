export class IntegrationSyncSessionHandler {
    async create(integrationId: string): Promise<string> {
        return `sync-session-${integrationId}-${Date.now()}`;
    }

    async markFinished(sessionId: string): Promise<void> {
        // Mark the session as finished
        return
    }
}
