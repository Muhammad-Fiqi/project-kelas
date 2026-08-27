// Data lisensi pengguna — disimpan di AsyncStorage.
// Saat ini menggunakan mock, nanti diganti data dari backend
// via /api/access-status/{device_id}.

import AsyncStorage from "@react-native-async-storage/async-storage";

const LICENSE_KEY = "muleh:license";

export type LicenseSource = "google_play" | "manual";

export type LicenseStatus = {
  /** Whether user has a valid license (purchased) */
  isLicensed: boolean;
  /** Source of the license */
  source: LicenseSource | null;
  /** Product ID that was purchased */
  productId: string | null;
  /** When the license was purchased (epoch ms) */
  purchasedAt: number | null;
  /** When the license is valid until (epoch ms), null = lifetime */
  validUntil: number | null;
  /** Google Play order ID */
  orderId: string | null;
};

let cached: LicenseStatus = {
  isLicensed: false,
  source: null,
  productId: null,
  purchasedAt: null,
  validUntil: null,
  orderId: null,
};

/** Inisialisasi lisensi dari AsyncStorage. */
export async function initLicense(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(LICENSE_KEY);
    if (raw) {
      cached = JSON.parse(raw) as LicenseStatus;
    }
  } catch {
    // ignore — gunakan default
  }
}

/** Simpan lisensi ke AsyncStorage dan cache. */
export async function saveLicense(data: LicenseStatus): Promise<void> {
  cached = data;
  try {
    await AsyncStorage.setItem(LICENSE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

/** Set lisensi aktif (stub untuk mock purchase flow). */
export async function activateLicense(
  source: LicenseSource = "google_play",
  productId: string = "muleh_full_license",
): Promise<void> {
  const now = Date.now();
  await saveLicense({
    isLicensed: true,
    source,
    productId,
    purchasedAt: now,
    validUntil: null, // lifetime
    orderId: null,
  });
}

/** Hapus lisensi (untuk testing/debug). */
export async function clearLicense(): Promise<void> {
  cached = {
    isLicensed: false,
    source: null,
    productId: null,
    purchasedAt: null,
    validUntil: null,
    orderId: null,
  };
  try {
    await AsyncStorage.removeItem(LICENSE_KEY);
  } catch {
    // ignore
  }
}

/** Ambil lisensi dari cache. */
export function getLicenseStatus(): LicenseStatus {
  return cached;
}
