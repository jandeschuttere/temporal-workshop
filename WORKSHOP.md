# Workshop

This time it's over to you, I've removed some code and added some comments to guide you through the process.
I can't prevent you from cheating but I hope you'll try to solve the tasks without looking at the `main` branch or the commits.

If you do get stuck, it is after all non-production-grade code, let me know and I'll help you out!

## Tasks

### Controlling the workflow

I've removed all code to control the temporal flow, except for the trigger to start it, it's up to you to fill in the blanks for the other actions that are needed to be done.

Check `src/api/src/index.ts` to start working on this! 
Maybe [this SDK reference](https://typescript.temporal.io/api/classes/client.WorkflowClient?_gl=1*1mk0aj*_gcl_au*OTc4MzI5MDA2LjE3MjcyNTYzODE.*_ga*NjMyMTU3NjI4LjE3MjcyNTYzODI.*_ga_R90Q9SJD3D*MTczMzM5MTU5OC41OS4xLjE3MzMzOTQ3MjguMC4wLjA.#gethandle) can unveil some of the secrets.

### Fix communicating with the other language activities

Oh noes, something has changed preventing us to communicate with the Go activities. The workflow halts when it reaches the first step, can you fix it?

If you can't immediately figure it out, [this post](https://community.temporal.io/t/calling-task-queue-from-multiple-languages/8521) will explain it to you.

### Cancelling an ongoing workflow

We want to be able to cancel the workflow when it's performing a sync of files, can you add what is needed?
You can use this example as a reference: [Cancelling an ongoing activity](https://github.com/temporalio/samples-typescript/tree/3c235821df2465b2ce5a79d8f5399754b2d01224/activities-cancellation-heartbeating)

### Triggering a workflow from the workflow

Once the sync has completed we want the workflow to trigger the `DocumentIndexing` workflow. The `DocumentIndexing` workflow should not halt or get cancelled when the `SyncWorkflow` is cancelled.

Have a look at `src/temporal/src/sync/workflow.ts` and [the Temporal docs on this subject](https://docs.temporal.io/develop/typescript/child-workflows)

### Communication of a workflow during execution

The UI wants to show the progress of the workflow, yet there's no information present, could you add this?

Both `src/temporal/src/sync/workflow.ts` and `src/api/src/index.ts` need to be updated for this.
This is lacking from the main docs but you can use [this well hidden post](https://community.temporal.io/t/reading-a-memo-using-typescript/13577) as a baseline.

### Fix test or behaviour

There's a test to check if an activity is only running once, yet it's failing. Can you fix it?

Look at `src/temporal/test/workflow.test.ts` to fix this.

### Remove the activity loadbalancing

We don't need loadbalancing with these activities, lets make it faster and remove the limiting factor while still preserving the same batches. Happy hunting!

### Bonus challenge

If you look closely at the logs of the Go worker you can see that the patterns are not communicating as they should, what would need to be changed?

The Go code is located in `goactivity/dmsclient/dmsclient.go` and the TypeScript code in `src/temporal/src/sync/workflow.ts`.