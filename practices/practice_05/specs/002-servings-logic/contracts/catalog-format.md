# Контракт формата каталога: порции

Договор между куратором (`catalog/themes.json` → `mcp/vv-collections/curate.mjs`) и бэкендом (`backend/catalog/collections.json`). Каталог руками не правится — только пересборкой.

## Тема — `catalog/themes.json`

У элемента `items[]` появляется необязательное поле:

```json
{ "q": "кофе молотый", "pick": "кофе", "scalable": false }
```

- Нет поля или `true` — товар масштабируется; `false` — количество одинаково при ×1, ×2, ×4.
- У масштабируемого товара `quantity` не больше 10 (иначе при ×4 больше лимита корзины 40). `curate.mjs --dry-run` помечает нарушение и завершается с ошибкой, как при «подходящего товара нет».
- Предложение, что пометить, — [../research.md](../research.md), R-8.

## Каталог — `backend/catalog/collections.json`

```json
{
  "id": "zavtrak-s-syrnikami",
  "cart_url": "https://vkusvill.ru/mobile?basket&share=3549115194",
  "cart_urls": {
    "2": "https://vkusvill.ru/mobile?basket&share=…",
    "4": "https://vkusvill.ru/mobile?basket&share=…"
  },
  "products": [
    { "xml_id": 114976, "name": "Сырники классические жареные", "quantity": 1, "...": "..." },
    { "xml_id": 16124, "name": "Кофе жареный молотый", "quantity": 1, "scalable": false, "...": "..." }
  ]
}
```

| поле | правило (проверяет бэкенд при старте, R1) |
|---|---|
| `cart_url` | как в R3; корзина ×1 |
| `cart_urls` | обязателен; ровно ключи `"2"` и `"4"`; значения — по правилу R3 для `cart_url` |
| `products[].scalable` | необязателен; пишется только `false` |
| `products[].quantity` | масштабируемый: 0.01–10; немасштабируемый: 0.01–40 |

## Как куратор считает корзины

Для каждой подборки и каждого k ∈ {1, 2, 4}:

```text
q_k(p) = p.scalable === false ? p.quantity : Math.round(p.quantity * k * 100) / 100
vkusvill_cart_link_create({ products: [{ xml_id, q: q_k(p) }] })
```

Правило совпадает с бэкендом (data-model, «Алгоритм»), поэтому корзина по ссылке ×k содержит ровно `variants[k].quantities` из ответа API (FR-013). Функция расчёта экспортируется из `curate.mjs` и покрыта `curate.test.js`.

`--dry-run` дополнительно печатает для каждой подборки количества ×1/×2/×4 и пометку немасштабируемых товаров; файл каталога, как и сейчас, не записывает.
