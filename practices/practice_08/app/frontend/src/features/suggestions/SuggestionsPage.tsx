// Раздел «Заявки куратору»: список заявок и кнопка «Предложить подборку» (R8; макет — practice_08/mockup).
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircleIcon, InboxIcon, PlusIcon, RotateCwIcon } from 'lucide-react'
import { toast } from 'sonner'
import { listSuggestions, type Suggestion } from '@/api'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { rub } from '@/format'
import { cn } from '@/lib/utils'
import { SuggestionDialog } from './SuggestionDialog'

type ListState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; items: Suggestion[] }

const createdDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })

type Props = {
  /** Открыть диалог сразу с этим названием (переход из пустого поиска). */
  draftTitle?: string | null
  onDraftConsumed?: () => void
}

export const SuggestionsPage: React.FC<Props> = ({ draftTitle = null, onDraftConsumed }) => {
  const [state, setState] = useState<ListState>({ kind: 'loading' })
  const [open, setOpen] = useState(false)
  const [initialTitle, setInitialTitle] = useState('')
  const [freshId, setFreshId] = useState<number | null>(null)
  const openButton = useRef<HTMLButtonElement>(null)

  const load = useCallback((signal?: AbortSignal) => {
    setState({ kind: 'loading' })
    listSuggestions(signal)
      .then((r) => setState({ kind: 'ready', items: r.suggestions }))
      .catch((err) => { if (err?.name !== 'AbortError') setState({ kind: 'error' }) })
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    load(ctrl.signal)
    return () => ctrl.abort()
  }, [load])

  useEffect(() => {
    if (draftTitle !== null) {
      setInitialTitle(draftTitle)
      setOpen(true)
      onDraftConsumed?.()
    }
  }, [draftTitle, onDraftConsumed])

  const openDialog = () => {
    setInitialTitle('')
    setOpen(true)
  }

  const onCreated = (s: Suggestion) => {
    setOpen(false)
    setFreshId(s.id)
    // Новая заявка — первой, как отдаёт GET /suggestions; повторно список не грузим.
    setState((st) => ({ kind: 'ready', items: [s, ...(st.kind === 'ready' ? st.items.filter((i) => i.id !== s.id) : [])] }))
    toast.success('Заявка отправлена', { description: `«${s.title}» — куратор посмотрит её в ближайшие дни.` })
  }

  return (
    <section aria-labelledby="suggestions-title" className="flex flex-col gap-8">
      <div className="-mx-4 -mt-10 flex flex-wrap items-center justify-between gap-6 border-b border-border bg-muted/60 px-4 py-12 sm:-mx-6 sm:px-6">
        <div className="flex max-w-2xl flex-col gap-2">
          <h1 id="suggestions-title" className="text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">
            Не нашли нужную подборку?
          </h1>
          <p className="text-muted-foreground">
            Расскажите куратору, под какой повод и бюджет её собрать. Заявка появится в списке сразу после отправки.
          </p>
        </div>
        <Button ref={openButton} size="lg" onClick={openDialog}>
          <PlusIcon data-icon="inline-start" aria-hidden="true" /> Предложить подборку
        </Button>
      </div>

      <div aria-live="polite" aria-busy={state.kind === 'loading'} className="flex flex-col gap-4">
        {state.kind === 'loading' && (
          <>
            <p className="sr-only">Загружаем заявки…</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="suggestions-skeleton">
              {[0, 1, 2].map((i) => (
                <Card key={i} aria-hidden="true">
                  <CardHeader><Skeleton className="h-5 w-24" /><Skeleton className="mt-2 h-6 w-3/4" /></CardHeader>
                  <CardContent><Skeleton className="h-4 w-full" /></CardContent>
                  <CardFooter><Skeleton className="h-5 w-20" /></CardFooter>
                </Card>
              ))}
            </div>
          </>
        )}

        {state.kind === 'error' && (
          <Alert variant="destructive" className="max-w-xl">
            <AlertCircleIcon aria-hidden="true" />
            <AlertTitle>Не удалось загрузить заявки</AlertTitle>
            <AlertDescription>
              <p>Сервер не отвечает. Проверьте соединение и попробуйте ещё раз.</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => load()}>
                <RotateCwIcon data-icon="inline-start" aria-hidden="true" /> Повторить
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {state.kind === 'ready' && state.items.length === 0 && (
          <Card className="items-center py-10 text-center">
            <CardContent className="flex flex-col items-center gap-3">
              <InboxIcon className="size-8 text-muted-foreground" aria-hidden="true" />
              <h2 className="text-lg font-bold">Заявок пока нет</h2>
              <p className="max-w-sm text-muted-foreground">Станьте первым: опишите повод и бюджет, а куратор соберёт подборку.</p>
              <Button variant="outline" onClick={openDialog}>Предложить подборку</Button>
            </CardContent>
          </Card>
        )}

        {state.kind === 'ready' && state.items.length > 0 && (
          <>
            <h2 className="text-2xl font-bold tracking-tight">Заявки <span className="font-normal text-muted-foreground">· {state.items.length}</span></h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Заявки куратору">
              {state.items.map((s) => (
                <li key={s.id}>
                  <SuggestionCard s={s} fresh={s.id === freshId} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <SuggestionDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={onCreated}
        initialTitle={initialTitle}
        returnFocusTo={openButton}
      />
    </section>
  )
}

const SuggestionCard: React.FC<{ s: Suggestion; fresh: boolean }> = ({ s, fresh }) => (
  <Card
    aria-label={s.title}
    role="article"
    className={cn('h-full gap-3', fresh && 'ring-2 ring-primary')}
  >
    <CardHeader className="gap-3">
      <Badge variant={s.occasion ? 'secondary' : 'outline'}>{s.occasion || 'без повода'}</Badge>
      <CardTitle className="text-lg font-bold">{s.title}</CardTitle>
      <p className="text-sm">
        <span className="text-muted-foreground">Бюджет</span>{' '}
        <span className="font-bold tabular-nums">до {rub(s.budget)}</span>
      </p>
    </CardHeader>
    <CardContent className="flex-1">
      <p className="line-clamp-3 text-sm text-muted-foreground">{s.comment || 'Без комментария'}</p>
    </CardContent>
    <CardFooter className="justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-warning" aria-hidden="true" />
        на рассмотрении
      </span>
      <span className="flex items-center gap-2">
        {fresh && <Badge variant="secondary">новая</Badge>}
        <time dateTime={s.created_at}>{createdDate(s.created_at)}</time>
      </span>
    </CardFooter>
  </Card>
)
