import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, emptyFilters, searchCollections } from './api'

function reply(status: number, body: string) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status })))
}

async function failure(): Promise<ApiError> {
  try {
    await searchCollections(emptyFilters)
  } catch (err) {
    return err as ApiError
  }
  throw new Error('search did not fail')
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('API errors', () => {
  it('carries the status and code of a bad query', async () => {
    reply(400, JSON.stringify({ error: 'invalid query: max_price must be a positive integer', code: 'invalid_query' }))
    const err = await failure()
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(400)
    expect(err.code).toBe('invalid_query')
  })

  it('carries the code of an internal error', async () => {
    reply(500, JSON.stringify({ error: 'internal error', code: 'internal_error' }))
    const err = await failure()
    expect(err.status).toBe(500)
    expect(err.code).toBe('internal_error')
  })

  it('has no code when the body is not JSON', async () => {
    reply(502, '<html>Bad Gateway</html>')
    const err = await failure()
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(502)
    expect(err.code).toBeUndefined()
  })
})
