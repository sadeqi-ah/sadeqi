const toDate = (iso: string) => new Date(`${iso}T12:00:00Z`)

/** "Nov 2026" */
export const formatMonthYear = (iso: string) =>
  toDate(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })

/** "Oct 12" */
export const formatMonthDay = (iso: string) =>
  toDate(iso).toLocaleDateString('en-US', { month: 'short', day: '2-digit', timeZone: 'UTC' })

/** "Nov 7, 2026" */
export const formatLong = (iso: string) =>
  toDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

export const yearOf = (iso: string) => iso.slice(0, 4)

export const isExternal = (href?: string) => !!href && /^(https?:|mailto:)/.test(href)

/** Group items into [year, items[]] pairs, newest year first. */
export function groupByYear<T>(items: T[], getYear: (item: T) => string | number) {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const y = String(getYear(item))
    if (!map.has(y)) map.set(y, [])
    map.get(y)!.push(item)
  }
  return [...map.entries()].sort(([a], [b]) => Number(b) - Number(a))
}
