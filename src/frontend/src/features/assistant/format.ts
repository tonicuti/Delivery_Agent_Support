const DAY_TIME = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
const CLOCK = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()

/** "Today 15:24", "Yesterday 15:24", or "6 Nov 15:24". */
export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  const now = new Date()
  if (sameDay(date, now)) return `Today ${CLOCK.format(date)}`
  const yesterday = new Date(now.getTime() - 86_400_000)
  if (sameDay(date, yesterday)) return `Yesterday ${CLOCK.format(date)}`
  return DAY_TIME.format(date).replace(',', '')
}

export const fmtClock = (iso: string | null | undefined) =>
  iso ? CLOCK.format(new Date(iso)) : '—'
