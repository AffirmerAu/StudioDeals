import { useEffect, useState, type FormEvent } from 'react'
import { Modal } from '@/components/Modal'

interface LostReasonDialogProps {
  open: boolean
  dealTitle: string
  /** Prefilled when correcting a reason already recorded. */
  initialReason?: string | null
  busy?: boolean
  onConfirm: (reason: string | null) => void
  onClose: () => void
}

/**
 * Asked whenever a deal moves into Lost. Deliberately not required — forcing a
 * reason just produces "n/a" — but always offered, because the reason is the
 * most useful thing about a loss and nobody goes back to add it later.
 */
export function LostReasonDialog({
  open,
  dealTitle,
  initialReason,
  busy = false,
  onConfirm,
  onClose,
}: LostReasonDialogProps) {
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (open) setReason(initialReason ?? '')
  }, [open, initialReason])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    onConfirm(reason.trim() || null)
  }

  return (
    <Modal open={open} onClose={onClose} title="Mark as lost">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Why was “{dealTitle}” lost?
        </p>

        <div className="space-y-1.5">
          <label htmlFor="lost-reason" className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Reason
          </label>
          <input
            id="lost-reason"
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Price, timing, went elsewhere…"
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors duration-150"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
          />
          <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
            Optional — you can leave this blank.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors duration-150"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors duration-150 disabled:opacity-60"
            style={{ background: 'var(--color-stage-lost)' }}
          >
            {busy ? 'Saving…' : 'Mark as lost'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
