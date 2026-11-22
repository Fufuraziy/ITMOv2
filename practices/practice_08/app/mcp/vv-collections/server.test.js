// Сквозные тесты: настоящий MCP-клиент SDK запускает server.js по stdio,
// вместо Go-бэкенда — поддельный HTTP-сервер с заранее заданными ответами.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const SERVER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'server.js')

let backend
let backendURL
const received = []
let routes = {}

before(async () => {
  backend = http.createServer((req, res) => {
    received.push(decodeURIComponent(req.url))
    const route = routes[new URL(req.url, 'http://x').pathname] ?? { status: 404, json: { error: 'not found' } }
    res.writeHead(route.status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(route.json))
  })
  await new Promise((r) => backend.listen(0, '127.0.0.1', r))
  backendURL = `http://127.0.0.1:${backend.address().port}`
})

after(() => backend.close())

async function withClient(apiURL, fn) {
  const client = new Client({ name: 'vv-collections-test', version: '1.0.0' })
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: [SERVER],
    env: { ...process.env, VV_API_URL: apiURL },
    stderr: 'ignore',
  }))
  try {
    return await fn(client)
  } finally {
    await client.close()
  }
}

const breakfast = {
  id: 'zavtrak-s-syrnikami',
  title: 'Завтрак с сырниками',
  description: 'Сырники со сметаной',
  tags: ['завтрак', 'быстро'],
  cart_url: 'https://vkusvill.ru/?share_basket=3549115194',
  total_price: 404,
  products: [
    { xml_id: 114976, name: 'Сырники классические жареные', quantity: 1, unit: 'шт', price: 306, rating: 4.9, url: 'https://vkusvill.ru/goods/a/', image: '' },
    { xml_id: 3001, name: 'Лук репчатый', quantity: 0.5, unit: 'кг', price: 54, rating: 4.8, url: 'https://vkusvill.ru/goods/b/', image: '' },
  ],
}

const text = (result) => result.content.map((c) => c.text).join('\n')

test('tools/list: три инструмента поиска, создания нет', async () => {
  await withClient(backendURL, async (client) => {
    const { tools } = await client.listTools()
    assert.deepEqual(tools.map((t) => t.name).sort(), ['get_collection', 'list_tags', 'search_collections'])
    const search = tools.find((t) => t.name === 'search_collections')
    assert.deepEqual(search.inputSchema.properties.sort.enum, ['catalog', 'price_asc', 'price_desc'])
  })
})

test('search_collections: параметры уходят в запрос, ответ — сводка с корзиной', async () => {
  received.length = 0
  routes = { '/collections': { status: 200, json: { updated_at: '2026-10-06', total: 1, collections: [breakfast] } } }
  await withClient(backendURL, async (client) => {
    const result = await client.callTool({
      name: 'search_collections',
      arguments: { query: 'сырники', tag: 'завтрак', max_price: 500, sort: 'price_asc' },
    })

    assert.equal(result.isError, undefined)
    assert.deepEqual(received, ['/collections?q=сырники&tag=завтрак&max_price=500&sort=price_asc'])
    assert.match(text(result), /Найдено: 1 \(цены на 2026-10-06\)/)
    assert.match(text(result), /zavtrak-s-syrnikami — Завтрак с сырниками, 404 ₽, товаров: 2/)
    assert.match(text(result), /корзина: https:\/\/vkusvill\.ru\/\?share_basket=3549115194/)
    assert.equal(result.structuredContent.collections[0].products_count, 2)
  })
})

test('search_collections: пустая выдача — подсказка, а не ошибка', async () => {
  routes = { '/collections': { status: 200, json: { updated_at: '2026-10-06', total: 0, collections: [] } } }
  routes['/tags'] = { status: 200, json: [{ tag: 'завтрак', count: 2 }] }
  await withClient(backendURL, async (client) => {
    const result = await client.callTool({ name: 'search_collections', arguments: { query: 'пицца' } })

    assert.equal(result.isError, undefined)
    assert.match(text(result), /Ничего не нашлось/)
    assert.match(text(result), /list_tags/)
  })
})

test('search_collections: неверный вход отсекает схема MCP, бэкенд не вызывается', async () => {
  received.length = 0
  await withClient(backendURL, async (client) => {
    for (const args of [{ max_price: -5 }, { max_price: 10.5 }, { sort: 'cheap' }]) {
      const result = await client.callTool({ name: 'search_collections', arguments: args })
      assert.equal(result.isError, true, JSON.stringify(args))
      assert.match(text(result), /Input validation error/)
    }
    assert.equal(received.length, 0)
  })
})

test('get_collection: состав, сумма и ссылка на корзину', async () => {
  routes = { '/collections/zavtrak-s-syrnikami': { status: 200, json: breakfast } }
  await withClient(backendURL, async (client) => {
    const result = await client.callTool({ name: 'get_collection', arguments: { id: 'zavtrak-s-syrnikami' } })

    assert.equal(result.isError, undefined)
    assert.match(text(result), /- Сырники классические жареные: 1 шт × 306 ₽/)
    assert.match(text(result), /- Лук репчатый: 0,5 кг × 54 ₽/)
    assert.match(text(result), /Итого ≈ 404 ₽/)
    assert.match(text(result), /Перенести в корзину ВкусВилла: https:\/\/vkusvill\.ru\/\?share_basket=3549115194/)
    assert.equal(result.structuredContent.collection.id, 'zavtrak-s-syrnikami')
  })
})

test('get_collection: неизвестный id — ошибка с подсказкой', async () => {
  routes = {}
  await withClient(backendURL, async (client) => {
    const result = await client.callTool({ name: 'get_collection', arguments: { id: 'pizza' } })

    assert.equal(result.isError, true)
    assert.match(text(result), /Подборки «pizza» нет/)
    assert.match(text(result), /search_collections/)
  })
})

test('недоступный бэкенд даёт понятную ошибку', async () => {
  await withClient('http://127.0.0.1:9', async (client) => {
    const result = await client.callTool({ name: 'list_tags', arguments: {} })

    assert.equal(result.isError, true)
    assert.match(text(result), /бэкенд подборок недоступен/)
    assert.match(text(result), /dev-backend\.sh/)
  })
})

test('list_tags: теги с числом подборок', async () => {
  routes = { '/tags': { status: 200, json: [{ tag: 'завтрак', count: 2 }, { tag: 'суп', count: 1 }] } }
  await withClient(backendURL, async (client) => {
    const result = await client.callTool({ name: 'list_tags', arguments: {} })

    assert.equal(result.isError, undefined)
    assert.match(text(result), /завтрак \(2\), суп \(1\)/)
    assert.equal(result.structuredContent.tags.length, 2)
  })
})
