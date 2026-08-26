import type { ContactFormValues } from '@/lib/contacts'
import type { ContactRow } from '@/types/crm'

// Only the fields the form actually reads/writes — a Pick rather than the full
// ContactRow so callers can pass either a table row (ContactRow) or a view row
// (ContactListRow, e.g. from the contact page); both carry every field below
// with a matching type, but the view row is missing legacy_capsule_id and
// updated_at, which the form never touches anyway.
export type ContactEditableFields = Pick<
  ContactRow,
  'id' | 'first_name' | 'last_name' | 'role' | 'email' | 'phone' | 'organisation_id' | 'is_primary' | 'notes'
>

export type ContactFormState = Omit<ContactFormValues, 'organisation_id'>

export const EMPTY_CONTACT_FORM: ContactFormState = {
  first_name: '',
  last_name: '',
  role: '',
  email: '',
  phone: '',
  is_primary: false,
  notes: '',
}

export function toContactFormState(contact: ContactEditableFields): ContactFormState {
  return {
    first_name: contact.first_name,
    last_name: contact.last_name ?? '',
    role: contact.role ?? '',
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    is_primary: contact.is_primary,
    notes: contact.notes ?? '',
  }
}

export function contactFormValues(state: ContactFormState, organisationId: string | null): ContactFormValues {
  return {
    ...state,
    first_name: state.first_name.trim(),
    last_name: state.last_name?.trim() || null,
    role: state.role?.trim() || null,
    email: state.email?.trim() || null,
    phone: state.phone?.trim() || null,
    notes: state.notes?.trim() || null,
    organisation_id: organisationId,
  }
}
