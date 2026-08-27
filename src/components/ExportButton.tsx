import { useState } from 'react'
import { useToast } from '@/lib/toast-context'
import { downloadCsv } from '@/lib/csv'

interface ExportButtonProps {
  /** Produces the file contents. Runs on click, so it exports what the
   *  filters match at that moment rather than a stale snapshot. */
  build: () => Promise<{ filename: string; contents: string; rows: number }>
  disabled?: boolean
}

export function ExportButton({ build, disabled }: ExportButtonProps) {
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    try {
      const { filename, contents, rows } = await build()
      if (rows === 0) {
        showToast('Nothing to export with these filters', 'error')
        return
      }
      downloadCsv(filename, contents)
      showToast(`Exported ${rows} ${rows === 1 ? 'row' : 'rows'}`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to export', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void run()}
      disabled={busy || disabled}
      className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors duration-150 disabled:opacity-60"
      style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
    >
      {busy ? 'Exporting…' : 'Export CSV'}
    </button>
  )
}
