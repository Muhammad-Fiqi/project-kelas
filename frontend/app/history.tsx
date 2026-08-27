import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { formatDuration, useTrackingSession } from "@/src/state/tracking-session";
import { formatSavedAt } from "@/src/data/mock-history";

export default function History() {
  const insets = useSafeAreaInsets();
  const { history, deleteRoute } = useTrackingSession();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const confirmDelete = (id: string, name: string) => {
    Alert.alert("Hapus Rute", `Rute "${name}" akan dihapus permanen. Lanjutkan?`, [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: () => {
          setDeletingId(id);
          deleteRoute(id);
          setDeletingId(null);
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#10161A", "#0D1114", "#121417"]} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          testID="history-back-button"
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color="#F0F2F5" />
        </Pressable>
        <Text style={styles.headerTitle}>RIWAYAT RUTE</Text>
        <View style={styles.iconSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text testID="history-total-routes" style={styles.summaryValue}>{history.length}</Text>
            <Text style={styles.summaryLabel}>TOTAL RUTE</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text testID="history-total-steps" style={styles.summaryValue}>
              {history.reduce((sum, r) => sum + r.steps, 0).toLocaleString("id-ID")}
            </Text>
            <Text style={styles.summaryLabel}>TOTAL LANGKAH</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text testID="history-total-time" style={styles.summaryValue}>
              {formatDuration(history.reduce((sum, r) => sum + r.durationSec, 0))}
            </Text>
            <Text style={styles.summaryLabel}>TOTAL WAKTU</Text>
          </View>
        </View>

        {history.length === 0 ? (
          <View testID="history-empty-state" style={styles.emptyCard}>
            <MaterialCommunityIcons name="map-clock-outline" size={36} color="#9AA0A6" />
            <Text style={styles.emptyTitle}>Belum ada riwayat</Text>
            <Text style={styles.emptyBody}>Rute yang kamu rekam dan simpan akan muncul di sini.</Text>
          </View>
        ) : (
          history.map((route, index) => (
            <Pressable
              key={route.id}
              testID={`history-item-${route.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Detail rute ${route.name}`}
              onPress={() => router.push({ pathname: "/route-detail", params: { id: route.id } })}
              style={({ pressed }) => [styles.routeCard, pressed && styles.pressed]}
            >
              <View style={styles.routeIndex}>
                <Text style={styles.routeIndexText}>{String(index + 1).padStart(2, "0")}</Text>
              </View>
              <View style={styles.routeTextWrap}>
                <Text style={styles.routeName} numberOfLines={1}>{route.name}</Text>
                <Text style={styles.routeMeta}>
                  {formatSavedAt(route.savedAt)}
                </Text>
              </View>
              <View style={styles.routeStats}>
                <View style={styles.routeStatItem}>
                  <MaterialCommunityIcons name="shoe-print" size={13} color="#FF9E40" />
                  <Text style={styles.routeStatValue}>{route.steps}</Text>
                </View>
                <View style={styles.routeStatItem}>
                  <MaterialCommunityIcons name="clock-outline" size={13} color="#FF9E40" />
                  <Text style={styles.routeStatValue}>{formatDuration(route.durationSec)}</Text>
                </View>
              </View>
              <Pressable
                testID={`history-delete-${route.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Hapus rute ${route.name}`}
                onPress={(e) => {
                  e.stopPropagation();
                  confirmDelete(route.id, route.name);
                }}
                hitSlop={8}
              >
                <MaterialCommunityIcons
                  name="delete-outline"
                  size={18}
                  color={deletingId === route.id ? "#EA4335" : "#9AA0A6"}
                />
              </Pressable>
            </Pressable>
          ))
        )}
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
  scrollContent: { paddingHorizontal: 18, paddingTop: 8, gap: 10 },
  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 6 },
  summaryCard: { flex: 1, backgroundColor: "#1A1D24", borderRadius: 14, borderWidth: 1, borderColor: "#2D323B", paddingVertical: 12, alignItems: "center" },
  summaryValue: { color: "#F0F2F5", fontSize: 20, fontWeight: "900", fontVariant: ["tabular-nums"] },
  summaryLabel: { color: "#9AA0A6", fontSize: 8, fontWeight: "700", letterSpacing: 0.8, marginTop: 4 },
  emptyCard: { backgroundColor: "#1A1D24", borderRadius: 20, borderWidth: 1, borderColor: "#2D323B", borderStyle: "dashed", alignItems: "center", paddingVertical: 36, paddingHorizontal: 20, gap: 8 },
  emptyTitle: { color: "#F0F2F5", fontSize: 15, fontWeight: "800", marginTop: 4 },
  emptyBody: { color: "#9AA0A6", fontSize: 12, textAlign: "center", lineHeight: 17 },
  routeCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#1A1D24", borderRadius: 16, borderWidth: 1, borderColor: "#2D323B", padding: 14, minHeight: 72 },
  routeIndex: { width: 32, height: 32, borderRadius: 9, backgroundColor: "rgba(255,107,0,0.13)", alignItems: "center", justifyContent: "center" },
  routeIndexText: { color: "#FF9E40", fontSize: 12, fontWeight: "900", fontVariant: ["tabular-nums"] },
  routeTextWrap: { flex: 1, flexShrink: 1 },
  routeName: { color: "#F0F2F5", fontSize: 14, fontWeight: "800" },
  routeMeta: { color: "#9AA0A6", fontSize: 11, marginTop: 3 },
  routeStats: { flexDirection: "row", gap: 12 },
  routeStatItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  routeStatValue: { color: "#BDC1C6", fontSize: 12, fontWeight: "700", fontVariant: ["tabular-nums"] },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
