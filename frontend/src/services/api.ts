// API service untuk komunikasi dengan backend MULEH.
// Semua call ke backend melalui modul ini agar konsisten.

import { Platform } from "react-native";

// Base URL backend — diambil dari env atau default.
// Di production, ganti dengan URL backend yang benar.
const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "http://localhost:8000";

/** Device ID unik per instalasi (disimpan di AsyncStorage). */
const DEVICE_ID_KEY = "muleh:device_id";

let cachedDeviceId: string | null = null;

/** Generate atau ambil device ID dari storage. */
export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  try {
    const { AsyncStorage } = await import("@react-native-async-storage/async-storage");
    const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (existing) {
      cachedDeviceId = existing;
      return existing;
    }
    // Generate baru (sederhana — di production gunakan library proper)
    const id = `dev_${Platform.OS}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
    cachedDeviceId = id;
    return id;
  } catch {
    return "unknown-device";
  }
}

/** Generic fetch wrapper dengan error handling. */
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body?.detail?.message || body?.detail || `API error ${res.status}`);
  }
  return res.json();
}

// ── Types dari backend ──

export type AccessStatusResponse = {
  device_id: string;
  access_allowed: boolean;
  access_source: "trial_active" | "trial_expired" | "licensed" | "none";
  trial: {
    device_id: string;
    status: string;
    installed_at: string | null;
    trial_started_at: string | null;
    trial_ends_at: string | null;
    days_remaining: number;
    hours_remaining: number;
    is_active: boolean;
    should_remind: boolean;
    reminder_message: string | null;
  } | null;
  license: {
    id: string;
    device_id: string;
    source: string;
    product_id: string;
    status: string;
    purchased_at: string | null;
    valid_from: string | null;
    valid_until: string | null;
    is_valid: boolean;
  } | null;
  show_paywall: boolean;
  show_reminder: boolean;
  reminder_message: string | null;
};

// ── API functions ──

/** Ensure trial exists for this device (auto-start on first use). */
export async function ensureTrial(deviceId: string): Promise<AccessStatusResponse["trial"]> {
  const data = await apiFetch<{ trial: AccessStatusResponse["trial"] }>("/api/trial/ensure", {
    method: "POST",
    body: JSON.stringify({ device_id: deviceId }),
  });
  return data.trial;
}

/** Get combined access status (trial + license). */
export async function getAccessStatus(deviceId: string): Promise<AccessStatusResponse> {
  return apiFetch<AccessStatusResponse>(`/api/access-status/${deviceId}`);
}

/** Get trial status. */
export async function getTrialStatusApi(deviceId: string): Promise<AccessStatusResponse["trial"]> {
  const data = await apiFetch<{ trial: AccessStatusResponse["trial"] }>(`/api/trial/status?device_id=${deviceId}`);
  return data.trial;
}

/** Verify Google Play purchase. */
export async function verifyPurchase(
  deviceId: string,
  purchaseToken: string,
): Promise<{ success: boolean; trial_status: string; license_id: string | null; message: string }> {
  return apiFetch("/api/trial/verify-purchase", {
    method: "POST",
    body: JSON.stringify({ device_id: deviceId, purchase_token: purchaseToken }),
  });
}

/** Register account. */
export async function registerAccount(email: string, password: string, deviceId?: string) {
  return apiFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, device_id: deviceId }),
  });
}

/** Login account. */
export async function loginAccount(email: string, password: string, deviceId?: string) {
  return apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, device_id: deviceId }),
  });
}
