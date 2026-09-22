import type { OrganisationFormValues } from '@/lib/organisations'
import type { OrganisationRow } from '@/types/crm'

export type OrganisationFormState = OrganisationFormValues

export const EMPTY_ORGANISATION_FORM: OrganisationFormState = {
  name: '',
  industry: '',
  website: '',
  abn: '',
  address: '',
  is_client: true,
  notes: '',
}

export function toOrganisationFormState(org: OrganisationRow): OrganisationFormState {
  return {
    name: org.name,
    industry: org.industry ?? '',
    website: org.website ?? '',
    abn: org.abn ?? '',
    address: org.address ?? '',
    is_client: org.is_client,
    notes: org.notes ?? '',
  }
}

export function organisationFormValues(state: OrganisationFormState): OrganisationFormValues {
  return {
    ...state,
    name: state.name.trim(),
    industry: state.industry?.trim() || null,
    website: state.website?.trim() || null,
    abn: state.abn?.trim() || null,
    address: state.address?.trim() || null,
    notes: state.notes?.trim() || null,
  }
}
