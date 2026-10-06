package collections

import (
	"context"
	"math"
	"slices"
)

// MemoryStore — каталог в памяти, только для чтения.
type MemoryStore struct {
	data []Collection
}

// NewMemoryStore проверяет каталог по R1/R3 и считает total_price.
// При нарушениях возвращает *ValidationError со всеми проблемами.
func NewMemoryStore(list []Collection) (*MemoryStore, error) {
	var problems []string
	ids := make(map[string]bool, len(list))
	data := make([]Collection, len(list))
	for i, c := range list {
		problems = append(problems, validate(c)...)
		if ids[c.ID] {
			problems = append(problems, c.ID+": id: duplicates another collection")
		}
		ids[c.ID] = true
		c = clone(c)
		c.TotalPrice = totalPrice(c.Products)
		data[i] = c
	}
	if len(problems) > 0 {
		return nil, &ValidationError{Problems: problems}
	}
	return &MemoryStore{data: data}, nil
}

func totalPrice(products []Product) int {
	var sum float64
	for _, p := range products {
		sum += p.Price * p.Quantity
	}
	return int(math.Round(sum))
}

// List возвращает копии подборок в порядке каталога.
func (m *MemoryStore) List(_ context.Context) ([]Collection, error) {
	out := make([]Collection, len(m.data))
	for i, c := range m.data {
		out[i] = clone(c)
	}
	return out, nil
}

// Get возвращает копию подборки или ErrNotFound.
func (m *MemoryStore) Get(_ context.Context, id string) (Collection, error) {
	for _, c := range m.data {
		if c.ID == id {
			return clone(c), nil
		}
	}
	return Collection{}, ErrNotFound
}

func clone(c Collection) Collection {
	c.Tags = slices.Clone(c.Tags)
	c.Products = slices.Clone(c.Products)
	return c
}
