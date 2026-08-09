import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { and, asc, count, desc, eq, like } from 'drizzle-orm'
import { getDb } from '#/db'
import {
  dayTypes,
  exerciseFavorites,
  exercises,
  userExerciseWeightPrefs,
  userSettings,
  workoutExercises,
  workouts,
  workoutSets,
} from '#/db/workout.schema'
import type { DayType, WeightInputType } from '#/db/workout.schema'
import { getSession } from '#/lib/auth-session'
import {
  DEFAULT_BAR_WEIGHT_LBS,
  defaultWeightInputType,
  isWeightInputType,
} from '#/lib/weight-input'

const IMAGE_BASE =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'

export function exerciseImageUrl(imagesJson: string): string | null {
  try {
    const images = JSON.parse(imagesJson) as unknown
    if (!Array.isArray(images) || typeof images[0] !== 'string') return null
    return `${IMAGE_BASE}${images[0]}`
  } catch {
    return null
  }
}

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

function isDayType(value: unknown): value is DayType {
  return typeof value === 'string' && (dayTypes as readonly string[]).includes(value)
}

function createId() {
  return crypto.randomUUID()
}

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

function mapExerciseRow(
  row: typeof exercises.$inferSelect,
  favorited: boolean,
) {
  const instructions = parseJsonArray(row.instructions)
  const description =
    instructions.find((step) => step.trim().length > 0)?.trim() ?? null

  return {
    id: row.id,
    name: row.name,
    force: row.force,
    level: row.level,
    mechanic: row.mechanic,
    equipment: row.equipment,
    category: row.category,
    primaryMuscles: parseJsonArray(row.primaryMuscles),
    secondaryMuscles: parseJsonArray(row.secondaryMuscles),
    imageUrl: exerciseImageUrl(row.images),
    description,
    favorited,
  }
}

export const getActiveWorkout = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await requireUser()
    const db = getDb()
    const rows = await db
      .select()
      .from(workouts)
      .where(
        and(eq(workouts.userId, user.id), eq(workouts.status, 'in_progress')),
      )
      .orderBy(desc(workouts.startedAt))
      .limit(1)

    return firstRow(rows) ?? null
  },
)

/** Latest completed workout date (ISO) per day type for the current user. */
export const getLastCompletedByDayType = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await requireUser()
    const db = getDb()

    const rows = await db
      .select({
        dayType: workouts.dayType,
        completedAt: workouts.completedAt,
        startedAt: workouts.startedAt,
      })
      .from(workouts)
      .where(
        and(eq(workouts.userId, user.id), eq(workouts.status, 'completed')),
      )
      .orderBy(desc(workouts.completedAt), desc(workouts.startedAt))

    const lastByDayType: Partial<Record<DayType, string>> = {}
    for (const row of rows) {
      if (lastByDayType[row.dayType]) continue
      const when = row.completedAt ?? row.startedAt
      lastByDayType[row.dayType] = when.toISOString()
      if (Object.keys(lastByDayType).length === dayTypes.length) break
    }

    return lastByDayType
  },
)

export const startWorkout = createServerFn({ method: 'POST' })
  .validator((data: { dayType: DayType }) => {
    if (!isDayType(data.dayType)) {
      throw new Error('Invalid day type')
    }
    return data
  })
  .handler(async ({ data }) => {
    const user = await requireUser()
    const db = getDb()

    const existingRows = await db
      .select()
      .from(workouts)
      .where(
        and(
          eq(workouts.userId, user.id),
          eq(workouts.status, 'in_progress'),
          eq(workouts.dayType, data.dayType),
        ),
      )
      .limit(1)

    const existing = firstRow(existingRows)
    if (existing) {
      return existing
    }

    // One in-progress workout at a time: complete others for this user.
    await db
      .update(workouts)
      .set({ status: 'completed', completedAt: new Date() })
      .where(
        and(eq(workouts.userId, user.id), eq(workouts.status, 'in_progress')),
      )

    const id = createId()
    const createdRows = await db
      .insert(workouts)
      .values({
        id,
        userId: user.id,
        dayType: data.dayType,
        status: 'in_progress',
      })
      .returning()

    const created = firstRow(createdRows)
    if (!created) {
      throw new Error('Failed to create workout')
    }
    return created
  })

export const getWorkout = createServerFn({ method: 'GET' })
  .validator((data: { workoutId: string }) => {
    if (!data.workoutId) throw new Error('workoutId is required')
    return data
  })
  .handler(async ({ data }) => {
    const user = await requireUser()
    const db = getDb()

    const workoutRows = await db
      .select()
      .from(workouts)
      .where(and(eq(workouts.id, data.workoutId), eq(workouts.userId, user.id)))
      .limit(1)

    const workout = firstRow(workoutRows)
    if (!workout) {
      throw new Error('Workout not found')
    }

    const rows = await db
      .select({
        workoutExercise: workoutExercises,
        exercise: exercises,
        set: workoutSets,
      })
      .from(workoutExercises)
      .innerJoin(exercises, eq(workoutExercises.exerciseId, exercises.id))
      .leftJoin(
        workoutSets,
        eq(workoutSets.workoutExerciseId, workoutExercises.id),
      )
      .where(eq(workoutExercises.workoutId, workout.id))
      .orderBy(asc(workoutExercises.sortOrder), asc(workoutSets.setIndex))

    const byExercise = new Map<
      string,
      {
        id: string
        sortOrder: number
        exercise: ReturnType<typeof mapExerciseRow>
        sets: Array<{
          id: string
          setIndex: number
          weight: number | null
          reps: number | null
        }>
      }
    >()

    for (const row of rows) {
      let entry = byExercise.get(row.workoutExercise.id)
      if (!entry) {
        entry = {
          id: row.workoutExercise.id,
          sortOrder: row.workoutExercise.sortOrder,
          exercise: mapExerciseRow(row.exercise, false),
          sets: [],
        }
        byExercise.set(row.workoutExercise.id, entry)
      }
      if (row.set) {
        entry.sets.push({
          id: row.set.id,
          setIndex: row.set.setIndex,
          weight: row.set.weight,
          reps: row.set.reps,
        })
      }
    }

    return {
      workout,
      exercises: [...byExercise.values()],
    }
  })

export const completeWorkout = createServerFn({ method: 'POST' })
  .validator((data: { workoutId: string }) => {
    if (!data.workoutId) throw new Error('workoutId is required')
    return data
  })
  .handler(async ({ data }) => {
    const user = await requireUser()
    const db = getDb()

    const updatedRows = await db
      .update(workouts)
      .set({ status: 'completed', completedAt: new Date() })
      .where(
        and(
          eq(workouts.id, data.workoutId),
          eq(workouts.userId, user.id),
          eq(workouts.status, 'in_progress'),
        ),
      )
      .returning()

    const updated = firstRow(updatedRows)
    if (!updated) {
      throw new Error('Workout not found or already completed')
    }

    return updated
  })

export const listWorkouts = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await requireUser()
    const db = getDb()

    const rows = await db
      .select({
        id: workouts.id,
        dayType: workouts.dayType,
        status: workouts.status,
        startedAt: workouts.startedAt,
        completedAt: workouts.completedAt,
        exerciseCount: count(workoutExercises.id),
      })
      .from(workouts)
      .leftJoin(workoutExercises, eq(workoutExercises.workoutId, workouts.id))
      .where(eq(workouts.userId, user.id))
      .groupBy(
        workouts.id,
        workouts.dayType,
        workouts.status,
        workouts.startedAt,
        workouts.completedAt,
      )
      .orderBy(desc(workouts.startedAt), desc(workouts.completedAt))

    return rows
  },
)

export const deleteWorkout = createServerFn({ method: 'POST' })
  .validator((data: { workoutId: string }) => {
    if (!data.workoutId) throw new Error('workoutId is required')
    return data
  })
  .handler(async ({ data }) => {
    const user = await requireUser()
    const db = getDb()

    const deletedRows = await db
      .delete(workouts)
      .where(and(eq(workouts.id, data.workoutId), eq(workouts.userId, user.id)))
      .returning()

    if (!firstRow(deletedRows)) {
      throw new Error('Workout not found')
    }

    return { ok: true as const }
  })

export const listFavorites = createServerFn({ method: 'GET' })
  .validator((data: { dayType: DayType }) => {
    if (!isDayType(data.dayType)) throw new Error('Invalid day type')
    return data
  })
  .handler(async ({ data }) => {
    const user = await requireUser()
    const db = getDb()

    const rows = await db
      .select({ exercise: exercises })
      .from(exerciseFavorites)
      .innerJoin(exercises, eq(exerciseFavorites.exerciseId, exercises.id))
      .where(
        and(
          eq(exerciseFavorites.userId, user.id),
          eq(exerciseFavorites.dayType, data.dayType),
        ),
      )
      .orderBy(asc(exercises.name))

    return rows.map((row) => mapExerciseRow(row.exercise, true))
  })

export const searchExercises = createServerFn({ method: 'GET' })
  .validator((data: { query: string; dayType: DayType }) => {
    if (!isDayType(data.dayType)) throw new Error('Invalid day type')
    return {
      query: data.query.trim(),
      dayType: data.dayType,
    }
  })
  .handler(async ({ data }) => {
    const user = await requireUser()
    if (!data.query) return []

    const db = getDb()
    const pattern = `%${data.query.replaceAll('%', '').replaceAll('_', '')}%`

    const rows = await db
      .select({
        exercise: exercises,
        favoriteUserId: exerciseFavorites.userId,
      })
      .from(exercises)
      .leftJoin(
        exerciseFavorites,
        and(
          eq(exerciseFavorites.exerciseId, exercises.id),
          eq(exerciseFavorites.userId, user.id),
          eq(exerciseFavorites.dayType, data.dayType),
        ),
      )
      .where(like(exercises.name, pattern))
      .orderBy(asc(exercises.name))
      .limit(40)

    return rows.map((row) =>
      mapExerciseRow(row.exercise, Boolean(row.favoriteUserId)),
    )
  })

export const toggleFavorite = createServerFn({ method: 'POST' })
  .validator((data: { exerciseId: string; dayType: DayType }) => {
    if (!data.exerciseId) throw new Error('exerciseId is required')
    if (!isDayType(data.dayType)) throw new Error('Invalid day type')
    return data
  })
  .handler(async ({ data }) => {
    const user = await requireUser()
    const db = getDb()

    const existingRows = await db
      .select()
      .from(exerciseFavorites)
      .where(
        and(
          eq(exerciseFavorites.userId, user.id),
          eq(exerciseFavorites.exerciseId, data.exerciseId),
          eq(exerciseFavorites.dayType, data.dayType),
        ),
      )
      .limit(1)

    if (firstRow(existingRows)) {
      await db
        .delete(exerciseFavorites)
        .where(
          and(
            eq(exerciseFavorites.userId, user.id),
            eq(exerciseFavorites.exerciseId, data.exerciseId),
            eq(exerciseFavorites.dayType, data.dayType),
          ),
        )
      return { favorited: false }
    }

    await db.insert(exerciseFavorites).values({
      userId: user.id,
      exerciseId: data.exerciseId,
      dayType: data.dayType,
    })
    return { favorited: true }
  })

export const addExerciseToWorkout = createServerFn({ method: 'POST' })
  .validator((data: { workoutId: string; exerciseId: string }) => {
    if (!data.workoutId || !data.exerciseId) {
      throw new Error('workoutId and exerciseId are required')
    }
    return data
  })
  .handler(async ({ data }) => {
    const user = await requireUser()
    const db = getDb()

    const workoutRows = await db
      .select()
      .from(workouts)
      .where(and(eq(workouts.id, data.workoutId), eq(workouts.userId, user.id)))
      .limit(1)

    const workout = firstRow(workoutRows)
    if (!workout) {
      throw new Error('Workout not found')
    }

    const exerciseRows = await db
      .select()
      .from(exercises)
      .where(eq(exercises.id, data.exerciseId))
      .limit(1)

    const exercise = firstRow(exerciseRows)
    if (!exercise) {
      throw new Error('Exercise not found')
    }

    const countRows = await db
      .select({ value: count() })
      .from(workoutExercises)
      .where(eq(workoutExercises.workoutId, workout.id))

    const existingCount = firstRow(countRows)?.value ?? 0

    const workoutExerciseId = createId()
    await db.insert(workoutExercises).values({
      id: workoutExerciseId,
      workoutId: workout.id,
      exerciseId: exercise.id,
      sortOrder: Number(existingCount),
    })

    await db.insert(workoutSets).values(
      [0, 1, 2].map((setIndex) => ({
        id: createId(),
        workoutExerciseId,
        setIndex,
        weight: null,
        reps: null,
      })),
    )

    return { workoutExerciseId }
  })

export const removeExerciseFromWorkout = createServerFn({ method: 'POST' })
  .validator((data: { workoutExerciseId: string }) => {
    if (!data.workoutExerciseId) {
      throw new Error('workoutExerciseId is required')
    }
    return data
  })
  .handler(async ({ data }) => {
    const user = await requireUser()
    const db = getDb()

    const ownedRows = await db
      .select({ workoutExercise: workoutExercises })
      .from(workoutExercises)
      .innerJoin(workouts, eq(workoutExercises.workoutId, workouts.id))
      .where(
        and(
          eq(workoutExercises.id, data.workoutExerciseId),
          eq(workouts.userId, user.id),
        ),
      )
      .limit(1)

    const owned = firstRow(ownedRows)
    if (!owned) {
      throw new Error('Workout exercise not found')
    }

    await db
      .delete(workoutExercises)
      .where(eq(workoutExercises.id, data.workoutExerciseId))

    return { ok: true as const }
  })

export const getWorkoutExercise = createServerFn({ method: 'GET' })
  .validator((data: { workoutExerciseId: string }) => {
    if (!data.workoutExerciseId) {
      throw new Error('workoutExerciseId is required')
    }
    return data
  })
  .handler(async ({ data }) => {
    const user = await requireUser()
    const db = getDb()

    const rows = await db
      .select({
        workoutExercise: workoutExercises,
        exercise: exercises,
        workout: workouts,
      })
      .from(workoutExercises)
      .innerJoin(exercises, eq(workoutExercises.exerciseId, exercises.id))
      .innerJoin(workouts, eq(workoutExercises.workoutId, workouts.id))
      .where(
        and(
          eq(workoutExercises.id, data.workoutExerciseId),
          eq(workouts.userId, user.id),
        ),
      )
      .limit(1)

    const row = firstRow(rows)
    if (!row) {
      throw new Error('Workout exercise not found')
    }

    const sets = await db
      .select()
      .from(workoutSets)
      .where(eq(workoutSets.workoutExerciseId, row.workoutExercise.id))
      .orderBy(asc(workoutSets.setIndex))

    const [prefRows, settingsRows] = await Promise.all([
      db
        .select()
        .from(userExerciseWeightPrefs)
        .where(
          and(
            eq(userExerciseWeightPrefs.userId, user.id),
            eq(userExerciseWeightPrefs.exerciseId, row.exercise.id),
          ),
        )
        .limit(1),
      db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, user.id))
        .limit(1),
    ])

    const pref = firstRow(prefRows)
    const settings = firstRow(settingsRows)
    const weightInputType =
      pref?.inputType ?? defaultWeightInputType(row.exercise.equipment)
    const barWeightLbs = pref?.barWeightLbs ?? DEFAULT_BAR_WEIGHT_LBS

    return {
      workout: row.workout,
      bodyWeightLbs: settings?.bodyWeightLbs ?? null,
      weightInputType,
      barWeightLbs,
      workoutExercise: {
        id: row.workoutExercise.id,
        sortOrder: row.workoutExercise.sortOrder,
        exercise: mapExerciseRow(row.exercise, false),
        sets: sets.map((set) => ({
          id: set.id,
          setIndex: set.setIndex,
          weight: set.weight,
          reps: set.reps,
        })),
      },
    }
  })

export const updateExerciseWeightPref = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      exerciseId: string
      inputType: WeightInputType
      barWeightLbs?: number | null
    }) => {
      if (!data.exerciseId) throw new Error('exerciseId is required')
      if (!isWeightInputType(data.inputType)) {
        throw new Error('Invalid weight input type')
      }
      if (
        data.barWeightLbs !== undefined &&
        data.barWeightLbs !== null &&
        (typeof data.barWeightLbs !== 'number' ||
          !Number.isFinite(data.barWeightLbs) ||
          data.barWeightLbs < 0)
      ) {
        throw new Error('Invalid bar weight')
      }
      return data
    },
  )
  .handler(async ({ data }) => {
    const user = await requireUser()
    const db = getDb()

    const exerciseRows = await db
      .select({ id: exercises.id })
      .from(exercises)
      .where(eq(exercises.id, data.exerciseId))
      .limit(1)

    if (!firstRow(exerciseRows)) {
      throw new Error('Exercise not found')
    }

    const existingRows = await db
      .select()
      .from(userExerciseWeightPrefs)
      .where(
        and(
          eq(userExerciseWeightPrefs.userId, user.id),
          eq(userExerciseWeightPrefs.exerciseId, data.exerciseId),
        ),
      )
      .limit(1)

    const existing = firstRow(existingRows)
    const barWeightLbs =
      data.barWeightLbs === undefined
        ? (existing?.barWeightLbs ?? null)
        : data.barWeightLbs

    if (existing) {
      const updatedRows = await db
        .update(userExerciseWeightPrefs)
        .set({
          inputType: data.inputType,
          barWeightLbs,
        })
        .where(
          and(
            eq(userExerciseWeightPrefs.userId, user.id),
            eq(userExerciseWeightPrefs.exerciseId, data.exerciseId),
          ),
        )
        .returning()

      const updated = firstRow(updatedRows)
      if (!updated) throw new Error('Failed to update weight preference')
      return {
        inputType: updated.inputType,
        barWeightLbs: updated.barWeightLbs ?? DEFAULT_BAR_WEIGHT_LBS,
      }
    }

    const insertedRows = await db
      .insert(userExerciseWeightPrefs)
      .values({
        userId: user.id,
        exerciseId: data.exerciseId,
        inputType: data.inputType,
        barWeightLbs,
      })
      .returning()

    const inserted = firstRow(insertedRows)
    if (!inserted) throw new Error('Failed to create weight preference')
    return {
      inputType: inserted.inputType,
      barWeightLbs: inserted.barWeightLbs ?? DEFAULT_BAR_WEIGHT_LBS,
    }
  })

export const updateSet = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      setId: string
      weight: number | null
      reps: number | null
    }) => {
      if (!data.setId) throw new Error('setId is required')
      if (
        data.weight !== null &&
        (typeof data.weight !== 'number' ||
          !Number.isFinite(data.weight) ||
          data.weight < 0)
      ) {
        throw new Error('Invalid weight')
      }
      if (
        data.reps !== null &&
        (typeof data.reps !== 'number' ||
          !Number.isInteger(data.reps) ||
          data.reps < 0)
      ) {
        throw new Error('Invalid reps')
      }
      return data
    },
  )
  .handler(async ({ data }) => {
    const user = await requireUser()
    const db = getDb()

    const ownedRows = await db
      .select({ set: workoutSets })
      .from(workoutSets)
      .innerJoin(
        workoutExercises,
        eq(workoutSets.workoutExerciseId, workoutExercises.id),
      )
      .innerJoin(workouts, eq(workoutExercises.workoutId, workouts.id))
      .where(and(eq(workoutSets.id, data.setId), eq(workouts.userId, user.id)))
      .limit(1)

    if (!firstRow(ownedRows)) {
      throw new Error('Set not found')
    }

    const updatedRows = await db
      .update(workoutSets)
      .set({ weight: data.weight, reps: data.reps })
      .where(eq(workoutSets.id, data.setId))
      .returning()

    const updated = firstRow(updatedRows)
    if (!updated) {
      throw new Error('Failed to update set')
    }
    return updated
  })

export const addSet = createServerFn({ method: 'POST' })
  .validator((data: { workoutExerciseId: string }) => {
    if (!data.workoutExerciseId) {
      throw new Error('workoutExerciseId is required')
    }
    return data
  })
  .handler(async ({ data }) => {
    const user = await requireUser()
    const db = getDb()

    const ownedRows = await db
      .select({ workoutExercise: workoutExercises })
      .from(workoutExercises)
      .innerJoin(workouts, eq(workoutExercises.workoutId, workouts.id))
      .where(
        and(
          eq(workoutExercises.id, data.workoutExerciseId),
          eq(workouts.userId, user.id),
        ),
      )
      .limit(1)

    if (!firstRow(ownedRows)) {
      throw new Error('Workout exercise not found')
    }

    const countRows = await db
      .select({ value: count() })
      .from(workoutSets)
      .where(eq(workoutSets.workoutExerciseId, data.workoutExerciseId))

    const setCount = firstRow(countRows)?.value ?? 0

    const createdRows = await db
      .insert(workoutSets)
      .values({
        id: createId(),
        workoutExerciseId: data.workoutExerciseId,
        setIndex: Number(setCount),
        weight: null,
        reps: null,
      })
      .returning()

    const created = firstRow(createdRows)
    if (!created) {
      throw new Error('Failed to add set')
    }
    return created
  })

export const removeSet = createServerFn({ method: 'POST' })
  .validator((data: { setId: string }) => {
    if (!data.setId) throw new Error('setId is required')
    return data
  })
  .handler(async ({ data }) => {
    const user = await requireUser()
    const db = getDb()

    const ownedRows = await db
      .select({
        set: workoutSets,
        workoutExerciseId: workoutExercises.id,
      })
      .from(workoutSets)
      .innerJoin(
        workoutExercises,
        eq(workoutSets.workoutExerciseId, workoutExercises.id),
      )
      .innerJoin(workouts, eq(workoutExercises.workoutId, workouts.id))
      .where(and(eq(workoutSets.id, data.setId), eq(workouts.userId, user.id)))
      .limit(1)

    const owned = firstRow(ownedRows)
    if (!owned) {
      throw new Error('Set not found')
    }

    const countRows = await db
      .select({ value: count() })
      .from(workoutSets)
      .where(eq(workoutSets.workoutExerciseId, owned.workoutExerciseId))

    const setCount = firstRow(countRows)?.value ?? 0

    if (Number(setCount) <= 1) {
      throw new Error('At least one set is required')
    }

    await db.delete(workoutSets).where(eq(workoutSets.id, data.setId))

    const remaining = await db
      .select()
      .from(workoutSets)
      .where(eq(workoutSets.workoutExerciseId, owned.workoutExerciseId))
      .orderBy(asc(workoutSets.setIndex))

    for (let i = 0; i < remaining.length; i++) {
      const row = remaining[i]
      if (row.setIndex !== i) {
        await db
          .update(workoutSets)
          .set({ setIndex: i })
          .where(eq(workoutSets.id, row.id))
      }
    }

    return { ok: true as const }
  })

export const dayTypeLabels: Record<DayType, string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  cardio: 'Cardio',
}
