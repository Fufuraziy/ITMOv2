// Package catalog встраивает каталог подборок collections.json,
// который собирает node mcp/vv-collections/curate.mjs из catalog/themes.json.
package catalog

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"

	"vv/collections/internal/collections"
)

//go:embed collections.json
var data []byte

// Catalog — снимок каталога: подборки и дата цен.
type Catalog struct {
	UpdatedAt   string                   `json:"updated_at"`
	Collections []collections.Collection `json:"collections"`
}

// Load разбирает встроенный каталог.
func Load() (Catalog, error) {
	return Parse(data)
}

// Parse разбирает каталог из JSON. Неизвестные поля — ошибка: опечатка куратора не должна потеряться молча.
func Parse(b []byte) (Catalog, error) {
	dec := json.NewDecoder(bytes.NewReader(b))
	dec.DisallowUnknownFields()
	var c Catalog
	if err := dec.Decode(&c); err != nil {
		return Catalog{}, fmt.Errorf("parse catalog: %w", err)
	}
	if c.UpdatedAt == "" {
		return Catalog{}, errors.New("parse catalog: updated_at is required")
	}
	return c, nil
}
