import { useState } from 'react'
import { monogram, toDomain } from '@/lib/domain'

/** Always fetched at 128px regardless of display size, so the logo stays crisp
 * on high-DPI screens where a 20px box paints 40+ device pixels. */
const FETCH_SIZE = 128

interface CompanyLogoProps {
  /** Company name — used for the monogram fallback and the accessible label. */
  name: string
  /** Website or bare domain; anything unparseable falls back to the monogram. */
  website?: string | null
  /** Rendered box size in px. */
  size?: number
}

export function CompanyLogo({ name, website, size = 24 }: CompanyLogoProps) {
  const domain = toDomain(website)
  // Remembering *which* domain failed, rather than a bare boolean, means a
  // recycled card (same DOM node, different company) retries instead of
  // inheriting the previous company's failure — no reset effect needed.
  const [failedDomain, setFailedDomain] = useState<string | null>(null)
  const failed = domain !== null && domain === failedDomain

  const box = {
    width: size,
    height: size,
    // Never let flex layouts squash the badge out of square.
    minWidth: size,
    minHeight: size,
  }

  if (!domain || failed) {
    return (
      <span
        aria-hidden="true"
        className="inline-flex shrink-0 select-none items-center justify-center rounded-lg border font-semibold"
        style={{
          ...box,
          borderColor: 'var(--border)',
          background: 'var(--surface-hover)',
          color: 'var(--text-muted)',
          // Two characters have to fit a 20px box without touching the edges.
          fontSize: Math.max(9, Math.round(size * 0.42)),
          lineHeight: 1,
        }}
      >
        {monogram(name)}
      </span>
    )
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${FETCH_SIZE}`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      // Don't hand Google the CRM URL the logo is being rendered on.
      referrerPolicy="no-referrer"
      onError={() => setFailedDomain(domain)}
      className="shrink-0 rounded-lg border object-contain"
      style={{ ...box, borderColor: 'var(--border)', background: 'var(--surface-hover)' }}
    />
  )
}
