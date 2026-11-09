package collections_test

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"
	"strings"
	"testing"

	"vv/collections/internal/collections"
)

// TestParseServings проверяет R7: допустимы ровно 1, 2, 4; пусто — 1.
func TestParseServings(t *testing.T) {
	tests := []struct {
		in      string
		want    collections.Servings
		wantErr bool
	}{
		{"", 1, false},
		{"1", 1, false},
		{"2", 2, false},
		{"4", 4, false},
		{"0", 0, true},
		{"3", 0, true},
		{"-2", 0, true},
		{"2.0", 0, true},
		{"02", 0, true},
		{" 2", 0, true},
		{"4 ", 0, true},
		{"+2", 0, true},
		{"x2", 0, true},
	}
	for _, tt := range tests {
		got, err := collections.ParseServings(tt.in)
		if (err != nil) != tt.wantErr || got != tt.want {
			t.Errorf("ParseServings(%q) = %d, %v; want %d, error=%v", tt.in, got, err, tt.want, tt.wantErr)
		}
	}
	_, err := collections.ParseServings("3")
	if want := `servings must be one of 1, 2, 4, got "3"`; err == nil || err.Error() != want {
		t.Errorf("ParseServings(\"3\") error = %v, want %q", err, want)
	}
}

// pumpkin — подборка для проверки пересчёта: кофе не масштабируется, морковь 0.3 кг.
func pumpkin() collections.Collection {
	return collections.Collection{
		ID:          "tykvennyi-sup",
		Title:       "Тыквенный суп",
		Description: "Тыква, лук, сливки, морковь и кофе после обеда",
		Tags:        []string{"суп"},
		CartURL:     cartURL(10),
		CartURLs:    map[string]string{"2": cartURL(20), "4": cartURL(40)},
		Products: []collections.Product{
			{XMLID: 17081, Name: "Тыква", Quantity: 2, Unit: "шт", Price: 136, URL: "https://vkusvill.ru/goods/t-17081/"},
			{XMLID: 3001, Name: "Лук", Quantity: 0.5, Unit: "кг", Price: 54, URL: "https://vkusvill.ru/goods/l-3001/"},
			{XMLID: 3003, Name: "Сливки", Quantity: 1, Unit: "шт", Price: 120, URL: "https://vkusvill.ru/goods/s-3003/"},
			{XMLID: 16124, Name: "Кофе", Quantity: 1, Unit: "шт", Price: 490, URL: "https://vkusvill.ru/goods/k-16124/", Scalable: ptr(false)},
			{XMLID: 3004, Name: "Морковь", Quantity: 0.3, Unit: "кг", Price: 50, URL: "https://vkusvill.ru/goods/m-3004/"},
		},
	}
}

// stored возвращает подборку так, как её отдаёт хранилище (с total_price).
func stored(t *testing.T, c collections.Collection) collections.Collection {
	t.Helper()
	store, err := collections.NewMemoryStore([]collections.Collection{c})
	if err != nil {
		t.Fatalf("NewMemoryStore: %v", err)
	}
	got, err := store.Get(context.Background(), c.ID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	return got
}

// TestScale проверяет R7: количества, цены и варианты для множителей 1, 2, 4.
func TestScale(t *testing.T) {
	c := stored(t, pumpkin())
	ids := []string{"17081", "3001", "3003", "16124", "3004"}
	base := []float64{2, 0.5, 1, 1, 0.3}
	scalable := []bool{true, true, true, false, true}
	want := map[collections.Servings]struct {
		qty   []float64
		total int
	}{
		1: {[]float64{2, 0.5, 1, 1, 0.3}, 924}, // 272 + 27 + 120 + 490 + 15
		2: {[]float64{4, 1, 2, 1, 0.6}, 1358},  // 544 + 54 + 240 + 490 + 30
		4: {[]float64{8, 2, 4, 1, 1.2}, 2226},  // 1088 + 108 + 480 + 490 + 60
	}
	for _, s := range collections.AllServings {
		t.Run(fmt.Sprintf("×%d", s), func(t *testing.T) {
			got := collections.Scale(c, s)
			w := want[s]
			if got.Servings != s || got.TotalPrice != w.total {
				t.Errorf("servings = %d, total_price = %d; want %d, %d", got.Servings, got.TotalPrice, s, w.total)
			}
			if got.ID != c.ID || got.Title != c.Title || !reflect.DeepEqual(got.Tags, c.Tags) {
				t.Errorf("id/title/tags = %q/%q/%v, want как в каталоге", got.ID, got.Title, got.Tags)
			}
			if len(got.Products) != len(ids) {
				t.Fatalf("products = %d, want %d", len(got.Products), len(ids))
			}
			for i, p := range got.Products {
				if p.Quantity != w.qty[i] || p.BaseQuantity != base[i] || p.Scalable != scalable[i] {
					t.Errorf("products[%d] %s: quantity %v, base %v, scalable %v; want %v, %v, %v",
						i, p.Name, p.Quantity, p.BaseQuantity, p.Scalable, w.qty[i], base[i], scalable[i])
				}
				if p.Price != c.Products[i].Price || p.XMLID != c.Products[i].XMLID || p.URL != c.Products[i].URL {
					t.Errorf("products[%d]: price/xml_id/url изменились: %+v", i, p)
				}
			}
			if len(got.Variants) != 3 {
				t.Fatalf("variants = %d, want 3", len(got.Variants))
			}
			for i, v := range got.Variants {
				m := collections.AllServings[i]
				if v.Multiplier != m || v.TotalPrice != want[m].total || !v.Available || v.Reason != "" {
					t.Errorf("variants[%d] = %+v; want multiplier %d, total %d, available, без reason", i, v, m, want[m].total)
				}
				wantQ := map[string]float64{}
				for j, id := range ids {
					wantQ[id] = want[m].qty[j]
				}
				if !reflect.DeepEqual(v.Quantities, wantQ) {
					t.Errorf("variants[%d].quantities = %v, want %v", i, v.Quantities, wantQ)
				}
				if m == s && v.TotalPrice != got.TotalPrice {
					t.Errorf("вариант ×%d: total_price %d != подборки %d", m, v.TotalPrice, got.TotalPrice)
				}
			}
		})
	}

	if got := collections.Scale(c, 1); got.TotalPrice != c.TotalPrice {
		t.Errorf("×1 total_price = %d, want как в хранилище %d", got.TotalPrice, c.TotalPrice)
	}

	b, err := json.Marshal(collections.Scale(c, 4))
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}
	for _, frag := range []string{`"quantity":1.2,`, `"quantity":8,`, `"base_quantity":0.3,`, `"scalable":false`, `"servings":4`} {
		if !strings.Contains(string(b), frag) {
			t.Errorf("JSON ×4 не содержит %s: %s", frag, b)
		}
	}
}

// TestScale_RoundsOnce проверяет FR-008: total_price округляется один раз, от суммы.
func TestScale_RoundsOnce(t *testing.T) {
	c := pumpkin()
	c.Products = []collections.Product{
		{XMLID: 1, Name: "Сыр", Quantity: 2, Unit: "шт", Price: 50.2, URL: "https://vkusvill.ru/goods/s-1/"},
	}
	c = stored(t, c)
	if got := collections.Scale(c, 1).TotalPrice; got != 100 {
		t.Errorf("×1 total_price = %d, want 100 (100.4)", got)
	}
	if got := collections.Scale(c, 2).TotalPrice; got != 201 {
		t.Errorf("×2 total_price = %d, want 201 (200.8, а не 2×100)", got)
	}
}

// TestScale_CartURL проверяет FR-012: ссылка на корзину — готовая ссылка куратора для своего множителя.
func TestScale_CartURL(t *testing.T) {
	c := stored(t, pumpkin())
	want := map[collections.Servings]string{1: c.CartURL, 2: c.CartURLs["2"], 4: c.CartURLs["4"]}
	for _, s := range collections.AllServings {
		got := collections.Scale(c, s)
		if got.CartURL != want[s] {
			t.Errorf("×%d: cart_url = %q, want %q", s, got.CartURL, want[s])
		}
		for _, v := range got.Variants {
			if v.CartURL != want[v.Multiplier] {
				t.Errorf("×%d: variants[×%d].cart_url = %q, want %q", s, v.Multiplier, v.CartURL, want[v.Multiplier])
			}
			if v.Multiplier == s && v.CartURL != got.CartURL {
				t.Errorf("×%d: cart_url варианта %q != подборки %q", s, v.CartURL, got.CartURL)
			}
		}
	}
}
