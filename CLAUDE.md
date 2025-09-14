# SQLiter - Database Web Interface

## Development Instructions for Claude

### Standard Operations

**IMPORTANT**: All standard executions should be done via taskfile. Use the `task` command instead of running individual build tools directly.

### Available Commands

#### Build Commands
```bash
task build          # Build the complete SQLiter application (frontend and backend)
task build:frontend # Build only the React frontend
task build:backend  # Build only the Go backend
task build-docker   # Build Docker image for SQLiter
```

#### Development Commands
```bash
task dev            # Start development server (frontend)
task install        # Install frontend dependencies
task clean          # Clean build artifacts
```

#### Runtime Commands
```bash
task run            # Run SQLiter with default database (port 8080)
```

#### Testing Commands
```bash
task test           # Run Go tests
```

### Build Process

- **Frontend**: React + TypeScript built with Vite
- **Backend**: Go application built to `./sqliter` executable
- **Docker**: Multi-stage build combining both frontend and backend

### Development Notes

- Use `task build` for all build operations instead of direct npm/go commands
- Frontend development server runs on port 3000
- Production server runs on port 8080 (configurable)
- Example database: `example.db`