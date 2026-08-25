import { Link, useLocation } from 'react-router-dom'

export interface BackTarget {
  to: string
  label: string
}

/**
 * Where "back" goes from a record page. Callers that navigate here pass
 * `state: { from }` so a deal opened from the pipeline returns to the
 * pipeline; anything opened cold (a bookmark, a refresh, a pasted URL) falls
 * back to the record's own list. Deliberately not navigate(-1), which on a
 * cold load walks out of the app entirely.
 */
export function useBackTarget(fallback: BackTarget): BackTarget {
  const location = useLocation()
  const state = location.state as { from?: BackTarget } | null
  return state?.from ?? fallback
}

export function BackLink({ target }: { target: BackTarget }) {
  return (
    <Link to={target.to} className="text-sm transition-colors duration-150" style={{ color: 'var(--text-muted)' }}>
      ← {target.label}
    </Link>
  )
}

/**
 * Sits at the bottom of the viewport while a record page has unsaved edits.
 * Nothing on these pages autosaves — the fields are always editable, so an
 * explicit commit is the only thing separating "I'm looking at this" from
 * "I changed it".
 */
export function SaveBar({
  dirty,
  saving,
  onSave,
  onDiscard,
}: {
  dirty: boolean
  saving: boolean
  onSave: () => void
  onDiscard: () => void
}) {
  if (!dirty) return null

  return (
    <div
      role="status"
      className="sticky bottom-0 z-10 -mx-8 mt-6 flex items-center justify-between gap-4 border-t px-8 py-3"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
    >
      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Unsaved changes
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onDiscard}
          disabled={saving}
          className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors duration-150 disabled:opacity-60"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          Discard
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors duration-150 disabled:opacity-60"
          style={{ background: 'var(--color-brand-500)' }}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}

/** A label/value pair for the read-only facts beside an editable form. */
export function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <dt style={{ color: 'var(--text-subtle)' }}>{label}</dt>
      <dd className="text-right" style={{ color: 'var(--text)' }}>
        {children}
      </dd>
    </div>
  )
}
