import {
  createFileRoute,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useEffect, useState, useTransition } from 'react'
import { getSession } from '#/lib/auth-session'
import {
  getUserSettings,
  updateBodyWeight,
  updateUserName,
} from '#/lib/settings.functions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export const Route = createFileRoute('/settings')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session?.user) {
      throw redirect({ to: '/login' })
    }
  },
  loader: async () => getUserSettings(),
  component: SettingsPage,
})

function SettingsPage() {
  const data = Route.useLoaderData()
  const navigate = useNavigate()
  const updateUserNameFn = useServerFn(updateUserName)
  const updateBodyWeightFn = useServerFn(updateBodyWeight)

  const [name, setName] = useState(data.name)
  const [persistedName, setPersistedName] = useState(data.name)
  const [bodyWeight, setBodyWeight] = useState(
    data.bodyWeightLbs === null ? '' : String(data.bodyWeightLbs),
  )
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savedField, setSavedField] = useState<'name' | 'bodyWeight' | null>(
    null,
  )

  useEffect(() => {
    setName(data.name)
    setPersistedName(data.name)
    setBodyWeight(
      data.bodyWeightLbs === null ? '' : String(data.bodyWeightLbs),
    )
  }, [data.name, data.bodyWeightLbs])

  const persistName = (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) {
      setError('Enter a name')
      return
    }
    if (trimmed === persistedName) {
      return
    }

    startTransition(async () => {
      setError(null)
      setSavedField(null)
      try {
        const result = await updateUserNameFn({ data: { name: trimmed } })
        setName(result.name)
        setPersistedName(result.name)
        setSavedField('name')
      } catch {
        setError('Could not save name')
      }
    })
  }

  const persistBodyWeight = (raw: string) => {
    const trimmed = raw.trim()
    const value = trimmed === '' ? null : Number(trimmed)
    if (value !== null && (!Number.isFinite(value) || value <= 0)) {
      setError('Enter a valid body weight')
      return
    }

    startTransition(async () => {
      setError(null)
      setSavedField(null)
      try {
        await updateBodyWeightFn({ data: { bodyWeightLbs: value } })
        setSavedField('bodyWeight')
      } catch {
        setError('Could not save body weight')
      }
    })
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-lg flex-col px-4 py-8">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-[var(--kicker)] uppercase">
            Settings
          </p>
          <h1 className="mt-2 font-heading text-3xl font-medium tracking-tight text-[var(--sea-ink)]">
            Profile
          </h1>
          <p className="mt-1 text-sm text-[var(--sea-ink-soft)]">
            Your name and body weight for workouts.
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

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="display-name">Name</Label>
          <Input
            id="display-name"
            autoComplete="name"
            value={name}
            disabled={isPending}
            placeholder="Your name"
            className="h-11 text-base"
            onChange={(event) => {
              setName(event.target.value)
              setSavedField(null)
            }}
            onBlur={(event) => persistName(event.target.value)}
          />
          {savedField === 'name' && !error ? (
            <p className="text-sm text-[var(--sea-ink-soft)]">Saved</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="body-weight">Body weight (lb)</Label>
          <Input
            id="body-weight"
            inputMode="decimal"
            value={bodyWeight}
            disabled={isPending}
            placeholder="200"
            className="h-11 text-base"
            onChange={(event) => {
              setBodyWeight(event.target.value)
              setSavedField(null)
            }}
            onBlur={(event) => persistBodyWeight(event.target.value)}
          />
          {savedField === 'bodyWeight' && !error ? (
            <p className="text-sm text-[var(--sea-ink-soft)]">Saved</p>
          ) : null}
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  )
}
