export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  crm: {
    Tables: {
      activities: {
        Row: {
          completed_at: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          due_at: string | null
          id: string
          notes: string | null
          occurred_at: string
          organisation_id: string | null
          subject: string | null
          type: string
        }
        Insert: {
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          due_at?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string
          organisation_id?: string | null
          subject?: string | null
          type: string
        }
        Update: {
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          due_at?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string
          organisation_id?: string | null
          subject?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "v_contacts_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "v_possible_duplicate_contacts"
            referencedColumns: ["id_a"]
          },
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "v_possible_duplicate_contacts"
            referencedColumns: ["id_b"]
          },
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "v_stale_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "v_deals_needing_attention"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "v_pending_handoff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "v_organisation_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "v_possible_duplicate_orgs"
            referencedColumns: ["id_a"]
          },
          {
            foreignKeyName: "activities_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "v_possible_duplicate_orgs"
            referencedColumns: ["id_b"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          email: string | null
          first_name: string
          id: string
          is_primary: boolean
          last_contacted_at: string | null
          last_contacted_baseline: string | null
          last_name: string | null
          legacy_capsule_id: string | null
          notes: string | null
          organisation_id: string | null
          phone: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          is_primary?: boolean
          last_contacted_at?: string | null
          last_contacted_baseline?: string | null
          last_name?: string | null
          legacy_capsule_id?: string | null
          notes?: string | null
          organisation_id?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          is_primary?: boolean
          last_contacted_at?: string | null
          last_contacted_baseline?: string | null
          last_name?: string | null
          legacy_capsule_id?: string | null
          notes?: string | null
          organisation_id?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "v_organisation_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "v_possible_duplicate_orgs"
            referencedColumns: ["id_a"]
          },
          {
            foreignKeyName: "contacts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "v_possible_duplicate_orgs"
            referencedColumns: ["id_b"]
          },
        ]
      }
      deals: {
        Row: {
          board_position: number
          created_at: string
          currency: string
          deal_type: string
          expected_close_date: string | null
          handed_off_at: string | null
          handoff_key: string | null
          id: string
          legacy_capsule_id: string | null
          lost_at: string | null
          lost_reason: string | null
          notes: string | null
          organisation_id: string
          primary_contact_id: string | null
          probability_override: number | null
          source: string | null
          stage_id: number
          studiotime_project_id: string | null
          title: string
          updated_at: string
          value_cents: number
          won_at: string | null
        }
        Insert: {
          board_position?: number
          created_at?: string
          currency?: string
          deal_type?: string
          expected_close_date?: string | null
          handed_off_at?: string | null
          handoff_key?: string | null
          id?: string
          legacy_capsule_id?: string | null
          lost_at?: string | null
          lost_reason?: string | null
          notes?: string | null
          organisation_id: string
          primary_contact_id?: string | null
          probability_override?: number | null
          source?: string | null
          stage_id?: number
          studiotime_project_id?: string | null
          title: string
          updated_at?: string
          value_cents?: number
          won_at?: string | null
        }
        Update: {
          board_position?: number
          created_at?: string
          currency?: string
          deal_type?: string
          expected_close_date?: string | null
          handed_off_at?: string | null
          handoff_key?: string | null
          id?: string
          legacy_capsule_id?: string | null
          lost_at?: string | null
          lost_reason?: string | null
          notes?: string | null
          organisation_id?: string
          primary_contact_id?: string | null
          probability_override?: number | null
          source?: string | null
          stage_id?: number
          studiotime_project_id?: string | null
          title?: string
          updated_at?: string
          value_cents?: number
          won_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "v_organisation_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "v_possible_duplicate_orgs"
            referencedColumns: ["id_a"]
          },
          {
            foreignKeyName: "deals_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "v_possible_duplicate_orgs"
            referencedColumns: ["id_b"]
          },
          {
            foreignKeyName: "deals_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "v_contacts_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "v_possible_duplicate_contacts"
            referencedColumns: ["id_a"]
          },
          {
            foreignKeyName: "deals_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "v_possible_duplicate_contacts"
            referencedColumns: ["id_b"]
          },
          {
            foreignKeyName: "deals_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "v_stale_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      merge_log: {
        Row: {
          entity_type: string
          id: string
          merged_at: string
          merged_by: string | null
          merged_id: string
          merged_snapshot: Json
          survivor_id: string
        }
        Insert: {
          entity_type: string
          id?: string
          merged_at?: string
          merged_by?: string | null
          merged_id: string
          merged_snapshot: Json
          survivor_id: string
        }
        Update: {
          entity_type?: string
          id?: string
          merged_at?: string
          merged_by?: string | null
          merged_id?: string
          merged_snapshot?: Json
          survivor_id?: string
        }
        Relationships: []
      }
      organisations: {
        Row: {
          abn: string | null
          account_number: string | null
          address: string | null
          created_at: string
          id: string
          industry: string | null
          is_client: boolean
          legacy_capsule_id: string | null
          name: string
          notes: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          abn?: string | null
          account_number?: string | null
          address?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          is_client?: boolean
          legacy_capsule_id?: string | null
          name: string
          notes?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          abn?: string | null
          account_number?: string | null
          address?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          is_client?: boolean
          legacy_capsule_id?: string | null
          name?: string
          notes?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          id: number
          is_lost: boolean
          is_won: boolean
          key: string
          label: string
          position: number
          probability: number
        }
        Insert: {
          id: number
          is_lost?: boolean
          is_won?: boolean
          key: string
          label: string
          position: number
          probability?: number
        }
        Update: {
          id?: number
          is_lost?: boolean
          is_won?: boolean
          key?: string
          label?: string
          position?: number
          probability?: number
        }
        Relationships: []
      }
      taggings: {
        Row: {
          contact_id: string | null
          id: number
          organisation_id: string | null
          tag_id: number
        }
        Insert: {
          contact_id?: string | null
          id?: number
          organisation_id?: string | null
          tag_id: number
        }
        Update: {
          contact_id?: string | null
          id?: number
          organisation_id?: string | null
          tag_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "taggings_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taggings_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "v_contacts_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taggings_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "v_possible_duplicate_contacts"
            referencedColumns: ["id_a"]
          },
          {
            foreignKeyName: "taggings_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "v_possible_duplicate_contacts"
            referencedColumns: ["id_b"]
          },
          {
            foreignKeyName: "taggings_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "v_stale_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taggings_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taggings_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "v_organisation_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taggings_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "v_possible_duplicate_orgs"
            referencedColumns: ["id_a"]
          },
          {
            foreignKeyName: "taggings_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "v_possible_duplicate_orgs"
            referencedColumns: ["id_b"]
          },
          {
            foreignKeyName: "taggings_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          id: number
          kind: string
          label: string
        }
        Insert: {
          id?: number
          kind?: string
          label: string
        }
        Update: {
          id?: number
          kind?: string
          label?: string
        }
        Relationships: []
      }
      targets: {
        Row: {
          id: number
          new_deals_per_month: number
          updated_at: string
          won_deals_per_month: number
          won_value_cents_per_month: number
        }
        Insert: {
          id?: number
          new_deals_per_month?: number
          updated_at?: string
          won_deals_per_month?: number
          won_value_cents_per_month?: number
        }
        Update: {
          id?: number
          new_deals_per_month?: number
          updated_at?: string
          won_deals_per_month?: number
          won_value_cents_per_month?: number
        }
        Relationships: []
      }
    }
    Views: {
      v_contacts_list: {
        Row: {
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string | null
          is_client: boolean | null
          is_primary: boolean | null
          is_stale: boolean | null
          last_contacted_at: string | null
          last_name: string | null
          notes: string | null
          organisation_id: string | null
          organisation_industry: string | null
          organisation_name: string | null
          phone: string | null
          role: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "v_organisation_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "v_possible_duplicate_orgs"
            referencedColumns: ["id_a"]
          },
          {
            foreignKeyName: "contacts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "v_possible_duplicate_orgs"
            referencedColumns: ["id_b"]
          },
        ]
      }
      v_deals_needing_attention: {
        Row: {
          close_date_passed: boolean | null
          id: string | null
          missing_close_date: boolean | null
          missing_value: boolean | null
          organisation_name: string | null
          stage: string | null
          title: string | null
        }
        Relationships: []
      }
      v_merge_log: {
        Row: {
          entity_type: string | null
          id: string | null
          merged_at: string | null
          merged_by: string | null
          merged_id: string | null
          merged_name: string | null
          merged_snapshot: Json | null
          survivor_id: string | null
          survivor_name: string | null
        }
        Relationships: []
      }
      v_organisation_summary: {
        Row: {
          abn: string | null
          account_number: string | null
          address: string | null
          contact_count: number | null
          created_at: string | null
          deal_count: number | null
          id: string | null
          industry: string | null
          is_client: boolean | null
          last_contacted_at: string | null
          name: string | null
          notes: string | null
          open_deal_count: number | null
          open_value_cents: number | null
          website: string | null
          won_value_cents: number | null
        }
        Relationships: []
      }
      v_pending_handoff: {
        Row: {
          id: string | null
          organisation_name: string | null
          title: string | null
          won_at: string | null
        }
        Relationships: []
      }
      v_pipeline_forecast: {
        Row: {
          deal_count: number | null
          deal_type: string | null
          forecast_month: string | null
          gross_value_cents: number | null
          weighted_value_cents: number | null
        }
        Relationships: []
      }
      v_possible_duplicate_contacts: {
        Row: {
          email_a: string | null
          email_b: string | null
          id_a: string | null
          id_b: string | null
          match_on: string | null
          name_a: string | null
          name_b: string | null
          organisation_name: string | null
          score: number | null
        }
        Relationships: []
      }
      v_possible_duplicate_orgs: {
        Row: {
          id_a: string | null
          id_b: string | null
          name_a: string | null
          name_b: string | null
          score: number | null
        }
        Relationships: []
      }
      v_stale_contacts: {
        Row: {
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string | null
          is_primary: boolean | null
          last_contacted_at: string | null
          last_name: string | null
          legacy_capsule_id: string | null
          notes: string | null
          organisation_id: string | null
          organisation_name: string | null
          phone: string | null
          role: string | null
          since_contact: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "v_organisation_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "v_possible_duplicate_orgs"
            referencedColumns: ["id_a"]
          },
          {
            foreignKeyName: "contacts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "v_possible_duplicate_orgs"
            referencedColumns: ["id_b"]
          },
        ]
      }
    }
    Functions: {
      merge_contacts: {
        Args: { loser: string; survivor: string }
        Returns: undefined
      }
      merge_organisations: {
        Args: { loser: string; survivor: string }
        Returns: undefined
      }
      recompute_last_contacted: { Args: { target: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  crm: {
    Enums: {},
  },
} as const
