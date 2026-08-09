import type { DayType } from '#/db/workout.schema'

export const DAY_TYPES: DayType[] = ['push', 'pull', 'legs', 'cardio']

export const DAY_TYPE_LABELS: Record<DayType, string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Leg',
  cardio: 'Cardio',
}

export const DAY_TYPE_BLURBS: Record<DayType, string> = {
  push: 'Chest, shoulders, triceps',
  pull: 'Back, biceps, rear delts',
  legs: 'Quads, hammies, glutes',
  cardio: 'Conditioning & heart rate',
}
