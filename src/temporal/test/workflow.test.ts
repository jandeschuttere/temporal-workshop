import { heartbeat, sleep } from '@temporalio/activity'
import { MockActivityEnvironment, TestWorkflowEnvironment } from '@temporalio/testing'
import { Runtime, DefaultLogger, Worker } from '@temporalio/worker'
import { v4 as uuid } from 'uuid'
import { after, before, describe, it } from 'mocha'
import * as assert from "node:assert"

describe('SyncWorkflow', async function () {
    let env: TestWorkflowEnvironment

    this.slow(10_000)
    this.timeout(20_000)

    before(async function () {
        // Filter INFO log messages for clearer test output
        Runtime.install({ logger: new DefaultLogger('WARN') })
        env = await TestWorkflowEnvironment.createTimeSkipping()
    })

    after(async () => {
        await env.teardown()
    })

    it('will fail after the first attempt if the sync session cannot be created', async () => {
        let attempts = 0

        const mockedActivities = {
            createIntegrationSyncSession: async () => {
                attempts++
                throw new Error('Failed to create sync session')
            },
        }
        const worker = await Worker.create({
            connection: env.nativeConnection,
            taskQueue: 'test-sync',
            workflowsPath: require.resolve('../src/sync/workflow'),
            activities: mockedActivities,
        })
        try {
            await worker.runUntil(
                env.client.workflow.execute('SyncWorkflow', {
                    workflowId: uuid(),
                    taskQueue: 'test-sync',
                    args: ['integration-id', {}],
                })
            )
        } catch (e) {/* expected and ignored */ }
        assert.strictEqual(attempts, 1)
    })

    it('is possible to cancel a drive sync', async () => {
        const workflowId = uuid()

        const triggerCancel = async () => {
            await env.client.workflow.getHandle(workflowId).cancel()
        }

        const mockedBatchActivities = {
            syncDrivesAndBatch: async() => {
                let triggered = false
                for (let i = 0; i < 2 ; i++) {
                    await heartbeat(i)
                    if (!triggered) {
                        triggerCancel()
                        triggered = true
                    }
                    await sleep(1)
                }
                throw new Error('Not Cancelled')
            },
        }

        const mockedActivities = {
            createIntegrationSyncSession: async () => {
                return 'sync-session-id'
            },
        }

        const batchWorker = await Worker.create({
            connection: env.nativeConnection,
            taskQueue: 'sync-batching',
            activities: mockedBatchActivities,
        })

        const worker = await Worker.create({
            connection: env.nativeConnection,
            taskQueue: 'test-sync',
            workflowsPath: require.resolve('../src/sync/workflow'),
            activities: mockedActivities,
        })

        batchWorker.run()

        // No try..catch, we're expecting this to be handled and not throw
        await worker.runUntil(
            env.client.workflow.execute('SyncWorkflow', {
                workflowId,
                taskQueue: 'test-sync',
                args: ['integration-id', {}],
            })
        )
        batchWorker.shutdown()

        const state = await env.client.workflow.getHandle(workflowId).describe()
        assert.strictEqual(state.memo!.operation, 'cancelled.drives')
    })
})
