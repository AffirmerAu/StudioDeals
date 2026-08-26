import { Field, inputClass, inputStyle } from '@/components/form'
import type { OrganisationFormState } from '@/components/organisations/organisation-form'

interface OrganisationFieldsProps {
  values: OrganisationFormState
  onChange: (next: Partial<OrganisationFormState>) => void
}

/**
 * The organisation's editable fields, shared by the create modal and the
 * organisation page so the two can't drift.
 */
export function OrganisationFields({ values, onChange }: OrganisationFieldsProps) {
  return (
    <>
      <Field label="Name" required>
        <input
          required
          value={values.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className={inputClass}
          style={inputStyle}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Industry">
          <input
            value={values.industry ?? ''}
            onChange={(e) => onChange({ industry: e.target.value })}
            className={inputClass}
            style={inputStyle}
          />
        </Field>
        <Field label="Website">
          <input
            value={values.website ?? ''}
            onChange={(e) => onChange({ website: e.target.value })}
            className={inputClass}
            style={inputStyle}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="ABN">
          <input
            value={values.abn ?? ''}
            onChange={(e) => onChange({ abn: e.target.value })}
            className={`tabular ${inputClass}`}
            style={inputStyle}
          />
        </Field>
        <Field label="Account number">
          <input
            value={values.account_number ?? ''}
            onChange={(e) => onChange({ account_number: e.target.value })}
            className={`tabular ${inputClass}`}
            style={inputStyle}
          />
        </Field>
      </div>

      <Field label="Address">
        <input
          value={values.address ?? ''}
          onChange={(e) => onChange({ address: e.target.value })}
          className={inputClass}
          style={inputStyle}
        />
      </Field>

      <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        <input
          type="checkbox"
          checked={values.is_client}
          onChange={(e) => onChange({ is_client: e.target.checked })}
        />
        Client
      </label>

      <Field label="Notes">
        <textarea
          value={values.notes ?? ''}
          onChange={(e) => onChange({ notes: e.target.value })}
          rows={4}
          className={inputClass}
          style={inputStyle}
        />
      </Field>
    </>
  )
}
