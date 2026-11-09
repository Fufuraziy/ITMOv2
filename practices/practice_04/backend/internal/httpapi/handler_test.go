package httpapi_test

import (
	"context"
	"encoding/json"
	"errors"
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
			Tags: []string{"завтрак", "быстро"}, CartURL: "https://vkusvill.ru/mobile?basket&share=1",
			CartURLs: map[string]string{"2": "https://vkusvill.ru/mobile?basket&share=12", "4": "https://vkusvill.ru/mobile?basket&share=14"},
			Products: []collections.Product{product(1, "Сырники", 306), product(2, "Сметана", 98)}},
		{ID: "sup", Title: "Тыквенный суп", Description: "Тыква и сливки",
			Tags: []string{"обед", "суп"}, CartURL: "https://vkusvill.ru/mobile?basket&share=2",
			CartURLs: map[string]string{"2": "https://vkusvill.ru/mobile?basket&share=22", "4": "https://vkusvill.ru/mobile?basket&share=24"},
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
		{"бюджет на 2 порции", "/collections?servings=2&max_price=800", []string{"sup"}}, // суп 272, завтрак 808
		{"дороже — выше на 2 порции", "/collections?servings=2&sort=price_desc", []string{"zavtrak", "sup"}},
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
		// R7: допустимы ровно 1, 2, 4.
		"/collections?servings=0",
		"/collections?servings=3",
		"/collections?servings=-2",
		"/collections?servings=2.0",
		"/collections?servings=02",
		"/collections?servings=%202",
		"/collections?servings=x2",
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
	if got.ID != "zavtrak" || got.TotalPrice != 404 || got.CartURL != "https://vkusvill.ru/mobile?basket&share=1" {
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

// TestAPI_Servings проверяет R7: servings в GET /collections/{id} и GET /collections.
func TestAPI_Servings(t *testing.T) {
	h := newHandler(t)
	get := func(target string) collections.ScaledCollection {
		t.Helper()
		rec := do(t, h, http.MethodGet, target)
		if rec.Code != http.StatusOK {
			t.Fatalf("%s: status = %d, want 200; body: %s", target, rec.Code, rec.Body)
		}
		return decode[collections.ScaledCollection](t, rec)
	}

	got := get("/collections/zavtrak?servings=2")
	if got.Servings != 2 || got.TotalPrice != 808 || len(got.Variants) != 3 || len(got.Products) != 2 {
		t.Fatalf("×2: servings %d, total_price %d, variants %d, products %d; want 2, 808, 3, 2",
			got.Servings, got.TotalPrice, len(got.Variants), len(got.Products))
	}
	for _, p := range got.Products {
		if p.Quantity != 2 || p.BaseQuantity != 1 || !p.Scalable {
			t.Errorf("×2 %s: quantity %v, base_quantity %v, scalable %v; want 2, 1, true", p.Name, p.Quantity, p.BaseQuantity, p.Scalable)
		}
	}

	for _, target := range []string{"/collections/zavtrak", "/collections/zavtrak?servings="} {
		got := get(target)
		if got.Servings != 1 || got.TotalPrice != 404 || got.CartURL != "https://vkusvill.ru/mobile?basket&share=1" {
			t.Errorf("%s: servings %d, total_price %d, cart_url %q; want 1, 404, ссылка ×1 из фикстуры", target, got.Servings, got.TotalPrice, got.CartURL)
		}
	}

	if got := get("/collections/zavtrak?servings=4"); got.CartURL != "https://vkusvill.ru/mobile?basket&share=14" ||
		len(got.Variants) != 3 || got.Variants[2].CartURL != got.CartURL {
		t.Errorf("×4: cart_url %q; want ссылку ×4 из фикстуры, равную cart_url варианта 4", got.CartURL)
	}

	if got := get("/collections/zavtrak?servings=2&servings=4"); got.Servings != 2 {
		t.Errorf("повтор servings: servings = %d, want 2 (первое значение)", got.Servings)
	}

	rec := do(t, h, http.MethodGet, "/collections?servings=4")
	if rec.Code != http.StatusOK {
		t.Fatalf("search ×4: status = %d; body: %s", rec.Code, rec.Body)
	}
	body := decode[struct {
		Total       int                            `json:"total"`
		Collections []collections.ScaledCollection `json:"collections"`
	}](t, rec)
	if body.Total != 2 || len(body.Collections) != 2 {
		t.Fatalf("search ×4: total %d, collections %d; want 2, 2", body.Total, len(body.Collections))
	}
	for _, c := range body.Collections {
		if c.Servings != 4 || len(c.Variants) != 3 {
			t.Errorf("search ×4 %s: servings %d, variants %d; want 4, 3", c.ID, c.Servings, len(c.Variants))
		}
	}
}

// TestAPI_ServingsQuantityLimit проверяет границу R3/R7: масштабируемый товар с базой 10
// при servings=4 отдаётся ровно 40 — лимит корзины, без урезания и без дробной части.
func TestAPI_ServingsQuantityLimit(t *testing.T) {
	cat := catalog()
	cat[0].Products[0].Quantity = 10 // «Сырники», масштабируемый по умолчанию
	store, err := collections.NewMemoryStore(cat)
	if err != nil {
		t.Fatalf("NewMemoryStore: база 10 у масштабируемого товара должна проходить проверку: %v", err)
	}
	h := httpapi.New(collections.NewService(store), "2026-10-06")

	rec := do(t, h, http.MethodGet, "/collections/zavtrak?servings=4")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body: %s", rec.Code, rec.Body)
	}
	if raw := rec.Body.String(); !strings.Contains(raw, `"quantity":40,"base_quantity":10,`) {
		t.Errorf("body не содержит \"quantity\":40,\"base_quantity\":10 — количество ×4 не ровно 40; body: %s", raw)
	}

	got := decode[collections.ScaledCollection](t, rec)
	if p := got.Products[0]; p.Quantity != 40 || p.BaseQuantity != 10 || !p.Scalable {
		t.Errorf("products[0]: quantity %v, base_quantity %v, scalable %v; want 40, 10, true", p.Quantity, p.BaseQuantity, p.Scalable)
	}
	if len(got.Variants) != 3 || got.Variants[2].Multiplier != 4 || got.Variants[2].Quantities["1"] != 40 {
		t.Errorf("variants: %+v; want вариант ×4 с quantities[\"1\"] = 40", got.Variants)
	}
}

// failingStore — хранилище, которое всегда отвечает ошибкой (для проверки 500).
type failingStore struct{}

func (failingStore) List(context.Context) ([]collections.Collection, error) {
	return nil, errors.New("store is down")
}

func (failingStore) Get(context.Context, string) (collections.Collection, error) {
	return collections.Collection{}, errors.New("store is down")
}

// TestAPI_ErrorCodes проверяет FR-016: у каждой ошибки есть машинный code (contracts/http-api.md).
func TestAPI_ErrorCodes(t *testing.T) {
	broken := httpapi.New(collections.NewService(failingStore{}), "2026-10-06")
	tests := []struct {
		name     string
		h        http.Handler
		target   string
		status   int
		wantCode string
	}{
		{"неверный max_price", newHandler(t), "/collections?max_price=0", http.StatusBadRequest, "invalid_query"},
		{"неверный servings в поиске", newHandler(t), "/collections?servings=3", http.StatusBadRequest, "invalid_query"},
		{"неверный servings раньше неизвестного id", newHandler(t), "/collections/net?servings=abc", http.StatusBadRequest, "invalid_query"},
		{"нет подборки", newHandler(t), "/collections/net?servings=2", http.StatusNotFound, "collection_not_found"},
		{"хранилище недоступно: поиск", broken, "/collections", http.StatusInternalServerError, "internal_error"},
		{"хранилище недоступно: подборка", broken, "/collections/zavtrak", http.StatusInternalServerError, "internal_error"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := do(t, tt.h, http.MethodGet, tt.target)
			if rec.Code != tt.status {
				t.Fatalf("status = %d, want %d; body: %s", rec.Code, tt.status, rec.Body)
			}
			body := decode[map[string]string](t, rec)
			if body["code"] != tt.wantCode || body["error"] == "" {
				t.Errorf("body = %v, want code %q и непустой error", body, tt.wantCode)
			}
		})
	}
}
