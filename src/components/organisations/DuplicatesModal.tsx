import { useState } from 'react'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { useToast } from '@/lib/toast-context'
import { mergeOrganisations, type DuplicateOrgPair } from '@/lib/duplicates'

interface DuplicatesModalProps {
  open: boolean
  pairs: DuplicateOrgPair[]
  onClose: () => void
  /** Fires after a successful merge so the caller can refresh its list. */
  onMerged: (pair: DuplicateOrgPair) => void
}

interface PendingMerge {
  pair: DuplicateOrgPair
  survivorId: string
  survivorName: string
  loserId: string
  loserName: string
}

export function DuplicatesModal({ open, pairs, onClose, onMerged }: DuplicatesModalProps) {
  const { showToast } = useToast()
  const [pending, setPending] = useState<PendingMerge | null>(null)
  const [busy, setBusy] = useState(false)

  const choose = (pair: DuplicateOrgPair, keep: 'a' | 'b') =>
    setPending(
      keep === 'a'
        ? { pair, survivorId: pair.idA, survivorName: pair.nameA, loserId: pair.idB, loserName: pair.nameB }
        : { pair, survivorId: pair.idB, survivorName: pair.nameB, loserId: pair.idA, loserName: pair.nameA },
    )

  const handleMerge = async () => {
    if (!pending) return
    setBusy(true)
    try {
      await mergeOrganisations(pending.survivorId, pending.loserId)
      showToast(`Merged into ${pending.survivorName}`)
      onMerged(pending.pair)
      setPending(null)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to merge', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title="Possible duplicates" widthClassName="max-w-2xl">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Names scored as similar. Choose which one to keep — the other's contacts, deals, activities and tags move
          across, and a copy of it is kept in the merge log.
        </p>

        {pairs.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="No likely duplicates" />
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {pairs.map((pair) => (
              <li
                key={`${pair.idA}-${pair.idB}`}
                className="rounded-lg border p-3"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="tabular text-xs" style={{ color: 'var(--text-subtle)' }}>
                    {Math.round(pair.score * 100)}% similar
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <SideButton name={pair.nameA} onClick={() => choose(pair, 'a')} />
                  <SideButton name={pair.nameB} onClick={() => choose(pair, 'b')} />
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
        title="Merge organisations"
        message={
          pending
            ? `Keep "${pending.survivorName}" and merge "${pending.loserName}" into it? ` +
              `Everything attached to "${pending.loserName}" moves across and the record itself is removed. This can't be undone.`
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

function SideButton({ name, onClick }: { name: string; onClick: () => void }) {
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
      <span className="text-xs font-normal" style={{ color: 'var(--text-subtle)' }}>
        Keep this one
      </span>
    </button>
  )
}
