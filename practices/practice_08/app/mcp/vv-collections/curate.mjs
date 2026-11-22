#!/usr/bin/env node
// Куратор каталога: по темам из catalog/themes.json ищет товары через MCP ВкусВилла,
// создаёт для каждой подборки три ссылки на корзину — ×1 (cart_url), ×2 и ×4 (cart_urls, R7) —
// и сохраняет backend/catalog/collections.json. Товар с "scalable": false не умножается на порции.
//
//   node mcp/vv-collections/curate.mjs            # пересобрать каталог
//   node mcp/vv-collections/curate.mjs --dry-run  # только показать, что будет выбрано
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const THEMES = path.join(ROOT, 'catalog', 'themes.json')
const OUT = path.join(ROOT, 'backend', 'catalog', 'collections.json')
const dryRun = process.argv.includes('--dry-run')

/** Убирает HTML-сущности и неразрывные пробелы, которые приходят в названиях. */
export function cleanName(s) {
  return s
    .replace(/&nbsp;| /g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Первый товар из выдачи, в названии которого есть pick (без учёта регистра и ё/е). */
export function pickItem(items, pick) {
  const norm = (s) => s.toLowerCase().replace(/ё/g, 'е')
  const withPrice = items.filter((i) => i.price?.current > 0)
  if (!pick) return withPrice[0]
  return withPrice.find((i) => norm(cleanName(i.name)).includes(norm(pick)))
}

/** Множители порций (R7): ×1 — cart_url, ×2 и ×4 — cart_urls. */
export const SERVINGS = [1, 2, 4]

/** Предел количества масштабируемого товара: ×4 не больше лимита корзины ВкусВилла 40. */
const SCALABLE_MAX = 10

/** Количество товара для множителя k — то же правило, что у бэкенда (round до 0.01). */
export function scaleQuantity(p, k) {
  if (p.scalable === false) return p.quantity
  return Math.round(p.quantity * k * 100) / 100
}

/** Состав корзины ВкусВилла для множителя k — вход vkusvill_cart_link_create: {id, q}. */
export function cartProducts(products, k) {
  return products.map((p) => ({ id: p.xml_id, q: scaleQuantity(p, k) }))
}

/** Поля для vkusvill_products_search (mode custom); xml_id товара приходит в поле id. */
export const SEARCH_FIELDS = ['id', 'name', 'price', 'unit', 'rating', 'url', 'images']

/** Товар каталога из ответа поиска ВкусВилла и элемента темы. */
export function toProduct(found, item) {
  const product = {
    xml_id: found.id,
    name: cleanName(found.name),
    quantity: item.quantity ?? 1,
    unit: found.unit ?? 'шт',
    price: Math.round(found.price.current),
    url: found.url,
    image: found.images?.[0]?.medium ?? '',
    rating: Math.round((found.rating?.average ?? 0) * 10) / 10,
  }
  if (item.scalable === false) product.scalable = false
  return product
}

/** Проверка элемента темы: текст ошибки или null. */
export function checkItem(item) {
  const q = item.quantity ?? 1
  if (item.scalable !== false && q > SCALABLE_MAX) {
    return `«${item.q}»: количество ${q} больше 10 — при ×4 больше лимита корзины 40; уменьшите или пометьте "scalable": false`
  }
  return null
}

async function main() {
  const themes = JSON.parse(readFileSync(THEMES, 'utf8'))
  const vv = new Client({ name: 'vv-collections-curator', version: '1.0.0' })
  await vv.connect(new StreamableHTTPClientTransport(new URL('https://mcp001.vkusvill.ru/mcp')))

  const call = async (name, args) => {
    const res = await vv.callTool({ name, arguments: args })
    const payload = JSON.parse(res.content.map((c) => c.text).join(''))
    if (res.isError || !payload.ok) throw new Error(`${name}(${JSON.stringify(args)}): ${JSON.stringify(payload).slice(0, 300)}`)
    return payload.data
  }

  const collections = []
  let failed = false
  for (const theme of themes) {
    console.log(`\n## ${theme.title}`)
    const products = []
    for (const item of theme.items) {
      const problem = checkItem(item)
      if (problem) {
        console.log(`  ✗ ${problem}`)
        failed = true
        continue
      }
      const data = await call('vkusvill_products_search', {
        q: item.q,
        limit: 10,
        mode: 'custom',
        fields: SEARCH_FIELDS,
      })
      const found = pickItem(data.items ?? [], item.pick)
      if (!found) {
        console.log(`  ✗ «${item.q}» (pick «${item.pick}»): подходящего товара нет`)
        failed = true
        continue
      }
      const product = toProduct(found, item)
      products.push(product)
      const by = SERVINGS.map((k) => `×${k}: ${scaleQuantity(product, k)}`).join(', ')
      const fixed = product.scalable === false ? ' (не масштабируется)' : ''
      console.log(`  ✓ «${item.q}» → ${product.name} — ${product.price} ₽/${product.unit}; ${by}${fixed}`)
    }
    const links = {}
    for (const k of SERVINGS) {
      const cart = await call('vkusvill_cart_link_create', { products: cartProducts(products, k) })
      links[k] = cart.link
      console.log(`  корзина ×${k}: ${cart.link}`)
    }
    const { items: _items, ...rest } = theme
    collections.push({ ...rest, cart_url: links[1], cart_urls: { 2: links[2], 4: links[4] }, products })
  }
  await vv.close()

  if (failed) {
    console.error('\nЕсть темы без товара — поправьте q/pick в catalog/themes.json.')
    process.exit(1)
  }
  if (dryRun) return
  const catalog = { updated_at: new Date().toISOString().slice(0, 10), collections }
  writeFileSync(OUT, JSON.stringify(catalog, null, 2) + '\n')
  console.log(`\nсохранено: ${path.relative(ROOT, OUT)} (${collections.length} подборок)`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main()
}
