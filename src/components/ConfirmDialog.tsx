import { Modal } from '@/components/Modal'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  busy = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} widthClassName="max-w-sm">
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        {message}
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors duration-150"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors duration-150 disabled:opacity-60"
          style={{ background: danger ? 'var(--color-stage-lost)' : 'var(--color-brand-500)' }}
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
