// Riwayat rute tersimpan (mock) — nanti diganti data dari backend.

export type SavedRoute = {
  id: string;
  name: string;
  savedAt: number; // epoch ms
  durationSec: number;
  steps: number;
  turns: number;
  elevationM: number;
  floors: number; // jumlah perpindahan lantai
};

export const mockSavedRoutes: SavedRoute[] = [
  {
    id: "route-1",
    name: "Parkiran Mall Grand Indonesia",
    savedAt: Date.now() - 5 * 60 * 60 * 1000,
    durationSec: 372,
    steps: 196,
    turns: 4,
    elevationM: 4.6,
    floors: 1,
  },
  {
    id: "route-2",
    name: "Basement Central Park",
    savedAt: Date.now() - 26 * 60 * 60 * 1000,
    durationSec: 251,
    steps: 143,
    turns: 3,
    elevationM: 3.2,
    floors: 1,
  },
  {
    id: "route-3",
    name: "Jalur Hutan Sentul",
    savedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    durationSec: 1240,
    steps: 1810,
    turns: 11,
    elevationM: 36.5,
    floors: 0,
  },
];

export function formatSavedAt(savedAt: number, now: number = Date.now()) {
  const diffH = Math.floor((now - savedAt) / (60 * 60 * 1000));
  if (diffH < 1) return "Baru saja";
  if (diffH < 24) return `${diffH} jam lalu`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD} hari lalu`;
}
