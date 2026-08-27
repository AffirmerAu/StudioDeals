import { useEffect, useState, type FormEvent } from 'react'
import { Modal } from '@/components/Modal'
import { Field, inputClass, inputStyle } from '@/components/form'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/lib/toast-context'
import { createTask, updateActivity, type TimelineActivityRow } from '@/lib/activities'

interface TaskFormModalProps {
  open: boolean
  dealId: string
  organisationId: string | null
  contactId: string | null
  /** Set to edit an existing task rather than raise a new one. */
  task?: TimelineActivityRow | null
  onClose: () => void
  onSaved: (task: TimelineActivityRow) => void
}

/** `datetime-local` speaks local wall-clock with no zone; due_at is
 * timestamptz. Convert on the way in and out rather than storing the raw
 * input — same pair the activity form uses. */
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromLocalInput(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** Days ahead, then 9am local. Typing a full date and time for "chase this on
 * Thursday" is most of the friction in setting a reminder at all. */
function atNineAm(daysAhead: number, from = new Date()): string {
  const d = new Date(from)
  d.setDate(d.getDate() + daysAhead)
  d.setHours(9, 0, 0, 0)
  return toLocalInput(d.toISOString())
}

function nextMondayNineAm(from = new Date()): string {
  // getDay(): 0 Sun … 6 Sat. Always at least one day out, so "next Monday" on
  // a Monday means the one coming, not today.
  const daysUntilMonday = ((8 - from.getDay()) % 7) || 7
  return atNineAm(daysUntilMonday, from)
}

export function TaskFormModal({
  open,
  dealId,
  organisationId,
  contactId,
  task,
  onClose,
  onSaved,
}: TaskFormModalProps) {
  const { session } = useAuth()
  const { showToast } = useToast()
  const [subject, setSubject] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setSubject(task?.subject ?? '')
    setNotes(task?.notes ?? '')
    setDueAt(task?.due_at ? toLocalInput(task.due_at) : atNineAm(1))
  }, [open, task])

  const presets: { label: string; value: () => string }[] = [
    { label: 'Tomorrow', value: () => atNineAm(1) },
    { label: 'In 3 days', value: () => atNineAm(3) },
    { label: 'Next week', value: () => atNineAm(7) },
    { label: 'Next Monday', value: () => nextMondayNineAm() },
  ]

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const due = fromLocalInput(dueAt)
    if (!due) {
      showToast('A task needs a date to be a reminder', 'error')
      return
    }

    setSaving(true)
    try {
      const saved = task
        ? await updateActivity(task.id, {
            type: task.type,
            subject: subject.trim() || null,
            notes: notes.trim() || null,
            occurred_at: task.occurred_at,
            due_at: due,
            deal_id: task.deal_id,
            organisation_id: task.organisation_id,
            contact_id: task.contact_id,
          })
        : await createTask(
            { subject, dueAt: due, notes, dealId, organisationId, contactId },
            session?.user.id ?? null,
          )
      showToast(task ? 'Task updated' : 'Task added')
      onSaved(saved)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to save the task', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={task ? 'Edit task' : 'Add task'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="What needs doing" required>
          <input
            required
            autoFocus
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Chase the signed SOW"
            className={inputClass}
            style={inputStyle}
          />
        </Field>

        <Field label="Remind me" required>
          <input
            required
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className={`tabular ${inputClass}`}
            style={inputStyle}
          />
        </Field>

        <div className="flex flex-wrap gap-1.5">
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setDueAt(preset.value())}
              className="rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors duration-150"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-brand-500)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
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
            {saving ? 'Saving…' : task ? 'Save' : 'Add task'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
