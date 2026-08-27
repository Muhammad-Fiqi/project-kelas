// Status percobaan 3 hari — nanti diganti data asli dari backend.
// Saat ini persisten via AsyncStorage supaya trial terus berjalan antar sesi app.

import AsyncStorage from "@react-native-async-storage/async-storage";

export const TRIAL_DAYS = 3;
export const APP_PRICE_LABEL = "Rp 49.000";

const TRIAL_START_KEY = "muleh:trial_started_at";
const PURCHASED_KEY = "muleh:purchased";

/** Milis pertama kali user membuka app (disimpan sekali saja). */
let cachedTrialStartedAt: number | null = null;
let cachedPurchased: boolean | null = null;

/** Baca tanggal mulai trial dari AsyncStorage, buat baru jika belum ada. */
export async function initTrial(): Promise<void> {
  try {
    const rawStart = await AsyncStorage.getItem(TRIAL_START_KEY);
    const rawPurchased = await AsyncStorage.getItem(PURCHASED_KEY);
    if (rawStart) {
      cachedTrialStartedAt = Number(rawStart);
    } else {
      // Pertama kali buka app — catat epoch ms sekarang.
      const now = Date.now();
      await AsyncStorage.setItem(TRIAL_START_KEY, String(now));
      cachedTrialStartedAt = now;
    }
    cachedPurchased = rawPurchased === "1";
  } catch {
    // Jika AsyncStorage gagal, fallback ke in-memory.
    if (cachedTrialStartedAt === null) {
      cachedTrialStartedAt = Date.now() - 22 * 60 * 60 * 1000; // fallback mock
    }
  }
}

/** Set status pembelian (stub — nanti diganti dari backend). */
export async function setPurchased(value: boolean): Promise<void> {
  cachedPurchased = value;
  try {
    await AsyncStorage.setItem(PURCHASED_KEY, value ? "1" : "0");
  } catch {
    // ignore
  }
}

export type TrialStatus = {
  isPurchased: boolean;
  isExpired: boolean;
  remainingMs: number;
  remainingLabel: string; // cth. "2 hari 2 jam 15 menit"
  startedAt: number | null; // epoch ms, null jika belum init
  endsAt: number | null;  // epoch ms
  progress: number; // 0–1, persentase trial yang sudah berlalu
};

/** Format sisa waktu trial menjadi label yang mudah dibaca. */
function formatRemaining(ms: number): string {
  if (ms <= 0) return "0 menit";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} hari`);
  if (hours > 0) parts.push(`${hours} jam`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes} menit`);
  return parts.slice(0, 2).join(" "); // Maks 2 unit terbesar
}

/**
 * Mendapatkan status trial saat ini.
 * Panggil initTrial() terlebih dahulu untuk data yang persisten.
 * Jika belum init, gunakan fallback mock.
 */
export function getTrialStatus(now: number = Date.now()): TrialStatus {
  const startedAt = cachedTrialStartedAt ?? (Date.now() - 22 * 60 * 60 * 1000);
  const endsAt = startedAt + TRIAL_DAYS * 24 * 60 * 60 * 1000;
  const remainingMs = Math.max(endsAt - now, 0);
  const progress = Math.min(Math.max(1 - remainingMs / (TRIAL_DAYS * 24 * 60 * 60 * 1000), 0), 1);
  const isExpired = remainingMs <= 0;

  return {
    isPurchased: cachedPurchased ?? false,
    isExpired,
    remainingMs,
    remainingLabel: formatRemaining(remainingMs),
    startedAt,
    endsAt,
    progress,
  };
}
