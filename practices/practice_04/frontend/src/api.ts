// Клиент API поиска подборок (docs/requirements.md, R2, R5; порции — specs/002-servings-logic/contracts/http-api.md).

export type Multiplier = 1 | 2 | 4

/** Подборка, пересчитанная на один множитель порций. */
export type Variant = {
  multiplier: Multiplier
  total_price: number
  /** Количество по `xml_id` строкой. */
  quantities: Record<string, number>
  cart_url: string
  available: boolean
  /** Только при `available: false`. */
  reason?: string
}

export type Product = {
  xml_id: number
  name: string
  quantity: number
  unit: string
  price: number
  rating: number
  url: string
  image: string
  /** Новые поля бэкенда с порциями; на старом бэкенде их нет. */
  scalable?: boolean
  base_quantity?: number
}

export type Collection = {
  id: string
  title: string
  description: string
  tags: string[]
  cart_url: string
  total_price: number
  products: Product[]
  variants?: Variant[]
  servings?: Multiplier
}

export type SearchResult = { updated_at: string; total: number; collections: Collection[] }
export type TagCount = { tag: string; count: number }
export type Sort = 'catalog' | 'price_asc' | 'price_desc'
export type Filters = { q: string; tag: string; maxPrice: number; sort: Sort }

export const emptyFilters: Filters = { q: '', tag: '', maxPrice: 0, sort: 'catalog' }

/** Параметры поиска ↔ строка запроса: та же форма и для API, и для адреса страницы. */
export function toSearchParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.q.trim()) p.set('q', f.q.trim())
  if (f.tag) p.set('tag', f.tag)
  if (f.maxPrice > 0) p.set('max_price', String(f.maxPrice))
  if (f.sort !== 'catalog') p.set('sort', f.sort)
  return p
}

export function fromSearchParams(p: URLSearchParams): Filters {
  const sort = p.get('sort')
  const max = Number(p.get('max_price'))
  return {
    q: p.get('q') ?? '',
    tag: p.get('tag') ?? '',
    maxPrice: Number.isInteger(max) && max > 0 ? max : 0,
    sort: sort === 'price_asc' || sort === 'price_desc' ? sort : 'catalog',
  }
}

/** Ошибка API: HTTP-статус и машинный `code` из тела; текст `error` не разбираем. */
export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string | undefined, path: string) {
    super(`${path}: ${status}${code ? ` ${code}` : ''}`)
    this.name = 'ApiError'
  }
}

async function errorCode(res: Response): Promise<string | undefined> {
  try {
    const body = await res.json()
    return typeof body?.code === 'string' ? body.code : undefined
  } catch {
    return undefined
  }
}

async function getJSON<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, { signal })
  if (!res.ok) throw new ApiError(res.status, await errorCode(res), path)
  return res.json() as Promise<T>
}

export function searchCollections(f: Filters, signal?: AbortSignal): Promise<SearchResult> {
  const qs = toSearchParams(f).toString()
  return getJSON<SearchResult>('/collections' + (qs ? `?${qs}` : ''), signal)
}

export function fetchTags(): Promise<TagCount[]> {
  return getJSON<TagCount[]>('/tags')
}
