import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, useRef, useState } from "react";

import { useTrial } from "@/src/state/trial-context";
import { FeatureLockOverlay } from "@/src/components/feature-lock-overlay";
import {
  Animated,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { formatDuration, useTrackingSession } from "@/src/state/tracking-session";
import { buildRoutePath, mockFloorChanges, mockRouteSummary } from "@/src/data/mock-route";

type ArMode = "DOTS" | "ARROWS" | "PIN";

const modes: { id: ArMode; label: string; name: string; description: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { id: "DOTS", label: "Dots", name: "RUTE TITIK", description: "Jejak pulang ditampilkan sebagai titik-titik menuju pin lokasi awal.", icon: "dots-hexagon" },
  { id: "ARROWS", label: "Arrows", name: "RUTE PANAH", description: "Panah mengikuti arah manuvermu sampai ke pin lokasi awal.", icon: "arrow-up-bold" },
  { id: "PIN", label: "Pin", name: "PIN TITIK AWAL", description: "Hanya menampilkan pin lokasi awal sebagai tujuan pulang.", icon: "map-marker" },
];

const ROUTE_W = 230;
const ROUTE_H = 330;
const routePath = buildRoutePath();

export default function ArView() {
  const insets = useSafeAreaInsets();
  const { isTracking: recording, elapsedSec, telemetry } = useTrackingSession();
  const { trial } = useTrial();
  const locked = !trial.isPurchased && trial.isExpired;
  const [showLock, setShowLock] = useState(locked);
  const [mode, setMode] = useState<ArMode>("DOTS");
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraOn, setCameraOn] = useState(false);
  const [askedOnce, setAskedOnce] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;

  const permissionBlocked = permission !== null && !permission.granted && !permission.canAskAgain && askedOnce;

  const enableCamera = async () => {
    if (permission?.granted) {
      setCameraOn(true);
      return;
    }
    if (permissionBlocked) {
      Linking.openSettings();
      return;
    }
    setAskedOnce(true);
    const result = await requestPermission();
    if (result.granted) setCameraOn(true);
  };
  const introOpacity = useRef(new Animated.Value(0)).current;
  const introTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeMode = modes.find((item) => item.id === mode)!;

  const showModeIntro = () => {
    if (introTimeout.current) clearTimeout(introTimeout.current);
    Animated.timing(introOpacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    introTimeout.current = setTimeout(() => {
      Animated.timing(introOpacity, { toValue: 0, duration: 450, useNativeDriver: true }).start();
    }, 2600);
  };

  const selectMode = (next: ArMode) => {
    setMode(next);
    showModeIntro();
  };

  useEffect(() => {
    showModeIntro();
    return () => {
      if (introTimeout.current) clearTimeout(introTimeout.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const toggleRecording = () => {
    if (recording) {
      // Arahkan ke halaman perekaman yang memiliki alur simpan rute.
      router.push("/recording");
    }
  };

  return (
    <View style={styles.container}>
      <FeatureLockOverlay visible={showLock} featureName="Tampilan AR Navigasi" onClose={() => { setShowLock(false); router.back(); }} />
      <LinearGradient colors={["#10161A", "#0D1114", "#121417"]} style={StyleSheet.absoluteFill} />
      {cameraOn && permission?.granted && (
        <CameraView style={StyleSheet.absoluteFill} facing="back" />
      )}
      <View style={styles.viewfinder} pointerEvents="box-none">
        <View style={styles.horizon} />
        <View style={[styles.gridLine, styles.gridVerticalLeft]} />
        <View style={[styles.gridLine, styles.gridVerticalRight]} />
        <View style={[styles.gridLine, styles.gridHorizontalTop]} />
        <View style={[styles.gridLine, styles.gridHorizontalBottom]} />
        <View style={styles.cornerTopLeft} />
        <View style={styles.cornerTopRight} />
        <View style={styles.cornerBottomLeft} />
        <View style={styles.cornerBottomRight} />
        {!cameraOn && (
          <View style={styles.cameraPrompt}>
            <Text style={styles.cameraLabel}>CAMERA VIEWFINDER</Text>
            <Text style={styles.cameraHint}>
              {permissionBlocked
                ? "IZIN KAMERA DIBLOKIR · BUKA PENGATURAN UNTUK MENGAKTIFKAN"
                : "Aktifkan kamera untuk melihat rute pulang menempel di dunia nyata"}
            </Text>
            <Pressable
              testID="enable-camera-button"
              accessibilityRole="button"
              accessibilityLabel={permissionBlocked ? "Buka pengaturan" : "Aktifkan kamera"}
              onPress={enableCamera}
              style={({ pressed }) => [styles.cameraButton, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name={permissionBlocked ? "cog-outline" : "camera-outline"} size={17} color="#FF9E40" />
              <Text style={styles.cameraButtonText}>{permissionBlocked ? "BUKA PENGATURAN" : "AKTIFKAN KAMERA"}</Text>
            </Pressable>
          </View>
        )}

        <Animated.View testID="direction-assist" style={[styles.assist, { transform: [{ scale: pulse }] }]}>
          <View style={styles.assistRing}>
            <MaterialCommunityIcons
              name="navigation-variant"
              size={42}
              color="#FF6B00"
              style={{ transform: [{ rotate: `${-telemetry.headingDeg}deg` }] }}
            />
          </View>
          <Text style={styles.assistCaption}>AIM THIS WAY</Text>
          <Text style={styles.assistDistance}>RETURN HEADING · {(360 - telemetry.headingDeg + 360) % 360}°</Text>
        </Animated.View>

        <View testID="route-canvas" pointerEvents="none" style={styles.routeCanvas}>
          {mode === "DOTS" && routePath.points.map((pt, index) => {
            const size = 10 - pt.progress * 5;
            return (
              <View
                key={`route-point-${index}`}
                style={[styles.dot, {
                  left: pt.x * ROUTE_W - size / 2,
                  top: pt.y * ROUTE_H - size / 2,
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  opacity: 0.4 + 0.6 * (1 - pt.progress),
                }]}
              />
            );
          })}
          {mode === "ARROWS" && routePath.arrows.map((arrow, index) => {
            const size = 24 + (1 - arrow.progress) * 14;
            return (
              <MaterialCommunityIcons
                key={`route-arrow-${index}`}
                name="arrow-up-bold"
                size={size}
                color="#FF6B00"
                style={{
                  position: "absolute",
                  left: arrow.x * ROUTE_W - size / 2,
                  top: arrow.y * ROUTE_H - size / 2,
                  opacity: 0.45 + 0.55 * (1 - arrow.progress),
                  transform: [{ rotate: `${arrow.angleDeg}deg` }],
                }}
              />
            );
          })}
          {mode === "PIN" ? (
            <MaterialCommunityIcons
              name="map-marker"
              size={62}
              color="#FF6B00"
              style={{ position: "absolute", left: routePath.startAnchor.x * ROUTE_W - 31, top: routePath.startAnchor.y * ROUTE_H - 56 }}
            />
          ) : (
            <View style={[styles.startPin, { left: routePath.startAnchor.x * ROUTE_W - 34, top: routePath.startAnchor.y * ROUTE_H - 34 }]}>
              <MaterialCommunityIcons name="map-marker" size={22} color="#121417" />
              <Text style={styles.pinText}>START</Text>
            </View>
          )}
          {mode !== "PIN" && routePath.floorAnchors.map((anchor) => {
            const change = mockFloorChanges[anchor.changeIndex];
            const delta = change.toFloor - change.fromFloor;
            const viaIcon = change.via === "lift" ? "elevator-passenger" : change.via === "tangga" ? "stairs" : delta > 0 ? "escalator-up" : "escalator-down";
            return (
              <View
                key={`floor-change-${anchor.changeIndex}`}
                testID={`floor-change-marker-${anchor.changeIndex}`}
                style={[styles.floorMarker, { left: Math.min(anchor.x * ROUTE_W + 12, ROUTE_W - 140), top: anchor.y * ROUTE_H - 22 }]}
              >
                <View style={styles.floorMarkerIcon}>
                  <MaterialCommunityIcons name={viaIcon} size={17} color="#121417" />
                </View>
                <View>
                  <Text style={styles.floorMarkerTitle}>{delta > 0 ? `NAIK KE LT. ${change.toFloor}` : `TURUN KE LT. ${change.toFloor}`}</Text>
                  <Text style={styles.floorMarkerSub}>VIA {change.via.toUpperCase()}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <View style={[styles.topHud, { top: insets.top + 12 }]}>
        <Pressable testID="ar-back-button" accessibilityRole="button" accessibilityLabel="Kembali" onPress={() => router.back()} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
          <MaterialCommunityIcons name="arrow-left" size={23} color="#F0F2F5" />
        </Pressable>
        <BlurView intensity={35} tint="dark" style={styles.hudCard}>
          <View style={styles.brandRow}><View style={styles.brandMark}><MaterialCommunityIcons name="navigation" size={17} color="#121417" /></View><Text style={styles.brand}>MULEH</Text></View>
          <View style={styles.statusRow}><View style={[styles.statusDot, recording && styles.statusDotActive]} /><Text style={styles.statusText}>{recording ? "TRACKING ACTIVE" : "READY TO TRACK"}</Text></View>
        </BlurView>
      </View>

      <Animated.View pointerEvents="none" testID="ar-mode-intro" style={[styles.modeIntro, { top: insets.top + 78, opacity: introOpacity }]}>
        <View style={styles.modeIntroIcon}>
          <MaterialCommunityIcons name={activeMode.icon} size={18} color="#FF9E40" />
        </View>
        <View style={styles.modeIntroTextWrap}>
          <Text style={styles.modeIntroName}>{activeMode.name}</Text>
          <Text style={styles.modeIntroDesc}>{activeMode.description}</Text>
        </View>
      </Animated.View>

      <View style={[styles.bottomHud, { paddingBottom: Math.max(insets.bottom, 18) }]}>
        <BlurView intensity={45} tint="dark" style={styles.controlCard}>
          <View style={styles.controlHeader}><View><Text style={styles.eyebrow}>RETURN ROUTE</Text><Text style={styles.routeStatus}>{recording ? "Recording your path" : `${mockRouteSummary.totalSteps} langkah · ${mockRouteSummary.totalTurns} belokan · +${mockRouteSummary.elevationGainM} m`}</Text></View><View style={styles.telemetry}><Text style={styles.telemetryValue}>{recording ? formatDuration(elapsedSec) : "--:--"}</Text><Text style={styles.telemetryLabel}>DURATION</Text></View></View>
          <View style={styles.modeRow}>{modes.map((item) => <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === item.id }} accessibilityLabel={`AR mode ${item.label}`} testID={`ar-mode-${item.id.toLowerCase()}`} key={item.id} onPress={() => selectMode(item.id)} style={({ pressed }) => [styles.modeButton, mode === item.id && styles.modeButtonSelected, pressed && styles.pressed]}><MaterialCommunityIcons name={item.icon} size={18} color={mode === item.id ? "#FF6B00" : "#9AA0A6"} /><Text style={[styles.modeLabel, mode === item.id && styles.modeLabelSelected]}>{item.label}</Text></Pressable>)}</View>
          <Pressable testID="recording-toggle" onPress={toggleRecording} style={({ pressed }) => [styles.primaryButton, recording && styles.stopButton, pressed && styles.pressed]}><MaterialCommunityIcons name={recording ? "stop" : "record-circle-outline"} size={22} color="#121417" /><Text style={styles.primaryText}>{recording ? "STOP RECORDING" : "START RECORDING"}</Text></Pressable>
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121417",
  },
  viewfinder: { ...StyleSheet.absoluteFillObject, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  horizon: { width: "100%", height: 1, backgroundColor: "rgba(255,107,0,0.20)" },
  gridLine: { position: "absolute", backgroundColor: "rgba(120,150,160,0.12)" },
  gridVerticalLeft: { width: 1, height: "100%", left: "25%" },
  gridVerticalRight: { width: 1, height: "100%", right: "25%" },
  gridHorizontalTop: { height: 1, width: "100%", top: "32%" },
  gridHorizontalBottom: { height: 1, width: "100%", bottom: "32%" },
  cornerTopLeft: { position: "absolute", top: "26%", left: 24, width: 24, height: 24, borderTopWidth: 2, borderLeftWidth: 2, borderColor: "#FF6B00" },
  cornerTopRight: { position: "absolute", top: "26%", right: 24, width: 24, height: 24, borderTopWidth: 2, borderRightWidth: 2, borderColor: "#FF6B00" },
  cornerBottomLeft: { position: "absolute", bottom: "26%", left: 24, width: 24, height: 24, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: "#FF6B00" },
  cornerBottomRight: { position: "absolute", bottom: "26%", right: 24, width: 24, height: 24, borderBottomWidth: 2, borderRightWidth: 2, borderColor: "#FF6B00" },
  cameraLabel: { color: "rgba(240,242,245,0.50)", fontSize: 12, letterSpacing: 2, fontWeight: "700" },
  cameraHint: { color: "rgba(154,160,166,0.8)", fontSize: 10, letterSpacing: 0.6, marginTop: 6, textAlign: "center", maxWidth: 250, lineHeight: 15 },
  cameraPrompt: { position: "absolute", top: "16%", alignItems: "center", paddingHorizontal: 24 },
  cameraButton: { marginTop: 12, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,107,0,0.5)", backgroundColor: "rgba(255,107,0,0.12)" },
  cameraButtonText: { color: "#FF9E40", fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  assist: { alignItems: "center", position: "absolute", top: "35%" },
  assistRing: { width: 96, height: 96, borderRadius: 48, borderWidth: 1, borderColor: "rgba(255,107,0,0.45)", backgroundColor: "rgba(255,107,0,0.10)", alignItems: "center", justifyContent: "center" },
  assistCaption: { color: "#FF6B00", fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginTop: 12 },
  assistDistance: { color: "#9AA0A6", fontSize: 10, letterSpacing: 1, marginTop: 5 },
  routeCanvas: { position: "absolute", top: "16%", right: "4%", width: ROUTE_W, height: ROUTE_H },
  dot: { position: "absolute", backgroundColor: "#FF6B00", shadowColor: "#FF6B00", shadowOpacity: 0.7, shadowRadius: 7 },
  floorMarker: { position: "absolute", flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(18,20,23,0.9)", borderWidth: 1, borderColor: "#FBBC04", borderRadius: 11, paddingHorizontal: 10, paddingVertical: 7 },
  floorMarkerIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: "#FBBC04", alignItems: "center", justifyContent: "center" },
  floorMarkerTitle: { color: "#FBBC04", fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  floorMarkerSub: { color: "#9AA0A6", fontSize: 8, fontWeight: "700", letterSpacing: 0.8, marginTop: 1 },
  startPin: { position: "absolute", flexDirection: "row", alignItems: "center", backgroundColor: "#FF6B00", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 6, gap: 4 },
  pinText: { color: "#121417", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  topHud: { position: "absolute", left: 18, right: 18, flexDirection: "row", alignItems: "center", gap: 10 },
  hudCard: { flex: 1, borderRadius: 12, overflow: "hidden", paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandMark: { width: 26, height: 26, borderRadius: 7, backgroundColor: "#FF6B00", alignItems: "center", justifyContent: "center" },
  brand: { color: "#F0F2F5", fontWeight: "900", fontSize: 17, letterSpacing: 2 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#9AA0A6" },
  statusDotActive: { backgroundColor: "#34A853" },
  statusText: { color: "#9AA0A6", fontSize: 10, fontWeight: "700", letterSpacing: 0.7 },
  iconButton: { width: 48, height: 48, borderRadius: 12, backgroundColor: "rgba(18,20,23,0.82)", borderWidth: 1, borderColor: "#2D323B", alignItems: "center", justifyContent: "center" },
  modeIntro: { position: "absolute", left: 18, right: 18, flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: "rgba(18,20,23,0.88)", borderWidth: 1, borderColor: "rgba(255,107,0,0.45)", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11 },
  modeIntroIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: "rgba(255,107,0,0.15)", alignItems: "center", justifyContent: "center" },
  modeIntroTextWrap: { flex: 1 },
  modeIntroName: { color: "#FF9E40", fontSize: 12, fontWeight: "900", letterSpacing: 1.4 },
  modeIntroDesc: { color: "#BDC1C6", fontSize: 11, lineHeight: 15, marginTop: 2 },
  bottomHud: { position: "absolute", left: 14, right: 14, bottom: 0 },
  controlCard: { borderRadius: 20, overflow: "hidden", padding: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
  controlHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 },
  eyebrow: { color: "#FF6B00", fontSize: 10, fontWeight: "800", letterSpacing: 1.4 },
  routeStatus: { color: "#F0F2F5", fontSize: 16, fontWeight: "700", marginTop: 5 },
  telemetry: { alignItems: "flex-end" },
  telemetryValue: { color: "#F0F2F5", fontSize: 18, fontWeight: "800" },
  telemetryLabel: { color: "#9AA0A6", fontSize: 9, letterSpacing: 1, marginTop: 3 },
  modeRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  modeButton: { flex: 1, minHeight: 46, borderRadius: 10, borderWidth: 1, borderColor: "#2D323B", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  modeButtonSelected: { borderColor: "#FF6B00", backgroundColor: "rgba(255,107,0,0.13)" },
  modeLabel: { color: "#9AA0A6", fontSize: 12, fontWeight: "700" },
  modeLabelSelected: { color: "#FF9E40" },
  primaryButton: { minHeight: 54, borderRadius: 12, backgroundColor: "#FF6B00", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 },
  stopButton: { backgroundColor: "#F0F2F5" },
  primaryText: { color: "#121417", fontSize: 14, fontWeight: "900", letterSpacing: 1.2 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
