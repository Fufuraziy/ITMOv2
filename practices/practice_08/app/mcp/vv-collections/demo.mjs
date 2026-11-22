#!/usr/bin/env node
// Демонстрация реальных вызовов MCP vv-collections против запущенного Go-бэкенда:
// успешные сценарии и обработка ошибочного входа.
//
//   sh scripts/dev-backend.sh &
//   node mcp/vv-collections/demo.mjs > docs/evidence/03-mcp-demo.txt
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const client = new Client({ name: 'vv-demo', version: '2.0.0' })
await client.connect(new StdioClientTransport({
  command: process.execPath,
  args: [path.join(here, 'server.js')],
  env: { ...process.env },
}))

async function call(name, args) {
  console.log(`\n>>> ${name} ${JSON.stringify(args)}`)
  const result = await client.callTool({ name, arguments: args })
  console.log(`<<< isError=${result.isError === true}`)
  console.log(result.content.map((c) => c.text).join('\n'))
}

console.log(`# Демо MCP vv-collections, ${new Date().toISOString()}`)
const { tools } = await client.listTools()
console.log(`tools/list: ${tools.map((t) => t.name).join(', ')}`)

// Успешные сценарии.
await call('list_tags', {})
await call('search_collections', { query: 'завтрак', max_price: 1500, sort: 'price_asc' })
await call('get_collection', { id: 'zavtrak-s-syrnikami' })

// Пустая выдача — не ошибка, а подсказка.
await call('search_collections', { query: 'пицца' })

// Ошибочный вход: неизвестный id (ответ бэкенда 404) и неверные параметры (схема MCP).
await call('get_collection', { id: 'pizza-margarita' })
await call('search_collections', { max_price: -100, sort: 'cheap' })

await client.close()
