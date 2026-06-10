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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      assignment_countries: {
        Row: {
          created_at: string
          flag: string
          id: string
          manager_id: string
          name: string
        }
        Insert: {
          created_at?: string
          flag?: string
          id?: string
          manager_id: string
          name: string
        }
        Update: {
          created_at?: string
          flag?: string
          id?: string
          manager_id?: string
          name?: string
        }
        Relationships: []
      }
      assignment_offices: {
        Row: {
          country_id: string
          created_at: string
          id: string
          manager_id: string
          name: string
        }
        Insert: {
          country_id: string
          created_at?: string
          id?: string
          manager_id: string
          name: string
        }
        Update: {
          country_id?: string
          created_at?: string
          id?: string
          manager_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_offices_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "assignment_countries"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          age: number | null
          arabic_level: string | null
          arrival_city: string | null
          assigned_staff_id: string | null
          birth_place: string | null
          candidate_code: string | null
          children: number | null
          coc_agency_name: string | null
          coc_agency_phone: string | null
          coc_status: string | null
          contract_date: string | null
          country: string | null
          created_at: string
          created_by_name: string | null
          created_by_user_id: string | null
          cv_pdf_url: string | null
          cv_sent_date: string | null
          cv_sent_to: string | null
          destination_country: string | null
          dob: string | null
          education: string | null
          embassy_date: string | null
          emergency_contact: string | null
          english_level: string | null
          experience: string | null
          experience_country: string | null
          experience_years: string | null
          first_name: string | null
          full_name: string
          full_photo_url: string | null
          gender: string | null
          height: number | null
          id: string
          availability_type: string
          insurance_date: string | null
          insurance_status: string | null
          labour_id: string | null
          last_name: string | null
          living_town: string | null
          lmis_status: string | null
          manager_id: string
          marital_status: string | null
          medical_date: string | null
          medical_days: string | null
          medical_status: string | null
          musaned_status: string | null
          narrative: string | null
          narrative_phone: string | null
          notes: string | null
          occupation: string | null
          office: string | null
          passport_accepted: boolean | null
          passport_expiry_date: string | null
          passport_issue_date: string | null
          passport_number: string | null
          passport_scan_url: string | null
          passport_status: string | null
          photo_url: string | null
          place_of_issue: string | null
          processing_notes: string | null
          religion: string | null
          remark: string | null
          selected_by: string | null
          serial_number: string | null
          skills: string | null
          spoken_languages: string | null
          status: string
          tasheer_date: string | null
          tasheer_status: string | null
          ticket_date: string | null
          ticket_status: string | null
          unfilled_lmis: string | null
          updated_at: string
          visa_status: string | null
          weight: number | null
          wokala_status: string | null
        }
        Insert: {
          age?: number | null
          arabic_level?: string | null
          arrival_city?: string | null
          assigned_staff_id?: string | null
          birth_place?: string | null
          candidate_code?: string | null
          children?: number | null
          coc_agency_name?: string | null
          coc_agency_phone?: string | null
          coc_status?: string | null
          contract_date?: string | null
          country?: string | null
          created_at?: string
          created_by_name?: string | null
          created_by_user_id?: string | null
          cv_pdf_url?: string | null
          cv_sent_date?: string | null
          cv_sent_to?: string | null
          destination_country?: string | null
          dob?: string | null
          education?: string | null
          embassy_date?: string | null
          emergency_contact?: string | null
          english_level?: string | null
          experience?: string | null
          experience_country?: string | null
          experience_years?: string | null
          first_name?: string | null
          full_name: string
          full_photo_url?: string | null
          gender?: string | null
          height?: number | null
          id?: string
          availability_type?: string
          insurance_date?: string | null
          insurance_status?: string | null
          labour_id?: string | null
          last_name?: string | null
          living_town?: string | null
          lmis_status?: string | null
          manager_id: string
          marital_status?: string | null
          medical_date?: string | null
          medical_days?: string | null
          medical_status?: string | null
          musaned_status?: string | null
          narrative?: string | null
          narrative_phone?: string | null
          notes?: string | null
          occupation?: string | null
          office?: string | null
          passport_accepted?: boolean | null
          passport_expiry_date?: string | null
          passport_issue_date?: string | null
          passport_number?: string | null
          passport_scan_url?: string | null
          passport_status?: string | null
          photo_url?: string | null
          place_of_issue?: string | null
          processing_notes?: string | null
          religion?: string | null
          remark?: string | null
          selected_by?: string | null
          serial_number?: string | null
          skills?: string | null
          spoken_languages?: string | null
          status?: string
          tasheer_date?: string | null
          tasheer_status?: string | null
          ticket_date?: string | null
          ticket_status?: string | null
          unfilled_lmis?: string | null
          updated_at?: string
          visa_status?: string | null
          weight?: number | null
          wokala_status?: string | null
        }
        Update: {
          age?: number | null
          arabic_level?: string | null
          arrival_city?: string | null
          assigned_staff_id?: string | null
          birth_place?: string | null
          candidate_code?: string | null
          children?: number | null
          coc_agency_name?: string | null
          coc_agency_phone?: string | null
          coc_status?: string | null
          contract_date?: string | null
          country?: string | null
          created_at?: string
          created_by_name?: string | null
          created_by_user_id?: string | null
          cv_pdf_url?: string | null
          cv_sent_date?: string | null
          cv_sent_to?: string | null
          destination_country?: string | null
          dob?: string | null
          education?: string | null
          embassy_date?: string | null
          emergency_contact?: string | null
          english_level?: string | null
          experience?: string | null
          experience_country?: string | null
          experience_years?: string | null
          first_name?: string | null
          full_name?: string
          full_photo_url?: string | null
          gender?: string | null
          height?: number | null
          id?: string
          availability_type?: string
          insurance_date?: string | null
          insurance_status?: string | null
          labour_id?: string | null
          last_name?: string | null
          living_town?: string | null
          lmis_status?: string | null
          manager_id?: string
          marital_status?: string | null
          medical_date?: string | null
          medical_days?: string | null
          medical_status?: string | null
          musaned_status?: string | null
          narrative?: string | null
          narrative_phone?: string | null
          notes?: string | null
          occupation?: string | null
          office?: string | null
          passport_accepted?: boolean | null
          passport_expiry_date?: string | null
          passport_issue_date?: string | null
          passport_number?: string | null
          passport_scan_url?: string | null
          passport_status?: string | null
          photo_url?: string | null
          place_of_issue?: string | null
          processing_notes?: string | null
          religion?: string | null
          remark?: string | null
          selected_by?: string | null
          serial_number?: string | null
          skills?: string | null
          spoken_languages?: string | null
          status?: string
          tasheer_date?: string | null
          tasheer_status?: string | null
          ticket_date?: string | null
          ticket_status?: string | null
          unfilled_lmis?: string | null
          updated_at?: string
          visa_status?: string | null
          weight?: number | null
          wokala_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidates_assigned_staff_id_fkey"
            columns: ["assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      cv_templates: {
        Row: {
          created_at: string
          file_url: string
          id: string
          manager_id: string
          name: string
        }
        Insert: {
          created_at?: string
          file_url: string
          id?: string
          manager_id: string
          name: string
        }
        Update: {
          created_at?: string
          file_url?: string
          id?: string
          manager_id?: string
          name?: string
        }
        Relationships: []
      }
      foreign_agencies: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          country: string
          created_at: string
          id: string
          manager_id: string
          name: string
          portal_user_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          country: string
          created_at?: string
          id?: string
          manager_id: string
          name: string
          portal_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          country?: string
          created_at?: string
          id?: string
          manager_id?: string
          name?: string
          portal_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          agency_user_id: string | null
          candidate_ids: string[] | null
          created_at: string | null
          date_from: string | null
          date_to: string | null
          from_address: string | null
          from_company: string | null
          from_email: string | null
          from_phone: string | null
          id: string
          invoice_number: string
          manager_user_id: string | null
          office_name: string | null
          other_expenses: number | null
          payment_account: string | null
          payment_branch: string | null
          payment_name: string | null
          recru_fee: number | null
          status: string
          subtotal: number | null
          total: number | null
        }
        Insert: {
          agency_user_id?: string | null
          candidate_ids?: string[] | null
          created_at?: string | null
          date_from?: string | null
          date_to?: string | null
          from_address?: string | null
          from_company?: string | null
          from_email?: string | null
          from_phone?: string | null
          id?: string
          invoice_number: string
          manager_user_id?: string | null
          office_name?: string | null
          other_expenses?: number | null
          payment_account?: string | null
          payment_branch?: string | null
          payment_name?: string | null
          recru_fee?: number | null
          status?: string
          subtotal?: number | null
          total?: number | null
        }
        Update: {
          agency_user_id?: string | null
          candidate_ids?: string[] | null
          created_at?: string | null
          date_from?: string | null
          date_to?: string | null
          from_address?: string | null
          from_company?: string | null
          from_email?: string | null
          from_phone?: string | null
          id?: string
          invoice_number?: string
          manager_user_id?: string | null
          office_name?: string | null
          other_expenses?: number | null
          payment_account?: string | null
          payment_branch?: string | null
          payment_name?: string | null
          recru_fee?: number | null
          status?: string
          subtotal?: number | null
          total?: number | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          candidate_ids: string[] | null
          created_at: string
          id: string
          read: boolean
          recipient_id: string
          reference_id: string | null
          sender_id: string | null
          status: string
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          candidate_ids?: string[] | null
          created_at?: string
          id?: string
          read?: boolean
          recipient_id: string
          reference_id?: string | null
          sender_id?: string | null
          status?: string
          title: string
          type?: string
        }
        Update: {
          body?: string | null
          candidate_ids?: string[] | null
          created_at?: string
          id?: string
          read?: boolean
          recipient_id?: string
          reference_id?: string | null
          sender_id?: string | null
          status?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          agency_name: string | null
          avatar_url: string | null
          created_at: string
          cv_days_threshold: number
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          agency_name?: string | null
          avatar_url?: string | null
          created_at?: string
          cv_days_threshold?: number
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          agency_name?: string | null
          avatar_url?: string | null
          created_at?: string
          cv_days_threshold?: number
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          created_at: string
          email: string | null
          id: string
          manager_id: string
          name: string
          role_title: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          manager_id: string
          name: string
          role_title?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          manager_id?: string
          name?: string
          role_title?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      subscription_requests: {
        Row: {
          created_at: string
          id: string
          manager_id: string
          notes: string | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          screenshot_url: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          manager_id: string
          notes?: string | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          screenshot_url?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          manager_id?: string
          notes?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          screenshot_url?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          manager_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          manager_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          manager_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_agency_name: { Args: { user_id: string }; Returns: string }
      get_manager_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "staff" | "agency"
      subscription_plan: "basic" | "standard" | "pro"
      subscription_status: "pending" | "approved" | "rejected"
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
    Enums: {
      app_role: ["admin", "manager", "staff", "agency"],
      subscription_plan: ["basic", "standard", "pro"],
      subscription_status: ["pending", "approved", "rejected"],
    },
  },
} as const
