import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Modal } from '@/components/Modal'
import { useToast } from '@/lib/toast-context'
import { createOrganisation, updateOrganisation, type OrganisationFormValues } from '@/lib/organisations'
import type { OrganisationRow } from '@/types/database'

interface OrganisationFormModalProps {
  open: boolean
  organisation: OrganisationRow | null
  onClose: () => void
  /** Called with the saved row once persisted (edits fire this optimistically, before the request resolves). */
  onSaved: (saved: OrganisationRow) => void
  /** Called only for edits, if the background save fails — use it to roll the optimistic update back. */
  onSaveFailed?: (previous: OrganisationRow) => void
}

const EMPTY_VALUES: OrganisationFormValues = {
  name: '',
  industry: '',
  website: '',
  abn: '',
  account_number: '',
  address: '',
  is_client: true,
  notes: '',
}

function toFormValues(org: OrganisationRow | null): OrganisationFormValues {
  if (!org) return EMPTY_VALUES
  return {
    name: org.name,
    industry: org.industry ?? '',
    website: org.website ?? '',
    abn: org.abn ?? '',
    account_number: org.account_number ?? '',
    address: org.address ?? '',
    is_client: org.is_client,
    notes: org.notes ?? '',
  }
}

function normalise(values: OrganisationFormValues): OrganisationFormValues {
  return {
    ...values,
    industry: values.industry?.trim() || null,
    website: values.website?.trim() || null,
    abn: values.abn?.trim() || null,
    account_number: values.account_number?.trim() || null,
    address: values.address?.trim() || null,
    notes: values.notes?.trim() || null,
  }
}

export function OrganisationFormModal({
  open,
  organisation,
  onClose,
  onSaved,
  onSaveFailed,
}: OrganisationFormModalProps) {
  const { showToast } = useToast()
  const [values, setValues] = useState<OrganisationFormValues>(() => toFormValues(organisation))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setValues(toFormValues(organisation))
  }, [open, organisation])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const cleaned = normalise(values)

    if (organisation) {
      // Optimistic: close immediately with the predicted row, roll back on failure.
      onSaved({ ...organisation, ...cleaned })
      updateOrganisation(organisation.id, cleaned)
        .then(() => showToast('Organisation updated'))
        .catch((error: unknown) => {
          onSaveFailed?.(organisation)
          showToast(error instanceof Error ? error.message : 'Failed to update organisation', 'error')
        })
      return
    }

    setSaving(true)
    try {
      const created = await createOrganisation(cleaned)
      showToast('Organisation created')
      onSaved(created)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to create organisation', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={organisation ? 'Edit organisation' : 'New organisation'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Name" required>
          <input
            required
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            className={inputClass}
            style={inputStyle}
          />
        </Field>

        <Field label="Industry">
          <input
            value={values.industry ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, industry: e.target.value }))}
            className={inputClass}
            style={inputStyle}
          />
        </Field>

        <Field label="Website">
          <input
            value={values.website ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, website: e.target.value }))}
            className={inputClass}
            style={inputStyle}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="ABN">
            <input
              value={values.abn ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, abn: e.target.value }))}
              className={inputClass}
              style={inputStyle}
            />
          </Field>
          <Field label="Account number">
            <input
              value={values.account_number ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, account_number: e.target.value }))}
              className={inputClass}
              style={inputStyle}
            />
          </Field>
        </div>

        <Field label="Address">
          <input
            value={values.address ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, address: e.target.value }))}
            className={inputClass}
            style={inputStyle}
          />
        </Field>

        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          <input
            type="checkbox"
            checked={values.is_client}
            onChange={(e) => setValues((v) => ({ ...v, is_client: e.target.checked }))}
          />
          Client
        </label>

        <Field label="Notes">
          <textarea
            value={values.notes ?? ''}
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
