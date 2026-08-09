import { relations, sql } from 'drizzle-orm'
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'
import { users } from './auth.schema'

export const dayTypes = ['push', 'pull', 'legs', 'cardio'] as const
export type DayType = (typeof dayTypes)[number]

export const workoutStatuses = ['in_progress', 'completed'] as const
export type WorkoutStatus = (typeof workoutStatuses)[number]

export const exercises = sqliteTable(
  'exercises',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    force: text('force'),
    level: text('level').notNull(),
    mechanic: text('mechanic'),
    equipment: text('equipment'),
    category: text('category').notNull(),
    primaryMuscles: text('primary_muscles').notNull(),
    secondaryMuscles: text('secondary_muscles').notNull(),
    instructions: text('instructions').notNull(),
    images: text('images').notNull(),
  },
  (table) => [index('exercises_name_idx').on(table.name)],
)

export const workouts = sqliteTable(
  'workouts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    dayType: text('day_type').$type<DayType>().notNull(),
    status: text('status')
      .$type<WorkoutStatus>()
      .notNull()
      .default('in_progress'),
    startedAt: integer('started_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    index('workouts_userId_idx').on(table.userId),
    index('workouts_user_status_idx').on(table.userId, table.status),
  ],
)

export const workoutExercises = sqliteTable(
  'workout_exercises',
  {
    id: text('id').primaryKey(),
    workoutId: text('workout_id')
      .notNull()
      .references(() => workouts.id, { onDelete: 'cascade' }),
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'restrict' }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    index('workout_exercises_workoutId_idx').on(table.workoutId),
    index('workout_exercises_exerciseId_idx').on(table.exerciseId),
  ],
)

export const workoutSets = sqliteTable(
  'workout_sets',
  {
    id: text('id').primaryKey(),
    workoutExerciseId: text('workout_exercise_id')
      .notNull()
      .references(() => workoutExercises.id, { onDelete: 'cascade' }),
    setIndex: integer('set_index').notNull(),
    weight: real('weight'),
    reps: integer('reps'),
  },
  (table) => [
    index('workout_sets_workoutExerciseId_idx').on(table.workoutExerciseId),
    uniqueIndex('workout_sets_exercise_set_uidx').on(
      table.workoutExerciseId,
      table.setIndex,
    ),
  ],
)

export const exerciseFavorites = sqliteTable(
  'exercise_favorites',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    dayType: text('day_type').$type<DayType>().notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.exerciseId, table.dayType],
    }),
    index('exercise_favorites_user_day_idx').on(table.userId, table.dayType),
  ],
)

export const exercisesRelations = relations(exercises, ({ many }) => ({
  workoutExercises: many(workoutExercises),
  favorites: many(exerciseFavorites),
}))

export const workoutsRelations = relations(workouts, ({ one, many }) => ({
  user: one(users, {
    fields: [workouts.userId],
    references: [users.id],
  }),
  workoutExercises: many(workoutExercises),
}))

export const workoutExercisesRelations = relations(
  workoutExercises,
  ({ one, many }) => ({
    workout: one(workouts, {
      fields: [workoutExercises.workoutId],
      references: [workouts.id],
    }),
    exercise: one(exercises, {
      fields: [workoutExercises.exerciseId],
      references: [exercises.id],
    }),
    sets: many(workoutSets),
  }),
)

export const workoutSetsRelations = relations(workoutSets, ({ one }) => ({
  workoutExercise: one(workoutExercises, {
    fields: [workoutSets.workoutExerciseId],
    references: [workoutExercises.id],
  }),
}))

export const exerciseFavoritesRelations = relations(
  exerciseFavorites,
  ({ one }) => ({
    user: one(users, {
      fields: [exerciseFavorites.userId],
      references: [users.id],
    }),
    exercise: one(exercises, {
      fields: [exerciseFavorites.exerciseId],
      references: [exercises.id],
    }),
  }),
)
