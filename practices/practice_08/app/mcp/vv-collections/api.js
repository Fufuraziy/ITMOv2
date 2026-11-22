// Клиент HTTP API бэкенда подборок (docs/requirements.md). Переводит ответы в понятные агенту ошибки.

const TIMEOUT_MS = 5000

/** Ошибка, текст которой можно показать агенту как есть. */
export class BackendError extends Error {}

export function createApi(baseURL) {
  async function request(path) {
    let res
    try {
      res = await fetch(baseURL + path, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    } catch (err) {
      const why = err?.name === 'TimeoutError' ? `не ответил за ${TIMEOUT_MS / 1000} с` : 'не принимает соединения'
      throw new BackendError(
        `бэкенд подборок недоступен (${baseURL} ${why}). ` +
        'Запусти его: sh scripts/dev-backend.sh (или задай VV_API_URL).',
      )
    }
    const payload = await res.json().catch(() => null)
    if (res.ok) return payload
    const err = new BackendError(`бэкенд ответил ${res.status}: ${payload?.error ?? res.statusText}`)
    err.status = res.status
    throw err
  }

  return {
    /** R2: params — {q, tag, max_price, sort}, пустые не передаются. */
    search(params) {
      const qs = new URLSearchParams()
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== '') qs.set(k, String(v))
      }
      const s = qs.toString()
      return request('/collections' + (s ? `?${s}` : ''))
    },
    /** R4: подборка по id; неизвестный id — BackendError с подсказкой. */
    async get(id) {
      try {
        return await request(`/collections/${encodeURIComponent(id)}`)
      } catch (err) {
        if (err.status === 404) {
          throw new BackendError(`Подборки «${id}» нет. Найди нужный id через search_collections.`)
        }
        throw err
      }
    },
    /** R5: теги с числом подборок. */
    tags: () => request('/tags'),
  }
}
