import * as wf from '@temporalio/workflow'

type State = {
    syncSessionId: string | null
    drivesFetchStartedAt: number | null
    drivesFetchFinishedAt: number | null
    fileSyncStartedAt: number | null
    fileSyncFinishedAt: number | null
    orphansDetected: number
}
export const approveSignal = wf.defineSignal('approve')
export const getStateQuery = wf.defineQuery<State>('getState')

type SyncSettings = {
    driveSettings: DriveSyncSettings[]
    batchSize: number
}
type DriveSyncSettings = {
    patterns: string[]
    fileSettings: FileSyncSettings[]
}
type FileSyncSettings = {
    sinceDateTime: Date | null
    ignorePrivate: boolean
    ignoreDeleted: boolean
}

interface SyncActivities {
    createIntegrationSyncSession(integrationId: string): Promise<string>
    // We want to isolate the drives from the files because we want to be able to scale horizontally
    syncDrivesAndBatch(integrationId: string, syncSessionId: string, syncSettings: SyncSettings): Promise<string[]>
    syncFiles(integrationId: string, syncSessionId: string, batchId: string): Promise<void>
    detectOrphans(integrationId: string, syncSessionId: string): Promise<number>
    cleanupOrphans(integrationId: string, syncSessionId: string): Promise<void>
    releaseBatches(batches: string[]): Promise<void>
    markIntegrationSyncSessionFinished(syncSessionId: string): Promise<void>
}

export async function SyncWorkflow(integrationId: string, syncSettings: SyncSettings): Promise<State> {
    const state: State = {
        syncSessionId: null,
        drivesFetchStartedAt: null,
        drivesFetchFinishedAt: null,
        fileSyncStartedAt: null,
        fileSyncFinishedAt: null,
        orphansDetected: 0,
    }
    let allowOrphanCleanup = false

    const { createIntegrationSyncSession, markIntegrationSyncSessionFinished } = wf.proxyActivities<SyncActivities>({
        startToCloseTimeout: '10m',
        retry: { maximumAttempts: 2 }
    })
    const { detectOrphans } = wf.proxyActivities<SyncActivities>({
        startToCloseTimeout: '10m',
        retry: { maximumAttempts: 5, maximumInterval: '1 minute', initialInterval: '10 seconds'}
    })
    const { cleanupOrphans, syncFiles } = wf.proxyActivities<SyncActivities>({
        startToCloseTimeout: '60m',
        retry: { maximumAttempts: 3, initialInterval: '1 minute' }
    })
    const { syncDrivesAndBatch, releaseBatches } = wf.proxyActivities<SyncActivities>({
        startToCloseTimeout: '60m',
        retry: { maximumAttempts: 3, initialInterval: '1 minute' }
    })

    wf.setHandler(getStateQuery, () => state)
    wf.setHandler(approveSignal, () => void (allowOrphanCleanup = true))

    // Create integration sync session, keep track of the id
    const syncSessionId = await createIntegrationSyncSession(integrationId)

    // This is the time we fetched the drives, is overridden by the sandbox,
    // will always yield the same value after the first invocation
    state.drivesFetchStartedAt = Date.now()
    const driveBatches: string[] = []
    try {
        console.log('start syncDrivesAndBatch')
        driveBatches.push(...(await syncDrivesAndBatch(integrationId, syncSessionId, syncSettings)))
    } catch (e) {
        if (wf.isCancellation(e)) {
            wf.log.info('Cancelled')
            return state
        }
        throw e
    }
    state.drivesFetchFinishedAt = Date.now()

    state.fileSyncStartedAt = Date.now()
    // Divide the work into batches and allow them to be processed in parallel
    // The timeout can be very long on this, but we'll add a heartbeat on the activity so we can always
    // cancel it if needed
    try {
        await Promise.all(driveBatches.map(batchId => syncFiles(integrationId, syncSessionId, batchId)))
    } catch (e) {
        if (wf.isCancellation(e)) {
            wf.log.info('Cancelled')
            return state
        }
        throw e
    }
    state.fileSyncFinishedAt = Date.now()
    await releaseBatches(driveBatches)

    state.orphansDetected = await detectOrphans(integrationId, syncSessionId)

    if (state.orphansDetected > 0) {
        // Wait for the signal to allow the cleanup
        try {
            await wf.condition(() => allowOrphanCleanup)
            await cleanupOrphans(integrationId, syncSessionId)
        } catch (err) {
            if (err instanceof wf.CancelledFailure) {
                wf.log.info('Cancelled')
                return state
            }
            throw err
        }
    }
    // Update the sync session with the latest information
    await markIntegrationSyncSessionFinished(syncSessionId)

    // Trigger the indexing workflow of documents
    // That workflow is independent and should not adhere to the state of this workflow
    // When this would've been a workflow that is in charge of the entire process we would for instance be able
    // to trigger (multiple) workflows (in parallel), optionally get output from them to continue the work, and allow
    // the cancellation and close trigger be communicated so you can control the child workflows through the parent.
    // Allowing for a synchronous way of thinking for the developer but keep the benefits of async and events

    // Done!
    return state
}

export async function DocumentIndexing(integrationId: string, syncSessionId: string) {
    // Index the documents
    // This is a placeholder for the actual implementation
    console.log(`Indexing documents for integration ${integrationId} and sync session ${syncSessionId}`)
    return
}
