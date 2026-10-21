package httpapi_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"

	"vv/collections/internal/collections"
	"vv/collections/internal/httpapi"
)

func catalog() []collections.Collection {
	product := func(id int64, name string, price float64) collections.Product {
		return collections.Product{XMLID: id, Name: name, Quantity: 1, Unit: "шт", Price: price,
			URL: "https://vkusvill.ru/goods/item-" + name + "/"}
	}
	return []collections.Collection{
		{ID: "zavtrak", Title: "Завтрак с сырниками", Description: "Сырники и сметана",
			Tags: []string{"завтрак", "быстро"}, CartURL: "https://vkusvill.ru/?share_basket=1",
			Products: []collections.Product{product(1, "Сырники", 306), product(2, "Сметана", 98)}},
		{ID: "sup", Title: "Тыквенный суп", Description: "Тыква и сливки",
			Tags: []string{"обед", "суп"}, CartURL: "https://vkusvill.ru/?share_basket=2",
			Products: []collections.Product{product(3, "Тыква", 136)}},
	}
}

func newHandler(t *testing.T) http.Handler {
	t.Helper()
	store, err := collections.NewMemoryStore(catalog())
	if err != nil {
		t.Fatalf("NewMemoryStore: %v", err)
	}
	return httpapi.New(collections.NewService(store), "2026-10-06")
}

func do(t *testing.T, h http.Handler, method, target string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(method, target, nil))
	return rec
}

func decode[T any](t *testing.T, rec *httptest.ResponseRecorder) T {
	t.Helper()
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
		t.Fatalf("Content-Type = %q, want application/json; body: %s", ct, rec.Body)
	}
	var v T
	if err := json.Unmarshal(rec.Body.Bytes(), &v); err != nil {
		t.Fatalf("decode body %q: %v", rec.Body, err)
	}
	return v
}

type searchBody struct {
	UpdatedAt   string                   `json:"updated_at"`
	Total       int                      `json:"total"`
	Collections []collections.Collection `json:"collections"`
}

// TestAPI_Search проверяет R2: параметры запроса доходят до поиска, ответ — объект с датой каталога.
func TestAPI_Search(t *testing.T) {
	tests := []struct {
		name   string
		target string
		want   []string
	}{
		{"весь каталог", "/collections", []string{"zavtrak", "sup"}},
		{"текст", "/collections?q=%D1%82%D1%8B%D0%BA%D0%B2%D0%B0", []string{"sup"}}, // q=тыква
		{"тег", "/collections?tag=%D0%B7%D0%B0%D0%B2%D1%82%D1%80%D0%B0%D0%BA", []string{"zavtrak"}},
		{"бюджет", "/collections?max_price=200", []string{"sup"}},
		{"сортировка", "/collections?sort=price_asc", []string{"sup", "zavtrak"}},
		{"ничего не нашлось", "/collections?q=pizza", []string{}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := do(t, newHandler(t), http.MethodGet, tt.target)

			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, want 200; body: %s", rec.Code, rec.Body)
			}
			got := decode[searchBody](t, rec)
			ids := []string{}
			for _, c := range got.Collections {
				ids = append(ids, c.ID)
			}
			if got.UpdatedAt != "2026-10-06" || got.Total != len(tt.want) || !reflect.DeepEqual(ids, tt.want) {
				t.Errorf("body = updated_at %q, total %d, ids %q; want 2026-10-06, %d, %q",
					got.UpdatedAt, got.Total, ids, len(tt.want), tt.want)
			}
			if strings.Contains(rec.Body.String(), `"collections":null`) {
				t.Errorf("collections must be [], got null")
			}
		})
	}
}

func TestAPI_SearchBadQuery(t *testing.T) {
	for _, target := range []string{
		"/collections?max_price=abc",
		"/collections?max_price=0",
		"/collections?max_price=-5",
		"/collections?sort=cheap",
	} {
		t.Run(target, func(t *testing.T) {
			rec := do(t, newHandler(t), http.MethodGet, target)

			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400; body: %s", rec.Code, rec.Body)
			}
			if got := decode[map[string]string](t, rec)["error"]; !strings.HasPrefix(got, "invalid query: ") {
				t.Errorf("error = %q, want prefix %q", got, "invalid query: ")
			}
		})
	}
}

func TestAPI_GetByID(t *testing.T) {
	h := newHandler(t)

	rec := do(t, h, http.MethodGet, "/collections/zavtrak")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body: %s", rec.Code, rec.Body)
	}
	got := decode[collections.Collection](t, rec)
	if got.ID != "zavtrak" || got.TotalPrice != 404 || got.CartURL != "https://vkusvill.ru/?share_basket=1" {
		t.Errorf("collection = %+v", got)
	}

	rec = do(t, h, http.MethodGet, "/collections/net")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
	if got := decode[map[string]string](t, rec)["error"]; got != "collection not found" {
		t.Errorf("error = %q", got)
	}
}

func TestAPI_Tags(t *testing.T) {
	rec := do(t, newHandler(t), http.MethodGet, "/tags")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body: %s", rec.Code, rec.Body)
	}
	got := decode[[]collections.TagCount](t, rec)
	if len(got) != 4 || got[0] != (collections.TagCount{Tag: "быстро", Count: 1}) {
		t.Errorf("tags = %+v", got)
	}
}

func TestAPI_ReadOnly(t *testing.T) {
	for _, tc := range []struct{ method, target string }{
		{http.MethodPost, "/collections"},
		{http.MethodDelete, "/collections/zavtrak"},
		{http.MethodPut, "/tags"},
	} {
		if rec := do(t, newHandler(t), tc.method, tc.target); rec.Code != http.StatusMethodNotAllowed {
			t.Errorf("%s %s status = %d, want 405", tc.method, tc.target, rec.Code)
		}
	}
}
