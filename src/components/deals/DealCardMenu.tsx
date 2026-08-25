import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useOverlayLayer } from '@/lib/overlay-stack'
import { ChevronDownIcon } from '@/components/icons'

export interface DealCardMenuProps {
  /** Same destination as clicking the card — the deal's own page. */
  onOpen: () => void
  onMarkWon: () => void
  onMarkLost: () => void
  onDelete: () => void
  /** Hidden when the deal already sits in that stage — nothing to mark. */
  canMarkWon: boolean
  canMarkLost: boolean
}

const MENU_WIDTH = 168

export function DealCardMenu({
  onOpen,
  onMarkWon,
  onMarkLost,
  onDelete,
  canMarkWon,
  canMarkLost,
}: DealCardMenuProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useOverlayLayer(open, () => setOpen(false), () => menuRef.current)

  // The board scrolls horizontally and each column clips its overflow, so an
  // absolutely-positioned menu would be cut off. Portal it to the body and
  // place it from the trigger's viewport rect instead.
  useEffect(() => {
    if (!open) return

    // Re-anchor rather than close on scroll: the browser scrolls a partly
    // off-screen card into view as it's clicked, and that scroll lands *after*
    // this effect subscribes — closing on it would shut the menu on the way up.
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
        setOpen(false)
        return
      }
      setPosition({
        top: rect.bottom + 4,
        left: Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)),
      })
    }
    place()

    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const run = (action: () => void) => () => {
    setOpen(false)
    action()
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Deal actions"
        // The card itself is a dnd-kit drag handle and opens the deal page on
        // click — both have to be held off so the trigger stays a button.
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((current) => !current)
        }}
        className="shrink-0 rounded-lg p-0.5 transition-colors duration-150"
        style={{ color: 'var(--text-subtle)' }}
      >
        <ChevronDownIcon className="size-4" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            className="fixed z-50 overflow-hidden rounded-lg border py-1 text-sm shadow-lg"
            style={{
              top: position.top,
              left: position.left,
              width: MENU_WIDTH,
              borderColor: 'var(--border)',
              background: 'var(--surface-raised)',
            }}
          >
            <MenuItem label="Open" onClick={run(onOpen)} />

            {(canMarkWon || canMarkLost) && (
              <div className="my-1 border-t" style={{ borderColor: 'var(--border)' }} />
            )}
            {canMarkWon && <MenuItem label="Won" color="var(--color-stage-won)" dot onClick={run(onMarkWon)} />}
            {canMarkLost && <MenuItem label="Lost" color="var(--color-stage-lost)" dot onClick={run(onMarkLost)} />}

            <div className="my-1 border-t" style={{ borderColor: 'var(--border)' }} />
            {/* No dot, so it doesn't read as another stage alongside Lost,
                which now shares its red. */}
            <MenuItem label="Delete" color="var(--color-stage-lost)" onClick={run(onDelete)} />
          </div>,
          document.body,
        )}
    </>
  )
}

function MenuItem({
  label,
  onClick,
  color,
  dot = false,
}: {
  label: string
  onClick: () => void
  color?: string
  dot?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-medium transition-colors duration-150"
      style={{ color: color ?? 'var(--text)' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {dot && color && <span className="size-1.5 shrink-0 rounded-lg" style={{ background: color }} />}
      {label}
    </button>
  )
}
