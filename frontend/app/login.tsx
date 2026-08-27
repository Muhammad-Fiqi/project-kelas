import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export default function Login() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    // Stub — nanti integrasi backend.
    router.replace("/");
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <LinearGradient colors={["#10161A", "#0D1114", "#121417"]} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          testID="login-back"
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color="#F0F2F5" />
        </Pressable>
        <Text style={styles.headerTitle}>MASUK</Text>
        <View style={styles.iconSpacer} />
      </View>

      <View style={[styles.form, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <Text style={styles.subtitle}>Masuk untuk menyimpan rute di cloud</Text>

        <View style={styles.inputWrap}>
          <MaterialCommunityIcons name="email-outline" size={18} color="#9AA0A6" />
          <TextInput
            testID="login-email"
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor="#9AA0A6"
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
            returnKeyType="next"
          />
        </View>

        <View style={styles.inputWrap}>
          <MaterialCommunityIcons name="lock-outline" size={18} color="#9AA0A6" />
          <TextInput
            testID="login-password"
            value={password}
            onChangeText={setPassword}
            placeholder="Kata sandi"
            placeholderTextColor="#9AA0A6"
            secureTextEntry
            style={styles.input}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />
        </View>

        <Pressable
          testID="login-forgot"
          accessibilityRole="button"
          accessibilityLabel="Lupa kata sandi"
        >
          <Text style={styles.forgotText}>Lupa kata sandi?</Text>
        </Pressable>

        <Pressable
          testID="login-submit"
          accessibilityRole="button"
          accessibilityLabel="Masuk"
          onPress={handleLogin}
          style={({ pressed }) => [styles.submitButton, pressed && styles.pressed]}
        >
          <Text style={styles.submitText}>MASUK</Text>
        </Pressable>

        <Pressable
          testID="login-to-register"
          accessibilityRole="button"
          accessibilityLabel="Daftar"
          onPress={() => router.push("/register")}
        >
          <Text style={styles.switchText}>Belum punya akun? <Text style={styles.switchHighlight}>Daftar</Text></Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121417" },
  header: { paddingHorizontal: 18, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { color: "#F0F2F5", fontSize: 14, fontWeight: "900", letterSpacing: 2 },
  iconButton: { width: 46, height: 46, borderRadius: 12, backgroundColor: "#1A1D24", borderWidth: 1, borderColor: "#2D323B", alignItems: "center", justifyContent: "center" },
  iconSpacer: { width: 46 },
  form: { flex: 1, paddingHorizontal: 18, justifyContent: "center", gap: 14 },
  subtitle: { color: "#9AA0A6", fontSize: 13, marginBottom: 8 },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: "#2D323B", backgroundColor: "#1A1D24", paddingHorizontal: 14 },
  input: { flex: 1, color: "#F0F2F5", fontSize: 14 },
  forgotText: { color: "#FF9E40", fontSize: 12, fontWeight: "700", alignSelf: "flex-end" },
  submitButton: { minHeight: 54, borderRadius: 14, backgroundColor: "#FF6B00", alignItems: "center", justifyContent: "center", marginTop: 8 },
  submitText: { color: "#121417", fontSize: 15, fontWeight: "900", letterSpacing: 1.5 },
  switchText: { color: "#9AA0A6", fontSize: 13, textAlign: "center", marginTop: 8 },
  switchHighlight: { color: "#FF6B00", fontWeight: "800" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
