import {
  createFileRoute,
  redirect,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { ArrowDown, ArrowUp, Trash } from '@phosphor-icons/react'
import { useEffect, useState, useTransition } from 'react'
import { getSession } from '#/lib/auth-session'
import {
  addDay,
  deleteDay,
  deleteProfile,
  duplicateProfile,
  getProfile,
  moveDay,
  renameProfile,
  setActiveProfile,
  updateDay,
} from '#/lib/profile.functions'
import { MAX_DAYS_PER_PROFILE } from '#/lib/workout-profiles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export const Route = createFileRoute('/profiles/$profileId')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session?.user) {
      throw redirect({ to: '/login' })
    }
  },
  loader: async ({ params }) =>
    getProfile({ data: { profileId: params.profileId } }),
  component: ProfileEditorPage,
})

type DayDraft = {
  id: string
  name: string
  description: string
  isCardio: boolean
}

function toDrafts(
  days: Array<{
    id: string
    name: string
    description: string | null
    isCardio: boolean
  }>,
): DayDraft[] {
  return days.map((day) => ({
    id: day.id,
    name: day.name,
    description: day.description ?? '',
    isCardio: day.isCardio,
  }))
}

function ProfileEditorPage() {
  const data = Route.useLoaderData()
  const navigate = useNavigate()
  const router = useRouter()

  const renameProfileFn = useServerFn(renameProfile)
  const setActiveProfileFn = useServerFn(setActiveProfile)
  const duplicateProfileFn = useServerFn(duplicateProfile)
  const deleteProfileFn = useServerFn(deleteProfile)
  const addDayFn = useServerFn(addDay)
  const updateDayFn = useServerFn(updateDay)
  const moveDayFn = useServerFn(moveDay)
  const deleteDayFn = useServerFn(deleteDay)

  const [name, setName] = useState(data.profile.name)
  const [days, setDays] = useState<DayDraft[]>(() => toDrafts(data.days))
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setName(data.profile.name)
    setDays(toDrafts(data.days))
  }, [data.profile.name, data.days])

  const run = (action: () => Promise<unknown>, failure: string) => {
    startTransition(async () => {
      setError(null)
      try {
        await action()
      } catch {
        setError(failure)
      }
    })
  }

  const persistName = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Enter a profile name')
      return
    }
    if (trimmed === data.profile.name) return
    run(async () => {
      await renameProfileFn({
        data: { profileId: data.profile.id, name: trimmed },
      })
      await router.invalidate()
    }, 'Could not rename profile')
  }

  const persistDay = (
    day: DayDraft,
    patch: { name?: string; description?: string; isCardio?: boolean },
  ) => {
    const saved = data.days.find((item) => item.id === day.id)
    if (patch.name !== undefined) {
      if (!patch.name.trim()) {
        setError('Enter a day name')
        return
      }
      if (patch.name.trim() === saved?.name) return
    }
    if (
      patch.description !== undefined &&
      patch.description.trim() === (saved?.description ?? '')
    ) {
      return
    }
    run(async () => {
      await updateDayFn({ data: { dayId: day.id, ...patch } })
      await router.invalidate()
    }, 'Could not save day')
  }

  const updateDraft = (dayId: string, patch: Partial<DayDraft>) => {
    setDays((prev) =>
      prev.map((day) => (day.id === dayId ? { ...day, ...patch } : day)),
    )
  }

  const onDeleteDay = (day: DayDraft) => {
    if (
      !window.confirm(
        `Remove ${day.name}? Past sessions keep their name and sets, but this day's favorites are removed.`,
      )
    ) {
      return
    }
    run(async () => {
      await deleteDayFn({ data: { dayId: day.id } })
      await router.invalidate()
    }, 'Could not remove day')
  }

  const onDeleteProfile = () => {
    if (
      !window.confirm(
        `Delete ${data.profile.name}? Past sessions keep their names and sets, but this profile's days and favorites are removed.`,
      )
    ) {
      return
    }
    run(async () => {
      await deleteProfileFn({ data: { profileId: data.profile.id } })
      await router.invalidate()
      await navigate({ to: '/profiles' })
    }, 'Could not delete profile')
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-lg flex-col px-4 py-8">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.18em] text-[var(--kicker)] uppercase">
            {data.isActive ? 'Active profile' : 'Profile'}
          </p>
          <h1 className="mt-2 break-words font-heading text-3xl font-medium tracking-tight text-[var(--sea-ink)]">
            {data.profile.name}
          </h1>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            void navigate({ to: '/profiles' })
          }}
        >
          Back
        </Button>
      </header>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="profile-name">Name</Label>
          <Input
            id="profile-name"
            value={name}
            disabled={isPending}
            className="h-11 text-base"
            onChange={(event) => setName(event.target.value)}
            onBlur={persistName}
          />
        </div>

        <section>
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-[var(--sea-ink-soft)] uppercase">
            Days ({days.length})
          </h2>
          <ol className="border border-[var(--line)] bg-[var(--surface)]">
            {days.map((day, index) => (
              <li
                key={day.id}
                className="space-y-2 border-b border-[var(--line)] px-3 py-3 last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-sm text-[var(--sea-ink-soft)]">
                    {index + 1}
                  </span>
                  <Input
                    aria-label={`Day ${index + 1} name`}
                    value={day.name}
                    disabled={isPending}
                    className="h-10 text-base"
                    onChange={(event) =>
                      updateDraft(day.id, { name: event.target.value })
                    }
                    onBlur={(event) =>
                      persistDay(day, { name: event.target.value })
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Move ${day.name} up`}
                    disabled={isPending || index === 0}
                    onClick={() =>
                      run(async () => {
                        await moveDayFn({
                          data: { dayId: day.id, direction: 'up' },
                        })
                        await router.invalidate()
                      }, 'Could not reorder days')
                    }
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Move ${day.name} down`}
                    disabled={isPending || index === days.length - 1}
                    onClick={() =>
                      run(async () => {
                        await moveDayFn({
                          data: { dayId: day.id, direction: 'down' },
                        })
                        await router.invalidate()
                      }, 'Could not reorder days')
                    }
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${day.name}`}
                    disabled={isPending || days.length <= 1}
                    onClick={() => onDeleteDay(day)}
                    className="hover:text-destructive"
                  >
                    <Trash />
                  </Button>
                </div>
                <div className="flex items-center gap-3 pl-7">
                  <Input
                    aria-label={`${day.name} description`}
                    value={day.description}
                    disabled={isPending}
                    placeholder="Description (optional)"
                    className="h-9 text-sm"
                    onChange={(event) =>
                      updateDraft(day.id, { description: event.target.value })
                    }
                    onBlur={(event) =>
                      persistDay(day, { description: event.target.value })
                    }
                  />
                  <label className="flex shrink-0 items-center gap-1.5 text-sm text-[var(--sea-ink-soft)]">
                    <input
                      type="checkbox"
                      checked={day.isCardio}
                      disabled={isPending}
                      onChange={(event) => {
                        updateDraft(day.id, {
                          isCardio: event.target.checked,
                        })
                        persistDay(day, { isCardio: event.target.checked })
                      }}
                    />
                    Cardio
                  </label>
                </div>
              </li>
            ))}
          </ol>
          <Button
            variant="secondary"
            className="mt-3"
            disabled={isPending || days.length >= MAX_DAYS_PER_PROFILE}
            onClick={() =>
              run(async () => {
                await addDayFn({
                  data: {
                    profileId: data.profile.id,
                    name: `Day ${days.length + 1}`,
                  },
                })
                await router.invalidate()
              }, 'Could not add day')
            }
          >
            Add day
          </Button>
          <p className="mt-2 text-sm text-[var(--sea-ink-soft)]">
            Exercises added on a cardio day default to cardio logging instead
            of weight and reps.
          </p>
        </section>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <section className="flex flex-wrap gap-2 border-t border-[var(--line)] pt-6">
          {data.isActive ? null : (
            <Button
              disabled={isPending}
              onClick={() =>
                run(async () => {
                  await setActiveProfileFn({
                    data: { profileId: data.profile.id },
                  })
                  await router.invalidate()
                  await navigate({ to: '/' })
                }, 'Could not switch profile')
              }
            >
              Use this profile
            </Button>
          )}
          <Button
            variant="secondary"
            disabled={isPending}
            onClick={() =>
              run(async () => {
                const { profileId } = await duplicateProfileFn({
                  data: { profileId: data.profile.id },
                })
                await navigate({
                  to: '/profiles/$profileId',
                  params: { profileId },
                })
              }, 'Could not duplicate profile')
            }
          >
            Duplicate
          </Button>
          {data.canDelete ? (
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={onDeleteProfile}
            >
              Delete profile
            </Button>
          ) : null}
        </section>
      </div>
    </main>
  )
}
