import {
  createFileRoute,
  redirect,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState, useTransition } from 'react'
import { getSession } from '#/lib/auth-session'
import {
  createProfile,
  listProfiles,
  setActiveProfile,
} from '#/lib/profile.functions'
import {
  MAX_DAYS_PER_PROFILE,
  MIN_DAYS_PER_PROFILE,
} from '#/lib/workout-profiles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export const Route = createFileRoute('/profiles/')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session?.user) {
      throw redirect({ to: '/login' })
    }
  },
  loader: async () => ({ profiles: await listProfiles() }),
  component: ProfilesPage,
})

function ProfilesPage() {
  const { profiles } = Route.useLoaderData()
  const navigate = useNavigate()
  const router = useRouter()
  const createProfileFn = useServerFn(createProfile)
  const setActiveProfileFn = useServerFn(setActiveProfile)

  const [name, setName] = useState('')
  const [dayCount, setDayCount] = useState('3')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const onUse = (profileId: string) => {
    startTransition(async () => {
      setError(null)
      try {
        await setActiveProfileFn({ data: { profileId } })
        await router.invalidate()
        await navigate({ to: '/' })
      } catch {
        setError('Could not switch profile')
      }
    })
  }

  const onCreate = () => {
    const trimmed = name.trim()
    const count = Number(dayCount)
    if (!trimmed) {
      setError('Enter a profile name')
      return
    }
    if (
      !Number.isInteger(count) ||
      count < MIN_DAYS_PER_PROFILE ||
      count > MAX_DAYS_PER_PROFILE
    ) {
      setError(
        `Enter a number of days between ${MIN_DAYS_PER_PROFILE} and ${MAX_DAYS_PER_PROFILE}`,
      )
      return
    }

    startTransition(async () => {
      setError(null)
      try {
        const { profileId } = await createProfileFn({
          data: { name: trimmed, dayCount: count },
        })
        await navigate({
          to: '/profiles/$profileId',
          params: { profileId },
        })
      } catch {
        setError('Could not create profile')
      }
    })
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-lg flex-col px-4 py-8">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-[var(--kicker)] uppercase">
            Splits
          </p>
          <h1 className="mt-2 font-heading text-3xl font-medium tracking-tight text-[var(--sea-ink)]">
            Profiles
          </h1>
          <p className="mt-1 text-sm text-[var(--sea-ink-soft)]">
            Keep a profile for each split. Switching never touches the others.
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

      <ul className="mb-8 border border-[var(--line)] bg-[var(--surface)]">
        {profiles.map((profile) => (
          <li
            key={profile.id}
            className="flex items-stretch border-b border-[var(--line)] last:border-b-0"
          >
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                void navigate({
                  to: '/profiles/$profileId',
                  params: { profileId: profile.id },
                })
              }
              className="flex min-w-0 flex-1 flex-col gap-1 px-4 py-4 text-left hover:bg-[var(--surface-strong)] disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                <span className="truncate font-medium text-[var(--sea-ink)]">
                  {profile.name}
                </span>
                {profile.isActive ? (
                  <span className="shrink-0 text-xs font-semibold tracking-wide text-[var(--lagoon-deep)] uppercase">
                    Active
                  </span>
                ) : null}
              </span>
              <span className="text-sm text-[var(--sea-ink-soft)]">
                {profile.dayNames.length === 1
                  ? '1 day'
                  : `${profile.dayNames.length} days`}
                {' · '}
                {profile.dayNames.join(', ')}
              </span>
            </button>
            {profile.isActive ? null : (
              <div className="flex shrink-0 items-center pr-3">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={isPending}
                  onClick={() => onUse(profile.id)}
                >
                  Use
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <section className="space-y-4">
        <h2 className="text-xs font-semibold tracking-wide text-[var(--sea-ink-soft)] uppercase">
          New profile
        </h2>
        <div className="space-y-2">
          <Label htmlFor="profile-name">Name</Label>
          <Input
            id="profile-name"
            value={name}
            disabled={isPending}
            placeholder="4-day upper / lower"
            className="h-11 text-base"
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-day-count">Number of days</Label>
          <Input
            id="profile-day-count"
            inputMode="numeric"
            value={dayCount}
            disabled={isPending}
            className="h-11 text-base"
            onChange={(event) => setDayCount(event.target.value)}
          />
          <p className="text-sm text-[var(--sea-ink-soft)]">
            You can name each day, and add or remove days, on the next screen.
          </p>
        </div>
        <Button size="lg" disabled={isPending} onClick={onCreate}>
          Create profile
        </Button>
      </section>
    </main>
  )
}
