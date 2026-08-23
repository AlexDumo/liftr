import { calendarDaysBetween } from '#/lib/format-last-workout'

export function isStaleWorkout(startedAt: Date, now: Date = new Date()): boolean {
  return calendarDaysBetween(startedAt, now) > 0
}

/** Stale workouts complete on their start day; same-day displacement uses now. */
export function completionTimestampForStaleWorkout(
  startedAt: Date,
  now: Date = new Date(),
): Date {
  return isStaleWorkout(startedAt, now) ? startedAt : now
}
