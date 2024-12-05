# Introduction into Temporal

A durable execution engine for orchestrating distributed systems.

## What is Temporal?

There's a lot to read at their [docs](https://docs.temporal.io/) but in short, Temporal is a distributed, scalable, durable, and highly available orchestration engine that executes asynchronous long-running business logic in a scalable and resilient way.

They offer a lot of samples and tutorials to get you started, but I wanted to create a simple example to show how you can use Temporal to orchestrate a simple workflow.
This is an introduction to combining some of the concepts that I think are good to get acquainted with when you start.

## Starting the project

```bash
docker compose up -d --build
cd ui && npm install && npm start
```
The build flag can be omitted if you don't want to rebuild the images every time you start the project.

If you made changes in one of the backend services you can trigger a rebuild and redeploy, f.i. for the TypeScript worker:
```bash
docker compose up -d --force-recreate --no-deps --build worker-ts 
```

## The project structure

The project consists of a few services that are orchestrated by Temporal. The services are written in different languages and are all orchestrated by Temporal.
The temporal workflow is written in TypeScript and can be found at `/src/temporal/src/sync/workflow.ts`.

Some of the activities that the workflow is triggering are part of the same worker hosting the workflow.
The other activities are written in a different language, in this example in Go, and found at `goactivity`.

The frontend is a simple React app that is used to trigger the workflow and display the results.

The api communicating with temporal and the frontend is created at `src/api`.

The runtime configuration for these projects are defined in the `docker-compose.yaml` file.

## Final note

This is a very simple project to introduce some of the concepts, by no means this is production grade code.
I hope you have fun with it!

If you want to practice with some of the concepts yourself using this project, switch to branch `workshop` and follow the instructions in the WORKSHOP.md.
