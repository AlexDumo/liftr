import {
  createFileRoute,
  redirect,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Plus, Trash } from '@phosphor-icons/react'
import { useEffect, useState, useTransition } from 'react'
import {
  CardioDurationInput,
  CardioMetricInput,
  CardioRateDisplay,
  CardioRateModeSelect,
  CardioUnitLabelInput,
} from '@/components/cardio-input-fields'
import {
  BarWeightInput,
  computeDraftPounds,
  WeightInputFields,
  WeightInputTypeSelect,
  type WeightDraftFields,
} from '@/components/weight-input-fields'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { getSession } from '#/lib/auth-session'
import {
  formatCardioRate,
  type CardioRateMode,
} from '#/lib/cardio-rate'
import {
  formatDurationMmSs,
  parseDurationMmSs,
} from '#/lib/duration-input'
import {
  addSet,
  getWorkoutExercise,
  removeSet,
  updateExerciseCardioPref,
  updateExerciseWeightPref,
  updateSet,
} from '#/lib/workout.functions'
import {
  DEFAULT_BAR_WEIGHT_LBS,
  fromPounds,
  isCardioInputType,
  type WeightInputType,
} from '#/lib/weight-input'

type StrengthSetDraft = {
  id: string
  setIndex: number
  primary: string
  reps: string
}

type CardioSetDraft = {
  id: string
  setIndex: number
  metric: string
  duration: string
}

type LoaderSet = {
  id: string
  setIndex: number
  weight: number | null
  reps: number | null
  metricValue: number | null
  durationSeconds: number | null
}

export const Route = createFileRoute(
  '/workout/$workoutId/exercise/$workoutExerciseId',
)({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session?.user) {
      throw redirect({ to: '/login' })
    }
  },
  loader: async ({ params }) => {
    return getWorkoutExercise({
      data: { workoutExerciseId: params.workoutExerciseId },
    })
  },
  component: ExerciseLoggingPage,
})

function fieldsToStrings(
  fields: ReturnType<typeof fromPounds>,
): WeightDraftFields {
  return {
    primary: fields.primary === null ? '' : String(fields.primary),
  }
}

function toStrengthDraft(
  sets: LoaderSet[],
  inputType: WeightInputType,
  barWeightLbs: number,
  bodyWeightLbs: number | null,
): StrengthSetDraft[] {
  return sets.map((set) => {
    const fields = fieldsToStrings(
      fromPounds(inputType, set.weight, {
        bodyWeightLbs,
        barWeightLbs,
      }),
    )
    return {
      id: set.id,
      setIndex: set.setIndex,
      primary: fields.primary,
      reps: set.reps === null ? '' : String(set.reps),
    }
  })
}

function toCardioDraft(sets: LoaderSet[]): CardioSetDraft[] {
  return sets.map((set) => ({
    id: set.id,
    setIndex: set.setIndex,
    metric: set.metricValue === null ? '' : String(set.metricValue),
    duration: formatDurationMmSs(set.durationSeconds),
  }))
}

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const num = Number(trimmed)
  if (!Number.isFinite(num)) return null
  return Math.round(num)
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const num = Number(trimmed)
  if (!Number.isFinite(num)) return null
  return num
}

function parseBarWeightLbs(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return DEFAULT_BAR_WEIGHT_LBS
  const num = Number(trimmed)
  if (!Number.isFinite(num) || num < 0) return null
  return num
}

function cascadeStrengthDraft(
  prev: StrengthSetDraft[],
  editedIndex: number,
  patch: Partial<Pick<StrengthSetDraft, 'primary' | 'reps'>>,
): StrengthSetDraft[] {
  const current = prev[editedIndex]
  if (!current) return prev

  const source: StrengthSetDraft = { ...current, ...patch }
  return prev.map((item, index) => {
    if (index < editedIndex) return item
    if (index === editedIndex) return source
    return {
      ...item,
      primary: source.primary,
      reps: source.reps,
    }
  })
}

function cascadeCardioDraft(
  prev: CardioSetDraft[],
  editedIndex: number,
  patch: Partial<Pick<CardioSetDraft, 'metric' | 'duration'>>,
): CardioSetDraft[] {
  const current = prev[editedIndex]
  if (!current) return prev

  const source: CardioSetDraft = { ...current, ...patch }
  return prev.map((item, index) => {
    if (index < editedIndex) return item
    if (index === editedIndex) return source
    return {
      ...item,
      metric: source.metric,
      duration: source.duration,
    }
  })
}

function ExerciseLoggingPage() {
  const { workoutId, workoutExerciseId } = Route.useParams()
  const data = Route.useLoaderData()
  const navigate = useNavigate()
  const router = useRouter()

  const updateSetFn = useServerFn(updateSet)
  const addSetFn = useServerFn(addSet)
  const removeSetFn = useServerFn(removeSet)
  const updatePrefFn = useServerFn(updateExerciseWeightPref)
  const updateCardioPrefFn = useServerFn(updateExerciseCardioPref)

  const [inputType, setInputType] = useState<WeightInputType>(
    data.weightInputType,
  )
  const [barWeight, setBarWeight] = useState(String(data.barWeightLbs))
  const [unitLabel, setUnitLabel] = useState(data.cardioUnitLabel)
  const [rateMode, setRateMode] = useState<CardioRateMode>(data.cardioRateMode)
  const [strengthSets, setStrengthSets] = useState<StrengthSetDraft[]>(() =>
    toStrengthDraft(
      data.workoutExercise.sets,
      isCardioInputType(data.weightInputType) ? 'single' : data.weightInputType,
      data.barWeightLbs,
      data.bodyWeightLbs,
    ),
  )
  const [cardioSets, setCardioSets] = useState<CardioSetDraft[]>(() =>
    toCardioDraft(data.workoutExercise.sets),
  )
  const [currentSetIndex, setCurrentSetIndex] = useState(0)
  const [mediaExpanded, setMediaExpanded] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isCardio = isCardioInputType(inputType)
  const resolvedBarWeightLbs =
    parseBarWeightLbs(barWeight) ?? data.barWeightLbs
  const sets = isCardio ? cardioSets : strengthSets
  const metricHeader = unitLabel.trim() || 'Amount'

  useEffect(() => {
    setInputType(data.weightInputType)
    setBarWeight(String(data.barWeightLbs))
    setUnitLabel(data.cardioUnitLabel)
    setRateMode(data.cardioRateMode)
    setStrengthSets(
      toStrengthDraft(
        data.workoutExercise.sets,
        isCardioInputType(data.weightInputType)
          ? 'single'
          : data.weightInputType,
        data.barWeightLbs,
        data.bodyWeightLbs,
      ),
    )
    setCardioSets(toCardioDraft(data.workoutExercise.sets))
    setCurrentSetIndex((i) =>
      Math.min(i, Math.max(0, data.workoutExercise.sets.length - 1)),
    )
  }, [
    data.weightInputType,
    data.barWeightLbs,
    data.bodyWeightLbs,
    data.cardioUnitLabel,
    data.cardioRateMode,
    data.workoutExercise.sets,
  ])

  const persistStrengthSets = (
    drafts: StrengthSetDraft[],
    type: WeightInputType = inputType,
    barLbs = resolvedBarWeightLbs,
  ) => {
    if (drafts.length === 0 || isCardioInputType(type)) return

    const computed = drafts.map((draft) => ({
      draft,
      pounds: computeDraftPounds(
        type,
        { primary: draft.primary },
        data.bodyWeightLbs,
        barLbs,
      ),
    }))

    if (type === 'body' && data.bodyWeightLbs === null) {
      return
    }

    for (const { draft, pounds } of computed) {
      if (draft.primary.trim() !== '' && pounds === null) {
        setError('Invalid weight')
        return
      }

      if (pounds !== null && pounds < 0) {
        setError('Weight cannot be negative')
        return
      }
    }

    startTransition(async () => {
      setError(null)
      try {
        await Promise.all(
          computed.map(({ draft, pounds }) =>
            updateSetFn({
              data: {
                setId: draft.id,
                mode: 'strength',
                weight: pounds,
                reps: parseOptionalInt(draft.reps),
              },
            }),
          ),
        )
      } catch {
        setError('Could not save set')
      }
    })
  }

  const persistCardioSets = (drafts: CardioSetDraft[]) => {
    if (drafts.length === 0) return

    for (const draft of drafts) {
      if (
        draft.metric.trim() !== '' &&
        parseOptionalNumber(draft.metric) === null
      ) {
        setError('Invalid metric value')
        return
      }
      if (
        draft.duration.trim() !== '' &&
        parseDurationMmSs(draft.duration) === null
      ) {
        setError('Invalid time (use mm:ss)')
        return
      }
      const metric = parseOptionalNumber(draft.metric)
      if (metric !== null && metric < 0) {
        setError('Metric cannot be negative')
        return
      }
    }

    startTransition(async () => {
      setError(null)
      try {
        await Promise.all(
          drafts.map((draft) =>
            updateSetFn({
              data: {
                setId: draft.id,
                mode: 'cardio',
                metricValue: parseOptionalNumber(draft.metric),
                durationSeconds: parseDurationMmSs(draft.duration),
              },
            }),
          ),
        )
      } catch {
        setError('Could not save set')
      }
    })
  }

  const applyStrengthCascade = (
    editedIndex: number,
    patch: Partial<Pick<StrengthSetDraft, 'primary' | 'reps'>>,
  ) => {
    setStrengthSets((prev) => cascadeStrengthDraft(prev, editedIndex, patch))
  }

  const cascadeAndPersistStrength = (
    editedIndex: number,
    patch: Partial<Pick<StrengthSetDraft, 'primary' | 'reps'>>,
  ) => {
    const next = cascadeStrengthDraft(strengthSets, editedIndex, patch)
    setStrengthSets(next)
    persistStrengthSets(next.slice(editedIndex))
  }

  const applyCardioCascade = (
    editedIndex: number,
    patch: Partial<Pick<CardioSetDraft, 'metric' | 'duration'>>,
  ) => {
    setCardioSets((prev) => cascadeCardioDraft(prev, editedIndex, patch))
  }

  const cascadeAndPersistCardio = (
    editedIndex: number,
    patch: Partial<Pick<CardioSetDraft, 'metric' | 'duration'>>,
  ) => {
    const next = cascadeCardioDraft(cardioSets, editedIndex, patch)
    setCardioSets(next)
    persistCardioSets(next.slice(editedIndex))
  }

  const onBarWeightChange = (value: string) => {
    setBarWeight(value)
  }

  const onBarWeightPersist = (value: string) => {
    const bar = parseBarWeightLbs(value)
    if (bar === null) {
      setError('Invalid bar weight')
      return
    }

    setBarWeight(String(bar))

    const computed = strengthSets.map((draft) => ({
      draft,
      pounds: computeDraftPounds(
        inputType,
        { primary: draft.primary },
        data.bodyWeightLbs,
        bar,
      ),
    }))

    for (const { draft, pounds } of computed) {
      if (draft.primary.trim() !== '' && pounds === null) {
        setError('Invalid weight')
        return
      }
      if (pounds !== null && pounds < 0) {
        setError('Weight cannot be negative')
        return
      }
    }

    startTransition(async () => {
      setError(null)
      try {
        const result = await updatePrefFn({
          data: {
            exerciseId: data.workoutExercise.exercise.id,
            inputType,
            barWeightLbs: bar,
          },
        })
        setBarWeight(String(result.barWeightLbs))

        await Promise.all(
          computed.map(({ draft, pounds }) =>
            updateSetFn({
              data: {
                setId: draft.id,
                mode: 'strength',
                weight: pounds,
                reps: parseOptionalInt(draft.reps),
              },
            }),
          ),
        )
      } catch {
        setError('Could not save bar weight')
      }
    })
  }

  const onUnitLabelPersist = (value: string) => {
    const trimmed = value.trim()
    setUnitLabel(trimmed)
    if (!trimmed) {
      setError('Unit label is required')
      return
    }

    startTransition(async () => {
      setError(null)
      try {
        const result = await updateCardioPrefFn({
          data: {
            exerciseId: data.workoutExercise.exercise.id,
            unitLabel: trimmed,
            rateMode,
          },
        })
        setUnitLabel(result.unitLabel)
        setRateMode(result.rateMode)
      } catch {
        setError('Could not save unit label')
      }
    })
  }

  const onRateModeChange = (nextMode: CardioRateMode) => {
    setRateMode(nextMode)
    const trimmed = unitLabel.trim()
    if (!trimmed) {
      return
    }

    startTransition(async () => {
      setError(null)
      try {
        const result = await updateCardioPrefFn({
          data: {
            exerciseId: data.workoutExercise.exercise.id,
            unitLabel: trimmed,
            rateMode: nextMode,
          },
        })
        setUnitLabel(result.unitLabel)
        setRateMode(result.rateMode)
      } catch {
        setError('Could not save rate mode')
      }
    })
  }

  const onInputTypeChange = (nextType: WeightInputType) => {
    const wasCardio = isCardioInputType(inputType)
    const nextIsCardio = isCardioInputType(nextType)
    const nextBar =
      nextType === 'barbell'
        ? (parseBarWeightLbs(barWeight) ?? DEFAULT_BAR_WEIGHT_LBS)
        : DEFAULT_BAR_WEIGHT_LBS

    setInputType(nextType)
    if (nextType === 'barbell') {
      setBarWeight(String(nextBar))
    }

    let emptyExtraSetIds: string[] = []

    if (wasCardio && !nextIsCardio) {
      setStrengthSets(
        toStrengthDraft(
          data.workoutExercise.sets,
          nextType,
          nextBar,
          data.bodyWeightLbs,
        ),
      )
    } else if (!wasCardio && nextIsCardio) {
      const extrasEmpty = strengthSets
        .slice(1)
        .every((set) => !set.primary.trim() && !set.reps.trim())
      if (extrasEmpty && strengthSets.length > 1) {
        emptyExtraSetIds = strengthSets.slice(1).map((set) => set.id)
        const first = strengthSets[0]!
        setCardioSets([
          {
            id: first.id,
            setIndex: 0,
            metric: '',
            duration: '',
          },
        ])
        setCurrentSetIndex(0)
      } else {
        setCardioSets(toCardioDraft(data.workoutExercise.sets))
      }
    } else if (!nextIsCardio) {
      setStrengthSets((prev) =>
        prev.map((set) => {
          const stored = computeDraftPounds(
            inputType,
            { primary: set.primary },
            data.bodyWeightLbs,
            resolvedBarWeightLbs,
          )
          const fields = fieldsToStrings(
            fromPounds(nextType, stored, {
              bodyWeightLbs: data.bodyWeightLbs,
              barWeightLbs: nextBar,
            }),
          )
          return {
            ...set,
            primary: fields.primary,
          }
        }),
      )
    }

    startTransition(async () => {
      setError(null)
      try {
        const result = await updatePrefFn({
          data: {
            exerciseId: data.workoutExercise.exercise.id,
            inputType: nextType,
            barWeightLbs: nextType === 'barbell' ? nextBar : undefined,
          },
        })
        setBarWeight(String(result.barWeightLbs))

        if (emptyExtraSetIds.length > 0) {
          for (const setId of emptyExtraSetIds) {
            await removeSetFn({ data: { setId } })
          }
          await router.invalidate()
        }
      } catch {
        setError('Could not save input type')
      }
    })
  }

  const onAddSet = () => {
    startTransition(async () => {
      setError(null)
      try {
        const created = await addSetFn({
          data: { workoutExerciseId },
        })
        if (isCardio) {
          const last = cardioSets[cardioSets.length - 1]
          const newDraft: CardioSetDraft = {
            id: created.id,
            setIndex: created.setIndex,
            metric: last?.metric ?? '',
            duration: last?.duration ?? '',
          }
          setCardioSets((prev) => [...prev, newDraft])
          await updateSetFn({
            data: {
              setId: newDraft.id,
              mode: 'cardio',
              metricValue: parseOptionalNumber(newDraft.metric),
              durationSeconds: parseDurationMmSs(newDraft.duration),
            },
          })
        } else {
          const last = strengthSets[strengthSets.length - 1]
          const newDraft: StrengthSetDraft = {
            id: created.id,
            setIndex: created.setIndex,
            primary: last?.primary ?? '',
            reps: last?.reps ?? '',
          }
          setStrengthSets((prev) => [...prev, newDraft])
          const pounds = computeDraftPounds(
            inputType,
            { primary: newDraft.primary },
            data.bodyWeightLbs,
            resolvedBarWeightLbs,
          )
          await updateSetFn({
            data: {
              setId: newDraft.id,
              mode: 'strength',
              weight: pounds,
              reps: parseOptionalInt(newDraft.reps),
            },
          })
        }
        setCurrentSetIndex(sets.length)
        await router.invalidate()
      } catch {
        setError('Could not add set')
      }
    })
  }

  const onRemoveSet = (setId: string) => {
    if (sets.length <= 1) return
    startTransition(async () => {
      setError(null)
      try {
        await removeSetFn({ data: { setId } })
        await router.invalidate()
      } catch {
        setError('Could not remove set')
      }
    })
  }

  const isLastSet = currentSetIndex >= sets.length - 1

  const leaveExercise = () => {
    void navigate({
      to: '/workout/$workoutId',
      params: { workoutId },
    })
  }

  const onPrimaryAction = () => {
    if (!isLastSet) {
      setCurrentSetIndex((i) => i + 1)
      return
    }
    leaveExercise()
  }

  const onCancel = () => {
    if (!window.confirm('Cancel this exercise and return to the workout?')) {
      return
    }
    leaveExercise()
  }

  const exercise = data.workoutExercise.exercise

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-lg flex-col px-4 py-6">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.18em] text-[var(--kicker)] uppercase">
            Logging
          </p>
          <h1 className="mt-1 font-heading text-2xl font-medium text-[var(--sea-ink)]">
            {exercise.name}
          </h1>
          {exercise.equipment ? (
            <p className="mt-1 text-sm text-[var(--sea-ink-soft)]">
              {exercise.equipment}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="min-w-20 shrink-0 border-[var(--line)] bg-[var(--surface)] text-[var(--sea-ink)] hover:bg-[var(--surface-strong)] hover:text-[var(--sea-ink)]"
          disabled={isPending}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </header>

      {exercise.imageUrl || exercise.description ? (
        <section className="mb-6">
          {mediaExpanded ? (
            <>
              {exercise.imageUrl ? (
                <img
                  src={exercise.imageUrl}
                  alt=""
                  className="mb-4 aspect-[4/3] w-full object-cover"
                />
              ) : null}
              {exercise.description ? (
                <p className="mb-3 text-sm leading-relaxed text-[var(--sea-ink-soft)]">
                  {exercise.description}
                </p>
              ) : null}
            </>
          ) : (
            <div className="flex gap-3">
              {exercise.imageUrl ? (
                <img
                  src={exercise.imageUrl}
                  alt=""
                  className="size-20 shrink-0 object-cover"
                />
              ) : null}
              {exercise.description ? (
                <p className="min-w-0 flex-1 text-sm leading-relaxed text-[var(--sea-ink-soft)] line-clamp-4">
                  {exercise.description}
                </p>
              ) : null}
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="mt-2 px-0 text-[var(--sea-ink-soft)] hover:bg-transparent hover:text-[var(--sea-ink)]"
            aria-expanded={mediaExpanded}
            onClick={() => setMediaExpanded((open) => !open)}
          >
            {mediaExpanded ? 'Collapse' : 'Expand'}
          </Button>
        </section>
      ) : null}

      <div
        className={cn(
          'mb-4 grid gap-3',
          isCardio || inputType === 'barbell' ? 'grid-cols-2' : 'grid-cols-1',
        )}
      >
        <WeightInputTypeSelect
          value={inputType}
          disabled={isPending}
          onChange={onInputTypeChange}
        />
        {!isCardio && inputType === 'barbell' ? (
          <BarWeightInput
            value={barWeight}
            disabled={isPending}
            onChange={onBarWeightChange}
            onBlurPersist={onBarWeightPersist}
          />
        ) : null}
        {isCardio ? (
          <CardioUnitLabelInput
            value={unitLabel}
            disabled={isPending}
            onChange={setUnitLabel}
            onBlurPersist={onUnitLabelPersist}
          />
        ) : null}
      </div>

      {isCardio ? (
        <div className="mb-4">
          <CardioRateModeSelect
            value={rateMode}
            unitLabel={unitLabel}
            disabled={isPending}
            onChange={onRateModeChange}
          />
        </div>
      ) : null}

      {error ? (
        <p className="mb-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {isCardio ? (
        <>
          <div className="mb-4 grid grid-cols-[2.5rem_1fr_5.5rem_2.5rem] gap-2 px-1 text-xs font-semibold tracking-wide text-[var(--sea-ink-soft)] uppercase">
            <span>Set</span>
            <span className="truncate">{metricHeader}</span>
            <span>Time</span>
            <span className="sr-only">Remove</span>
          </div>

          <ul className="space-y-4">
            {cardioSets.map((set, index) => {
              const rateLabel = formatCardioRate({
                amount: parseOptionalNumber(set.metric),
                durationSeconds: parseDurationMmSs(set.duration),
                rateMode,
                unitLabel,
              })

              return (
              <li
                key={set.id}
                className={cn(
                  'rounded-md px-1 py-2 -mx-1',
                  index === currentSetIndex &&
                    'border border-primary bg-[var(--surface-strong)]',
                  index < currentSetIndex && 'opacity-50',
                )}
                onClick={
                  index === currentSetIndex
                    ? undefined
                    : () => setCurrentSetIndex(index)
                }
                onFocusCapture={() => {
                  if (index !== currentSetIndex) {
                    setCurrentSetIndex(index)
                  }
                }}
              >
                <div className="grid grid-cols-[2.5rem_1fr_5.5rem_2.5rem] items-start gap-2">
                <div className="flex h-11 items-center justify-center text-sm font-semibold text-[var(--sea-ink)]">
                  {index + 1}
                </div>
                <CardioMetricInput
                  setId={set.id}
                  label={metricHeader}
                  value={set.metric}
                  disabled={isPending}
                  onChange={(value) =>
                    applyCardioCascade(index, { metric: value })
                  }
                  onBlurPersist={(value) =>
                    cascadeAndPersistCardio(index, { metric: value })
                  }
                />
                <CardioDurationInput
                  setId={set.id}
                  value={set.duration}
                  disabled={isPending}
                  onChange={(value) =>
                    applyCardioCascade(index, { duration: value })
                  }
                  onBlurPersist={(value) =>
                    cascadeAndPersistCardio(index, { duration: value })
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-5 size-11"
                  disabled={isPending || cardioSets.length <= 1}
                  aria-label={`Remove set ${index + 1}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    onRemoveSet(set.id)
                  }}
                >
                  <Trash className="size-4" />
                </Button>
                </div>
                <div className="pl-[calc(2.5rem+0.5rem)]">
                  <CardioRateDisplay value={rateLabel} />
                </div>
              </li>
              )
            })}
          </ul>
        </>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-[2.5rem_1fr_5.5rem_2.5rem] gap-2 px-1 text-xs font-semibold tracking-wide text-[var(--sea-ink-soft)] uppercase">
            <span>Set</span>
            <span>Weight</span>
            <span>Reps</span>
            <span className="sr-only">Remove</span>
          </div>

          <ul className="space-y-4">
            {strengthSets.map((set, index) => (
              <li
                key={set.id}
                className={cn(
                  'grid grid-cols-[2.5rem_1fr_5.5rem_2.5rem] items-start gap-2 rounded-md px-1 py-2 -mx-1',
                  index === currentSetIndex &&
                    'border border-primary bg-[var(--surface-strong)]',
                  index < currentSetIndex && 'opacity-50',
                )}
                onClick={
                  index === currentSetIndex
                    ? undefined
                    : () => setCurrentSetIndex(index)
                }
                onFocusCapture={() => {
                  if (index !== currentSetIndex) {
                    setCurrentSetIndex(index)
                  }
                }}
              >
                <div className="flex h-11 items-center justify-center text-sm font-semibold text-[var(--sea-ink)]">
                  {index + 1}
                </div>
                <WeightInputFields
                  setId={set.id}
                  setLabel={String(index + 1)}
                  inputType={inputType}
                  fields={{ primary: set.primary }}
                  bodyWeightLbs={data.bodyWeightLbs}
                  barWeightLbs={resolvedBarWeightLbs}
                  onFieldsChange={(fields) => {
                    applyStrengthCascade(index, {
                      primary: fields.primary,
                    })
                  }}
                  onBlurPersist={(fields) => {
                    cascadeAndPersistStrength(index, {
                      primary: fields.primary,
                    })
                  }}
                />
                <div>
                  <Label
                    htmlFor={`reps-${set.id}`}
                    className="mb-1 block text-[0.65rem] font-medium tracking-wide text-[var(--sea-ink-soft)] uppercase"
                  >
                    Reps
                  </Label>
                  <Input
                    id={`reps-${set.id}`}
                    inputMode="numeric"
                    value={set.reps}
                    onChange={(event) => {
                      applyStrengthCascade(index, {
                        reps: event.target.value,
                      })
                    }}
                    onBlur={(event) => {
                      cascadeAndPersistStrength(index, {
                        reps: event.target.value,
                      })
                    }}
                    className="h-11 text-base"
                    placeholder="0"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-5 size-11"
                  disabled={isPending || strengthSets.length <= 1}
                  aria-label={`Remove set ${index + 1}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    onRemoveSet(set.id)
                  }}
                >
                  <Trash className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="border-[var(--line)] bg-[var(--surface)] text-sm text-[var(--sea-ink)] hover:bg-[var(--surface-strong)] hover:text-[var(--sea-ink)]"
          disabled={isPending}
          onClick={onAddSet}
        >
          <Plus className="size-4" data-icon="inline-start" />
          Add set
        </Button>
        <Button
          type="button"
          variant={isLastSet ? 'default' : 'secondary'}
          size="lg"
          className="text-sm"
          onClick={onPrimaryAction}
        >
          {isLastSet ? 'Done' : 'Next set'}
        </Button>
      </div>
    </main>
  )
}
