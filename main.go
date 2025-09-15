package main

import (
	"embed"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"sqliter/internal/api"
	"sqliter/internal/db"
)

//go:embed all:web/dist
var staticFiles embed.FS

func main() {
	var (
		port   = flag.String("port", "2826", "Port to run the server on")
		dbPath = flag.String("db", "", "Path to SQLite database file")
	)
	flag.Parse()

	if *dbPath == "" {
		log.Fatal("Database path is required. Use --db flag to specify the SQLite database file.")
	}

	database, err := db.NewSQLiteDB(*dbPath)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer database.Close()

	// Create sub-filesystem for the dist directory
	distFS, err := fs.Sub(staticFiles, "web/dist")
	if err != nil {
		log.Fatalf("Failed to create sub-filesystem for static files: %v", err)
	}

	handler := api.NewHandler(database, distFS)
	router := handler.SetupRoutes()

	fmt.Printf("Starting SQLiter on port %s with database %s\n", *port, *dbPath)
	if err := router.Run(":" + *port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}