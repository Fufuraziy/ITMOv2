import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { App } from './App'
import { render } from './test-utils'
import { dinner, soup, withVariants } from './fixtures'

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

// Переключатель порций (specs/001-servings-ui, contracts/ui-card.md).
const card = (title: string) => screen.findByRole('article', { name: title })
const servingsOf = (el: HTMLElement) => within(el).getByRole('group', { name: 'Порции' })
const radio = (el: HTMLElement, name: string) => within(servingsOf(el)).getByRole('radio', { name }) as HTMLInputElement
const openReceipt = (el: HTMLElement) => fireEvent.click(within(el).getByRole('button', { name: /^Состав:/ }))
const priceOf = (el: HTMLElement, product: string) =>
  within(el).getByRole('link', { name: product }).closest('li')!.querySelector('.receipt__price')!.textContent

describe('Servings switcher', () => {
  it('shows ×2 totals and quantities from the response without new requests', async () => {
    const fetchMock = mockApi(() => found([dinner]))
    render(<App />)
    const row = await card('Ужин на компанию')

    expect(radio(row, '×1').checked).toBe(true)
    expect(radio(row, '×2').checked).toBe(false)
    expect(radio(row, '×4').checked).toBe(false)
    expect(within(row).getByText('≈ 999 ₽')).toBeTruthy()
    await waitFor(() => expect(searches(fetchMock).length).toBe(1))
    const calls = fetchMock.mock.calls.length

    fireEvent.click(radio(row, '×2'))
    openReceipt(row)

    expect(radio(row, '×2').checked).toBe(true)
    expect(within(row).getByText('≈ 1 332 ₽ · ×2')).toBeTruthy()
    expect(priceOf(row, 'Сырники классические жареные')).toBe('2 шт · было 1 шт × 306 ₽')
    expect(priceOf(row, 'Лук репчатый')).toBe('1 кг · было 0,5 кг × 54 ₽')
    expect(priceOf(row, 'Кофе молотый')).toBe('1 шт × 666 ₽')
    expect(fetchMock.mock.calls.length).toBe(calls)
    expect(window.location.search).toBe('')
  })

  it('returns to ×1 as before the switch', async () => {
    mockApi(() => found([dinner]))
    render(<App />)
    const row = await card('Ужин на компанию')

    fireEvent.click(radio(row, '×2'))
    fireEvent.click(radio(row, '×1'))
    openReceipt(row)

    expect(within(row).getByText('≈ 999 ₽')).toBeTruthy()
    expect(priceOf(row, 'Сырники классические жареные')).toBe('1 шт × 306 ₽')
    expect(priceOf(row, 'Лук репчатый')).toBe('0,5 кг × 54 ₽')
    expect(within(row).queryByText(/было/)).toBeNull()
  })

  it('keeps other collections at ×1', async () => {
    mockApi(() => found([dinner, soup]))
    render(<App />)
    const first = await card('Ужин на компанию')
    const second = await card('Суп на неделю')

    fireEvent.click(radio(first, '×4'))

    expect(radio(first, '×4').checked).toBe(true)
    expect(radio(second, '×1').checked).toBe(true)
    expect(within(second).getByText('≈ 999 ₽')).toBeTruthy()
  })

  it('remembers the choice when a collection leaves the results and comes back', async () => {
    const fetchMock = mockApi((url) => found(url.searchParams.get('q') === 'нет' ? [] : [dinner]))
    render(<App />)
    fireEvent.click(radio(await card('Ужин на компанию'), '×2'))

    const search = screen.getByRole('searchbox', { name: 'Что приготовим?' })
    fireEvent.change(search, { target: { value: 'нет' } })
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Ужин на компанию' })).toBeNull())
    fireEvent.change(search, { target: { value: 'ужин' } })

    expect(radio(await card('Ужин на компанию'), '×2').checked).toBe(true)
    expect(searches(fetchMock).every((u) => !u.searchParams.has('servings'))).toBe(true)
  })

  it('announces the new total', async () => {
    mockApi(() => found([dinner]))
    render(<App />)
    const total = within(await card('Ужин на компанию')).getByText('≈ 999 ₽')

    expect(total.getAttribute('aria-live')).toBe('polite')
    expect(total.getAttribute('aria-atomic')).toBe('true')
  })

  it('marks a total above the chosen budget', async () => {
    mockApi(() => found([dinner]))
    render(<App />)
    const row = await card('Ужин на компанию')

    fireEvent.click(screen.getByRole('button', { name: 'до 1 000 ₽' }))
    expect(within(row).queryByText('больше бюджета')).toBeNull()

    fireEvent.click(radio(row, '×2'))
    expect(within(row).getByText('больше бюджета')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'любой' }))
    fireEvent.click(radio(row, '×4'))
    expect(within(row).queryByText('больше бюджета')).toBeNull()
  })
})

describe('Cart for the chosen servings', () => {
  it('opens the cart link of the chosen variant', async () => {
    mockApi(() => found([dinner]))
    render(<App />)
    const row = await card('Ужин на компанию')
    const cart = () => within(row).getByRole('link', { name: /^Перенести в корзину ВкусВилла/ })

    expect(cart().textContent).toBe('Перенести в корзину ВкусВилла')
    expect(cart().getAttribute('href')).toBe('https://vkusvill.ru/?share_basket=1001')

    fireEvent.click(radio(row, '×2'))
    expect(cart().textContent).toBe('Перенести в корзину ВкусВилла · ×2')
    expect(cart().getAttribute('href')).toBe('https://vkusvill.ru/?share_basket=1002')

    fireEvent.click(radio(row, '×4'))
    expect(cart().textContent).toBe('Перенести в корзину ВкусВилла · ×4')
    expect(cart().getAttribute('href')).toBe('https://vkusvill.ru/?share_basket=1004')
    expect(cart().getAttribute('target')).toBe('_blank')
    expect(cart().getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('keeps ×2 after the cart is opened', async () => {
    mockApi(() => found([dinner]))
    render(<App />)
    const row = await card('Ужин на компанию')

    fireEvent.click(radio(row, '×2'))
    fireEvent.click(within(row).getByRole('link', { name: 'Перенести в корзину ВкусВилла · ×2' }))

    expect(radio(row, '×2').checked).toBe(true)
  })
})

describe('Rollout and unavailable servings', () => {
  const eggs = 'больше 40 шт «Яйцо куриное»'
  const noFour = withVariants(dinner, ([one, two, four]) => [one, two, { ...four, available: false, reason: eggs }])

  it('keeps the old card when the backend sends no or broken variants', async () => {
    const broken = { ...withVariants(dinner, (v) => v.slice(0, 2)), title: 'Ужин без ×4' }
    mockApi(() => found([breakfast, broken]))
    render(<App />)

    const old = await card('Завтрак с сырниками')
    expect(within(old).queryByRole('group', { name: 'Порции' })).toBeNull()
    expect(within(old).getByText('≈ 1 111 ₽')).toBeTruthy()
    expect(within(old).getByRole('link', { name: 'Перенести в корзину ВкусВилла' }).getAttribute('href'))
      .toBe('https://vkusvill.ru/?share_basket=3549115194')

    const partial = await card('Ужин без ×4')
    expect(within(partial).queryByRole('group', { name: 'Порции' })).toBeNull()
    expect(within(partial).getByText('≈ 999 ₽')).toBeTruthy()
    expect(within(partial).getByRole('link', { name: 'Перенести в корзину ВкусВилла' }).getAttribute('href'))
      .toBe('https://vkusvill.ru/?share_basket=1001')
  })

  it('disables an unavailable multiplier and explains why', async () => {
    mockApi(() => found([noFour]))
    render(<App />)
    const row = await card('Ужин на компанию')

    const four = radio(row, '×4')
    expect(four.disabled).toBe(true)
    const describedBy = four.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy!)?.textContent).toBe(eggs)
    expect(radio(row, '×1').disabled).toBe(false)
    expect(radio(row, '×2').disabled).toBe(false)
  })

  it('falls back to ×1 when the chosen multiplier becomes unavailable', async () => {
    mockApi((url) => found([url.searchParams.get('q') ? noFour : dinner]))
    render(<App />)
    fireEvent.click(radio(await card('Ужин на компанию'), '×4'))

    fireEvent.change(screen.getByRole('searchbox', { name: 'Что приготовим?' }), { target: { value: 'ужин' } })
    await waitFor(() => expect(radio(screen.getByRole('article', { name: 'Ужин на компанию' }), '×4').disabled).toBe(true))

    const row = screen.getByRole('article', { name: 'Ужин на компанию' })
    expect(radio(row, '×1').checked).toBe(true)
    expect(within(row).getByText('≈ 999 ₽')).toBeTruthy()
    expect(within(row).getByRole('link', { name: 'Перенести в корзину ВкусВилла' }).getAttribute('href'))
      .toBe('https://vkusvill.ru/?share_basket=1001')
  })
})

describe('Page states', () => {
  it('says it is searching until the first answer arrives', async () => {
    let answer!: (r: Response) => void
    vi.stubGlobal('fetch', vi.fn((input: string) => input.startsWith('/tags')
      ? Promise.resolve(new Response('[]'))
      : new Promise<Response>((resolve) => { answer = resolve })))
    render(<App />)

    expect(screen.getByText('Ищем подборки…')).toBeTruthy()

    answer(new Response(JSON.stringify(found([dinner]).body)))
    await card('Ужин на компанию')
    expect(screen.queryByText('Ищем подборки…')).toBeNull()
  })
})
