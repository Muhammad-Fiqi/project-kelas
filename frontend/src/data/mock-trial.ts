// Mock status percobaan 3 hari — nanti diganti data asli dari backend.

export const TRIAL_DAYS = 3;
export const APP_PRICE_LABEL = "Rp 49.000";

// Trial tiruan: dimulai 22 jam yang lalu.
const mockTrialStartedAt = Date.now() - 22 * 60 * 60 * 1000;

export type TrialStatus = {
  isPurchased: boolean;
  isExpired: boolean;
  remainingMs: number;
  remainingLabel: string; // cth. "2 hari 2 jam"
};

export function getTrialStatus(now: number = Date.now()): TrialStatus {
  const endsAt = mockTrialStartedAt + TRIAL_DAYS * 24 * 60 * 60 * 1000;
  const remainingMs = Math.max(endsAt - now, 0);
  const totalHours = Math.floor(remainingMs / (60 * 60 * 1000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const remainingLabel = days > 0 ? `${days} hari ${hours} jam` : `${hours} jam`;
  return {
    isPurchased: false,
    isExpired: remainingMs <= 0,
    remainingMs,
    remainingLabel,
  };
}
