// Диалог «Предложить подборку»: форма заявки куратору (docs/requirements.md, R8; макет — practice_08/mockup).
import React, { useEffect, useId, useRef, useState } from 'react'
import { AlertCircleIcon, RotateCwIcon } from 'lucide-react'
import { ApiError, createSuggestion, type Suggestion } from '@/api'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { type FormErrors, type FormValues, emptyForm, fromServer, LIMITS, toInput, validate } from './validation'

export const OCCASIONS = ['ужин', 'завтрак', 'обед', 'пикник', 'праздник', 'перекус']

const FIELD_ORDER: (keyof FormValues)[] = ['title', 'occasion', 'budget', 'comment', 'email']

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (s: Suggestion) => void
  /** Название, подставляемое при открытии: например, запрос, по которому ничего не нашлось. */
  initialTitle?: string
  /** Куда вернуть фокус после закрытия (диалог открыт не через DialogTrigger, Radix сам его не вернёт). */
  returnFocusTo?: React.RefObject<HTMLElement | null>
}

export const SuggestionDialog: React.FC<Props> = ({ open, onOpenChange, onCreated, initialTitle = '', returnFocusTo }) => {
  const [values, setValues] = useState<FormValues>(emptyForm)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [failed, setFailed] = useState(false)
  // Защита от повторной отправки: ref меняется синхронно, поэтому второй submit (двойной клик, Enter)
  // в том же тике видит true, даже если React ещё не перерисовал заблокированную кнопку.
  const inFlight = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)
  const id = useId()

  useEffect(() => {
    if (open) {
      setValues({ ...emptyForm, title: initialTitle })
      setErrors({})
      setFailed(false)
    }
  }, [open, initialTitle])

  const set = (field: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const value = e.target.value
    setValues((v) => ({ ...v, [field]: value }))
    // Исправленное поле больше не подсвечиваем — повторная проверка будет при отправке.
    setErrors((er) => (er[field] ? { ...er, [field]: undefined } : er))
  }

  const focusFirstInvalid = (errs: FormErrors) => {
    const first = FIELD_ORDER.find((f) => errs[f])
    if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus()
  }

  const submit = async () => {
    if (inFlight.current) return
    const errs = validate(values)
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      focusFirstInvalid(errs)
      return
    }
    inFlight.current = true
    setSubmitting(true)
    setFailed(false)
    try {
      const created = await createSuggestion(toInput(values))
      onCreated(created)
    } catch (err) {
      const serverErrs = err instanceof ApiError ? fromServer(err.fields) : {}
      if (Object.keys(serverErrs).length > 0) {
        setErrors(serverErrs)
        // Фокус вернём после разблокировки полей.
        setTimeout(() => focusFirstInvalid(serverErrs))
      } else {
        setFailed(true)
      }
    } finally {
      inFlight.current = false
      setSubmitting(false)
    }
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void submit()
  }

  // Пока заявка уходит, диалог не закрывается: иначе ответ придёт в уже закрытую форму.
  const onOpenChangeSafe = (next: boolean) => {
    if (!next && inFlight.current) return
    onOpenChange(next)
  }

  const fieldProps = (field: keyof FormValues) => ({
    id: `${id}-${field}`,
    name: field,
    value: values[field],
    onChange: set(field),
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': [errors[field] && `${id}-${field}-error`, `${id}-${field}-hint`].filter(Boolean).join(' ') || undefined,
  })

  const error = (field: keyof FormValues) =>
    errors[field] ? <FieldError id={`${id}-${field}-error`}>{errors[field]}</FieldError> : null

  return (
    <Dialog open={open} onOpenChange={onOpenChangeSafe}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 sm:max-w-lg"
        onCloseAutoFocus={(e) => {
          if (returnFocusTo?.current) {
            e.preventDefault()
            returnFocusTo.current.focus()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold tracking-tight">Предложить подборку</DialogTitle>
          <DialogDescription>Расскажите, что хотелось бы найти в каталоге. Поля со звёздочкой обязательны.</DialogDescription>
        </DialogHeader>

        <form ref={formRef} noValidate onSubmit={onSubmit} aria-busy={submitting}>
          <fieldset disabled={submitting} className="contents">
            <FieldGroup className="gap-4">
              <Field data-invalid={!!errors.title}>
                <FieldLabel htmlFor={`${id}-title`}>Название подборки <span aria-hidden="true" className="text-destructive">*</span></FieldLabel>
                <Input {...fieldProps('title')} required autoComplete="off" placeholder="Например, Завтрак с сырниками" maxLength={LIMITS.titleMax + 20} />
                {error('title')}
                {!errors.title && <FieldDescription id={`${id}-title-hint`}>От 3 до 80 символов</FieldDescription>}
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={!!errors.occasion}>
                  <FieldLabel htmlFor={`${id}-occasion`}>Повод</FieldLabel>
                  <NativeSelect {...fieldProps('occasion')} className="w-full">
                    <NativeSelectOption value="">без повода</NativeSelectOption>
                    {OCCASIONS.map((o) => <NativeSelectOption key={o} value={o}>{o}</NativeSelectOption>)}
                  </NativeSelect>
                  {error('occasion')}
                </Field>
                <Field data-invalid={!!errors.budget}>
                  <FieldLabel htmlFor={`${id}-budget`}>Бюджет, ₽ <span aria-hidden="true" className="text-destructive">*</span></FieldLabel>
                  <Input {...fieldProps('budget')} required inputMode="numeric" autoComplete="off" placeholder="Например, 1500" />
                  {error('budget')}
                  {!errors.budget && <FieldDescription id={`${id}-budget-hint`}>От 300 до 20 000 ₽</FieldDescription>}
                </Field>
              </div>

              <Field data-invalid={!!errors.comment}>
                <FieldLabel htmlFor={`${id}-comment`}>Что должно войти</FieldLabel>
                <Textarea {...fieldProps('comment')} rows={3} placeholder="Продукты, пожелания или детали" />
                {error('comment') ?? (
                  <FieldDescription id={`${id}-comment-hint`} className="flex justify-between gap-2">
                    <span>До 500 символов</span>
                    <span className="tabular-nums" aria-live="polite">{[...values.comment].length}/{LIMITS.commentMax}</span>
                  </FieldDescription>
                )}
              </Field>

              <Field data-invalid={!!errors.email}>
                <FieldLabel htmlFor={`${id}-email`}>Почта для ответа</FieldLabel>
                <Input {...fieldProps('email')} type="email" autoComplete="email" placeholder="name@example.ru" />
                {error('email')}
                {!errors.email && <FieldDescription id={`${id}-email-hint`}>Напишем, когда подборка появится</FieldDescription>}
              </Field>

              {failed && (
                <Alert variant="destructive">
                  <AlertCircleIcon aria-hidden="true" />
                  <AlertTitle>Не удалось отправить заявку</AlertTitle>
                  <AlertDescription>
                    <p>Сервер не ответил. Введённые данные сохранены — попробуйте ещё раз.</p>
                    <Button type="submit" variant="outline" size="sm" className="mt-2">
                      <RotateCwIcon data-icon="inline-start" aria-hidden="true" /> Повторить
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            </FieldGroup>

            <DialogFooter className="-mx-6 -mb-6 mt-6 px-6">
              <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChangeSafe(false)}>Отмена</Button>
              <Button type="submit" size="lg" disabled={submitting}>
                {submitting ? <><Spinner data-icon="inline-start" aria-hidden="true" /> Отправляем…</> : 'Отправить заявку'}
              </Button>
            </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  )
}
