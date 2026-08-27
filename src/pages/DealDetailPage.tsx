import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { usePipelineStages } from '@/lib/pipeline-stages'
import { useToast } from '@/lib/toast-context'
import {
  deleteDeal,
  getDeal,
  markDealHandedOff,
  nextBoardPosition,
  updateDeal,
  type DealBoardRow,
} from '@/lib/deals'
import { formatDate, formatDateTime } from '@/lib/format'
import type { OrganisationOption } from '@/lib/organisations'
import type { ContactOption } from '@/lib/contacts'
import { SkeletonBlock } from '@/components/Skeleton'
import { EmptyState } from '@/components/EmptyState'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { StageBadge } from '@/components/StageBadge'
import { CompanyLogo } from '@/components/CompanyLogo'
import { ActivityTimeline } from '@/components/ActivityTimeline'
import { DealTasks } from '@/components/deals/DealTasks'
import { BackLink, MetaRow, SaveBar, useBackTarget } from '@/components/RecordPage'
import { DealFields } from '@/components/deals/DealFields'
import { dealFormValues, toDealFormState, type DealFormState } from '@/components/deals/deal-form'

interface Selection {
  organisation: OrganisationOption | null
  contact: ContactOption | null
}

/** The combobox selections that go with a loaded row, so they reset alongside it. */
function toSelection(deal: DealBoardRow): Selection {
  return {
    organisation: { id: deal.organisation_id, name: deal.organisation_name, industry: null },
    contact:
      deal.primary_contact_id && deal.contact_name
        ? { id: deal.primary_contact_id, first_name: deal.contact_name, last_name: null }
        : null,
  }
}

export function DealDetailPage() {
  const { dealId } = useParams<{ dealId: string }>()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { stages } = usePipelineStages()
  const back = useBackTarget({ to: '/deals', label: 'Deals' })

  const [deal, setDeal] = useState<DealBoardRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [form, setForm] = useState<DealFormState | null>(null)
  const [selection, setSelection] = useState<Selection>({ organisation: null, contact: null })
  const [saving, setSaving] = useState(false)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [handoffOpen, setHandoffOpen] = useState(false)
  const [handoffBusy, setHandoffBusy] = useState(false)
  const [activityKey, setActivityKey] = useState(0)

  useEffect(() => {
    if (!dealId) return
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    getDeal(dealId)
      .then((row) => {
        if (cancelled) return
        if (!row) {
          setNotFound(true)
          return
        }
        setDeal(row)
        setForm(toDealFormState(row))
        setSelection(toSelection(row))
      })
      .catch((error: unknown) => {
        if (!cancelled) showToast(error instanceof Error ? error.message : 'Failed to load deal', 'error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId])

  // The saved row is the baseline: anything the form says that it doesn't is
  // an unsaved edit.
  const baseline = useMemo(() => (deal ? toDealFormState(deal) : null), [deal])
  const dirty =
    form !== null &&
    baseline !== null &&
    (JSON.stringify(form) !== JSON.stringify(baseline) ||
      selection.organisation?.id !== deal?.organisation_id ||
      (selection.contact?.id ?? null) !== deal?.primary_contact_id)

  const stage = deal ? stages.find((s) => s.id === deal.stage_id) : undefined

  const discard = () => {
    if (!deal) return
    setForm(toDealFormState(deal))
    setSelection(toSelection(deal))
  }

  const handleSave = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!deal || !form || !selection.organisation) return

    const isLostStage = stages.find((s) => s.id === form.stage_id)?.is_lost ?? false
    const values = dealFormValues(form, selection.organisation.id, selection.contact?.id ?? null, isLostStage)
    const stageChanged = values.stage_id !== deal.stage_id

    setSaving(true)
    try {
      // A stage change from here has no destination column to slot into, so
      // the card goes to the end of the new one rather than keeping a position
      // that meant something in its old column.
      const boardPosition = stageChanged ? await nextBoardPosition(values.stage_id) : undefined
      const saved = await updateDeal(deal.id, {
        ...values,
        ...(boardPosition === undefined ? {} : { board_position: boardPosition }),
      })
      setDeal(saved)
      setForm(toDealFormState(saved))
      setSelection(toSelection(saved))
      showToast('Deal updated')

      // Same rule as the board: a genuine move into Won, on a production deal
      // that hasn't been sent yet.
      const movedIntoWon = stageChanged && (stages.find((s) => s.id === saved.stage_id)?.is_won ?? false)
      if (movedIntoWon && saved.deal_type === 'production' && !saved.handed_off_at) setHandoffOpen(true)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update deal', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deal) return
    setDeleteBusy(true)
    try {
      await deleteDeal(deal.id)
      showToast('Deal deleted')
      navigate(back.to)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to delete deal', 'error')
      setDeleteBusy(false)
    }
  }

  const handleHandoff = async () => {
    if (!deal) return
    setHandoffBusy(true)
    try {
      const { handedOffAt } = await markDealHandedOff(deal.id)
      setDeal((current) => (current ? { ...current, handed_off_at: handedOffAt } : current))
      showToast('Queued for StudioTime handoff')
      setHandoffOpen(false)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to record handoff', 'error')
    } finally {
      setHandoffBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 p-8">
        <SkeletonBlock className="h-8 w-64" />
        <SkeletonBlock className="h-24 w-full" />
        <SkeletonBlock className="h-64 w-full" />
      </div>
    )
  }

  if (notFound || !deal || !form) {
    return (
      <div className="p-8">
        <BackLink target={back} />
        <div className="mt-4">
          <EmptyState title="Deal not found" hint="It may have been deleted." />
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 pb-0">
      <div className="max-w-5xl">
        <BackLink target={back} />

        <div className="mt-3 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight">{deal.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {stage && <StageBadge stageKey={stage.key} label={stage.label} />}
              <Link
                to={`/organisations/${deal.organisation_id}`}
                className="flex items-center gap-2 text-sm"
                style={{ color: 'var(--color-brand-500)' }}
              >
                <CompanyLogo name={deal.organisation_name} website={deal.organisation_website} size={20} />
                {deal.organisation_name}
              </Link>
              {deal.primary_contact_id && deal.contact_name && (
                <Link
                  to={`/contacts/${deal.primary_contact_id}`}
                  className="text-sm"
                  style={{ color: 'var(--color-brand-500)' }}
                >
                  {deal.contact_name}
                </Link>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="shrink-0 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors duration-150"
            style={{ borderColor: 'var(--border)', color: 'var(--color-stage-lost)' }}
          >
            Delete
          </button>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <form onSubmit={handleSave} className="space-y-4">
            <h2 className="text-sm font-semibold tracking-tight">Details</h2>
            <DealFields
              values={form}
              onChange={(next) => setForm((current) => (current ? { ...current, ...next } : current))}
              organisation={selection.organisation}
              onOrganisationChange={(organisation) => setSelection((s) => ({ ...s, organisation }))}
              contact={selection.contact}
              onContactChange={(contact) => setSelection((s) => ({ ...s, contact }))}
              stages={stages}
            />
            {/* Submitting with Enter saves; the visible controls live in the
                SaveBar below so they follow the page rather than the form. */}
            <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
          </form>

          <aside className="space-y-6">
            <DealTasks
              dealId={deal.id}
              organisationId={deal.organisation_id}
              contactId={deal.primary_contact_id}
              // A completed task drops into the history at its completion
              // time, so the timeline has to reload to pick it up.
              onCompleted={() => setActivityKey((k) => k + 1)}
            />

            <section>
              <h2 className="text-sm font-semibold tracking-tight">Record</h2>
              {/* Only what the form beside it can't set — repeating an
                  editable field here just invites the two to disagree. */}
              <dl className="mt-3 space-y-2.5">
                <MetaRow label="Created">
                  <span className="tabular">{formatDate(deal.created_at)}</span>
                </MetaRow>
                {deal.won_at && (
                  <MetaRow label="Won">
                    <span className="tabular" style={{ color: 'var(--color-stage-won)' }}>
                      {formatDate(deal.won_at)}
                    </span>
                  </MetaRow>
                )}
                {deal.lost_at && (
                  <MetaRow label="Lost">
                    <span className="tabular" style={{ color: 'var(--color-stage-lost)' }}>
                      {formatDate(deal.lost_at)}
                    </span>
                  </MetaRow>
                )}
                <MetaRow label="StudioTime">
                  {deal.handed_off_at ? (
                    <span className="tabular" style={{ color: 'var(--color-stage-won)' }}>
                      Sent {formatDateTime(deal.handed_off_at)}
                    </span>
                  ) : (
                    'Not sent'
                  )}
                </MetaRow>
              </dl>
            </section>
          </aside>
        </div>

        <section className="mt-10 max-w-2xl">
          <h2 className="text-sm font-semibold tracking-tight">Activity</h2>
          <div className="mt-3">
            <ActivityTimeline
              key={activityKey}
              dealId={deal.id}
              logDefaults={{
                dealId: deal.id,
                organisationId: deal.organisation_id,
                contactId: deal.primary_contact_id,
                contactName: deal.contact_name,
              }}
            />
          </div>
        </section>
      </div>

      <SaveBar dirty={dirty} saving={saving} onSave={() => void handleSave()} onDiscard={discard} />

      <ConfirmDialog
        open={deleteOpen}
        title="Delete deal"
        message={`Delete "${deal.title}"? Any activities logged against it are deleted too. This can't be undone.`}
        confirmLabel="Delete"
        danger
        busy={deleteBusy}
        onConfirm={handleDelete}
        onClose={() => setDeleteOpen(false)}
      />

      <ConfirmDialog
        open={handoffOpen}
        title="Send to StudioTime?"
        message={`Send "${deal.title}" to StudioTime? You can also do this later from the dashboard.`}
        confirmLabel="Send"
        busy={handoffBusy}
        onConfirm={handleHandoff}
        onClose={() => setHandoffOpen(false)}
      />
    </div>
  )
}
