export const CUSTOM_EXERCISE_NAME_MAX_LENGTH = 80

export function normalizeCustomExerciseName(name: string): string {
  return name.trim()
}

export function validateCustomExerciseName(name: string): string {
  const normalized = normalizeCustomExerciseName(name)
  if (!normalized) {
    throw new Error('Exercise name is required')
  }
  if (normalized.length > CUSTOM_EXERCISE_NAME_MAX_LENGTH) {
    throw new Error(
      `Exercise name must be ${CUSTOM_EXERCISE_NAME_MAX_LENGTH} characters or fewer`,
    )
  }
  return normalized
}

export function isExerciseVisibleToUser(
  exerciseUserId: string | null | undefined,
  userId: string,
): boolean {
  return exerciseUserId == null || exerciseUserId === userId
}
