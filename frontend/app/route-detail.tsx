import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Alert } from "react-native";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { formatDuration, useTrackingSession } from "@/src/state/tracking-session";
import { useTrial } from "@/src/state/trial-context";
import { FeatureLockOverlay } from "@/src/components/feature-lock-overlay";
import { formatSavedAt } from "@/src/data/mock-history";

export default function RouteDetail() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { history, deleteRoute } = useTrackingSession();
  const { trial } = useTrial();
  const locked = !trial.isPurchased && trial.isExpired;
  const [showLock, setShowLock] = useState(false);
  const route = history.find((r) => r.id === id);

  if (!route) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#10161A", "#0D1114", "#121417"]} style={StyleSheet.absoluteFill} />
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Pressable
            testID="route-detail-back-button"
            accessibilityRole="button"
            accessibilityLabel="Kembali"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color="#F0F2F5" />
          </Pressable>
          <Text style={styles.headerTitle}>DETAIL RUTE</Text>
          <View style={styles.iconSpacer} />
        </View>
        <View testID="route-not-found" style={styles.emptyCenter}>
          <MaterialCommunityIcons name="map-marker-off-outline" size={44} color="#9AA0A6" />
          <Text style={styles.emptyTitle}>Rute tidak ditemukan</Text>
          <Text style={styles.emptyBody}>Rute ini mungkin sudah dihapus.</Text>
        </View>
      </View>
    );
  }

  const confirmDelete = () => {
    Alert.alert("Hapus Rute", `Rute \"${route.name}\" akan dihapus permanen. Lanjutkan?`, [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: () => {
          deleteRoute(route.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#10161A", "#0D1114", "#121417"]} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          testID="route-detail-back-button"
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color="#F0F2F5" />
        </Pressable>
        <Text style={styles.headerTitle}>DETAIL RUTE</Text>
        <View style={styles.iconSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Nama rute */}
        <View testID="route-detail-name-card" style={styles.nameCard}>
          <View style={styles.nameIcon}>
            <MaterialCommunityIcons name="map-marker-path" size={22} color="#FF6B00" />
          </View>
          <View style={styles.nameTextWrap}>
            <Text testID="route-detail-name" style={styles.nameText}>{route.name}</Text>
            <Text style={styles.nameDate}>{formatSavedAt(route.savedAt)}</Text>
          </View>
        </View>

        {/* Statistik utama */}
        <View style={styles.statsGrid}>
          <View testID="route-detail-duration" style={styles.statCard}>
            <MaterialCommunityIcons name="clock-outline" size={20} color="#FF9E40" />
            <Text style={styles.statValue}>{formatDuration(route.durationSec)}</Text>
            <Text style={styles.statLabel}>DURASI</Text>
          </View>
          <View testID="route-detail-steps" style={styles.statCard}>
            <MaterialCommunityIcons name="shoe-print" size={20} color="#FF9E40" />
            <Text style={styles.statValue}>{route.steps.toLocaleString("id-ID")}</Text>
            <Text style={styles.statLabel}>LANGKAH</Text>
          </View>
          <View testID="route-detail-turns" style={styles.statCard}>
            <MaterialCommunityIcons name="directions-fork" size={20} color="#FF9E40" />
            <Text style={styles.statValue}>{route.turns}</Text>
            <Text style={styles.statLabel}>BELOKAN</Text>
          </View>
          <View testID="route-detail-elevation" style={styles.statCard}>
            <MaterialCommunityIcons name="elevation-rise" size={20} color="#FF9E40" />
            <Text style={styles.statValue}>{route.elevationM > 0 ? `+${route.elevationM}` : route.elevationM} m</Text>
            <Text style={styles.statLabel}>KETINGGIAN</Text>
          </View>
          <View testID="route-detail-floors" style={[styles.statCard, styles.statCardWide]}>
            <MaterialCommunityIcons name="layers-triple-outline" size={20} color="#FF9E40" />
            <Text style={styles.statValue}>{route.floors > 0 ? `${route.floors}x` : "-"}</Text>
            <Text style={styles.statLabel}>PINDAH LANTAI</Text>
          </View>
          <View testID="route-detail-avg-pace" style={[styles.statCard, styles.statCardWide]}>
            <MaterialCommunityIcons name="speedometer" size={20} color="#FF9E40" />
            <Text style={styles.statValue}>
              {route.durationSec > 0
                ? (route.steps / (route.durationSec / 60)).toFixed(0)
                : 0}
            </Text>
            <Text style={styles.statLabel}>LANGKAH/MENIT</Text>
          </View>
        </View>

        {/* Rute summary visual */}
        <View testID="route-detail-summary" style={styles.summaryCard}>
          <Text style={styles.summaryEyebrow}>RINGKASAN RUTE</Text>
          <Text style={styles.summaryBody}>
            Rute ini memiliki {route.steps} langkah dengan {route.turns} belokan{route.floors > 0 ? ` dan ${route.floors} kali perpindahan lantai` : ""}. Total perubahan ketinggian {route.elevationM > 0 ? `+${route.elevationM}` : route.elevationM} meter.
          </Text>
        </View>

        {/* Aksi */}
        <Pressable
          testID="route-detail-open-ar"
          accessibilityRole="button"
          accessibilityLabel={locked ? "Fitur terkunci" : "Buka rute di tampilan AR"}
          onPress={locked ? () => setShowLock(true) : () => router.push("/ar-view")}
          style={({ pressed }) => [styles.actionButton, locked && styles.actionLocked, pressed && styles.pressed]}
        >
          <View style={styles.actionIconWrap}>
            <MaterialCommunityIcons name={locked ? "lock" : "augmented-reality"} size={22} color={locked ? "#9AA0A6" : "#121417"} />
          </View>
          <View style={styles.actionTextWrap}>
            <Text style={[styles.actionTitle, locked && styles.actionTitleLocked]}>{locked ? "FITUR TERKUNCI" : "BUKA DI TAMPILAN AR"}</Text>
            <Text style={styles.actionSub}>{locked ? "Beli MULEH untuk membuka AR" : "Lihat rute ini lewat kamera"}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={locked ? "#9AA0A6" : "rgba(18,20,23,0.65)"} />
        </Pressable>

        <FeatureLockOverlay visible={showLock} featureName="Tampilan AR" onClose={() => setShowLock(false)} />

        <Pressable
          testID="route-detail-delete"
          accessibilityRole="button"
          accessibilityLabel="Hapus rute ini"
          onPress={confirmDelete}
          style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="delete-outline" size={20} color="#EA4335" />
          <Text style={styles.deleteText}>HAPUS RUTE</Text>
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
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 8, gap: 12 },
  emptyCenter: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 8 },
  emptyTitle: { color: "#F0F2F5", fontSize: 16, fontWeight: "800", marginTop: 6 },
  emptyBody: { color: "#9AA0A6", fontSize: 13, textAlign: "center", lineHeight: 18 },
  nameCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#1A1D24", borderRadius: 18, borderWidth: 1, borderColor: "#FF6B00", padding: 18 },
  nameIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: "rgba(255,107,0,0.15)", alignItems: "center", justifyContent: "center" },
  nameTextWrap: { flex: 1 },
  nameText: { color: "#F0F2F5", fontSize: 20, fontWeight: "900" },
  nameDate: { color: "#9AA0A6", fontSize: 12, marginTop: 4 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statCard: { width: "31%", backgroundColor: "#1A1D24", borderRadius: 14, borderWidth: 1, borderColor: "#2D323B", paddingVertical: 14, alignItems: "center", gap: 6 },
  statCardWide: { width: "48%" },
  statValue: { color: "#F0F2F5", fontSize: 20, fontWeight: "900", fontVariant: ["tabular-nums"] },
  statLabel: { color: "#9AA0A6", fontSize: 8, fontWeight: "700", letterSpacing: 1 },
  summaryCard: { backgroundColor: "#1A1D24", borderRadius: 16, borderWidth: 1, borderColor: "#2D323B", padding: 16 },
  summaryEyebrow: { color: "#FF6B00", fontSize: 10, fontWeight: "800", letterSpacing: 1.4, marginBottom: 8 },
  summaryBody: { color: "#BDC1C6", fontSize: 13, lineHeight: 19 },
  actionButton: { minHeight: 68, borderRadius: 20, backgroundColor: "#FF6B00", flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 13 },
  actionLocked: { backgroundColor: "#1A1D24", borderWidth: 1, borderColor: "#2D323B", opacity: 0.6 },
  actionIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(18,20,23,0.14)", alignItems: "center", justifyContent: "center" },
  actionTextWrap: { flex: 1 },
  actionTitle: { color: "#121417", fontSize: 14, fontWeight: "900", letterSpacing: 1 },
  actionTitleLocked: { color: "#9AA0A6" },
  actionSub: { color: "rgba(18,20,23,0.72)", fontSize: 12, fontWeight: "600", marginTop: 2 },
  deleteButton: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: "rgba(234,67,53,0.5)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 },
  deleteText: { color: "#EA4335", fontSize: 13, fontWeight: "900", letterSpacing: 1 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
