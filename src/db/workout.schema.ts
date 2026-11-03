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

export const workoutStatuses = ['in_progress', 'completed'] as const
export type WorkoutStatus = (typeof workoutStatuses)[number]

export const weightInputTypes = [
  'single',
  'dumbbell',
  'barbell',
  'body',
  'cardio',
] as const
export type WeightInputType = (typeof weightInputTypes)[number]

export const cardioRateModes = [
  'units_per_minute',
  'minutes_per_unit',
] as const
export type CardioRateMode = (typeof cardioRateModes)[number]
export const DEFAULT_CARDIO_RATE_MODE: CardioRateMode = 'minutes_per_unit'

export const exercises = sqliteTable(
  'exercises',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
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
  (table) => [
    index('exercises_name_idx').on(table.name),
    index('exercises_userId_name_idx').on(table.userId, table.name),
  ],
)

export const workoutProfiles = sqliteTable(
  'workout_profiles',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [index('workout_profiles_userId_idx').on(table.userId)],
)

export const workoutDays = sqliteTable(
  'workout_days',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id')
      .notNull()
      .references(() => workoutProfiles.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    isCardio: integer('is_cardio', { mode: 'boolean' })
      .notNull()
      .default(false),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [index('workout_days_profileId_idx').on(table.profileId)],
)

export const workouts = sqliteTable(
  'workouts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    dayId: text('day_id').references(() => workoutDays.id, {
      onDelete: 'set null',
    }),
    // Snapshot so history keeps its label if the day is renamed or deleted.
    dayName: text('day_name').notNull().default(''),
    isCardio: integer('is_cardio', { mode: 'boolean' })
      .notNull()
      .default(false),
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
    metricValue: real('metric_value'),
    durationSeconds: integer('duration_seconds'),
  },
  (table) => [
    index('workout_sets_workoutExerciseId_idx').on(table.workoutExerciseId),
    uniqueIndex('workout_sets_exercise_set_uidx').on(
      table.workoutExerciseId,
      table.setIndex,
    ),
  ],
)

export const dayFavorites = sqliteTable(
  'day_favorites',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    dayId: text('day_id')
      .notNull()
      .references(() => workoutDays.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.exerciseId, table.dayId],
    }),
    index('day_favorites_user_day_idx').on(table.userId, table.dayId),
  ],
)

export const DEFAULT_MIN_REPS_FOR_MAX = 5

export const userSettings = sqliteTable('user_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  bodyWeightLbs: real('body_weight_lbs'),
  minRepsForMax: integer('min_reps_for_max').notNull().default(5),
  activeProfileId: text('active_profile_id').references(
    () => workoutProfiles.id,
    { onDelete: 'set null' },
  ),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
})

export const userExerciseWeightPrefs = sqliteTable(
  'user_exercise_weight_prefs',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    inputType: text('input_type').$type<WeightInputType>().notNull(),
    barWeightLbs: real('bar_weight_lbs'),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.exerciseId],
    }),
    index('user_exercise_weight_prefs_user_idx').on(table.userId),
  ],
)

export const userExerciseCardioPrefs = sqliteTable(
  'user_exercise_cardio_prefs',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    unitLabel: text('unit_label').notNull(),
    rateMode: text('rate_mode')
      .$type<CardioRateMode>()
      .notNull()
      .default(DEFAULT_CARDIO_RATE_MODE),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.exerciseId],
    }),
    index('user_exercise_cardio_prefs_user_idx').on(table.userId),
  ],
)

export const exercisesRelations = relations(exercises, ({ one, many }) => ({
  user: one(users, {
    fields: [exercises.userId],
    references: [users.id],
  }),
  workoutExercises: many(workoutExercises),
  favorites: many(dayFavorites),
}))

export const workoutsRelations = relations(workouts, ({ one, many }) => ({
  user: one(users, {
    fields: [workouts.userId],
    references: [users.id],
  }),
  day: one(workoutDays, {
    fields: [workouts.dayId],
    references: [workoutDays.id],
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

export const dayFavoritesRelations = relations(dayFavorites, ({ one }) => ({
  user: one(users, {
    fields: [dayFavorites.userId],
    references: [users.id],
  }),
  exercise: one(exercises, {
    fields: [dayFavorites.exerciseId],
    references: [exercises.id],
  }),
  day: one(workoutDays, {
    fields: [dayFavorites.dayId],
    references: [workoutDays.id],
  }),
}))

export const workoutProfilesRelations = relations(
  workoutProfiles,
  ({ one, many }) => ({
    user: one(users, {
      fields: [workoutProfiles.userId],
      references: [users.id],
    }),
    days: many(workoutDays),
  }),
)

export const workoutDaysRelations = relations(workoutDays, ({ one, many }) => ({
  profile: one(workoutProfiles, {
    fields: [workoutDays.profileId],
    references: [workoutProfiles.id],
  }),
  workouts: many(workouts),
  favorites: many(dayFavorites),
}))

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, {
    fields: [userSettings.userId],
    references: [users.id],
  }),
}))

export const userExerciseWeightPrefsRelations = relations(
  userExerciseWeightPrefs,
  ({ one }) => ({
    user: one(users, {
      fields: [userExerciseWeightPrefs.userId],
      references: [users.id],
    }),
    exercise: one(exercises, {
      fields: [userExerciseWeightPrefs.exerciseId],
      references: [exercises.id],
    }),
  }),
)

export const userExerciseCardioPrefsRelations = relations(
  userExerciseCardioPrefs,
  ({ one }) => ({
    user: one(users, {
      fields: [userExerciseCardioPrefs.userId],
      references: [users.id],
    }),
    exercise: one(exercises, {
      fields: [userExerciseCardioPrefs.exerciseId],
      references: [exercises.id],
    }),
  }),
)
