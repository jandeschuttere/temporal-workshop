import express, { Request, Response } from 'express'
import {Connection, Client, WorkflowExecutionDescription} from '@temporalio/client'
import cors from 'cors'

const app = express()
const workflowName = 'SyncWorkflow'
const workflowId = 'temporal-workshop'
const taskQueue = 'sync'

app.use(cors())
app.use(express.json())

app.post('/api/workflow/start', async (req: Request, res: Response) => {
    const settings = {
        batchSize: 200,
        driveSettings: [
            {
                patterns: ['.*\.docx', '.*\.pdf'],
                fileSettings: [
                    {
                        sinceDateTime: null,
                        ignorePrivate: false,
                        ignoreDeleted: false
                    }
                ],
            }
        ],
    }


    const client = await temporalClient()
    await client.workflow.execute(workflowName, { taskQueue, workflowId, args: ['integrationId', settings] })

    // Logic to start the Temporal workflow
    res.send('Workflow started')
})

app.post('/api/workflow/cancel', async (req: Request, res: Response) => {
    const client = await temporalClient()
    await client.workflow.getHandle(workflowId).cancel()

    res.send('Workflow canceled')
})

app.post('/api/workflow/terminate', async (req: Request, res: Response) => {
    const client = await temporalClient()
    await client.workflow.getHandle(workflowId).terminate('Terminated through UI')

    res.send('Workflow terminated')
})

app.post('/api/workflow/signal', async (req: Request, res: Response) => {
    const client = await temporalClient()
    await client.workflow.getHandle(workflowId).signal(req.body.signal)

    res.send(`Signal ${req.body.signal} sent to workflow`)
})

app.get('/api/workflow/status', async (req: Request, res: Response) => {
    const client = await temporalClient()
    let status: WorkflowExecutionDescription | {} = {}
    let operation = 'unknown'
    let orphansDetected = 0
    try {
        const description = await client.workflow.getHandle(workflowId).describe()
        status = description
        if (description?.memo && 'operation' in description.memo) {
            operation = description.memo['operation'] as string
        }
        const state: { orphansDetected: number } = await client.workflow.getHandle(workflowId).query('getState')
        orphansDetected = state.orphansDetected
    } catch (e) {
        // ignore
    }
    res.json({ status, operation, orphansDetected })
})

const port = process.env.PORT || 3000
app.listen(port, () => {
    console.log(`Server running on port ${port}`)
})

async function temporalClient() {
    const temporalAddress = process.env.TEMPORAL_ADDRESS || 'localhost:7233'
    const connection = await Connection.connect({ address: temporalAddress, tls: false })
    return new Client({ connection })
}