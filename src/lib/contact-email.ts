import type { ContactFormState } from '@/components/contacts/contact-form'
import type { OrganisationFormState } from '@/components/organisations/organisation-form'
import type { OrganisationOption } from '@/lib/organisations'

/** Where the prompt goes. Your own address, not the contact's — this is a note
 *  to yourself to reply, not the reply. */
export const NEW_CONTACT_RECIPIENT = 'admin@affirmer.com.au'

/**
 * mailto: bodies get truncated by some clients somewhere north of 2,000
 * characters, and a silently clipped email is worse than a short one. Notes
 * are the only field that can run long, so they are the only one cut.
 */
const NOTES_LIMIT = 800

interface Line {
  label: string
  value: string | null | undefined
}

/** Blank fields are left out rather than listed as empty — a prompt to reply
 *  should be readable at a glance, not a form with gaps in it. */
function block(heading: string, lines: Line[]): string[] {
  const kept = lines
    .filter((l) => (l.value ?? '').trim().length > 0)
    .map((l) => `${l.label}: ${(l.value ?? '').trim()}`)
  return kept.length ? [heading, ...kept, ''] : []
}

function truncate(text: string, limit: number): string {
  const trimmed = text.trim()
  return trimmed.length <= limit ? trimmed : `${trimmed.slice(0, limit - 1)}…`
}

/**
 * The organisation as the email should describe it.
 *
 * A newly typed one carries everything just entered; an existing one carries
 * only what the picker holds. That asymmetry is deliberate — the details worth
 * putting in front of you are the ones that were not already in StudioDeals.
 */
export function organisationLines(
  existing: OrganisationOption | null,
  draft: OrganisationFormState | null,
): Line[] {
  if (draft) {
    return [
      { label: 'Organisation', value: draft.name },
      { label: 'Industry', value: draft.industry },
      { label: 'Website', value: draft.website },
      { label: 'ABN', value: draft.abn },
      { label: 'Address', value: draft.address },
      { label: 'Client', value: draft.is_client ? 'yes' : 'no' },
      { label: 'Organisation notes', value: draft.notes },
      { label: 'Status', value: 'new — created with this contact' },
    ]
  }
  if (existing) {
    return [
      { label: 'Organisation', value: existing.name },
      { label: 'Industry', value: existing.industry },
    ]
  }
  return []
}

export function newContactSubject(contact: ContactFormState, organisationName: string): string {
  const name = [contact.first_name, contact.last_name].map((p) => (p ?? '').trim()).filter(Boolean).join(' ')
  const who = name || (contact.email ?? '').trim() || 'contact'
  return organisationName ? `New contact: ${who} — ${organisationName}` : `New contact: ${who}`
}

export function newContactBody(
  contact: ContactFormState,
  existing: OrganisationOption | null,
  draft: OrganisationFormState | null,
): string {
  const name = [contact.first_name, contact.last_name].map((p) => (p ?? '').trim()).filter(Boolean).join(' ')

  const lines = [
    ...block('Contact', [
      { label: 'Name', value: name },
      { label: 'Role', value: contact.role },
      { label: 'Email', value: contact.email },
      { label: 'Phone', value: contact.phone },
      { label: 'Primary contact', value: contact.is_primary ? 'yes' : null },
    ]),
    ...block('Organisation', organisationLines(existing, draft)),
    ...block('Notes', [{ label: 'Notes', value: truncate(contact.notes ?? '', NOTES_LIMIT) }]),
  ]

  return lines.join('\n').trimEnd()
}

/** The whole mailto:, ready to hang off an anchor. */
export function newContactEmailHref(
  contact: ContactFormState,
  existing: OrganisationOption | null,
  draft: OrganisationFormState | null,
): string {
  const organisationName = (draft?.name ?? existing?.name ?? '').trim()
  const subject = encodeURIComponent(newContactSubject(contact, organisationName))
  const body = encodeURIComponent(newContactBody(contact, existing, draft))
  return `mailto:${NEW_CONTACT_RECIPIENT}?subject=${subject}&body=${body}`
}
