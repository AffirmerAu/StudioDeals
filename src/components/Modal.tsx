import { useEffect, useRef, type ReactNode } from 'react'
import { useOverlayLayer } from '@/lib/overlay-stack'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  widthClassName?: string
}

export function Modal({ open, onClose, title, children, widthClassName = 'max-w-lg' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useOverlayLayer(open, onClose, () => panelRef.current)

  useEffect(() => {
    if (!open) return

    previouslyFocused.current = document.activeElement as HTMLElement | null
    const firstFocusable = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    firstFocusable?.focus()

    return () => {
      previouslyFocused.current?.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ background: 'rgb(0 0 0 / 0.5)' }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${widthClassName} rounded-lg border max-h-[90vh] overflow-y-auto`}
        style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
      >
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: 'var(--border)' }}
        >
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-lg leading-none transition-colors duration-150"
            style={{ color: 'var(--text-muted)' }}
          >
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
