# Build frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/web
COPY web/package*.json ./
RUN npm install

COPY web/ ./
RUN npm run build

# Build Go application
FROM golang:1.20-alpine AS go-builder

# Install build dependencies
RUN apk add --no-cache gcc musl-dev sqlite-dev

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
# Copy built frontend assets
COPY --from=frontend-builder /app/web/dist ./web/dist

RUN CGO_ENABLED=1 GOOS=linux go build -a -installsuffix cgo -o sqliter ./cmd/main.go

# Final stage
FROM alpine:latest

# Install runtime dependencies
RUN apk --no-cache add ca-certificates sqlite
WORKDIR /root/

# Copy the binary and frontend assets
COPY --from=go-builder /app/sqliter .
COPY --from=go-builder /app/web/dist ./web/dist

EXPOSE 8080

ENTRYPOINT ["./sqliter"]