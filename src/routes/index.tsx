import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState, useTransition } from 'react'
import { authClient } from '#/lib/auth-client'
import { getSession } from '#/lib/auth-session'
import { formatLastWorkoutLabel } from '#/lib/format-last-workout'
import { getActiveProfile } from '#/lib/profile.functions'
import { getActiveWorkout, startWorkout } from '#/lib/workout.functions'
import { Button } from '@/components/ui/button'

const isDev = import.meta.env.DEV

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session?.user) {
      throw redirect({ to: '/login' })
    }
    return { user: session.user }
  },
  loader: async () => {
    const [active, activeProfile] = await Promise.all([
      getActiveWorkout(),
      getActiveProfile(),
    ])
    return { active, ...activeProfile }
  },
  component: HomePage,
})

function HomePage() {
  const { user } = Route.useRouteContext()
  const { active, profile, days, lastCompletedByDayId } =
    Route.useLoaderData()
  const navigate = useNavigate()
  const startWorkoutFn = useServerFn(startWorkout)
  const [pendingDay, setPendingDay] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const begin = (dayId: string) => {
    setPendingDay(dayId)
    startTransition(async () => {
      try {
        const workout = await startWorkoutFn({ data: { dayId } })
        await navigate({
          to: '/workout/$workoutId',
          params: { workoutId: workout.id },
        })
      } finally {
        setPendingDay(null)
      }
    })
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-lg flex-col px-4 py-8">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-[var(--kicker)] uppercase">
            Liftr
          </p>
          <h1 className="mt-2 font-heading text-3xl font-medium tracking-tight text-[var(--sea-ink)]">
            Hey {user.name.split(' ')[0]}
          </h1>
          <p className="mt-1 text-sm text-[var(--sea-ink-soft)]">
            Pick a day and start lifting.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void navigate({ to: '/sessions' })
            }}
          >
            Sessions
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void navigate({ to: '/settings' })
            }}
          >
            Settings
          </Button>
          {!isDev ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void authClient.signOut().then(() => {
                  void navigate({ to: '/login' })
                })
              }}
            >
              Sign out
            </Button>
          ) : null}
        </div>
      </header>

      {active ? (
        <button
          type="button"
          onClick={() =>
            void navigate({
              to: '/workout/$workoutId',
              params: { workoutId: active.id },
            })
          }
          className="mb-6 border border-[var(--lagoon)] bg-[var(--surface)] px-4 py-3 text-left transition-colors hover:bg-[var(--surface-strong)]"
        >
          <p className="text-xs font-semibold tracking-wide text-[var(--lagoon-deep)] uppercase">
            In progress
          </p>
          <p className="mt-1 font-medium text-[var(--sea-ink)]">
            Resume {active.dayName || 'workout'}
          </p>
        </button>
      ) : null}

      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-[var(--sea-ink-soft)] uppercase">
            Profile
          </p>
          <p className="truncate font-medium text-[var(--sea-ink)]">
            {profile.name}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            void navigate({ to: '/profiles' })
          }}
        >
          Change
        </Button>
      </div>

      <div className="grid gap-3">
        {days.map((day) => {
          const lastCompleted = lastCompletedByDayId[day.id]
          return (
            <button
              key={day.id}
              type="button"
              disabled={isPending}
              onClick={() => begin(day.id)}
              className="group border border-[var(--line)] bg-[var(--surface)] px-5 py-5 text-left transition-all hover:border-[var(--lagoon)] hover:bg-[var(--surface-strong)] disabled:opacity-60"
            >
              <span className="flex items-center justify-between gap-3">
                <span>
                  <span className="block text-xl font-semibold text-[var(--sea-ink)]">
                    {day.name}
                  </span>
                  {day.description ? (
                    <span className="mt-1 block text-sm text-[var(--sea-ink-soft)]">
                      {day.description}
                    </span>
                  ) : null}
                </span>
                {pendingDay === day.id ? (
                  <span className="shrink-0 text-sm font-medium text-[var(--lagoon-deep)]">
                    Starting…
                  </span>
                ) : lastCompleted ? (
                  <span className="shrink-0 text-right">
                    <span className="block text-xs font-medium text-[var(--sea-ink-soft)]">
                      Last done
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--sea-ink-soft)]">
                      {formatLastWorkoutLabel(lastCompleted)}
                    </span>
                  </span>
                ) : (
                  <span className="shrink-0 text-sm font-medium text-[var(--lagoon-deep)] opacity-0 transition-opacity group-hover:opacity-100">
                    Start
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </main>
  )
}
