# MULEH — PRD & Progress

## Ringkasan Produk
Aplikasi mobile "MULEH" — navigasi AR offline untuk kembali ke titik awal (parkiran mall / hutan). User set start lokasi, aplikasi merekam rute (track points), lalu user melihat jalan pulang lewat kamera AR dengan 3 mode tampilan: (1) rute dot + pin finish, (2) rute panah sesuai manuver + pin finish, (3) pin finish saja. Ada UI assist arah panah. Rencana: trial 3 hari + payment gateway ala Play Store (fase mendatang).

## Workflow Wajib
- Dikendalikan CLI `npx ngodingpakeai` (plan ID: `c58e486b-165f-431e-9d72-7ca7fa7ec3f8`).
- Loop: `task next` → `task start <ref>` → kerjakan → `task complete <ref>`.
- **STOP di setiap checkpoint** (pergantian layer frontend↔backend atau kenaikan phase) dan tunggu user bilang "lanjut".
- Komunikasi dengan user dalam Bahasa Indonesia.

## Tech Stack
- Frontend: Expo React Native (expo-router), dark-tactical UI (design_guidelines.json)
- Backend: FastAPI + MongoDB (Motor)

## Progress
### Fase 1 — Frontend (SELESAI, diverifikasi user)
- Halaman utama navigasi AR + kamera placeholder
- Mode Rute Titik (dots), Rute Panah (arrows), Pin Titik Awal — mock data
- Komponen Bantuan Arah di semua mode
- Kontrol perpindahan mode

### Fase 1 — Backend (SELESAI, tes 17/17 lulus — iteration_2.json)
- Skema DB: `navigation_sessions` & `track_points` (Pydantic models + index Mongo)
- `POST /api/sessions` — buat sesi (status "recording", point_count=0)
- `POST /api/sessions/{id}/points` — tambah 1 titik (sequence auto, 404/400 handling)
- `POST /api/sessions/{id}/points/batch` — tambah banyak titik sekaligus
- `GET /api/sessions/{id}/route` — ambil rute lengkap {session, start_point, points[] terurut}

### Berikutnya — Semua task selesai ✅
- Phase 1 Frontend: navigasi AR + 3 mode tampilan + UI assist
- Phase 1 Backend: sessions, track points, sensor readings, route builder
- Phase 2 Frontend: halaman utama, recording, history, route detail, AsyncStorage
- Phase 3 Backend: trial 3 hari, lisensi, Google Play Billing, autentikasi akun
- Phase 4 Frontend: halaman lisensi, gating fitur, auto-refresh, API service, purchase hook

## Skema DB
- `navigation_sessions`: {id (uuid), name?, status: recording|completed, start_point {latitude, longitude, altitude?, accuracy?}, point_count, started_at, ended_at?}
- `track_points`: {id, session_id, sequence, latitude, longitude, altitude?, accuracy?, heading?, recorded_at}
- Index: sessions(started_at desc, status), track_points(session_id+sequence)

## Catatan / Saran non-blocking dari testing agent
- Belum ada endpoint untuk menyelesaikan sesi (status → completed) — kemungkinan task fase berikutnya
- Pertimbangkan bounds validasi lat/lon, migrasi @app.on_event → lifespan, cap .to_list(10000)

## File Referensi
- `/app/backend/server.py` — semua model + API
- `/app/frontend/app/index.tsx` — UI AR HUD (masih mock data)
- `/app/AGENTS.md` — aturan CLI
- `/app/backend/tests/test_navigation_api.py` — test suite backend
