import { supabase } from '@/lib/supabase'

/**
 * Won and lost deals, read in aggregate. Everything here derives from columns
 * the app has been filling for months — won_at, lost_at, lost_reason,
 * value_cents — and nothing read them until now.
 */

export const REPORT_PERIODS = ['fy', 'twelve', 'all'] as const
export type ReportPeriod = (typeof REPORT_PERIODS)[number]

export const REPORT_PERIOD_LABEL: Record<ReportPeriod, string> = {
  fy: 'This financial year',
  twelve: 'Last 12 months',
  all: 'All time',
}

export interface ClosedDeal {
  id: string
  title: string
  valueCents: number
  wonAt: string | null
  lostAt: string | null
  lostReason: string | null
}

/** Closed deals are a few hundred rows, so the aggregation happens here rather
 *  than in a view — no migration, and the period can change without a round
 *  trip. The cap is a guard, not an expectation. */
export const CLOSED_DEALS_LIMIT = 5000

export async function fetchClosedDeals(): Promise<ClosedDeal[]> {
  const { data, error } = await supabase
    .from('deals')
    .select('id, title, value_cents, won_at, lost_at, lost_reason')
    .or('won_at.not.is.null,lost_at.not.is.null')
    .limit(CLOSED_DEALS_LIMIT)

  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    valueCents: row.value_cents,
    wonAt: row.won_at,
    lostAt: row.lost_at,
    lostReason: row.lost_reason,
  }))
}

/** The Australian financial year runs 1 July to 30 June. */
export function financialYearStart(now = new Date()): Date {
  const july = 6 // month index
  const year = now.getMonth() >= july ? now.getFullYear() : now.getFullYear() - 1
  return new Date(year, july, 1)
}

export function periodStart(period: ReportPeriod, now = new Date()): Date | null {
  if (period === 'all') return null
  if (period === 'fy') return financialYearStart(now)
  const d = new Date(now.getFullYear(), now.getMonth(), 1)
  d.setMonth(d.getMonth() - 11)
  return d
}

/** When a deal closed, whichever way it went. */
export function closedAt(deal: ClosedDeal): string | null {
  return deal.wonAt ?? deal.lostAt
}

export function withinPeriod(deal: ClosedDeal, start: Date | null): boolean {
  if (start === null) return true
  const at = closedAt(deal)
  return at !== null && new Date(at) >= start
}

export interface ReportSummary {
  wonCount: number
  lostCount: number
  wonValueCents: number
  lostValueCents: number
  /** Won as a share of everything closed, 0–1. Null when nothing closed. */
  winRate: number | null
  /** Null rather than 0 when nothing was won — an average of no deals is not zero. */
  averageWonCents: number | null
}

export function summarise(deals: ClosedDeal[]): ReportSummary {
  const won = deals.filter((d) => d.wonAt !== null)
  const lost = deals.filter((d) => d.wonAt === null && d.lostAt !== null)
  const wonValueCents = won.reduce((sum, d) => sum + d.valueCents, 0)
  const closed = won.length + lost.length

  return {
    wonCount: won.length,
    lostCount: lost.length,
    wonValueCents,
    lostValueCents: lost.reduce((sum, d) => sum + d.valueCents, 0),
    winRate: closed === 0 ? null : won.length / closed,
    averageWonCents: won.length === 0 ? null : Math.round(wonValueCents / won.length),
  }
}

export interface MonthPoint {
  key: string
  label: string
  valueCents: number
  count: number
}

const MONTH_LABEL = new Intl.DateTimeFormat('en-AU', { month: 'short', year: '2-digit' })

/**
 * Won value per month, as a contiguous run from the period start to now.
 * Months with nothing won are kept as zeroes on purpose — dropping them would
 * close the gap and make a quiet quarter look like steady trade.
 */
export function wonByMonth(deals: ClosedDeal[], start: Date | null, now = new Date()): MonthPoint[] {
  const won = deals.filter((d) => d.wonAt !== null)
  const buckets = new Map<string, { valueCents: number; count: number }>()

  for (const deal of won) {
    const at = new Date(deal.wonAt as string)
    const key = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}`
    const bucket = buckets.get(key) ?? { valueCents: 0, count: 0 }
    bucket.valueCents += deal.valueCents
    bucket.count += 1
    buckets.set(key, bucket)
  }

  // With no period start, run from the earliest win rather than forever.
  const earliest = won.reduce<Date | null>((min, d) => {
    const at = new Date(d.wonAt as string)
    return min === null || at < min ? at : min
  }, null)
  const from = start ?? earliest
  if (from === null) return []

  const cursor = new Date(from.getFullYear(), from.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth(), 1)
  const points: MonthPoint[] = []

  while (cursor <= last) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
    const bucket = buckets.get(key)
    points.push({
      key,
      label: MONTH_LABEL.format(cursor),
      valueCents: bucket?.valueCents ?? 0,
      count: bucket?.count ?? 0,
    })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return points
}

export interface LossReason {
  reason: string
  count: number
  valueCents: number
  /** True for the bucket holding losses nobody gave a reason for. */
  unrecorded: boolean
}

export const UNRECORDED_REASON = 'Not recorded'

/**
 * Losses grouped by reason, commonest first. Losses with no reason are kept as
 * their own bucket rather than dropped: how much you are failing to record is
 * itself worth seeing.
 */
export function lossReasons(deals: ClosedDeal[]): LossReason[] {
  const lost = deals.filter((d) => d.wonAt === null && d.lostAt !== null)
  const buckets = new Map<string, { count: number; valueCents: number }>()

  for (const deal of lost) {
    const reason = deal.lostReason?.trim() || UNRECORDED_REASON
    const bucket = buckets.get(reason) ?? { count: 0, valueCents: 0 }
    bucket.count += 1
    bucket.valueCents += deal.valueCents
    buckets.set(reason, bucket)
  }

  return Array.from(buckets, ([reason, bucket]) => ({
    reason,
    count: bucket.count,
    valueCents: bucket.valueCents,
    unrecorded: reason === UNRECORDED_REASON,
  })).sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason))
}

export function formatPercent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`
}
