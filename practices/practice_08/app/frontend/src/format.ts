// Форматирование чисел и слов для интерфейса.

/** 1111 → «1 111 ₽»: обычные пробелы, перенос запрещает CSS. */
export const rub = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₽`

/** 0.5 → «0,5». */
export const qty = (n: number) => String(n).replace('.', ',')

export const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

/** «2026-10-06» → «6 октября 2026». */
export const priceDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).replace(/ г\.$/, '')
