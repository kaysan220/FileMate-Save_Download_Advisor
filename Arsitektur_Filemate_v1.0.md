# Arsitektur FileMate v1.0 — Safe Download Advisor

> Tim Satgas Salah Download — Kelompok 6 RKS Polibatam
> Dokumen ini disusun dari pembacaan **seluruh isi folder** pada branch `development`
> (commit `59e3e65`, dicek 20/11/2026). Isinya menggambarkan kondisi kode **yang benar-benar ada**,
> bukan rencana. Rencana & catatan migrasi ada di [Arsitektur_File_Folder.md](Arsitektur_File_Folder.md).

---

## 1. Gambaran Singkat

FileMate adalah web edukasi keamanan siber berbentuk **lab simulasi unduhan**. Pengguna
menghadapi 3 skenario acak (SPOOFING, HASH, FATIGUE) berisi file "unduhan" dummy, memeriksa
setiap file (ekstensi asli, magic bytes, permission, SHA-256), lalu memutuskan **buka** atau
**hapus**. Hasil akhirnya berupa skor, kategori risiko, papan peringkat anonim, dan masukan pengguna.

Fitur utama:

| Fitur | Halaman | Keterangan |
|-------|---------|------------|
| Ikhtisar / dashboard | `page/dashboard.html` | Halaman pembuka (redirect dari `/`), statistik bank skenario & sesi |
| Beranda + scanner lokal | `page/index.html` | Scanner file milik pengguna di browser (tidak diunggah) + papan peringkat |
| Lab simulasi | `page/play.html` | 3 skenario, X-Ray Inspect, Cek SHA-256, hint, ending |
| Evaluasi akhir | `page/result.html` | Skor, kategori risiko, diagnosis kesalahan, form masukan |
| Panduan | `page/guide.html` | Modul panduan verifikasi file (perintah Linux/Windows) |
| Menu Satgas (admin) | Semua halaman, `Ctrl + Shift + L` | Lihat masukan, reset data, unduh CSV |

---

## 2. Teknologi

| Lapisan | Teknologi | Lokasi |
|---------|-----------|--------|
| Frontend | HTML + CSS + JavaScript vanilla (tanpa framework) | `page/`, `tampilan/`, `image/` |
| Backend A (dipakai sekarang) | Python 3.10 + Flask, penyimpanan **CSV** | `app.py` + `core/` |
| Backend B (versi terstruktur) | Python + Flask (blueprint), penyimpanan **SQLite** | `backend/` |
| Utilitas OS | `sha256sum`, `file --mime-type`, `ls -l` (fallback Python di Windows) | `core/linux_utils.py`, `backend/app/simulation/linux_utils.py` |
| Produksi (rencana) | Nginx + Gunicorn (1 worker) + systemd, Cloudflare | `docs/NGINX_KEAMANAN_ADMIN.md` |
| Dependensi | `Flask>=3.0,<4.0`, `gunicorn>=22.0` (non-Windows) | `backend/requirements.txt` |

---

## 3. Diagram Arsitektur

```
┌──────────────────────────────── BROWSER ────────────────────────────────┐
│  page/*.html  ─ memuat ─►  tampilan/css/{base,components,pages}.css      │
│                            tampilan/js/{scenario_data,api,common,...}.js │
│                                                                          │
│  inspector.js : scanner lokal (File API + Web Crypto) → file TIDAK dikirim│
│  localStorage : tema, nama agen, skor sementara, riwayat, feedback lokal │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │ fetch() JSON  (api.js → apiFetchJSON)
                                ▼
┌──────────────── (Produksi) Nginx / Cloudflare ─────────────────┐
│  real_ip, limit_req untuk /api/admin/*, proxy ke 127.0.0.1:5000 │
└───────────────────────────────┬─────────────────────────────────┘
                                ▼
┌──────────────── SERVER A: app.py (DIPAKAI SEKARANG) ───────────────────────┐
│  Flask + security headers + ProxyFix (core/proxy.py)                       │
│  Menyajikan /page, /tampilan, /image                                       │
│  /api/session/*  ──► backend/app/simulation/service.py  (dipakai bersama)  │
│  /api/leaderboard, /api/dashboard-stats, /api/submit-* ──► core/algorithms │
│  /api/inspect, /api/hash  ──► core/linux_utils.py                          │
│  /api/admin/*  ──► core/admin_auth.py + core/admin_data.py                 │
└──────────┬───────────────────────────────┬─────────────────────────────────┘
           ▼                               ▼
   data/hasil.csv                   data/skenario.json
   data/feedback_user.csv           data/dummy_files/* (read-only)
   data/admin_password.json         .env (ADMIN_RECOVERY_HASH, SECRET_KEY, ...)
   data/admin_lock.json (otomatis)

┌──────────────── SERVER B: backend/ (Flask + SQLite) ───────────────────────┐
│  backend/wsgi.py → create_app()  ⚠ backend/app/__init__.py TERHAPUS (lihat §9)│
│  blueprint: simulation/ · leaderboard/ · feedback/ · admin/                │
│  logika: scoring/ · common/ · db.py · config.py                            │
│  data: data/filemate.db (tabel scores, feedback, meta)                     │
└────────────────────────────────────────────────────────────────────────────┘
```

Hubungan antar-backend:
- `app.py` **memakai ulang** `backend/app/simulation/service.py` (logika sesi) dan
  `backend/app/scoring/calculator.py` (`kategori_risiko`), jadi sebagian kode `backend/` ikut
  berjalan walaupun server B sendiri tidak dijalankan.
- `backend/app/admin/routes.py` memakai `core/admin_auth.py` (autentikasi admin dipakai bersama).

---

## 4. Struktur Folder Lengkap

```
FileMate - Save Download Advisor/
├── app.py                         ← Server A (Flask, CSV) — server yang dipakai sekarang
├── Arsitektur_File_Folder.md      ← rencana folder + catatan migrasi & progres
├── Arsitektur_Filemate_v1.0.md    ← dokumen ini
├── PANDUAN_TIM_BACKEND.md         ← pembagian folder & PIC untuk tim
├── __pycache__/                   ← cache Python (seharusnya tidak di-commit)
│
├── backend/                       ← Server B (Flask blueprint + SQLite)
│   ├── wsgi.py
│   ├── requirements.txt
│   └── app/
│       ├── config.py
│       ├── db.py
│       ├── common/      (__init__.py, responses.py, sanitize.py)
│       ├── simulation/  (__init__.py, routes.py, service.py, scenario.py, linux_utils.py)
│       ├── scoring/     (__init__.py, calculator.py)
│       ├── leaderboard/ (__init__.py, routes.py, repository.py)
│       ├── feedback/    (__init__.py, routes.py, repository.py)
│       └── admin/       (routes.py, export.py)          ⚠ __init__.py hilang
│
├── core/                          ← modul logika untuk app.py
│   ├── __init__.py, algorithms.py, linux_utils.py
│   ├── admin_auth.py, admin_data.py
│   ├── env.py, proxy.py, atur_password_cadangan.py
│   └── PANDUAN_KAYSAN.txt, PANDUAN_YAZID.txt
│
├── data/                          ← data server (TIDAK disajikan ke browser)
│   ├── skenario.json
│   ├── dummy_files/  (18 file dummy)
│   ├── hasil.csv, feedback_user.csv
│   ├── filemate.db
│   ├── admin_password.json
│   ├── buat_dummy.py
│   └── PANDUAN_ROHIT.txt
│
├── docs/                          ← dokumentasi teknis
│   ├── ARCHITECTURE.md, API_CONTRACT.md, DATA_SCHEMA.md
│   ├── SECURITY.md, TESTING.md, NGINX_KEAMANAN_ADMIN.md
│
├── page/                          ← halaman HTML
│   └── dashboard.html, index.html, play.html, result.html, guide.html
│
├── tampilan/                      ← aset frontend
│   ├── css/  base.css, components.css, pages.css, style.css
│   └── js/   api.js, common.js, scenario_data.js, inspector.js, leaderboard.js,
│             game.js, result.js, admin.js, main.js
│
├── image/                         ← logo & gambar
│   └── filemate-light.png, filemate_dark.png, logo-transparency.png, logo-white.png
│
└── tests/
    └── test_linux_utils.py
```

---

## 5. Kegunaan Setiap File

### 5.1 Root

| File | Kegunaan |
|------|----------|
| `app.py` | **Server utama yang dipakai sekarang.** Flask di `127.0.0.1:5000`. Menyajikan halaman statis (`/page`, `/tampilan`, `/image`, `/` → `dashboard.html`), menambahkan security header, memasang ProxyFix, dan menyediakan semua endpoint API (sesi simulasi, leaderboard, dashboard, inspect/hash, submit skor/feedback, admin). Data disimpan ke CSV. Konfigurasi: TTL sesi 1 jam, maks 500 sesi, cookie admin HttpOnly + SameSite=Strict, body maks 16 KB. |
| `Arsitektur_File_Folder.md` | Rencana struktur folder dengan penanda status (OK/BELUM), catatan migrasi JS → server [1]–[5], perbaikan keamanan login admin, dan progres backend. |
| `PANDUAN_TIM_BACKEND.md` | Ringkasan pembagian folder dan penanggung jawab (PIC) tiap anggota tim. |
| `__pycache__/app.cpython-310.pyc` | Bytecode hasil kompilasi Python — file otomatis, tidak perlu di-commit. |

### 5.2 `backend/` — Server B (Flask + SQLite)

| File | Kegunaan |
|------|----------|
| `wsgi.py` | Titik masuk server B: `python backend/wsgi.py` (pengembangan) atau `gunicorn --chdir backend -w 1 --threads 4 wsgi:app` (produksi). Mengimpor `create_app()` dari paket `app`. |
| `requirements.txt` | Dependensi: Flask 3.x dan gunicorn (hanya non-Windows). |
| `app/config.py` | Membaca `.env` (parser sederhana tanpa library), menentukan semua path data dengan fallback struktur lama → baru (`_pilih_path`): skenario, dummy, DB, schema, export, CSV lama, folder statis. Berisi `SECRET_KEY`, pengaturan cookie, `SERVE_STATIC`, TTL sesi. |
| `app/db.py` | Koneksi SQLite per request (`get_db` via `flask.g`), `init_db()` membuat tabel `scores`, `feedback`, `meta` (dari `SKEMA_BAWAAN` bila `database/schema.sql` belum ada) dan mengimpor CSV lama **sekali saja** (penanda di tabel `meta`). |
| `app/common/responses.py` | Format respons JSON seragam: `sukses()` → `{status:"ok", data}`, `gagal()` → `{status:"error", message}`, `ambil_json()` membaca body dengan aman. |
| `app/common/sanitize.py` | `sensor_nama()` (Rohit → `R****T`, kosong → `A****M`), `sanitasi_teks_csv()` (anti-XSS & anti-CSV Injection), `sanitasi_waktu()` (format mm:ss), `ke_int()` (konversi angka aman dengan batas). |
| `app/simulation/service.py` | **Inti logika simulasi** (dipakai juga oleh `app.py`). State sesi di memori (`_sesi`, `_hasil`, dengan lock): `mulai_sesi`, `putuskan` (nilai keputusan buka/hapus, kirim ending & pembahasan bila skenario selesai), `minta_hint` (penalti 1x per skenario), `selesaikan` (skor akhir, kesalahan per jenis SPOOFING/HASH/FATIGUE/IMPULSIVE, riwayat), `ambil_hasil`, `simpan_hasil` (1x), `ambil_data_feedback` (1x), `batalkan_feedback`. `SesiError` untuk error 4xx. |
| `app/simulation/scenario.py` | Membaca `skenario.json`, memilih 1 skenario acak per kategori + mengacak urutan, `versi_publik()` membuang kunci jawaban (`isMalware`, `payloadStatus`, hint, ending, pembahasan), `ringkasan_bank()` untuk statistik dashboard. |
| `app/simulation/routes.py` | Blueprint `/api`: `/session/start`, `/decide`, `/hint`, `/finish`, `/result`, `/save`, `/feedback`, serta `/inspect` dan `/hash`. |
| `app/simulation/linux_utils.py` | `sha256sum`, `file --mime-type`, `ls -l` terhadap `data/dummy_files/`. Anti path traversal (`basename` + `commonpath`), `shell=False`, timeout 3 detik, fallback `hashlib`/`os.stat` di Windows. |
| `app/scoring/calculator.py` | Skor awal 100; penalti −15 buka malware, −5 hapus file aman, −5 hint; skor minimal 0. Kategori: ≤50 TINGGI, 51–80 SEDANG, >80 RENDAH. |
| `app/leaderboard/repository.py` | Query SQL tabel `scores` (parameter `?`, aman SQL Injection): simpan, top skor, statistik (total sesi, rata-rata, sebaran risiko), semua skor, hapus semua. |
| `app/leaderboard/routes.py` | `GET /api/leaderboard?limit=` dan `GET /api/dashboard-stats`. |
| `app/feedback/repository.py` | Query SQL tabel `feedback`: simpan (kode responden `P01`, `P02`, …), daftar, hapus semua, konversi ke dict. |
| `app/feedback/routes.py` | Blueprint kosong + konstanta `MAKS_PANJANG_PESAN = 300` (feedback kini lewat `/api/session/<sid>/feedback`). |
| `app/admin/routes.py` | Blueprint `/api/admin`: status, setup, login, recovery, reset, logout, feedback, export CSV, clear data. Penundaan login & sesi admin memakai `core/admin_auth.py`. |
| `app/admin/export.py` | SQL → CSV (`hasil.csv`, `feedback_user.csv`), tiap sel disanitasi ulang; `simpan_ke_folder()` untuk ekspor ke `data/exports/`. |
| `app/*/__init__.py` | Penanda paket Python (berisi komentar saja). |
| `app/**/__pycache__/` | Bytecode otomatis. |

### 5.3 `core/` — Modul Logika untuk `app.py`

| File | Kegunaan |
|------|----------|
| `__init__.py` | Mengekspor fungsi publik `algorithms` & `linux_utils` (`from core import nilai, sensor_nama, ...`), versi `1.0.0`. |
| `algorithms.py` | Logika versi CSV (bahan sidang Alpro): `baca_skenario`, `nilai`, `sensor_nama`, `sanitasi_teks_csv`, `tulis_log` (→ `hasil.csv`), `baca_leaderboard`, `tulis_feedback` (→ `feedback_user.csv`), `ringkasan_dashboard`. Path data didefinisikan di sini. |
| `linux_utils.py` | Versi awal utilitas Linux (`sha256sum`, `file`, `ls -l`) untuk `app.py`, dengan fallback Windows. |
| `admin_auth.py` | Autentikasi admin (tanpa Flask): frontend mengirim SHA-256(password), server menyimpan PBKDF2-SHA256 (200.000 iterasi + salt) di `data/admin_password.json`, perbandingan `hmac.compare_digest`. Penundaan login per IP & global, password cadangan dari `ADMIN_RECOVERY_HASH` di `.env`, status kunci di `data/admin_lock.json`, sesi admin 30 menit idle / 8 jam maks. Dipakai **kedua** server. |
| `admin_data.py` | Data menu Satgas versi CSV: baca feedback, buat CSV unduhan (disanitasi), kosongkan CSV (header tetap, tulis atomik). |
| `env.py` | Pemuat `.env` untuk `app.py` (tidak menimpa variabel sistem). |
| `proxy.py` | Memasang `ProxyFix` bila `PROXY_COUNT` > 0 agar IP asli terbaca di balik Nginx/Cloudflare. |
| `atur_password_cadangan.py` | Skrip CLI `python -m core.atur_password_cadangan`: input tersembunyi (min. 12 karakter), simpan SHA-256 ke `.env`, tambah `SECRET_KEY` acak bila belum ada. |
| `PANDUAN_KAYSAN.txt` | Panduan tugas backend & scoring (fungsi untuk sidang Alpro, cara menjalankan server). |
| `PANDUAN_YAZID.txt` | Panduan tugas Linux & infrastruktur (chmod, perintah demo, contoh Nginx, rujukan ke panduan Nginx lengkap). |

### 5.4 `data/` — Data Server

| File | Kegunaan |
|------|----------|
| `skenario.json` | **Satu-satunya bank soal di server.** 4 skenario: SPOOFING (`spoof_hrd_01`, `spoof_ukt_02`, masing-masing 3 file), HASH (`hash_forum_01`, 3 file), FATIGUE (`fatigue_usb_01`, 10 file). Tiap file berisi nama tampil/asli, ekstensi, MIME, magic bytes, permission, hash, `expectedHash`, `isMalware`, `payloadStatus`. |
| `dummy_files/` | 18 file dummy **aman** (hanya header beberapa byte) agar `file`, `sha256sum`, `ls -l` bisa dijalankan sungguhan. Contoh: `Kontrak_Magang_2026.pdf.exe`, `Data_Kuisioner_User.xlsx.vbs`, `Patch_Update_v2.zip`. |
| `buat_dummy.py` | Membuat ulang file dummy dari `skenario.json` sesuai magic bytes; set `chmod 755` untuk file ber-permission `x`, `644` untuk lainnya. |
| `hasil.csv` | Log skor leaderboard untuk `app.py` (`nama_anonim, skor, waktu, kategori_risiko`). Saat ini hanya header. |
| `feedback_user.csv` | Masukan pengguna untuk `app.py` (`kode_responden, inisial_anonim, skor, waktu_input, saran_dan_masukan`). Saat ini hanya header. |
| `filemate.db` | Database SQLite server B (dibuat otomatis oleh `db.init_db()`). |
| `admin_password.json` | Hash PBKDF2 password admin + salt + waktu diperbarui (dibuat saat setup admin pertama). |
| `admin_lock.json` | (Dibuat otomatis saat runtime) status penundaan login & percobaan password cadangan. |
| `PANDUAN_ROHIT.txt` | Panduan tugas skenario & data (cara membuat dummy, cara pengacakan soal). |

### 5.5 `docs/` — Dokumentasi Teknis

| File | Kegunaan |
|------|----------|
| `ARCHITECTURE.md` | Gambaran sistem, diagram komponen, alur bermain, keputusan desain, cara menjalankan (versi rencana `backend/`). |
| `API_CONTRACT.md` | Daftar endpoint API beserta contoh request/response JSON. |
| `DATA_SCHEMA.md` | Struktur `skenario.json` dan tabel SQL. |
| `SECURITY.md` | Model ancaman, pemetaan CIA Triad, kontrol keamanan (bahan sidang DKS), kode K-01… |
| `TESTING.md` | Cara pengujian & checklist user testing. |
| `NGINX_KEAMANAN_ADMIN.md` | Panduan Nginx: real_ip Cloudflare, X-Forwarded-For, `limit_req`, `PROXY_COUNT`, firewall, cara uji. |

### 5.6 `page/` — Halaman HTML

Semua halaman memuat `base.css`, `components.css`, `pages.css` dan script `scenario_data.js`,
`api.js`, `common.js`, `admin.js` (+ script khusus halaman di bawah).

| File | Script khusus | Kegunaan |
|------|---------------|----------|
| `dashboard.html` | — | Ikhtisar keamanan unduhan, statistik (`/api/dashboard-stats`), animasi hero. Halaman awal. |
| `index.html` | `inspector.js`, `leaderboard.js` | Beranda: scanner file lokal + papan peringkat anonim. |
| `play.html` | `game.js` | Lab simulasi 3 skenario. |
| `result.html` | `result.js` | Evaluasi akhir: skor, kategori risiko, diagnosis, form masukan. |
| `guide.html` | — | Modul panduan verifikasi file + generator perintah per OS. |

### 5.7 `tampilan/css/` — Gaya

| File | Kegunaan |
|------|----------|
| `base.css` | Variabel tema terang/gelap (`data-theme`), reset, tipografi (Inter, JetBrains Mono). |
| `components.css` | Komponen: panel, tombol, modal, toast, form. |
| `pages.css` | Gaya khusus tiap halaman, ikon SVG inline, animasi. |
| `style.css` | CSS monolit lama sebelum dipecah. **Tidak dimuat halaman mana pun** (sisa/legacy). |

### 5.8 `tampilan/js/` — Logika Frontend

| File | Kegunaan |
|------|----------|
| `api.js` | `apiFetchJSON()` — wrapper `fetch` JSON; mengembalikan `null` bila server mati/error (agar halaman tetap jalan). |
| `common.js` | Utilitas bersama: `escapeHTML`, tema terang/gelap, toast, scroll reveal, animasi hero dashboard, visual forensik 2D di panduan, generator perintah panduan, modal profil tim, statistik dashboard (server, dengan cadangan lokal). |
| `scenario_data.js` | `SATGAS_TEAM` (profil tim untuk pop-up) **dan** `SCENARIO_BANK` (bank soal lengkap dengan kunci jawaban — lihat §9). |
| `inspector.js` | Scanner beranda: drag & drop file, baca magic bytes & hitung SHA-256 di browser (Web Crypto), tampilkan 3 status yang mudah dipahami. File tidak dikirim ke server. |
| `leaderboard.js` | Render papan peringkat dari `GET /api/leaderboard`, cadangan `localStorage`/data contoh bila server mati. |
| `game.js` | Engine lab simulasi: input nama agen, timer, pilih skenario dari `SCENARIO_BANK`, X-Ray Inspect, Cek SHA-256, keputusan buka/hapus, hint, skor, 3 variasi ending, lalu simpan hasil ke `localStorage` dan pindah ke `result.html`. |
| `result.js` | Membaca hasil dari `localStorage`, menghitung kategori risiko, menyimpan skor (`POST /api/submit-score`) & masukan (`POST /api/submit-feedback`). |
| `admin.js` | Menu Satgas (`Ctrl + Shift + L`): input PIN, lihat masukan, reset leaderboard/masukan, unduh CSV — versi saat ini memakai `localStorage`. |
| `main.js` | Versi monolit lama (UI, scanner + VirusTotal, sandbox). **Tidak dimuat halaman mana pun** (sisa/legacy). |

### 5.9 `image/` dan `tests/`

| File | Kegunaan |
|------|----------|
| `image/filemate-light.png`, `filemate_dark.png` | Logo untuk tema terang & gelap (dipakai di header halaman). |
| `image/logo-transparency.png`, `logo-white.png` | Varian logo (transparan / putih). |
| `tests/test_linux_utils.py` | Unit test keamanan `core/linux_utils.py` (path traversal, command injection, fallback) dengan mock. |

---

## 6. Alur Data

### 6.1 Alur bermain — yang dijalankan frontend saat ini

```
play.html (game.js)                                result.html (result.js)          Server (app.py)
  │ input nama → localStorage filemate_agent_*       │
  │ ambil 3 skenario dari SCENARIO_BANK (browser)    │
  │ X-Ray / SHA-256 / hint / keputusan → dinilai     │
  │   di browser, skor dihitung di browser           │
  │ simpan filemate_final_score, _seconds,           │
  │   _mistakes, _history ke localStorage ──────────►│ baca localStorage
  │                                                  │ POST /api/submit-score ─────────► validasi skor 0–100
  │                                                  │   {username, score, time}          kelipatan 5, rate limit,
  │                                                  │                                    kategori dihitung server
  │                                                  │                                    → data/hasil.csv
  │                                                  │ POST /api/submit-feedback ──────► → data/feedback_user.csv
```

### 6.2 Alur bermain — versi aman yang sudah tersedia di server (belum dipakai frontend)

```
POST /api/session/start           → session_id + 3 skenario TANPA kunci jawaban
POST /api/session/<sid>/decide    {file_id, action: open|delete, inspected}
                                  → benar/salah, skor berjalan; ending & pembahasan saat 1 skenario selesai
POST /api/session/<sid>/hint      {scenario_id} → teks hint (−5, sekali per skenario)
POST /api/session/<sid>/finish    → skor akhir, kesalahan per jenis, riwayat
GET  /api/session/<sid>/result    → hasil untuk result.html
POST /api/session/<sid>/save      {username} → simpan 1x ke leaderboard (skor dari server)
POST /api/session/<sid>/feedback  {message}  → masukan 1x (inisial & skor dari sesi)
```

### 6.3 Alur lain

- **Scanner beranda**: file pengguna → `FileReader` + `crypto.subtle.digest('SHA-256')` → hasil
  ditampilkan di browser. Tidak ada request ke server.
- **Leaderboard**: `index.html` → `GET /api/leaderboard` → `baca_leaderboard(limit=6)` dari `hasil.csv`
  (urut skor tertinggi, lalu waktu tercepat).
- **Dashboard**: `GET /api/dashboard-stats` → jumlah skenario/file/malware dari `skenario.json` +
  total sesi & rata-rata skor dari `hasil.csv`.
- **Inspeksi file dummy**: `GET /api/inspect?file=` dan `GET /api/hash?file=` → perintah Linux asli
  terhadap `data/dummy_files/` (fallback Python di Windows).
- **Admin (server)**: `GET /api/admin/status` → `setup`/`login` (SHA-256 password) → cookie sesi
  `is_admin` → `feedback` / `export/<scores|feedback>` / `clear/<scores|feedback>` → `logout`.
  Lupa password: `recovery` + `reset` dengan password cadangan dari `.env`.

---

## 7. Daftar Endpoint API

| Metode | Endpoint | `app.py` | `backend/` | Keterangan |
|--------|----------|:--------:|:----------:|------------|
| POST | `/api/session/start` | ✅ | ✅ | Mulai sesi simulasi |
| POST | `/api/session/<sid>/decide` | ✅ | ✅ | Nilai keputusan buka/hapus |
| POST | `/api/session/<sid>/hint` | ✅ | ✅ | Ambil hint (penalti) |
| POST | `/api/session/<sid>/finish` | ✅ | ✅ | Hitung skor akhir |
| GET | `/api/session/<sid>/result` | ✅ | ✅ | Hasil akhir |
| POST | `/api/session/<sid>/save` | ✅ | ✅ | Simpan skor 1x |
| POST | `/api/session/<sid>/feedback` | ✅ | ✅ | Kirim masukan 1x |
| GET | `/api/leaderboard` | ✅ | ✅ | Papan peringkat |
| GET | `/api/dashboard-stats` | ✅ | ✅ | Statistik dashboard |
| GET | `/api/inspect?file=` | ✅ | ✅ | `file --mime-type` + `ls -l` |
| GET | `/api/hash?file=` | ✅ | ✅ | `sha256sum` |
| POST | `/api/submit-score` | ✅ | — | Skor dari browser (dipakai `result.js` sekarang) |
| POST | `/api/submit-feedback` | ✅ | — | Masukan dari browser (dipakai `result.js` sekarang) |
| GET | `/api/admin/status` | ✅ | ✅ | Status password & penundaan |
| POST | `/api/admin/setup` | ✅ | ✅ | Buat password pertama |
| POST | `/api/admin/login` | ✅ | ✅ | Login admin |
| POST | `/api/admin/recovery` | ✅ | ✅ | Cek password cadangan |
| POST | `/api/admin/reset` | ✅ | ✅ | Ganti password via cadangan |
| POST | `/api/admin/logout` | ✅ | ✅ | Keluar |
| GET | `/api/admin/feedback` | ✅ | ✅ | Daftar masukan (wajib login) |
| GET | `/api/admin/export/<jenis>` | ✅ | ✅ | Unduh CSV (wajib login) |
| POST | `/api/admin/clear/<jenis>` | ✅ | ✅ | Kosongkan data (wajib login) |

Format respons: sukses `{"status":"ok","data":...}`, gagal `{"status":"error","message":"..."}`
(kecuali `/api/leaderboard` dan `/api/dashboard-stats` yang mengembalikan JSON langsung).

---

## 8. Penyimpanan Data

| Tempat | Isi | Dipakai oleh |
|--------|-----|--------------|
| `data/hasil.csv`, `data/feedback_user.csv` | Skor & masukan | `app.py` |
| `data/filemate.db` (`scores`, `feedback`, `meta`) | Skor & masukan | `backend/` |
| Memori proses (`_sesi`, `_hasil`) | State sesi simulasi (TTL 1 jam, maks 500) | kedua server — wajib **1 worker** |
| `data/admin_password.json`, `data/admin_lock.json` | Hash password admin, status penundaan | kedua server |
| `.env` (tidak di-commit) | `SECRET_KEY`, `ADMIN_RECOVERY_HASH`, `COOKIE_SECURE`, `PROXY_COUNT`, `SERVE_STATIC`, `DB_PATH` | kedua server |
| `localStorage` browser | `filemate_theme`, `filemate_agent_raw/_masked`, `filemate_final_score`, `filemate_seconds`, `filemate_mistakes`, `filemate_history`, `filemate_session_saved`, `filemate_leaderboard`, `filemate_feedbacks` | frontend |

---

## 9. Kontrol Keamanan yang Ada di Kode

| Ancaman | Kontrol | Lokasi |
|---------|---------|--------|
| Path traversal (`../../etc/passwd`) | `basename()` + cek tetap di dalam `dummy_files/` | `*/linux_utils.py` |
| Command injection | `subprocess.run([...], shell=False)`, timeout 3 dtk | `*/linux_utils.py` |
| SQL injection | Query berparameter `?` | `backend/app/*/repository.py` |
| XSS | `escapeHTML()` di frontend, buang `< >` di server | `common.js`, `sanitize.py`, `algorithms.py` |
| CSV injection | Awalan `= + - @ \t \r` diberi `'`, sanitasi ulang saat export | `sanitize.py`, `admin/export.py`, `admin_data.py` |
| Privasi nama | Sensor `R****T` | `sensor_nama()` |
| Brute force admin | Penundaan bertahap per IP & global, batas password cadangan, PBKDF2 + `compare_digest` | `core/admin_auth.py` |
| Pembajakan sesi/CSRF admin | Cookie HttpOnly, SameSite=Strict, Secure (opsional), idle 30 mnt | `app.py`, `config.py` |
| IP palsu di balik proxy | ProxyFix sesuai `PROXY_COUNT` | `core/proxy.py` |
| Spam skor/feedback | Validasi skor, rate limit 5 kiriman / IP / 10 mnt | `app.py` |
| Clickjacking / MIME sniffing | `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy | `app.py` |
| DoS sederhana | Body maks 16 KB, maks 500 sesi aktif | `app.py`, `config.py` |
| Kebocoran kunci jawaban (server) | `versi_publik()` membuang field rahasia | `simulation/scenario.py` |

---

## 10. Status & Temuan Pemeriksaan (20/11/2026)

Hasil uji cepat:
- `app.py` **berjalan**: `POST /api/session/start` → 201, `GET /api/leaderboard` → 200.
- `backend/wsgi.py` **gagal**: `ImportError: cannot import name 'create_app'`.
- `python -m unittest tests.test_linux_utils` → 18 tes: **1 failure, 22 error, 3 skipped**.

Temuan yang perlu ditindaklanjuti:

| # | Temuan | Dampak | Saran |
|---|--------|--------|-------|
| 1 | `backend/app/__init__.py`, `backend/app/admin/__init__.py`, `.gitignore`, `.env.example` **terhapus** di commit `10d0d16`. | Server B tidak bisa jalan (`create_app()` hilang); `.env` & cache berisiko ter-commit. | Pulihkan dari riwayat git: `git checkout 10d0d16~1 -- backend/app/__init__.py backend/app/admin/__init__.py .gitignore .env.example`. |
| 2 | Frontend di `tampilan/js/` adalah versi **14/11** (commit Fardan `7cde0d9`), belum versi migrasi 16/11 yang dicatat di `Arsitektur_File_Folder.md`. | `game.js` menilai di browser dari `SCENARIO_BANK`; `result.js` mengirim skor dari browser; endpoint `/api/session/*` tidak dipakai. | Gabungkan ulang `game.js`, `result.js`, `leaderboard.js`, `admin.js`, `scenario_data.js` versi migrasi. |
| 3 | `scenario_data.js` masih berisi `SCENARIO_BANK` lengkap dengan `isMalware`, hint, ending. | Kunci jawaban bisa dilihat lewat View Source/DevTools; leaderboard bisa dicurangi. | Hapus `SCENARIO_BANK`, sisakan `SATGAS_TEAM`. |
| 4 | `admin.js` memeriksa PIN admin **langsung di JavaScript** (PIN tertulis di kode). | Siapa pun bisa membaca PIN dan membuka menu Satgas; tidak memakai `core/admin_auth.py`. | Pakai alur `/api/admin/status → setup/login`; ganti PIN yang sudah bocor. |
| 5 | `tests/test_linux_utils.py` memanggil fungsi (mis. `_is_linux`) yang tidak ada di `core/linux_utils.py`. | Tes gagal. | Samakan tes dengan kode (atau arahkan tes ke `backend/app/simulation/linux_utils.py`). |
| 6 | `core/linux_utils.py` memakai `startswith()` untuk cek path; versi `backend/` sudah memakai `commonpath()`. | Versi `core/` sedikit lebih lemah. | Pakai satu implementasi (versi `backend/`). |
| 7 | `__pycache__/` (root, `core/`, `backend/`, `tests/`) ikut ter-commit; `data/admin_password.json` & `data/filemate.db` juga ter-commit. | Repo kotor; hash admin & data ikut tersebar. | Tambahkan ke `.gitignore`, lalu `git rm --cached`. |
| 8 | `tampilan/js/main.js` dan `tampilan/css/style.css` tidak dimuat halaman mana pun. | Kode mati, membingungkan. | Hapus atau pindah ke folder arsip. |
| 9 | Dua server (CSV vs SQLite) berjalan paralel dan datanya tidak sinkron. | Bingung saat deploy. | Putuskan satu server untuk produksi. |
| 10 | Belum ada: `README.md`, `CHANGELOG.md`, `database/schema.sql`, `deployment/` (nginx.conf, filemate.service), tes scoring/sanitize/scenario/api. | Dokumentasi & deploy belum lengkap. | Lihat daftar [C] di `Arsitektur_File_Folder.md`. |

---

## 11. Cara Menjalankan

```bash
# Server A (dipakai sekarang, CSV)
pip install -r backend/requirements.txt
python app.py                       # → http://127.0.0.1:5000  (redirect ke /page/dashboard.html)

# Server B (Flask + SQLite) — setelah backend/app/__init__.py dipulihkan
python backend/wsgi.py
# Produksi (Linux):
SERVE_STATIC=0 gunicorn --chdir backend -w 1 --threads 4 -b 127.0.0.1:5000 wsgi:app

# Utilitas
python data/buat_dummy.py           # buat ulang 18 file dummy dari skenario.json
python -m core.atur_password_cadangan   # atur password cadangan admin ke .env
python -m unittest tests.test_linux_utils -v
```

---

## 12. Penanggung Jawab (PIC)

| Area | File utama | PIC |
|------|-----------|-----|
| Project leader, frontend, UI/UX, panduan | `page/`, `tampilan/`, `image/` | Muhammad Fardan |
| Skenario & data dummy | `data/skenario.json`, `data/buat_dummy.py`, `simulation/scenario.py` | Rohit Al Bukhori |
| Backend, scoring, sanitasi, API, auth admin | `app.py`, `core/algorithms.py`, `core/admin_auth.py`, `backend/app/` | Kaysan Nawfal |
| Utilitas Linux, server, Nginx, systemd | `*/linux_utils.py`, `docs/NGINX_KEAMANAN_ADMIN.md` | Muhamad Yazid Firdaus |
