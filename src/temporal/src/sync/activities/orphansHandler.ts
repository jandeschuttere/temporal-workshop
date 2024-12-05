import { activityInfo, heartbeat, sleep } from '@temporalio/activity'

export class OrphansHandler {
    async detect(integrationId: string, syncSessionId: string): Promise<number> {
        const amountOfOrphans = 10
        const progress = activityInfo().heartbeatDetails || 0

        for (let i = progress; i < amountOfOrphans; i++) {
            await sleep(1000)
            heartbeat(i + 1)
            if (i === 2) {
                // Forcefully invoke a retry on the first attempt, the second attempt should start with a progress of 3
                throw new Error('Failed to detect orphans')
            }
        }
        return amountOfOrphans
    }

    async cleanup(integrationId: string, syncSessionId: string): Promise<void> {
        const progress = activityInfo().heartbeatDetails || 0
        for (let i = progress; i < 10; i++) {
            await sleep(1000)
            // Allow the activity to be cancelled
            heartbeat(i + 1)
        }
    }
}