import { and, asc, eq } from 'drizzle-orm'
import type { getDb } from '#/db'
import {
  dayFavorites,
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

// D1 caps a query at 100 bound parameters; a favorite row binds 3 (plus
// the defaulted created_at), so stay well under that.
const FAVORITE_INSERT_CHUNK = 25

/**
 * Creates a profile, its days, and optionally per-day favorites in one D1
 * batch, so a failure never leaves a half-built profile. Pass `id` for a
 * deterministic profile (day ids derive from it); repeats are then no-ops.
 */
export async function insertProfileWithDays(
  db: Db,
  userId: string,
  name: string,
  days: ProfileDayTemplate[],
  options: {
    id?: string
    favorites?: Array<{ exerciseId: string; dayIndex: number }>
  } = {},
) {
  const profileId = options.id ?? crypto.randomUUID()
  const dayRows = days.map((day, sortOrder) => ({
    id: options.id ? `${options.id}-${sortOrder}` : crypto.randomUUID(),
    profileId,
    name: day.name,
    description: day.description,
    isCardio: day.isCardio,
    sortOrder,
  }))

  const favoriteRows = (options.favorites ?? []).flatMap((favorite) => {
    const day = dayRows.at(favorite.dayIndex)
    return day
      ? [{ userId, exerciseId: favorite.exerciseId, dayId: day.id }]
      : []
  })
  const favoriteInserts = Array.from(
    { length: Math.ceil(favoriteRows.length / FAVORITE_INSERT_CHUNK) },
    (_, chunk) =>
      db
        .insert(dayFavorites)
        .values(
          favoriteRows.slice(
            chunk * FAVORITE_INSERT_CHUNK,
            (chunk + 1) * FAVORITE_INSERT_CHUNK,
          ),
        )
        .onConflictDoNothing(),
  )

  await db.batch([
    db
      .insert(workoutProfiles)
      .values({ id: profileId, userId, name })
      .onConflictDoNothing(),
    ...(dayRows.length > 0
      ? [db.insert(workoutDays).values(dayRows).onConflictDoNothing()]
      : []),
    ...favoriteInserts,
  ])

  return { profile: await requireOwnedProfile(db, userId, profileId) }
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
        // Deterministic, so concurrent first loads can't create two defaults.
        { id: `default-${userId}` },
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
