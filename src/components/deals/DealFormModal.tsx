import { useEffect, useState, type FormEvent } from 'react'
import { Modal } from '@/components/Modal'
import { useToast } from '@/lib/toast-context'
import { usePipelineStages } from '@/lib/pipeline-stages'
import { createDeal, type DealBoardRow } from '@/lib/deals'
import type { OrganisationOption } from '@/lib/organisations'
import type { ContactOption } from '@/lib/contacts'
import { DealFields } from '@/components/deals/DealFields'
import { dealFormValues, emptyDealFormState, type DealFormState } from '@/components/deals/deal-form'

interface DealFormModalProps {
  open: boolean
  defaultStageId: number
  onClose: () => void
  /** Called with the created row once persisted. */
  onCreated: (created: DealBoardRow) => void
  /** Where to slot the new card in its stage. */
  computeCreatePosition: (stageId: number) => number
}

/**
 * Creating a deal only — editing happens on the deal's own page, where there's
 * room for its activity, its links and its close history alongside the fields.
 */
export function DealFormModal({
  open,
  defaultStageId,
  onClose,
  onCreated,
  computeCreatePosition,
}: DealFormModalProps) {
  const { showToast } = useToast()
  const { stages } = usePipelineStages()
  const [values, setValues] = useState<DealFormState>(() => emptyDealFormState(defaultStageId))
  const [organisation, setOrganisation] = useState<OrganisationOption | null>(null)
  const [contact, setContact] = useState<ContactOption | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setValues(emptyDealFormState(defaultStageId))
    setOrganisation(null)
    setContact(null)
  }, [open, defaultStageId])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!organisation) return

    const isLostStage = stages.find((s) => s.id === values.stage_id)?.is_lost ?? false
    const cleaned = dealFormValues(values, organisation.id, contact?.id ?? null, isLostStage)

    setSaving(true)
    try {
      const created = await createDeal(cleaned, computeCreatePosition(cleaned.stage_id))
      showToast('Deal created')
      onCreated(created)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to create deal', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New deal">
      <form onSubmit={handleSubmit} className="space-y-4">
        <DealFields
          values={values}
          onChange={(next) => setValues((v) => ({ ...v, ...next }))}
          organisation={organisation}
          onOrganisationChange={setOrganisation}
          contact={contact}
          onContactChange={setContact}
          stages={stages}
        />

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
