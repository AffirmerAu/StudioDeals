import { Link } from 'react-router-dom'
import type { BackTarget } from '@/components/RecordPage'

/**
 * The duplicates count and the link to the merge history, side by side. Merge
 * history has no nav entry of its own — it belongs next to the thing that
 * writes it, which is where anyone would go looking.
 */
export function DuplicatesBar({
  count,
  noun,
  onOpen,
  from,
}: {
  count: number
  /** Singular, lower case: "duplicate". */
  noun: string
  onOpen: () => void
  from: BackTarget
}) {
  return (
    <>
      {count > 0 && (
        <button
          type="button"
          onClick={onOpen}
          className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors duration-150"
          style={{ borderColor: 'var(--color-stage-verbal)', color: 'var(--color-stage-verbal)' }}
        >
          {count} possible {count === 1 ? noun : `${noun}s`}
        </button>
      )}
      <Link
        to="/merges"
        state={{ from }}
        className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors duration-150"
        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
      >
        Merge history
      </Link>
    </>
  )
}
