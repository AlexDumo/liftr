import type { CardioRateMode } from '#/db/workout.schema'
import {
  cardioRateModes,
  DEFAULT_CARDIO_RATE_MODE,
} from '#/db/workout.schema'
import { formatDurationMmSs } from '#/lib/duration-input'

export type { CardioRateMode }
export { cardioRateModes, DEFAULT_CARDIO_RATE_MODE }

export function isCardioRateMode(value: unknown): value is CardioRateMode {
  return (
    typeof value === 'string' &&
    (cardioRateModes as readonly string[]).includes(value)
  )
}

export function computeUnitsPerMinute(
  amount: number | null,
  durationSeconds: number | null,
): number | null {
  if (
    amount === null ||
    durationSeconds === null ||
    !Number.isFinite(amount) ||
    !Number.isFinite(durationSeconds) ||
    amount < 0 ||
    durationSeconds <= 0
  ) {
    return null
  }
  return amount / (durationSeconds / 60)
}

export function computeMinutesPerUnit(
  amount: number | null,
  durationSeconds: number | null,
): number | null {
  if (
    amount === null ||
    durationSeconds === null ||
    !Number.isFinite(amount) ||
    !Number.isFinite(durationSeconds) ||
    amount <= 0 ||
    durationSeconds < 0
  ) {
    return null
  }
  return durationSeconds / 60 / amount
}

function formatCompactDecimal(value: number, maxFractionDigits = 4): string {
  if (!Number.isFinite(value)) return ''
  const fixed = value.toFixed(maxFractionDigits)
  return fixed.replace(/\.?0+$/, '')
}

export function formatCardioRate(options: {
  amount: number | null
  durationSeconds: number | null
  rateMode: CardioRateMode
  unitLabel: string
}): string | null {
  const unit = options.unitLabel.trim() || 'unit'

  if (options.rateMode === 'units_per_minute') {
    const rate = computeUnitsPerMinute(
      options.amount,
      options.durationSeconds,
    )
    if (rate === null) return null
    return `${formatCompactDecimal(rate)} ${unit}/min`
  }

  const minutes = computeMinutesPerUnit(
    options.amount,
    options.durationSeconds,
  )
  if (minutes === null) return null
  const pace = formatDurationMmSs(Math.round(minutes * 60))
  if (!pace) return null
  return `${pace} /${unit}`
}

export function cardioRateModeOptionLabel(
  mode: CardioRateMode,
  unitLabel: string,
): string {
  const unit = unitLabel.trim() || 'unit'
  return mode === 'units_per_minute' ? `${unit}/min` : `min/${unit}`
}
