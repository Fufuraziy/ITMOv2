// Проверка формы заявки на клиенте — те же правила, что у сервера (docs/requirements.md, R8).
import type { FieldErrors, SuggestionInput } from '@/api'

/** Значения полей формы как их ввёл пользователь: бюджет — строка из поля ввода. */
export type FormValues = {
  title: string
  occasion: string
  budget: string
  comment: string
  email: string
}

export type FormErrors = Partial<Record<keyof FormValues, string>>

export const emptyForm: FormValues = { title: '', occasion: '', budget: '', comment: '', email: '' }

export const LIMITS = { titleMin: 3, titleMax: 80, budgetMin: 300, budgetMax: 20000, occasionMax: 40, commentMax: 500 }

/** Текст для пользователя по полю и машинной причине — и для клиентской проверки, и для ответа сервера. */
const MESSAGES: Record<keyof FormValues, Record<string, string>> = {
  title: {
    required: 'Назовите подборку',
    too_short: `Название — хотя бы ${LIMITS.titleMin} символа`,
    too_long: `Название — не длиннее ${LIMITS.titleMax} символов`,
    duplicate: 'Такая заявка уже есть — назовите подборку иначе',
  },
  budget: {
    required: 'Укажите бюджет',
    invalid: 'Бюджет — целое число рублей, например 1500',
    out_of_range: 'Бюджет — от 300 до 20 000 ₽',
  },
  occasion: { too_long: `Повод — не длиннее ${LIMITS.occasionMax} символов` },
  comment: { too_long: `Не больше ${LIMITS.commentMax} символов` },
  email: { invalid: 'Проверьте почту: нужен адрес вида name@example.ru' },
}

export function messageFor(field: keyof FormValues, reason: string): string {
  return MESSAGES[field]?.[reason] ?? 'Проверьте это поле'
}

/** Ошибки сервера (`fields` из ответа 400/409) → тексты для полей формы. */
export function fromServer(fields: FieldErrors): FormErrors {
  const out: FormErrors = {}
  for (const [field, reason] of Object.entries(fields)) {
    if (field in MESSAGES && typeof reason === 'string') out[field as keyof FormValues] = messageFor(field as keyof FormValues, reason)
  }
  return out
}

const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function validate(v: FormValues): FormErrors {
  const errors: FormErrors = {}
  const title = v.title.trim()
  const titleLen = [...title].length
  if (titleLen === 0) errors.title = messageFor('title', 'required')
  else if (titleLen < LIMITS.titleMin) errors.title = messageFor('title', 'too_short')
  else if (titleLen > LIMITS.titleMax) errors.title = messageFor('title', 'too_long')

  const budget = v.budget.replace(/\s/g, '')
  if (budget === '') errors.budget = messageFor('budget', 'required')
  else if (!/^-?\d+$/.test(budget)) errors.budget = messageFor('budget', 'invalid')
  else if (Number(budget) < LIMITS.budgetMin || Number(budget) > LIMITS.budgetMax) errors.budget = messageFor('budget', 'out_of_range')

  if ([...v.occasion.trim()].length > LIMITS.occasionMax) errors.occasion = messageFor('occasion', 'too_long')
  if ([...v.comment.trim()].length > LIMITS.commentMax) errors.comment = messageFor('comment', 'too_long')
  if (v.email.trim() !== '' && !emailRe.test(v.email.trim())) errors.email = messageFor('email', 'invalid')
  return errors
}

/** Проверенные значения → тело запроса POST /suggestions. */
export function toInput(v: FormValues): SuggestionInput {
  return {
    title: v.title.trim(),
    occasion: v.occasion.trim(),
    budget: Number(v.budget.replace(/\s/g, '')),
    comment: v.comment.trim(),
    email: v.email.trim(),
  }
}
