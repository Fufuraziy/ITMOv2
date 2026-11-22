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
	"vv/collections/internal/suggestions"
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
	// SUGGESTIONS_DELAY (например 1500ms) задерживает POST /suggestions — для демонстрации загрузки (R8).
	var delay time.Duration
	if s := os.Getenv("SUGGESTIONS_DELAY"); s != "" {
		if delay, err = time.ParseDuration(s); err != nil {
			log.Fatalf("SUGGESTIONS_DELAY: %v", err)
		}
	}
	srv := &http.Server{
		Addr: addr,
		Handler: httpapi.New(collections.NewService(store), cat.UpdatedAt,
			httpapi.WithSuggestions(suggestions.NewService(time.Now), delay)),
		ReadHeaderTimeout: 5 * time.Second,
	}
	log.Printf("catalog %s: %d collections; listening on %s", cat.UpdatedAt, len(cat.Collections), addr)
	log.Fatal(srv.ListenAndServe())
}
