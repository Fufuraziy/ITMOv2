package catalog_test

import (
	"regexp"
	"strings"
	"testing"

	"vv/collections/catalog"
	"vv/collections/internal/collections"
)

// TestLoad проверяет R1: каталог в репозитории разбирается и проходит правила R3.
func TestLoad(t *testing.T) {
	c, err := catalog.Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if !regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`).MatchString(c.UpdatedAt) {
		t.Errorf("updated_at = %q, want YYYY-MM-DD", c.UpdatedAt)
	}
	if len(c.Collections) < 10 {
		t.Errorf("catalog has %d collections, want at least 10", len(c.Collections))
	}
	if _, err := collections.NewMemoryStore(c.Collections); err != nil {
		t.Fatalf("catalog violates R3: %v", err)
	}
	carts := map[string]string{}
	for _, col := range c.Collections {
		if other, dup := carts[col.CartURL]; dup {
			t.Errorf("%s and %s share cart_url %s", other, col.ID, col.CartURL)
		}
		carts[col.CartURL] = col.ID
		for _, p := range col.Products {
			if strings.Contains(p.Name, "&nbsp;") || strings.Contains(p.Name, " ") {
				t.Errorf("%s: product name %q has a non-breaking space", col.ID, p.Name)
			}
		}
	}
}

func TestParse_Errors(t *testing.T) {
	for _, tc := range []struct{ name, data string }{
		{"не JSON", `{"updated_at":`},
		{"неизвестное поле", `{"updated_at":"2026-10-06","collections":[],"extra":1}`},
		{"нет даты", `{"collections":[]}`},
	} {
		if _, err := catalog.Parse([]byte(tc.data)); err == nil {
			t.Errorf("%s: Parse returned nil error", tc.name)
		}
	}
}
