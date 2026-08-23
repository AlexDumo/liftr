import { describe, expect, it } from 'vitest'
import {
  completionTimestampForStaleWorkout,
  isStaleWorkout,
} from '#/lib/workout-auto-complete'

describe('isStaleWorkout', () => {
  it('returns false for the same calendar day', () => {
    const morning = new Date(2026, 7, 9, 6, 0, 0)
    const evening = new Date(2026, 7, 9, 22, 0, 0)
    expect(isStaleWorkout(morning, evening)).toBe(false)
  })

  it('returns true when started on a previous calendar day', () => {
    const yesterday = new Date(2026, 7, 8, 20, 0, 0)
    const today = new Date(2026, 7, 9, 14, 0, 0)
    expect(isStaleWorkout(yesterday, today)).toBe(true)
  })
})

describe('completionTimestampForStaleWorkout', () => {
  it('backdates stale workouts to startedAt', () => {
    const startedAt = new Date(2026, 7, 8, 20, 0, 0)
    const now = new Date(2026, 7, 9, 14, 0, 0)
    expect(completionTimestampForStaleWorkout(startedAt, now)).toBe(startedAt)
  })

  it('uses now for same-day displacement', () => {
    const startedAt = new Date(2026, 7, 9, 8, 0, 0)
    const now = new Date(2026, 7, 9, 18, 0, 0)
    expect(completionTimestampForStaleWorkout(startedAt, now)).toBe(now)
  })
})
