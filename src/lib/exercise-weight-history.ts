export type WeightHistoryPoint = {
  workoutId: string
  date: Date
  maxWeight: number
}

export type RepMaxDelta =
  | { kind: 'above'; pounds: number; message: string }
  | { kind: 'below'; pounds: number; message: string }
  | { kind: 'matching'; message: string }
  | { kind: 'no_current'; message: string }
  | { kind: 'no_history'; message: string }

export function qualifyingSetWeight(
  weight: number | null,
  reps: number | null,
  minReps: number,
): number | null {
  if (weight === null || reps === null) return null
  if (!Number.isFinite(weight) || !Number.isFinite(reps)) return null
  if (reps < minReps) return null
  return weight
}

export function maxQualifyingWeightFromDrafts<T extends { primary: string; reps: string }>(
  drafts: T[],
  minReps: number,
  toPounds: (draft: T) => number | null,
): number | null {
  let max: number | null = null

  for (const draft of drafts) {
    const weight = toPounds(draft)
    const repsRaw = draft.reps.trim()
    if (!repsRaw) continue
    const reps = Number(repsRaw)
    if (!Number.isFinite(reps)) continue

    const qualifying = qualifyingSetWeight(weight, Math.round(reps), minReps)
    if (qualifying === null) continue
    if (max === null || qualifying > max) {
      max = qualifying
    }
  }

  return max
}

function formatPounds(pounds: number): string {
  const rounded = Math.round(pounds)
  return String(rounded)
}

export function formatRepMaxDelta(
  currentMax: number | null,
  historicalMax: number | null,
  minReps: number,
): RepMaxDelta | null {
  if (currentMax === null) {
    return {
      kind: 'no_current',
      message: `Log a set with ${minReps}+ reps to start tracking progress`,
    }
  }

  if (historicalMax === null) {
    return {
      kind: 'no_history',
      message: `Log a set with ${minReps}+ reps to start tracking progress`,
    }
  }

  const currentRounded = Math.round(currentMax)
  const historicalRounded = Math.round(historicalMax)
  const diff = currentRounded - historicalRounded

  if (Math.abs(diff) < 1) {
    return {
      kind: 'matching',
      message: `You are matching your ${minReps}-rep max`,
    }
  }

  if (diff > 0) {
    return {
      kind: 'above',
      pounds: diff,
      message: `You are ${formatPounds(diff)} lbs above your ${minReps}-rep max!`,
    }
  }

  return {
    kind: 'below',
    pounds: Math.abs(diff),
    message: `You are ${formatPounds(Math.abs(diff))} lbs below your ${minReps}-rep max`,
  }
}

export function mergeCurrentSessionPoint(
  history: WeightHistoryPoint[],
  workoutId: string,
  currentMax: number | null,
  date: Date,
): WeightHistoryPoint[] {
  const withoutCurrent = history.filter((point) => point.workoutId !== workoutId)

  if (currentMax === null) {
    return withoutCurrent
  }

  return [
    ...withoutCurrent,
    {
      workoutId,
      date,
      maxWeight: currentMax,
    },
  ].sort((a, b) => a.date.getTime() - b.date.getTime())
}
