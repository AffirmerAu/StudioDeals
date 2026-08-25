import type { CSSProperties, ReactNode } from 'react'

export const inputClass = 'w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors duration-150'

export const inputStyle: CSSProperties = {
  borderColor: 'var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
}

/** The label is tied to its control by wrapping it, so screen readers (and
 * getByLabel) resolve the pair without every call site inventing an id. The
 * hint sits outside that label deliberately — inside, it would be read out as
 * part of the field's accessible name every time the field takes focus. */
export function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block space-y-1.5">
        <span className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          {label}
          {required && ' *'}
        </span>
        {children}
      </label>
      {hint && (
        <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
          {hint}
        </p>
      )}
    </div>
  )
}
