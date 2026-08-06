import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { startStaffSession, heartbeatSession, endStaffSession } from "@/lib/staff-sessions.functions";

const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 5 minutes

function detectDeviceType(): "desktop" | "mobile" | "tablet" {
  if (typeof window === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/Mobi|Android|iPhone|iPod/.test(ua)) return "mobile";
  if (/iPad|Tablet/.test(ua)) return "tablet";
  return "desktop";
}

function isDesktop(): boolean {
  if (typeof window === "undefined") return false;
  const deviceType = detectDeviceType();
  return deviceType === "desktop" && window.innerWidth >= 1024;
}

export function useStaffSession(isStaff: boolean): { isTracking: boolean } {
  const sessionIdRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  const doStart = useServerFn(startStaffSession);
  const doHeartbeat = useServerFn(heartbeatSession);
  const doEnd = useServerFn(endStaffSession);

  useEffect(() => {
    if (!isStaff || !isDesktop()) return;

    let cancelled = false;

    (async () => {
      try {
        const result = await doStart({
          data: {
            deviceType: detectDeviceType(),
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
          },
        });
        if (cancelled) {
          // Component unmounted before start resolved — end immediately
          doEnd({ data: { sessionId: result.sessionId } }).catch(() => {});
          return;
        }
        sessionIdRef.current = result.sessionId;
        setIsTracking(true);

        intervalRef.current = setInterval(() => {
          if (sessionIdRef.current) {
            doHeartbeat({ data: { sessionId: sessionIdRef.current } }).catch(() => {});
          }
        }, HEARTBEAT_INTERVAL);
      } catch {
        // Silently ignore start failures (e.g. not yet fully authenticated)
      }
    })();

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (sessionIdRef.current) {
        doEnd({ data: { sessionId: sessionIdRef.current } }).catch(() => {});
        sessionIdRef.current = null;
      }
      setIsTracking(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStaff]);

  return { isTracking };
}
