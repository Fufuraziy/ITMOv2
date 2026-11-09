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
		// R7: у каждой подборки готовые корзины ×2 и ×4, все ссылки каталога разные.
		for _, k := range []string{"2", "4"} {
			url, ok := col.CartURLs[k]
			if !ok {
				t.Errorf("%s: no cart_urls[%s]", col.ID, k)
				continue
			}
			if other, dup := carts[url]; dup {
				t.Errorf("%s and %s share cart link %s", other, col.ID, url)
			}
			carts[url] = col.ID
		}
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

// TestParse_ServingsFields проверяет R7: каталог со ссылками ×2/×4 и пометкой «не масштабируется» разбирается.
func TestParse_ServingsFields(t *testing.T) {
	data := `{"updated_at":"2026-10-21","collections":[{
		"id":"zavtrak","title":"Завтрак","description":"Сырники и кофе","tags":["завтрак"],
		"cart_url":"https://vkusvill.ru/mobile?basket&share=11",
		"cart_urls":{"2":"https://vkusvill.ru/mobile?basket&share=12","4":"https://vkusvill.ru/mobile?basket&share=14"},
		"products":[
			{"xml_id":1,"name":"Сырники","quantity":1,"unit":"шт","price":306,"url":"https://vkusvill.ru/goods/a-1/"},
			{"xml_id":2,"name":"Кофе","quantity":1,"unit":"шт","price":490,"url":"https://vkusvill.ru/goods/b-2/","scalable":false}
		]}]}`
	c, err := catalog.Parse([]byte(data))
	if err != nil {
		t.Fatalf("Parse: %v, want success", err)
	}
	col := c.Collections[0]
	if got := col.CartURLs["4"]; got != "https://vkusvill.ru/mobile?basket&share=14" {
		t.Errorf("cart_urls[4] = %q", got)
	}
	if p := col.Products[0]; p.Scalable != nil || !p.IsScalable() {
		t.Errorf("products[0] без scalable: Scalable = %v, IsScalable = %v; want nil, true", p.Scalable, p.IsScalable())
	}
	if p := col.Products[1]; p.Scalable == nil || *p.Scalable || p.IsScalable() {
		t.Errorf("products[1] со scalable:false: IsScalable = %v, want false", p.IsScalable())
	}
}
