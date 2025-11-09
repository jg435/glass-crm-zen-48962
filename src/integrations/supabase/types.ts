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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agent_actions: {
        Row: {
          action_type: string
          agent_type: string
          approved_at: string | null
          created_at: string | null
          data: Json | null
          error_message: string | null
          executed_at: string | null
          id: string
          requires_approval: boolean | null
          status: string
        }
        Insert: {
          action_type: string
          agent_type: string
          approved_at?: string | null
          created_at?: string | null
          data?: Json | null
          error_message?: string | null
          executed_at?: string | null
          id?: string
          requires_approval?: boolean | null
          status?: string
        }
        Update: {
          action_type?: string
          agent_type?: string
          approved_at?: string | null
          created_at?: string | null
          data?: Json | null
          error_message?: string | null
          executed_at?: string | null
          id?: string
          requires_approval?: boolean | null
          status?: string
        }
        Relationships: []
      }
      agent_runs: {
        Row: {
          actions_taken: Json | null
          agent_type: string
          completed_at: string | null
          created_at: string | null
          errors: Json | null
          id: string
          started_at: string | null
          status: string | null
        }
        Insert: {
          actions_taken?: Json | null
          agent_type: string
          completed_at?: string | null
          created_at?: string | null
          errors?: Json | null
          id?: string
          started_at?: string | null
          status?: string | null
        }
        Update: {
          actions_taken?: Json | null
          agent_type?: string
          completed_at?: string | null
          created_at?: string | null
          errors?: Json | null
          id?: string
          started_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      company_profile: {
        Row: {
          company: string
          created_at: string
          id: string
          industry: string | null
          keywords: Json | null
          target_industries: Json | null
          target_roles: Json | null
          updated_at: string
        }
        Insert: {
          company: string
          created_at?: string
          id?: string
          industry?: string | null
          keywords?: Json | null
          target_industries?: Json | null
          target_roles?: Json | null
          updated_at?: string
        }
        Update: {
          company?: string
          created_at?: string
          id?: string
          industry?: string | null
          keywords?: Json | null
          target_industries?: Json | null
          target_roles?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      deals: {
        Row: {
          associated_contact_id: string | null
          close_date: string | null
          created_at: string
          id: string
          last_activity_at: string | null
          lead_id: string | null
          name: string
          probability: number | null
          source: string | null
          stage: string
          updated_at: string
          value: number | null
        }
        Insert: {
          associated_contact_id?: string | null
          close_date?: string | null
          created_at?: string
          id?: string
          last_activity_at?: string | null
          lead_id?: string | null
          name: string
          probability?: number | null
          source?: string | null
          stage?: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          associated_contact_id?: string | null
          close_date?: string | null
          created_at?: string
          id?: string
          last_activity_at?: string | null
          lead_id?: string | null
          name?: string
          probability?: number | null
          source?: string | null
          stage?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_associated_contact_id_fkey"
            columns: ["associated_contact_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          agent_notes: string | null
          body: string
          created_at: string | null
          draft_status: string
          followup_sequence_number: number | null
          id: string
          is_automated_followup: boolean | null
          lead_id: string
          manager_feedback: string | null
          scheduled_send_at: string | null
          sent_at: string | null
          subject: string
          updated_at: string | null
        }
        Insert: {
          agent_notes?: string | null
          body: string
          created_at?: string | null
          draft_status?: string
          followup_sequence_number?: number | null
          id?: string
          is_automated_followup?: boolean | null
          lead_id: string
          manager_feedback?: string | null
          scheduled_send_at?: string | null
          sent_at?: string | null
          subject: string
          updated_at?: string | null
        }
        Update: {
          agent_notes?: string | null
          body?: string
          created_at?: string | null
          draft_status?: string
          followup_sequence_number?: number | null
          id?: string
          is_automated_followup?: boolean | null
          lead_id?: string
          manager_feedback?: string | null
          scheduled_send_at?: string | null
          sent_at?: string | null
          subject?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      email_replies: {
        Row: {
          campaign_id: string | null
          created_at: string | null
          draft_response: string | null
          id: string
          lead_id: string | null
          replied_at: string | null
          reply_content: string
          requires_manager_review: boolean | null
          reviewed_at: string | null
          sentiment_score: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string | null
          draft_response?: string | null
          id?: string
          lead_id?: string | null
          replied_at?: string | null
          reply_content: string
          requires_manager_review?: boolean | null
          reviewed_at?: string | null
          sentiment_score?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string | null
          draft_response?: string | null
          id?: string
          lead_id?: string | null
          replied_at?: string | null
          reply_content?: string
          requires_manager_review?: boolean | null
          reviewed_at?: string | null
          sentiment_score?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_replies_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_replies_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      email_tracking: {
        Row: {
          campaign_id: string
          clicked_at: string | null
          created_at: string | null
          id: string
          opened_at: string | null
          replied_at: string | null
          reply_content: string | null
          reply_sentiment: string | null
        }
        Insert: {
          campaign_id: string
          clicked_at?: string | null
          created_at?: string | null
          id?: string
          opened_at?: string | null
          replied_at?: string | null
          reply_content?: string | null
          reply_sentiment?: string | null
        }
        Update: {
          campaign_id?: string
          clicked_at?: string | null
          created_at?: string | null
          id?: string
          opened_at?: string | null
          replied_at?: string | null
          reply_content?: string | null
          reply_sentiment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_tracking_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          company: string | null
          created_at: string | null
          deal_value: number | null
          email: string | null
          id: string
          industry: string | null
          intent: string | null
          last_contacted_at: string | null
          last_reply_at: string | null
          lead_score: number | null
          linkedin_url: string | null
          name: string
          next_followup_at: string | null
          notes: string | null
          phone: string | null
          sentiment_score: number | null
          source: string
          status: string
          twitter_handle: string | null
          unresponsive_days: number | null
          website: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string | null
          deal_value?: number | null
          email?: string | null
          id?: string
          industry?: string | null
          intent?: string | null
          last_contacted_at?: string | null
          last_reply_at?: string | null
          lead_score?: number | null
          linkedin_url?: string | null
          name: string
          next_followup_at?: string | null
          notes?: string | null
          phone?: string | null
          sentiment_score?: number | null
          source: string
          status?: string
          twitter_handle?: string | null
          unresponsive_days?: number | null
          website?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string | null
          deal_value?: number | null
          email?: string | null
          id?: string
          industry?: string | null
          intent?: string | null
          last_contacted_at?: string | null
          last_reply_at?: string | null
          lead_score?: number | null
          linkedin_url?: string | null
          name?: string
          next_followup_at?: string | null
          notes?: string | null
          phone?: string | null
          sentiment_score?: number | null
          source?: string
          status?: string
          twitter_handle?: string | null
          unresponsive_days?: number | null
          website?: string | null
        }
        Relationships: []
      }
      manager_profile: {
        Row: {
          calendar_sync_token: string | null
          created_at: string | null
          email: string
          id: string
          name: string
          preferences: Json | null
          updated_at: string | null
        }
        Insert: {
          calendar_sync_token?: string | null
          created_at?: string | null
          email: string
          id?: string
          name: string
          preferences?: Json | null
          updated_at?: string | null
        }
        Update: {
          calendar_sync_token?: string | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          preferences?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      meetings: {
        Row: {
          agent_joined_at: string | null
          agent_notes: string | null
          ai_agent_confidence_score: number | null
          conversation_summary: string | null
          created_at: string | null
          google_meet_link: string | null
          id: string
          lead_id: string
          manager_alert_reason: string | null
          manager_alert_triggered: boolean | null
          manager_joined_at: string | null
          meeting_duration: number | null
          outcome: string | null
          real_time_transcript: Json | null
          scheduled_at: string
          sentiment_analysis: Json | null
          status: string
          title: string
          transcript: string | null
          updated_at: string | null
        }
        Insert: {
          agent_joined_at?: string | null
          agent_notes?: string | null
          ai_agent_confidence_score?: number | null
          conversation_summary?: string | null
          created_at?: string | null
          google_meet_link?: string | null
          id?: string
          lead_id: string
          manager_alert_reason?: string | null
          manager_alert_triggered?: boolean | null
          manager_joined_at?: string | null
          meeting_duration?: number | null
          outcome?: string | null
          real_time_transcript?: Json | null
          scheduled_at: string
          sentiment_analysis?: Json | null
          status?: string
          title: string
          transcript?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_joined_at?: string | null
          agent_notes?: string | null
          ai_agent_confidence_score?: number | null
          conversation_summary?: string | null
          created_at?: string | null
          google_meet_link?: string | null
          id?: string
          lead_id?: string
          manager_alert_reason?: string | null
          manager_alert_triggered?: boolean | null
          manager_joined_at?: string | null
          meeting_duration?: number | null
          outcome?: string | null
          real_time_transcript?: Json | null
          scheduled_at?: string
          sentiment_analysis?: Json | null
          status?: string
          title?: string
          transcript?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      ui_state: {
        Row: {
          active_tile: string | null
          expanded_tiles: Json | null
          id: string
          preferences: Json | null
          updated_at: string | null
          user_id: string
          voice_mode_active: boolean | null
        }
        Insert: {
          active_tile?: string | null
          expanded_tiles?: Json | null
          id?: string
          preferences?: Json | null
          updated_at?: string | null
          user_id: string
          voice_mode_active?: boolean | null
        }
        Update: {
          active_tile?: string | null
          expanded_tiles?: Json | null
          id?: string
          preferences?: Json | null
          updated_at?: string | null
          user_id?: string
          voice_mode_active?: boolean | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const
