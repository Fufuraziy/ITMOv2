// Command api запускает HTTP-сервис поиска подборок. Адрес задаётся переменной ADDR (по умолчанию :8080).
package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"vv/collections/catalog"
	"vv/collections/internal/collections"
	"vv/collections/internal/httpapi"
)

func main() {
	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = ":8080"
	}
	cat, err := catalog.Load()
	if err != nil {
		log.Fatal(err)
	}
	store, err := collections.NewMemoryStore(cat.Collections)
	if err != nil {
		log.Fatal(err) // R1: невалидный каталог — сервер не стартует
	}
	srv := &http.Server{
		Addr:              addr,
		Handler:           httpapi.New(collections.NewService(store), cat.UpdatedAt),
		ReadHeaderTimeout: 5 * time.Second,
	}
	log.Printf("catalog %s: %d collections; listening on %s", cat.UpdatedAt, len(cat.Collections), addr)
	log.Fatal(srv.ListenAndServe())
}
