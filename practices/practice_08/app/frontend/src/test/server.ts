// Подмена сервера в тестах: fetch отвечает так же, как Go-бэкенд (backend/internal/httpapi, R8).
// Формы тел сверены с backend/internal/httpapi/suggestions_test.go.
import { vi } from 'vitest'
import type { Suggestion, SuggestionInput } from '@/api'

export type Reply = { status?: number; body: unknown } | 'network-error' | Promise<{ status?: number; body: unknown }>

export const suggestion = (patch: Partial<Suggestion> = {}): Suggestion => ({
  id: 1,
  title: 'Пикник на шестерых',
  occasion: 'пикник',
  budget: 4000,
  comment: 'Без мангала, всё готовое',
  status: 'new',
  created_at: '2026-11-20T09:30:00Z',
  ...patch,
})

/** 200 GET /suggestions — `{total, suggestions}`, новые сначала. */
export const list = (items: Suggestion[]) => ({ body: { total: items.length, suggestions: items } })

/** 201 POST /suggestions — сервер возвращает заявку без email. */
export const created = (input: SuggestionInput, id = 99): { status: number; body: Suggestion } => ({
  status: 201,
  body: { id, title: input.title, occasion: input.occasion, budget: input.budget, comment: input.comment,
    status: 'new', created_at: '2026-11-22T10:00:00Z' },
})

export const invalid = (fields: Record<string, string>) =>
  ({ status: 400, body: { error: 'invalid suggestion', code: 'invalid_suggestion', fields } })
export const duplicate = () =>
  ({ status: 409, body: { error: 'suggestion already exists', code: 'duplicate_suggestion', fields: { title: 'duplicate' } } })
export const internal = () => ({ status: 500, body: { error: 'internal error', code: 'internal_error' } })

/** Ответ, который придёт, когда тест вызовет resolve: так проверяется состояние «ждём сервер». */
export function deferred() {
  let resolve!: (r: { status?: number; body: unknown }) => void
  const promise = new Promise<{ status?: number; body: unknown }>((r) => { resolve = r })
  return { promise, resolve }
}

type Handlers = {
  list?: () => Reply
  create?: (input: SuggestionInput) => Reply
  search?: (url: URL) => Reply
}

/** Подменяет fetch; возвращает mock, по вызовам которого видно, сколько запросов ушло. */
export function mockServer(h: Handlers = {}) {
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input, 'http://localhost')
    const method = init?.method ?? 'GET'
    let reply: Reply
    if (url.pathname === '/suggestions' && method === 'POST') {
      reply = h.create ? h.create(JSON.parse(String(init?.body))) : created(JSON.parse(String(init?.body)))
    } else if (url.pathname === '/suggestions') {
      reply = h.list ? h.list() : list([])
    } else if (url.pathname === '/tags') {
      reply = { body: [{ tag: 'ужин', count: 3 }] }
    } else if (url.pathname === '/collections') {
      reply = h.search ? h.search(url) : { body: { updated_at: '2026-10-06', total: 0, collections: [] } }
    } else {
      reply = { status: 404, body: { error: 'not found', code: 'not_found' } }
    }
    if (reply === 'network-error') throw new TypeError('Failed to fetch')
    const r = await reply
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200, headers: { 'Content-Type': 'application/json' } })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** Тела всех POST /suggestions, отправленных за тест. */
export const posts = (fetchMock: ReturnType<typeof mockServer>) =>
  fetchMock.mock.calls
    .filter(([u, init]) => String(u).startsWith('/suggestions') && (init as RequestInit | undefined)?.method === 'POST')
    .map(([, init]) => JSON.parse(String((init as RequestInit).body)) as SuggestionInput)
