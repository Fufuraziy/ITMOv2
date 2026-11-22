package httpapi_test

import (
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"

	"vv/collections/internal/collections"
	"vv/collections/internal/httpapi"
	"vv/collections/internal/suggestions"
)

func newSuggestionsHandler(t *testing.T) http.Handler {
	t.Helper()
	store, err := collections.NewMemoryStore(catalog())
	if err != nil {
		t.Fatalf("NewMemoryStore: %v", err)
	}
	now := func() time.Time { return time.Date(2026, 11, 22, 10, 0, 0, 0, time.UTC) }
	return httpapi.New(collections.NewService(store), "2026-10-06",
		httpapi.WithSuggestions(suggestions.NewService(now), 0))
}

func post(t *testing.T, h http.Handler, target, body string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, target, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	h.ServeHTTP(rec, req)
	return rec
}

type suggestionJSON struct {
	ID        int64  `json:"id"`
	Title     string `json:"title"`
	Occasion  string `json:"occasion"`
	Budget    int    `json:"budget"`
	Comment   string `json:"comment"`
	Status    string `json:"status"`
	CreatedAt string `json:"created_at"`
}

type errorJSON struct {
	Error  string            `json:"error"`
	Code   string            `json:"code"`
	Fields map[string]string `json:"fields"`
}

func TestAPI_CreateSuggestion(t *testing.T) {
	h := newSuggestionsHandler(t)

	rec := post(t, h, "/suggestions",
		`{"title":"Ужин на двоих","occasion":"ужин","budget":1500,"comment":"паста","email":"anna@example.ru"}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201; body: %s", rec.Code, rec.Body)
	}
	if strings.Contains(rec.Body.String(), "anna@example.ru") {
		t.Errorf("email leaked into response: %s", rec.Body)
	}
	got := decode[suggestionJSON](t, rec)
	want := suggestionJSON{ID: 1, Title: "Ужин на двоих", Occasion: "ужин", Budget: 1500, Comment: "паста",
		Status: "new", CreatedAt: "2026-11-22T10:00:00Z"}
	if got != want {
		t.Errorf("body = %+v, want %+v", got, want)
	}

	list := decode[struct {
		Total       int              `json:"total"`
		Suggestions []suggestionJSON `json:"suggestions"`
	}](t, do(t, h, http.MethodGet, "/suggestions"))
	if list.Total != 1 || len(list.Suggestions) != 1 || list.Suggestions[0] != want {
		t.Errorf("GET /suggestions = %+v, want the created suggestion", list)
	}
}

func TestAPI_ListSuggestionsEmpty(t *testing.T) {
	rec := do(t, newSuggestionsHandler(t), http.MethodGet, "/suggestions")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if body := strings.TrimSpace(rec.Body.String()); body != `{"total":0,"suggestions":[]}` {
		t.Errorf("body = %s, want empty list (not null)", body)
	}
}

func TestAPI_CreateSuggestionErrors(t *testing.T) {
	tests := []struct {
		name   string
		body   string
		status int
		want   errorJSON
	}{
		{"поля с ошибками", `{"title":"Уж","budget":-5,"email":"anna@"}`, http.StatusBadRequest,
			errorJSON{Code: "invalid_suggestion", Fields: map[string]string{"title": "too_short", "budget": "out_of_range", "email": "invalid"}}},
		{"бюджет строкой", `{"title":"Ужин","budget":"много"}`, http.StatusBadRequest,
			errorJSON{Code: "invalid_suggestion", Fields: map[string]string{"budget": "invalid"}}},
		{"пустое тело", `{}`, http.StatusBadRequest,
			errorJSON{Code: "invalid_suggestion", Fields: map[string]string{"title": "required", "budget": "required"}}},
		{"не JSON", `title=Ужин`, http.StatusBadRequest, errorJSON{Code: "invalid_body"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := post(t, newSuggestionsHandler(t), "/suggestions", tt.body)
			if rec.Code != tt.status {
				t.Fatalf("status = %d, want %d; body: %s", rec.Code, tt.status, rec.Body)
			}
			got := decode[errorJSON](t, rec)
			if got.Error == "" {
				t.Errorf("error text is empty: %s", rec.Body)
			}
			got.Error = ""
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("body = %+v, want %+v", got, tt.want)
			}
		})
	}
}

func TestAPI_CreateSuggestionDuplicate(t *testing.T) {
	h := newSuggestionsHandler(t)
	if rec := post(t, h, "/suggestions", `{"title":"Ужин на двоих","budget":1500}`); rec.Code != http.StatusCreated {
		t.Fatalf("first POST status = %d; body: %s", rec.Code, rec.Body)
	}
	rec := post(t, h, "/suggestions", `{"title":"ужин на двоих ","budget":900}`)
	if rec.Code != http.StatusConflict {
		t.Fatalf("status = %d, want 409; body: %s", rec.Code, rec.Body)
	}
	got := decode[errorJSON](t, rec)
	if got.Code != "duplicate_suggestion" || got.Fields["title"] != "duplicate" {
		t.Errorf("body = %+v, want duplicate_suggestion with fields.title=duplicate", got)
	}
}
