import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Modal } from '@/components/Modal'
import { Combobox } from '@/components/Combobox'
import { useToast } from '@/lib/toast-context'
import { usePipelineStages } from '@/lib/pipeline-stages'
import { createDeal, updateDeal, type DealBoardRow, type DealFormValues } from '@/lib/deals'
import { searchOrganisations, type OrganisationOption } from '@/lib/organisations'
import { searchContactsForOrganisation, type ContactOption } from '@/lib/contacts'
import { centsToDollarInput, dollarInputToCents, fullName } from '@/lib/format'

// The generated Row type has deal_type: string — Postgres CHECK constraints
// aren't reflected in `supabase gen types`. This mirrors the constraint from
// migrations/001_initial_schema.sql: check (deal_type in (...)).
type DealType = 'production' | 'prestarter' | 'retainer' | 'other'

interface DealFormModalProps {
  open: boolean
  deal: DealBoardRow | null
  defaultStageId: number
  onClose: () => void
  /** Called with the saved row once persisted (edits fire this optimistically, before the request resolves). */
  onSaved: (saved: DealBoardRow) => void
  /** Called only for edits, if the background save fails — use it to roll the optimistic update back. */
  onSaveFailed?: (previous: DealBoardRow) => void
  /** Only used for create — where to slot the new card in its stage. */
  computeCreatePosition: (stageId: number) => number
}

const DEAL_TYPES: { value: DealType; label: string }[] = [
  { value: 'production', label: 'Production' },
  { value: 'prestarter', label: 'Prestarter' },
  { value: 'retainer', label: 'Retainer' },
  { value: 'other', label: 'Other' },
]

interface FormState {
  title: string
  stage_id: number
  deal_type: DealType
  valueDollars: string
  expected_close_date: string
  source: string
  notes: string
}

function toFormState(deal: DealBoardRow | null, defaultStageId: number): FormState {
  if (!deal) {
    return {
      title: '',
      stage_id: defaultStageId,
      deal_type: 'production',
      valueDollars: '',
      expected_close_date: '',
      source: '',
      notes: '',
    }
  }
  return {
    title: deal.title,
    stage_id: deal.stage_id,
    deal_type: deal.deal_type as DealType,
    valueDollars: deal.value_cents ? centsToDollarInput(deal.value_cents) : '',
    expected_close_date: deal.expected_close_date ?? '',
    source: deal.source ?? '',
    notes: deal.notes ?? '',
  }
}

export function DealFormModal({
  open,
  deal,
  defaultStageId,
  onClose,
  onSaved,
  onSaveFailed,
  computeCreatePosition,
}: DealFormModalProps) {
  const { showToast } = useToast()
  const { stages } = usePipelineStages()
  const [values, setValues] = useState<FormState>(() => toFormState(deal, defaultStageId))
  const [organisation, setOrganisation] = useState<OrganisationOption | null>(null)
  const [contact, setContact] = useState<ContactOption | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setValues(toFormState(deal, defaultStageId))
    setOrganisation(deal ? { id: deal.organisation_id, name: deal.organisation_name, industry: null } : null)
    setContact(
      deal?.primary_contact_id && deal.contact_name
        ? { id: deal.primary_contact_id, first_name: deal.contact_name, last_name: null }
        : null,
    )
  }, [open, deal, defaultStageId])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!organisation) return

    const cleaned: DealFormValues = {
      title: values.title.trim(),
      organisation_id: organisation.id,
      primary_contact_id: contact?.id ?? null,
      stage_id: values.stage_id,
      deal_type: values.deal_type,
      value_cents: values.valueDollars.trim() ? dollarInputToCents(values.valueDollars) : 0,
      expected_close_date: values.expected_close_date || null,
      source: values.source.trim() || null,
      notes: values.notes.trim() || null,
    }

    if (deal) {
      onSaved({
        ...deal,
        ...cleaned,
        organisation_name: organisation.name,
        contact_name: contact ? contact.first_name : null,
      })
      updateDeal(deal.id, cleaned)
        .then(() => showToast('Deal updated'))
        .catch((error: unknown) => {
          onSaveFailed?.(deal)
          showToast(error instanceof Error ? error.message : 'Failed to update deal', 'error')
        })
      return
    }

    setSaving(true)
    try {
      const created = await createDeal(cleaned, computeCreatePosition(cleaned.stage_id))
      showToast('Deal created')
      onSaved(created)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to create deal', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={deal ? 'Edit deal' : 'New deal'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Title" required>
          <input
            required
            value={values.title}
            onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
            className={inputClass}
            style={inputStyle}
          />
        </Field>

        <Field label="Organisation" required>
          <Combobox<OrganisationOption>
            value={organisation}
            onChange={(next) => {
              setOrganisation(next)
              setContact(null)
            }}
            search={(q) => searchOrganisations(q)}
            getLabel={(o) => o.name}
            getKey={(o) => o.id}
            placeholder="Search organisations…"
          />
        </Field>

        <Field label="Primary contact">
          <Combobox<ContactOption>
            key={organisation?.id ?? 'no-org'}
            value={contact}
            onChange={setContact}
            search={(q) => (organisation ? searchContactsForOrganisation(organisation.id, q) : Promise.resolve([]))}
            getLabel={(c) => fullName(c.first_name, c.last_name)}
            getKey={(c) => c.id}
            placeholder={organisation ? 'Search contacts…' : 'Select an organisation first'}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Stage" required>
            <select
              required
              value={values.stage_id}
              onChange={(e) => setValues((v) => ({ ...v, stage_id: Number(e.target.value) }))}
              className={inputClass}
              style={inputStyle}
            >
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Deal type" required>
            <select
              required
              value={values.deal_type}
              onChange={(e) => setValues((v) => ({ ...v, deal_type: e.target.value as DealType }))}
              className={inputClass}
              style={inputStyle}
            >
              {DEAL_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Value (AUD)">
            <input
              inputMode="decimal"
              placeholder="0.00"
              value={values.valueDollars}
              onChange={(e) => setValues((v) => ({ ...v, valueDollars: e.target.value }))}
              className={`tabular ${inputClass}`}
              style={inputStyle}
            />
          </Field>
          <Field label="Expected close date">
            <input
              type="date"
              value={values.expected_close_date}
              onChange={(e) => setValues((v) => ({ ...v, expected_close_date: e.target.value }))}
              className={`tabular ${inputClass}`}
              style={inputStyle}
            />
          </Field>
        </div>

        <Field label="Source">
          <input
            value={values.source}
            onChange={(e) => setValues((v) => ({ ...v, source: e.target.value }))}
            className={inputClass}
            style={inputStyle}
          />
        </Field>

        <Field label="Notes">
          <textarea
            value={values.notes}
            onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
            rows={3}
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
            disabled={saving || !organisation}
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

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
        {label}
        {required && ' *'}
      </label>
      {children}
    </div>
  )
}
