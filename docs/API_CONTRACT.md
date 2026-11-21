# API CONTRACT — FileMate

Base URL: `/api` (pengembangan: `http://127.0.0.1:5000/api`).
Semua body request & respons berformat JSON (`Content-Type: application/json`), kecuali unduhan CSV.
Body request maksimal **16 KB** (lebih dari itu → `413`).

Kontrak ini berlaku **sama persis** untuk kedua server:

| Server | Cara jalan | Penyimpanan |
|--------|-----------|-------------|
| `app.py` (root) | `python app.py` | `data/hasil.csv`, `data/feedback_user.csv` |
| `backend/` | `python backend/wsgi.py` / gunicorn | `data/filemate.db` (SQLite) |

Kesamaan jawaban kedua server untuk endpoint yang dipakai frontend diuji otomatis di
`tests/test_sinkron_frontend.py`. *(Diperbarui 21/11/2026.)*

---

## 1. Format Respons Standar

Didefinisikan di `backend/app/common/responses.py`.

```json
// Sukses
{ "status": "ok", "data": { ... } }

// Gagal
{ "status": "error", "message": "Pesan yang aman ditampilkan ke pengguna." }
```

Pengecualian: `GET /api/leaderboard` (array langsung) dan `GET /api/dashboard-stats` (objek langsung),
karena frontend membacanya apa adanya.

| Kode | Arti |
|------|------|
| 200  | Berhasil |
| 201  | Data baru dibuat (sesi, skor, feedback) |
| 400  | Input tidak valid |
| 401  | Belum login admin / password salah |
| 404  | Endpoint, sesi, file, atau skenario tidak ditemukan |
| 405  | Metode HTTP salah |
| 409  | Data sudah dikunci / sudah dikirim / password admin sudah/belum dibuat |
| 413  | Body terlalu besar |
| 423  | Login admin ditutup, wajib password cadangan |
| 429  | Terlalu banyak percobaan / kiriman |
| 500  | Error server (detail hanya di log server) |
| 503  | Server penuh (sesi) / utilitas Linux gagal / password cadangan belum diatur |

---

## 2. Ringkasan Endpoint

Kolom **Frontend** = dipanggil oleh `tampilan/js/` versi saat ini.

| Metode | Path | Modul (`backend/`) | Auth | Frontend |
|--------|------|--------------------|------|----------|
| GET    | `/api/dashboard-stats` | leaderboard | – | ✅ `common.js` |
| GET    | `/api/leaderboard?limit=<n>` | leaderboard | – | ✅ `leaderboard.js` |
| POST   | `/api/submit-score` | leaderboard | – | ✅ `result.js` |
| POST   | `/api/submit-feedback` | feedback | – | ✅ `result.js` |
| POST   | `/api/session/start` | simulation | – | – |
| POST   | `/api/session/<sid>/decide` | simulation | sid | – |
| POST   | `/api/session/<sid>/hint` | simulation | sid | – |
| POST   | `/api/session/<sid>/finish` | simulation | sid | – |
| GET    | `/api/session/<sid>/result` | simulation | sid | – |
| POST   | `/api/session/<sid>/save` | simulation | sid | – |
| POST   | `/api/session/<sid>/feedback` | simulation | sid | – |
| GET    | `/api/inspect?file=<nama>` | simulation | – | – |
| GET    | `/api/hash?file=<nama>` | simulation | – | – |
| GET    | `/api/admin/status` | admin | – | – |
| POST   | `/api/admin/setup` | admin | – | – |
| POST   | `/api/admin/login` | admin | – | – |
| POST   | `/api/admin/recovery` | admin | – | – |
| POST   | `/api/admin/reset` | admin | – | – |
| POST   | `/api/admin/logout` | admin | – | – |
| GET    | `/api/admin/feedback?limit=<n>` | admin | admin | – |
| GET    | `/api/admin/export/<scores\|feedback>` | admin | admin | – |
| POST   | `/api/admin/clear/<scores\|feedback>` | admin | admin | – |

> Frontend saat ini menghitung skor di browser (`game.js` + `SCENARIO_BANK`) lalu mengirimnya lewat
> `/api/submit-*`. Endpoint `/api/session/*` (skor dihitung server) dan `/api/admin/*` sudah siap,
> tetapi belum dipakai frontend. Menu Satgas di `admin.js` masih memakai PIN & `localStorage`
> (lihat SECURITY.md K-01).
>
> Endpoint lama yang **sudah dihapus**: `GET /api/start-session` (mengirim kunci jawaban) dan
> `POST /api/feedback`.

---

## 3. Endpoint yang Dipakai Frontend

### 3.1 `GET /api/dashboard-stats`
Dipakai `renderDashboardStats()` di `common.js`. Jika server mati, frontend memakai hitungan lokal.

**Respons `200`** — *objek langsung*
```json
{
  "total_skenario": 4,
  "total_file": 19,
  "total_malware": 9,
  "total_aman": 10,
  "kategori": {
    "SPOOFING": { "skenario": 2, "file": 6,  "malware": 3 },
    "HASH":     { "skenario": 1, "file": 3,  "malware": 1 },
    "FATIGUE":  { "skenario": 1, "file": 10, "malware": 5 }
  },
  "total_sesi": 5,
  "rata_rata_skor": 69,
  "sebaran_risiko": { "RENDAH": 3, "SEDANG": 1, "TINGGI": 1 }
}
```
Field yang dibaca frontend: `total_skenario`, `total_file`, `total_malware`, `total_aman`,
`total_sesi`, `rata_rata_skor`.

### 3.2 `GET /api/leaderboard?limit=6`
Dipakai `renderHomeLeaderboard()` di `leaderboard.js`. `limit` 1–50 (bawaan 6; nilai tidak valid → 6).
Urut skor tertinggi, lalu waktu tercepat, lalu yang lebih dulu masuk.

**Respons `200`** — *array langsung*
```json
[
  { "name": "R****T", "score": 95, "time": "01:12", "risk": "RENDAH" },
  { "name": "F****N", "score": 90, "time": "01:28", "risk": "RENDAH" }
]
```
Array kosong → frontend menampilkan data cadangan lokal.

### 3.3 `POST /api/submit-score`
Dikirim otomatis oleh `autoRecordAgentScore()` di `result.js` setelah simulasi selesai.

**Request** (persis seperti `result.js`)
```json
{ "username": "Rohit", "score": 85, "time": "01:45" }
```
| Field | Aturan (validasi di `backend/app/common/kiriman.py`) |
|-------|--------|
| `username` | nama asli; disensor server → `R****T` (kosong → `A****M`). Nama asli tidak disimpan |
| `score` | **int** 0–100 dan kelipatan 5 (semua penalti −15/−5/−5). `"85"`, `85.0`, `true` ditolak |
| `time` | `MM:SS` (menit 1–3 digit, detik 00–59) |

Kategori risiko **dihitung server** dari skor (≤50 TINGGI, 51–80 SEDANG, >80 RENDAH).

**Respons `201`**
```json
{ "status": "ok", "data": { "masked_name": "R****T", "score": 85, "time": "01:45", "risk_category": "RENDAH" } }
```
**Error**
```json
// 400
{ "status": "error", "message": "Skor tidak valid." }
{ "status": "error", "message": "Format waktu harus MM:SS." }
// 429 — melewati SUBMIT_BATAS_PER_IP kiriman per SUBMIT_JENDELA_DETIK (bawaan 5 / 10 menit)
{ "status": "error", "message": "Terlalu banyak kiriman skor. Coba lagi nanti." }
```

### 3.4 `POST /api/submit-feedback`
Dikirim oleh `submitUserFeedback()` di `result.js`.

**Request** (persis seperti `result.js`)
```json
{ "user": "R****T", "score": 85, "message": "Simulasinya membantu!" }
```
| Field | Aturan |
|-------|--------|
| `user` | inisial dari browser; disensor ulang (idempoten: `R****T` / `A****` tidak berubah) |
| `score` | aturan sama dengan `/submit-score` |
| `message` | wajib; `< >` dibuang; maks 300 karakter; diberi `'` bila diawali `= + - @ TAB CR` |

**Respons `201`**
```json
{ "status": "ok", "data": { "saved": true, "kode_responden": "P01" } }
```
**Error:** `400` (`"Skor tidak valid."`, `"Pesan masukan tidak boleh kosong."`),
`429` (`"Terlalu banyak kiriman masukan. Coba lagi nanti."`). Batas skor & feedback dihitung terpisah.

> Kedua endpoint menerima skor dari browser, jadi masih bisa dipalsukan dalam batas validasi
> (SECURITY.md K-03). Ganti ke `/api/session/*` setelah frontend dimigrasikan.

---

## 4. Simulasi Berbasis Sesi (siap, belum dipakai frontend)

Skor dihitung server; kunci jawaban tidak pernah dikirim sebelum pemain memutuskan.
Logika di `backend/app/simulation/service.py` (dipakai juga oleh `app.py`).
State sesi disimpan di memori: TTL 1 jam, maks 500 sesi aktif.

### 4.1 `POST /api/session/start`
Body boleh kosong (`backend/` juga menerima `{ "username": "..." }`, tidak wajib).

**Respons `201`**
```json
{
  "status": "ok",
  "data": {
    "session_id": "q3Zt1kX0d9...",
    "current_score": 100,
    "scenarios": [
      {
        "id": "hash_forum_01", "type": "HASH", "title": "...", "story": "...",
        "path": "~/Downloads/Forum_Installer/", "hintAuthor": "Kaysan Nawfal (Backend & Scoring Logic)",
        "files": [
          { "id": "hs1_f1", "shownName": "Patch_Update_v2.zip", "realName": "Patch_Update_v2.zip",
            "fakeExt": null, "realExt": ".zip", "mime": "application/zip",
            "magicBytes": "50 4B 03 04 (ZIP Archive)", "perm": "-rw-r--r--", "size": "14.2 MB",
            "hash": "e3b0c442...", "expectedHash": "e3b0c442..." }
        ]
      }
    ]
  }
}
```
Field yang **dihapus** dari versi publik: `isMalware`, `payloadStatus` (file); `hintText`,
`goodEnding`, `badEnding`, `lessonTitle`, `lessonBody`, `realLifeTip` (skenario).
**Error:** `503` jika sesi aktif mencapai 500.

### 4.2 `POST /api/session/<sid>/decide`
**Request** `{ "file_id": "ft6", "action": "delete", "inspected": true }` — `action` ∈ `open` | `delete`.
`inspected: false` dihitung sebagai keputusan impulsif.

**Respons `200`**
```json
{
  "status": "ok",
  "data": {
    "file_id": "ft6", "action": "delete", "correct": true, "is_malware": true,
    "outcome": "safe", "payload_status": "Malicious System Deleter",
    "current_score": 100, "scenario_done": false
  }
}
```
Jika `scenario_done: true`, ditambah `ending_type` (`good`/`bad`), `ending`, `lesson_title`,
`lesson_body`, `real_life_tip`.

| `outcome` | Arti |
|-----------|------|
| `safe` | Keputusan benar |
| `malware_opened` | Membuka file berbahaya (−15) |
| `false_alarm` | Menghapus file aman (−5) |

**Error:** `400` aksi tidak valid, `404` sesi/file tidak ada, `409` keputusan sudah dikunci.

### 4.3 `POST /api/session/<sid>/hint`
**Request** `{ "scenario_id": "fatigue_usb_01" }` — penalti −5 **sekali per skenario**.
**Respons `200`** `{ "scenario_id", "hint_author", "hint_text", "hints_used", "current_score" }`.

### 4.4 `POST /api/session/<sid>/finish`
Menghitung skor akhir (file yang belum diputuskan dianggap `open`). **Belum** menyimpan ke leaderboard.
**Respons `200`** `{ score, risk_category, time, seconds, malware_opened, false_alarm, hints_used,
mistakes: {SPOOFING, HASH, FATIGUE, IMPULSIVE}, history: [...], scenarios: [...] }`.

### 4.5 `GET /api/session/<sid>/result`
Hasil `/finish` + `saved`, `masked_name`, `feedback_sent`. Kedaluwarsa 1 jam setelah selesai (`404`).

### 4.6 `POST /api/session/<sid>/save`
**Request** `{ "username": "Rohit" }` → simpan **1x** ke leaderboard dengan skor dari server.
**Respons `201`** `{ masked_name, score, time, risk_category }`; kedua kali `409`.

### 4.7 `POST /api/session/<sid>/feedback`
**Request** `{ "message": "..." }` — inisial & skor diambil dari sesi. **1x** per sesi (`409`).
**Respons `201`** `{ "saved": true, "kode_responden": "P01" }`.

---

## 5. Utilitas Linux

Dijalankan terhadap file di `data/dummy_files/` saja.

### 5.1 `GET /api/inspect?file=<nama>`
**Respons `200`**
```json
{
  "status": "ok",
  "data": {
    "file": "Patch_Update_v2.zip",
    "mime_linux": "application/zip",
    "permission_linux": "-rw-r--r--",
    "bisa_dieksekusi": false,
    "engine": "Linux CLI (file --mime-type & ls -l)"
  }
}
```

### 5.2 `GET /api/hash?file=<nama>`
**Respons `200`** `{ "file", "sha256", "engine": "Linux CLI (sha256sum)" }`

### 5.3 Perbedaan implementasi kedua server

| | `app.py` → `core/linux_utils.py` | `backend/` → `backend/app/simulation/linux_utils.py` |
|---|---|---|
| Nama berisi `/` atau `\` | ditolak `400 "Nama file tidak valid."` | diambil `basename()` saja, lalu dicek |
| Argumen `--` sebelum path | ya | tidak |
| Perintah Linux gagal | `503` (pesan aman, tanpa detail server) | diam-diam pakai fallback Python |
| Non-Linux (Windows) | fallback berlabel `"... (fallback non-Linux)"`, `mime_linux: null` | coba perintah dulu, fallback `"... (Fallback)"`, MIME `application/octet-stream` |
| Field `bisa_dieksekusi` | ada | tidak ada |

Kedua endpoint tidak dipakai frontend saat ini. `core/linux_utils.py` adalah versi yang diuji
(`tests/test_linux_utils.py`).

**Error:** `400` nama ditolak / file tidak ada (`"File dummy 'x' tidak ditemukan."`), `503` perintah gagal.

---

## 6. Admin (Maintainer)

Logika di `core/admin_auth.py`, dipakai kedua server. Frontend mengirim **SHA-256(password)**, bukan
password asli; server menyimpan PBKDF2-SHA256 (200.000 iterasi + salt) di `data/admin_password.json`.
Login berhasil → cookie sesi `is_admin` (`HttpOnly`, `SameSite=Strict`), berakhir setelah 30 menit
tidak aktif atau 8 jam sejak login.

Selama penundaan aktif, **semua** `/api/admin/*` menjawab `429` (+ header `Retry-After`).

| Endpoint | Request | Respons utama |
|----------|---------|---------------|
| `GET /status` | – | `200 { has_password, has_recovery, retry_after, require_recovery, failed_attempts, lock_scope }` |
| `POST /setup` | `{ password_hash }` | `200 { logged_in: true }`; `409` sudah ada; `400` format hash |
| `POST /login` | `{ password_hash }` | `200 { logged_in: true }`; `401` salah; `429` ditunda; `423` wajib cadangan; `409` belum dibuat |
| `POST /recovery` | `{ recovery_hash }` | `200 { valid: true }`; `401`; `429`; `503` cadangan belum diatur |
| `POST /reset` | `{ recovery_hash, new_password_hash }` | `200 { logged_in: true }`; `400`; `401`; `429`; `503` |
| `POST /logout` | – | `200 { logged_in: false }` |
| `GET /feedback?limit=100` | – | `200 [ { kode_responden, inisial_anonim, skor, waktu_input, pesan } ]` (terbaru dulu, limit 1–1000) |
| `GET /export/<scores\|feedback>` | – | file CSV UTF-8 + BOM; jenis lain `404` |
| `POST /clear/<scores\|feedback>` | – | `200 { cleared, deleted }`; jenis lain `404` |

Tanpa login, `feedback` / `export` / `clear` → `401 "Sesi admin berakhir atau belum login. Silakan login lagi."`

| Ekspor | Nama file | Kolom |
|--------|-----------|-------|
| `scores` | `hasil.csv` | `nama_anonim, skor, waktu, kategori_risiko` (+ `dibuat` di `backend/`) |
| `feedback` | `feedback_user.csv` | `kode_responden, inisial_anonim, skor, waktu_input, saran_dan_masukan` |

---

## 7. Contoh Pemakaian di Frontend (versi saat ini)

```js
// tampilan/js/api.js -> apiFetchJSON(url, options) mengembalikan null bila gagal
await apiFetchJSON('/api/submit-score', {
    method: 'POST',
    body: JSON.stringify({ username: 'Rohit', score: 85, time: '01:45' })
});
const lb = await apiFetchJSON('/api/leaderboard');      // array
const st = await apiFetchJSON('/api/dashboard-stats');  // objek
```
