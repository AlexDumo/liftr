export const PROFILE_NAME_MAX_LENGTH = 60
export const DAY_NAME_MAX_LENGTH = 40
export const DAY_DESCRIPTION_MAX_LENGTH = 80
export const MIN_DAYS_PER_PROFILE = 1
export const MAX_DAYS_PER_PROFILE = 14

export type ProfileDayTemplate = {
  name: string
  description: string | null
  isCardio: boolean
}

export const DEFAULT_PROFILE_NAME = 'Push / Pull / Legs'

export const DEFAULT_PROFILE_DAYS: ProfileDayTemplate[] = [
  { name: 'Push', description: 'Chest, shoulders, triceps', isCardio: false },
  { name: 'Pull', description: 'Back, biceps, rear delts', isCardio: false },
  { name: 'Legs', description: 'Quads, hammies, glutes', isCardio: false },
  { name: 'Cardio', description: 'Conditioning & heart rate', isCardio: true },
]

function validateName(raw: string, label: string, maxLength: number): string {
  const name = raw.trim()
  if (!name) {
    throw new Error(`${label} is required`)
  }
  if (name.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer`)
  }
  return name
}

export function validateProfileName(raw: string): string {
  return validateName(raw, 'Profile name', PROFILE_NAME_MAX_LENGTH)
}

export function validateDayName(raw: string): string {
  return validateName(raw, 'Day name', DAY_NAME_MAX_LENGTH)
}

/** Blank descriptions are stored as null. */
export function validateDayDescription(raw: string | null): string | null {
  const description = raw?.trim() ?? ''
  if (!description) return null
  if (description.length > DAY_DESCRIPTION_MAX_LENGTH) {
    throw new Error(
      `Description must be ${DAY_DESCRIPTION_MAX_LENGTH} characters or fewer`,
    )
  }
  return description
}

export function validateDayCount(value: number): number {
  if (
    !Number.isInteger(value) ||
    value < MIN_DAYS_PER_PROFILE ||
    value > MAX_DAYS_PER_PROFILE
  ) {
    throw new Error(
      `Day count must be a whole number between ${MIN_DAYS_PER_PROFILE} and ${MAX_DAYS_PER_PROFILE}`,
    )
  }
  return value
}

/** Placeholder days for a new profile: "Day 1", "Day 2", … */
export function blankProfileDays(count: number): ProfileDayTemplate[] {
  return Array.from({ length: validateDayCount(count) }, (_, index) => ({
    name: `Day ${index + 1}`,
    description: null,
    isCardio: false,
  }))
}

/** Swap an item with its neighbour; returns the same order if it can't move. */
export function moveInOrder<T>(
  items: T[],
  index: number,
  direction: 'up' | 'down',
): T[] {
  const target = direction === 'up' ? index - 1 : index + 1
  if (index < 0 || index >= items.length) return items
  if (target < 0 || target >= items.length) return items
  const next = [...items]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}
