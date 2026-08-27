import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { useTrial } from "@/src/state/trial-context";

const URGENT_MS = 24 * 60 * 60 * 1000; // < 24 jam = urgency

type Props = {
  /** Override dismissible — jika false, banner tidak bisa ditutup */
  dismissible?: boolean;
  /** Test ID override */
  testID?: string;
};

export function TrialReminderBanner({ dismissible = true, testID = "trial-reminder-banner" }: Props) {
  const { trial } = useTrial();
  const [dismissed, setDismissed] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;

  // Tidak tampilkan jika sudah beli, atau sudah di-dismiss sesi ini.
  if (trial.isPurchased || dismissed) return null;

  const isUrgent = !trial.isExpired && trial.remainingMs < URGENT_MS && trial.remainingMs > 0;
  const isExpired = trial.isExpired;

  // Pulse animasi saat urgency.
  useEffect(() => {
    if (!isUrgent) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isUrgent, pulse]);

  // Warna & styling berdasarkan state.
  const borderColor = isExpired ? "rgba(234,67,53,0.6)" : isUrgent ? "rgba(251,188,4,0.6)" : "rgba(255,107,0,0.4)";
  const bgColor = isExpired ? "rgba(234,67,53,0.12)" : isUrgent ? "rgba(251,188,4,0.10)" : "rgba(255,107,0,0.10)";
  const iconColor = isExpired ? "#EA4335" : isUrgent ? "#FBBC04" : "#FF9E40";
  const textColor = isExpired ? "#EA4335" : isUrgent ? "#FBBC04" : "#FF9E40";
  const iconName = isExpired ? "lock-alert" : isUrgent ? "alert-circle" : "timer-sand";

  return (
    <Animated.View
      testID={testID}
      style={[
        styles.wrapper,
        { borderColor, backgroundColor: bgColor },
        isUrgent && { transform: [{ scale: pulse }] },
      ]}
    >
      <Pressable
        style={styles.content}
        onPress={() => router.push("/trial")}
      >
        <MaterialCommunityIcons name={iconName as any} size={16} color={iconColor} />
        <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>
          {isExpired
            ? "Trial berakhir — beli untuk membuka fitur"
            : isUrgent
              ? `Sisa ${trial.remainingLabel} — beli sekarang!`
              : `Trial · sisa ${trial.remainingLabel}`}
        </Text>
        <Pressable
          testID="trial-reminder-cta"
          style={[styles.cta, isExpired && styles.ctaExpired, isUrgent && styles.ctaUrgent]}
          onPress={() => router.push("/trial")}
        >
          <Text style={styles.ctaText}>{isExpired ? "BELI" : "BELI"}</Text>
        </Pressable>
      </Pressable>

      {dismissible && !isExpired && (
        <Pressable
          testID="trial-reminder-dismiss"
          accessibilityRole="button"
          accessibilityLabel="Tutup pengingat"
          onPress={() => setDismissed(true)}
          hitSlop={8}
          style={styles.dismiss}
        >
          <MaterialCommunityIcons name="close" size={14} color="#9AA0A6" />
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  label: {
    flex: 1,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  cta: {
    backgroundColor: "rgba(255,107,0,0.22)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  ctaExpired: {
    backgroundColor: "rgba(234,67,53,0.22)",
  },
  ctaUrgent: {
    backgroundColor: "rgba(251,188,4,0.22)",
  },
  ctaText: {
    color: "#FF6B00",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  dismiss: {
    position: "absolute",
    right: 4,
    top: 4,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
