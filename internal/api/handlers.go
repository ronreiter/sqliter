package api

import (
	"bytes"
	"encoding/csv"
	"io/fs"
	"net/http"
	"sqliter/internal/db"
	"sqliter/internal/models"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	db        *db.SQLiteDB
	staticFS  fs.FS
}

func NewHandler(database *db.SQLiteDB, staticFS fs.FS) *Handler {
	return &Handler{db: database, staticFS: staticFS}
}

func (h *Handler) GetDatabaseInfo(c *gin.Context) {
	info, err := h.db.GetDatabaseInfo()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, info)
}

func (h *Handler) GetTables(c *gin.Context) {
	tables, err := h.db.GetTables()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"tables": tables})
}

func (h *Handler) GetTableSchema(c *gin.Context) {
	tableName := c.Param("table")
	if tableName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "table name is required"})
		return
	}

	columns, err := h.db.GetTableSchema(tableName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"columns": columns})
}

func (h *Handler) GetTableData(c *gin.Context) {
	tableName := c.Param("table")
	if tableName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "table name is required"})
		return
	}

	limitStr := c.DefaultQuery("limit", "100")
	offsetStr := c.DefaultQuery("offset", "0")
	sortColumn := c.Query("sort_column")
	sortDirection := c.Query("sort_direction")
	whereClause := c.Query("where_clause")

	limit, err := strconv.Atoi(limitStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid limit parameter"})
		return
	}

	offset, err := strconv.Atoi(offsetStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid offset parameter"})
		return
	}

	// Validate sort direction if provided
	if sortDirection != "" && sortDirection != "asc" && sortDirection != "desc" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid sort_direction parameter, must be 'asc' or 'desc'"})
		return
	}

	data, err := h.db.GetTableData(tableName, limit, offset, sortColumn, sortDirection, whereClause)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, data)
}

func (h *Handler) InsertRow(c *gin.Context) {
	tableName := c.Param("table")
	if tableName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "table name is required"})
		return
	}

	var req models.InsertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.db.InsertRow(tableName, req.Data); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "row inserted successfully"})
}

func (h *Handler) UpdateRow(c *gin.Context) {
	tableName := c.Param("table")
	if tableName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "table name is required"})
		return
	}

	var req models.UpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.db.UpdateRow(tableName, req.Data, req.Where); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "row updated successfully"})
}

func (h *Handler) DeleteRow(c *gin.Context) {
	tableName := c.Param("table")
	if tableName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "table name is required"})
		return
	}

	var req models.DeleteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.db.DeleteRow(tableName, req.Where); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "row deleted successfully"})
}

func (h *Handler) ExecuteSQL(c *gin.Context) {
	var req models.ExecuteSQLRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if strings.TrimSpace(req.SQL) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "SQL query cannot be empty"})
		return
	}

	result, err := h.db.ExecuteSQL(req.SQL)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *Handler) ExportTableCSV(c *gin.Context) {
	tableName := c.Param("table")
	if tableName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "table name is required"})
		return
	}

	sortColumn := c.Query("sort_column")
	sortDirection := c.Query("sort_direction")
	whereClause := c.Query("where_clause")

	// Validate sort direction if provided
	if sortDirection != "" && sortDirection != "asc" && sortDirection != "desc" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid sort_direction parameter, must be 'asc' or 'desc'"})
		return
	}

	// Create a buffer to write CSV data
	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)

	// Export data to CSV
	if err := h.db.ExportTableCSV(tableName, sortColumn, sortDirection, whereClause, writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Set appropriate headers for file download
	filename := tableName + "_export.csv"
	c.Header("Content-Disposition", "attachment; filename="+filename)
	c.Header("Content-Type", "text/csv")

	// Return the CSV data
	c.Data(http.StatusOK, "text/csv", buf.Bytes())
}

func (h *Handler) SetupRoutes() *gin.Engine {
	r := gin.Default()

	// Use the provided static filesystem
	distFS := h.staticFS

	// CORS middleware
	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// Create sub-filesystem for assets
	assetsFS, err := fs.Sub(distFS, "assets")
	if err != nil {
		panic("Failed to create assets sub-filesystem: " + err.Error())
	}

	// Serve embedded static files
	r.StaticFS("/assets", http.FS(assetsFS))

	// Serve specific files from embedded filesystem
	r.GET("/vite.svg", func(c *gin.Context) {
		data, err := fs.ReadFile(distFS, "vite.svg")
		if err != nil {
			c.AbortWithStatus(http.StatusNotFound)
			return
		}
		c.Data(http.StatusOK, "image/svg+xml", data)
	})
	r.GET("/database.svg", func(c *gin.Context) {
		data, err := fs.ReadFile(distFS, "database.svg")
		if err != nil {
			c.AbortWithStatus(http.StatusNotFound)
			return
		}
		c.Data(http.StatusOK, "image/svg+xml", data)
	})
	r.GET("/", func(c *gin.Context) {
		data, err := fs.ReadFile(distFS, "index.html")
		if err != nil {
			c.AbortWithStatus(http.StatusNotFound)
			return
		}
		c.Data(http.StatusOK, "text/html", data)
	})

	api := r.Group("/api")
	{
		api.GET("/info", h.GetDatabaseInfo)
		api.GET("/tables", h.GetTables)
		api.GET("/tables/:table/schema", h.GetTableSchema)
		api.GET("/tables/:table/data", h.GetTableData)
		api.GET("/tables/:table/export/csv", h.ExportTableCSV)
		api.POST("/tables/:table/rows", h.InsertRow)
		api.PUT("/tables/:table/rows", h.UpdateRow)
		api.DELETE("/tables/:table/rows", h.DeleteRow)
		api.POST("/sql/execute", h.ExecuteSQL)
	}

	// Serve React app for all non-API routes (client-side routing)
	r.NoRoute(func(c *gin.Context) {
		// Don't serve index.html for API routes
		if strings.HasPrefix(c.Request.URL.Path, "/api") {
			c.AbortWithStatus(http.StatusNotFound)
			return
		}

		// Don't serve index.html for static assets
		if strings.HasPrefix(c.Request.URL.Path, "/assets") ||
		   c.Request.URL.Path == "/vite.svg" ||
		   c.Request.URL.Path == "/database.svg" {
			c.AbortWithStatus(http.StatusNotFound)
			return
		}

		// Serve React app for all other routes from embedded filesystem
		data, err := fs.ReadFile(distFS, "index.html")
		if err != nil {
			c.AbortWithStatus(http.StatusNotFound)
			return
		}
		c.Data(http.StatusOK, "text/html", data)
	})

	return r
}