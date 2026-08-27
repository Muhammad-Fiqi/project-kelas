import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function Welcome() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#10161A", "#0D1114", "#121417"]} style={StyleSheet.absoluteFill} />

      <View style={[styles.center, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <View style={styles.brandMark}>
          <MaterialCommunityIcons name="navigation" size={36} color="#121417" />
        </View>
        <Text style={styles.brand}>MULEH</Text>
        <Text style={styles.tagline}>OFFLINE AR RETURN NAVIGATION</Text>
        <Text style={styles.body}>
          Temukan jalan pulangmu dengan navigasi AR offline. Rekam rute, lalu ikuti panah AR untuk kembali ke titik awal.
        </Text>

        <Pressable
          testID="welcome-login"
          accessibilityRole="button"
          accessibilityLabel="Masuk"
          onPress={() => router.push("/login")}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.primaryText}>MASUK</Text>
        </Pressable>

        <Pressable
          testID="welcome-register"
          accessibilityRole="button"
          accessibilityLabel="Daftar"
          onPress={() => router.push("/register")}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryText}>DAFTAR AKUN BARU</Text>
        </Pressable>

        <Pressable
          testID="welcome-skip"
          accessibilityRole="button"
          accessibilityLabel="Lewati"
          onPress={() => router.replace("/")}
        >
          <Text style={styles.skipText}>Lewati untuk sekarang</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121417" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 14 },
  brandMark: { width: 72, height: 72, borderRadius: 20, backgroundColor: "#FF6B00", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  brand: { color: "#F0F2F5", fontWeight: "900", fontSize: 32, letterSpacing: 4 },
  tagline: { color: "#9AA0A6", fontSize: 10, fontWeight: "700", letterSpacing: 2, marginTop: -4 },
  body: { color: "#9AA0A6", fontSize: 14, lineHeight: 22, textAlign: "center", marginTop: 8, maxWidth: 300 },
  primaryButton: { width: "100%", maxWidth: 320, minHeight: 54, borderRadius: 14, backgroundColor: "#FF6B00", alignItems: "center", justifyContent: "center", marginTop: 24 },
  primaryText: { color: "#121417", fontSize: 15, fontWeight: "900", letterSpacing: 1.5 },
  secondaryButton: { width: "100%", maxWidth: 320, minHeight: 54, borderRadius: 14, borderWidth: 1, borderColor: "#2D323B", backgroundColor: "#1A1D24", alignItems: "center", justifyContent: "center" },
  secondaryText: { color: "#F0F2F5", fontSize: 14, fontWeight: "800", letterSpacing: 1 },
  skipText: { color: "#9AA0A6", fontSize: 13, marginTop: 8 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
