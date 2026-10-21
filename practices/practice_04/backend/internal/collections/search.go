package collections

import (
	"cmp"
	"context"
	"fmt"
	"slices"
	"strings"
)

// Sort — порядок выдачи поиска (R2).
type Sort string

// Значения Sort.
const (
	SortCatalog   Sort = "catalog"
	SortPriceAsc  Sort = "price_asc"
	SortPriceDesc Sort = "price_desc"
)

// ParseSort разбирает параметр sort; пустая строка — порядок каталога.
func ParseSort(s string) (Sort, error) {
	switch Sort(s) {
	case "", SortCatalog:
		return SortCatalog, nil
	case SortPriceAsc, SortPriceDesc:
		return Sort(s), nil
	}
	return "", fmt.Errorf("sort must be one of %s, %s, %s", SortCatalog, SortPriceAsc, SortPriceDesc)
}

// Query — параметры поиска (R2). Нулевые поля не фильтруют.
type Query struct {
	Text     string
	Tag      string
	MaxPrice int
	Sort     Sort
}

// TagCount — тег и число подборок с ним (R5).
type TagCount struct {
	Tag   string `json:"tag"`
	Count int    `json:"count"`
}

// fold приводит текст к виду для сравнения: нижний регистр, ё → е.
func fold(s string) string {
	return strings.ReplaceAll(strings.ToLower(s), "ё", "е")
}

// haystack — весь текст подборки, по которому ищет q.
func haystack(c Collection) string {
	parts := []string{c.Title, c.Description}
	parts = append(parts, c.Tags...)
	for _, p := range c.Products {
		parts = append(parts, p.Name)
	}
	return fold(strings.Join(parts, "\n"))
}

func matches(c Collection, words []string, tag string, maxPrice int) bool {
	if maxPrice > 0 && c.TotalPrice > maxPrice {
		return false
	}
	if tag != "" && !slices.ContainsFunc(c.Tags, func(t string) bool { return fold(t) == tag }) {
		return false
	}
	text := haystack(c)
	for _, w := range words {
		if !strings.Contains(text, w) {
			return false
		}
	}
	return true
}

// Search ищет подборки по R2. Ничего не нашлось — пустой срез, не nil.
func (s *Service) Search(ctx context.Context, q Query) ([]Collection, error) {
	list, err := s.store.List(ctx)
	if err != nil {
		return nil, fmt.Errorf("search collections: %w", err)
	}
	words := strings.Fields(fold(q.Text))
	tag := fold(strings.TrimSpace(q.Tag))
	out := []Collection{}
	for _, c := range list {
		if matches(c, words, tag, q.MaxPrice) {
			out = append(out, c)
		}
	}
	switch q.Sort {
	case SortPriceAsc:
		slices.SortStableFunc(out, func(a, b Collection) int { return cmp.Compare(a.TotalPrice, b.TotalPrice) })
	case SortPriceDesc:
		slices.SortStableFunc(out, func(a, b Collection) int { return cmp.Compare(b.TotalPrice, a.TotalPrice) })
	}
	return out, nil
}

// Tags возвращает теги каталога по R5: по убыванию числа подборок, при равенстве по алфавиту.
func (s *Service) Tags(ctx context.Context) ([]TagCount, error) {
	list, err := s.store.List(ctx)
	if err != nil {
		return nil, fmt.Errorf("list tags: %w", err)
	}
	counts := map[string]int{}
	for _, c := range list {
		for _, t := range c.Tags {
			counts[t]++
		}
	}
	out := make([]TagCount, 0, len(counts))
	for t, n := range counts {
		out = append(out, TagCount{Tag: t, Count: n})
	}
	slices.SortFunc(out, func(a, b TagCount) int {
		return cmp.Or(cmp.Compare(b.Count, a.Count), cmp.Compare(fold(a.Tag), fold(b.Tag)))
	})
	return out, nil
}
