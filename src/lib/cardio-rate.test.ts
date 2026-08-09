import { describe, expect, it } from 'vitest'
import {
  computeMinutesPerUnit,
  computeUnitsPerMinute,
  formatCardioRate,
} from './cardio-rate'

describe('cardio rate helpers', () => {
  const amount = 5
  const durationSeconds = 60 * 60

  it('computes units per minute for 5 units in 60:00', () => {
    const rate = computeUnitsPerMinute(amount, durationSeconds)
    expect(rate).toBeCloseTo(5 / 60, 6)
  })

  it('computes minutes per unit for 5 units in 60:00', () => {
    expect(computeMinutesPerUnit(amount, durationSeconds)).toBeCloseTo(12, 6)
  })

  it('formats units/min compactly', () => {
    expect(
      formatCardioRate({
        amount,
        durationSeconds,
        rateMode: 'units_per_minute',
        unitLabel: 'miles',
      }),
    ).toBe('0.0833 miles/min')
  })

  it('formats minutes/unit as mm:ss pace', () => {
    expect(
      formatCardioRate({
        amount,
        durationSeconds,
        rateMode: 'minutes_per_unit',
        unitLabel: 'miles',
      }),
    ).toBe('12:00 /miles')
  })

  it('returns null when inputs are incomplete', () => {
    expect(computeUnitsPerMinute(null, durationSeconds)).toBeNull()
    expect(computeMinutesPerUnit(amount, null)).toBeNull()
    expect(computeUnitsPerMinute(amount, 0)).toBeNull()
    expect(computeMinutesPerUnit(0, durationSeconds)).toBeNull()
    expect(
      formatCardioRate({
        amount: null,
        durationSeconds,
        rateMode: 'units_per_minute',
        unitLabel: 'miles',
      }),
    ).toBeNull()
  })
})
