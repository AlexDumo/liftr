import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { getDb } from '#/db'
import { userSettings } from '#/db/workout.schema'
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
      bodyWeightLbs: settings?.bodyWeightLbs ?? null,
    }
  },
)

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
