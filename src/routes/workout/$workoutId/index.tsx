import {
  createFileRoute,
  redirect,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { MagnifyingGlass, Trash } from '@phosphor-icons/react'
import { useEffect, useState, useTransition } from 'react'
import { getSession } from '#/lib/auth-session'
import { DAY_TYPE_LABELS } from '#/lib/day-types'
import {
  addExerciseToWorkout,
  completeWorkout,
  getWorkout,
  listFavorites,
  removeExerciseFromWorkout,
  searchExercises,
  toggleFavorite,
} from '#/lib/workout.functions'
import {
  ExerciseListItem,
} from '@/components/exercise-list-item'
import type { ExerciseListItemData } from '@/components/exercise-list-item'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export const Route = createFileRoute('/workout/$workoutId/')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session?.user) {
      throw redirect({ to: '/login' })
    }
  },
  loader: async ({ params }) => {
    const detail = await getWorkout({ data: { workoutId: params.workoutId } })
    const favorites = await listFavorites({
      data: { dayType: detail.workout.dayType },
    })
    return { detail, favorites }
  },
  component: WorkoutSelectionPage,
})

function WorkoutSelectionPage() {
  const { workoutId } = Route.useParams()
  const { detail, favorites: initialFavorites } = Route.useLoaderData()
  const navigate = useNavigate()
  const router = useRouter()

  const searchExercisesFn = useServerFn(searchExercises)
  const toggleFavoriteFn = useServerFn(toggleFavorite)
  const addExerciseFn = useServerFn(addExerciseToWorkout)
  const removeExerciseFn = useServerFn(removeExerciseFromWorkout)
  const completeWorkoutFn = useServerFn(completeWorkout)

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [results, setResults] = useState<ExerciseListItemData[]>([])
  const [favorites, setFavorites] =
    useState<ExerciseListItemData[]>(initialFavorites)
  const [isPending, startTransition] = useTransition()
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setFavorites(initialFavorites)
  }, [initialFavorites])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedQuery(query.trim())
    }, 250)
    return () => window.clearTimeout(handle)
  }, [query])

  useEffect(() => {
    if (!debouncedQuery) {
      setResults([])
      setSearching(false)
      return
    }

    let cancelled = false
    setSearching(true)
    void searchExercisesFn({
      data: { query: debouncedQuery, dayType: detail.workout.dayType },
    })
      .then((rows) => {
        if (!cancelled) setResults(rows)
      })
      .catch(() => {
        if (!cancelled) setError('Search failed')
      })
      .finally(() => {
        if (!cancelled) setSearching(false)
      })

    return () => {
      cancelled = true
    }
  }, [debouncedQuery, detail.workout.dayType, searchExercisesFn])

  const onToggleFavorite = (exercise: ExerciseListItemData) => {
    startTransition(async () => {
      setError(null)
      try {
        const { favorited } = await toggleFavoriteFn({
          data: {
            exerciseId: exercise.id,
            dayType: detail.workout.dayType,
          },
        })

        setFavorites((prev) => {
          if (favorited) {
            if (prev.some((item) => item.id === exercise.id)) return prev
            return [...prev, { ...exercise, favorited: true }].sort((a, b) =>
              a.name.localeCompare(b.name),
            )
          }
          return prev.filter((item) => item.id !== exercise.id)
        })

        setResults((prev) =>
          prev.map((item) =>
            item.id === exercise.id ? { ...item, favorited } : item,
          ),
        )
      } catch {
        setError('Could not update favorite')
      }
    })
  }

  const onSelectExercise = (exerciseId: string) => {
    startTransition(async () => {
      setError(null)
      try {
        const { workoutExerciseId } = await addExerciseFn({
          data: { workoutId, exerciseId },
        })
        await navigate({
          to: '/workout/$workoutId/exercise/$workoutExerciseId',
          params: { workoutId, workoutExerciseId },
        })
      } catch {
        setError('Could not add exercise')
      }
    })
  }

  const onRemoveExercise = (workoutExerciseId: string, name: string) => {
    if (!window.confirm(`Remove ${name} from this session?`)) return

    startTransition(async () => {
      setError(null)
      try {
        await removeExerciseFn({ data: { workoutExerciseId } })
        await router.invalidate()
      } catch {
        setError('Could not remove exercise')
      }
    })
  }

  const onDone = () => {
    startTransition(async () => {
      setError(null)
      try {
        await completeWorkoutFn({ data: { workoutId } })
        await router.invalidate()
        await navigate({ to: '/' })
      } catch {
        setError('Could not finish workout')
      }
    })
  }

  const sessionExercises = detail.exercises

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-lg flex-col px-4 py-6">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-[var(--kicker)] uppercase">
            {DAY_TYPE_LABELS[detail.workout.dayType]} day
          </p>
          <h1 className="mt-1 font-heading text-2xl font-medium text-[var(--sea-ink)]">
            Exercises
          </h1>
        </div>
        <Button
          size="lg"
          disabled={isPending}
          onClick={onDone}
          className="min-w-20"
        >
          Done
        </Button>
      </header>

      {sessionExercises.length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-[var(--sea-ink-soft)] uppercase">
            This session
          </h2>
          <ul className="border border-[var(--line)] bg-[var(--surface)]">
            {sessionExercises.map((item) => (
              <li
                key={item.id}
                className="flex items-stretch border-b border-[var(--line)] last:border-b-0"
              >
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    void navigate({
                      to: '/workout/$workoutId/exercise/$workoutExerciseId',
                      params: {
                        workoutId,
                        workoutExerciseId: item.id,
                      },
                    })
                  }
                  className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3 py-3 text-left hover:bg-[var(--surface-strong)] disabled:opacity-50"
                >
                  <span className="font-medium text-[var(--sea-ink)]">
                    {item.exercise.name}
                  </span>
                  <span className="text-xs text-[var(--sea-ink-soft)]">
                    {item.sets.length} sets
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${item.exercise.name}`}
                  disabled={isPending}
                  onClick={() => onRemoveExercise(item.id, item.exercise.name)}
                  className="flex w-12 shrink-0 items-center justify-center text-[var(--sea-ink-soft)] transition-colors hover:text-destructive disabled:opacity-50"
                >
                  <Trash className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="relative mb-5">
        <MagnifyingGlass className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--sea-ink-soft)]" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search exercises…"
          className="h-11 pl-9 text-sm"
          autoComplete="off"
          autoCorrect="off"
        />
      </div>

      {error ? (
        <p className="mb-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {debouncedQuery ? (
        <section>
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-[var(--sea-ink-soft)] uppercase">
            {searching ? 'Searching…' : `Results`}
          </h2>
          <div className="border border-[var(--line)] bg-[var(--surface)]">
            {results.length === 0 && !searching ? (
              <p className="px-3 py-6 text-sm text-[var(--sea-ink-soft)]">
                No exercises match “{debouncedQuery}”.
              </p>
            ) : (
              results.map((exercise) => (
                <ExerciseListItem
                  key={exercise.id}
                  exercise={exercise}
                  busy={isPending}
                  onSelect={() => onSelectExercise(exercise.id)}
                  onToggleFavorite={() => onToggleFavorite(exercise)}
                />
              ))
            )}
          </div>
        </section>
      ) : (
        <section>
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-[var(--sea-ink-soft)] uppercase">
            Favorites for {DAY_TYPE_LABELS[detail.workout.dayType]}
          </h2>
          <div className="border border-[var(--line)] bg-[var(--surface)]">
            {favorites.length === 0 ? (
              <p className="px-3 py-6 text-sm text-[var(--sea-ink-soft)]">
                No favorites yet. Search for an exercise and tap the star to
                bookmark it for this day type.
              </p>
            ) : (
              favorites.map((exercise) => (
                <ExerciseListItem
                  key={exercise.id}
                  exercise={exercise}
                  busy={isPending}
                  onSelect={() => onSelectExercise(exercise.id)}
                  onToggleFavorite={() => onToggleFavorite(exercise)}
                />
              ))
            )}
          </div>
        </section>
      )}
    </main>
  )
}
