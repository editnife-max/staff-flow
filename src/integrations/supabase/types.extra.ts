/**
 * Manual type extensions for tables and columns not yet reflected in the
 * auto-generated types.ts. When the schema is regenerated, check whether
 * these can be removed (i.e., supabase gen types now covers them).
 */
import type { Json, Database } from "./types";

type PatchedAssignmentOffices = Omit<
  Database["public"]["Tables"]["assignment_offices"],
  "Row" | "Insert" | "Update"
> & {
  Row: Database["public"]["Tables"]["assignment_offices"]["Row"] & {
    is_locked: boolean;
  };
  Insert: Database["public"]["Tables"]["assignment_offices"]["Insert"] & {
    is_locked?: boolean;
  };
  Update: Database["public"]["Tables"]["assignment_offices"]["Update"] & {
    is_locked?: boolean;
  };
};

type PatchedStaff = Omit<
  Database["public"]["Tables"]["staff"],
  "Row" | "Insert" | "Update"
> & {
  Row: Database["public"]["Tables"]["staff"]["Row"] & {
    is_suspended: boolean;
    suspended_at: string | null;
  };
  Insert: Database["public"]["Tables"]["staff"]["Insert"] & {
    is_suspended?: boolean;
    suspended_at?: string | null;
  };
  Update: Database["public"]["Tables"]["staff"]["Update"] & {
    is_suspended?: boolean;
    suspended_at?: string | null;
  };
};

type PatchedProfiles = Omit<
  Database["public"]["Tables"]["profiles"],
  "Row" | "Insert" | "Update"
> & {
  Row: Database["public"]["Tables"]["profiles"]["Row"] & {
    narrative_gen_count: number;
    narrative_gen_reset_at: string;
  };
  Insert: Database["public"]["Tables"]["profiles"]["Insert"] & {
    narrative_gen_count?: number;
    narrative_gen_reset_at?: string;
  };
  Update: Database["public"]["Tables"]["profiles"]["Update"] & {
    narrative_gen_count?: number;
    narrative_gen_reset_at?: string;
  };
};

type ExtraTables = {
  admin_audit_log: {
    Row: {
      id: string;
      created_at: string;
      action: string;
      actor_user_id: string;
      target_user_id: string | null;
      metadata: Json | null;
    };
    Insert: {
      id?: string;
      created_at?: string;
      action: string;
      actor_user_id: string;
      target_user_id?: string | null;
      metadata?: Json | null;
    };
    Update: {
      id?: string;
      created_at?: string;
      action?: string;
      actor_user_id?: string;
      target_user_id?: string | null;
      metadata?: Json | null;
    };
    Relationships: [];
  };
  staff_daily_attendance: {
    Row: {
      id: string;
      created_at: string;
      staff_user_id: string;
      manager_id: string;
      staff_id: string;
      date: string;
      first_login_at: string | null;
      is_late: boolean;
      absent: boolean;
      excused: boolean;
      excused_at: string | null;
      reason: string | null;
    };
    Insert: {
      id?: string;
      created_at?: string;
      staff_user_id: string;
      manager_id: string;
      staff_id: string;
      date: string;
      first_login_at?: string | null;
      is_late?: boolean;
      absent?: boolean;
      excused?: boolean;
      excused_at?: string | null;
      reason?: string | null;
    };
    Update: {
      id?: string;
      created_at?: string;
      staff_user_id?: string;
      manager_id?: string;
      staff_id?: string;
      date?: string;
      first_login_at?: string | null;
      is_late?: boolean;
      absent?: boolean;
      excused?: boolean;
      excused_at?: string | null;
      reason?: string | null;
    };
    Relationships: [];
  };
};

type ExtraFunctions = {
  get_admin_stats: {
    Args: Record<string, never>;
    Returns: Json;
  };
  next_candidate_code: {
    Args: { p_manager_id: string };
    Returns: string;
  };
  check_and_maybe_suspend_staff: {
    Args: {
      p_user_id: string;
      p_now: string;
      p_max_incidents: number;
      p_lookback_days: number;
    };
    Returns: Array<{ incident_count: number; was_suspended: boolean }>;
  };
};

export type AppDatabase = Omit<Database, "public"> & {
  __InternalSupabase: Database["__InternalSupabase"];
  public: Omit<Database["public"], "Tables" | "Functions"> & {
    Tables: Omit<Database["public"]["Tables"], "assignment_offices" | "staff" | "profiles"> & {
      assignment_offices: PatchedAssignmentOffices;
      staff: PatchedStaff;
      profiles: PatchedProfiles;
    } & ExtraTables;
    Functions: Database["public"]["Functions"] & ExtraFunctions;
  };
};
