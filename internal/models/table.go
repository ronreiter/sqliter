package models

type Table struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

type Column struct {
	CID          int    `json:"cid"`
	Name         string `json:"name"`
	Type         string `json:"type"`
	NotNull      bool   `json:"not_null"`
	DefaultValue *string `json:"default_value"`
	PrimaryKey   bool   `json:"primary_key"`
	Unique       bool   `json:"unique"`
}

type Row map[string]interface{}

type TableData struct {
	Columns []Column `json:"columns"`
	Rows    []Row    `json:"rows"`
	Total   int      `json:"total"`
}

type InsertRequest struct {
	Data map[string]interface{} `json:"data"`
}

type UpdateRequest struct {
	Data  map[string]interface{} `json:"data"`
	Where map[string]interface{} `json:"where"`
}

type DeleteRequest struct {
	Where map[string]interface{} `json:"where"`
}

type DatabaseInfo struct {
	Filename string `json:"filename"`
}

type SQLQueryResult struct {
	Columns      []string        `json:"columns"`
	Rows         [][]interface{} `json:"rows"`
	RowCount     int            `json:"rowCount"`
	RowsAffected int            `json:"rowsAffected,omitempty"`
}

type ExecuteSQLRequest struct {
	SQL string `json:"sql"`
}