import {
  createFileRoute,
  redirect,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Trash } from '@phosphor-icons/react'
import { useState, useTransition } from 'react'
import { getSession } from '#/lib/auth-session'
import { DAY_TYPE_LABELS } from '#/lib/day-types'
import { formatLastWorkoutLabel } from '#/lib/format-last-workout'
import { deleteWorkout, listWorkouts } from '#/lib/workout.functions'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/sessions')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session?.user) {
      throw redirect({ to: '/login' })
    }
  },
  loader: async () => ({ workouts: await listWorkouts() }),
  component: SessionsPage,
})

function SessionsPage() {
  const { workouts } = Route.useLoaderData()
  const navigate = useNavigate()
  const router = useRouter()
  const deleteWorkoutFn = useServerFn(deleteWorkout)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const onDelete = (workoutId: string, label: string) => {
    if (!window.confirm(`Delete ${label} session? This cannot be undone.`)) {
      return
    }

    startTransition(async () => {
      setError(null)
      try {
        await deleteWorkoutFn({ data: { workoutId } })
        await router.invalidate()
      } catch {
        setError('Could not delete session')
      }
    })
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-lg flex-col px-4 py-8">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-[var(--kicker)] uppercase">
            History
          </p>
          <h1 className="mt-2 font-heading text-3xl font-medium tracking-tight text-[var(--sea-ink)]">
            Sessions
          </h1>
          <p className="mt-1 text-sm text-[var(--sea-ink-soft)]">
            Review, edit, or delete past workout days.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            void navigate({ to: '/' })
          }}
        >
          Back
        </Button>
      </header>

      {error ? (
        <p className="mb-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {workouts.length === 0 ? (
        <p className="border border-[var(--line)] bg-[var(--surface)] px-4 py-8 text-center text-sm text-[var(--sea-ink-soft)]">
          No sessions yet. Start a workout day from home.
        </p>
      ) : (
        <ul className="border border-[var(--line)] bg-[var(--surface)]">
          {workouts.map((workout) => {
            const dayLabel = DAY_TYPE_LABELS[workout.dayType]
            const when = workout.completedAt ?? workout.startedAt
            const exerciseLabel =
              workout.exerciseCount === 1
                ? '1 exercise'
                : `${workout.exerciseCount} exercises`

            return (
              <li
                key={workout.id}
                className="flex items-stretch border-b border-[var(--line)] last:border-b-0"
              >
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    void navigate({
                      to: '/workout/$workoutId',
                      params: { workoutId: workout.id },
                    })
                  }
                  className="flex min-w-0 flex-1 flex-col gap-1 px-4 py-4 text-left hover:bg-[var(--surface-strong)] disabled:opacity-50"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-medium text-[var(--sea-ink)]">
                      {dayLabel} day
                    </span>
                    <span className="shrink-0 text-xs font-medium tracking-wide text-[var(--sea-ink-soft)] uppercase">
                      {workout.status === 'in_progress'
                        ? 'In progress'
                        : 'Completed'}
                    </span>
                  </span>
                  <span className="text-sm text-[var(--sea-ink-soft)]">
                    {formatLastWorkoutLabel(when)}
                    {' · '}
                    {exerciseLabel}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${dayLabel} session`}
                  disabled={isPending}
                  onClick={() => onDelete(workout.id, dayLabel)}
                  className="flex w-12 shrink-0 items-center justify-center text-[var(--sea-ink-soft)] transition-colors hover:text-destructive disabled:opacity-50"
                >
                  <Trash className="size-4" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
