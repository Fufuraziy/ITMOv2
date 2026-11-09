package collections_test

import (
	"strconv"

	"vv/collections/internal/collections"
)

func ptr[T any](v T) *T { return &v }

// cartURL — корректная ссылка на корзину ВкусВилла для тестов.
func cartURL(n int) string { return "https://vkusvill.ru/mobile?basket&share=9" + strconv.Itoa(n) }

// breakfast и soup — минимальный корректный каталог для тестов.
func breakfast() collections.Collection {
	return collections.Collection{
		ID:          "zavtrak-s-syrnikami",
		Title:       "Завтрак с сырниками",
		Description: "Сырники со сметаной и вареньем",
		Tags:        []string{"завтрак", "сладкое", "быстро"},
		CartURL:     "https://vkusvill.ru/mobile?basket&share=3549115194",
		CartURLs:    map[string]string{"2": "https://vkusvill.ru/mobile?basket&share=3549115192", "4": "https://vkusvill.ru/mobile?basket&share=3549115198"},
		Products: []collections.Product{
			{XMLID: 114976, Name: "Сырники классические жареные", Quantity: 1, Unit: "шт", Price: 306,
				URL: "https://vkusvill.ru/goods/syrniki-klassicheskie-zharenye-114976/"},
			{XMLID: 14526, Name: "Сметана 15%, 250 г", Quantity: 1, Unit: "шт", Price: 98,
				URL: "https://vkusvill.ru/goods/smetana-15-250-g-14526/"},
		},
	}
}

func soup() collections.Collection {
	return collections.Collection{
		ID:          "tykvennyi-krem-sup",
		Title:       "Тыквенный крем-суп",
		Description: "Тыква, сливки и лук — осенний суп на четыре порции",
		Tags:        []string{"обед", "суп", "осень"},
		CartURL:     "https://vkusvill.ru/mobile?basket&share=3575424647",
		CartURLs:    map[string]string{"2": "https://vkusvill.ru/mobile?basket&share=3575424642", "4": "https://vkusvill.ru/mobile?basket&share=3575424648"},
		Products: []collections.Product{
			{XMLID: 17081, Name: "Тыква очищенная в в/у", Quantity: 2, Unit: "шт", Price: 136,
				URL: "https://vkusvill.ru/goods/tykva-ochishchennaya-v-v-u-17081/"},
			{XMLID: 3001, Name: "Лук репчатый", Quantity: 0.5, Unit: "кг", Price: 54,
				URL: "https://vkusvill.ru/goods/luk-repchatyy-3001/"},
			{XMLID: 3002, Name: "Ёжики из теста", Quantity: 1, Unit: "шт", Price: 99,
				URL: "https://vkusvill.ru/goods/ezhiki-3002/"},
		},
	}
}
