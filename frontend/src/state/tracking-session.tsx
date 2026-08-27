import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { LiveTelemetry, simulateTelemetry } from "@/src/data/mock-route";
import { SavedRoute, mockSavedRoutes } from "@/src/data/mock-history";

const HISTORY_KEY = "muleh:saved_routes";

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
  deleteRoute: (id: string) => void;
};

const TrackingSessionContext = createContext<TrackingSessionContextValue | null>(null);

/** Baca riwayat dari AsyncStorage, fallback ke mock jika belum ada. */
async function loadHistory(): Promise<SavedRoute[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (raw) {
      const parsed: SavedRoute[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // Abaikan error baca — pakai fallback.
  }
  // Simpan mock awal sekali saja supaya list tidak kosong di first run.
  try { await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(mockSavedRoutes)); } catch { /* ignore */ }
  return mockSavedRoutes;
}

/** Tulis riwayat ke AsyncStorage. */
async function persistHistory(routes: SavedRoute[]): Promise<void> {
  try {
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(routes));
  } catch {
    // Jika storage penuh atau error, abaikan — data tetap di state.
  }
}

export function TrackingSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<TrackingSession | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [history, setHistory] = useState<SavedRoute[]>(mockSavedRoutes);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load riwayat dari AsyncStorage saat pertama kali mount.
  useEffect(() => {
    let cancelled = false;
    loadHistory().then((routes) => {
      if (!cancelled) {
        setHistory(routes);
        setHistoryLoaded(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Timer durasi sesi.
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
        setHistory((prev) => {
          const next = [saved, ...prev];
          // Persist ke AsyncStorage secara asynchronous.
          persistHistory(next);
          return next;
        });
      }
      return null;
    });
  }, []);

  const deleteRoute = useCallback((id: string) => {
    setHistory((prev) => {
      const next = prev.filter((r) => r.id !== id);
      persistHistory(next);
      return next;
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
      deleteRoute,
    }),
    [session, elapsedSec, history, startSession, saveSession, discardSession, deleteRoute],
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
