# SECURITY — FileMate

Dokumen ini merangkum kontrol keamanan FileMate untuk bahan sidang **Dasar Keamanan Siber (DKS)**.
Setiap kontrol ditautkan ke ancaman yang dicegah dan lokasi kodenya.
*(Diperbarui 21/11/2026 — disesuaikan dengan kode `app.py`, `core/`, dan `backend/` saat ini.)*

---

## 1. Aset & Model Ancaman

| Aset | Mengapa dilindungi |
|------|--------------------|
| Kunci jawaban skenario (`isMalware`, hint, ending) | Kalau bocor, simulasi tidak bermakna dan leaderboard bisa dicurangi |
| Data pengguna (nama, feedback) | Privasi peserta |
| Leaderboard | Integritas skor |
| Server & file sistem | Perintah Linux dijalankan dari input pengguna |
| Password admin, password cadangan & data ekspor | Akses ke seluruh feedback dan reset data |

| Pelaku | Kemampuan |
|--------|-----------|
| Peserta iseng | Membuka DevTools, mengubah request, mengirim skor palsu |
| Penyerang web | XSS, SQL Injection, Path Traversal, Command Injection, brute force password |
| Pengguna Excel (tim) | Membuka CSV ekspor yang mungkin berisi formula jahat |

---

## 2. Pemetaan ke CIA Triad

| Prinsip | Kontrol di FileMate |
|---------|---------------------|
| **Confidentiality** | Nama disensor `R****T`; `data/` tidak disajikan ke browser; password admin disimpan sebagai PBKDF2; password cadangan & `SECRET_KEY` hanya di `.env`; scanner beranda tidak mengunggah file; alur `/api/session/*` tidak mengirim kunci jawaban |
| **Integrity** | Skor kiriman frontend divalidasi (0–100, kelipatan 5) dan kategori dihitung server; alur sesi menghitung skor di server; query SQL berparameter; constraint `CHECK` di tabel; verifikasi SHA-256 sebagai materi |
| **Availability** | Batas body 16 KB; batas 500 sesi aktif; TTL sesi 1 jam; timeout 3 detik perintah Linux; batas kiriman skor/feedback per IP; penundaan login admin bertahap |

---

## 3. Daftar Kontrol

### S-01 Kunci jawaban disimpan di server (alur sesi)
- **Ancaman:** Peserta membaca `isMalware` lewat DevTools/Network.
- **Kontrol:** `scenario.versi_publik()` menghapus `isMalware`, `payloadStatus`, `hintText`,
  `goodEnding`, `badEnding`, `lessonTitle`, `lessonBody`, `realLifeTip` sebelum dikirim.
  Penilaian di `service.putuskan()` dan `service.selesaikan()`.
- **Kode:** `backend/app/simulation/scenario.py`, `backend/app/simulation/service.py`
- **Status:** siap di kedua server, **belum dipakai frontend** — lihat K-02.

### S-02 Skor dihitung di server (alur sesi)
- **Ancaman:** Mengirim `{"score": 100}` palsu.
- **Kontrol:** `/api/session/<sid>/finish` menghitung skor dari keputusan yang tersimpan; `/save`
  menyimpan skor itu **1x**. Keputusan tiap file hanya bisa dikirim sekali (`409`).
- **Kode:** `backend/app/simulation/routes.py`, `backend/app/scoring/calculator.py`
- **Status:** siap, belum dipakai frontend — lihat K-03 dan S-16.

### S-03 Pseudonimisasi nama
- **Ancaman:** Kebocoran identitas peserta di leaderboard / database.
- **Kontrol:** `sensor_nama()` membuang `< > " ' & = + - @`, memotong 20 karakter, lalu hanya
  menyimpan huruf awal & akhir (`Rohit` → `R****T`). Fungsi ini **idempoten**: inisial yang sudah
  tersensor (`R****T`, `A****`) tidak disensor dua kali. Nama asli tidak pernah disimpan.
- **Kode:** `backend/app/common/sanitize.py` dan `core/algorithms.py` (hasil keduanya diuji sama).

### S-04 Anti SQL Injection
- **Kontrol:** Semua query memakai placeholder `?`. Nilai juga dibatasi (`skor` 0–100, kategori
  dari daftar putih; kategori tak dikenal dihitung ulang dari skor).
- **Kode:** `backend/app/leaderboard/repository.py`, `backend/app/feedback/repository.py`

### S-05 Anti XSS
- **Kontrol berlapis:**
  1. Backend: `sanitasi_teks_csv()` membuang `<` dan `>` dari feedback; `sensor_nama()` membuang karakter berbahaya.
  2. Frontend: `escapeHTML()` di `common.js` dipakai sebelum memasukkan data ke DOM.
  3. Header `X-Content-Type-Options: nosniff`.
- **Catatan:** field HTML di `skenario.json` adalah konten tepercaya milik tim, bukan input pengguna.

### S-06 Anti CSV / Formula Injection
- **Ancaman:** Feedback `=HYPERLINK("http://jahat")` tereksekusi saat CSV dibuka di Excel.
- **Kontrol:** Teks yang diawali `= + - @ \t \r` diberi awalan `'`. Disanitasi saat disimpan
  **dan** sekali lagi saat diekspor. Aturan sama di kedua server.
- **Kode:** `sanitasi_teks_csv()` di `backend/app/common/sanitize.py` & `core/algorithms.py`;
  `_sel()` di `backend/app/admin/export.py`; `buat_csv_unduh()` di `core/admin_data.py`

### S-07 Anti Path Traversal
- **Ancaman:** `GET /api/hash?file=../../.env`
- **Kontrol `core/linux_utils.py` (dipakai `app.py`):** nama **ditolak** (bukan dibersihkan) jika bukan
  string, kosong, `.`/`..`, berisi `/` atau `\`, berisi NUL, atau > 255 karakter. Path akhir
  diurai dengan `realpath` (symlink ikut diurai) dan wajib berada di dalam `dummy_files/`
  (`os.path.commonpath`). Setiap penolakan dicatat di log `filemate.linux_utils`.
- **Kontrol `backend/app/simulation/linux_utils.py`:** `basename()` (backslash dinormalisasi),
  tolak `.`/`..`, lalu cek `commonpath`.
- **Bukti uji:** `?file=../app.py` → `400` di kedua server; `tests/test_linux_utils.py` (18 tes).

### S-08 Anti Command Injection
- **Ancaman:** `?file=a.pdf; rm -rf /` atau nama file `-rf` (argument injection).
- **Kontrol:** `subprocess.run([...], shell=False)` — argumen berupa list, tidak ditafsirkan shell;
  `timeout=3` detik. `core/linux_utils.py` juga menaruh `--` sebelum path dan memeriksa
  `shutil.which()` lebih dulu.
- **Gagal itu jujur (`core/`):** perintah tidak ada / timeout / exit code gagal / keluaran aneh →
  `UtilitasLinuxError` (`503`) dengan pesan generik; stderr hanya ke log, tidak ke pengguna.

### S-09 Autentikasi admin
- Frontend mengirim SHA-256(password); server menyimpan **PBKDF2-SHA256** (200.000 iterasi, salt acak)
  di `data/admin_password.json`. Perbandingan constant-time `hmac.compare_digest`.
- **Penundaan bertahap per IP:** salah ke-5/15/25 → tunda 30 dtk / 5 mnt / 1 jam; ke-35 → IP itu
  wajib password cadangan (`423`). **Global:** 50 → 5 mnt, 100 → 1 jam, 150 → login ditutup.
  Hitungan kembali 0 setelah 24 jam tanpa salah. Status disimpan di `data/admin_lock.json`.
- **Password cadangan:** hanya SHA-256-nya di `.env` (`ADMIN_RECOVERY_HASH`); 5x salah / 5 mnt per IP
  + 20x / 24 jam total. Belum diatur → `503`.
- Selama ditunda, **semua** `/api/admin/*` → `429` dan sesi admin aktif dicabut.
- Cookie: `HttpOnly`, `SameSite=Strict` (mitigasi CSRF), `Secure` bila `COOKIE_SECURE=1`;
  sesi berakhir 30 menit idle / 8 jam maks.
- **Kode:** `core/admin_auth.py`, `app.py`, `backend/app/admin/routes.py`
- **Status:** siap di server, **belum dipakai** `admin.js` — lihat K-01.

### S-10 Security headers
| Header | Nilai | `app.py` | `backend/` |
|--------|-------|:--------:|:----------:|
| `X-Frame-Options` | `DENY` | ✅ | ✅ |
| `X-Content-Type-Options` | `nosniff` | ✅ | ✅ |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | ✅ | ✅ |
| `X-XSS-Protection` | `1; mode=block` | ✅ | – |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | – | ✅ |
| `Cache-Control` | `no-store` (JSON & CSV) | hanya CSV | ✅ |

### S-11 Pembatasan sumber daya (DoS sederhana)
- `MAX_CONTENT_LENGTH = 16 KB` → `413`.
- Maks 500 sesi aktif → `503`; TTL sesi 1 jam.
- `limit` pada leaderboard (1–50) dan admin feedback (1–1000) dibatasi.

### S-12 Penanganan error yang aman
- `backend/`: error `/api/*` dijawab JSON generik; detail exception hanya di log server (`500`).
- `debug=True` hanya jika `FLASK_DEBUG=1` (`backend/wsgi.py`); `app.py` selalu `debug=False`.

### S-13 Rahasia & konfigurasi
- `SECRET_KEY` dan `ADMIN_RECOVERY_HASH` di `.env` (tidak di-commit; lihat `.env.example`).
  Isi lewat `python -m core.atur_password_cadangan`.
- Jika `SECRET_KEY` kosong, dibuat acak setiap start (sesi admin hilang saat restart — aman, tidak bocor).
- IP asli di balik Nginx/Cloudflare: `PROXY_COUNT` + ProxyFix (`core/proxy.py`); kosong saat di laptop.

### S-14 Privasi scanner beranda
- `inspector.js` membaca file pengguna dan menghitung SHA-256 **di browser** (Web Crypto).
  File tidak pernah dikirim ke server FileMate.

### S-15 Isolasi data
- Folder `data/` tidak pernah disajikan sebagai statis (hanya `/page`, `/tampilan`, `/image`).
- File dummy hanya berisi header simulasi, bukan malware asli.

### S-16 Validasi kiriman skor & feedback dari frontend
- **Ancaman:** `result.js` mengirim skor yang dihitung browser → bisa diubah lewat DevTools.
- **Kontrol (sama di kedua server, satu modul `backend/app/common/kiriman.py`):**
  - `score` wajib **int** 0–100 dan kelipatan 5 (`KELIPATAN_SKOR` = FPB semua penalti);
    `"85"`, `85.0`, `true` ditolak.
  - `time` wajib `MM:SS`; kategori risiko dihitung server, bukan dari klien.
  - Nama disensor ulang, pesan disanitasi (S-03, S-05, S-06).
  - Batas kiriman per IP: `SUBMIT_BATAS_PER_IP` per `SUBMIT_JENDELA_DETIK` (bawaan 5 / 10 menit),
    dihitung terpisah untuk skor dan feedback → `429`.
- **Batasan:** skor palsu yang *masuk akal* (mis. 100) tetap diterima — lihat K-03.
- **Bukti uji:** `tests/test_sinkron_frontend.py`.

---

## 4. Celah yang Diketahui (Known Issues)

| ID | Tingkat | Status | Temuan | Rekomendasi |
|----|---------|--------|--------|-------------|
| K-01 | **Tinggi** | Terbuka | PIN maintainer ditulis langsung di `tampilan/js/admin.js` dan dicek di browser; menu Satgas membaca/menghapus `localStorage`, bukan server. | `admin.js` memakai `/api/admin/status → setup/login` (sudah tersedia). **Ganti PIN** karena sudah ter-commit di git. |
| K-02 | **Tinggi** | Terbuka (frontend) | `tampilan/js/scenario_data.js` memuat `SCENARIO_BANK` lengkap dengan `isMalware`, hint, ending → kunci jawaban terbaca lewat View Source. (`GET /api/start-session` di server **sudah dihapus**.) | Migrasikan `game.js` ke `/api/session/*`, lalu hapus `SCENARIO_BANK`. |
| K-03 | **Tinggi** | Dimitigasi | `/api/submit-score` & `/api/submit-feedback` menerima skor dari klien. Mitigasi di kedua server: S-16. | Migrasikan `game.js`/`result.js` ke `/api/session/*`, lalu hapus kedua endpoint. |
| K-04 | Sedang | Ditutup (server) | `payloadStatus` membocorkan jawaban. Sekarang hanya dikirim lewat `/decide`. Di frontend lama masih ada di `SCENARIO_BANK` (K-02). | – |
| K-05 | Sedang | Ditutup | Di balik Nginx, `remote_addr` selalu IP proxy. | Sudah: ProxyFix + `PROXY_COUNT` (`core/proxy.py`), panduan di `NGINX_KEAMANAN_ADMIN.md`. |
| K-06 | Sedang | Terbuka (frontend) | Leaderboard & feedback juga disalin ke `localStorage` oleh `result.js`; data cadangan itu bisa diubah pengguna. | Hanya tampilan lokal; data resmi = server. |
| K-07 | Rendah | Terbuka | Belum ada Content-Security-Policy. | Tambahkan CSP setelah inline script/style dipindah ke file. |
| K-08 | Rendah | Diterima | Sesi simulasi & batas kiriman disimpan di memori → hilang saat restart, tidak bisa >1 worker. | Gunicorn `-w 1 --threads N`. |
| K-09 | Sedang | Terbuka | Batas kiriman per IP: saat user testing, semua laptop di Wi-Fi kampus keluar lewat **satu IP publik** → kiriman ke-6 dst. dalam 10 menit ditolak `429`, dan frontend tidak menampilkan error (skor hilang diam-diam dari server). | Naikkan `SUBMIT_BATAS_PER_IP` (mis. 60) selama sesi uji; Nginx `limit_req` tetap jadi lapis pertama. |
| K-10 | Rendah | Terbuka | `backend/app/simulation/linux_utils.py` belum mengikuti kontrol `core/linux_utils.py` (tanpa `--`, fallback diam-diam, nama dibersihkan bukan ditolak). | Samakan atau pakai satu implementasi (tidak dipakai frontend saat ini). |
| K-11 | Rendah | Terbuka | `data/admin_password.json` (hash PBKDF2) dan `__pycache__/` masih terlacak git walau sudah ada di `.gitignore`. | `git rm --cached data/admin_password.json` + folder `__pycache__`, lalu buat ulang password admin. |

---

## 5. Checklist Deploy Aman

- [ ] `.env` berisi `SECRET_KEY` acak panjang (`python -c "import secrets;print(secrets.token_hex(32))"`)
- [ ] `ADMIN_RECOVERY_HASH` diisi lewat `python -m core.atur_password_cadangan` (min. 12 karakter)
- [ ] Password admin dibuat ulang di server (bukan PIN yang pernah ada di JS)
- [ ] `COOKIE_SECURE=1` dan situs memakai HTTPS
- [ ] `PROXY_COUNT` sesuai jumlah proxy tepercaya (lihat `NGINX_KEAMANAN_ADMIN.md`)
- [ ] `SUBMIT_BATAS_PER_IP` disesuaikan untuk sesi user testing (K-09)
- [ ] `SERVE_STATIC=0` bila Nginx yang menyajikan frontend (`backend/`)
- [ ] `FLASK_DEBUG` tidak diset
- [ ] Gunicorn bind ke `127.0.0.1`, 1 worker
- [ ] Nginx tidak mengarah ke folder `data/`, `backend/`, `core/`, atau `.git/`
- [ ] Permission: `data/dummy_files/` read-only; `*.csv`, `filemate.db`, `admin_*.json`, `.env` hanya bisa dibaca/ditulis user service (`chmod 600`)
- [ ] Service berjalan sebagai user non-root
- [ ] K-01 s.d. K-03 sudah ditutup
