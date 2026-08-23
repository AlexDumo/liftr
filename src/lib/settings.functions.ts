import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { getDb } from '#/db'
import { users } from '#/db/auth.schema'
import { userSettings, DEFAULT_MIN_REPS_FOR_MAX } from '#/db/workout.schema'
import { getSession } from '#/lib/auth-session'

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

export const getUserSettings = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await requireUser()
    const db = getDb()

    const rows = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, user.id))
      .limit(1)

    const settings = firstRow(rows)
    return {
      name: user.name,
      bodyWeightLbs: settings?.bodyWeightLbs ?? null,
      minRepsForMax: settings?.minRepsForMax ?? DEFAULT_MIN_REPS_FOR_MAX,
    }
  },
)

export const updateUserName = createServerFn({ method: 'POST' })
  .validator((data: { name: string }) => {
    const name = data.name.trim()
    if (!name) {
      throw new Error('Name is required')
    }
    if (name.length > 100) {
      throw new Error('Name is too long')
    }
    return { name }
  })
  .handler(async ({ data }) => {
    const user = await requireUser()
    const db = getDb()

    const updatedRows = await db
      .update(users)
      .set({ name: data.name, updatedAt: new Date() })
      .where(eq(users.id, user.id))
      .returning({ name: users.name })

    const updated = firstRow(updatedRows)
    if (!updated) throw new Error('Failed to update name')
    return { name: updated.name }
  })

export const updateBodyWeight = createServerFn({ method: 'POST' })
  .validator((data: { bodyWeightLbs: number | null }) => {
    if (
      data.bodyWeightLbs !== null &&
      (typeof data.bodyWeightLbs !== 'number' ||
        !Number.isFinite(data.bodyWeightLbs) ||
        data.bodyWeightLbs <= 0)
    ) {
      throw new Error('Invalid body weight')
    }
    return data
  })
  .handler(async ({ data }) => {
    const user = await requireUser()
    const db = getDb()

    const existingRows = await db
      .select({ userId: userSettings.userId })
      .from(userSettings)
      .where(eq(userSettings.userId, user.id))
      .limit(1)

    if (firstRow(existingRows)) {
      const updatedRows = await db
        .update(userSettings)
        .set({ bodyWeightLbs: data.bodyWeightLbs })
        .where(eq(userSettings.userId, user.id))
        .returning()
      const updated = firstRow(updatedRows)
      if (!updated) throw new Error('Failed to update settings')
      return { bodyWeightLbs: updated.bodyWeightLbs }
    }

    const insertedRows = await db
      .insert(userSettings)
      .values({
        userId: user.id,
        bodyWeightLbs: data.bodyWeightLbs,
      })
      .returning()

    const inserted = firstRow(insertedRows)
    if (!inserted) throw new Error('Failed to create settings')
    return { bodyWeightLbs: inserted.bodyWeightLbs }
  })

export const updateMinRepsForMax = createServerFn({ method: 'POST' })
  .validator((data: { minRepsForMax: number }) => {
    if (
      typeof data.minRepsForMax !== 'number' ||
      !Number.isInteger(data.minRepsForMax) ||
      data.minRepsForMax < 1 ||
      data.minRepsForMax > 50
    ) {
      throw new Error('Min reps must be an integer between 1 and 50')
    }
    return data
  })
  .handler(async ({ data }) => {
    const user = await requireUser()
    const db = getDb()

    const existingRows = await db
      .select({ userId: userSettings.userId })
      .from(userSettings)
      .where(eq(userSettings.userId, user.id))
      .limit(1)

    if (firstRow(existingRows)) {
      const updatedRows = await db
        .update(userSettings)
        .set({ minRepsForMax: data.minRepsForMax })
        .where(eq(userSettings.userId, user.id))
        .returning()
      const updated = firstRow(updatedRows)
      if (!updated) throw new Error('Failed to update settings')
      return { minRepsForMax: updated.minRepsForMax }
    }

    const insertedRows = await db
      .insert(userSettings)
      .values({
        userId: user.id,
        minRepsForMax: data.minRepsForMax,
      })
      .returning()

    const inserted = firstRow(insertedRows)
    if (!inserted) throw new Error('Failed to create settings')
    return { minRepsForMax: inserted.minRepsForMax }
  })
