import { useEffect } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface OverlayEntry {
  onClose: () => void
  getPanel: () => HTMLElement | null
}

// A stack of currently-open Modals/Drawers. Escape and Tab-trapping act only
// on the topmost entry — each overlay attaching its own `document` listener
// doesn't work because `stopPropagation` can't stop sibling listeners bound
// to the same node, so a Modal opened on top of a Drawer would close both.
const stack: OverlayEntry[] = []
let listenerAttached = false

function handleKeyDown(event: KeyboardEvent) {
  const top = stack[stack.length - 1]
  if (!top) return

  if (event.key === 'Escape') {
    event.preventDefault()
    top.onClose()
    return
  }

  if (event.key !== 'Tab') return
  const panel = top.getPanel()
  if (!panel) return

  const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
  if (focusable.length === 0) return

  const first = focusable[0]
  const last = focusable[focusable.length - 1]

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function ensureListener() {
  if (listenerAttached) return
  document.addEventListener('keydown', handleKeyDown)
  listenerAttached = true
}

function releaseListenerIfIdle() {
  if (stack.length === 0 && listenerAttached) {
    document.removeEventListener('keydown', handleKeyDown)
    listenerAttached = false
  }
}

/** Registers an open Modal/Drawer on the shared overlay stack for the lifetime it's open. */
export function useOverlayLayer(open: boolean, onClose: () => void, getPanel: () => HTMLElement | null) {
  useEffect(() => {
    if (!open) return

    const entry: OverlayEntry = { onClose, getPanel }
    stack.push(entry)
    ensureListener()

    return () => {
      const index = stack.indexOf(entry)
      if (index !== -1) stack.splice(index, 1)
      releaseListenerIfIdle()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
}
