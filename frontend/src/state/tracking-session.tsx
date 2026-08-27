import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { LiveTelemetry, simulateTelemetry } from "@/src/data/mock-route";
import { SavedRoute, mockSavedRoutes } from "@/src/data/mock-history";

export type TrackingSession = {
  id: string;
  startedAt: number; // epoch ms
};

type TrackingSessionContextValue = {
  session: TrackingSession | null;
  isTracking: boolean;
  elapsedSec: number;
  telemetry: LiveTelemetry;
  history: SavedRoute[];
  startSession: () => void;
  saveSession: (name: string) => void;
  discardSession: () => void;
};

const TrackingSessionContext = createContext<TrackingSessionContextValue | null>(null);

export function TrackingSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<TrackingSession | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [history, setHistory] = useState<SavedRoute[]>(mockSavedRoutes);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (session) {
      timerRef.current = setInterval(() => {
        setElapsedSec(Math.floor((Date.now() - session.startedAt) / 1000));
      }, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
    setElapsedSec(0);
    return undefined;
  }, [session]);

  const startSession = useCallback(() => {
    // Stub lokal — nanti diganti panggilan POST /api/sessions saat integrasi backend.
    setSession({ id: `local-${Date.now()}`, startedAt: Date.now() });
  }, []);

  const discardSession = useCallback(() => {
    setSession(null);
  }, []);

  const saveSession = useCallback((name: string) => {
    setSession((current) => {
      if (current) {
        const durationSec = Math.floor((Date.now() - current.startedAt) / 1000);
        const telemetry = simulateTelemetry(durationSec);
        const saved: SavedRoute = {
          id: current.id,
          name: name.trim() || "Rute tanpa nama",
          savedAt: Date.now(),
          durationSec,
          steps: telemetry.steps,
          turns: telemetry.turns,
          elevationM: telemetry.elevationM,
          floors: telemetry.floor,
        };
        setHistory((routes) => [saved, ...routes]);
      }
      return null;
    });
  }, []);

  const value = useMemo(
    () => ({
      session,
      isTracking: session !== null,
      elapsedSec,
      telemetry: simulateTelemetry(session ? elapsedSec : 0),
      history,
      startSession,
      saveSession,
      discardSession,
    }),
    [session, elapsedSec, history, startSession, saveSession, discardSession],
  );

  return <TrackingSessionContext.Provider value={value}>{children}</TrackingSessionContext.Provider>;
}

export function useTrackingSession() {
  const ctx = useContext(TrackingSessionContext);
  if (!ctx) throw new Error("useTrackingSession must be used within TrackingSessionProvider");
  return ctx;
}

export function formatDuration(totalSec: number) {
  const m = Math.floor(totalSec / 60).toString().padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
