import { describe, expect, it } from 'vitest'
import {
  DAY_DESCRIPTION_MAX_LENGTH,
  MAX_DAYS_PER_PROFILE,
  PROFILE_NAME_MAX_LENGTH,
  blankProfileDays,
  moveInOrder,
  validateDayCount,
  validateDayDescription,
  validateDayName,
  validateProfileName,
} from '#/lib/workout-profiles'

describe('validateProfileName', () => {
  it('trims and accepts a valid name', () => {
    expect(validateProfileName('  4-day upper/lower ')).toBe(
      '4-day upper/lower',
    )
  })

  it('rejects blank names', () => {
    expect(() => validateProfileName('   ')).toThrow('Profile name is required')
  })

  it('rejects names that are too long', () => {
    expect(() =>
      validateProfileName('a'.repeat(PROFILE_NAME_MAX_LENGTH + 1)),
    ).toThrow()
  })
})

describe('validateDayName', () => {
  it('rejects blank names', () => {
    expect(() => validateDayName('')).toThrow('Day name is required')
  })
})

describe('validateDayDescription', () => {
  it('stores blank descriptions as null', () => {
    expect(validateDayDescription('  ')).toBeNull()
    expect(validateDayDescription(null)).toBeNull()
  })

  it('trims descriptions', () => {
    expect(validateDayDescription(' Back, biceps ')).toBe('Back, biceps')
  })

  it('rejects descriptions that are too long', () => {
    expect(() =>
      validateDayDescription('a'.repeat(DAY_DESCRIPTION_MAX_LENGTH + 1)),
    ).toThrow()
  })
})

describe('validateDayCount', () => {
  it('accepts whole numbers in range', () => {
    expect(validateDayCount(1)).toBe(1)
    expect(validateDayCount(MAX_DAYS_PER_PROFILE)).toBe(MAX_DAYS_PER_PROFILE)
  })

  it('rejects out-of-range and fractional counts', () => {
    expect(() => validateDayCount(0)).toThrow()
    expect(() => validateDayCount(MAX_DAYS_PER_PROFILE + 1)).toThrow()
    expect(() => validateDayCount(2.5)).toThrow()
  })
})

describe('blankProfileDays', () => {
  it('numbers placeholder days', () => {
    expect(blankProfileDays(3).map((day) => day.name)).toEqual([
      'Day 1',
      'Day 2',
      'Day 3',
    ])
  })
})

describe('moveInOrder', () => {
  it('swaps with the previous item', () => {
    expect(moveInOrder(['a', 'b', 'c'], 1, 'up')).toEqual(['b', 'a', 'c'])
  })

  it('swaps with the next item', () => {
    expect(moveInOrder(['a', 'b', 'c'], 1, 'down')).toEqual(['a', 'c', 'b'])
  })

  it('leaves the order alone at the edges', () => {
    expect(moveInOrder(['a', 'b'], 0, 'up')).toEqual(['a', 'b'])
    expect(moveInOrder(['a', 'b'], 1, 'down')).toEqual(['a', 'b'])
  })
})
