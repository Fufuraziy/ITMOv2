# Contract: что UI читает из API

Потребительская сторона договора. Источник — «Что я гарантирую UI» в `specs/002-servings-logic/spec.md`. Здесь только то, на что опирается UI; остальное он не читает.

## Запросы

| запрос | изменение |
|---|---|
| `GET /collections?q=&tag=&max_price=&sort=` | без изменений; **`servings` не передаётся** (FR-018) |
| `GET /tags` | без изменений |
| `GET /collections/{id}` | UI не вызывает |

При переключении множителя запросов нет (FR-003).

## Ответ `200 GET /collections` — новые поля, которые читает UI

```jsonc
{
  "updated_at": "2026-10-06",
  "total": 1,
  "collections": [{
    "id": "zavtrak-s-syrnikami",
    "total_price": 1111,                       // = variants[0].total_price
    "cart_url": "https://vkusvill.ru/?share_basket=A",   // = variants[0].cart_url
    "products": [
      { "xml_id": 114976, "quantity": 1, "base_quantity": 1, "scalable": true,  "unit": "шт", "...": "как сейчас" },
      { "xml_id": 5005,   "quantity": 1, "base_quantity": 1, "scalable": false, "unit": "шт", "...": "как сейчас" }
    ],
    "variants": [                              // имя закреплено командой 2
      { "multiplier": 1, "total_price": 1111, "quantities": { "114976": 1, "5005": 1 }, "cart_url": "https://vkusvill.ru/?share_basket=A", "available": true },
      { "multiplier": 2, "total_price": 1417, "quantities": { "114976": 2, "5005": 1 }, "cart_url": "https://vkusvill.ru/?share_basket=B", "available": true },
      { "multiplier": 4, "total_price": 2029, "quantities": { "114976": 4, "5005": 1 }, "cart_url": "https://vkusvill.ru/?share_basket=C", "available": true }
    ]
  }]
}
```

Что UI проверяет сам (research R-4); при нарушении — карточка без переключателя:

- `variants` — массив ровно из трёх элементов с `multiplier` 1, 2, 4 (порядок UI не требует);
- у каждого варианта `cart_url` — непустая строка, `total_price` — число;
- в `quantities` каждого варианта есть ключ для каждого `xml_id` из `products`.

`reason` читается только при `available: false`. `servings` подборки UI не читает.

## Ошибки

Тело: `{"error": "…", "code": "…"}`. UI различает по `status` и `code`, текст `error` не разбирает (FR-019).

Значения `code` согласованы с `specs/002-servings-logic/contracts/http-api.md`.

| status | `code` | что показывает UI |
|---|---|---|
| 400 | `invalid_query` | «Каталог не отвечает. Обновите страницу через минуту.» — как сейчас |
| 500 | `internal_error` | то же |
| сеть / не JSON | — | то же |
| 404 | `collection_not_found` | UI `/collections/{id}` не вызывает; код зарезервирован |

## Совместимость при выкате

Ответ без `variants`, `scalable`, `base_quantity` (старый бэкенд) — валиден: карточка как до фичи (FR-010).
