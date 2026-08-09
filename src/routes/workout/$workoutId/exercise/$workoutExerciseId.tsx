import {
  createFileRoute,
  redirect,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Minus, Plus } from '@phosphor-icons/react'
import { useEffect, useState, useTransition } from 'react'
import { getSession } from '#/lib/auth-session'
import {
  addSet,
  getWorkoutExercise,
  removeSet,
  updateSet,
} from '#/lib/workout.functions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type SetDraft = {
  id: string
  setIndex: number
  weight: string
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

function toDraft(sets: Array<{
  id: string
  setIndex: number
  weight: number | null
  reps: number | null
}>): SetDraft[] {
  return sets.map((set) => ({
    id: set.id,
    setIndex: set.setIndex,
    weight: set.weight === null ? '' : String(set.weight),
    reps: set.reps === null ? '' : String(set.reps),
  }))
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const num = Number(trimmed)
  return Number.isFinite(num) ? num : null
}

function parseOptionalInt(value: string): number | null {
  const num = parseOptionalNumber(value)
  if (num === null) return null
  return Math.round(num)
}

function ExerciseLoggingPage() {
  const { workoutId, workoutExerciseId } = Route.useParams()
  const data = Route.useLoaderData()
  const navigate = useNavigate()
  const router = useRouter()

  const updateSetFn = useServerFn(updateSet)
  const addSetFn = useServerFn(addSet)
  const removeSetFn = useServerFn(removeSet)

  const [sets, setSets] = useState<SetDraft[]>(() =>
    toDraft(data.workoutExercise.sets),
  )
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSets(toDraft(data.workoutExercise.sets))
  }, [data.workoutExercise.sets])

  const persistSet = (draft: SetDraft) => {
    startTransition(async () => {
      setError(null)
      try {
        await updateSetFn({
          data: {
            setId: draft.id,
            weight: parseOptionalNumber(draft.weight),
            reps: parseOptionalInt(draft.reps),
          },
        })
      } catch {
        setError('Could not save set')
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
        setSets((prev) => [
          ...prev,
          {
            id: created.id,
            setIndex: created.setIndex,
            weight: '',
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

  const onDone = () => {
    void navigate({
      to: '/workout/$workoutId',
      params: { workoutId },
    })
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
        <Button size="lg" onClick={onDone} className="min-w-20 shrink-0">
          Done
        </Button>
      </header>

      {exercise.imageUrl ? (
        <img
          src={exercise.imageUrl}
          alt=""
          className="mb-4 aspect-[4/3] w-full object-cover"
        />
      ) : null}

      {exercise.description ? (
        <p className="mb-6 text-sm leading-relaxed text-[var(--sea-ink-soft)]">
          {exercise.description}
        </p>
      ) : null}

      {error ? (
        <p className="mb-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mb-4 grid grid-cols-[2.5rem_1fr_1fr_2.5rem] gap-2 px-1 text-xs font-semibold tracking-wide text-[var(--sea-ink-soft)] uppercase">
        <span>Set</span>
        <span>Weight</span>
        <span>Reps</span>
        <span className="sr-only">Remove</span>
      </div>

      <ul className="space-y-3">
        {sets.map((set, index) => (
          <li
            key={set.id}
            className="grid grid-cols-[2.5rem_1fr_1fr_2.5rem] items-end gap-2"
          >
            <div className="flex h-11 items-center justify-center text-sm font-semibold text-[var(--sea-ink)]">
              {index + 1}
            </div>
            <div>
              <Label htmlFor={`weight-${set.id}`} className="sr-only">
                Weight for set {index + 1}
              </Label>
              <Input
                id={`weight-${set.id}`}
                inputMode="decimal"
                value={set.weight}
                disabled={isPending}
                onChange={(event) => {
                  const weight = event.target.value
                  setSets((prev) =>
                    prev.map((item) =>
                      item.id === set.id ? { ...item, weight } : item,
                    ),
                  )
                }}
                onBlur={(event) => {
                  persistSet({ ...set, weight: event.target.value })
                }}
                className="h-11 text-base"
                placeholder="0"
              />
            </div>
            <div>
              <Label htmlFor={`reps-${set.id}`} className="sr-only">
                Reps for set {index + 1}
              </Label>
              <Input
                id={`reps-${set.id}`}
                inputMode="numeric"
                value={set.reps}
                disabled={isPending}
                onChange={(event) => {
                  const reps = event.target.value
                  setSets((prev) =>
                    prev.map((item) =>
                      item.id === set.id ? { ...item, reps } : item,
                    ),
                  )
                }}
                onBlur={(event) => {
                  persistSet({ ...set, reps: event.target.value })
                }}
                className="h-11 text-base"
                placeholder="0"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11"
              disabled={isPending || sets.length <= 1}
              aria-label={`Remove set ${index + 1}`}
              onClick={() => onRemoveSet(set.id)}
            >
              <Minus className="size-4" />
            </Button>
          </li>
        ))}
      </ul>

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="mt-6 w-full"
        disabled={isPending}
        onClick={onAddSet}
      >
        <Plus className="size-4" data-icon="inline-start" />
        Add set
      </Button>
    </main>
  )
}
