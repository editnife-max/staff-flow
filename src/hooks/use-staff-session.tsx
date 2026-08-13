import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  startStaffSession,
  heartbeatSession,
  endStaffSession,
  recordActivityPing,
} from "@/lib/staff-sessions.functions";

const HEARTBEAT_INTERVAL = 60 * 1000;
const ACTIVITY_WINDOW_MS = 15 * 60 * 1000;

const ACTIVITY_EVENTS = [
  "mousemove",
  "keydown",
  "click",
  "scroll",
  "touchstart",
] as const;

function detectDeviceType(): "desktop" | "mobile" | "tablet" {
  if (typeof window === "undefined") return "desktop";
  const ua = navigator.userAgent;
  // Strong mobile UA signals
  if (/Mobi|Android.*Mobile|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return "mobile";
  // Tablet UA (iPad, Android tablet, Silk)
  if (/Android|iPad|Tablet|PlayBook|Silk/i.test(ua)) return "tablet";
  // Coarse pointer (touchscreen) on a small screen = mobile/tablet even if UA looks like desktop
  if (typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches && window.screen.width < 1280) return "tablet";
  return "desktop";
}

export function useStaffSession(isStaff: boolean): {
  isTracking: boolean;
  isCurrentlyActive: boolean;
} {
  const sessionIdRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityRef = useRef<number>(0);
  const [isTracking, setIsTracking] = useState(false);
  const [isCurrentlyActive, setIsCurrentlyActive] = useState(false);

  const doStart = useServerFn(startStaffSession);
  const doHeartbeat = useServerFn(heartbeatSession);
  const doEnd = useServerFn(endStaffSession);
  const doPing = useServerFn(recordActivityPing);

  useEffect(() => {
    if (!isStaff) return;
    if (detectDeviceType() !== "desktop") return; // attendance only on desktop

    const recordActivity = () => {
      lastActivityRef.current = Date.now();
    };
    ACTIVITY_EVENTS.forEach((e) =>
      window.addEventListener(e, recordActivity, { passive: true }),
    );

    let cancelled = false;

    const tick = () => {
      if (!sessionIdRef.current) return;
      const active = Date.now() - lastActivityRef.current <= ACTIVITY_WINDOW_MS;
      setIsCurrentlyActive(active);
      doHeartbeat({ data: { sessionId: sessionIdRef.current } }).catch(() => {});
      if (active) {
        doPing({ data: { sessionId: sessionIdRef.current } }).catch(() => {});
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) tick();
    };

    (async () => {
      try {
        const result = await doStart({
          data: {
            deviceType: detectDeviceType(),
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
          },
        });
        if (cancelled) {
          doEnd({ data: { sessionId: result.sessionId } }).catch(() => {});
          return;
        }
        sessionIdRef.current = result.sessionId;
        lastActivityRef.current = Date.now();
        setIsTracking(true);
        setIsCurrentlyActive(true);
        doPing({ data: { sessionId: result.sessionId } }).catch(() => {});
        intervalRef.current = setInterval(tick, HEARTBEAT_INTERVAL);
        document.addEventListener("visibilitychange", handleVisibilityChange);
      } catch {
        // silently ignore
      }
    })();

    return () => {
      cancelled = true;
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, recordActivity));
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (sessionIdRef.current) {
        doEnd({ data: { sessionId: sessionIdRef.current } }).catch(() => {});
        sessionIdRef.current = null;
      }
      setIsTracking(false);
      setIsCurrentlyActive(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStaff]);

  return { isTracking, isCurrentlyActive };
}
