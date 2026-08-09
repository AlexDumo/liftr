import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState, useTransition } from 'react'
import { authClient } from '#/lib/auth-client'
import { getSession } from '#/lib/auth-session'
import { DAY_TYPE_BLURBS, DAY_TYPE_LABELS, DAY_TYPES } from '#/lib/day-types'
import {
  dayTypeLabels,
  getActiveWorkout,
  startWorkout,
} from '#/lib/workout.functions'
import type { DayType } from '#/db/workout.schema'
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
    const active = await getActiveWorkout()
    return { active }
  },
  component: HomePage,
})

function HomePage() {
  const { user } = Route.useRouteContext()
  const { active } = Route.useLoaderData()
  const navigate = useNavigate()
  const startWorkoutFn = useServerFn(startWorkout)
  const [pendingDay, setPendingDay] = useState<DayType | null>(null)
  const [isPending, startTransition] = useTransition()

  const begin = (dayType: DayType) => {
    setPendingDay(dayType)
    startTransition(async () => {
      try {
        const workout = await startWorkoutFn({ data: { dayType } })
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
        {!isDev ? (
          <Button
            variant="outline"
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
            Resume {dayTypeLabels[active.dayType]} day
          </p>
        </button>
      ) : null}

      <div className="grid gap-3">
        {DAY_TYPES.map((dayType) => (
          <button
            key={dayType}
            type="button"
            disabled={isPending}
            onClick={() => begin(dayType)}
            className="group border border-[var(--line)] bg-[var(--surface)] px-5 py-5 text-left transition-all hover:border-[var(--lagoon)] hover:bg-[var(--surface-strong)] disabled:opacity-60"
          >
            <span className="flex items-center justify-between gap-3">
              <span>
                <span className="block text-xl font-semibold text-[var(--sea-ink)]">
                  {DAY_TYPE_LABELS[dayType]}
                </span>
                <span className="mt-1 block text-sm text-[var(--sea-ink-soft)]">
                  {DAY_TYPE_BLURBS[dayType]}
                </span>
              </span>
              <span className="text-sm font-medium text-[var(--lagoon-deep)] opacity-0 transition-opacity group-hover:opacity-100">
                {pendingDay === dayType ? 'Starting…' : 'Start'}
              </span>
            </span>
          </button>
        ))}
      </div>
    </main>
  )
}
