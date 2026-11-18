# SECURITY — FileMate

Dokumen ini merangkum kontrol keamanan FileMate untuk bahan sidang **Dasar Keamanan Siber (DKS)**.
Setiap kontrol ditautkan ke ancaman yang dicegah dan lokasi kodenya.

---

## 1. Aset & Model Ancaman

| Aset | Mengapa dilindungi |
|------|--------------------|
| Kunci jawaban skenario (`isMalware`, hint, ending) | Kalau bocor, simulasi tidak bermakna dan leaderboard bisa dicurangi |
| Data pengguna (nama, feedback) | Privasi peserta |
| Leaderboard | Integritas skor |
| Server & file sistem | Perintah Linux dijalankan dari input pengguna |
| PIN admin & data ekspor | Akses ke seluruh feedback |

| Pelaku | Kemampuan |
|--------|-----------|
| Peserta iseng | Membuka DevTools, mengubah request, mengirim skor palsu |
| Penyerang web | XSS, SQL Injection, Path Traversal, Command Injection, brute force PIN |
| Pengguna Excel (tim) | Membuka CSV ekspor yang mungkin berisi formula jahat |

---

## 2. Pemetaan ke CIA Triad

| Prinsip | Kontrol di FileMate |
|---------|---------------------|
| **Confidentiality** | Kunci jawaban hanya di server; nama disensor `R****T`; `data/` tidak disajikan ke browser; PIN di `.env`; scanner beranda tidak mengunggah file |
| **Integrity** | Skor dihitung server; keputusan per file dikunci; query SQL berparameter; constraint `CHECK` di tabel; verifikasi SHA-256 sebagai materi |
| **Availability** | Batas body 16 KB; batas 500 sesi aktif; TTL sesi 1 jam; timeout 3 detik untuk perintah Linux; rate limit login |

---

## 3. Daftar Kontrol

### S-01 Kunci jawaban disimpan di server
- **Ancaman:** Peserta membaca `isMalware` lewat DevTools/Network.
- **Kontrol:** `scenario.versi_publik()` menghapus `isMalware`, `hintText`, `goodEnding`, `badEnding`
  sebelum dikirim. Penilaian dilakukan di `service.putuskan()` dan `service.selesaikan()`.
- **Kode:** `backend/app/simulation/scenario.py`, `backend/app/simulation/service.py`

### S-02 Skor dihitung di server
- **Ancaman:** Mengirim `{"score": 100}` palsu.
- **Kontrol:** `/api/session/<sid>/finish` menghitung skor dari keputusan yang tersimpan di
  sesi, lalu menyimpannya sendiri. Keputusan tiap file hanya bisa dikirim sekali (`409`).
- **Kode:** `backend/app/simulation/routes.py`, `backend/app/scoring/calculator.py`

### S-03 Pseudonimisasi nama
- **Ancaman:** Kebocoran identitas peserta di leaderboard / database.
- **Kontrol:** `sensor_nama()` membuang karakter berbahaya, memotong 20 karakter, lalu hanya
  menyimpan huruf awal & akhir (`Rohit` → `R****T`). Nama asli tidak pernah disimpan.
- **Kode:** `backend/app/common/sanitize.py`

### S-04 Anti SQL Injection
- **Kontrol:** Semua query memakai placeholder `?` (tidak ada string formatting di SQL).
  Nilai juga dibatasi (`skor` 0–100, kategori dari daftar putih).
- **Kode:** `backend/app/leaderboard/repository.py`, `backend/app/feedback/repository.py`

### S-05 Anti XSS
- **Kontrol berlapis:**
  1. Backend: `sanitasi_teks_csv()` membuang `<` dan `>` dari feedback; `sensor_nama()` membuang `< > " ' & = + - @`.
  2. Frontend: `escapeHTML()` di `common.js` dipakai sebelum memasukkan data pengguna ke DOM.
  3. Header `X-Content-Type-Options: nosniff`.
- **Catatan:** field HTML di `skenario.json` adalah konten tepercaya milik tim, bukan input pengguna.

### S-06 Anti CSV / Formula Injection
- **Ancaman:** Feedback `=HYPERLINK("http://jahat")` tereksekusi saat CSV dibuka di Excel.
- **Kontrol:** Teks yang diawali `= + - @ \t \r` diberi awalan `'`. Disanitasi saat disimpan
  **dan** sekali lagi saat diekspor.
- **Kode:** `sanitasi_teks_csv()` di `common/sanitize.py`, `_sel()` di `admin/export.py`

### S-07 Anti Path Traversal
- **Ancaman:** `GET /api/hash?file=../../.env`
- **Kontrol:** `validasi_path_aman()` mengambil `basename()` saja (backslash dinormalisasi),
  menolak `.`/`..`, lalu memastikan path akhir berada di dalam `DUMMY_DIR` dengan `os.path.commonpath`.
- **Bukti uji:** `?file=../../app.py` → `400 "File dummy 'app.py' tidak ditemukan."`
- **Kode:** `backend/app/simulation/linux_utils.py`

### S-08 Anti Command Injection
- **Ancaman:** `?file=a.pdf; rm -rf /`
- **Kontrol:** `subprocess.run([...], shell=False)` — argumen dikirim sebagai list, tidak
  ditafsirkan shell. Ditambah validasi path S-07 dan `timeout=3` detik.
- **Kode:** `backend/app/simulation/linux_utils.py`

### S-09 Autentikasi admin
- PIN dibaca dari `.env` (`ADMIN_PIN`); jika kosong, menu admin **nonaktif** (`503`).
- Perbandingan constant-time `hmac.compare_digest` (anti timing attack).
- Rate limit: 5 kali gagal per 5 menit per IP → `429`.
- Sesi dibersihkan (`session.clear()`) saat login (anti session fixation).
- Cookie: `HttpOnly`, `SameSite=Strict`, `Secure` (aktifkan `COOKIE_SECURE=1` di HTTPS).
- `SameSite=Strict` sekaligus menjadi mitigasi CSRF untuk endpoint admin.
- **Kode:** `backend/app/admin/routes.py`, `backend/app/config.py`

### S-10 Security headers
Dipasang di setiap respons (`backend/app/__init__.py`):

| Header | Nilai | Fungsi |
|--------|-------|--------|
| `X-Frame-Options` | `DENY` | Anti clickjacking |
| `X-Content-Type-Options` | `nosniff` | Anti MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Batasi kebocoran URL |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Matikan API sensitif |
| `Cache-Control` | `no-store` (JSON & CSV) | Data tidak tersimpan di cache |

### S-11 Pembatasan sumber daya (DoS sederhana)
- `MAX_CONTENT_LENGTH = 16 KB` → `413`.
- Maks 500 sesi aktif → `503`; TTL sesi 1 jam.
- `limit` pada leaderboard (≤50) dan admin feedback (≤1000) dibatasi.

### S-12 Penanganan error yang aman
- Error `/api/*` dijawab JSON generik; detail exception hanya ditulis ke log server (`500`).
- `debug=True` hanya jika `FLASK_DEBUG=1` — **jangan** aktifkan di produksi.

### S-13 Rahasia & konfigurasi
- `SECRET_KEY` dan `ADMIN_PIN` di `.env` (tidak di-commit; lihat `.env.example`).
- Jika `SECRET_KEY` kosong, dibuat acak setiap start (sesi admin hilang saat restart — aman, tidak bocor).

### S-14 Privasi scanner beranda
- `inspector.js` membaca file pengguna dan menghitung SHA-256 **di browser** (Web Crypto).
  File tidak pernah dikirim ke server FileMate.

### S-15 Isolasi data
- Folder `data/` tidak pernah disajikan sebagai statis; Nginx hanya menyajikan `frontend/`.
- File dummy hanya berisi header simulasi, bukan malware asli.

---

## 4. Celah yang Diketahui (Known Issues)

Ditemukan saat menyusun dokumen ini (14/11/2026). Harus diperbaiki sebelum deploy.

| ID | Tingkat | Temuan | Rekomendasi |
|----|---------|--------|-------------|
| K-01 | **Tinggi** | PIN maintainer ditulis langsung di `tampilan/js/admin.js` (komentar & perbandingan `input.value === "..."`). Siapa pun bisa membacanya lewat View Source. | Hapus PIN dari JS; ganti dengan `apiPost('/admin/login', {pin})`. **Ganti PIN** karena sudah ter-commit di riwayat git. |
| K-02 | **Tinggi** | `GET /api/start-session` [LAMA] mengirim skenario lengkap dengan `isMalware`. | Migrasikan `game.js` ke `/api/session/*`, lalu hapus endpoint ini. |
| K-03 | **Tinggi** | `POST /api/submit-score` & `/api/submit-feedback` menerima skor dari klien (frontend `game.js`/`result.js` menghitung skor di browser) → leaderboard bisa dipalsukan. Mitigasi sementara (18/11/2026): skor harus int 0–100 kelipatan 5, kategori risiko dihitung server, rate limit 5 kiriman/IP/10 menit. | Migrasikan `game.js`/`result.js` ke `/api/session/*`, lalu hapus kedua endpoint ini. |
| K-04 | Sedang | Field publik `payloadStatus` (mis. `"Malicious System Deleter"`) praktis membocorkan jawaban. | Kirim `payloadStatus` hanya setelah pengguna menekan X-Ray (endpoint terpisah), atau samarkan teksnya. |
| K-05 | Sedang | Di belakang Nginx, `request.remote_addr` selalu `127.0.0.1` → rate limit login berlaku untuk **semua** orang sekaligus. | Pasang `werkzeug.middleware.proxy_fix.ProxyFix(x_for=1)` dan set `X-Forwarded-For` di Nginx. |
| K-06 | Rendah | Admin & leaderboard di mode fallback masih memakai `localStorage` (bisa diubah pengguna). | Hanya untuk demo offline; tampilkan label "mode demo". |
| K-07 | Rendah | Belum ada Content-Security-Policy. | Tambahkan CSP setelah inline script/style dipindah ke file `.js`/`.css`. |
| K-08 | Rendah | Sesi simulasi dan rate limit disimpan di memori → hilang saat restart, dan tidak bisa >1 worker. | Diterima untuk skala proyek; dokumentasikan di deployment. |

---

## 5. Checklist Deploy Aman

- [ ] `.env` berisi `SECRET_KEY` acak panjang (`python -c "import secrets;print(secrets.token_hex(32))"`)
- [ ] `ADMIN_PIN` baru (bukan PIN yang pernah ada di JS), minimal 8 karakter
- [ ] `COOKIE_SECURE=1` dan situs memakai HTTPS
- [ ] `SERVE_STATIC=0` (Nginx menyajikan frontend)
- [ ] `FLASK_DEBUG` tidak diset
- [ ] Gunicorn bind ke `127.0.0.1`, bukan `0.0.0.0`
- [ ] Nginx tidak mengarah ke folder `data/`, `backend/`, atau `.git/`
- [ ] Permission: `data/dummy_files/` read-only (`chmod 444` file, `555` folder); `filemate.db` hanya bisa ditulis user service
- [ ] Service berjalan sebagai user non-root
- [ ] K-01 s.d. K-03 sudah ditutup
