import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { TrialStatus, getTrialStatus, initTrial, setPurchased } from "@/src/data/mock-trial";

const REFRESH_INTERVAL_MS = 60_000; // refresh tiap 1 menit (normal)
const URGENT_REFRESH_MS = 10_000; // refresh tiap 10 detik saat < 1 jam
const URGENT_THRESHOLD_MS = 60 * 60 * 1000; // 1 jam

type TrialContextValue = {
  trial: TrialStatus;
  isReady: boolean;
  refresh: () => void;
  purchase: () => Promise<void>;
};

const TrialContext = createContext<TrialContextValue | null>(null);

export function TrialProvider({ children }: { children: React.ReactNode }) {
  const [trial, setTrial] = useState<TrialStatus>(getTrialStatus());
  const [isReady, setIsReady] = useState(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  // Inisialisasi trial dari AsyncStorage saat mount.
  useEffect(() => {
    let cancelled = false;
    initTrial().then(() => {
      if (!cancelled) {
        setTrial(getTrialStatus());
        setIsReady(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Refresh status trial secara berkala.
  // Saat sisa < 1 jam, refresh lebih agresif (setiap 10 detik)
  // agar UI berubah tepat waktu saat trial habis.
  useEffect(() => {
    if (!isReady) return;
    const tick = () => setTrial(getTrialStatus());
    const id = setInterval(tick, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isReady]);

  // Urgent refresh saat mendekati expiry.
  useEffect(() => {
    if (!isReady || trial.isPurchased || trial.isExpired) return;
    if (trial.remainingMs > URGENT_THRESHOLD_MS) return;
    const id = setInterval(() => setTrial(getTrialStatus()), URGENT_REFRESH_MS);
    return () => clearInterval(id);
  }, [isReady, trial.isPurchased, trial.isExpired, trial.remainingMs]);

  // Refresh saat app kembali dari background.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (appState.current.match(/background|inactive/) && next === "active") {
        setTrial(getTrialStatus());
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  const refresh = useCallback(() => {
    setTrial(getTrialStatus());
  }, []);

  const purchase = useCallback(async () => {
    await setPurchased(true);
    setTrial(getTrialStatus());
  }, []);

  const value: TrialContextValue = { trial, isReady, refresh, purchase };

  return <TrialContext.Provider value={value}>{children}</TrialContext.Provider>;
}

export function useTrial(): TrialContextValue {
  const ctx = useContext(TrialContext);
  if (!ctx) throw new Error("useTrial must be used within TrialProvider");
  return ctx;
}
