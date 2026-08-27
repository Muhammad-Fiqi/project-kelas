import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { TRIAL_DAYS } from "@/src/data/mock-trial";
import { useTrial } from "@/src/state/trial-context";

const MENU_ITEMS: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value?: string; action: string }[] = [
  { icon: "map-marker-path", label: "Riwayat Rute", action: "/history" },
  { icon: "shield-check", label: "Lisensi & Trial", action: "/trial" },
  { icon: "information-outline", label: "Tentang MULEH", action: "/about" },
];

export default function Settings() {
  const insets = useSafeAreaInsets();
  const { trial } = useTrial();

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#10161A", "#0D1114", "#121417"]} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          testID="settings-back-button"
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color="#F0F2F5" />
        </Pressable>
        <Text style={styles.headerTitle}>PENGATURAN</Text>
        <View style={styles.iconSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Trial / License status card */}
        <Pressable
          testID="settings-trial-card"
          accessibilityRole="button"
          accessibilityLabel="Lihat status lisensi"
          onPress={() => router.push("/trial")}
          style={({ pressed }) => [styles.trialCard, trial.isPurchased && styles.trialCardPurchased, trial.isExpired && !trial.isPurchased && styles.trialCardExpired, pressed && styles.pressed]}
        >
          <View style={styles.trialCardLeft}>
            <MaterialCommunityIcons
              name={trial.isPurchased ? "shield-check" : trial.isExpired ? "lock" : "timer-sand"}
              size={22}
              color={trial.isPurchased ? "#34A853" : trial.isExpired ? "#EA4335" : "#FF9E40"}
            />
            <View>
              <Text style={styles.trialCardTitle}>
                {trial.isPurchased ? "Lisensi Premium" : trial.isExpired ? "Trial Berakhir" : `Sisa ${trial.remainingLabel}`}
              </Text>
              <Text style={styles.trialCardSub}>
                {trial.isPurchased
                  ? "Semua fitur aktif selamanya"
                  : trial.isExpired
                    ? "Beli untuk membuka fitur"
                    : `Trial ${TRIAL_DAYS} hari · tap untuk detail`}
              </Text>
            </View>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#9AA0A6" />
        </Pressable>

        {/* Menu items */}
        {MENU_ITEMS.map((item) => (
          <Pressable
            key={item.label}
            testID={`settings-menu-${item.action}`}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            onPress={() => router.push(item.action as any)}
            style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}
          >
            <View style={styles.menuIcon}>
              <MaterialCommunityIcons name={item.icon} size={20} color="#FF9E40" />
            </View>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#9AA0A6" />
          </Pressable>
        ))}

        <Text testID="settings-version" style={styles.version}>
          MULEH v1.0.0
        </Text>
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
  trialCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#1A1D24", borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,107,0,0.4)", padding: 16 },
  trialCardPurchased: { borderColor: "rgba(52,168,83,0.4)" },
  trialCardExpired: { borderColor: "rgba(234,67,53,0.5)" },
  trialCardLeft: { flexDirection: "row", alignItems: "center", gap: 14, flex: 1 },
  trialCardTitle: { color: "#F0F2F5", fontSize: 15, fontWeight: "800" },
  trialCardSub: { color: "#9AA0A6", fontSize: 12, marginTop: 2 },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#1A1D24", borderRadius: 16, borderWidth: 1, borderColor: "#2D323B", padding: 14 },
  menuIcon: { width: 40, height: 40, borderRadius: 11, backgroundColor: "rgba(255,107,0,0.15)", alignItems: "center", justifyContent: "center" },
  menuLabel: { flex: 1, color: "#F0F2F5", fontSize: 14, fontWeight: "700" },
  version: { color: "#9AA0A6", fontSize: 11, textAlign: "center", marginTop: 16 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
