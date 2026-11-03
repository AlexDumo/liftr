import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { and, asc, count, desc, eq, inArray, ne, sql } from 'drizzle-orm'
import { getDb } from '#/db'
import {
  dayFavorites,
  workoutDays,
  workoutProfiles,
  workouts,
} from '#/db/workout.schema'
import { getSession } from '#/lib/auth-session'
import {
  ensureActiveProfile,
  insertProfileWithDays,
  listProfileDays,
  requireOwnedDay,
  requireOwnedProfile,
  setActiveProfileId,
} from '#/lib/profile.server'
import {
  MAX_DAYS_PER_PROFILE,
  PROFILE_NAME_MAX_LENGTH,
  blankProfileDays,
  moveInOrder,
  validateDayDescription,
  validateDayName,
  validateProfileName,
} from '#/lib/workout-profiles'

function firstRow<T>(rows: T[]): T | undefined {
  return rows.length > 0 ? rows[0] : undefined
}

async function requireUser() {
  const session = await getSession()
  if (!session?.user) {
    throw redirect({ to: '/login' })
  }
  return session.user
}

function mapDay(day: typeof workoutDays.$inferSelect) {
  return {
    id: day.id,
    name: day.name,
    description: day.description,
    isCardio: day.isCardio,
  }
}

/** Active profile, its days, and when each day was last completed (ISO). */
export const getActiveProfile = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await requireUser()
    const db = getDb()

    const profile = await ensureActiveProfile(db, user.id)
    const days = await listProfileDays(db, profile.id)

    const lastCompletedByDayId: Record<string, string> = {}
    if (days.length > 0) {
      const sessionDate = sql<number>`max(coalesce(${workouts.completedAt}, ${workouts.startedAt}))`
      const rows = await db
        .select({ dayId: workouts.dayId, when: sessionDate })
        .from(workouts)
        .where(
          and(
            eq(workouts.userId, user.id),
            eq(workouts.status, 'completed'),
            inArray(
              workouts.dayId,
              days.map((day) => day.id),
            ),
          ),
        )
        .groupBy(workouts.dayId)

      for (const row of rows) {
        if (row.dayId) {
          lastCompletedByDayId[row.dayId] = new Date(row.when).toISOString()
        }
      }
    }

    return {
      profile: { id: profile.id, name: profile.name },
      days: days.map(mapDay),
      lastCompletedByDayId,
    }
  },
)

export const listProfiles = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await requireUser()
    const db = getDb()

    const active = await ensureActiveProfile(db, user.id)

    const profiles = await db
      .select()
      .from(workoutProfiles)
      .where(eq(workoutProfiles.userId, user.id))
      .orderBy(asc(workoutProfiles.createdAt))

    const days = await db
      .select({ profileId: workoutDays.profileId, name: workoutDays.name })
      .from(workoutDays)
      .innerJoin(workoutProfiles, eq(workoutDays.profileId, workoutProfiles.id))
      .where(eq(workoutProfiles.userId, user.id))
      .orderBy(asc(workoutDays.sortOrder))

    return profiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
      isActive: profile.id === active.id,
      dayNames: days
        .filter((day) => day.profileId === profile.id)
        .map((day) => day.name),
    }))
  },
)

export const getProfile = createServerFn({ method: 'GET' })
  .validator((data: { profileId: string }) => {
    if (!data.profileId) throw new Error('profileId is required')
    return data
  })
  .handler(async ({ data }) => {
    const user = await requireUser()
    const db = getDb()

    const profile = await requireOwnedProfile(db, user.id, data.profileId)
    const [days, active, profileCountRows] = await Promise.all([
      listProfileDays(db, profile.id),
      ensureActiveProfile(db, user.id),
      db
        .select({ value: count() })
        .from(workoutProfiles)
        .where(eq(workoutProfiles.userId, user.id)),
    ])

    return {
      profile: { id: profile.id, name: profile.name },
      days: days.map(mapDay),
      isActive: active.id === profile.id,
      canDelete: (firstRow(profileCountRows)?.value ?? 0) > 1,
    }
  })

export const createProfile = createServerFn({ method: 'POST' })
  .validator((data: { name: string; dayCount: number }) => ({
    name: validateProfileName(data.name),
    days: blankProfileDays(data.dayCount),
  }))
  .handler(async ({ data }) => {
    const user = await requireUser()
    const db = getDb()

    const { profile } = await insertProfileWithDays(
      db,
      user.id,
      data.name,
      data.days,
    )
    return { profileId: profile.id }
  })

/** Copies a profile's days and per-day favorites into a new profile. */
export const duplicateProfile = createServerFn({ method: 'POST' })
  .validator((data: { profileId: string }) => {
    if (!data.profileId) throw new Error('profileId is required')
    return data
  })
  .handler(async ({ data }) => {
    const user = await requireUser()
    const db = getDb()

    const source = await requireOwnedProfile(db, user.id, data.profileId)
    const sourceDays = await listProfileDays(db, source.id)

    const { profile, dayIds } = await insertProfileWithDays(
      db,
      user.id,
      validateProfileName(
        `${source.name} (copy)`.slice(0, PROFILE_NAME_MAX_LENGTH),
      ),
      sourceDays,
    )

    if (sourceDays.length > 0) {
      const favorites = await db
        .select()
        .from(dayFavorites)
        .where(
          and(
            eq(dayFavorites.userId, user.id),
            inArray(
              dayFavorites.dayId,
              sourceDays.map((day) => day.id),
            ),
          ),
        )

      const newDayIdBySourceId = new Map(
        sourceDays.map((day, index) => [day.id, dayIds[index]]),
      )
      const copies = favorites.flatMap((favorite) => {
        const dayId = newDayIdBySourceId.get(favorite.dayId)
        return dayId
          ? [{ userId: user.id, exerciseId: favorite.exerciseId, dayId }]
          : []
      })
      if (copies.length > 0) {
        await db.insert(dayFavorites).values(copies)
      }
    }

    return { profileId: profile.id }
  })

export const renameProfile = createServerFn({ method: 'POST' })
  .validator((data: { profileId: string; name: string }) => {
    if (!data.profileId) throw new Error('profileId is required')
    return { profileId: data.profileId, name: validateProfileName(data.name) }
  })
  .handler(async ({ data }) => {
    const user = await requireUser()
    const db = getDb()

    await requireOwnedProfile(db, user.id, data.profileId)
    await db
      .update(workoutProfiles)
      .set({ name: data.name })
      .where(eq(workoutProfiles.id, data.profileId))

    return { name: data.name }
  })

export const setActiveProfile = createServerFn({ method: 'POST' })
  .validator((data: { profileId: string }) => {
    if (!data.profileId) throw new Error('profileId is required')
    return data
  })
  .handler(async ({ data }) => {
    const user = await requireUser()
    const db = getDb()

    await requireOwnedProfile(db, user.id, data.profileId)
    await setActiveProfileId(db, user.id, data.profileId)
    return { ok: true as const }
  })

/**
 * Deletes a profile and its days. Past sessions keep their day name; only the
 * link back to the day is cleared.
 */
export const deleteProfile = createServerFn({ method: 'POST' })
  .validator((data: { profileId: string }) => {
    if (!data.profileId) throw new Error('profileId is required')
    return data
  })
  .handler(async ({ data }) => {
    const user = await requireUser()
    const db = getDb()

    await requireOwnedProfile(db, user.id, data.profileId)

    const otherRows = await db
      .select()
      .from(workoutProfiles)
      .where(
        and(
          eq(workoutProfiles.userId, user.id),
          ne(workoutProfiles.id, data.profileId),
        ),
      )
      .orderBy(desc(workoutProfiles.createdAt))
      .limit(1)

    const fallback = firstRow(otherRows)
    if (!fallback) {
      throw new Error('You need at least one profile')
    }

    const active = await ensureActiveProfile(db, user.id)
    if (active.id === data.profileId) {
      await setActiveProfileId(db, user.id, fallback.id)
    }

    await db
      .delete(workoutProfiles)
      .where(eq(workoutProfiles.id, data.profileId))

    return { ok: true as const }
  })

export const addDay = createServerFn({ method: 'POST' })
  .validator((data: { profileId: string; name: string }) => {
    if (!data.profileId) throw new Error('profileId is required')
    return { profileId: data.profileId, name: validateDayName(data.name) }
  })
  .handler(async ({ data }) => {
    const user = await requireUser()
    const db = getDb()

    await requireOwnedProfile(db, user.id, data.profileId)
    const days = await listProfileDays(db, data.profileId)
    if (days.length >= MAX_DAYS_PER_PROFILE) {
      throw new Error(`A profile can have at most ${MAX_DAYS_PER_PROFILE} days`)
    }

    const createdRows = await db
      .insert(workoutDays)
      .values({
        id: crypto.randomUUID(),
        profileId: data.profileId,
        name: data.name,
        sortOrder: (days.at(-1)?.sortOrder ?? -1) + 1,
      })
      .returning()

    const created = firstRow(createdRows)
    if (!created) throw new Error('Failed to add day')
    return mapDay(created)
  })

export const updateDay = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      dayId: string
      name?: string
      description?: string | null
      isCardio?: boolean
    }) => {
      if (!data.dayId) throw new Error('dayId is required')
      if (data.isCardio !== undefined && typeof data.isCardio !== 'boolean') {
        throw new Error('isCardio must be a boolean')
      }
      return {
        dayId: data.dayId,
        name: data.name === undefined ? undefined : validateDayName(data.name),
        description:
          data.description === undefined
            ? undefined
            : validateDayDescription(data.description),
        isCardio: data.isCardio,
      }
    },
  )
  .handler(async ({ data }) => {
    const user = await requireUser()
    const db = getDb()

    await requireOwnedDay(db, user.id, data.dayId)

    const updatedRows = await db
      .update(workoutDays)
      .set({
        name: data.name,
        description: data.description,
        isCardio: data.isCardio,
      })
      .where(eq(workoutDays.id, data.dayId))
      .returning()

    const updated = firstRow(updatedRows)
    if (!updated) throw new Error('Failed to update day')

    // Keep an in-progress session's label in step with the day it belongs to.
    if (data.name !== undefined) {
      await db
        .update(workouts)
        .set({ dayName: updated.name })
        .where(
          and(
            eq(workouts.dayId, updated.id),
            eq(workouts.status, 'in_progress'),
          ),
        )
    }

    return mapDay(updated)
  })

export const moveDay = createServerFn({ method: 'POST' })
  .validator((data: { dayId: string; direction: 'up' | 'down' }) => {
    if (!data.dayId) throw new Error('dayId is required')
    if (!(['up', 'down'] as const).includes(data.direction)) {
      throw new Error('Invalid direction')
    }
    return data
  })
  .handler(async ({ data }) => {
    const user = await requireUser()
    const db = getDb()

    const day = await requireOwnedDay(db, user.id, data.dayId)
    const days = await listProfileDays(db, day.profileId)
    const reordered = moveInOrder(
      days,
      days.findIndex((item) => item.id === day.id),
      data.direction,
    )

    for (const [sortOrder, item] of reordered.entries()) {
      if (item.sortOrder === sortOrder) continue
      await db
        .update(workoutDays)
        .set({ sortOrder })
        .where(eq(workoutDays.id, item.id))
    }

    return { ok: true as const }
  })

/** Removes a day. Past sessions keep their day name. */
export const deleteDay = createServerFn({ method: 'POST' })
  .validator((data: { dayId: string }) => {
    if (!data.dayId) throw new Error('dayId is required')
    return data
  })
  .handler(async ({ data }) => {
    const user = await requireUser()
    const db = getDb()

    const day = await requireOwnedDay(db, user.id, data.dayId)
    const countRows = await db
      .select({ value: count() })
      .from(workoutDays)
      .where(eq(workoutDays.profileId, day.profileId))

    if ((firstRow(countRows)?.value ?? 0) <= 1) {
      throw new Error('A profile needs at least one day')
    }

    await db.delete(workoutDays).where(eq(workoutDays.id, day.id))
    return { ok: true as const }
  })
