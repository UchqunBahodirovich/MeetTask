# Go API for Cloud Run. The build context is the repository root because
# go.mod lives there while the code sits under backend/.
FROM golang:1.26-alpine AS build
WORKDIR /src

# Dependencies first so they stay cached while application code changes.
COPY go.mod go.sum ./
RUN go mod download

COPY backend ./backend
# Static binary: the runtime image has no libc.
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/api ./backend/cmd/api

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /
COPY --from=build /out/api /api
# Cloud Run injects PORT; the server already reads it.
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/api"]
