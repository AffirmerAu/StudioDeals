import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useOverlayLayer } from '@/lib/overlay-stack'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function Drawer({ open, onClose, title, children }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)
  const [slid, setSlid] = useState(false)

  useOverlayLayer(open, onClose, () => panelRef.current)

  useEffect(() => {
    if (!open) return

    previouslyFocused.current = document.activeElement as HTMLElement | null
    const firstFocusable = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    firstFocusable?.focus()

    const raf = requestAnimationFrame(() => setSlid(true))

    return () => {
      cancelAnimationFrame(raf)
      previouslyFocused.current?.focus()
      setSlid(false)
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end"
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
        className="h-full w-full max-w-md border-l overflow-y-auto transition-transform duration-150 ease-out"
        style={{
          borderColor: 'var(--border)',
          background: 'var(--surface-raised)',
          transform: slid ? 'translateX(0)' : 'translateX(100%)',
        }}
      >
        <div
          className="sticky top-0 flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
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
