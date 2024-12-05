FROM golang:1.23-bookworm AS build

WORKDIR /app
COPY . /app

RUN go mod download
RUN CGO_ENABLED=0 go build -o worker

FROM gcr.io/distroless/static-debian12
COPY --from=build /app/worker /
ENTRYPOINT ["/worker"]
