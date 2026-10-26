# Контракт HTTP API: порции

Дополняет R2 и R4 из `docs/requirements.md`. Всё, что здесь не названо, — как в R2/R4. Это договор для команды 1 (UI) и MCP-сервера; раздел «Что я гарантирую UI» в [../spec.md](../spec.md) — его краткая версия.

## Запрос

```
GET /collections?servings=2&q=суп&max_price=2000&sort=price_asc
GET /collections/{id}?servings=4
```

| параметр | значения | по умолчанию |
|---|---|---|
| `servings` | ровно `1`, `2`, `4` | нет параметра или пусто → `1`; при повторе берётся первое значение |

В `GET /collections` от `servings` зависят только `max_price` и `sort` по цене (по пересчитанному `total_price`). UI команды 1 `servings` в поиск не передаёт (решение 9A) — параметр для MCP и будущих клиентов.

Для `GET /collections/{id}` параметр проверяется раньше поиска подборки.

## Ответ 200

`GET /collections/tykvennyi-krem-sup?servings=2` (показаны два товара, цены посчитаны по ним; ссылки условные):

```json
{
  "id": "tykvennyi-krem-sup",
  "title": "Тыквенный крем-суп",
  "description": "…",
  "tags": ["обед", "суп", "вегетарианское", "осень"],
  "servings": 2,
  "cart_url": "https://vkusvill.ru/mobile?basket&share=2000000002",
  "total_price": 598,
  "products": [
    {"xml_id": 17081, "name": "Тыква очищенная в в/у", "quantity": 4, "base_quantity": 2, "scalable": true,
     "unit": "шт", "price": 136, "rating": 4.7, "url": "https://vkusvill.ru/goods/…", "image": "…"},
    {"xml_id": 3001, "name": "Лук репчатый", "quantity": 1, "base_quantity": 0.5, "scalable": true,
     "unit": "кг", "price": 54, "rating": 4.8, "url": "https://vkusvill.ru/goods/…", "image": "…"}
  ],
  "variants": [
    {"multiplier": 1, "total_price": 299,  "quantities": {"17081": 2, "3001": 0.5}, "cart_url": "https://vkusvill.ru/mobile?basket&share=2000000001", "available": true},
    {"multiplier": 2, "total_price": 598,  "quantities": {"17081": 4, "3001": 1},   "cart_url": "https://vkusvill.ru/mobile?basket&share=2000000002", "available": true},
    {"multiplier": 4, "total_price": 1196, "quantities": {"17081": 8, "3001": 2},   "cart_url": "https://vkusvill.ru/mobile?basket&share=2000000004", "available": true}
  ]
}
```

`GET /collections?...` → `{"updated_at": "2026-10-06", "total": N, "collections": [<подборка как выше>, ...]}`.

### Гарантии формата

| поле | гарантия |
|---|---|
| `servings` | целое 1, 2 или 4; всегда есть |
| `cart_url` | всегда строка, никогда `null`; начинается с `https://vkusvill.ru/mobile?basket&share=`; для `servings=1` — та же ссылка, что до фичи |
| `total_price` | целое число рублей; равно `total_price` варианта с `multiplier = servings` |
| `products` | порядок и состав как в каталоге при любом `servings` |
| `products[].quantity` | 0.01–40; не больше двух знаков после точки; целые без дробной части (`4`, не `4.0`) |
| `products[].base_quantity` | количество из каталога (×1); тот же формат |
| `products[].scalable` | bool; `false` — `quantity` = `base_quantity` при любом `servings` |
| `variants` | ровно три элемента, `multiplier` 1, 2, 4 по порядку; не зависят от `servings` запроса |
| `variants[].quantities` | ключи — `xml_id` строкой (`"17081"`), по всем товарам подборки; значения в формате `quantity` |
| `variants[].cart_url` | как `cart_url`; для `multiplier = servings` совпадает с `cart_url` подборки |
| `variants[].available` | bool; сейчас всегда `true` |
| `variants[].reason` | есть только при `available: false` (сейчас не бывает); строка по-русски для людей |

Поля из R2/R4 сохраняются; новые поля — `servings`, `variants`, `products[].base_quantity`, `products[].scalable`.

## Ошибки

Тело любой ошибки `400`/`404`/`500`: `{"error": "<текст>", "code": "<код>"}`. UI различает ошибки по `code`; текст `error` — для людей и логов, может меняться.

| HTTP | `code` | когда | `error` |
|---|---|---|---|
| 400 | `invalid_query` | неверный `servings`, `max_price` или `sort` | `invalid query: servings must be one of 1, 2, 4, got "3"` (и прежние тексты для `max_price`/`sort`) |
| 404 | `collection_not_found` | нет подборки с таким id (при верном `servings`) | `collection not found` |
| 500 | `internal_error` | внутренняя ошибка | `internal error` |
| 405 | — | метод не GET | как сейчас (ответ `net/http`, не JSON) |

Порядок проверок в `GET /collections/{id}`: сначала `servings` (`400`), потом поиск подборки (`404`).

## Без изменений

`GET /tags` (R5), `405` на другие методы, R6.
