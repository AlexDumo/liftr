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
  addSet,
  getWorkoutExercise,
  removeSet,
  updateExerciseWeightPref,
  updateSet,
} from '#/lib/workout.functions'
import {
  DEFAULT_BAR_WEIGHT_LBS,
  fromPounds,
  type WeightInputType,
} from '#/lib/weight-input'

type SetDraft = {
  id: string
  setIndex: number
  primary: string
  reps: string
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

function toDraft(
  sets: Array<{
    id: string
    setIndex: number
    weight: number | null
    reps: number | null
  }>,
  inputType: WeightInputType,
  barWeightLbs: number,
  bodyWeightLbs: number | null,
): SetDraft[] {
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

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const num = Number(trimmed)
  if (!Number.isFinite(num)) return null
  return Math.round(num)
}

function parseBarWeightLbs(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return DEFAULT_BAR_WEIGHT_LBS
  const num = Number(trimmed)
  if (!Number.isFinite(num) || num < 0) return null
  return num
}

function cascadeSetDraft(
  prev: SetDraft[],
  editedIndex: number,
  patch: Partial<Pick<SetDraft, 'primary' | 'reps'>>,
): SetDraft[] {
  const current = prev[editedIndex]
  if (!current) return prev

  const source: SetDraft = { ...current, ...patch }
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

function ExerciseLoggingPage() {
  const { workoutId, workoutExerciseId } = Route.useParams()
  const data = Route.useLoaderData()
  const navigate = useNavigate()
  const router = useRouter()

  const updateSetFn = useServerFn(updateSet)
  const addSetFn = useServerFn(addSet)
  const removeSetFn = useServerFn(removeSet)
  const updatePrefFn = useServerFn(updateExerciseWeightPref)

  const [inputType, setInputType] = useState<WeightInputType>(
    data.weightInputType,
  )
  const [barWeight, setBarWeight] = useState(String(data.barWeightLbs))
  const [sets, setSets] = useState<SetDraft[]>(() =>
    toDraft(
      data.workoutExercise.sets,
      data.weightInputType,
      data.barWeightLbs,
      data.bodyWeightLbs,
    ),
  )
  const [currentSetIndex, setCurrentSetIndex] = useState(0)
  const [mediaExpanded, setMediaExpanded] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const resolvedBarWeightLbs =
    parseBarWeightLbs(barWeight) ?? data.barWeightLbs

  useEffect(() => {
    setInputType(data.weightInputType)
    setBarWeight(String(data.barWeightLbs))
    const nextSets = toDraft(
      data.workoutExercise.sets,
      data.weightInputType,
      data.barWeightLbs,
      data.bodyWeightLbs,
    )
    setSets(nextSets)
    setCurrentSetIndex((i) => Math.min(i, Math.max(0, nextSets.length - 1)))
  }, [
    data.weightInputType,
    data.barWeightLbs,
    data.bodyWeightLbs,
    data.workoutExercise.sets,
  ])

  const persistSets = (
    drafts: SetDraft[],
    type = inputType,
    barLbs = resolvedBarWeightLbs,
  ) => {
    if (drafts.length === 0) return

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

  const applyCascade = (
    editedIndex: number,
    patch: Partial<Pick<SetDraft, 'primary' | 'reps'>>,
  ) => {
    setSets((prev) => cascadeSetDraft(prev, editedIndex, patch))
  }

  const cascadeAndPersist = (
    editedIndex: number,
    patch: Partial<Pick<SetDraft, 'primary' | 'reps'>>,
  ) => {
    const next = cascadeSetDraft(sets, editedIndex, patch)
    setSets(next)
    persistSets(next.slice(editedIndex))
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

    const computed = sets.map((draft) => ({
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

  const onInputTypeChange = (nextType: WeightInputType) => {
    const nextBar =
      nextType === 'barbell'
        ? (parseBarWeightLbs(barWeight) ?? DEFAULT_BAR_WEIGHT_LBS)
        : DEFAULT_BAR_WEIGHT_LBS

    setInputType(nextType)
    if (nextType === 'barbell') {
      setBarWeight(String(nextBar))
    }

    setSets((prev) =>
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
      } catch {
        setError('Could not save weight input type')
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
        const fields = fieldsToStrings(
          fromPounds(inputType, null, {
            bodyWeightLbs: data.bodyWeightLbs,
            barWeightLbs: resolvedBarWeightLbs,
          }),
        )
        setSets((prev) => [
          ...prev,
          {
            id: created.id,
            setIndex: created.setIndex,
            primary: fields.primary,
            reps: '',
          },
        ])
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
          inputType === 'barbell' ? 'grid-cols-2' : 'grid-cols-1',
        )}
      >
        <WeightInputTypeSelect
          value={inputType}
          disabled={isPending}
          onChange={onInputTypeChange}
        />
        {inputType === 'barbell' ? (
          <BarWeightInput
            value={barWeight}
            disabled={isPending}
            onChange={onBarWeightChange}
            onBlurPersist={onBarWeightPersist}
          />
        ) : null}
      </div>

      {error ? (
        <p className="mb-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mb-4 grid grid-cols-[2.5rem_1fr_5.5rem_2.5rem] gap-2 px-1 text-xs font-semibold tracking-wide text-[var(--sea-ink-soft)] uppercase">
        <span>Set</span>
        <span>Weight</span>
        <span>Reps</span>
        <span className="sr-only">Remove</span>
      </div>

      <ul className="space-y-4">
        {sets.map((set, index) => (
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
                applyCascade(index, {
                  primary: fields.primary,
                })
              }}
              onBlurPersist={(fields) => {
                cascadeAndPersist(index, {
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
                  applyCascade(index, { reps: event.target.value })
                }}
                onBlur={(event) => {
                  cascadeAndPersist(index, { reps: event.target.value })
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
              disabled={isPending || sets.length <= 1}
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
