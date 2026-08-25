import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Drawer } from '@/components/Drawer'
import { ActivityTimeline } from '@/components/ActivityTimeline'
import { StageBadge } from '@/components/StageBadge'
import { formatCents, formatDate, formatDateTime } from '@/lib/format'
import type { DealBoardRow } from '@/lib/deals'
import type { PipelineStageRow } from '@/types/crm'

const DEAL_TYPE_LABEL: Record<string, string> = {
  production: 'Production',
  prestarter: 'Prestarter',
  retainer: 'Retainer',
  other: 'Other',
}

interface DealDetailDrawerProps {
  deal: DealBoardRow | null
  stages: PipelineStageRow[]
  onClose: () => void
  onEdit: (deal: DealBoardRow) => void
  onDelete: (deal: DealBoardRow) => void
}

export function DealDetailDrawer({ deal, stages, onClose, onEdit, onDelete }: DealDetailDrawerProps) {
  const stage = deal ? stages.find((s) => s.id === deal.stage_id) : undefined

  return (
    <Drawer open={deal !== null} onClose={onClose} title={deal?.title ?? 'Deal'}>
      {deal && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            {stage ? <StageBadge stageKey={stage.key} label={stage.label} /> : <span />}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onEdit(deal)}
                className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors duration-150"
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDelete(deal)}
                className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors duration-150"
                style={{ borderColor: 'var(--border)', color: 'var(--color-stage-lost)' }}
              >
                Delete
              </button>
            </div>
          </div>

          <dl className="space-y-2.5 text-sm">
            <Row
              label="Organisation"
              value={
                <Link to={`/organisations/${deal.organisation_id}`} style={{ color: 'var(--color-brand-500)' }}>
                  {deal.organisation_name}
                </Link>
              }
            />
            <Row label="Contact" value={deal.contact_name ?? '—'} />
            <Row label="Deal type" value={DEAL_TYPE_LABEL[deal.deal_type] ?? deal.deal_type} />
            <Row label="Value" value={<span className="tabular">{formatCents(deal.value_cents)}</span>} />
            <Row
              label="Expected close"
              value={<span className="tabular">{formatDate(deal.expected_close_date)}</span>}
            />
            <Row label="Source" value={deal.source ?? '—'} />
            {deal.won_at && (
              <Row
                label="Won"
                value={
                  <span className="tabular" style={{ color: 'var(--color-stage-won)' }}>
                    {formatDate(deal.won_at)}
                  </span>
                }
              />
            )}
            {deal.lost_at && (
              <Row
                label="Lost"
                value={
                  <span className="tabular" style={{ color: 'var(--color-stage-lost)' }}>
                    {formatDate(deal.lost_at)}
                  </span>
                }
              />
            )}
            {deal.lost_reason && <Row label="Lost reason" value={deal.lost_reason} />}
            <Row
              label="StudioTime"
              value={
                deal.handed_off_at ? (
                  <span className="tabular" style={{ color: 'var(--color-stage-won)' }}>
                    Sent {formatDateTime(deal.handed_off_at)}
                  </span>
                ) : (
                  'Not sent'
                )
              }
            />
            {deal.notes && <Row label="Notes" value={deal.notes} />}
          </dl>

          <section>
            <h3 className="text-sm font-semibold tracking-tight">Activity</h3>
            <div className="mt-3">
              <ActivityTimeline
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
      )}
    </Drawer>
  )
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt style={{ color: 'var(--text-subtle)' }}>{label}</dt>
      <dd className="text-right" style={{ color: 'var(--text)' }}>
        {value}
      </dd>
    </div>
  )
}
