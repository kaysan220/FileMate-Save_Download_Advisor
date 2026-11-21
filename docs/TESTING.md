# TESTING — FileMate

Panduan pengujian FileMate: unit test otomatis, uji API manual, uji keamanan, dan
checklist user testing. *(Diperbarui 21/11/2026.)*

---

## 1. Persiapan

```bash
pip install -r backend/requirements.txt
```

Tes memakai `unittest` bawaan Python (tanpa pytest) dan menyalin data ke folder sementara,
jadi `data/hasil.csv`, `data/feedback_user.csv`, dan `data/filemate.db` asli **tidak tersentuh**.
Node.js (opsional) dipakai untuk membandingkan `skenario.json` dengan `SCENARIO_BANK` frontend;
jika tidak ada, tes itu otomatis di-skip.

---

## 2. Unit Test Otomatis (`tests/`)

Jalankan dari root proyek:

```bash
python -m unittest discover -s tests -v
# atau per file:
python -m unittest tests.test_linux_utils -v
python -m unittest tests.test_sinkron_frontend -v
```

| File | Yang diuji | Jumlah |
|------|------------|--------|
| `test_linux_utils.py` | `core/linux_utils.py`: nama berbahaya ditolak, path traversal & symlink, `shell=False` + `--`, timeout/exit code/keluaran aneh → `UtilitasLinuxError`, pesan error tidak bocor, fallback non-Linux berlabel, tes Linux asli | 18 (3 di-skip di Windows) |
| `test_sinkron_frontend.py` | 4 endpoint yang dipanggil frontend (`/api/dashboard-stats`, `/api/leaderboard`, `/api/submit-score`, `/api/submit-feedback`) dengan body **persis seperti `result.js`**, dijalankan ke **kedua** server (`app.py` CSV & `backend/` SQLite); validasi skor/waktu; batas kiriman per IP; sanitasi; logika `core/algorithms.py` == `backend/app`; `skenario.json` == `SCENARIO_BANK`; semua file skenario ada di `dummy_files/` | 30 |

Rencana tambahan (belum ada): `test_scenario.py` (alur `/api/session/*`), `test_admin.py`
(setup/login/penundaan dengan `ADMIN_PASSWORD_PATH` & `ADMIN_LOCK_PATH` sementara).

### 2.1 Pola fixture

```python
# backend/ dengan database sementara
from backend.app import create_app
app = create_app({"TESTING": True, "DB_PATH": str(tmp / "test.db"),
                  "LEGACY_HASIL_CSV": "", "LEGACY_FEEDBACK_CSV": ""})

# app.py (root) — dimuat dengan nama lain agar tidak bentrok dengan paket backend/app,
# lalu path CSV diarahkan ke folder sementara
mock.patch.object(core.algorithms, "HASIL_CSV_PATH", str(tmp / "hasil.csv"))
mock.patch.object(core.algorithms, "FEEDBACK_CSV_PATH", str(tmp / "feedback_user.csv"))

# batas kiriman per IP disimpan di memori -> kosongkan tiap tes
backend.app.common.kiriman.reset_batas_kiriman()
```

---

## 3. Uji API Manual (curl)

Jalankan salah satu server: `python app.py` atau `python backend/wsgi.py`.

```bash
B=http://127.0.0.1:5000/api

# --- Endpoint yang dipakai frontend ---
curl -s $B/dashboard-stats
curl -s "$B/leaderboard?limit=3"
curl -s -X POST $B/submit-score    -H "Content-Type: application/json" -d '{"username":"Rohit","score":85,"time":"01:45"}'
curl -s -X POST $B/submit-feedback -H "Content-Type: application/json" -d '{"user":"R****T","score":85,"message":"Bagus"}'
curl -s -X POST $B/submit-score    -H "Content-Type: application/json" -d '{"username":"x","score":87,"time":"01:45"}'   # 400

# --- Alur sesi (skor dihitung server) ---
curl -s -X POST $B/session/start
curl -s -X POST $B/session/SID/decide -H "Content-Type: application/json" -d '{"file_id":"FILE_ID","action":"delete","inspected":true}'
curl -s -X POST $B/session/SID/hint   -H "Content-Type: application/json" -d '{"scenario_id":"SCENARIO_ID"}'
curl -s -X POST $B/session/SID/finish
curl -s -X POST $B/session/SID/save   -H "Content-Type: application/json" -d '{"username":"Rohit"}'

# --- Utilitas Linux ---
curl -s "$B/inspect?file=Patch_Update_v2.zip"
curl -s "$B/hash?file=Patch_Update_v2.zip"

# --- Admin (kirim SHA-256 dari password, simpan cookie) ---
H=$(printf '%s' 'password-admin' | sha256sum | cut -d' ' -f1)
curl -s $B/admin/status
curl -s -c jar.txt -X POST $B/admin/login -H "Content-Type: application/json" -d "{\"password_hash\":\"$H\"}"
curl -s -b jar.txt $B/admin/feedback
curl -s -b jar.txt -o feedback_user.csv $B/admin/export/feedback
```

---

## 4. Uji Keamanan

| ID | Uji | Langkah | Hasil yang diharapkan | Kontrol |
|----|-----|---------|-----------------------|---------|
| T-01 | Kunci jawaban tidak bocor (server) | DevTools → Network → respons `/session/start` | Tidak ada `isMalware`, `payloadStatus`, `hintText`, ending | S-01 |
| T-02 | Keputusan ganda | Kirim `decide` 2x untuk file yang sama | Kedua kali `409` | S-02 |
| T-03 | Path traversal | `/api/hash?file=../../.env`, `?file=..%2F..%2F.env`, `?file=..\\..\\.env` | `400`, isi file tidak tampil | S-07 |
| T-04 | Command injection | `/api/inspect?file=a.pdf;ls`, `?file=$(whoami)`, `?file=-rf` | `400` (file tidak ada), perintah tidak dijalankan | S-08 |
| T-05 | SQL injection | Feedback `{"message":"'); DROP TABLE scores;--"}` | Tersimpan sebagai teks biasa, tabel tetap ada | S-04 |
| T-06 | XSS | Nama `<img src=x onerror=alert(1)>`, feedback `<script>alert(1)</script>` | Tidak ada alert di leaderboard / menu admin | S-05 |
| T-07 | CSV injection | Feedback `=HYPERLINK("http://contoh")`, ekspor, buka di Excel | Sel tampil sebagai teks `'=HYPERLINK...` | S-06 |
| T-08 | Brute force password admin | 5x `POST /admin/login` dengan hash salah | Percobaan ke-5 `429` + `Retry-After: 30` | S-09 |
| T-09 | Akses admin tanpa login | `GET /api/admin/export/scores` tanpa cookie | `401` | S-09 |
| T-10 | Body besar | POST body > 16 KB | `413` | S-11 |
| T-11 | Security headers | `curl -I http://127.0.0.1:5000/api/leaderboard` | Ada `X-Frame-Options: DENY`, `nosniff` | S-10 |
| T-12 | Folder data tertutup | Buka `/data/skenario.json` dan `/data/filemate.db` di browser | `404` | S-15 |
| T-13 | Scanner lokal | Scan file di beranda sambil memantau Network | Tidak ada upload file | S-14 |
| T-14 | Skor palsu di luar aturan | `submit-score` dengan `score` 87 / 101 / `"85"` / `true` | `400 "Skor tidak valid."` | S-16 |
| T-15 | Spam leaderboard | 6x `submit-score` dalam 10 menit dari IP yang sama | Ke-6 `429` | S-16 |

> T-08 dan T-15 mengubah state penundaan/batas. Jalankan di server uji, atau hapus
> `data/admin_lock.json` dan restart server setelahnya.

---

## 5. Uji Lintas Lingkungan

| Lingkungan | Yang dicek | Hasil yang diharapkan |
|------------|------------|-----------------------|
| Windows (dev) | `/api/hash`, `/api/inspect` di `app.py` | Berhasil; `engine` berisi `fallback non-Linux`, `mime_linux: null` |
| Windows (dev) | Endpoint yang sama di `backend/` | Memakai `sha256sum` Git Bash bila ada di PATH, selain itu `(Fallback)` |
| Linux / server | Endpoint yang sama | `engine` = `Linux CLI (...)`; hash sama dengan `sha256sum` manual |
| Tanpa backend | Buka `page/index.html` langsung dari file | Halaman tetap tampil memakai data lokal (`SCENARIO_BANK` + `localStorage`) |
| Tema | Gelap/terang di semua halaman | Teks terbaca, pilihan tersimpan |
| Layar HP (360 px) | Semua halaman | Tidak ada scroll horizontal |
| Browser | Chrome, Firefox, Edge | Fungsi utama berjalan |

---

## 6. Checklist User Testing

Lakukan dengan **minimal 5 responden** di luar tim. Catat kode responden (`P01`, `P02`, …) dari feedback.

### 6.1 Persiapan
- [ ] Server berjalan, data sudah di-reset (menu admin → clear, atau `DB_PATH` khusus sesi uji)
- [ ] `SUBMIT_BATAS_PER_IP` dinaikkan bila responden memakai Wi-Fi yang sama (SECURITY.md K-09)
- [ ] Formulir observasi & stopwatch siap
- [ ] Responden belum pernah melihat kunci jawaban

### 6.2 Skenario tugas

| No | Tugas untuk responden | Indikator berhasil |
|----|-----------------------|--------------------|
| 1 | Buka beranda dan temukan cara memulai simulasi | < 30 detik tanpa bantuan |
| 2 | Pindai satu file milikmu di scanner beranda | Hasil scan terbaca dan dipahami |
| 3 | Selesaikan 3 kasus simulasi | Semua kasus selesai |
| 4 | Gunakan X-Ray Inspect dan Cek SHA-256 minimal sekali | Fitur ditemukan sendiri |
| 5 | Baca halaman hasil: skor, kategori risiko, dan pelajaran | Bisa menjelaskan kesalahannya |
| 6 | Kirim feedback | Feedback tersimpan |
| 7 | Buka halaman panduan dan temukan materi ekstensi ganda | Materi ditemukan |

### 6.3 Yang diamati
- [ ] Waktu penyelesaian simulasi
- [ ] Skor & kategori risiko
- [ ] Jumlah hint yang dipakai
- [ ] Titik di mana responden bingung / bertanya
- [ ] Error atau tampilan rusak

### 6.4 Pertanyaan pasca-uji (skala 1–5)
1. Simulasi mudah dipahami.
2. Saya sekarang bisa mengenali ekstensi ganda (`.pdf.exe`).
3. Saya paham kegunaan pengecekan SHA-256.
4. Hint dan pelajaran di halaman hasil membantu.
5. Tampilan nyaman dilihat.
6. Saya akan merekomendasikan FileMate ke teman.

### 6.5 Rekap
Ekspor hasil dari server (`hasil.csv` & `feedback_user.csv` — menu admin, atau langsung dari
`data/` bila memakai `app.py`), lalu catat rata-rata skor, sebaran kategori risiko, dan 3 masukan
utama di `CHANGELOG.md` atau laporan.

---

## 7. Hasil Uji Terakhir

| Tanggal | Penguji | Lingkup | Hasil |
|---------|---------|---------|-------|
| 14/11/2026 | Kaysan | Smoke test semua endpoint via Flask test client (Windows) | Semua endpoint merespons sesuai kontrak; path traversal ditolak (`400`); keputusan ganda `409`; admin tanpa login `401`; endpoint tak dikenal `404` JSON |
| 21/11/2026 | Kaysan (dibantu Claude) | `python -m unittest tests.test_linux_utils tests.test_sinkron_frontend` (Windows, Python 3.10, Node 26) | **48 tes OK, 3 di-skip** (tes Linux asli & symlink). Kedua server menjawab identik untuk 4 endpoint frontend |
