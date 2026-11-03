import { and, asc, eq } from 'drizzle-orm'
import type { getDb } from '#/db'
import {
  userSettings,
  workoutDays,
  workoutProfiles,
} from '#/db/workout.schema'
import {
  DEFAULT_PROFILE_DAYS,
  DEFAULT_PROFILE_NAME,
} from '#/lib/workout-profiles'
import type { ProfileDayTemplate } from '#/lib/workout-profiles'

type Db = ReturnType<typeof getDb>

function firstRow<T>(rows: T[]): T | undefined {
  return rows.length > 0 ? rows[0] : undefined
}

export async function insertProfileWithDays(
  db: Db,
  userId: string,
  name: string,
  days: ProfileDayTemplate[],
) {
  const profileId = crypto.randomUUID()
  const createdRows = await db
    .insert(workoutProfiles)
    .values({ id: profileId, userId, name })
    .returning()

  const profile = firstRow(createdRows)
  if (!profile) throw new Error('Failed to create profile')

  const dayRows = days.map((day, sortOrder) => ({
    id: crypto.randomUUID(),
    profileId,
    name: day.name,
    description: day.description,
    isCardio: day.isCardio,
    sortOrder,
  }))
  if (dayRows.length > 0) {
    await db.insert(workoutDays).values(dayRows)
  }

  return { profile, dayIds: dayRows.map((row) => row.id) }
}

export async function setActiveProfileId(
  db: Db,
  userId: string,
  profileId: string,
) {
  await db
    .insert(userSettings)
    .values({ userId, activeProfileId: profileId })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { activeProfileId: profileId },
    })
}

/**
 * The user's active profile. Falls back to their oldest profile, and creates
 * the default split for users who have none yet.
 */
export async function ensureActiveProfile(db: Db, userId: string) {
  const activeRows = await db
    .select({ profile: workoutProfiles })
    .from(userSettings)
    .innerJoin(
      workoutProfiles,
      eq(userSettings.activeProfileId, workoutProfiles.id),
    )
    .where(
      and(
        eq(userSettings.userId, userId),
        eq(workoutProfiles.userId, userId),
      ),
    )
    .limit(1)

  const active = firstRow(activeRows)
  if (active) return active.profile

  const oldestRows = await db
    .select()
    .from(workoutProfiles)
    .where(eq(workoutProfiles.userId, userId))
    .orderBy(asc(workoutProfiles.createdAt))
    .limit(1)

  const profile =
    firstRow(oldestRows) ??
    (
      await insertProfileWithDays(
        db,
        userId,
        DEFAULT_PROFILE_NAME,
        DEFAULT_PROFILE_DAYS,
      )
    ).profile

  await setActiveProfileId(db, userId, profile.id)
  return profile
}

export async function requireOwnedProfile(
  db: Db,
  userId: string,
  profileId: string,
) {
  const rows = await db
    .select()
    .from(workoutProfiles)
    .where(
      and(
        eq(workoutProfiles.id, profileId),
        eq(workoutProfiles.userId, userId),
      ),
    )
    .limit(1)

  const profile = firstRow(rows)
  if (!profile) throw new Error('Profile not found')
  return profile
}

export async function requireOwnedDay(db: Db, userId: string, dayId: string) {
  const rows = await db
    .select({ day: workoutDays })
    .from(workoutDays)
    .innerJoin(workoutProfiles, eq(workoutDays.profileId, workoutProfiles.id))
    .where(and(eq(workoutDays.id, dayId), eq(workoutProfiles.userId, userId)))
    .limit(1)

  const row = firstRow(rows)
  if (!row) throw new Error('Day not found')
  return row.day
}

export async function listProfileDays(db: Db, profileId: string) {
  return db
    .select()
    .from(workoutDays)
    .where(eq(workoutDays.profileId, profileId))
    .orderBy(asc(workoutDays.sortOrder))
}
