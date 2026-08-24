/**
 * Placeholder types — replace with the generated file.
 *
 * Supabase dashboard -> Integrations -> Data API -> TypeScript.
 * Copy the output over this whole file, then delete this comment.
 *
 * Regenerate after EVERY schema change. Stale types are the most common
 * source of confusing errors when building against Supabase.
 *
 * The shape below exists only so `db: { schema: 'crm' }` type-checks
 * before the real types are generated. It provides no actual safety.
 */

type AnyTable = {
  Row: Record<string, any>
  Insert: Record<string, any>
  Update: Record<string, any>
  Relationships: []
}

export type Database = {
  crm: {
    Tables: Record<string, AnyTable>
    Views: Record<string, { Row: Record<string, any>; Relationships: [] }>
    Functions: Record<string, { Args: Record<string, any>; Returns: any }>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
