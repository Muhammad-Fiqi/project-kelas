import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { APP_PRICE_LABEL, TRIAL_DAYS } from "@/src/data/mock-trial";
import { useTrial } from "@/src/state/trial-context";

const features: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; body: string }[] = [
  { icon: "augmented-reality", title: "3 Mode Tampilan AR", body: "Rute titik, rute panah, dan pin titik awal." },
  { icon: "radar", title: "Tracking Offline", body: "Rekam rute tanpa internet, berbasis sensor IMU." },
  { icon: "escalator-up", title: "Penanda Lantai", body: "Deteksi naik-turun lantai di mall atau gedung." },
  { icon: "navigation-variant", title: "Bantuan Arah", body: "Panah asisten mengarahkan kameramu pulang." },
];

export default function Trial() {
  const insets = useSafeAreaInsets();
  const { trial, purchase } = useTrial();
  const [purchasing, setPurchasing] = useState(false);
  const [success, setSuccess] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Animasi sukses muncul.
  const showSuccess = useCallback(() => {
    setSuccess(true);
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    // Otomatis kembali ke home setelah 2 detik.
    setTimeout(() => router.replace("/"), 2000);
  }, [fadeAnim]);

  // Mock alur pembelian: loading 1.5 detik → purchase → tampilkan sukses.
  const handleBuy = useCallback(async () => {
    if (purchasing) return;
    setPurchasing(true);
    // Simulasi proses pembayaran (nanti diganti Google Play Billing).
    await new Promise((r) => setTimeout(r, 1500));
    await purchase();
    setPurchasing(false);
    showSuccess();
  }, [purchasing, purchase, showSuccess]);

  // Overlay sukses.
  if (success) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#10161A", "#0D1114", "#121417"]} style={StyleSheet.absoluteFill} />
        <Animated.View style={[styles.successOverlay, { opacity: fadeAnim }]}>
          <View style={styles.successIconWrap}>
            <MaterialCommunityIcons name="check-circle" size={64} color="#34A853" />
          </View>
          <Text style={styles.successTitle}>PEMBELIAN BERHASIL</Text>
          <Text style={styles.successBody}>MULEH sudah aktif. Semua fitur terbuka.</Text>
        </Animated.View>
      </View>
    );
  }

  // Jika sudah beli — tampilkan halaman terima kasih / status aktif.
  if (trial.isPurchased) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#10161A", "#0D1114", "#121417"]} style={StyleSheet.absoluteFill} />

        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Pressable
            testID="trial-back-button"
            accessibilityRole="button"
            accessibilityLabel="Kembali"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color="#F0F2F5" />
          </Pressable>
          <Text style={styles.headerTitle}>STATUS AKTIF</Text>
          <View style={styles.iconSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}
          showsVerticalScrollIndicator={false}
        >
          <View testID="purchased-card" style={styles.purchasedCard}>
            <View style={styles.purchasedIconWrap}>
              <MaterialCommunityIcons name="shield-check" size={40} color="#34A853" />
            </View>
            <Text style={styles.purchasedTitle}>MULEH AKTIF</Text>
            <Text style={styles.purchasedBody}>
              Kamu sudah memiliki akses penuh ke semua fitur navigasi AR MULEH. Tidak ada batasan waktu — navigasi offline selamanya.
            </Text>
            {trial.startedAt && (
              <View style={styles.licenseInfo}>
                <View style={styles.licenseRow}>
                  <Text style={styles.licenseLabel}>MULAI TRIAL</Text>
                  <Text style={styles.licenseValue}>{new Date(trial.startedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</Text>
                </View>
                {trial.endsAt && (
                  <View style={styles.licenseRow}>
                    <Text style={styles.licenseLabel}>AKHIR TRIAL</Text>
                    <Text style={styles.licenseValue}>{new Date(trial.endsAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</Text>
                  </View>
                )}
                <View style={styles.licenseRow}>
                  <Text style={styles.licenseLabel}>STATUS</Text>
                  <Text style={[styles.licenseValue, styles.licenseValueActive]}>LISENSI PREMIUM</Text>
                </View>
              </View>
            )}
          </View>

          <Text style={styles.sectionTitle}>FITUR AKTIF</Text>
          {features.map((feature) => (
            <View key={feature.title} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <MaterialCommunityIcons name={feature.icon} size={20} color="#34A853" />
              </View>
              <View style={styles.featureTextWrap}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureBody}>{feature.body}</Text>
              </View>
              <MaterialCommunityIcons name="check-circle" size={18} color="#34A853" />
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  // State: trial aktif atau berakhir.
  return (
    <View style={styles.container}>
      <LinearGradient colors={["#10161A", "#0D1114", "#121417"]} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          testID="trial-back-button"
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color="#F0F2F5" />
        </Pressable>
        <Text style={styles.headerTitle}>MASA PERCOBAAN</Text>
        <View style={styles.iconSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <View testID="trial-status-card" style={[styles.trialCard, trial.isExpired && styles.trialCardExpired]}>
          <View style={styles.trialBadge}>
            <MaterialCommunityIcons name={trial.isExpired ? "lock" : "timer-sand"} size={15} color={trial.isExpired ? "#EA4335" : "#FF9E40"} />
            <Text style={[styles.trialBadgeText, trial.isExpired && styles.trialBadgeTextExpired]}>
              {trial.isExpired ? "TRIAL BERAKHIR" : `TRIAL ${TRIAL_DAYS} HARI`}
            </Text>
          </View>
          <Text style={styles.trialTitle}>
            {trial.isExpired ? "Masa percobaanmu habis" : `Sisa ${trial.remainingLabel}`}
          </Text>
          <Text style={styles.trialBody}>
            {trial.isExpired
              ? "Semua fitur navigasi terkunci. Beli MULEH untuk membuka kembali seluruh fitur."
              : "Nikmati semua fitur MULEH gratis. Setelah masa percobaan berakhir, fitur akan terkunci otomatis sampai kamu membeli aplikasi."}
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${trial.progress * 100}%` }, trial.isExpired && styles.progressFillExpired]} />
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.progressLabel}>MULAI</Text>
            <Text style={styles.progressLabel}>HARI KE-{TRIAL_DAYS}</Text>
          </View>
          {trial.startedAt && (
            <View style={styles.licenseInfo}>
              <View style={styles.licenseRow}>
                <Text style={styles.licenseLabel}>MULAI TRIAL</Text>
                <Text style={styles.licenseValue}>{new Date(trial.startedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</Text>
              </View>
              {trial.endsAt && (
                <View style={styles.licenseRow}>
                  <Text style={styles.licenseLabel}>BERAKHIR</Text>
                  <Text style={styles.licenseValue}>{new Date(trial.endsAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</Text>
                </View>
              )}
              <View style={styles.licenseRow}>
                <Text style={styles.licenseLabel}>STATUS</Text>
                <Text style={[styles.licenseValue, trial.isExpired && styles.licenseValueExpired]}>{trial.isExpired ? "EXPIRED" : "TRIAL AKTIF"}</Text>
              </View>
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>YANG KAMU DAPATKAN</Text>
        {features.map((feature) => (
          <View key={feature.title} style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <MaterialCommunityIcons name={feature.icon} size={20} color="#FF9E40" />
            </View>
            <View style={styles.featureTextWrap}>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureBody}>{feature.body}</Text>
            </View>
            <MaterialCommunityIcons name="check-circle" size={18} color="#34A853" />
          </View>
        ))}

        <View testID="price-card" style={styles.priceCard}>
          <View>
            <Text style={styles.priceEyebrow}>BELI SEKALI · MILIK SELAMANYA</Text>
            <Text style={styles.priceValue}>{APP_PRICE_LABEL}</Text>
          </View>
          <MaterialCommunityIcons name="shield-check" size={30} color="#FF6B00" />
        </View>

        <Pressable
          testID="buy-button"
          accessibilityRole="button"
          accessibilityLabel="Beli lewat Google Play"
          onPress={handleBuy}
          disabled={purchasing}
          style={({ pressed }) => [styles.buyButton, purchasing && styles.buyButtonDisabled, pressed && !purchasing && styles.pressed]}
        >
          {purchasing ? (
            <ActivityIndicator size="small" color="#121417" />
          ) : (
            <MaterialCommunityIcons name="google-play" size={20} color="#121417" />
          )}
          <Text style={styles.buyText}>
            {purchasing ? "MEMPROSES PEMBAYARAN..." : "BELI LEWAT GOOGLE PLAY"}
          </Text>
        </Pressable>
        <Text style={styles.legalNote}>
          Pembayaran diproses lewat Google Play Billing, sama seperti pembelian aplikasi Play Store pada umumnya.
        </Text>
        <Pressable
          testID="restore-button"
          accessibilityRole="button"
          accessibilityLabel="Pulihkan pembelian"
          onPress={handleBuy}
          style={({ pressed }) => [styles.restoreButton, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="restore" size={16} color="#9AA0A6" />
          <Text style={styles.restoreText}>Pulihkan Pembayaran</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121417" },
  header: { paddingHorizontal: 18, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { color: "#F0F2F5", fontSize: 14, fontWeight: "900", letterSpacing: 2 },
  iconButton: { width: 46, height: 46, borderRadius: 12, backgroundColor: "#1A1D24", borderWidth: 1, borderColor: "#2D323B", alignItems: "center", justifyContent: "center" },
  iconSpacer: { width: 46 },
  content: { paddingHorizontal: 18, paddingTop: 8, gap: 12 },

  // ── Purchased state ──
  purchasedCard: { backgroundColor: "#1A1D24", borderRadius: 20, borderWidth: 1, borderColor: "#34A853", padding: 28, alignItems: "center" },
  purchasedIconWrap: { width: 72, height: 72, borderRadius: 20, backgroundColor: "rgba(52,168,83,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  purchasedTitle: { color: "#34A853", fontSize: 22, fontWeight: "900", letterSpacing: 1.5 },
  purchasedBody: { color: "#9AA0A6", fontSize: 13, lineHeight: 20, textAlign: "center", marginTop: 8 },
  licenseInfo: { backgroundColor: "#252932", borderRadius: 14, padding: 14, marginTop: 16, alignSelf: "stretch", gap: 10 },
  licenseRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  licenseLabel: { color: "#9AA0A6", fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  licenseValue: { color: "#F0F2F5", fontSize: 12, fontWeight: "700" },
  licenseValueActive: { color: "#34A853" },
  licenseValueExpired: { color: "#EA4335" },

  // ── Trial state ──
  trialCard: { backgroundColor: "#1A1D24", borderRadius: 20, borderWidth: 1, borderColor: "#FF6B00", padding: 18 },
  trialCardExpired: { borderColor: "#EA4335" },
  trialBadge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: "#252932", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  trialBadgeText: { color: "#FF9E40", fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  trialBadgeTextExpired: { color: "#EA4335" },
  trialTitle: { color: "#F0F2F5", fontSize: 24, fontWeight: "900", marginTop: 12 },
  trialBody: { color: "#9AA0A6", fontSize: 13, lineHeight: 19, marginTop: 6 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: "#252932", marginTop: 16, overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: "#FF6B00" },
  progressFillExpired: { backgroundColor: "#EA4335" },
  progressLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  progressLabel: { color: "#9AA0A6", fontSize: 9, fontWeight: "700", letterSpacing: 1 },

  // ── Purchase success overlay ──
  successOverlay: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  successIconWrap: { width: 100, height: 100, borderRadius: 30, backgroundColor: "rgba(52,168,83,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  successTitle: { color: "#34A853", fontSize: 22, fontWeight: "900", letterSpacing: 1.5 },
  successBody: { color: "#9AA0A6", fontSize: 14, textAlign: "center", marginTop: 8 },

  // ── Shared ──
  sectionTitle: { color: "#F0F2F5", fontSize: 12, fontWeight: "900", letterSpacing: 1.6, marginTop: 8 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#1A1D24", borderRadius: 16, borderWidth: 1, borderColor: "#2D323B", padding: 14 },
  featureIcon: { width: 40, height: 40, borderRadius: 11, backgroundColor: "rgba(255,107,0,0.15)", alignItems: "center", justifyContent: "center" },
  featureTextWrap: { flex: 1 },
  featureTitle: { color: "#F0F2F5", fontSize: 14, fontWeight: "800" },
  featureBody: { color: "#9AA0A6", fontSize: 11, marginTop: 2 },
  priceCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(255,107,0,0.10)", borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,107,0,0.4)", padding: 18, marginTop: 8 },
  priceEyebrow: { color: "#FF9E40", fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  priceValue: { color: "#F0F2F5", fontSize: 26, fontWeight: "900", marginTop: 4 },
  buyButton: { minHeight: 56, borderRadius: 14, backgroundColor: "#FF6B00", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  buyButtonDisabled: { opacity: 0.6 },
  buyText: { color: "#121417", fontSize: 14, fontWeight: "900", letterSpacing: 1.1 },
  legalNote: { color: "#9AA0A6", fontSize: 10, textAlign: "center", lineHeight: 15 },
  restoreButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 40, marginTop: 4 },
  restoreText: { color: "#9AA0A6", fontSize: 11, fontWeight: "700" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
