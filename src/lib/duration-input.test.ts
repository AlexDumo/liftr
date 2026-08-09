import { describe, expect, it } from 'vitest'
import { formatDurationMmSs, parseDurationMmSs } from './duration-input'

describe('formatDurationMmSs', () => {
  it('formats seconds as m:ss', () => {
    expect(formatDurationMmSs(0)).toBe('0:00')
    expect(formatDurationMmSs(65)).toBe('1:05')
    expect(formatDurationMmSs(510)).toBe('8:30')
    expect(formatDurationMmSs(3600)).toBe('60:00')
  })

  it('returns empty for null or invalid', () => {
    expect(formatDurationMmSs(null)).toBe('')
    expect(formatDurationMmSs(-1)).toBe('')
    expect(formatDurationMmSs(Number.NaN)).toBe('')
  })
})

describe('parseDurationMmSs', () => {
  it('parses m:ss and mm:ss', () => {
    expect(parseDurationMmSs('0:00')).toBe(0)
    expect(parseDurationMmSs('1:05')).toBe(65)
    expect(parseDurationMmSs('8:30')).toBe(510)
    expect(parseDurationMmSs('60:00')).toBe(3600)
  })

  it('accepts single-digit seconds with leading pad optional', () => {
    expect(parseDurationMmSs('1:5')).toBe(65)
  })

  it('returns null for empty or invalid', () => {
    expect(parseDurationMmSs('')).toBe(null)
    expect(parseDurationMmSs('  ')).toBe(null)
    expect(parseDurationMmSs('8')).toBe(null)
    expect(parseDurationMmSs('8:60')).toBe(null)
    expect(parseDurationMmSs('-1:00')).toBe(null)
    expect(parseDurationMmSs('abc')).toBe(null)
  })

  it('round-trips with formatDurationMmSs', () => {
    for (const seconds of [0, 45, 65, 510, 3599]) {
      expect(parseDurationMmSs(formatDurationMmSs(seconds))).toBe(seconds)
    }
  })
})
