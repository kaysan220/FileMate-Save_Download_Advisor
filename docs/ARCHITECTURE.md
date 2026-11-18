# ARCHITECTURE — FileMate (Save Download Advisor)

Dokumen ini menjelaskan gambaran sistem FileMate: komponen, alur data, dan struktur folder.
Rujukan rencana folder: [`Arsitektur_File_Folder.md`](../Arsitektur_File_Folder.md).

---

## 1. Gambaran Singkat

FileMate adalah web edukasi keamanan siber berbentuk **lab simulasi**. Pengguna diberi
3 skenario acak (SPOOFING, HASH, FATIGUE) berisi daftar file "unduhan" dummy. Untuk setiap
file, pengguna memutuskan **buka** atau **hapus** setelah memeriksa ekstensi asli, magic bytes,
permission, dan hash SHA-256. Skor dihitung di server, lalu masuk ke papan peringkat.

| Lapisan    | Teknologi                          | Tugas utama                                            |
|------------|------------------------------------|--------------------------------------------------------|
| Frontend   | HTML + CSS + JavaScript (vanilla)  | Tampilan, lab simulasi, scanner lokal, hasil & feedback|
| Backend    | Python 3.10+ / Flask 3             | API JSON, sesi simulasi, penilaian, admin             |
| Database   | SQLite (`data/filemate.db`)        | Tabel `scores` dan `feedback`                          |
| Utilitas OS| `sha256sum`, `file`, `ls -l`       | Inspeksi file dummy (fallback Python di Windows)       |
| Produksi   | Nginx + Gunicorn + systemd         | Reverse proxy, sajikan file statis, jalankan Flask     |

---

## 2. Diagram Komponen

```
                 ┌──────────────────────── Browser ────────────────────────┐
                 │  pages/*.html  +  assets/js/*.js  +  assets/css/*.css   │
                 │  inspector.js  → scanner lokal (file TIDAK diunggah)    │
                 └───────────────┬─────────────────────────────────────────┘
                                 │ HTTP (fetch JSON via api.js)
                 ┌───────────────▼──────────────┐
                 │            Nginx             │  ← produksi: sajikan statis,
                 │  /           → frontend/     │    teruskan /api/* ke Gunicorn
                 │  /api/*      → 127.0.0.1:5000│
                 └───────────────┬──────────────┘
                                 │
                 ┌───────────────▼──────────────────────────────────────────┐
                 │  Gunicorn (1 worker, N thread) → backend/wsgi.py         │
                 │  create_app()  (backend/app/__init__.py)                 │
                 │   ├─ simulation/  /api/session/*, /api/inspect, /hash    │
                 │   ├─ leaderboard/ /api/leaderboard, /api/dashboard-stats │
                 │   ├─ feedback/    /api/feedback                          │
                 │   ├─ admin/       /api/admin/*                           │
                 │   ├─ scoring/     nilai(), kategori_risiko()             │
                 │   └─ common/      responses.py, sanitize.py              │
                 └───────┬──────────────────────┬───────────────────────────┘
                         │                      │
          ┌──────────────▼─────────┐   ┌────────▼──────────────────────────┐
          │ data/filemate.db       │   │ data/scenarios/skenario.json      │
          │ (scores, feedback)     │   │ data/dummy_files/*  (read-only)   │
          └────────────────────────┘   └───────────────────────────────────┘
```

Folder `data/` **tidak pernah disajikan langsung ke browser**. Semua akses ke data lewat API.

---

## 3. Alur Utama

### 3.1 Alur bermain (sesi simulasi)

```
play.html                         Backend                                  Memori / DB
   │  POST /api/session/start  ──►  service.mulai_sesi()
   │     {username}                   ├─ scenario.pilih_skenario()  → 1 acak per kategori
   │                                  ├─ sensor_nama("Rohit") → "R****T"
   │                                  └─ simpan state sesi ───────────────► _sesi[sid] (RAM)
   │  ◄── session_id + skenario versi publik (TANPA isMalware/hint/ending)
   │
   │  GET /api/inspect?file=…  ──►  linux_utils: file --mime-type, ls -l
   │  GET /api/hash?file=…     ──►  linux_utils: sha256sum
   │
   │  POST /session/<sid>/hint ──►  service.minta_hint()   (penalti -5)
   │  POST /session/<sid>/decide──► service.putuskan()     (keputusan dikunci, 1x per file)
   │  ◄── correct / is_malware / outcome
   │
   │  POST /session/<sid>/finish ─► service.selesaikan() → scoring.nilai()
   │                                └─ leaderboard.repository.simpan_skor() ─► tabel scores
   │  ◄── skor, kategori risiko, ringkasan + ending + pelajaran per skenario
   ▼
result.html  → POST /api/feedback ──► feedback.repository ─────────────────► tabel feedback
```

**Prinsip penting:** kunci jawaban (`isMalware`), teks hint, dan ending hanya ada di server.
Browser hanya mengirim keputusan `open` / `delete`; server yang menilai.

### 3.2 Alur beranda & dashboard
- `index.html` memuat papan peringkat dari `GET /api/leaderboard`.
- `inspector.js` memindai file milik pengguna **sepenuhnya di browser** (File API + Web Crypto),
  tidak ada file yang dikirim ke server.
- Dashboard memanggil `GET /api/dashboard-stats` (statistik bank skenario + skor).

### 3.3 Alur maintainer (admin)
`POST /api/admin/login {pin}` → cookie sesi `is_admin` → `GET /api/admin/feedback`
atau `GET /api/admin/export/<scores|feedback>` (unduh CSV).

### 3.4 Fallback tanpa backend
Jika halaman dibuka langsung (tanpa Flask), `api.js` melempar error dan modul JS memakai
data lokal (`scenario_data.js` + `localStorage`). Mode ini hanya untuk demo UI, **bukan**
mode yang aman.

---

## 4. Struktur Folder

Status: ✅ = sudah ada di repo, 🟡 = ada tapi masih di lokasi lama, ⬜ = belum dibuat.

```
FileMate/
├── README.md                         ⬜
├── CHANGELOG.md                      ⬜
├── .env.example                      ⬜  SECRET_KEY, ADMIN_PIN, COOKIE_SECURE, SERVE_STATIC, DB_PATH
├── .gitignore                        ⬜  .env, *.db, __pycache__, data/exports/*
│
├── docs/                             ✅  dokumen ini
│
├── frontend/                         🟡  saat ini: page/ (HTML) dan tampilan/ (CSS/JS), image/
│   ├── pages/                            index, play, result, guide (+ dashboard)
│   └── assets/{css,js,images}/
│
├── backend/                          ✅
│   ├── wsgi.py                           titik masuk (dev & gunicorn)
│   ├── requirements.txt                  Flask, gunicorn
│   └── app/
│       ├── __init__.py                   create_app(), blueprint, security headers, error JSON
│       ├── config.py                     baca .env, path data (dengan fallback struktur lama)
│       ├── db.py                         koneksi SQLite per request + init skema + impor CSV lama
│       ├── common/                       responses.py, sanitize.py
│       ├── simulation/                   routes.py, service.py, scenario.py, linux_utils.py
│       ├── scoring/calculator.py         nilai(), kategori_risiko()
│       ├── leaderboard/                  routes.py, repository.py
│       ├── feedback/                     routes.py, repository.py
│       └── admin/                        routes.py, export.py
│
├── database/schema.sql               ⬜  (sementara memakai SKEMA_BAWAAN di db.py)
│
├── data/                             🟡  skenario.json & CSV masih di root data/
│   ├── scenarios/skenario.json
│   ├── dummy_files/                  ✅
│   ├── filemate.db                       dibuat otomatis saat server pertama jalan
│   └── exports/
│
├── scripts/                          ⬜  init_db.py, buat_dummy.py (kini di data/), export_csv.py
├── tests/                            ⬜  lihat TESTING.md
└── deployment/                       ⬜  nginx.conf, filemate.service
```

`config.py` sengaja mencari path **baru dulu, lalu path lama** (`_pilih_path`), sehingga
folder bisa dipindahkan bertahap tanpa mengubah kode.

### Kode lama yang akan dipensiunkan
| File lama            | Pengganti di backend/                         |
|----------------------|-----------------------------------------------|
| `app.py` (root)      | `backend/wsgi.py` + `backend/app/__init__.py` |
| `core/algorithms.py` | `scoring/calculator.py`, `common/sanitize.py`, `simulation/scenario.py` |
| `core/linux_utils.py`| `simulation/linux_utils.py`                   |

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
| State sesi simulasi disimpan di memori proses | Sederhana, tanpa Redis | Gunicorn **wajib 1 worker** (boleh banyak thread); sesi hilang saat restart |
| SQLite, bukan MySQL/PostgreSQL | Cukup untuk skala kelas, nol konfigurasi | Penulisan bersamaan dibatasi; tidak masalah untuk beban demo |
| Penilaian di server | Mencegah curang lewat DevTools | Frontend harus memakai `/api/session/*` |
| Endpoint lama dipertahankan | Frontend lama tetap jalan selama migrasi | Endpoint lama kurang aman — lihat SECURITY.md |
| Fallback Python untuk perintah Linux | Tim mengembangkan di Windows | Kolom `engine` di respons menunjukkan mesin yang dipakai |
| Format respons seragam `{status, data}` / `{status, message}` | Penanganan error di `api.js` cukup satu tempat | Endpoint lama belum mengikuti format ini |

---

## 7. Menjalankan

```bash
# Pengembangan (Flask ikut menyajikan halaman, SERVE_STATIC=1)
pip install -r backend/requirements.txt
python backend/wsgi.py            # → http://127.0.0.1:5000  (redirect ke /page/dashboard.html)

# Produksi (Linux)
SERVE_STATIC=0 gunicorn --chdir backend -w 1 --threads 4 -b 127.0.0.1:5000 wsgi:app
```
