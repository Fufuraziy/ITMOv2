package collections_test

import (
	"context"
	"errors"
	"strings"
	"testing"

	"vv/collections/internal/collections"
)

// TestNewMemoryStore_ScalableLimitMessage проверяет полный текст проблемы R1 для
// масштабируемого товара с базой больше 10 (R3: ×4 не больше лимита корзины 40).
func TestNewMemoryStore_ScalableLimitMessage(t *testing.T) {
	c := breakfast()
	c.Products[0].Quantity = 15 // масштабируемый по умолчанию

	_, err := collections.NewMemoryStore([]collections.Collection{c, soup()})

	var verr *collections.ValidationError
	if !errors.As(err, &verr) {
		t.Fatalf("NewMemoryStore error = %v, want *ValidationError", err)
	}
	want := []string{"zavtrak-s-syrnikami: products[0].quantity: scalable must be 0.01-10, got 15"}
	if len(verr.Problems) != len(want) || verr.Problems[0] != want[0] {
		t.Errorf("problems = %q, want %q", verr.Problems, want)
	}
}

// TestNewMemoryStore_Rules проверяет правила каталога R3 (docs/requirements.md).
func TestNewMemoryStore_Rules(t *testing.T) {
	tests := []struct {
		name   string
		modify func(c *collections.Collection)
		want   []string // "<id>: <поле>" в порядке проверки; nil — каталог корректен
	}{
		{"корректная подборка", func(*collections.Collection) {}, nil},
		{"название 80 символов", func(c *collections.Collection) { c.Title = strings.Repeat("я", 80) }, nil},
		{"дробное количество 0.01", func(c *collections.Collection) { c.Products[0].Quantity = 0.01 }, nil},

		{"id с заглавными", func(c *collections.Collection) { c.ID = "Zavtrak" }, []string{"Zavtrak: id"}},
		{"id с двойным дефисом", func(c *collections.Collection) { c.ID = "a--b" }, []string{"a--b: id"}},
		{"название из 2 символов", func(c *collections.Collection) { c.Title = "Ой" }, []string{"zavtrak-s-syrnikami: title"}},
		{"пустое описание", func(c *collections.Collection) { c.Description = "" }, []string{"zavtrak-s-syrnikami: description"}},
		{"описание 501 символ", func(c *collections.Collection) { c.Description = strings.Repeat("д", 501) }, []string{"zavtrak-s-syrnikami: description"}},
		{"нет тегов", func(c *collections.Collection) { c.Tags = nil }, []string{"zavtrak-s-syrnikami: tags"}},
		{"7 тегов", func(c *collections.Collection) {
			c.Tags = []string{"аа", "бб", "вв", "гг", "дд", "ее", "жж"}
		}, []string{"zavtrak-s-syrnikami: tags"}},
		{"тег из 1 символа", func(c *collections.Collection) { c.Tags[1] = "я" }, []string{"zavtrak-s-syrnikami: tags[1]"}},
		{"повтор тега", func(c *collections.Collection) { c.Tags[2] = "Завтрак" }, []string{"zavtrak-s-syrnikami: tags[2]"}},
		{"чужая ссылка на корзину", func(c *collections.Collection) { c.CartURL = "https://example.com/?share_basket=1" }, []string{"zavtrak-s-syrnikami: cart_url"}},
		{"ссылка на корзину нового формата ВкусВилла", func(c *collections.Collection) { c.CartURL = "https://vkusvill.ru/mobile?basket&share=64435" }, nil},
		{"ссылка на корзину старого формата share_basket", func(c *collections.Collection) { c.CartURL = "https://vkusvill.ru/?share_basket=1" }, []string{"zavtrak-s-syrnikami: cart_url"}},
		{"нет товаров", func(c *collections.Collection) { c.Products = nil }, []string{"zavtrak-s-syrnikami: products"}},
		{"xml_id не положительный", func(c *collections.Collection) { c.Products[0].XMLID = 0 }, []string{"zavtrak-s-syrnikami: products[0].xml_id"}},
		{"повтор xml_id", func(c *collections.Collection) { c.Products[1].XMLID = c.Products[0].XMLID }, []string{"zavtrak-s-syrnikami: products[1].xml_id"}},
		{"пустое имя товара", func(c *collections.Collection) { c.Products[1].Name = "" }, []string{"zavtrak-s-syrnikami: products[1].name"}},
		{"количество 0", func(c *collections.Collection) { c.Products[0].Quantity = 0 }, []string{"zavtrak-s-syrnikami: products[0].quantity"}},
		{"количество 41", func(c *collections.Collection) { c.Products[0].Quantity = 41 }, []string{"zavtrak-s-syrnikami: products[0].quantity"}},
		{"цена 0", func(c *collections.Collection) { c.Products[1].Price = 0 }, []string{"zavtrak-s-syrnikami: products[1].price"}},

		// R7: порции.
		{"масштабируемый 10", func(c *collections.Collection) { c.Products[0].Quantity = 10 }, nil},
		{"масштабируемый 10.01", func(c *collections.Collection) { c.Products[0].Quantity = 10.01 }, []string{"zavtrak-s-syrnikami: products[0].quantity"}},
		{"немасштабируемый 15", func(c *collections.Collection) {
			c.Products[0].Quantity = 15
			c.Products[0].Scalable = ptr(false)
		}, nil},
		{"немасштабируемый 41", func(c *collections.Collection) {
			c.Products[0].Quantity = 41
			c.Products[0].Scalable = ptr(false)
		}, []string{"zavtrak-s-syrnikami: products[0].quantity"}},
		{"cart_urls с ключом 3", func(c *collections.Collection) {
			c.CartURLs = map[string]string{"2": cartURL(2), "3": cartURL(3), "4": cartURL(4)}
		}, []string{"zavtrak-s-syrnikami: cart_urls[3]"}},
		{"нет cart_urls[2]", func(c *collections.Collection) { delete(c.CartURLs, "2") }, []string{"zavtrak-s-syrnikami: cart_urls[2]"}},
		{"нет cart_urls", func(c *collections.Collection) { c.CartURLs = nil }, []string{
			"zavtrak-s-syrnikami: cart_urls[2]", "zavtrak-s-syrnikami: cart_urls[4]",
		}},
		{"cart_urls[4] с чужим префиксом", func(c *collections.Collection) {
			c.CartURLs = map[string]string{"2": cartURL(2), "4": "https://example.com/?share_basket=4"}
		}, []string{"zavtrak-s-syrnikami: cart_urls[4]"}},
		{"ссылка не на товар ВкусВилла", func(c *collections.Collection) { c.Products[0].URL = "https://vkusvill.ru/" }, []string{"zavtrak-s-syrnikami: products[0].url"}},
		{"несколько нарушений сразу", func(c *collections.Collection) {
			c.Title = ""
			c.Products[1].Price = -1
		}, []string{"zavtrak-s-syrnikami: title", "zavtrak-s-syrnikami: products[1].price"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := breakfast()
			tt.modify(&c)

			_, err := collections.NewMemoryStore([]collections.Collection{c, soup()})

			if tt.want == nil {
				if err != nil {
					t.Fatalf("NewMemoryStore error = %v, want success", err)
				}
				return
			}
			var verr *collections.ValidationError
			if !errors.As(err, &verr) {
				t.Fatalf("NewMemoryStore error = %v, want *ValidationError", err)
			}
			if len(verr.Problems) != len(tt.want) {
				t.Fatalf("problems = %q, want %q", verr.Problems, tt.want)
			}
			for i, prefix := range tt.want {
				if !strings.HasPrefix(verr.Problems[i], prefix+": ") {
					t.Errorf("problem[%d] = %q, want prefix %q", i, verr.Problems[i], prefix+": ")
				}
			}
		})
	}
}

func TestNewMemoryStore_DuplicateID(t *testing.T) {
	second := soup()
	second.ID = breakfast().ID

	_, err := collections.NewMemoryStore([]collections.Collection{breakfast(), second})

	var verr *collections.ValidationError
	if !errors.As(err, &verr) || len(verr.Problems) != 1 ||
		!strings.HasPrefix(verr.Problems[0], "zavtrak-s-syrnikami: id: ") {
		t.Fatalf("error = %v, want one duplicate id problem", err)
	}
}

func TestMemoryStore_TotalPriceAndCopies(t *testing.T) {
	ctx := context.Background()
	store, err := collections.NewMemoryStore([]collections.Collection{breakfast(), soup()})
	if err != nil {
		t.Fatalf("NewMemoryStore: %v", err)
	}

	list, err := store.List(ctx)
	if err != nil || len(list) != 2 {
		t.Fatalf("List = %d items, %v; want 2", len(list), err)
	}
	// 306×1 + 98×1 = 404; 136×2 + 54×0.5 + 99×1 = 398
	if list[0].TotalPrice != 404 || list[1].TotalPrice != 398 {
		t.Errorf("total prices = %d, %d; want 404, 398", list[0].TotalPrice, list[1].TotalPrice)
	}

	list[0].Products[0].Name = "испорчено"
	list[0].Tags[0] = "испорчено"
	got, err := store.Get(ctx, "zavtrak-s-syrnikami")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.Products[0].Name != "Сырники классические жареные" || got.Tags[0] != "завтрак" {
		t.Errorf("stored collection changed after caller mutation: %+v", got)
	}

	if _, err := store.Get(ctx, "net-takoy"); !errors.Is(err, collections.ErrNotFound) {
		t.Errorf("Get(unknown) error = %v, want ErrNotFound", err)
	}
}
