import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type ArMode = "DOTS" | "ARROWS" | "PIN";

const modes: { id: ArMode; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { id: "DOTS", label: "Dots", icon: "dots-hexagon" },
  { id: "ARROWS", label: "Arrows", icon: "arrow-up-bold" },
  { id: "PIN", label: "Pin", icon: "map-marker" },
];

const mockRoutePoints = [
  { top: 0, left: 0, size: 8 },
  { top: 34, left: 20, size: 7 },
  { top: 68, left: 42, size: 7 },
  { top: 102, left: 66, size: 6 },
  { top: 136, left: 88, size: 6 },
];
const mockRouteArrows = [
  { top: 12, left: 8, rotation: "-18deg" },
  { top: 58, left: 42, rotation: "18deg" },
  { top: 104, left: 76, rotation: "-8deg" },
];

export default function Index() {
  const insets = useSafeAreaInsets();
  const [recording, setRecording] = useState(false);
  const [mode, setMode] = useState<ArMode>("DOTS");
  const pulse = useRef(new Animated.Value(1)).current;

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

  const toggleRecording = () => setRecording((current) => !current);

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#10161A", "#0D1114", "#121417"]} style={StyleSheet.absoluteFill} />
      <View style={styles.viewfinder}>
        <View style={styles.horizon} />
        <View style={[styles.gridLine, styles.gridVerticalLeft]} />
        <View style={[styles.gridLine, styles.gridVerticalRight]} />
        <View style={[styles.gridLine, styles.gridHorizontalTop]} />
        <View style={[styles.gridLine, styles.gridHorizontalBottom]} />
        <View style={styles.cornerTopLeft} />
        <View style={styles.cornerTopRight} />
        <View style={styles.cornerBottomLeft} />
        <View style={styles.cornerBottomRight} />
        <Text style={styles.cameraLabel}>CAMERA VIEWFINDER</Text>
        <Text style={styles.cameraHint}>AR PREVIEW · OFFLINE MODE</Text>

        <Animated.View testID="direction-assist" style={[styles.assist, { transform: [{ scale: pulse }] }]}>
          <View style={styles.assistRing}>
            <MaterialCommunityIcons name="navigation-variant" size={42} color="#FF6B00" />
          </View>
          <Text style={styles.assistCaption}>AIM THIS WAY</Text>
          <Text style={styles.assistDistance}>RETURN HEADING · 42°</Text>
        </Animated.View>

        {mode === "DOTS" && <View style={styles.routeDots}>{mockRoutePoints.map((point, index) => <View key={`route-point-${index}`} style={[styles.dot, { top: point.top, left: point.left, width: point.size, height: point.size, borderRadius: point.size / 2 }]} />)}</View>}
        {mode === "ARROWS" && <View style={styles.routeArrows}>{mockRouteArrows.map((arrow, index) => <MaterialCommunityIcons key={`route-arrow-${index}`} name="arrow-up-bold" size={index === 1 ? 38 : 30} color="#FF6B00" style={{ position: "absolute", top: arrow.top, left: arrow.left, transform: [{ rotate: arrow.rotation }] }} />)}</View>}
        {mode === "PIN" && <MaterialCommunityIcons name="map-marker" size={62} color="#FF6B00" style={styles.routePin} />}
        {mode !== "PIN" && <View style={styles.startPin}><MaterialCommunityIcons name="map-marker" size={22} color="#121417" /><Text style={styles.pinText}>START</Text></View>}
      </View>

      <View style={[styles.topHud, { top: insets.top + 12 }]}>
        <BlurView intensity={35} tint="dark" style={styles.hudCard}>
          <View style={styles.brandRow}><View style={styles.brandMark}><MaterialCommunityIcons name="navigation" size={17} color="#121417" /></View><Text style={styles.brand}>MULEH</Text></View>
          <View style={styles.statusRow}><View style={[styles.statusDot, recording && styles.statusDotActive]} /><Text style={styles.statusText}>{recording ? "TRACKING ACTIVE" : "READY TO TRACK"}</Text></View>
        </BlurView>
        <View style={styles.iconButton}><MaterialCommunityIcons name="cog-outline" size={23} color="#F0F2F5" /></View>
      </View>

      <View style={[styles.bottomHud, { paddingBottom: Math.max(insets.bottom, 18) }]}>
        <BlurView intensity={45} tint="dark" style={styles.controlCard}>
          <View style={styles.controlHeader}><View><Text style={styles.eyebrow}>RETURN ROUTE</Text><Text style={styles.routeStatus}>{recording ? "Recording your path" : "No active route recorded"}</Text></View><View style={styles.telemetry}><Text style={styles.telemetryValue}>{recording ? "00:14" : "--:--"}</Text><Text style={styles.telemetryLabel}>DURATION</Text></View></View>
          <View style={styles.modeRow}>{modes.map((item) => <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === item.id }} accessibilityLabel={`AR mode ${item.label}`} testID={`ar-mode-${item.id.toLowerCase()}`} key={item.id} onPress={() => setMode(item.id)} style={({ pressed }) => [styles.modeButton, mode === item.id && styles.modeButtonSelected, pressed && styles.pressed]}><MaterialCommunityIcons name={item.icon} size={18} color={mode === item.id ? "#FF6B00" : "#9AA0A6"} /><Text style={[styles.modeLabel, mode === item.id && styles.modeLabelSelected]}>{item.label}</Text></Pressable>)}</View>
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
  cameraLabel: { position: "absolute", top: "28%", color: "rgba(240,242,245,0.50)", fontSize: 12, letterSpacing: 2, fontWeight: "700" },
  cameraHint: { position: "absolute", top: "31%", color: "rgba(154,160,166,0.7)", fontSize: 10, letterSpacing: 1.5 },
  assist: { alignItems: "center", position: "absolute", top: "35%" },
  assistRing: { width: 96, height: 96, borderRadius: 48, borderWidth: 1, borderColor: "rgba(255,107,0,0.45)", backgroundColor: "rgba(255,107,0,0.10)", alignItems: "center", justifyContent: "center" },
  assistCaption: { color: "#FF6B00", fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginTop: 12 },
  assistDistance: { color: "#9AA0A6", fontSize: 10, letterSpacing: 1, marginTop: 5 },
  routeDots: { position: "absolute", top: "42%", right: "24%" },
  dot: { position: "absolute", width: 8, height: 8, borderRadius: 4, backgroundColor: "#FF6B00", shadowColor: "#FF6B00", shadowOpacity: 0.7, shadowRadius: 7 },
  routeArrows: { position: "absolute", top: "43%", right: "18%", width: 120, height: 150 },
  routeArrow: { position: "absolute", top: "47%", right: "18%" },
  routePin: { position: "absolute", top: "42%", right: "22%" },
  startPin: { position: "absolute", top: "61%", left: "38%", flexDirection: "row", alignItems: "center", backgroundColor: "#FF6B00", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 6, gap: 4 },
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
