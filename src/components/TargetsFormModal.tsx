import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Modal } from '@/components/Modal'
import { useToast } from '@/lib/toast-context'
import { saveTargets, type TargetValues } from '@/lib/targets'
import { centsToDollarInput, dollarInputToCents } from '@/lib/format'

interface TargetsFormModalProps {
  open: boolean
  targets: TargetValues
  onClose: () => void
  onSaved: (values: TargetValues) => void
}

/** Counts are whole numbers; anything else is treated as none. */
function toCount(input: string): number {
  const n = Number.parseInt(input, 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function TargetsFormModal({ open, targets, onClose, onSaved }: TargetsFormModalProps) {
  const { showToast } = useToast()
  const [newDeals, setNewDeals] = useState('')
  const [wonDeals, setWonDeals] = useState('')
  const [wonValue, setWonValue] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setNewDeals(targets.new_deals_per_month ? String(targets.new_deals_per_month) : '')
    setWonDeals(targets.won_deals_per_month ? String(targets.won_deals_per_month) : '')
    // Cents in, dollars on screen — never parsed back through a float.
    setWonValue(targets.won_value_cents_per_month ? centsToDollarInput(targets.won_value_cents_per_month) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    const values: TargetValues = {
      new_deals_per_month: toCount(newDeals),
      won_deals_per_month: toCount(wonDeals),
      won_value_cents_per_month: wonValue.trim() ? dollarInputToCents(wonValue) : 0,
    }
    try {
      const saved = await saveTargets(values)
      onSaved(saved)
      showToast('Targets saved')
      onClose()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to save targets', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Monthly targets">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          These stay put until you change them. Leave one blank to drop its target.
        </p>

        <Field label="New deals per month" htmlFor="target-new-deals">
          <input
            id="target-new-deals"
            type="number"
            min={0}
            step={1}
            value={newDeals}
            onChange={(e) => setNewDeals(e.target.value)}
            placeholder="No target"
            className={inputClass}
            style={inputStyle}
          />
        </Field>

        <Field label="Deals won per month" htmlFor="target-won-deals">
          <input
            id="target-won-deals"
            type="number"
            min={0}
            step={1}
            value={wonDeals}
            onChange={(e) => setWonDeals(e.target.value)}
            placeholder="No target"
            className={inputClass}
            style={inputStyle}
          />
        </Field>

        <Field label="Value won per month (AUD)" htmlFor="target-won-value">
          <input
            id="target-won-value"
            inputMode="decimal"
            value={wonValue}
            onChange={(e) => setWonValue(e.target.value)}
            placeholder="No target"
            className={inputClass}
            style={inputStyle}
          />
        </Field>

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
            disabled={saving}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors duration-150 disabled:opacity-60"
            style={{ background: 'var(--color-brand-500)' }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

const inputClass = 'w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors duration-150'
const inputStyle = { borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}
