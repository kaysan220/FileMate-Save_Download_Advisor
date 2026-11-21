# ARCHITECTURE — FileMate (Save Download Advisor)

Dokumen ini menjelaskan gambaran sistem FileMate: komponen, alur data, dan struktur folder.
*(Diperbarui 21/11/2026 — menggambarkan kode yang ada sekarang.)*
Rujukan lain: [`Arsitektur_Filemate_v1.0.md`](../Arsitektur_Filemate_v1.0.md) (kegunaan tiap file),
[`Arsitektur_File_Folder.md`](../Arsitektur_File_Folder.md) (rencana & progres).

---

## 1. Gambaran Singkat

FileMate adalah web edukasi keamanan siber berbentuk **lab simulasi**. Pengguna diberi
3 skenario acak (SPOOFING, HASH, FATIGUE) berisi daftar file "unduhan" dummy. Untuk setiap
file, pengguna memutuskan **buka** atau **hapus** setelah memeriksa ekstensi asli, magic bytes,
permission, dan hash SHA-256. Skor masuk ke papan peringkat anonim.

| Lapisan    | Teknologi                          | Tugas utama                                            |
|------------|------------------------------------|--------------------------------------------------------|
| Frontend   | HTML + CSS + JavaScript (vanilla)  | Tampilan, lab simulasi, scanner lokal, hasil & feedback|
| Backend    | Python 3.10+ / Flask 3 — **dua server** dengan API yang sama | API JSON, validasi skor, leaderboard, admin |
| Penyimpanan| CSV (`app.py`) atau SQLite (`backend/`) | Skor & feedback                                 |
| Utilitas OS| `sha256sum`, `file`, `ls -l`       | Inspeksi file dummy (fallback Python di Windows)       |
| Produksi   | Nginx + Gunicorn + systemd, Cloudflare | Reverse proxy, rate limit, jalankan Flask          |

---

## 2. Diagram Komponen

```
┌──────────────────────────────── Browser ────────────────────────────────┐
│ page/*.html + tampilan/js/*.js + tampilan/css/*.css                     │
│  game.js        → menilai jawaban dari SCENARIO_BANK (scenario_data.js) │
│  result.js      → POST /api/submit-score, /api/submit-feedback          │
│  leaderboard.js → GET /api/leaderboard                                  │
│  common.js      → GET /api/dashboard-stats                              │
│  inspector.js   → scanner lokal (file TIDAK diunggah)                   │
│  admin.js       → menu Satgas lokal (PIN + localStorage)                │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ fetch JSON (api.js → apiFetchJSON, null bila gagal)
                ┌───────────────▼──────────────┐
                │   (produksi) Nginx           │ limit_req, real_ip, proxy ke :5000
                └───────────────┬──────────────┘
                                │   — jalankan SALAH SATU server —
        ┌───────────────────────┴────────────────────────────┐
        ▼                                                    ▼
┌─────────────── app.py (CSV) ──────────────┐   ┌──────── backend/ (SQLite) ─────────────┐
│ rute di satu file                         │   │ wsgi.py → create_app()                  │
│ core/algorithms.py  CSV, skor, dashboard  │   │ leaderboard/ feedback/ simulation/      │
│ core/admin_data.py  menu admin (CSV)      │   │ admin/ scoring/ common/ db.py config.py │
│ core/linux_utils.py utilitas Linux        │   │ simulation/linux_utils.py               │
└──────────┬────────────────────────────────┘   └────────────┬────────────────────────────┘
           │        DIPAKAI BERSAMA kedua server:            │
           │  backend/app/common/kiriman.py   validasi skor/feedback + batas per IP
           │  backend/app/simulation/service.py  sesi simulasi (/api/session/*)
           │  backend/app/scoring/calculator.py  skor & kategori risiko
           │  core/admin_auth.py              password admin & penundaan login
           │  core/proxy.py                   ProxyFix (IP asli)
           ▼                                                 ▼
  data/hasil.csv, data/feedback_user.csv          data/filemate.db (scores, feedback, meta)
                     data/skenario.json · data/dummy_files/ · data/admin_*.json · .env
```

Folder `data/` **tidak pernah disajikan langsung ke browser**. Semua akses ke data lewat API.

---

## 3. Alur Utama

### 3.1 Alur bermain — yang dipakai frontend saat ini

```
play.html (game.js)                           result.html (result.js)         Server
  │ nama agen → localStorage                    │
  │ 3 skenario acak dari SCENARIO_BANK          │
  │ X-Ray / SHA-256 / hint / buka-hapus         │
  │   → dinilai & dihitung di browser           │
  │ skor, waktu, kesalahan → localStorage ─────►│ tampilkan hasil
                                                │ POST /api/submit-score ───────► kiriman.validasi_skor()
                                                │   {username, score, time}        cek_batas_kiriman("skor")
                                                │                                  → hasil.csv / tabel scores
                                                │ POST /api/submit-feedback ────► kiriman.validasi_feedback()
                                                │   {user, score, message}         → feedback_user.csv / tabel feedback
index.html (leaderboard.js) ── GET /api/leaderboard ─────────────────────────────► top 6 (skor ↓, waktu ↑)
dashboard.html (common.js) ─── GET /api/dashboard-stats ─────────────────────────► statistik skenario + sesi
```

Server tidak percaya skor dari browser begitu saja: skor wajib int 0–100 kelipatan 5, waktu `MM:SS`,
kategori risiko dihitung server, nama disensor ulang, jumlah kiriman dibatasi per IP
(SECURITY.md S-16). Skor palsu yang masuk akal tetap bisa lolos (K-03).

### 3.2 Alur bermain — versi aman (siap di server, belum dipakai frontend)

```
POST /api/session/start          → 3 skenario TANPA kunci jawaban
POST /api/session/<sid>/decide   → nilai 1 keputusan (dikunci), ending & pelajaran saat skenario selesai
POST /api/session/<sid>/hint     → teks hint (−5, sekali per skenario)
POST /api/session/<sid>/finish   → skor akhir, kesalahan per jenis, riwayat
GET  /api/session/<sid>/result   → hasil untuk result.html
POST /api/session/<sid>/save     → simpan 1x ke leaderboard (skor dari server)
POST /api/session/<sid>/feedback → feedback 1x (inisial & skor dari sesi)
```
Setelah `game.js` & `result.js` memakai alur ini, `SCENARIO_BANK` dan `/api/submit-*` bisa dihapus.

### 3.3 Alur lain
- **Scanner beranda**: `inspector.js` memindai file milik pengguna di browser (File API + Web Crypto).
- **Admin (server)**: `GET /api/admin/status` → `setup`/`login` (SHA-256 password) → cookie `is_admin`
  → `feedback` / `export` / `clear`. Saat ini `admin.js` belum memakainya (K-01).

### 3.4 Fallback tanpa backend
Jika halaman dibuka langsung dari file, `apiFetchJSON` mengembalikan `null`, dan frontend memakai data
lokal (`SCENARIO_BANK` + `localStorage`). Mode ini hanya untuk demo UI.

---

## 4. Struktur Folder

Status: ✅ = ada, 🟡 = ada tetapi beda lokasi dengan rencana, ⬜ = belum dibuat.

```
FileMate/
├── app.py                            ✅  server versi CSV (dipakai sekarang)
├── .env.example  .gitignore          ✅
├── README.md  CHANGELOG.md           ⬜
├── docs/                             ✅
├── page/  tampilan/  image/          🟡  rencana: frontend/pages, frontend/assets
├── core/                             ✅  algorithms, linux_utils, admin_auth, admin_data, env, proxy
├── backend/                          ✅
│   ├── wsgi.py  requirements.txt
│   └── app/
│       ├── __init__.py               create_app(), blueprint, security headers, error JSON
│       ├── config.py                 baca .env, path data, batas kiriman
│       ├── db.py                     SQLite + init skema + impor CSV lama (sekali)
│       ├── common/                   responses.py, sanitize.py, kiriman.py
│       ├── simulation/               routes.py, service.py, scenario.py, linux_utils.py
│       ├── scoring/calculator.py     nilai(), kategori_risiko(), KELIPATAN_SKOR
│       ├── leaderboard/              routes.py (+ /submit-score), repository.py
│       ├── feedback/                 routes.py (/submit-feedback), repository.py
│       └── admin/                    routes.py, export.py
├── data/                             🟡  skenario.json & CSV langsung di data/
│   ├── skenario.json  hasil.csv  feedback_user.csv  filemate.db
│   ├── dummy_files/                  19 file dummy
│   └── buat_dummy.py
├── tests/                            ✅  test_linux_utils.py, test_sinkron_frontend.py
├── database/schema.sql               ⬜  (memakai SKEMA_BAWAAN di db.py)
├── scripts/                          ⬜
└── deployment/                       ⬜  nginx.conf, filemate.service
```

`config.py` sengaja mencari path **baru dulu, lalu path lama** (`_pilih_path`), sehingga
folder bisa dipindahkan bertahap tanpa mengubah kode.

---

## 5. Tanggung Jawab Modul (PIC)

| Area                                   | PIC                       |
|----------------------------------------|---------------------------|
| Frontend, UI/UX, panduan               | Muhammad Fardan           |
| Skenario & data dummy                  | Rohit Al Bukhori          |
| Backend, scoring, sanitasi, API        | Kaysan Nawfal             |
| Utilitas Linux, server, Nginx, systemd | Muhamad Yazid Firdaus     |

---

## 6. Keputusan Desain

| Keputusan | Alasan | Konsekuensi |
|-----------|--------|-------------|
| Dua server dengan API identik | `app.py`+CSV mudah dijelaskan di sidang Alpro; `backend/` terstruktur untuk deploy | Data CSV & SQLite tidak sinkron — pilih satu saat deploy |
| Logika kiriman, sesi, skor, auth dipakai bersama | Satu sumber aturan → kedua server menjawab sama | `app.py` mengimpor `backend.app.*`; `backend/` mengimpor `core.*` |
| Frontend tidak diubah dari sisi backend | Pembagian tugas tim | `/api/submit-*` dipertahankan & diperketat, bukan dihapus |
| State sesi & batas kiriman di memori proses | Sederhana, tanpa Redis | Gunicorn **wajib 1 worker** (boleh banyak thread); hilang saat restart |
| SQLite, bukan MySQL/PostgreSQL | Cukup untuk skala kelas, nol konfigurasi | Penulisan bersamaan dibatasi; tidak masalah untuk beban demo |
| Fallback Python untuk perintah Linux | Tim mengembangkan di Windows | Kolom `engine` menunjukkan mesin yang dipakai |
| Format respons `{status, data}` / `{status, message}` | Penanganan error di frontend cukup satu tempat | `/leaderboard` & `/dashboard-stats` tetap mengembalikan JSON langsung (dibaca frontend apa adanya) |

---

## 7. Menjalankan

```bash
pip install -r backend/requirements.txt

# Server CSV (dipakai sekarang)
python app.py                     # → http://127.0.0.1:5000  (redirect ke /page/dashboard.html)

# Server SQLite
python backend/wsgi.py

# Produksi (Linux)
SERVE_STATIC=0 gunicorn --chdir backend -w 1 --threads 4 -b 127.0.0.1:5000 wsgi:app

# Tes
python -m unittest discover -s tests -v
```
