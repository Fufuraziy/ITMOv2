package collections

import (
	"fmt"
	"math"
	"slices"
	"strconv"
)

// Servings — множитель порций (R7): 1, 2 или 4.
type Servings int

// Значения Servings.
const (
	Servings1 Servings = 1
	Servings2 Servings = 2
	Servings4 Servings = 4
)

// AllServings — все множители по возрастанию; в этом порядке идут варианты подборки.
var AllServings = []Servings{Servings1, Servings2, Servings4}

// ParseServings разбирает параметр servings: ровно "1", "2" или "4"; пустая строка — 1.
func ParseServings(s string) (Servings, error) {
	switch s {
	case "", "1":
		return Servings1, nil
	case "2":
		return Servings2, nil
	case "4":
		return Servings4, nil
	}
	return 0, fmt.Errorf("servings must be one of 1, 2, 4, got %q", s)
}

// orDefault: нулевое значение (Query без servings) означает 1.
func (s Servings) orDefault() Servings {
	if s == 0 {
		return Servings1
	}
	return s
}

// ScaledProduct — товар в ответе API с количеством для применённого множителя (R7).
type ScaledProduct struct {
	XMLID        int64   `json:"xml_id"`
	Name         string  `json:"name"`
	Quantity     float64 `json:"quantity"`
	BaseQuantity float64 `json:"base_quantity"`
	Scalable     bool    `json:"scalable"`
	Unit         string  `json:"unit"`
	Price        float64 `json:"price"`
	Rating       float64 `json:"rating"`
	URL          string  `json:"url"`
	Image        string  `json:"image"`
}

// Variant — подборка, пересчитанная на один множитель (R7).
type Variant struct {
	Multiplier Servings           `json:"multiplier"`
	TotalPrice int                `json:"total_price"`
	Quantities map[string]float64 `json:"quantities"`
	CartURL    string             `json:"cart_url"`
	Available  bool               `json:"available"`
	Reason     string             `json:"reason,omitempty"`
}

// ScaledCollection — подборка в ответе API (R2, R4, R7).
type ScaledCollection struct {
	ID          string          `json:"id"`
	Title       string          `json:"title"`
	Description string          `json:"description"`
	Tags        []string        `json:"tags"`
	Servings    Servings        `json:"servings"`
	CartURL     string          `json:"cart_url"`
	TotalPrice  int             `json:"total_price"`
	Products    []ScaledProduct `json:"products"`
	Variants    []Variant       `json:"variants"`
}

// scaleQuantity — количество товара для множителя k: масштабируемый умножается
// и округляется до 0.01, немасштабируемый остаётся как в каталоге.
func scaleQuantity(p Product, k Servings) float64 {
	if !p.IsScalable() {
		return p.Quantity
	}
	return math.Round(p.Quantity*float64(k)*100) / 100
}

// scaleProducts — товары с количествами для множителя k.
func scaleProducts(ps []Product, k Servings) []Product {
	out := make([]Product, len(ps))
	for i, p := range ps {
		p.Quantity = scaleQuantity(p, k)
		out[i] = p
	}
	return out
}

// priceFor — total_price подборки для множителя k: одно округление от суммы (R2, R7).
func priceFor(c Collection, k Servings) int {
	return totalPrice(scaleProducts(c.Products, k.orDefault()))
}

// cartURL — готовая ссылка куратора для множителя k: ×1 — CartURL, ×2 и ×4 — CartURLs (FR-012).
func cartURL(c Collection, k Servings) string {
	if k == Servings1 {
		return c.CartURL
	}
	return c.CartURLs[strconv.Itoa(int(k))]
}

// Scale пересчитывает подборку на множитель s (0 — как 1) и добавляет варианты для 1, 2, 4.
func Scale(c Collection, s Servings) ScaledCollection {
	s = s.orDefault()
	out := ScaledCollection{
		ID:          c.ID,
		Title:       c.Title,
		Description: c.Description,
		Tags:        slices.Clone(c.Tags),
		Servings:    s,
		CartURL:     cartURL(c, s),
		TotalPrice:  priceFor(c, s),
		Products:    make([]ScaledProduct, len(c.Products)),
		Variants:    make([]Variant, 0, len(AllServings)),
	}
	for i, p := range c.Products {
		out.Products[i] = ScaledProduct{
			XMLID: p.XMLID, Name: p.Name,
			Quantity: scaleQuantity(p, s), BaseQuantity: p.Quantity, Scalable: p.IsScalable(),
			Unit: p.Unit, Price: p.Price, Rating: p.Rating, URL: p.URL, Image: p.Image,
		}
	}
	for _, k := range AllServings {
		q := make(map[string]float64, len(c.Products))
		for _, p := range c.Products {
			q[strconv.FormatInt(p.XMLID, 10)] = scaleQuantity(p, k)
		}
		out.Variants = append(out.Variants, Variant{
			Multiplier: k,
			TotalPrice: priceFor(c, k),
			Quantities: q,
			CartURL:    cartURL(c, k),
			Available:  true,
		})
	}
	return out
}
