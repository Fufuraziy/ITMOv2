// Основной сценарий целиком, на всём приложении: от действия пользователя до видимого результата.
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'
import { list, mockServer, posts, suggestion } from '@/test/server'

beforeEach(() => window.history.replaceState(null, '', '/'))

describe('Основной сценарий: заявка куратору', () => {
  it('вкладка «Заявки куратору» → «Предложить подборку» → форма → отправка → заявка первой в списке', async () => {
    const fetchMock = mockServer({ list: () => list([suggestion()]) })
    const user = userEvent.setup()
    render(<App />)

    // Стартовая вкладка — поиск; пользователь переходит к заявкам.
    expect(screen.getByRole('heading', { level: 1, name: 'Что приготовим?' })).toBeTruthy()
    await user.click(screen.getByRole('tab', { name: 'Заявки куратору' }))
    expect(window.location.hash).toBe('#suggestions')
    expect(await screen.findByRole('article', { name: 'Пикник на шестерых' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Предложить подборку' }))
    const dialog = await screen.findByRole('dialog', { name: 'Предложить подборку' })
    await user.type(within(dialog).getByLabelText(/Название подборки/), 'Борщ на большую кастрюлю')
    await user.selectOptions(within(dialog).getByLabelText('Повод'), 'обед')
    await user.type(within(dialog).getByLabelText(/Бюджет/), '1200')
    await user.type(within(dialog).getByLabelText('Что должно войти'), 'Свёкла, говядина, сметана')
    await user.click(within(dialog).getByRole('button', { name: 'Отправить заявку' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect((await screen.findAllByText('Заявка отправлена')).length).toBeGreaterThan(0)
    const [first, second] = screen.getAllByRole('article')
    expect(first.getAttribute('aria-label')).toBe('Борщ на большую кастрюлю')
    expect(within(first).getByText('обед')).toBeTruthy()
    expect(within(first).getByText('до 1 200 ₽')).toBeTruthy()
    expect(within(first).getByText('Свёкла, говядина, сметана')).toBeTruthy()
    expect(within(first).getByText('новая')).toBeTruthy()
    expect(second.getAttribute('aria-label')).toBe('Пикник на шестерых')
    expect(posts(fetchMock)).toEqual([{ title: 'Борщ на большую кастрюлю', occasion: 'обед', budget: 1200, comment: 'Свёкла, говядина, сметана', email: '' }])
  })

  it('весь сценарий проходится только с клавиатуры', async () => {
    window.history.replaceState(null, '', '/#suggestions')
    const fetchMock = mockServer({ list: () => list([]) })
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { name: 'Заявок пока нет' })

    // Tab по странице до кнопки «Предложить подборку», Enter открывает диалог.
    const open = screen.getAllByRole('button', { name: 'Предложить подборку' })[0]
    while (document.activeElement !== open) await user.tab()
    await user.keyboard('{Enter}')
    await screen.findByRole('dialog')
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText(/Название подборки/)))

    await user.keyboard('Перекус в офис')
    await user.tab() // Повод
    await user.tab() // Бюджет
    await user.keyboard('2000')
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('article', { name: 'Перекус в офис' })).toBeTruthy()
    expect(posts(fetchMock)).toHaveLength(1)
    // Фокус вернулся на кнопку, с которой открывали диалог.
    await waitFor(() => expect(document.activeElement).toBe(screen.getAllByRole('button', { name: 'Предложить подборку' })[0]))
  })

  it('из пустого поиска «Предложить такую подборку» открывает форму с подставленным названием', async () => {
    mockServer()
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByRole('searchbox', { name: 'Что приготовим?' }), 'пицца')
    await user.click(await screen.findByRole('button', { name: 'Предложить такую подборку' }))

    const dialog = await screen.findByRole('dialog', { name: 'Предложить подборку' })
    expect((within(dialog).getByLabelText(/Название подборки/) as HTMLInputElement).value).toBe('пицца')
    // Фон под модальным диалогом скрыт от экранного диктора (aria-hidden), поэтому hidden: true.
    expect(screen.getByRole('tab', { name: 'Заявки куратору', hidden: true }).getAttribute('aria-selected')).toBe('true')
  })
})
