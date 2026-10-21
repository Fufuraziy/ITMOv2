// Package httpapi — HTTP-интерфейс поиска подборок (docs/requirements.md, R2, R4, R5).
package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"

	"vv/collections/internal/collections"
)

type handler struct {
	svc       *collections.Service
	updatedAt string
}

// New возвращает обработчик маршрутов API. updatedAt — дата цен каталога.
func New(svc *collections.Service, updatedAt string) http.Handler {
	h := &handler{svc: svc, updatedAt: updatedAt}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /collections", h.search)
	mux.HandleFunc("GET /collections/{id}", h.get)
	mux.HandleFunc("GET /tags", h.tags)
	return mux
}

type searchResponse struct {
	UpdatedAt   string                   `json:"updated_at"`
	Total       int                      `json:"total"`
	Collections []collections.Collection `json:"collections"`
}

func (h *handler) search(w http.ResponseWriter, r *http.Request) {
	q, err := parseQuery(r)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, errorBody{Error: "invalid query: " + err.Error()})
		return
	}
	list, err := h.svc.Search(r.Context(), q)
	if err != nil {
		h.internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, searchResponse{UpdatedAt: h.updatedAt, Total: len(list), Collections: list})
}

func parseQuery(r *http.Request) (collections.Query, error) {
	v := r.URL.Query()
	q := collections.Query{Text: v.Get("q"), Tag: v.Get("tag")}
	if s := v.Get("max_price"); s != "" {
		n, err := strconv.Atoi(s)
		if err != nil || n <= 0 {
			return q, fmt.Errorf("max_price must be a positive integer, got %q", s)
		}
		q.MaxPrice = n
	}
	sort, err := collections.ParseSort(v.Get("sort"))
	if err != nil {
		return q, err
	}
	q.Sort = sort
	return q, nil
}

func (h *handler) get(w http.ResponseWriter, r *http.Request) {
	c, err := h.svc.Get(r.Context(), r.PathValue("id"))
	switch {
	case errors.Is(err, collections.ErrNotFound):
		writeJSON(w, http.StatusNotFound, errorBody{Error: "collection not found"})
	case err != nil:
		h.internalError(w, err)
	default:
		writeJSON(w, http.StatusOK, c)
	}
}

func (h *handler) tags(w http.ResponseWriter, r *http.Request) {
	tags, err := h.svc.Tags(r.Context())
	if err != nil {
		h.internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, tags)
}

func (h *handler) internalError(w http.ResponseWriter, err error) {
	log.Printf("internal error: %v", err)
	writeJSON(w, http.StatusInternalServerError, errorBody{Error: "internal error"})
}

type errorBody struct {
	Error string `json:"error"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("write response: %v", err)
	}
}
