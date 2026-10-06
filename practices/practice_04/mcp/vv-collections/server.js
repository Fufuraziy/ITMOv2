#!/usr/bin/env node
// MCP-сервер vv-collections: поиск по каталогу тематических подборок ВкусВилла
// и ссылки «перенести подборку в корзину ВкусВилла». Транспорт — stdio.
// Адрес бэкенда — VV_API_URL (по умолчанию http://localhost:8080).
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { BackendError, createApi } from './api.js'

const apiURL = (process.env.VV_API_URL || 'http://localhost:8080').replace(/\/$/, '')
const api = createApi(apiURL)

const Product = z.object({
  xml_id: z.number(),
  name: z.string(),
  quantity: z.number(),
  unit: z.string(),
  price: z.number(),
  rating: z.number(),
  url: z.string(),
  image: z.string(),
})

const Collection = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  cart_url: z.string(),
  total_price: z.number(),
  products: z.array(Product),
})

const Summary = z.object({
  id: z.string(),
  title: z.string(),
  tags: z.array(z.string()),
  total_price: z.number(),
  products_count: z.number(),
  cart_url: z.string(),
})

const TagCount = z.object({ tag: z.string(), count: z.number() })

const rub = (n) => `${Math.round(n).toLocaleString('ru-RU')} ₽`
const qty = (n) => String(n).replace('.', ',')

const server = new McpServer({ name: 'vv-collections', version: '2.0.0' })

server.registerTool(
  'search_collections',
  {
    title: 'Найти подборки',
    description:
      'Ищет готовые тематические подборки товаров ВкусВилла (завтрак, суп, пикник…). ' +
      'query — слова через пробел, ищутся в названии, описании, тегах и товарах (все слова должны найтись). ' +
      'tag — точный тег (список — list_tags), max_price — бюджет подборки в рублях, sort — порядок. ' +
      'В ответе для каждой подборки есть ссылка, которая переносит её в корзину ВкусВилла.',
    inputSchema: {
      query: z.string().max(200).optional().describe('Слова для поиска, например «завтрак сырники»'),
      tag: z.string().max(24).optional().describe('Тег, например «веган»'),
      max_price: z.number().int().positive().optional().describe('Бюджет подборки, ₽'),
      sort: z.enum(['catalog', 'price_asc', 'price_desc']).optional().describe('Порядок выдачи'),
    },
    outputSchema: { updated_at: z.string(), total: z.number(), collections: z.array(Summary) },
  },
  async ({ query, tag, max_price, sort }) => {
    try {
      const res = await api.search({ q: query, tag, max_price, sort })
      const collections = res.collections.map((c) => ({
        id: c.id,
        title: c.title,
        tags: c.tags,
        total_price: c.total_price,
        products_count: c.products.length,
        cart_url: c.cart_url,
      }))
      let text
      if (collections.length === 0) {
        text = 'Ничего не нашлось. Попробуй меньше слов, убери бюджет или выбери тег из list_tags.'
      } else {
        text = [
          `Найдено: ${res.total} (цены на ${res.updated_at})`,
          ...collections.map((c) =>
            `- ${c.id} — ${c.title}, ${rub(c.total_price)}, товаров: ${c.products_count}; ` +
            `теги: ${c.tags.join(', ')}; корзина: ${c.cart_url}`),
        ].join('\n')
      }
      return {
        content: [{ type: 'text', text }],
        structuredContent: { updated_at: res.updated_at, total: res.total, collections },
      }
    } catch (err) {
      return toolError(err)
    }
  },
)

server.registerTool(
  'get_collection',
  {
    title: 'Состав подборки',
    description: 'Возвращает товары подборки с количеством и ценой, итог и ссылку для переноса в корзину ВкусВилла. id берётся из search_collections.',
    inputSchema: { id: z.string().min(1).max(80).describe('id подборки, например zavtrak-s-syrnikami') },
    outputSchema: { collection: Collection },
  },
  async ({ id }) => {
    try {
      const c = await api.get(id)
      const text = [
        `${c.title} — ${c.description}`,
        ...c.products.map((p) => `- ${p.name}: ${qty(p.quantity)} ${p.unit} × ${rub(p.price)}`),
        `Итого ≈ ${rub(c.total_price)}`,
        `Перенести в корзину ВкусВилла: ${c.cart_url}`,
      ].join('\n')
      return { content: [{ type: 'text', text }], structuredContent: { collection: c } }
    } catch (err) {
      return toolError(err)
    }
  },
)

server.registerTool(
  'list_tags',
  {
    title: 'Теги каталога',
    description: 'Все теги каталога с числом подборок — чтобы выбрать tag для search_collections.',
    inputSchema: {},
    outputSchema: { tags: z.array(TagCount) },
  },
  async () => {
    try {
      const tags = await api.tags()
      return {
        content: [{ type: 'text', text: tags.map((t) => `${t.tag} (${t.count})`).join(', ') }],
        structuredContent: { tags },
      }
    } catch (err) {
      return toolError(err)
    }
  },
)

function toolError(err) {
  const message = err instanceof BackendError ? err.message : `непредвиденная ошибка: ${err?.message ?? err}`
  return { content: [{ type: 'text', text: message }], isError: true }
}

await server.connect(new StdioServerTransport())
