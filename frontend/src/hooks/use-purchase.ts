import { useCallback, useState } from "react";
import { verifyPurchase, getDeviceId } from "@/src/services/api";
import { activateLicense, clearLicense } from "@/src/data/mock-license";

export type PurchaseState =
  | { phase: "idle" }
  | { phase: "purchasing" }
  | { phase: "verifying" }
  | { phase: "success"; licenseId: string | null }
  | { phase: "error"; message: string };

/**
 * Hook untuk alur pembelian Google Play + verifikasi backend.
 *
 * Di production:
 *   1. `requestPurchase()` memanggil Google Play Billing Library
 *      untuk mendapatkan purchase token.
 *   2. Token dikirim ke backend via `verifyPurchase()`.
 *   3. Jika berhasil, license diaktifkan secara lokal.
 *
 * Saat ini menggunakan mock karena Google Play Billing
 * hanya tersedia di build release yang terhubung ke Play Console.
 */
export function usePurchase() {
  const [state, setState] = useState<PurchaseState>({ phase: "idle" });

  const requestPurchase = useCallback(async () => {
    setState({ phase: "purchasing" });

    try {
      const deviceId = await getDeviceId();

      // ── MOCK: Simulasi Google Play Billing ──
      // Di production, ganti blok ini dengan:
      //   const { purchaseToken } = await Purchases.purchaseProduct({
      //     skus: ["muleh_full_license"],
      //   });
      await new Promise((r) => setTimeout(r, 1500)); // simulasi dialog Play
      const mockPurchaseToken = `mock_token_${Date.now()}`;

      // ── Verifikasi ke backend ──
      setState({ phase: "verifying" });
      const result = await verifyPurchase(deviceId, mockPurchaseToken);

      if (result.success) {
        await activateLicense("google_play");
        setState({ phase: "success", licenseId: result.license_id });
      } else {
        setState({ phase: "error", message: result.message || "Verifikasi gagal" });
      }
    } catch (err: any) {
        setState({
          phase: "error",
          message: err?.message || "Pembelian gagal. Coba lagi.",
        });
      }
    }, []);

  const reset = useCallback(() => {
    setState({ phase: "idle" });
  }, []);

  const restorePurchase = useCallback(async () => {
    setState({ phase: "verifying" });
    try {
      const deviceId = await getDeviceId();
      // Di production, gunakan Purchases.getPurchaseHistoryAsync()
      // untuk mendapatkan token, lalu verifikasi ke backend.
      // Saat ini mock:
      await new Promise((r) => setTimeout(r, 1000));
      setState({ phase: "idle" }); // TODO: implement proper restore
    } catch (err: any) {
      setState({
        phase: "error",
        message: err?.message || "Gagal memulihkan pembelian.",
      });
    }
  }, []);

  return {
    ...state,
    isProcessing: state.phase === "purchasing" || state.phase === "verifying",
    isSuccess: state.phase === "success",
    isError: state.phase === "error",
    errorMessage: state.phase === "error" ? state.message : null,
    requestPurchase,
    restorePurchase,
    reset,
  };
}
