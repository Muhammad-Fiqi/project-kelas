import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useRef } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { formatDuration, useTrackingSession } from "@/src/state/tracking-session";
import { getTrialStatus } from "@/src/data/mock-trial";
import { formatSavedAt } from "@/src/data/mock-history";

export default function Home() {
  const insets = useSafeAreaInsets();
  const { isTracking, elapsedSec, telemetry, history, startSession, stopSession } = useTrackingSession();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isTracking) {
      pulse.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.25, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isTracking, pulse]);

  const handleStart = () => {
    startSession();
    router.push("/recording");
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#10161A", "#0D1114", "#121417"]} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <MaterialCommunityIcons name="navigation" size={18} color="#121417" />
          </View>
          <View>
            <Text style={styles.brand}>MULEH</Text>
            <Text style={styles.brandSub}>OFFLINE AR RETURN NAVIGATION</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pengaturan"
          testID="settings-button"
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="cog-outline" size={22} color="#F0F2F5" />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          testID="trial-banner"
          accessibilityRole="button"
          accessibilityLabel="Lihat masa percobaan"
          onPress={() => router.push("/trial")}
          style={({ pressed }) => [styles.trialBanner, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="timer-sand" size={16} color="#FF9E40" />
          <Text style={styles.trialBannerText}>
            TRIAL · SISA {getTrialStatus().remainingLabel.toUpperCase()}
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color="#FF9E40" />
        </Pressable>
        <View testID="session-status-card" style={[styles.statusCard, isTracking && styles.statusCardActive]}>
          <View style={styles.statusHeader}>
            <Text style={styles.eyebrow}>STATUS SESI</Text>
            <View style={[styles.statusBadge, isTracking && styles.statusBadgeActive]}>
              <Animated.View style={[styles.statusDot, isTracking && styles.statusDotActive, { opacity: pulse }]} />
              <Text style={[styles.statusBadgeText, isTracking && styles.statusBadgeTextActive]}>
                {isTracking ? "MEREKAM" : "STANDBY"}
              </Text>
            </View>
          </View>
          {isTracking ? (
            <Pressable
              testID="active-session-indicator"
              accessibilityRole="button"
              accessibilityLabel="Buka mode perekaman"
              onPress={() => router.push("/recording")}
            >
              <View style={styles.activeRow}>
                <View style={styles.activeTextWrap}>
                  <Text style={styles.statusTitle}>Sesi sedang berjalan</Text>
                  <Text style={styles.statusBody}>Jejak rutemu sedang direkam di latar belakang.</Text>
                </View>
                <View style={styles.timerWrap}>
                  <Text testID="session-duration" style={styles.timerValue}>{formatDuration(elapsedSec)}</Text>
                  <Text style={styles.timerLabel}>DURASI</Text>
                </View>
              </View>
              <View testID="session-telemetry" style={styles.telemetryRow}>
                <View style={styles.telemetryItem}>
                  <MaterialCommunityIcons name="shoe-print" size={16} color="#FF9E40" />
                  <Text style={styles.telemetryValue}>{telemetry.steps}</Text>
                  <Text style={styles.telemetryLabel}>LANGKAH</Text>
                </View>
                <View style={styles.telemetryDivider} />
                <View style={styles.telemetryItem}>
                  <MaterialCommunityIcons name="directions-fork" size={16} color="#FF9E40" />
                  <Text style={styles.telemetryValue}>{telemetry.turns}</Text>
                  <Text style={styles.telemetryLabel}>BELOKAN</Text>
                </View>
                <View style={styles.telemetryDivider} />
                <View style={styles.telemetryItem}>
                  <MaterialCommunityIcons name="elevation-rise" size={16} color="#FF9E40" />
                  <Text style={styles.telemetryValue}>{telemetry.elevationM > 0 ? `+${telemetry.elevationM}` : telemetry.elevationM} m</Text>
                  <Text style={styles.telemetryLabel}>KETINGGIAN</Text>
                </View>
              </View>
            </Pressable>
          ) : (
            <View>
              <Text style={styles.statusTitle}>Belum ada sesi aktif</Text>
              <Text style={styles.statusBody}>
                Set lokasi awal untuk mulai merekam rutemu. Aplikasi akan menyusun jejak pulang secara offline.
              </Text>
            </View>
          )}
        </View>

        <Pressable
          testID="start-tracking-button"
          accessibilityRole="button"
          accessibilityLabel={isTracking ? "Hentikan tracking" : "Mulai tracking"}
          onPress={isTracking ? stopSession : handleStart}
          style={({ pressed }) => [styles.primaryButton, isTracking && styles.stopButton, pressed && styles.pressed]}
        >
          <View style={[styles.primaryIconWrap, isTracking && styles.stopIconWrap]}>
            <MaterialCommunityIcons name={isTracking ? "stop" : "map-marker-plus"} size={26} color={isTracking ? "#F0F2F5" : "#121417"} />
          </View>
          <View style={styles.primaryTextWrap}>
            <Text style={[styles.primaryTitle, isTracking && styles.stopTitle]}>
              {isTracking ? "HENTIKAN TRACKING" : "MULAI TRACKING"}
            </Text>
            <Text style={[styles.primarySub, isTracking && styles.stopSub]}>
              {isTracking ? "Akhiri sesi & simpan rute" : "Set titik awal & rekam rute"}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={26} color={isTracking ? "rgba(240,242,245,0.6)" : "rgba(18,20,23,0.65)"} />
        </Pressable>

        <Pressable
          testID="open-ar-view-button"
          accessibilityRole="button"
          accessibilityLabel="Buka tampilan AR"
          onPress={() => router.push("/ar-view")}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
        >
          <View style={styles.secondaryIconWrap}>
            <MaterialCommunityIcons name="augmented-reality" size={24} color="#FF9E40" />
          </View>
          <View style={styles.primaryTextWrap}>
            <Text style={styles.secondaryTitle}>BUKA TAMPILAN AR</Text>
            <Text style={styles.secondarySub}>Lihat rute pulang lewat kamera</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#9AA0A6" />
        </Pressable>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>RIWAYAT RUTE</Text>
          <Text style={styles.sectionMeta}>{history.length} SESI</Text>
        </View>
        {history.length === 0 ? (
          <View testID="history-empty-state" style={styles.emptyCard}>
            <MaterialCommunityIcons name="map-clock-outline" size={30} color="#9AA0A6" />
            <Text style={styles.emptyTitle}>Belum ada riwayat</Text>
            <Text style={styles.emptyBody}>Rute yang kamu rekam akan muncul di sini.</Text>
          </View>
        ) : (
          history.map((route) => (
            <Pressable
              key={route.id}
              testID={`history-item-${route.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Riwayat rute ${route.name}`}
              style={({ pressed }) => [styles.historyCard, pressed && styles.pressed]}
            >
              <View style={styles.historyIcon}>
                <MaterialCommunityIcons name="map-marker-path" size={20} color="#FF9E40" />
              </View>
              <View style={styles.historyTextWrap}>
                <Text style={styles.historyName} numberOfLines={1}>{route.name}</Text>
                <Text style={styles.historyMeta}>
                  {formatSavedAt(route.savedAt)} · {route.steps} langkah · {formatDuration(route.durationSec)}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color="#9AA0A6" />
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121417" },
  header: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  brandMark: { width: 38, height: 38, borderRadius: 10, backgroundColor: "#FF6B00", alignItems: "center", justifyContent: "center" },
  brand: { color: "#F0F2F5", fontWeight: "900", fontSize: 20, letterSpacing: 2.4 },
  brandSub: { color: "#9AA0A6", fontSize: 9, letterSpacing: 1.3, fontWeight: "700", marginTop: 2 },
  iconButton: { width: 46, height: 46, borderRadius: 12, backgroundColor: "#1A1D24", borderWidth: 1, borderColor: "#2D323B", alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 6, gap: 14 },
  trialBanner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,107,0,0.4)", backgroundColor: "rgba(255,107,0,0.10)", paddingHorizontal: 14 },
  trialBannerText: { flex: 1, color: "#FF9E40", fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  statusCard: { backgroundColor: "#1A1D24", borderRadius: 20, borderWidth: 1, borderColor: "#2D323B", padding: 18 },
  statusCardActive: { borderColor: "#FF6B00" },
  statusHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  eyebrow: { color: "#FF6B00", fontSize: 10, fontWeight: "800", letterSpacing: 1.4 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#252932", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  statusBadgeActive: { backgroundColor: "rgba(234,67,53,0.18)" },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#9AA0A6" },
  statusDotActive: { backgroundColor: "#EA4335" },
  statusBadgeText: { color: "#BDC1C6", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  statusBadgeTextActive: { color: "#EA4335" },
  activeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  activeTextWrap: { flex: 1 },
  timerWrap: { alignItems: "flex-end" },
  timerValue: { color: "#FF9E40", fontSize: 26, fontWeight: "900", fontVariant: ["tabular-nums"] },
  timerLabel: { color: "#9AA0A6", fontSize: 9, fontWeight: "700", letterSpacing: 1.2, marginTop: 2 },
  telemetryRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#252932", borderRadius: 14, paddingVertical: 12, marginTop: 14 },
  telemetryItem: { flex: 1, alignItems: "center", gap: 3 },
  telemetryDivider: { width: 1, height: 32, backgroundColor: "#2D323B" },
  telemetryValue: { color: "#F0F2F5", fontSize: 15, fontWeight: "800", fontVariant: ["tabular-nums"] },
  telemetryLabel: { color: "#9AA0A6", fontSize: 8, fontWeight: "700", letterSpacing: 1 },
  statusTitle: { color: "#F0F2F5", fontSize: 19, fontWeight: "800" },
  statusBody: { color: "#9AA0A6", fontSize: 13, lineHeight: 19, marginTop: 6 },
  primaryButton: { minHeight: 76, borderRadius: 20, backgroundColor: "#FF6B00", flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 13 },
  stopButton: { backgroundColor: "#1A1D24", borderWidth: 1, borderColor: "#EA4335" },
  stopIconWrap: { backgroundColor: "rgba(234,67,53,0.22)" },
  stopTitle: { color: "#F0F2F5" },
  stopSub: { color: "#9AA0A6" },
  primaryIconWrap: { width: 46, height: 46, borderRadius: 13, backgroundColor: "rgba(18,20,23,0.14)", alignItems: "center", justifyContent: "center" },
  primaryTextWrap: { flex: 1 },
  primaryTitle: { color: "#121417", fontSize: 16, fontWeight: "900", letterSpacing: 1.1 },
  primarySub: { color: "rgba(18,20,23,0.72)", fontSize: 12, fontWeight: "600", marginTop: 2 },
  secondaryButton: { minHeight: 68, borderRadius: 20, backgroundColor: "#1A1D24", borderWidth: 1, borderColor: "#2D323B", flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 13 },
  secondaryIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(255,107,0,0.15)", alignItems: "center", justifyContent: "center" },
  secondaryTitle: { color: "#F0F2F5", fontSize: 14, fontWeight: "800", letterSpacing: 1 },
  secondarySub: { color: "#9AA0A6", fontSize: 12, marginTop: 2 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  sectionTitle: { color: "#F0F2F5", fontSize: 13, fontWeight: "900", letterSpacing: 1.6 },
  sectionMeta: { color: "#9AA0A6", fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  emptyCard: { backgroundColor: "#1A1D24", borderRadius: 20, borderWidth: 1, borderColor: "#2D323B", borderStyle: "dashed", alignItems: "center", paddingVertical: 28, paddingHorizontal: 20, gap: 6 },
  historyCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#1A1D24", borderRadius: 16, borderWidth: 1, borderColor: "#2D323B", padding: 14, minHeight: 64 },
  historyIcon: { width: 40, height: 40, borderRadius: 11, backgroundColor: "rgba(255,107,0,0.13)", alignItems: "center", justifyContent: "center" },
  historyTextWrap: { flex: 1 },
  historyName: { color: "#F0F2F5", fontSize: 14, fontWeight: "800" },
  historyMeta: { color: "#9AA0A6", fontSize: 11, marginTop: 3 },
  emptyTitle: { color: "#F0F2F5", fontSize: 14, fontWeight: "800", marginTop: 4 },
  emptyBody: { color: "#9AA0A6", fontSize: 12, textAlign: "center" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
