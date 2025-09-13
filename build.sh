#!/bin/bash

echo "Building SQLiter..."

# Build frontend
echo "Building frontend..."
cd web
npm install
npm run build
cd ..

# Build Go application
echo "Building Go application..."
CGO_ENABLED=1 go build -o sqliter ./cmd/main.go

echo "Build completed! You can now run: ./sqliter --port 1234 --db example.db"