const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Whole calendar days between two dates (local time). 18 hours ago yesterday → 1. */
export function calendarDaysBetween(from: Date, to: Date): number {
  const a = startOfLocalDay(from).getTime()
  const b = startOfLocalDay(to).getTime()
  return Math.round((b - a) / (24 * 60 * 60 * 1000))
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** e.g. "4 days ago - Wed, 07/16" */
export function formatLastWorkoutLabel(
  when: Date | string,
  now: Date = new Date(),
): string {
  const date = typeof when === 'string' ? new Date(when) : when
  const days = calendarDaysBetween(date, now)

  const relative =
    days <= 0
      ? 'Today'
      : days === 1
        ? '1 day ago'
        : `${days} days ago`

  const weekday = WEEKDAYS[date.getDay()]
  const mmdd = `${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`

  return `${relative} - ${weekday}, ${mmdd}`
}
