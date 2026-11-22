// Package collections — каталог тематических подборок товаров ВкусВилла: модель, правила, поиск.
package collections

import (
	"context"
	"errors"
)

// Product — товар ВкусВилла в подборке. Цена — за Unit на дату каталога.
type Product struct {
	XMLID    int64   `json:"xml_id"`
	Name     string  `json:"name"`
	Quantity float64 `json:"quantity"`
	Unit     string  `json:"unit"`
	Price    float64 `json:"price"`
	Rating   float64 `json:"rating"`
	URL      string  `json:"url"`
	Image    string  `json:"image"`
	// Scalable: nil или true — масштабируется по порциям (R7).
	Scalable *bool `json:"scalable,omitempty"`
}

// IsScalable сообщает, умножается ли количество товара на число порций.
func (p Product) IsScalable() bool {
	return p.Scalable == nil || *p.Scalable
}

// Collection — подборка из каталога. TotalPrice вычисляет MemoryStore.
type Collection struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Tags        []string `json:"tags"`
	CartURL     string   `json:"cart_url"`
	// CartURLs — ссылки на корзину для ×2 и ×4 (ключи "2", "4"); ×1 — CartURL (R7).
	CartURLs   map[string]string `json:"cart_urls,omitempty"`
	TotalPrice int               `json:"total_price"`
	Products   []Product         `json:"products"`
}

// ErrNotFound — подборки с таким id нет (R4).
var ErrNotFound = errors.New("collection not found")

// Store отдаёт подборки каталога. Сейчас MemoryStore, следующий шаг — Postgres.
type Store interface {
	List(ctx context.Context) ([]Collection, error)
	Get(ctx context.Context, id string) (Collection, error)
}
