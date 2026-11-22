# Data Model: масштабирование подборки по порциям

Две модели: **каталог** (вход, `backend/catalog/collections.json` → `collections.Collection`) и **ответ** (выход API, `collections.ScaledCollection`). Каталог неизменен после старта; ответ строится функцией `Scale` на каждый запрос. Решения о форме — [research.md](research.md) R-1, R-2, R-4.

## Множитель порций — `Servings`

| что | значение |
|---|---|
| Тип | целое, `type Servings int` |
| Допустимо | `1`, `2`, `4` (константы `Servings1`, `Servings2`, `Servings4`; список `AllServings` в этом порядке) |
| Разбор | `ParseServings(s string) (Servings, error)`: `""` → 1; ровно `"1"`, `"2"`, `"4"` → значение; иначе ошибка `servings must be one of 1, 2, 4, got "<s>"` |
| Нулевое значение в `Query` | означает 1 (как пустой `Sort` означает `catalog`) |

## Каталог (вход)

### Collection — изменения

| поле JSON | Go | обязательно | правило |
|---|---|---|---|
| `cart_url` | `CartURL string` | да | как сейчас (R3) — ссылка для ×1 |
| `cart_urls` | `CartURLs map[string]string` | да (после шага 3 выката) | ровно ключи `"2"` и `"4"`; каждое значение начинается с `https://vkusvill.ru/mobile?basket&share=` |
| остальные | без изменений | | R3 |

### Product — изменения

| поле JSON | Go | обязательно | правило |
|---|---|---|---|
| `scalable` | `Scalable *bool` | нет | нет поля или `true` — масштабируется; `false` — нет |
| `quantity` | `Quantity float64` | да | масштабируемый: 0.01–10; немасштабируемый: 0.01–40 (R3) |

Метод `(Product) IsScalable() bool` — `Scalable == nil || *Scalable`.

### Новые нарушения при старте (R1, формат `<id>: <поле>: <проблема>`)

| условие | сообщение |
|---|---|
| масштабируемый товар с количеством > 10 | `products[i].quantity: scalable must be 0.01-10, got 15` |
| нет ключа `"2"` или `"4"` | `cart_urls[2]: missing` |
| ключ не `"2"`/`"4"` | `cart_urls[3]: unknown servings, want 2 or 4` |
| ссылка с неверным префиксом | `cart_urls[4]: must start with https://vkusvill.ru/mobile?basket&share=` |

Если количество масштабируемого товара вне 0.01–40, выдаётся только старое сообщение R3 (`must be 0.01-40`), а не оба. Ключи в сообщениях перечисляются по возрастанию — список проблем детерминирован.

## Ответ (выход)

### ScaledCollection

| поле JSON | тип | источник |
|---|---|---|
| `id`, `title`, `description`, `tags` | как в каталоге | без изменений |
| `servings` | целое | применённый множитель |
| `cart_url` | строка | `cart_url` для 1, `cart_urls[k]` для 2 и 4 |
| `total_price` | целое | `variants[k].total_price` |
| `products` | `[]ScaledProduct` | порядок каталога |
| `variants` | `[]Variant` | всегда три: 1, 2, 4 |

### ScaledProduct

| поле JSON | тип | источник |
|---|---|---|
| `xml_id`, `name`, `unit`, `price`, `rating`, `url`, `image` | как в каталоге | без изменений |
| `quantity` | число | `scaleQuantity(p, k)` |
| `base_quantity` | число | `quantity` из каталога |
| `scalable` | bool | `IsScalable()` |

### Variant

| поле JSON | тип | источник |
|---|---|---|
| `multiplier` | целое | 1, 2 или 4 |
| `total_price` | целое | `totalPrice` по количествам этого множителя |
| `quantities` | объект `{"<xml_id>": число}` | `scaleQuantity(p, multiplier)` по всем товарам; ключи — десятичные строки `xml_id` (так JSON кодирует ключи-числа) |
| `cart_url` | строка | как `cart_url` подборки для этого множителя |
| `available` | bool | всегда `true` (FR-011c) |
| `reason` | строка, `omitempty` | отсутствует, пока `available: true` |

## Алгоритм

```text
scaleQuantity(p, k) = p.IsScalable() ? round(p.Quantity × k × 100) / 100 : p.Quantity
totalPrice(ps, k)   = round(Σ p.Price × scaleQuantity(p, k))          // одно округление, половина от нуля
cartURL(c, k)       = k == 1 ? c.CartURL : c.CartURLs[strconv.Itoa(k)]

Scale(c, s):
  variants = [ {k, totalPrice(c.Products, k), {xml_id: scaleQuantity(p, k)}, cartURL(c, k), true} for k in 1, 2, 4 ]
  products = [ p + {quantity: scaleQuantity(p, s), base_quantity: p.Quantity, scalable: p.IsScalable()} ]
  return {..., servings: s, cart_url: cartURL(c, s), total_price: totalPrice(c.Products, s), products, variants}
```

Свойства, которые проверяют тесты:
- `Scale(c, 1)` совпадает с подборкой из хранилища во всех старых полях (`total_price` — тот же `totalPrice`).
- Вариант с `multiplier = s` совпадает с `total_price`, `cart_url` и `products[].quantity` подборки (FR-011a, SC-007).
- Ни одно `quantity` не больше 40 — следует из правила ≤ 10 (FR-006, FR-014).

## Поиск

`Search(ctx, q)` фильтрует `max_price` и сортирует `price_asc`/`price_desc` по `totalPrice(c.Products, q.Servings)`; при равенстве — устойчивая сортировка, порядок каталога. Результат — базовые подборки; обработчик превращает каждую в `Scale(c, q.Servings)`.

## Ошибки API

`errorBody{ Error string "error"; Code string "code" }`. Значения `code` — [contracts/http-api.md](contracts/http-api.md).
