import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { App } from './App'
import { render } from './test-utils'

const breakfast = {
  id: 'zavtrak-s-syrnikami',
  title: 'Завтрак с сырниками',
  description: 'Сырники со сметаной и вареньем',
  tags: ['завтрак', 'быстро'],
  cart_url: 'https://vkusvill.ru/?share_basket=3549115194',
  total_price: 1111,
  products: [
    { xml_id: 114976, name: 'Сырники классические жареные', quantity: 1, unit: 'шт', price: 306, rating: 4.9,
      url: 'https://vkusvill.ru/goods/syrniki-114976/', image: 'https://img.vkusvill.ru/a.webp' },
    { xml_id: 3001, name: 'Лук репчатый', quantity: 0.5, unit: 'кг', price: 54, rating: 4.8,
      url: 'https://vkusvill.ru/goods/luk-3001/', image: 'https://img.vkusvill.ru/b.webp' },
  ],
}

type Reply = { status?: number; body: unknown }

function mockApi(collections: (url: URL) => Reply) {
  const fetchMock = vi.fn(async (input: string) => {
    const url = new URL(input, 'http://localhost')
    const reply = url.pathname === '/tags'
      ? { body: [{ tag: 'завтрак', count: 2 }, { tag: 'суп', count: 1 }] }
      : collections(url)
    return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const found = (list: unknown[]) => ({ body: { updated_at: '2026-10-06', total: list.length, collections: list } })
const searches = (fetchMock: ReturnType<typeof mockApi>) =>
  fetchMock.mock.calls.map(([u]) => new URL(u as string, 'http://localhost')).filter((u) => u.pathname === '/collections')

beforeEach(() => window.history.replaceState(null, '', '/'))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('App', () => {
  it('renders heading', () => {
    mockApi(() => found([]))
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'Что приготовим?' })).toBeTruthy()
  })

  it('shows collections with total price, price date and a cart link', async () => {
    mockApi(() => found([breakfast]))
    render(<App />)

    const row = await screen.findByRole('article', { name: 'Завтрак с сырниками' })
    expect(within(row).getByText('≈ 1 111 ₽')).toBeTruthy()
    const cart = within(row).getByRole('link', { name: 'Перенести в корзину ВкусВилла' })
    expect(cart.getAttribute('href')).toBe('https://vkusvill.ru/?share_basket=3549115194')
    expect(cart.getAttribute('target')).toBe('_blank')
    expect(screen.getByText(/Цены на 6 октября 2026/)).toBeTruthy()
  })

  it('opens the receipt with quantities and product links', async () => {
    mockApi(() => found([breakfast]))
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Состав: 2 товара' }))

    const receipt = screen.getByRole('list', { name: 'Состав подборки «Завтрак с сырниками»' })
    expect(within(receipt).getByRole('link', { name: 'Лук репчатый' }).getAttribute('href'))
      .toBe('https://vkusvill.ru/goods/luk-3001/')
    expect(within(receipt).getByText('0,5 кг × 54 ₽')).toBeTruthy()
  })

  it('searches by text, tag and budget and keeps them in the URL', async () => {
    const fetchMock = mockApi(() => found([breakfast]))
    render(<App />)

    fireEvent.change(screen.getByRole('searchbox', { name: 'Что приготовим?' }), { target: { value: 'сырники' } })
    fireEvent.click(await screen.findByRole('button', { name: 'завтрак 2' }))
    fireEvent.click(screen.getByRole('button', { name: 'до 1 000 ₽' }))

    await waitFor(() => {
      const last = searches(fetchMock).at(-1)!
      expect(last.searchParams.get('q')).toBe('сырники')
      expect(last.searchParams.get('tag')).toBe('завтрак')
      expect(last.searchParams.get('max_price')).toBe('1000')
    })
    expect(screen.getByRole('button', { name: 'завтрак 2' }).getAttribute('aria-pressed')).toBe('true')
    expect(new URLSearchParams(window.location.search).get('q')).toBe('сырники')
  })

  it('shows ten most popular tags and hides the rest behind a toggle', async () => {
    const many = Array.from({ length: 13 }, (_, i) => ({ tag: `тег${i + 1}`, count: 20 - i }))
    vi.stubGlobal('fetch', vi.fn(async (input: string) => new Response(JSON.stringify(
      input.startsWith('/tags') ? many : found([]).body))))
    window.history.replaceState(null, '', '/?tag=%D1%82%D0%B5%D0%B312') // tag=тег12
    render(<App />)

    const group = await screen.findByRole('group', { name: 'Повод' })
    // 10 популярных + выбранный по адресу тег12 + кнопка «ещё»
    await waitFor(() => expect(within(group).getAllByRole('button').length).toBe(12))
    expect(within(group).getByRole('button', { name: 'тег12 9' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(group).queryByRole('button', { name: 'тег13 8' })).toBeNull()

    fireEvent.click(within(group).getByRole('button', { name: 'ещё 2' }))
    expect(within(group).getByRole('button', { name: 'тег13 8' })).toBeTruthy()
  })

  it('restores the search from the URL', async () => {
    window.history.replaceState(null, '', '/?q=%D1%81%D1%83%D0%BF&sort=price_asc')
    const fetchMock = mockApi(() => found([]))
    render(<App />)

    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('суп')
    await waitFor(() => {
      const first = searches(fetchMock)[0]
      expect(first.searchParams.get('q')).toBe('суп')
      expect(first.searchParams.get('sort')).toBe('price_asc')
    })
  })

  it('offers to reset filters when nothing is found', async () => {
    window.history.replaceState(null, '', '/?q=pizza')
    const fetchMock = mockApi((url) => found(url.searchParams.get('q') ? [] : [breakfast]))
    render(<App />)

    expect(await screen.findByText('Ничего не нашлось по запросу «pizza».')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Сбросить поиск' }))

    expect(await screen.findByRole('article', { name: 'Завтрак с сырниками' })).toBeTruthy()
    expect(searches(fetchMock).at(-1)!.search).toBe('')
  })

  it('explains what to do when the backend is down', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    render(<App />)

    expect((await screen.findByRole('alert')).textContent)
      .toContain('Каталог не отвечает. Обновите страницу через минуту.')
  })
})
