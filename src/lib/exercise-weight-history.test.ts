import { describe, expect, it } from 'vitest'
import {
  formatRepMaxDelta,
  maxQualifyingWeightFromDrafts,
  mergeCurrentSessionPoint,
  qualifyingSetWeight,
} from '#/lib/exercise-weight-history'

describe('qualifyingSetWeight', () => {
  it('returns weight when reps meet threshold', () => {
    expect(qualifyingSetWeight(135, 5, 5)).toBe(135)
    expect(qualifyingSetWeight(135, 6, 5)).toBe(135)
  })

  it('returns null when reps are below threshold', () => {
    expect(qualifyingSetWeight(135, 4, 5)).toBeNull()
  })

  it('returns null for missing values', () => {
    expect(qualifyingSetWeight(null, 5, 5)).toBeNull()
    expect(qualifyingSetWeight(135, null, 5)).toBeNull()
  })
})

describe('maxQualifyingWeightFromDrafts', () => {
  it('returns max qualifying weight from drafts', () => {
    const drafts = [
      { primary: '135', reps: '5' },
      { primary: '145', reps: '3' },
      { primary: '140', reps: '6' },
    ]

    const max = maxQualifyingWeightFromDrafts(drafts, 5, (draft) =>
      Number(draft.primary),
    )

    expect(max).toBe(140)
  })

  it('returns null when no drafts qualify', () => {
    const drafts = [{ primary: '145', reps: '3' }]
    const max = maxQualifyingWeightFromDrafts(drafts, 5, (draft) =>
      Number(draft.primary),
    )
    expect(max).toBeNull()
  })
})

describe('formatRepMaxDelta', () => {
  it('formats above message', () => {
    const result = formatRepMaxDelta(150, 140, 5)
    expect(result).toEqual({
      kind: 'above',
      pounds: 10,
      message: 'You are 10 lbs above your 5-rep max!',
    })
  })

  it('formats below message', () => {
    const result = formatRepMaxDelta(130, 140, 5)
    expect(result).toEqual({
      kind: 'below',
      pounds: 10,
      message: 'You are 10 lbs below your 5-rep max',
    })
  })

  it('formats matching message', () => {
    const result = formatRepMaxDelta(140, 140, 5)
    expect(result).toEqual({
      kind: 'matching',
      message: 'You are matching your 5-rep max',
    })
  })

  it('returns no_current when current max is missing', () => {
    const result = formatRepMaxDelta(null, 140, 5)
    expect(result?.kind).toBe('no_current')
  })

  it('returns no_history when historical max is missing', () => {
    const result = formatRepMaxDelta(140, null, 5)
    expect(result?.kind).toBe('no_history')
  })
})

describe('mergeCurrentSessionPoint', () => {
  it('adds current session point and sorts by date', () => {
    const history = [
      {
        workoutId: 'w1',
        date: new Date('2026-01-01'),
        maxWeight: 100,
      },
    ]

    const merged = mergeCurrentSessionPoint(
      history,
      'w2',
      120,
      new Date('2026-02-01'),
    )

    expect(merged).toHaveLength(2)
    expect(merged[1]?.maxWeight).toBe(120)
  })

  it('replaces existing point for same workout', () => {
    const history = [
      {
        workoutId: 'w1',
        date: new Date('2026-01-01'),
        maxWeight: 100,
      },
    ]

    const merged = mergeCurrentSessionPoint(
      history,
      'w1',
      110,
      new Date('2026-01-01'),
    )

    expect(merged).toHaveLength(1)
    expect(merged[0]?.maxWeight).toBe(110)
  })

  it('removes current session when current max is null', () => {
    const history = [
      {
        workoutId: 'w1',
        date: new Date('2026-01-01'),
        maxWeight: 100,
      },
    ]

    const merged = mergeCurrentSessionPoint(
      history,
      'w1',
      null,
      new Date('2026-01-01'),
    )

    expect(merged).toHaveLength(0)
  })
})
