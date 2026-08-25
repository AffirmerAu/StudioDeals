const AUD_FORMATTER = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function formatCents(cents: number): string {
  return AUD_FORMATTER.format(cents / 100)
}

const AUD_COMPACT_FORMATTER = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  notation: 'compact',
  maximumFractionDigits: 1,
})

/** For axis ticks / scale markers only — the readable value elsewhere always uses formatCents. */
export function formatCentsCompact(cents: number): string {
  return AUD_COMPACT_FORMATTER.format(cents / 100)
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

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-AU', { month: 'short', year: 'numeric' })

export function formatMonth(value: string): string {
  return MONTH_FORMATTER.format(new Date(value))
}

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

// Integer-only cents<->dollars conversion for editable money inputs — never
// parseFloat(userInput) * 100, which can misround (e.g. 0.1 + 0.2 territory).
export function centsToDollarInput(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const wholePart = Math.floor(abs / 100).toString()
  const centsPart = (abs % 100).toString().padStart(2, '0')
  return `${sign}${wholePart}.${centsPart}`
}

export function dollarInputToCents(input: string): number {
  const negative = input.trim().startsWith('-')
  const digitsOnly = input.replace(/[^0-9.]/g, '')
  const [wholePart = '0', decimalPart = ''] = digitsOnly.split('.')
  const centsPart = (decimalPart + '00').slice(0, 2)
  const whole = parseInt(wholePart || '0', 10) || 0
  const cents = parseInt(centsPart, 10) || 0
  const total = whole * 100 + cents
  return negative ? -total : total
}
