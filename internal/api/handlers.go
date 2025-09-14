package api

import (
	"net/http"
	"sqliter/internal/db"
	"sqliter/internal/models"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	db *db.SQLiteDB
}

func NewHandler(database *db.SQLiteDB) *Handler {
	return &Handler{db: database}
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

func (h *Handler) SetupRoutes() *gin.Engine {
	r := gin.Default()

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

	// Serve static files
	r.Static("/static", "./web/dist")
	r.Static("/assets", "./web/dist/assets")
	r.StaticFile("/vite.svg", "./web/dist/vite.svg")
	r.StaticFile("/database.svg", "./web/dist/database.svg")
	r.StaticFile("/", "./web/dist/index.html")

	api := r.Group("/api")
	{
		api.GET("/info", h.GetDatabaseInfo)
		api.GET("/tables", h.GetTables)
		api.GET("/tables/:table/schema", h.GetTableSchema)
		api.GET("/tables/:table/data", h.GetTableData)
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
		   strings.HasPrefix(c.Request.URL.Path, "/static") ||
		   c.Request.URL.Path == "/vite.svg" ||
		   c.Request.URL.Path == "/database.svg" {
			c.AbortWithStatus(http.StatusNotFound)
			return
		}

		// Serve React app for all other routes
		c.File("./web/dist/index.html")
	})

	return r
}