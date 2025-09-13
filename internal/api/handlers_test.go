package api

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"sqliter/internal/db"
	"sqliter/internal/models"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func setupTestDB(t *testing.T) (*db.SQLiteDB, string) {
	tmpfile, err := os.CreateTemp("", "test*.db")
	if err != nil {
		t.Fatal(err)
	}
	tmpfile.Close()

	// Create test database with sample data
	sqlDB, err := sql.Open("sqlite3", tmpfile.Name())
	if err != nil {
		t.Fatal(err)
	}

	// Create test table
	_, err = sqlDB.Exec(`
		CREATE TABLE users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			email TEXT UNIQUE NOT NULL,
			age INTEGER
		)
	`)
	if err != nil {
		t.Fatal(err)
	}

	// Insert test data
	_, err = sqlDB.Exec(`
		INSERT INTO users (name, email, age) VALUES
		('John Doe', 'john@example.com', 30),
		('Jane Smith', 'jane@example.com', 25)
	`)
	if err != nil {
		t.Fatal(err)
	}

	sqlDB.Close()

	// Open with our wrapper
	database, err := db.NewSQLiteDB(tmpfile.Name())
	if err != nil {
		t.Fatal(err)
	}

	return database, tmpfile.Name()
}

func TestGetTables(t *testing.T) {
	database, dbPath := setupTestDB(t)
	defer database.Close()
	defer os.Remove(dbPath)

	handler := NewHandler(database)
	router := handler.SetupRoutes()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/tables", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	var response struct {
		Tables []models.Table `json:"tables"`
	}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	if err != nil {
		t.Fatal(err)
	}

	if len(response.Tables) == 0 {
		t.Error("Expected at least one table")
	}

	found := false
	for _, table := range response.Tables {
		if table.Name == "users" {
			found = true
			break
		}
	}
	if !found {
		t.Error("Expected to find 'users' table")
	}
}

func TestGetTableSchema(t *testing.T) {
	database, dbPath := setupTestDB(t)
	defer database.Close()
	defer os.Remove(dbPath)

	handler := NewHandler(database)
	router := handler.SetupRoutes()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/tables/users/schema", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	var response struct {
		Columns []models.Column `json:"columns"`
	}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	if err != nil {
		t.Fatal(err)
	}

	if len(response.Columns) != 4 {
		t.Errorf("Expected 4 columns, got %d", len(response.Columns))
	}

	expectedColumns := map[string]bool{
		"id": false, "name": false, "email": false, "age": false,
	}

	for _, col := range response.Columns {
		if _, exists := expectedColumns[col.Name]; exists {
			expectedColumns[col.Name] = true
		}
	}

	for col, found := range expectedColumns {
		if !found {
			t.Errorf("Expected to find column '%s'", col)
		}
	}
}

func TestGetTableData(t *testing.T) {
	database, dbPath := setupTestDB(t)
	defer database.Close()
	defer os.Remove(dbPath)

	handler := NewHandler(database)
	router := handler.SetupRoutes()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/tables/users/data", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	var response models.TableData
	err := json.Unmarshal(w.Body.Bytes(), &response)
	if err != nil {
		t.Fatal(err)
	}

	if len(response.Rows) != 2 {
		t.Errorf("Expected 2 rows, got %d", len(response.Rows))
	}

	if len(response.Columns) != 4 {
		t.Errorf("Expected 4 columns, got %d", len(response.Columns))
	}

	// Check first row data
	firstRow := response.Rows[0]
	if firstRow["name"] != "John Doe" {
		t.Errorf("Expected first row name to be 'John Doe', got %v", firstRow["name"])
	}
}

func TestInsertRow(t *testing.T) {
	database, dbPath := setupTestDB(t)
	defer database.Close()
	defer os.Remove(dbPath)

	handler := NewHandler(database)
	router := handler.SetupRoutes()

	insertData := models.InsertRequest{
		Data: map[string]interface{}{
			"name":  "Bob Johnson",
			"email": "bob@example.com",
			"age":   35,
		},
	}

	jsonData, _ := json.Marshal(insertData)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/tables/users/rows", bytes.NewBuffer(jsonData))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("Expected status %d, got %d", http.StatusCreated, w.Code)
	}

	// Verify the row was inserted
	w2 := httptest.NewRecorder()
	req2, _ := http.NewRequest("GET", "/api/tables/users/data", nil)
	router.ServeHTTP(w2, req2)

	var response models.TableData
	json.Unmarshal(w2.Body.Bytes(), &response)

	if len(response.Rows) != 3 {
		t.Errorf("Expected 3 rows after insert, got %d", len(response.Rows))
	}
}

func TestUpdateRow(t *testing.T) {
	database, dbPath := setupTestDB(t)
	defer database.Close()
	defer os.Remove(dbPath)

	handler := NewHandler(database)
	router := handler.SetupRoutes()

	updateData := models.UpdateRequest{
		Data: map[string]interface{}{
			"age": 31,
		},
		Where: map[string]interface{}{
			"id": 1,
		},
	}

	jsonData, _ := json.Marshal(updateData)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("PUT", "/api/tables/users/rows", bytes.NewBuffer(jsonData))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	// Verify the row was updated
	w2 := httptest.NewRecorder()
	req2, _ := http.NewRequest("GET", "/api/tables/users/data", nil)
	router.ServeHTTP(w2, req2)

	var response models.TableData
	json.Unmarshal(w2.Body.Bytes(), &response)

	// Find the updated row
	for _, row := range response.Rows {
		if int64(row["id"].(float64)) == 1 {
			if int64(row["age"].(float64)) != 31 {
				t.Errorf("Expected age to be 31, got %v", row["age"])
			}
			break
		}
	}
}

func TestDeleteRow(t *testing.T) {
	database, dbPath := setupTestDB(t)
	defer database.Close()
	defer os.Remove(dbPath)

	handler := NewHandler(database)
	router := handler.SetupRoutes()

	deleteData := models.DeleteRequest{
		Where: map[string]interface{}{
			"id": 2,
		},
	}

	jsonData, _ := json.Marshal(deleteData)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("DELETE", "/api/tables/users/rows", bytes.NewBuffer(jsonData))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
	}

	// Verify the row was deleted
	w2 := httptest.NewRecorder()
	req2, _ := http.NewRequest("GET", "/api/tables/users/data", nil)
	router.ServeHTTP(w2, req2)

	var response models.TableData
	json.Unmarshal(w2.Body.Bytes(), &response)

	if len(response.Rows) != 1 {
		t.Errorf("Expected 1 row after delete, got %d", len(response.Rows))
	}

	// Make sure the remaining row is not the deleted one
	for _, row := range response.Rows {
		if int64(row["id"].(float64)) == 2 {
			t.Error("Row with id=2 should have been deleted")
		}
	}
}