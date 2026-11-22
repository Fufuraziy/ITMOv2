// Раздел «Заявки куратору»: видимое поведение интерфейса при подменённых ответах сервера (R8).
// Каждый тест — действие пользователя → ожидаемый результат на экране (см. practice_08/docs/test-plan.md).
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toaster } from '@/components/ui/sonner'
import { SuggestionsPage } from './SuggestionsPage'
import {
  created, deferred, duplicate, internal, invalid, list, mockServer, posts, suggestion,
} from '@/test/server'

const renderPage = () => {
  const user = userEvent.setup()
  render(<><SuggestionsPage /><Toaster /></>)
  return user
}

const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  // Первая кнопка — в шапке раздела; вторая появляется в пустом состоянии.
  await user.click((await screen.findAllByRole('button', { name: 'Предложить подборку' }))[0])
  return screen.findByRole('dialog', { name: 'Предложить подборку' })
}

/** Заполняет форму как пользователь: только то, что передано. */
const fill = async (user: ReturnType<typeof userEvent.setup>, v: { title?: string; occasion?: string; budget?: string; comment?: string; email?: string }) => {
  if (v.title !== undefined) await user.type(screen.getByLabelText(/Название подборки/), v.title)
  if (v.occasion !== undefined) await user.selectOptions(screen.getByLabelText('Повод'), v.occasion)
  if (v.budget !== undefined) await user.type(screen.getByLabelText(/Бюджет/), v.budget)
  if (v.comment !== undefined) await user.type(screen.getByLabelText('Что должно войти'), v.comment)
  if (v.email !== undefined) await user.type(screen.getByLabelText('Почта для ответа'), v.email)
}

const submitButton = () => screen.getByRole('button', { name: /Отправить заявку|Отправляем/ })

beforeEach(() => window.history.replaceState(null, '', '/'))

describe('Список заявок', () => {
  it('показывает заявки карточками: название, повод, бюджет, комментарий, дата и статус', async () => {
    mockServer({ list: () => list([suggestion(), suggestion({ id: 2, title: 'Перекус в офис', occasion: '', comment: '', budget: 2000 })]) })
    renderPage()

    const card = await screen.findByRole('article', { name: 'Пикник на шестерых' })
    expect(within(card).getByText('пикник')).toBeTruthy()
    expect(within(card).getByText('до 4 000 ₽')).toBeTruthy()
    expect(within(card).getByText('Без мангала, всё готовое')).toBeTruthy()
    expect(within(card).getByText('20 ноября')).toBeTruthy()
    expect(within(card).getByText('на рассмотрении')).toBeTruthy()

    const plain = screen.getByRole('article', { name: 'Перекус в офис' })
    expect(within(plain).getByText('без повода')).toBeTruthy()
    expect(within(plain).getByText('Без комментария')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Заявки · 2' })).toBeTruthy()
  })

  it('пока список грузится, показывает скелетоны и сообщение для экранного диктора', async () => {
    const answer = deferred()
    mockServer({ list: () => answer.promise })
    renderPage()

    expect(screen.getByText('Загружаем заявки…')).toBeTruthy()
    expect(screen.getByTestId('suggestions-skeleton')).toBeTruthy()

    answer.resolve(list([suggestion()]))
    expect(await screen.findByRole('article', { name: 'Пикник на шестерых' })).toBeTruthy()
    expect(screen.queryByText('Загружаем заявки…')).toBeNull()
  })

  it('пустой ответ: «Заявок пока нет» и кнопка, которая открывает форму', async () => {
    mockServer({ list: () => list([]) })
    const user = renderPage()

    expect(await screen.findByRole('heading', { name: 'Заявок пока нет' })).toBeTruthy()
    const buttons = screen.getAllByRole('button', { name: 'Предложить подборку' })
    expect(buttons).toHaveLength(2)
    await user.click(buttons[1])
    expect(await screen.findByRole('dialog', { name: 'Предложить подборку' })).toBeTruthy()
  })

  it('ошибка загрузки: понятное сообщение и «Повторить», который загружает список заново', async () => {
    let calls = 0
    mockServer({ list: () => (++calls === 1 ? internal() : list([suggestion()])) })
    const user = renderPage()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Не удалось загрузить заявки')
    await user.click(within(alert).getByRole('button', { name: 'Повторить' }))

    expect(await screen.findByRole('article', { name: 'Пикник на шестерых' })).toBeTruthy()
    expect(screen.queryByText('Не удалось загрузить заявки')).toBeNull()
  })
})

describe('Диалог', () => {
  it('открывается кнопкой: заголовок и поля с видимыми подписями', async () => {
    mockServer()
    const user = renderPage()
    const dialog = await openDialog(user)

    for (const label of [/Название подборки/, 'Повод', /Бюджет, ₽/, 'Что должно войти', 'Почта для ответа']) {
      expect(within(dialog).getByLabelText(label)).toBeTruthy()
    }
    expect((within(dialog).getByLabelText('Повод') as HTMLSelectElement).value).toBe('')
    expect(within(dialog).getByRole('option', { name: 'без повода' })).toBeTruthy()
    // Фокус переходит в диалог — первое поле формы.
    await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByLabelText(/Название подборки/)))
  })

  it('закрывается кнопкой «Отмена», крестиком и Escape; фокус возвращается на кнопку', async () => {
    mockServer()
    const user = renderPage()

    await openDialog(user)
    await user.click(screen.getByRole('button', { name: 'Отмена' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(screen.getAllByRole('button', { name: 'Предложить подборку' })[0]))

    await openDialog(user)
    await user.click(screen.getByRole('button', { name: 'Закрыть' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    await openDialog(user)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('введённый текст виден в полях и не теряется при выборе повода', async () => {
    mockServer()
    const user = renderPage()
    await openDialog(user)

    await fill(user, { title: 'Ужин на двоих', occasion: 'ужин', budget: '1500', comment: 'паста', email: 'anna@example.ru' })

    expect((screen.getByLabelText(/Название подборки/) as HTMLInputElement).value).toBe('Ужин на двоих')
    expect((screen.getByLabelText('Повод') as HTMLSelectElement).value).toBe('ужин')
    expect((screen.getByLabelText(/Бюджет/) as HTMLInputElement).value).toBe('1500')
    expect((screen.getByLabelText('Что должно войти') as HTMLTextAreaElement).value).toBe('паста')
    expect((screen.getByLabelText('Почта для ответа') as HTMLInputElement).value).toBe('anna@example.ru')
  })

  it('после закрытия и повторного открытия форма снова пустая', async () => {
    mockServer()
    const user = renderPage()
    await openDialog(user)
    await fill(user, { title: 'Черновик' })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    await openDialog(user)
    expect((screen.getByLabelText(/Название подборки/) as HTMLInputElement).value).toBe('')
  })
})

describe('Валидация формы', () => {
  it('пустая форма: ошибки обязательных полей, запрос не уходит, фокус на первом неверном поле', async () => {
    const fetchMock = mockServer()
    const user = renderPage()
    await openDialog(user)

    await user.click(submitButton())

    expect(screen.getByText('Назовите подборку')).toBeTruthy()
    expect(screen.getByText('Укажите бюджет')).toBeTruthy()
    const title = screen.getByLabelText(/Название подборки/)
    expect(title.getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById(title.getAttribute('aria-describedby')!.split(' ')[0])?.textContent).toBe('Назовите подборку')
    expect(document.activeElement).toBe(title)
    expect(posts(fetchMock)).toHaveLength(0)
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it.each([
    ['короткое название', { title: 'Уж', budget: '1500' }, 'Название — хотя бы 3 символа'],
    ['отрицательный бюджет', { title: 'Ужин', budget: '-50' }, 'Бюджет — от 300 до 20 000 ₽'],
    ['бюджет больше 20 000', { title: 'Ужин', budget: '25000' }, 'Бюджет — от 300 до 20 000 ₽'],
    ['бюджет не число', { title: 'Ужин', budget: 'много' }, 'Бюджет — целое число рублей, например 1500'],
    ['дробный бюджет', { title: 'Ужин', budget: '1500.5' }, 'Бюджет — целое число рублей, например 1500'],
    ['почта без домена', { title: 'Ужин', budget: '1500', email: 'anna@' }, 'Проверьте почту: нужен адрес вида name@example.ru'],
  ])('некорректный ввод (%s): сообщение под полем, запрос не уходит', async (_, values, message) => {
    const fetchMock = mockServer()
    const user = renderPage()
    await openDialog(user)

    await fill(user, values)
    await user.click(submitButton())

    expect(screen.getByText(message)).toBeTruthy()
    expect(posts(fetchMock)).toHaveLength(0)
  })

  it('подсказка бюджета скрыта, пока под полем ошибка; ошибка уходит, когда поле исправляют', async () => {
    mockServer()
    const user = renderPage()
    await openDialog(user)
    expect(screen.getByText('От 300 до 20 000 ₽')).toBeTruthy()

    await fill(user, { title: 'Ужин', budget: '-50' })
    await user.click(submitButton())
    expect(screen.getByText('Бюджет — от 300 до 20 000 ₽')).toBeTruthy()
    expect(screen.queryByText('От 300 до 20 000 ₽')).toBeNull()

    await user.clear(screen.getByLabelText(/Бюджет/))
    await user.type(screen.getByLabelText(/Бюджет/), '900')
    expect(screen.queryByText('Бюджет — от 300 до 20 000 ₽')).toBeNull()
    expect(screen.getByLabelText(/Бюджет/).getAttribute('aria-invalid')).toBeNull()
  })

  it('ошибки полей от сервера (400) показываются под полями, данные остаются', async () => {
    mockServer({ create: () => invalid({ email: 'invalid' }) })
    const user = renderPage()
    await openDialog(user)

    await fill(user, { title: 'Ужин на двоих', budget: '1500', email: 'a@b.c' })
    await user.click(submitButton())

    expect(await screen.findByText('Проверьте почту: нужен адрес вида name@example.ru')).toBeTruthy()
    expect((screen.getByLabelText(/Название подборки/) as HTMLInputElement).value).toBe('Ужин на двоих')
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('дубль (409): сообщение под названием, после исправления заявка отправляется', async () => {
    let calls = 0
    mockServer({ create: (input) => (++calls === 1 ? duplicate() : created(input)) })
    const user = renderPage()
    await openDialog(user)

    await fill(user, { title: 'Пикник на шестерых', budget: '4000' })
    await user.click(submitButton())
    expect(await screen.findByText('Такая заявка уже есть — назовите подборку иначе')).toBeTruthy()

    await user.type(screen.getByLabelText(/Название подборки/), ' у реки')
    await user.click(submitButton())
    expect(await screen.findByRole('article', { name: 'Пикник на шестерых у реки' })).toBeTruthy()
  })
})

describe('Отправка: загрузка, ошибка, повторная отправка', () => {
  it('пока сервер отвечает: «Отправляем…», кнопки и поля заблокированы, введённое видно', async () => {
    const answer = deferred()
    mockServer({ create: () => answer.promise })
    const user = renderPage()
    await openDialog(user)
    await fill(user, { title: 'Ужин на двоих', budget: '1500' })

    await user.click(submitButton())

    const busy = screen.getByRole('button', { name: 'Отправляем…' }) as HTMLButtonElement
    expect(busy.disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Отмена' }) as HTMLButtonElement).disabled).toBe(true)
    const title = screen.getByLabelText(/Название подборки/) as HTMLInputElement
    expect(title.matches(':disabled')).toBe(true) // поля заблокированы через <fieldset disabled>
    expect(title.value).toBe('Ужин на двоих')

    answer.resolve(created({ title: 'Ужин на двоих', occasion: '', budget: 1500, comment: '', email: '' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('двойной клик и Enter во время ожидания не создают второй запрос', async () => {
    const answer = deferred()
    const fetchMock = mockServer({ create: () => answer.promise })
    const user = renderPage()
    await openDialog(user)
    await fill(user, { title: 'Ужин на двоих', budget: '1500' })

    await user.dblClick(submitButton())
    await user.click(submitButton())
    // Enter в поле во время ожидания: форма заблокирована, отправки нет.
    screen.getByLabelText(/Бюджет/).focus()
    await user.keyboard('{Enter}')

    expect(posts(fetchMock)).toHaveLength(1)

    answer.resolve(created({ title: 'Ужин на двоих', occasion: '', budget: 1500, comment: '', email: '' }))
    expect(await screen.findByRole('article', { name: 'Ужин на двоих' })).toBeTruthy()
    expect(posts(fetchMock)).toHaveLength(1)
    expect(screen.getAllByRole('article')).toHaveLength(1)
  })

  it('два submit подряд в одном тике (быстрый Enter) — один запрос', async () => {
    const answer = deferred()
    const fetchMock = mockServer({ create: () => answer.promise })
    const user = renderPage()
    await openDialog(user)
    await fill(user, { title: 'Ужин на двоих', budget: '1500' })

    // Без await между событиями React не успевает перерисовать кнопку disabled — держит только защита в обработчике.
    const form = submitButton().closest('form')!
    form.requestSubmit()
    form.requestSubmit()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Отправляем…' })).toBeTruthy())

    expect(posts(fetchMock)).toHaveLength(1)
    answer.resolve(created({ title: 'Ужин на двоих', occasion: '', budget: 1500, comment: '', email: '' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('ошибка сервера (500): сообщение с «Повторить», данные сохранены, повтор отправляет и добавляет заявку', async () => {
    let calls = 0
    const fetchMock = mockServer({ create: (input) => (++calls === 1 ? internal() : created(input)) })
    const user = renderPage()
    await openDialog(user)
    await fill(user, { title: 'Ужин на двоих', budget: '1500', comment: 'паста' })

    await user.click(submitButton())

    const alert = await screen.findByText('Не удалось отправить заявку')
    expect(alert).toBeTruthy()
    expect((screen.getByLabelText(/Название подборки/) as HTMLInputElement).value).toBe('Ужин на двоих')
    expect((screen.getByLabelText('Что должно войти') as HTMLTextAreaElement).value).toBe('паста')

    await user.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(await screen.findByRole('article', { name: 'Ужин на двоих' })).toBeTruthy()
    expect(posts(fetchMock)).toHaveLength(2)
    expect(posts(fetchMock)[1]).toEqual(posts(fetchMock)[0])
  })

  it('сеть недоступна: то же сообщение об ошибке, диалог не закрывается', async () => {
    mockServer({ create: () => 'network-error' })
    const user = renderPage()
    await openDialog(user)
    await fill(user, { title: 'Ужин на двоих', budget: '1500' })

    await user.click(submitButton())

    expect(await screen.findByText('Не удалось отправить заявку')).toBeTruthy()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(submitButton().textContent).toContain('Отправить заявку')
  })
})

describe('Успешная отправка', () => {
  it('диалог закрывается, уведомление «Заявка отправлена», новая карточка первой с пометкой «новая»', async () => {
    const fetchMock = mockServer({ list: () => list([suggestion()]) })
    const user = renderPage()
    await screen.findByRole('article', { name: 'Пикник на шестерых' })
    await openDialog(user)

    await fill(user, { title: '  Ужин на двоих ', occasion: 'ужин', budget: '1 500', comment: 'паста', email: 'anna@example.ru' })
    await user.click(submitButton())

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // sonner дублирует текст уведомления в aria-live-регионе, поэтому findAll.
    expect((await screen.findAllByText('Заявка отправлена')).length).toBeGreaterThan(0)
    const cards = screen.getAllByRole('article')
    expect(cards.map((c) => c.getAttribute('aria-label'))).toEqual(['Ужин на двоих', 'Пикник на шестерых'])
    expect(within(cards[0]).getByText('новая')).toBeTruthy()
    expect(within(cards[0]).getByText('до 1 500 ₽')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Заявки · 2' })).toBeTruthy()
    // Тело запроса — как ждёт API: обрезанные строки и бюджет числом.
    expect(posts(fetchMock)).toEqual([{ title: 'Ужин на двоих', occasion: 'ужин', budget: 1500, comment: 'паста', email: 'anna@example.ru' }])
  })
})
