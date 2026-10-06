// Клиент API поиска подборок (docs/requirements.md, R2, R5).

export type Product = {
  xml_id: number
  name: string
  quantity: number
  unit: string
  price: number
  rating: number
  url: string
  image: string
}

export type Collection = {
  id: string
  title: string
  description: string
  tags: string[]
  cart_url: string
  total_price: number
  products: Product[]
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

async function getJSON<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, { signal })
  if (!res.ok) throw new Error(`${path}: ${res.status}`)
  return res.json() as Promise<T>
}

export function searchCollections(f: Filters, signal?: AbortSignal): Promise<SearchResult> {
  const qs = toSearchParams(f).toString()
  return getJSON<SearchResult>('/collections' + (qs ? `?${qs}` : ''), signal)
}

export function fetchTags(): Promise<TagCount[]> {
  return getJSON<TagCount[]>('/tags')
}
