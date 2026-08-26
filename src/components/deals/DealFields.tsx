import { Combobox } from '@/components/Combobox'
import { Field, inputClass, inputStyle } from '@/components/form'
import { searchOrganisations, type OrganisationOption } from '@/lib/organisations'
import { searchContactsForOrganisation, type ContactOption } from '@/lib/contacts'
import { fullName } from '@/lib/format'
import { DEAL_TYPES, type DealFormState, type DealType } from '@/components/deals/deal-form'
import type { PipelineStageRow } from '@/types/crm'

interface DealFieldsProps {
  values: DealFormState
  onChange: (next: Partial<DealFormState>) => void
  organisation: OrganisationOption | null
  onOrganisationChange: (next: OrganisationOption | null) => void
  contact: ContactOption | null
  onContactChange: (next: ContactOption | null) => void
  stages: PipelineStageRow[]
}

/**
 * The deal's editable fields, shared by the create modal and the deal page so
 * the two can't drift. Layout only — every caller owns its own submit, dirty
 * tracking and persistence.
 */
export function DealFields({
  values,
  onChange,
  organisation,
  onOrganisationChange,
  contact,
  onContactChange,
  stages,
}: DealFieldsProps) {
  const selectedStage = stages.find((s) => s.id === values.stage_id)
  const isLostStage = selectedStage?.is_lost ?? false
  const stageDefaultPercent = selectedStage ? Math.round(selectedStage.probability * 100) : null

  return (
    <>
      <Field label="Title" required>
        <input
          required
          value={values.title}
          onChange={(e) => onChange({ title: e.target.value })}
          className={inputClass}
          style={inputStyle}
        />
      </Field>

      <Field label="Organisation" required>
        <Combobox<OrganisationOption>
          value={organisation}
          onChange={(next) => {
            onOrganisationChange(next)
            // A contact belongs to one organisation — keeping the old one
            // would attach a stranger to the deal.
            onContactChange(null)
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
          onChange={onContactChange}
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
            onChange={(e) => onChange({ stage_id: Number(e.target.value) })}
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
            onChange={(e) => onChange({ deal_type: e.target.value as DealType })}
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
            onChange={(e) => onChange({ valueDollars: e.target.value })}
            className={`tabular ${inputClass}`}
            style={inputStyle}
          />
        </Field>
        <Field label="Expected close date">
          <input
            type="date"
            value={values.expected_close_date}
            onChange={(e) => onChange({ expected_close_date: e.target.value })}
            className={`tabular ${inputClass}`}
            style={inputStyle}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Source">
          <input
            value={values.source}
            onChange={(e) => onChange({ source: e.target.value })}
            className={inputClass}
            style={inputStyle}
          />
        </Field>
        <Field
          label="Probability"
          hint="Overrides the stage's own probability in the weighted forecast. Leave blank to use the stage default."
        >
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={values.probabilityPercent}
            onChange={(e) => onChange({ probabilityPercent: e.target.value })}
            placeholder={stageDefaultPercent === null ? 'Stage default' : `${stageDefaultPercent}% (stage default)`}
            className={inputClass}
            style={inputStyle}
          />
        </Field>
      </div>

      {isLostStage && (
        <Field label="Lost reason">
          <input
            value={values.lostReason}
            onChange={(e) => onChange({ lostReason: e.target.value })}
            placeholder="Why was it lost?"
            className={inputClass}
            style={inputStyle}
          />
        </Field>
      )}

      <Field label="Notes">
        <textarea
          value={values.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          rows={4}
          className={inputClass}
          style={inputStyle}
        />
      </Field>
    </>
  )
}
