package db

import (
	"database/sql"
	"fmt"
	"path/filepath"
	"sqliter/internal/models"
	"strings"

	_ "github.com/mattn/go-sqlite3"
)

type SQLiteDB struct {
	db       *sql.DB
	filename string
}

func NewSQLiteDB(dbPath string) (*SQLiteDB, error) {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	filename := filepath.Base(dbPath)
	return &SQLiteDB{db: db, filename: filename}, nil
}

func (s *SQLiteDB) Close() error {
	return s.db.Close()
}

func (s *SQLiteDB) GetTables() ([]models.Table, error) {
	query := `SELECT name, type FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
	rows, err := s.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query tables: %w", err)
	}
	defer rows.Close()

	var tables []models.Table
	for rows.Next() {
		var table models.Table
		if err := rows.Scan(&table.Name, &table.Type); err != nil {
			return nil, fmt.Errorf("failed to scan table row: %w", err)
		}
		tables = append(tables, table)
	}

	return tables, nil
}

func (s *SQLiteDB) getUniqueConstraints(tableName string) (map[string]bool, error) {
	uniqueColumns := make(map[string]bool)

	// Get list of indexes for the table
	indexQuery := fmt.Sprintf("PRAGMA index_list(%s)", tableName)
	indexRows, err := s.db.Query(indexQuery)
	if err != nil {
		return uniqueColumns, err
	}
	defer indexRows.Close()

	for indexRows.Next() {
		var seq int
		var indexName string
		var unique int
		var origin string
		var partial int

		if err := indexRows.Scan(&seq, &indexName, &unique, &origin, &partial); err != nil {
			return uniqueColumns, err
		}

		// Only process unique indexes
		if unique == 1 {
			// Get columns for this unique index
			infoQuery := fmt.Sprintf("PRAGMA index_info(%s)", indexName)
			infoRows, err := s.db.Query(infoQuery)
			if err != nil {
				return uniqueColumns, err
			}

			for infoRows.Next() {
				var seqno int
				var cid int
				var columnName string

				if err := infoRows.Scan(&seqno, &cid, &columnName); err != nil {
					infoRows.Close()
					return uniqueColumns, err
				}

				// Mark this column as unique (only for single-column unique constraints)
				// For multi-column unique constraints, we'll skip marking individual columns
				var columnCount int
				countQuery := fmt.Sprintf("SELECT COUNT(*) FROM pragma_index_info('%s')", indexName)
				if err := s.db.QueryRow(countQuery).Scan(&columnCount); err == nil && columnCount == 1 {
					uniqueColumns[columnName] = true
				}
			}
			infoRows.Close()
		}
	}

	return uniqueColumns, nil
}

func (s *SQLiteDB) parseConstraintError(err error) error {
	errMsg := err.Error()

	// Handle UNIQUE constraint violations
	if strings.Contains(errMsg, "UNIQUE constraint failed:") {
		// Extract table and column from error message
		// Format: "UNIQUE constraint failed: users.email"
		parts := strings.Split(errMsg, "UNIQUE constraint failed: ")
		if len(parts) >= 2 {
			tableColumn := parts[1]
			columnParts := strings.Split(tableColumn, ".")
			if len(columnParts) >= 2 {
				column := columnParts[1]
				return fmt.Errorf("The value for '%s' already exists. This field must be unique.", column)
			}
		}
		return fmt.Errorf("A unique constraint was violated. This value already exists.")
	}

	// Handle NOT NULL constraint violations
	if strings.Contains(errMsg, "NOT NULL constraint failed:") {
		parts := strings.Split(errMsg, "NOT NULL constraint failed: ")
		if len(parts) >= 2 {
			tableColumn := parts[1]
			columnParts := strings.Split(tableColumn, ".")
			if len(columnParts) >= 2 {
				column := columnParts[1]
				return fmt.Errorf("The field '%s' is required and cannot be empty.", column)
			}
		}
		return fmt.Errorf("A required field is missing.")
	}

	// Handle FOREIGN KEY constraint violations
	if strings.Contains(errMsg, "FOREIGN KEY constraint failed") {
		return fmt.Errorf("This operation violates a foreign key constraint. The referenced record may not exist.")
	}

	// Handle CHECK constraint violations
	if strings.Contains(errMsg, "CHECK constraint failed:") {
		parts := strings.Split(errMsg, "CHECK constraint failed: ")
		if len(parts) >= 2 {
			constraint := parts[1]
			return fmt.Errorf("The value violates a check constraint: %s", constraint)
		}
		return fmt.Errorf("The value violates a check constraint.")
	}

	// Return original error if we can't parse it
	return err
}

func (s *SQLiteDB) GetTableSchema(tableName string) ([]models.Column, error) {
	query := fmt.Sprintf("PRAGMA table_info(%s)", tableName)
	rows, err := s.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to get table schema: %w", err)
	}
	defer rows.Close()

	var columns []models.Column
	for rows.Next() {
		var col models.Column
		var defaultValue sql.NullString
		var notNull int
		var pk int

		if err := rows.Scan(&col.CID, &col.Name, &col.Type, &notNull, &defaultValue, &pk); err != nil {
			return nil, fmt.Errorf("failed to scan column row: %w", err)
		}

		col.NotNull = notNull == 1
		col.PrimaryKey = pk == 1
		if defaultValue.Valid {
			col.DefaultValue = &defaultValue.String
		}

		columns = append(columns, col)
	}

	// Get unique constraints for the table
	uniqueColumns, err := s.getUniqueConstraints(tableName)
	if err != nil {
		return nil, fmt.Errorf("failed to get unique constraints: %w", err)
	}

	// Mark columns as unique
	for i := range columns {
		if uniqueColumns[columns[i].Name] {
			columns[i].Unique = true
		}
	}

	return columns, nil
}

func (s *SQLiteDB) GetTableData(tableName string, limit, offset int, sortColumn, sortDirection, whereClause string) (*models.TableData, error) {
	columns, err := s.GetTableSchema(tableName)
	if err != nil {
		return nil, err
	}

	// Build the base query with optional WHERE clause
	baseQuery := fmt.Sprintf("SELECT * FROM %s", tableName)
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM %s", tableName)

	if whereClause != "" {
		baseQuery += fmt.Sprintf(" WHERE %s", whereClause)
		countQuery += fmt.Sprintf(" WHERE %s", whereClause)
	}

	// Get total row count with filtering
	var total int
	if err := s.db.QueryRow(countQuery).Scan(&total); err != nil {
		return nil, fmt.Errorf("failed to get total row count: %w", err)
	}

	// Build the query with optional sorting
	query := baseQuery
	if sortColumn != "" && sortDirection != "" {
		// Validate sortColumn exists to prevent SQL injection
		columnExists := false
		for _, col := range columns {
			if col.Name == sortColumn {
				columnExists = true
				break
			}
		}
		if !columnExists {
			return nil, fmt.Errorf("invalid sort column: %s", sortColumn)
		}
		query += fmt.Sprintf(" ORDER BY %s %s", sortColumn, strings.ToUpper(sortDirection))
	}
	query += fmt.Sprintf(" LIMIT %d OFFSET %d", limit, offset)
	rows, err := s.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query table data: %w", err)
	}
	defer rows.Close()

	columnNames, err := rows.Columns()
	if err != nil {
		return nil, fmt.Errorf("failed to get column names: %w", err)
	}

	var data []models.Row
	for rows.Next() {
		values := make([]interface{}, len(columnNames))
		valuePtrs := make([]interface{}, len(columnNames))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}

		row := make(models.Row)
		for i, col := range columnNames {
			val := values[i]
			if val != nil {
				switch v := val.(type) {
				case []byte:
					row[col] = string(v)
				default:
					row[col] = v
				}
			} else {
				row[col] = nil
			}
		}
		data = append(data, row)
	}

	return &models.TableData{
		Columns: columns,
		Rows:    data,
		Total:   total,
	}, nil
}

func (s *SQLiteDB) InsertRow(tableName string, data map[string]interface{}) error {
	if len(data) == 0 {
		return fmt.Errorf("no data provided")
	}

	columns := make([]string, 0, len(data))
	placeholders := make([]string, 0, len(data))
	values := make([]interface{}, 0, len(data))

	for col, val := range data {
		columns = append(columns, col)
		placeholders = append(placeholders, "?")
		values = append(values, val)
	}

	query := fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s)",
		tableName,
		strings.Join(columns, ", "),
		strings.Join(placeholders, ", "))

	_, err := s.db.Exec(query, values...)
	if err != nil {
		return s.parseConstraintError(err)
	}

	return nil
}

func (s *SQLiteDB) UpdateRow(tableName string, data map[string]interface{}, where map[string]interface{}) error {
	if len(data) == 0 {
		return fmt.Errorf("no data provided")
	}
	if len(where) == 0 {
		return fmt.Errorf("no where clause provided")
	}

	setParts := make([]string, 0, len(data))
	values := make([]interface{}, 0, len(data)+len(where))

	for col, val := range data {
		setParts = append(setParts, fmt.Sprintf("%s = ?", col))
		values = append(values, val)
	}

	whereParts := make([]string, 0, len(where))
	for col, val := range where {
		whereParts = append(whereParts, fmt.Sprintf("%s = ?", col))
		values = append(values, val)
	}

	query := fmt.Sprintf("UPDATE %s SET %s WHERE %s",
		tableName,
		strings.Join(setParts, ", "),
		strings.Join(whereParts, " AND "))

	_, err := s.db.Exec(query, values...)
	if err != nil {
		return s.parseConstraintError(err)
	}

	return nil
}

func (s *SQLiteDB) DeleteRow(tableName string, where map[string]interface{}) error {
	if len(where) == 0 {
		return fmt.Errorf("no where clause provided")
	}

	whereParts := make([]string, 0, len(where))
	values := make([]interface{}, 0, len(where))

	for col, val := range where {
		whereParts = append(whereParts, fmt.Sprintf("%s = ?", col))
		values = append(values, val)
	}

	query := fmt.Sprintf("DELETE FROM %s WHERE %s",
		tableName,
		strings.Join(whereParts, " AND "))

	_, err := s.db.Exec(query, values...)
	if err != nil {
		return s.parseConstraintError(err)
	}

	return nil
}

func (s *SQLiteDB) GetDatabaseInfo() (*models.DatabaseInfo, error) {
	return &models.DatabaseInfo{
		Filename: s.filename,
	}, nil
}

func (s *SQLiteDB) ExecuteSQL(sqlQuery string) (*models.SQLQueryResult, error) {
	// Trim whitespace and check if query is empty
	sqlQuery = strings.TrimSpace(sqlQuery)
	if sqlQuery == "" {
		return nil, fmt.Errorf("empty SQL query")
	}

	// Check if this is a SELECT query or other type
	isSelect := strings.HasPrefix(strings.ToUpper(sqlQuery), "SELECT")

	if isSelect {
		return s.executeSelectQuery(sqlQuery)
	} else {
		return s.executeNonSelectQuery(sqlQuery)
	}
}

func (s *SQLiteDB) executeSelectQuery(sqlQuery string) (*models.SQLQueryResult, error) {
	rows, err := s.db.Query(sqlQuery)
	if err != nil {
		return nil, fmt.Errorf("failed to execute query: %w", err)
	}
	defer rows.Close()

	// Get column names
	columnNames, err := rows.Columns()
	if err != nil {
		return nil, fmt.Errorf("failed to get column names: %w", err)
	}

	var resultRows [][]interface{}
	for rows.Next() {
		values := make([]interface{}, len(columnNames))
		valuePtrs := make([]interface{}, len(columnNames))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}

		row := make([]interface{}, len(columnNames))
		for i, val := range values {
			if val != nil {
				switch v := val.(type) {
				case []byte:
					row[i] = string(v)
				default:
					row[i] = v
				}
			} else {
				row[i] = nil
			}
		}
		resultRows = append(resultRows, row)
	}

	return &models.SQLQueryResult{
		Columns:  columnNames,
		Rows:     resultRows,
		RowCount: len(resultRows),
	}, nil
}

func (s *SQLiteDB) executeNonSelectQuery(sqlQuery string) (*models.SQLQueryResult, error) {
	result, err := s.db.Exec(sqlQuery)
	if err != nil {
		return nil, s.parseConstraintError(err)
	}

	rowsAffected, _ := result.RowsAffected()

	return &models.SQLQueryResult{
		Columns:      []string{"rows_affected"},
		Rows:         [][]interface{}{{rowsAffected}},
		RowCount:     1,
		RowsAffected: int(rowsAffected),
	}, nil
}