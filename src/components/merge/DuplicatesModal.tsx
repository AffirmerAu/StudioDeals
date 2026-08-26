import { useState } from 'react'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { useToast } from '@/lib/toast-context'

/** One candidate pair, flattened so organisations and contacts can share this. */
export interface DuplicateCandidate {
  key: string
  idA: string
  nameA: string
  idB: string
  nameB: string
  /** Shown under each name — a role, an email, whatever tells the two apart. */
  detailA?: string | null
  detailB?: string | null
  /** Why the pair surfaced, e.g. "Same email" or "82% similar". */
  reason: string
  /** Extra context for the pair as a whole, e.g. the organisation both sit under. */
  context?: string | null
}

interface DuplicatesModalProps {
  open: boolean
  title: string
  /** What gets merged, lower case and singular: "organisation" / "contact". */
  entityLabel: string
  /** What moves across, named for the reader: "contacts, deals, activities and tags". */
  movesAcross: string
  candidates: DuplicateCandidate[]
  onClose: () => void
  merge: (survivorId: string, loserId: string) => Promise<void>
  /** Fires after a successful merge so the caller can refresh its list. */
  onMerged: (candidate: DuplicateCandidate) => void
}

interface PendingMerge {
  candidate: DuplicateCandidate
  survivorId: string
  survivorName: string
  loserId: string
  loserName: string
}

export function DuplicatesModal({
  open,
  title,
  entityLabel,
  movesAcross,
  candidates,
  onClose,
  merge,
  onMerged,
}: DuplicatesModalProps) {
  const { showToast } = useToast()
  const [pending, setPending] = useState<PendingMerge | null>(null)
  const [busy, setBusy] = useState(false)

  const choose = (candidate: DuplicateCandidate, keep: 'a' | 'b') =>
    setPending(
      keep === 'a'
        ? {
            candidate,
            survivorId: candidate.idA,
            survivorName: candidate.nameA,
            loserId: candidate.idB,
            loserName: candidate.nameB,
          }
        : {
            candidate,
            survivorId: candidate.idB,
            survivorName: candidate.nameB,
            loserId: candidate.idA,
            loserName: candidate.nameA,
          },
    )

  const handleMerge = async () => {
    if (!pending) return
    setBusy(true)
    try {
      await merge(pending.survivorId, pending.loserId)
      showToast(`Merged into ${pending.survivorName}`)
      onMerged(pending.candidate)
      setPending(null)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to merge', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title={title} widthClassName="max-w-2xl">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Choose which one to keep — the other's {movesAcross} move across, and a copy of it is kept in the merge
          log.
        </p>

        {candidates.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="No likely duplicates" />
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {candidates.map((candidate) => (
              <li key={candidate.key} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between gap-3">
                  <span className="tabular text-xs" style={{ color: 'var(--text-subtle)' }}>
                    {candidate.reason}
                  </span>
                  {candidate.context && (
                    <span className="truncate text-xs" style={{ color: 'var(--text-subtle)' }}>
                      {candidate.context}
                    </span>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <SideButton
                    name={candidate.nameA}
                    detail={candidate.detailA}
                    onClick={() => choose(candidate, 'a')}
                  />
                  <SideButton
                    name={candidate.nameB}
                    detail={candidate.detailB}
                    onClick={() => choose(candidate, 'b')}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors duration-150"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
          >
            Close
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={pending !== null}
        title={`Merge ${entityLabel}s`}
        message={
          pending
            ? `Keep "${pending.survivorName}" and merge "${pending.loserName}" into it? ` +
              `Everything attached to "${pending.loserName}" moves across and the ${entityLabel} itself is removed. ` +
              `This can't be undone.`
            : ''
        }
        confirmLabel="Merge"
        danger
        busy={busy}
        onConfirm={handleMerge}
        onClose={() => setPending(null)}
      />
    </>
  )
}

function SideButton({ name, detail, onClick }: { name: string; detail?: string | null; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors duration-150"
      style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-brand-500)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      <span className="block truncate">{name}</span>
      {detail && (
        <span className="block truncate text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
          {detail}
        </span>
      )}
      <span className="text-xs font-normal" style={{ color: 'var(--text-subtle)' }}>
        Keep this one
      </span>
    </button>
  )
}
