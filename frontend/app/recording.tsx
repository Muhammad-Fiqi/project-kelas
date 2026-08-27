import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { formatDuration, useTrackingSession } from "@/src/state/tracking-session";

export default function Recording() {
  const insets = useSafeAreaInsets();
  const { isTracking, elapsedSec, telemetry, saveSession, discardSession } = useTrackingSession();
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [routeName, setRouteName] = useState("");
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  // Jika tidak ada sesi aktif, kembali ke halaman utama.
  useEffect(() => {
    if (!isTracking) {
      router.replace("/");
    }
  }, [isTracking]);

  const handleStop = () => {
    setRouteName(`Rute ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short" })} · ${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`);
    setSaveModalVisible(true);
  };

  const handleSave = () => {
    setSaveModalVisible(false);
    saveSession(routeName);
  };

  const handleDiscard = () => {
    setSaveModalVisible(false);
    discardSession();
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#10161A", "#0D1114", "#121417"]} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          testID="recording-back-button"
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color="#F0F2F5" />
        </Pressable>
        <View style={styles.recBadge}>
          <Animated.View style={[styles.recDot, { opacity: pulse.interpolate({ inputRange: [1, 1.12], outputRange: [1, 0.35] }) }]} />
          <Text style={styles.recBadgeText}>MODE PEREKAMAN</Text>
        </View>
        <View style={styles.iconSpacer} />
      </View>

      <View style={styles.center}>
        <Animated.View testID="recording-indicator" style={[styles.recRingOuter, { transform: [{ scale: pulse }] }]}>
          <View style={styles.recRingInner}>
            <MaterialCommunityIcons name="radar" size={44} color="#FF6B00" />
          </View>
        </Animated.View>
        <Text style={styles.trackingLabel}>TRACKING AKTIF</Text>
        <Text testID="recording-duration" style={styles.duration}>{formatDuration(elapsedSec)}</Text>
        <Text style={styles.durationLabel}>DURASI PEREKAMAN</Text>

        <View testID="recording-telemetry" style={styles.telemetryGrid}>
          <View style={styles.telemetryCell}>
            <MaterialCommunityIcons name="shoe-print" size={18} color="#FF9E40" />
            <Text style={styles.telemetryValue}>{telemetry.steps}</Text>
            <Text style={styles.telemetryLabel}>LANGKAH</Text>
          </View>
          <View style={styles.telemetryCell}>
            <MaterialCommunityIcons name="directions-fork" size={18} color="#FF9E40" />
            <Text style={styles.telemetryValue}>{telemetry.turns}</Text>
            <Text style={styles.telemetryLabel}>BELOKAN</Text>
          </View>
          <View style={styles.telemetryCell}>
            <MaterialCommunityIcons name="elevation-rise" size={18} color="#FF9E40" />
            <Text style={styles.telemetryValue}>{telemetry.elevationM > 0 ? `+${telemetry.elevationM}` : telemetry.elevationM} m</Text>
            <Text style={styles.telemetryLabel}>KETINGGIAN</Text>
          </View>
          <View style={styles.telemetryCell}>
            <MaterialCommunityIcons name="layers-triple-outline" size={18} color="#FF9E40" />
            <Text style={styles.telemetryValue}>LT. {telemetry.floor}</Text>
            <Text style={styles.telemetryLabel}>LANTAI</Text>
          </View>
        </View>
      </View>

      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 18) }]}>
        <Pressable
          testID="recording-open-ar"
          accessibilityRole="button"
          accessibilityLabel="Buka tampilan AR"
          onPress={() => router.push("/ar-view")}
          style={({ pressed }) => [styles.arButton, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="augmented-reality" size={20} color="#FF9E40" />
          <Text style={styles.arButtonText}>LIHAT AR</Text>
        </Pressable>
        <Pressable
          testID="recording-stop-button"
          accessibilityRole="button"
          accessibilityLabel="Hentikan perekaman"
          onPress={handleStop}
          style={({ pressed }) => [styles.stopButton, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="stop" size={22} color="#121417" />
          <Text style={styles.stopButtonText}>HENTIKAN</Text>
        </Pressable>
      </View>

      <Modal visible={saveModalVisible} transparent animationType="fade" onRequestClose={() => setSaveModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalBackdrop}>
          <View testID="save-route-modal" style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <MaterialCommunityIcons name="content-save-check-outline" size={26} color="#FF9E40" />
            </View>
            <Text style={styles.modalTitle}>Simpan rute ini?</Text>
            <Text style={styles.modalBody}>
              {formatDuration(elapsedSec)} · {telemetry.steps} langkah · {telemetry.turns} belokan
            </Text>
            <TextInput
              testID="route-name-input"
              value={routeName}
              onChangeText={setRouteName}
              placeholder="Nama rute, cth. Parkiran Mall LT. 2"
              placeholderTextColor="#9AA0A6"
              style={styles.input}
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
            <Pressable
              testID="save-route-button"
              accessibilityRole="button"
              accessibilityLabel="Simpan rute"
              onPress={handleSave}
              style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="check" size={20} color="#121417" />
              <Text style={styles.saveButtonText}>SIMPAN RUTE</Text>
            </Pressable>
            <View style={styles.modalRow}>
              <Pressable
                testID="discard-route-button"
                accessibilityRole="button"
                accessibilityLabel="Buang rute"
                onPress={handleDiscard}
                style={({ pressed }) => [styles.discardButton, pressed && styles.pressed]}
              >
                <Text style={styles.discardText}>BUANG</Text>
              </Pressable>
              <Pressable
                testID="cancel-save-button"
                accessibilityRole="button"
                accessibilityLabel="Lanjutkan merekam"
                onPress={() => setSaveModalVisible(false)}
                style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
              >
                <Text style={styles.cancelText}>LANJUT REKAM</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121417" },
  header: { paddingHorizontal: 18, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconButton: { width: 46, height: 46, borderRadius: 12, backgroundColor: "#1A1D24", borderWidth: 1, borderColor: "#2D323B", alignItems: "center", justifyContent: "center" },
  iconSpacer: { width: 46 },
  recBadge: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(234,67,53,0.14)", borderWidth: 1, borderColor: "rgba(234,67,53,0.5)", paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999 },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#EA4335" },
  recBadgeText: { color: "#EA4335", fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  recRingOuter: { width: 130, height: 130, borderRadius: 65, borderWidth: 1, borderColor: "rgba(255,107,0,0.4)", backgroundColor: "rgba(255,107,0,0.08)", alignItems: "center", justifyContent: "center" },
  recRingInner: { width: 96, height: 96, borderRadius: 48, borderWidth: 1, borderColor: "rgba(255,107,0,0.55)", backgroundColor: "rgba(255,107,0,0.12)", alignItems: "center", justifyContent: "center" },
  trackingLabel: { color: "#FF6B00", fontSize: 11, fontWeight: "900", letterSpacing: 2, marginTop: 18 },
  duration: { color: "#F0F2F5", fontSize: 52, fontWeight: "900", fontVariant: ["tabular-nums"], marginTop: 4 },
  durationLabel: { color: "#9AA0A6", fontSize: 10, fontWeight: "700", letterSpacing: 1.4 },
  telemetryGrid: { flexDirection: "row", backgroundColor: "#1A1D24", borderRadius: 18, borderWidth: 1, borderColor: "#2D323B", paddingVertical: 16, marginTop: 28, alignSelf: "stretch" },
  telemetryCell: { flex: 1, alignItems: "center", gap: 4 },
  telemetryValue: { color: "#F0F2F5", fontSize: 15, fontWeight: "800", fontVariant: ["tabular-nums"] },
  telemetryLabel: { color: "#9AA0A6", fontSize: 8, fontWeight: "700", letterSpacing: 1 },
  bottom: { flexDirection: "row", gap: 12, paddingHorizontal: 18 },
  arButton: { flex: 1, minHeight: 56, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,107,0,0.5)", backgroundColor: "rgba(255,107,0,0.10)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  arButtonText: { color: "#FF9E40", fontSize: 13, fontWeight: "900", letterSpacing: 1 },
  stopButton: { flex: 1, minHeight: 56, borderRadius: 14, backgroundColor: "#F0F2F5", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  stopButtonText: { color: "#121417", fontSize: 13, fontWeight: "900", letterSpacing: 1 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  modalCard: { alignSelf: "stretch", backgroundColor: "#1A1D24", borderRadius: 22, borderWidth: 1, borderColor: "#2D323B", padding: 20, alignItems: "center" },
  modalIcon: { width: 52, height: 52, borderRadius: 15, backgroundColor: "rgba(255,107,0,0.14)", alignItems: "center", justifyContent: "center" },
  modalTitle: { color: "#F0F2F5", fontSize: 19, fontWeight: "900", marginTop: 12 },
  modalBody: { color: "#9AA0A6", fontSize: 12, marginTop: 5 },
  input: { alignSelf: "stretch", minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: "#2D323B", backgroundColor: "#121417", color: "#F0F2F5", paddingHorizontal: 14, fontSize: 14, marginTop: 16 },
  saveButton: { alignSelf: "stretch", minHeight: 52, borderRadius: 13, backgroundColor: "#FF6B00", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12 },
  saveButtonText: { color: "#121417", fontSize: 13, fontWeight: "900", letterSpacing: 1 },
  modalRow: { flexDirection: "row", gap: 10, alignSelf: "stretch", marginTop: 10 },
  discardButton: { flex: 1, minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: "rgba(234,67,53,0.55)", alignItems: "center", justifyContent: "center" },
  discardText: { color: "#EA4335", fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  cancelButton: { flex: 1, minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: "#2D323B", alignItems: "center", justifyContent: "center" },
  cancelText: { color: "#BDC1C6", fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
