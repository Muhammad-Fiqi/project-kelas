// Mock data perjalanan MULEH — langkah, belokan, dan ketinggian.
// Dipakai selama fase frontend; nanti diganti data IMU asli / API backend.

export type TurnDirection = "left" | "right";

export type MockTurn = {
  atStep: number; // langkah ke berapa belokan terjadi
  direction: TurnDirection;
  angleDeg: number; // besaran belokan
};

export type MockWaypoint = {
  step: number; // akumulasi langkah pada titik ini
  headingDeg: number; // arah hadap user (relatif manuver, bukan kompas)
  elevationM: number; // ketinggian relatif dari titik awal (meter)
  floor: number; // lantai relatif (0 = lantai titik awal)
};

// Rute tiruan: keluar dari parkiran basement, naik 1 lantai, beberapa belokan.
export const mockWaypoints: MockWaypoint[] = [
  { step: 0, headingDeg: 0, elevationM: 0, floor: 0 },
  { step: 24, headingDeg: 0, elevationM: 0, floor: 0 },
  { step: 38, headingDeg: 78, elevationM: 0, floor: 0 },
  { step: 62, headingDeg: 78, elevationM: 1.2, floor: 0 },
  { step: 80, headingDeg: 12, elevationM: 4.4, floor: 1 }, // naik eskalator
  { step: 104, headingDeg: 12, elevationM: 4.4, floor: 1 },
  { step: 121, headingDeg: -55, elevationM: 4.4, floor: 1 },
  { step: 150, headingDeg: -55, elevationM: 4.6, floor: 1 },
  { step: 168, headingDeg: 30, elevationM: 4.6, floor: 1 },
  { step: 196, headingDeg: 30, elevationM: 4.6, floor: 1 },
];

export const mockTurns: MockTurn[] = [
  { atStep: 38, direction: "right", angleDeg: 78 },
  { atStep: 80, direction: "left", angleDeg: 66 },
  { atStep: 121, direction: "left", angleDeg: 67 },
  { atStep: 168, direction: "right", angleDeg: 85 },
];

export type MockFloorChange = {
  atStep: number;
  fromFloor: number;
  toFloor: number;
  via: "eskalator" | "tangga" | "lift";
};

// Perpindahan lantai pada rute tiruan (naik eskalator dari basement ke LT. 1).
export const mockFloorChanges: MockFloorChange[] = [
  { atStep: 80, fromFloor: 0, toFloor: 1, via: "eskalator" },
];

const STEPS_PER_SECOND = 1.7; // kecepatan jalan rata-rata

// ---------- Proyeksi rute pulang ke layar (2D normalized) ----------

export type RoutePoint2D = { x: number; y: number; progress: number };
export type RouteArrow2D = { x: number; y: number; angleDeg: number; progress: number };

export type RoutePath2D = {
  points: RoutePoint2D[]; // titik-titik jejak, urut dari posisi user (progress 0) ke titik awal (progress 1)
  arrows: RouteArrow2D[]; // panah per segmen sesuai arah manuver
  startAnchor: { x: number; y: number }; // posisi pin titik awal
  floorAnchors: { x: number; y: number; changeIndex: number }[]; // posisi penanda pindah lantai
};

function headingToVector(headingDeg: number) {
  const rad = (headingDeg * Math.PI) / 180;
  return { dx: Math.sin(rad), dy: -Math.cos(rad) };
}

// Susun polyline dead-reckoning dari waypoint, lalu normalisasi ke kotak 0..1.
// Rute "pulang" = jalur direkam dibalik: user (akhir rekaman) -> titik awal.
export function buildRoutePath(dotEveryStep = 16): RoutePath2D {
  // 1) posisi tiap waypoint
  const positions: { x: number; y: number; step: number }[] = [
    { x: 0, y: 0, step: mockWaypoints[0].step },
  ];
  for (let i = 0; i < mockWaypoints.length - 1; i += 1) {
    const seg = mockWaypoints[i + 1].step - mockWaypoints[i].step;
    const { dx, dy } = headingToVector(mockWaypoints[i].headingDeg);
    const prev = positions[i];
    positions.push({ x: prev.x + dx * seg, y: prev.y + dy * seg, step: mockWaypoints[i + 1].step });
  }

  // 2) normalisasi bounding box -> 0..1 (dengan padding)
  const xs = positions.map((p) => p.x);
  const ys = positions.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const pad = 0.08;
  // sumbu-y dibalik: pin titik awal tampil jauh di atas, posisi user di bawah layar
  const norm = (p: { x: number; y: number }) => ({
    x: pad + ((p.x - minX) / spanX) * (1 - pad * 2),
    y: 1 - (pad + ((p.y - minY) / spanY) * (1 - pad * 2)),
  });

  const totalSteps = mockWaypoints[mockWaypoints.length - 1].step;
  const atStep = (step: number) => {
    for (let i = 0; i < positions.length - 1; i += 1) {
      if (step >= positions[i].step && step <= positions[i + 1].step) {
        const span = Math.max(positions[i + 1].step - positions[i].step, 1);
        const t = (step - positions[i].step) / span;
        return {
          x: positions[i].x + (positions[i + 1].x - positions[i].x) * t,
          y: positions[i].y + (positions[i + 1].y - positions[i].y) * t,
        };
      }
    }
    return positions[positions.length - 1];
  };

  // 3) titik jejak setiap `dotEveryStep` langkah; progress 0 = posisi user, 1 = titik awal
  const points: RoutePoint2D[] = [];
  for (let step = totalSteps; step >= 0; step -= dotEveryStep) {
    const p = norm(atStep(step));
    points.push({ ...p, progress: (totalSteps - step) / totalSteps });
  }

  // 4) panah di tengah tiap segmen; arah = kebalikan heading rekaman (arah pulang)
  const arrows: RouteArrow2D[] = [];
  for (let i = 0; i < mockWaypoints.length - 1; i += 1) {
    const midStep = (mockWaypoints[i].step + mockWaypoints[i + 1].step) / 2;
    const p = norm(atStep(midStep));
    arrows.push({
      ...p,
      // arah pulang di layar: sumbu-y dibalik sehingga sudutnya = -heading rekaman
      angleDeg: -mockWaypoints[i].headingDeg,
      progress: (totalSteps - midStep) / totalSteps,
    });
  }
  arrows.reverse();

  const startAnchor = norm(positions[0]);
  const floorAnchors = mockFloorChanges.map((change, changeIndex) => ({
    ...norm(atStep(change.atStep)),
    changeIndex,
  }));

  return { points, arrows, startAnchor, floorAnchors };
}

export const mockRouteSummary = {
  totalSteps: mockWaypoints[mockWaypoints.length - 1].step,
  totalTurns: mockTurns.length,
  elevationGainM: mockWaypoints[mockWaypoints.length - 1].elevationM,
};

export type LiveTelemetry = {
  steps: number;
  turns: number;
  elevationM: number;
  floor: number;
  headingDeg: number;
};

// Simulasi telemetri live yang deterministik dari detik berjalan.
export function simulateTelemetry(elapsedSec: number): LiveTelemetry {
  const steps = Math.floor(elapsedSec * STEPS_PER_SECOND);
  const maxStep = mockWaypoints[mockWaypoints.length - 1].step;
  const clamped = Math.min(steps, maxStep);

  // cari segmen waypoint aktif
  let current = mockWaypoints[0];
  let next = mockWaypoints[mockWaypoints.length - 1];
  for (let i = 0; i < mockWaypoints.length - 1; i += 1) {
    if (clamped >= mockWaypoints[i].step && clamped <= mockWaypoints[i + 1].step) {
      current = mockWaypoints[i];
      next = mockWaypoints[i + 1];
      break;
    }
  }
  const span = Math.max(next.step - current.step, 1);
  const ratio = (clamped - current.step) / span;
  const elevationM = current.elevationM + (next.elevationM - current.elevationM) * ratio;

  return {
    steps,
    turns: mockTurns.filter((turn) => turn.atStep <= clamped).length,
    elevationM: Math.round(elevationM * 10) / 10,
    floor: ratio > 0.5 ? next.floor : current.floor,
    headingDeg: ratio > 0.5 ? next.headingDeg : current.headingDeg,
  };
}
