import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type ToastVariant = 'success' | 'error'

interface Toast {
  id: number
  message: string
  variant: ToastVariant
}

type ToastContextValue = {
  showToast: (message: string, variant?: ToastVariant) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'success') => {
      const id = nextId++
      setToasts((current) => [...current, { id, message, variant }])
      setTimeout(() => dismiss(id), 5000)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-20 right-4 z-50 flex flex-col gap-2 md:bottom-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="rounded-lg border px-4 py-3 text-sm shadow-lg transition-opacity duration-150"
            style={{
              borderColor: toast.variant === 'error' ? 'var(--color-stage-verbal)' : 'var(--border)',
              background: 'var(--surface-raised)',
              color: 'var(--text)',
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
