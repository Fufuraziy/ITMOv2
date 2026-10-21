package collections_test

import (
	"context"
	"errors"
	"reflect"
	"testing"

	"vv/collections/internal/collections"
)

func pasta() collections.Collection {
	return collections.Collection{
		ID:          "pasta-karbonara",
		Title:       "Паста карбонара",
		Description: "Спагетти, бекон и пармезан",
		Tags:        []string{"ужин", "быстро"},
		CartURL:     "https://vkusvill.ru/?share_basket=679119562",
		Products: []collections.Product{
			{XMLID: 4001, Name: "Спагетти", Quantity: 2, Unit: "шт", Price: 300,
				URL: "https://vkusvill.ru/goods/spagetti-4001/"},
		},
	}
}

// newCatalogService: завтрак 404 ₽, суп 398 ₽, паста 600 ₽ — в этом порядке.
func newCatalogService(t *testing.T) *collections.Service {
	t.Helper()
	store, err := collections.NewMemoryStore([]collections.Collection{breakfast(), soup(), pasta()})
	if err != nil {
		t.Fatalf("NewMemoryStore: %v", err)
	}
	return collections.NewService(store)
}

func ids(list []collections.Collection) []string {
	out := []string{}
	for _, c := range list {
		out = append(out, c.ID)
	}
	return out
}

// TestService_Search проверяет R2 из docs/requirements.md.
func TestService_Search(t *testing.T) {
	const (
		b = "zavtrak-s-syrnikami"
		s = "tykvennyi-krem-sup"
		p = "pasta-karbonara"
	)
	tests := []struct {
		name  string
		query collections.Query
		want  []string
	}{
		{"без параметров — весь каталог по порядку", collections.Query{}, []string{b, s, p}},
		{"слово из названия", collections.Query{Text: "сырники"}, []string{b}},
		{"регистр и часть слова", collections.Query{Text: "СЫРНИК"}, []string{b}},
		{"ё равно е в названии товара", collections.Query{Text: "ежики"}, []string{s}},
		{"е в запросе находит ё", collections.Query{Text: "Ёжики"}, []string{s}},
		{"слова через И: название и товар", collections.Query{Text: "суп тыква"}, []string{s}},
		{"слова через И: ничего общего", collections.Query{Text: "суп сырники"}, []string{}},
		{"слово из тега и лишние пробелы", collections.Query{Text: "  быстро  "}, []string{b, p}},
		{"слово из описания", collections.Query{Text: "бекон"}, []string{p}},
		{"тег без учёта регистра", collections.Query{Tag: "Быстро"}, []string{b, p}},
		{"неизвестный тег", collections.Query{Tag: "пикник"}, []string{}},
		{"бюджет 400", collections.Query{MaxPrice: 400}, []string{s}},
		{"бюджет ровно 404", collections.Query{MaxPrice: 404}, []string{b, s}},
		{"дешевле — выше", collections.Query{Sort: collections.SortPriceAsc}, []string{s, b, p}},
		{"дороже — выше", collections.Query{Sort: collections.SortPriceDesc}, []string{p, b, s}},
		{"тег и сортировка", collections.Query{Tag: "быстро", Sort: collections.SortPriceDesc}, []string{p, b}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := newCatalogService(t).Search(context.Background(), tt.query)
			if err != nil {
				t.Fatalf("Search: %v", err)
			}
			if got == nil {
				t.Fatalf("Search returned nil, want empty non-nil slice")
			}
			if !reflect.DeepEqual(ids(got), tt.want) {
				t.Errorf("Search(%+v) = %q, want %q", tt.query, ids(got), tt.want)
			}
		})
	}
}

func TestParseSort(t *testing.T) {
	tests := []struct {
		in      string
		want    collections.Sort
		wantErr bool
	}{
		{"", collections.SortCatalog, false},
		{"catalog", collections.SortCatalog, false},
		{"price_asc", collections.SortPriceAsc, false},
		{"price_desc", collections.SortPriceDesc, false},
		{"cheap", "", true},
	}
	for _, tt := range tests {
		got, err := collections.ParseSort(tt.in)
		if (err != nil) != tt.wantErr || got != tt.want {
			t.Errorf("ParseSort(%q) = %q, %v; want %q, error=%v", tt.in, got, err, tt.want, tt.wantErr)
		}
	}
}

// TestService_Tags проверяет R5: по убыванию числа подборок, при равенстве по алфавиту.
func TestService_Tags(t *testing.T) {
	got, err := newCatalogService(t).Tags(context.Background())
	if err != nil {
		t.Fatalf("Tags: %v", err)
	}
	want := []collections.TagCount{
		{Tag: "быстро", Count: 2},
		{Tag: "завтрак", Count: 1},
		{Tag: "обед", Count: 1},
		{Tag: "осень", Count: 1},
		{Tag: "сладкое", Count: 1},
		{Tag: "суп", Count: 1},
		{Tag: "ужин", Count: 1},
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("Tags = %+v, want %+v", got, want)
	}
}

func TestService_Get(t *testing.T) {
	svc := newCatalogService(t)

	got, err := svc.Get(context.Background(), "pasta-karbonara")
	if err != nil || got.Title != "Паста карбонара" || got.TotalPrice != 600 {
		t.Errorf("Get(pasta) = %+v, %v", got, err)
	}
	if _, err := svc.Get(context.Background(), "c-404"); !errors.Is(err, collections.ErrNotFound) {
		t.Errorf("Get(unknown) error = %v, want ErrNotFound", err)
	}
}
