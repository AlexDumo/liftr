/**
 * Format total seconds as m:ss / mm:ss for display.
 * Returns '' when seconds is null.
 */
export function formatDurationMmSs(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) {
    return ''
  }
  const total = Math.floor(seconds)
  const minutes = Math.floor(total / 60)
  const secs = total % 60
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

/**
 * Parse m:ss / mm:ss into total seconds.
 * Empty/whitespace → null. Invalid → null.
 */
export function parseDurationMmSs(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const match = /^(\d+):([0-5]?\d)$/.exec(trimmed)
  if (!match) return null

  const minutes = Number(match[1])
  const secs = Number(match[2])
  if (!Number.isInteger(minutes) || !Number.isInteger(secs)) return null
  if (secs > 59) return null

  return minutes * 60 + secs
}
