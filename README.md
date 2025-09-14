# SQLiter

A powerful web-based SQLite database editor with a Go backend and React frontend, packaged as a single executable. SQLiter provides a comprehensive interface for browsing, editing, and managing SQLite databases with advanced features for data manipulation and querying.

![SQLiter Screenshot](sqliter.png)

## 🚀 Features

### Database Management
- **Web-based Interface**: Modern, responsive UI built with React and Tailwind CSS
- **Single Executable**: Self-contained application with embedded frontend assets
- **Database Connection**: Connect to any SQLite database file
- **Table Browsing**: Sidebar navigation showing all tables in the database

### Full CRUD Operations
- **Create**: Add new rows using inline editing or modal dialog
- **Read**: View table data with intelligent type detection
- **Update**: Edit cells inline with double-click or use dedicated edit modal
- **Delete**: Remove individual rows or bulk delete selected rows

### Advanced Data Editing
- **Inline Editing**: Double-click any cell to edit directly in the table
- **Smart Input Types**: Automatic input type detection (text, number, date, boolean, etc.)
- **NULL Value Management**: Set fields to NULL with dedicated buttons
- **Batch Changes**: Make multiple edits with visual change tracking before saving
- **Validation**: Real-time validation with constraint error handling

### Filtering & Search
- **Column Filters**: Advanced filtering system with multiple operators:
  - **Text**: Contains, equals
  - **Numbers**: Greater than, less than, equals
  - **Booleans**: True/false filters
  - **NULL**: Is null, is not null
- **Multiple Filters**: Apply filters to multiple columns simultaneously
- **Filter Persistence**: Filters saved in URL for bookmarking and sharing
- **Quick Clear**: Clear individual or all filters with one click

### Sorting & Pagination
- **Multi-level Sorting**: Click column headers to sort (asc → desc → none)
- **Sort Persistence**: Sort preferences saved in URL
- **Flexible Pagination**: Choose page sizes (10, 25, 50, 100, 200, 1000)
- **Smart Navigation**: Previous/next page controls with current page indicator

### SQL Editor
- **Syntax Highlighting**: Full SQL syntax highlighting with Ace Editor
- **Auto-completion**: Intelligent code completion for SQL keywords
- **Query Execution**: Execute any SQL query with Ctrl+Enter or click
- **Results Display**: Formatted results table with export capabilities
- **Error Handling**: Clear error messages with line-by-line feedback
- **Performance Metrics**: Query execution time tracking

### Data Export
- **CSV Export**: Export query results to CSV format
- **Formatted Downloads**: Automatic filename generation with timestamps
- **Large Dataset Support**: Efficient handling of large result sets

### User Experience
- **Real-time Updates**: Live data refresh without page reloads
- **Change Tracking**: Visual indicators for unsaved changes
- **Bulk Operations**: Select multiple rows for batch operations
- **Responsive Design**: Works on desktop and mobile devices
- **Keyboard Shortcuts**: Ctrl+Enter for query execution, Escape to cancel edits
- **Loading States**: Clear loading indicators for all operations

### Data Type Support
- **Automatic Type Detection**: Smart handling of SQLite data types
- **Boolean Rendering**: Checkboxes for boolean values
- **Date/Time Inputs**: Specialized inputs for temporal data
- **Number Validation**: Proper handling of integers and decimals
- **Text Fields**: Multi-line text support with proper escaping

### Schema Information
- **Column Metadata**: Display data types, constraints, and properties
- **Primary Keys**: Visual indicators for primary key columns (🔑)
- **Unique Constraints**: Markers for unique columns (🔒)
- **NOT NULL**: Required field indicators (*)
- **Default Values**: Show default values for columns

### Error Handling
- **Constraint Violations**: User-friendly error messages for database constraints
- **Foreign Key Errors**: Clear feedback on referential integrity violations
- **Validation Errors**: Real-time validation with helpful suggestions
- **Connection Issues**: Graceful handling of database connection problems

## 🛠 Quick Start

### Using Docker

```bash
# Build the Docker image
docker build -t sqliter .

# Run with your database
docker run -p 2826:2826 -v /path/to/your/database.db:/data/database.db sqliter --db /data/database.db
```

### Building from Source

```bash
# Build everything using task commands
task build

# Run with your database
./sqliter --db example.db
```

### Manual Build Steps

1. **Build the frontend**:
```bash
cd web
npm install
npm run build
cd ..
```

2. **Build the Go application**:
```bash
go build -o sqliter ./cmd/main.go
```

3. **Run the application**:
```bash
./sqliter --db your-database.db
```

## 📖 Usage

Once running, open your browser to `http://localhost:2826` (or whatever port you specified).

### Interface Overview
- **Header**: Shows database filename and application title
- **Left Sidebar**: Lists all tables in the database with change indicators
- **Main Area**: Table contents with full editing capabilities
- **SQL Editor**: Accessible via navigation for custom queries

### Working with Data
1. **Viewing Data**: Select any table from the sidebar to view its contents
2. **Editing Cells**: Double-click any cell to edit inline
3. **Adding Rows**: Use the green row at the bottom or click "Add Row" button
4. **Filtering**: Click the "Filters" button to show column filters
5. **Sorting**: Click column headers to sort data
6. **Bulk Operations**: Select multiple rows using checkboxes for bulk actions

### SQL Editor
1. Navigate to the SQL Editor tab
2. Write your SQL query in the editor
3. Press Ctrl+Enter or click "Run Query" to execute
4. View results in the table below
5. Export results to CSV if needed

## 🔧 API Endpoints

The application exposes a comprehensive REST API:

### Database Information
- `GET /api/info` - Get database information (filename, etc.)

### Table Operations
- `GET /api/tables` - List all tables in the database
- `GET /api/tables/{table}/schema` - Get detailed table schema information
- `GET /api/tables/{table}/data` - Get table data with filtering, sorting, and pagination
  - Query parameters:
    - `limit` - Number of rows per page (default: 100)
    - `offset` - Starting row offset (default: 0)
    - `sort_column` - Column name to sort by
    - `sort_direction` - Sort direction (`asc` or `desc`)
    - `where_clause` - SQL WHERE clause for filtering

### Data Modification
- `POST /api/tables/{table}/rows` - Insert a new row
- `PUT /api/tables/{table}/rows` - Update an existing row
- `DELETE /api/tables/{table}/rows` - Delete a row

### SQL Execution
- `POST /api/sql/execute` - Execute custom SQL queries
  - Body: `{"sql": "SELECT * FROM table_name"}`
  - Returns: Query results with columns, rows, and metadata

## 🏗 Development

For development, you can run the frontend and backend separately:

### Backend Development
```bash
# Start the Go backend
go run ./cmd/main.go --db your-database.db
```

### Frontend Development
```bash
# Start the React dev server
cd web
npm install
npm run dev
```

The React dev server will proxy API calls to the Go backend.

### Running Tests
```bash
# Run API tests
go test ./internal/api -v

# Run with coverage
go test ./internal/api -v -cover
```

### Using Task Commands
```bash
# See all available commands
task --list

# Development workflow
task dev            # Start frontend dev server
task build          # Build both frontend and backend
task test           # Run all tests
task clean          # Clean build artifacts
```

## 🏛 Architecture

### Technology Stack
- **Backend**: Go with Gin framework, SQLite3 driver
- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **Editor**: Ace Editor for SQL syntax highlighting
- **Build**: Docker multi-stage build process

### Key Components
- **Database Layer** (`internal/db/`): SQLite connection and query execution
- **API Layer** (`internal/api/`): REST API handlers with validation
- **Frontend** (`web/src/`): React components with TypeScript
- **Models** (`internal/models/`): Data structures and request/response types

### Features Implementation
- **Filtering**: Dynamic WHERE clause generation with SQL injection prevention
- **Sorting**: Server-side ORDER BY with validation
- **Pagination**: LIMIT/OFFSET with total count calculation
- **Inline Editing**: Real-time change tracking with batch save operations
- **Type Safety**: Full TypeScript coverage with proper type definitions

SQLiter provides a comprehensive solution for SQLite database management with enterprise-grade features in a user-friendly interface. Whether you're exploring data, performing maintenance tasks, or building applications, SQLiter offers the tools you need for effective database management.