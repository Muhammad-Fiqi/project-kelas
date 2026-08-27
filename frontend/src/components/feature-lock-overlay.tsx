import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

/**
 * Overlay layar penuh yang muncul saat user mencoba mengakses
 * fitur yang terkunci karena trial sudah berakhir.
 */
type Props = {
  visible: boolean;
  featureName: string;
  onClose: () => void;
};

export function FeatureLockOverlay({ visible, featureName, onClose }: Props) {
  if (!visible) return null;

  return (
    <View style={styles.backdrop} testID="feature-lock-overlay">
      <LinearGradient colors={["#10161A", "#0D1114", "#121417"]} style={StyleSheet.absoluteFill} />

      <View style={styles.card} testID="feature-lock-card">
        <View style={styles.lockIcon}>
          <MaterialCommunityIcons name="lock" size={36} color="#EA4335" />
        </View>

        <Text style={styles.title}>FITUR TERKUNCI</Text>
        <Text style={styles.featureName}>"{featureName}"</Text>
        <Text style={styles.body}>
          Fitur ini hanya tersedia selama masa percobaan atau setelah membeli MULEH. Trial kamu sudah berakhir.
        </Text>

        <Pressable
          testID="lock-overlay-buy"
          accessibilityRole="button"
          accessibilityLabel="Beli MULEH"
          onPress={() => {
            onClose();
            router.push("/trial");
          }}
          style={({ pressed }) => [styles.buyButton, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="google-play" size={18} color="#121417" />
          <Text style={styles.buyText}>BELI SEKARANG</Text>
        </Pressable>

        <Pressable
          testID="lock-overlay-close"
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          onPress={onClose}
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
        >
          <Text style={styles.closeText}>KEMBALI</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#1A1D24",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#2D323B",
    padding: 28,
    alignItems: "center",
  },
  lockIcon: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: "rgba(234,67,53,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    color: "#EA4335",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 2,
  },
  featureName: {
    color: "#F0F2F5",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 6,
    textAlign: "center",
  },
  body: {
    color: "#9AA0A6",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 10,
  },
  buyButton: {
    width: "100%",
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: "#FF6B00",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 22,
  },
  buyText: {
    color: "#121417",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1,
  },
  closeButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2D323B",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    paddingHorizontal: 28,
  },
  closeText: {
    color: "#BDC1C6",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
