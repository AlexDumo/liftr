import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BAR_WEIGHT_LBS,
  defaultWeightInputType,
  fromPounds,
  toPounds,
} from './weight-input'

describe('defaultWeightInputType', () => {
  it('maps known equipment strings', () => {
    expect(defaultWeightInputType('dumbbell')).toBe('dumbbell')
    expect(defaultWeightInputType('barbell')).toBe('barbell')
    expect(defaultWeightInputType('body only')).toBe('body')
  })

  it('defaults everything else to single', () => {
    expect(defaultWeightInputType('cable')).toBe('single')
    expect(defaultWeightInputType('kettlebells')).toBe('single')
    expect(defaultWeightInputType(null)).toBe('single')
    expect(defaultWeightInputType(undefined)).toBe('single')
  })
})

describe('toPounds / fromPounds', () => {
  it('round-trips single weight', () => {
    const pounds = toPounds('single', { primary: 135 })
    expect(pounds).toBe(135)
    expect(fromPounds('single', pounds)).toEqual({ primary: 135 })
  })

  it('round-trips dumbbell (single → total × 2)', () => {
    const pounds = toPounds('dumbbell', { primary: 50 })
    expect(pounds).toBe(100)
    expect(fromPounds('dumbbell', pounds)).toEqual({ primary: 50 })
  })

  it('round-trips barbell with default olympic bar', () => {
    const pounds = toPounds('barbell', {
      primary: 70,
      barWeightLbs: DEFAULT_BAR_WEIGHT_LBS,
    })
    expect(pounds).toBe(185)
    expect(
      fromPounds('barbell', pounds, {
        bodyWeightLbs: null,
        barWeightLbs: DEFAULT_BAR_WEIGHT_LBS,
      }),
    ).toEqual({ primary: 70, barWeightLbs: 45 })
  })

  it('round-trips barbell with a non-45 bar', () => {
    const pounds = toPounds('barbell', { primary: 25, barWeightLbs: 35 })
    expect(pounds).toBe(85)
    expect(
      fromPounds('barbell', pounds, {
        bodyWeightLbs: null,
        barWeightLbs: 35,
      }),
    ).toEqual({ primary: 25, barWeightLbs: 35 })
  })

  it('uses default bar when bar weight omitted', () => {
    expect(toPounds('barbell', { primary: 70 })).toBe(185)
  })

  it('round-trips body with positive assistance', () => {
    const ctx = { bodyWeightLbs: 200 }
    const pounds = toPounds('body', { primary: 50 }, ctx)
    expect(pounds).toBe(150)
    expect(fromPounds('body', pounds, ctx)).toEqual({ primary: 50 })
  })

  it('round-trips body with negative assistance (added load)', () => {
    const ctx = { bodyWeightLbs: 200 }
    const pounds = toPounds('body', { primary: -25 }, ctx)
    expect(pounds).toBe(225)
    expect(fromPounds('body', pounds, ctx)).toEqual({ primary: -25 })
  })

  it('returns null for empty primary', () => {
    expect(toPounds('single', { primary: null })).toBeNull()
    expect(toPounds('dumbbell', { primary: null })).toBeNull()
  })

  it('returns null for body when body weight is unset', () => {
    expect(
      toPounds('body', { primary: 50 }, { bodyWeightLbs: null }),
    ).toBeNull()
    expect(
      fromPounds('body', 150, { bodyWeightLbs: null }),
    ).toEqual({ primary: null })
  })
})
