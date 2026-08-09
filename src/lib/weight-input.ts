import type { WeightInputType } from '#/db/workout.schema'
import { weightInputTypes } from '#/db/workout.schema'

export type { WeightInputType }
export { weightInputTypes }

export const DEFAULT_BAR_WEIGHT_LBS = 45

export type WeightInputFields = {
  /** Single lbs | one dumbbell | one-side plates | assistance */
  primary: number | null
  /** Barbell only */
  barWeightLbs?: number | null
}

export type WeightInputContext = {
  bodyWeightLbs: number | null
}

export const weightInputTypeLabels: Record<WeightInputType, string> = {
  single: 'Single',
  dumbbell: 'Dumbbell',
  barbell: 'Barbell',
  body: 'Body',
  cardio: 'Cardio',
}

export function isCardioInputType(type: WeightInputType): boolean {
  return type === 'cardio'
}

export function isWeightInputType(value: unknown): value is WeightInputType {
  return (
    typeof value === 'string' &&
    (weightInputTypes as readonly string[]).includes(value)
  )
}

export function defaultWeightInputType(
  equipment: string | null | undefined,
): WeightInputType {
  switch (equipment) {
    case 'dumbbell':
      return 'dumbbell'
    case 'barbell':
      return 'barbell'
    case 'body only':
      return 'body'
    default:
      return 'single'
  }
}

export function resolveBarWeightLbs(
  barWeightLbs: number | null | undefined,
): number {
  if (
    typeof barWeightLbs === 'number' &&
    Number.isFinite(barWeightLbs) &&
    barWeightLbs >= 0
  ) {
    return barWeightLbs
  }
  return DEFAULT_BAR_WEIGHT_LBS
}

/**
 * Convert user-facing input fields into stored total pounds.
 * Returns null when the primary field is empty, or body weight is missing for body type.
 */
export function toPounds(
  type: WeightInputType,
  fields: WeightInputFields,
  context: WeightInputContext = { bodyWeightLbs: null },
): number | null {
  if (fields.primary === null || !Number.isFinite(fields.primary)) {
    return null
  }

  switch (type) {
    case 'single':
      return fields.primary
    case 'dumbbell':
      return fields.primary * 2
    case 'barbell':
      return fields.primary * 2 + resolveBarWeightLbs(fields.barWeightLbs)
    case 'body': {
      if (
        context.bodyWeightLbs === null ||
        !Number.isFinite(context.bodyWeightLbs)
      ) {
        return null
      }
      return context.bodyWeightLbs - fields.primary
    }
    case 'cardio':
      return null
  }
}

/**
 * Reverse stored pounds into user-facing input fields for editing.
 */
export function fromPounds(
  type: WeightInputType,
  pounds: number | null,
  context: WeightInputContext & { barWeightLbs?: number | null } = {
    bodyWeightLbs: null,
  },
): WeightInputFields {
  if (pounds === null || !Number.isFinite(pounds)) {
    return {
      primary: null,
      barWeightLbs:
        type === 'barbell' ? resolveBarWeightLbs(context.barWeightLbs) : null,
    }
  }

  switch (type) {
    case 'single':
      return { primary: pounds }
    case 'dumbbell':
      return { primary: pounds / 2 }
    case 'barbell': {
      const bar = resolveBarWeightLbs(context.barWeightLbs)
      return {
        primary: (pounds - bar) / 2,
        barWeightLbs: bar,
      }
    }
    case 'body': {
      if (
        context.bodyWeightLbs === null ||
        !Number.isFinite(context.bodyWeightLbs)
      ) {
        return { primary: null }
      }
      return { primary: context.bodyWeightLbs - pounds }
    }
    case 'cardio':
      return {
        primary: null,
        barWeightLbs: null,
      }
  }
}

export function formatPoundsDisplay(pounds: number | null): string | null {
  if (pounds === null || !Number.isFinite(pounds)) return null
  const rounded = Math.round(pounds * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : String(rounded)
}
