import { describe, expect, it } from 'vitest'
import {
  calendarDaysBetween,
  formatLastWorkoutLabel,
} from '#/lib/format-last-workout'

describe('calendarDaysBetween', () => {
  it('counts calendar days, not elapsed hours', () => {
    const yesterdayEvening = new Date(2026, 7, 8, 20, 0, 0)
    const todayMorning = new Date(2026, 7, 9, 14, 0, 0)
    expect(calendarDaysBetween(yesterdayEvening, todayMorning)).toBe(1)
  })

  it('returns 0 for the same calendar day', () => {
    const morning = new Date(2026, 7, 9, 6, 0, 0)
    const evening = new Date(2026, 7, 9, 22, 0, 0)
    expect(calendarDaysBetween(morning, evening)).toBe(0)
  })

  it('returns multi-day gaps', () => {
    const then = new Date(2026, 6, 16, 18, 0, 0)
    const now = new Date(2026, 6, 20, 9, 0, 0)
    expect(calendarDaysBetween(then, now)).toBe(4)
  })
})

describe('formatLastWorkoutLabel', () => {
  const now = new Date(2026, 7, 9, 14, 0, 0) // Sun Aug 9

  it('formats today', () => {
    expect(formatLastWorkoutLabel(new Date(2026, 7, 9, 8, 0, 0), now)).toBe(
      'Today - Sun, 08/09',
    )
  })

  it('formats yesterday as 1 day ago even if under 24 hours', () => {
    expect(formatLastWorkoutLabel(new Date(2026, 7, 8, 20, 0, 0), now)).toBe(
      '1 day ago - Sat, 08/08',
    )
  })

  it('formats multi-day ago with weekday and mm/dd', () => {
    expect(formatLastWorkoutLabel(new Date(2026, 6, 16, 18, 0, 0), now)).toBe(
      '24 days ago - Thu, 07/16',
    )
  })

  it('accepts ISO strings', () => {
    expect(formatLastWorkoutLabel(new Date(2026, 7, 5).toISOString(), now)).toBe(
      '4 days ago - Wed, 08/05',
    )
  })
})
