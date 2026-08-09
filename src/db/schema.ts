import * as authSchema from './auth.schema'
import * as workoutSchema from './workout.schema'

export const schema = {
  ...authSchema,
  ...workoutSchema,
} as const

export * from './auth.schema'
export * from './workout.schema'
