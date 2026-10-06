package collections

import (
	"fmt"
	"regexp"
	"strings"
	"unicode/utf8"
)

// Ограничения из R3 (docs/requirements.md).
const (
	titleMin, titleMax             = 3, 80
	descriptionMin, descriptionMax = 1, 500
	tagsMin, tagsMax               = 1, 6
	tagMin, tagMax                 = 2, 24
	productsMin, productsMax       = 1, 20 // лимит корзины ВкусВилла
	productNameMax                 = 120
	cartURLPrefix                  = "https://vkusvill.ru/?share_basket="
	productURLPrefix               = "https://vkusvill.ru/goods/"
)

// Лимиты количества в корзине ВкусВилла; float64, чтобы печатались через %g.
const (
	quantityMin float64 = 0.01
	quantityMax float64 = 40
)

var idPattern = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)

// ValidationError перечисляет все нарушения правил каталога (R3) в виде "<id>: <поле>: <проблема>".
type ValidationError struct {
	Problems []string
}

func (e *ValidationError) Error() string {
	return "invalid catalog: " + strings.Join(e.Problems, "; ")
}

// validate возвращает нарушения R3 для одной подборки.
func validate(c Collection) []string {
	var problems []string
	add := func(field, format string, args ...any) {
		problems = append(problems, c.ID+": "+field+": "+fmt.Sprintf(format, args...))
	}
	runes := utf8.RuneCountInString

	if !idPattern.MatchString(c.ID) {
		add("id", "must match %s", idPattern)
	}
	if n := runes(c.Title); n < titleMin || n > titleMax {
		add("title", "must be %d-%d characters, got %d", titleMin, titleMax, n)
	}
	if n := runes(c.Description); n < descriptionMin || n > descriptionMax {
		add("description", "must be %d-%d characters, got %d", descriptionMin, descriptionMax, n)
	}
	if n := len(c.Tags); n < tagsMin || n > tagsMax {
		add("tags", "must contain %d-%d tags, got %d", tagsMin, tagsMax, n)
	}
	seenTags := make(map[string]bool, len(c.Tags))
	for i, tag := range c.Tags {
		field := fmt.Sprintf("tags[%d]", i)
		switch n := runes(tag); {
		case n < tagMin || n > tagMax:
			add(field, "must be %d-%d characters, got %d", tagMin, tagMax, n)
		case seenTags[strings.ToLower(tag)]:
			add(field, "duplicates tag %q", tag)
		}
		seenTags[strings.ToLower(tag)] = true
	}
	if !strings.HasPrefix(c.CartURL, cartURLPrefix) {
		add("cart_url", "must start with %s", cartURLPrefix)
	}
	if n := len(c.Products); n < productsMin || n > productsMax {
		add("products", "must contain %d-%d items, got %d", productsMin, productsMax, n)
	}

	seen := make(map[int64]int, len(c.Products))
	for i, p := range c.Products {
		field := fmt.Sprintf("products[%d]", i)
		switch first, dup := seen[p.XMLID]; {
		case p.XMLID <= 0:
			add(field+".xml_id", "must be a positive vkusvill xml_id, got %d", p.XMLID)
		case dup:
			add(field+".xml_id", "duplicates products[%d]", first)
		default:
			seen[p.XMLID] = i
		}
		if n := runes(p.Name); n < 1 || n > productNameMax {
			add(field+".name", "must be 1-%d characters, got %d", productNameMax, n)
		}
		if p.Quantity < quantityMin || p.Quantity > quantityMax {
			add(field+".quantity", "must be %g-%g, got %g", quantityMin, quantityMax, p.Quantity)
		}
		if p.Price <= 0 {
			add(field+".price", "must be positive, got %g", p.Price)
		}
		if !strings.HasPrefix(p.URL, productURLPrefix) {
			add(field+".url", "must start with %s", productURLPrefix)
		}
	}
	return problems
}
