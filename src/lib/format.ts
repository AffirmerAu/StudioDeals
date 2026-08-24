const AUD_FORMATTER = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function formatCents(cents: number): string {
  return AUD_FORMATTER.format(cents / 100)
}

const DATE_FORMATTER = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export function formatDate(value: string | null): string {
  if (!value) return '—'
  return DATE_FORMATTER.format(new Date(value))
}

const DATETIME_FORMATTER = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

export function formatDateTime(value: string | null): string {
  if (!value) return '—'
  return DATETIME_FORMATTER.format(new Date(value))
}

export function formatRelativeDays(value: string | null): string {
  if (!value) return 'Never'
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`
  const years = Math.floor(months / 12)
  return `${years} year${years === 1 ? '' : 's'} ago`
}

export function fullName(first: string, last: string | null): string {
  return last ? `${first} ${last}` : first
}
