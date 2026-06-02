# Multi-stage build — tiny final image (~25MB), no Go toolchain in prod.

FROM golang:1.23-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY *.go *.lua ./
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/ki-clash-go .

# Run the Go test suite at build time — fail the image if engine logic regresses.
COPY *.go ./
RUN go test ./...

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/ki-clash-go /ki-clash-go
EXPOSE 8001
USER nonroot:nonroot
ENTRYPOINT ["/ki-clash-go"]
