import { createContext, useContext, useEffect, useRef, useCallback, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "manager" | "staff" | "agency";

const ROLE_PRIORITY: AppRole[] = ["admin", "manager", "staff", "agency"];
const INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 1 hour
const ROLE_POLL_INTERVAL = 2 * 60 * 1000;  // 2 minutes

interface AuthCtx {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSignOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  // showRevokedToast=true only during periodic polling (not on initial page load)
  const fetchRole = useCallback(async (userId: string, showRevokedToast = false): Promise<AppRole | null> => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (error) return null; // Don't sign out on transient network errors
    const roles = (data ?? []).map((r) => r.role as AppRole);
    const resolved = ROLE_PRIORITY.find((r) => roles.includes(r)) ?? null;
    setRole(resolved);
    if (resolved === null) {
      if (showRevokedToast) toast.error("Your account access has been revoked.");
      await supabase.auth.signOut();
    }
    return resolved;
  }, []);

  // Inactivity auto-logout: reset timer on any user interaction
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(async () => {
      toast.info("You were signed out due to inactivity.");
      await doSignOut();
    }, INACTIVITY_TIMEOUT);
  }, [doSignOut]);

  // Attach inactivity listeners only while a session is active
  useEffect(() => {
    if (!session) {
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
        inactivityTimer.current = null;
      }
      return;
    }
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"] as const;
    events.forEach((e) => window.addEventListener(e, resetInactivityTimer, { passive: true }));
    resetInactivityTimer();
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetInactivityTimer));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [session, resetInactivityTimer]);

  // Poll role every 2 minutes to detect deletion while logged in
  useEffect(() => {
    if (!session?.user) return;
    const id = setInterval(() => fetchRole(session.user.id, true), ROLE_POLL_INTERVAL);
    return () => clearInterval(id);
  }, [session, fetchRole]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      if (s?.user) {
        setLoading(true);
        // Defer to avoid Supabase client deadlock
        setTimeout(() => fetchRole(s.user.id).finally(() => setLoading(false)), 0);
      } else {
        setRole(null);
        setLoading(false);
      }
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) fetchRole(s.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <Ctx.Provider
      value={{
        session,
        user: session?.user ?? null,
        role,
        loading,
        signOut: doSignOut,
        refreshRole: async () => {
          if (session?.user) await fetchRole(session.user.id);
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
