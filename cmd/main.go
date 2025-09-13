package main

import (
	"flag"
	"fmt"
	"log"
	"sqliter/internal/api"
	"sqliter/internal/db"
)

func main() {
	var (
		port   = flag.String("port", "8080", "Port to run the server on")
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

	handler := api.NewHandler(database)
	router := handler.SetupRoutes()

	fmt.Printf("Starting SQLiter on port %s with database %s\n", *port, *dbPath)
	if err := router.Run(":" + *port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}