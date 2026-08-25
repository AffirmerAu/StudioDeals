/**
 * Normalises whatever sits in `organisations.website` into a bare hostname
 * suitable for a favicon lookup. The column is free text typed by hand, so it
 * arrives as anything from "acme.com.au" to "https://www.acme.com.au/contact"
 * to a scrap of prose — anything that isn't parseable returns null and the
 * caller falls back to a monogram.
 */
export function toDomain(website: string | null | undefined): string | null {
  if (!website) return null

  const trimmed = website.trim()
  if (!trimmed || /\s/.test(trimmed)) return null

  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
    const host = url.hostname.replace(/^www\./i, '').toLowerCase()
    // A hostname with no dot is a bare word, not a domain.
    return host.includes('.') ? host : null
  } catch {
    return null
  }
}

const LEGAL_SUFFIXES = new Set(['pty', 'ltd', 'limited', 'inc', 'llc', 'plc', 'co', 'group', 'the'])

/**
 * One or two letters to stand in for a missing logo — initials of the first
 * two meaningful words ("Bulk Ore Mining Co" → "BO"), or the first two letters
 * when there's only one ("Affirmer" → "AF").
 */
export function monogram(name: string): string {
  const words = name
    .split(/[\s\-/&.,]+/)
    .filter(Boolean)
    .filter((word) => !LEGAL_SUFFIXES.has(word.toLowerCase().replace(/\./g, '')))

  if (words.length === 0) {
    return name.trim().slice(0, 2).toUpperCase() || '?'
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase()
  }
  return (words[0][0] + words[1][0]).toUpperCase()
}
