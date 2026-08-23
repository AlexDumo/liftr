import { describe, expect, it } from 'vitest'
import {
  CUSTOM_EXERCISE_NAME_MAX_LENGTH,
  isExerciseVisibleToUser,
  normalizeCustomExerciseName,
  validateCustomExerciseName,
} from '#/lib/custom-exercise'

describe('normalizeCustomExerciseName', () => {
  it('trims whitespace', () => {
    expect(normalizeCustomExerciseName('  Landmine press  ')).toBe(
      'Landmine press',
    )
  })
})

describe('validateCustomExerciseName', () => {
  it('accepts a valid name', () => {
    expect(validateCustomExerciseName('Smith machine incline')).toBe(
      'Smith machine incline',
    )
  })

  it('trims before validating', () => {
    expect(validateCustomExerciseName('  Cable fly  ')).toBe('Cable fly')
  })

  it('rejects empty names', () => {
    expect(() => validateCustomExerciseName('   ')).toThrow(
      'Exercise name is required',
    )
  })

  it('rejects names over the max length', () => {
    const longName = 'a'.repeat(CUSTOM_EXERCISE_NAME_MAX_LENGTH + 1)
    expect(() => validateCustomExerciseName(longName)).toThrow(
      `Exercise name must be ${CUSTOM_EXERCISE_NAME_MAX_LENGTH} characters or fewer`,
    )
  })

  it('accepts names at the max length', () => {
    const maxName = 'a'.repeat(CUSTOM_EXERCISE_NAME_MAX_LENGTH)
    expect(validateCustomExerciseName(maxName)).toBe(maxName)
  })
})

describe('isExerciseVisibleToUser', () => {
  it('allows global exercises', () => {
    expect(isExerciseVisibleToUser(null, 'user-1')).toBe(true)
    expect(isExerciseVisibleToUser(undefined, 'user-1')).toBe(true)
  })

  it('allows the owner of a custom exercise', () => {
    expect(isExerciseVisibleToUser('user-1', 'user-1')).toBe(true)
  })

  it('denies other users custom exercises', () => {
    expect(isExerciseVisibleToUser('user-2', 'user-1')).toBe(false)
  })
})
