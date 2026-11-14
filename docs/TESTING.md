# TESTING — FileMate

Panduan pengujian FileMate: unit test otomatis, uji API manual, uji keamanan, dan
checklist user testing.

---

## 1. Persiapan

```bash
pip install -r backend/requirements.txt
pip install pytest
```

Gunakan database terpisah agar data asli tidak tercampur:

```bash
# Linux / Git Bash
export DB_PATH=/tmp/filemate_test.db
export ADMIN_PIN=1234

# PowerShell
$env:DB_PATH = "$env:TEMP\filemate_test.db"
$env:ADMIN_PIN = "1234"
```

---

## 2. Unit Test Otomatis (`tests/`)

Jalankan dari root proyek:

```bash
pytest -v
```

| File | Yang diuji | Kasus minimum |
|------|------------|---------------|
| `test_scoring.py` | `nilai()`, `kategori_risiko()` | 0 kesalahan → 100 RENDAH; 1 malware → 85; skor tidak < 0; batas 50/51 dan 80/81 |
| `test_sanitize.py` | `sensor_nama()`, `sanitasi_teks_csv()`, `sanitasi_waktu()`, `ke_int()` | `Rohit` → `R****T`; kosong → `A****M`; `<script>` dibuang; `=1+1` → `'=1+1`; `99:99` → `00:00` |
| `test_scenario.py` | `pilih_skenario()`, `versi_publik()`, isi `skenario.json` | 1 skenario per kategori; `isMalware`/`hintText` tidak ada di versi publik; `id` unik; setiap `realName` ada di `dummy_files/` |
| `test_api.py` | Semua endpoint via Flask test client | alur start → decide → hint → finish; kode error 400/401/404/409/429 |

### 2.1 Fixture bersama (`tests/conftest.py`)

```python
import os, sys, pytest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
from app import create_app

@pytest.fixture
def app(tmp_path):
    return create_app({"DB_PATH": str(tmp_path / "test.db"), "ADMIN_PIN": "1234",
                       "LEGACY_HASIL_CSV": "", "LEGACY_FEEDBACK_CSV": ""})

@pytest.fixture
def client(app):
    return app.test_client()
```
> `create_app(config_override)` dipanggil setelah `Config` dimuat, sehingga override ini
> berlaku. Kosongkan path CSV lama agar database test benar-benar kosong.

### 2.2 Contoh test

```python
# tests/test_scoring.py
from app.scoring.calculator import nilai, kategori_risiko

def test_skor_sempurna():
    assert nilai(0, 0, 0) == (100, "RENDAH")

def test_penalti_gabungan():
    assert nilai(1, 1, 1) == (75, "SEDANG")      # 100 - 15 - 5 - 5

def test_skor_tidak_negatif():
    assert nilai(20, 0, 0) == (0, "TINGGI")

def test_batas_kategori():
    assert kategori_risiko(50) == "TINGGI"
    assert kategori_risiko(51) == "SEDANG"
    assert kategori_risiko(80) == "SEDANG"
    assert kategori_risiko(81) == "RENDAH"
```

```python
# tests/test_api.py
def test_alur_sesi(client):
    r = client.post("/api/session/start", json={"username": "Rohit"})
    assert r.status_code == 201
    data = r.get_json()["data"]
    assert data["masked_name"] == "R****T"
    for s in data["scenarios"]:
        assert "hintText" not in s
        assert all("isMalware" not in f for f in s["files"])

    sid, f = data["session_id"], data["scenarios"][0]["files"][0]
    assert client.post(f"/api/session/{sid}/decide", json={"file_id": f["id"], "action": "delete"}).status_code == 200
    assert client.post(f"/api/session/{sid}/decide", json={"file_id": f["id"], "action": "open"}).status_code == 409

    r = client.post(f"/api/session/{sid}/finish")
    assert r.status_code == 200
    assert 0 <= r.get_json()["data"]["score"] <= 100
    assert client.post(f"/api/session/{sid}/finish").status_code == 404   # sesi sudah dihapus

def test_path_traversal_ditolak(client):
    assert client.get("/api/hash?file=../../backend/wsgi.py").status_code == 400

def test_admin_wajib_login(client):
    assert client.get("/api/admin/feedback").status_code == 401

def test_rate_limit_login(client):
    for _ in range(5):
        client.post("/api/admin/login", json={"pin": "salah"})
    assert client.post("/api/admin/login", json={"pin": "1234"}).status_code == 429
```

---

## 3. Uji API Manual (curl)

Jalankan server: `python backend/wsgi.py`

```bash
B=http://127.0.0.1:5000/api

# Mulai sesi
curl -s -X POST $B/session/start -H "Content-Type: application/json" -d '{"username":"Rohit"}'

# Putuskan file (ganti SID & FILE_ID)
curl -s -X POST $B/session/SID/decide -H "Content-Type: application/json" -d '{"file_id":"FILE_ID","action":"delete"}'

# Hint & selesai
curl -s -X POST $B/session/SID/hint -H "Content-Type: application/json" -d '{"scenario_id":"SCENARIO_ID"}'
curl -s -X POST $B/session/SID/finish

# Utilitas Linux
curl -s "$B/inspect?file=Patch_Update_v2.zip"
curl -s "$B/hash?file=Patch_Update_v2.zip"

# Leaderboard & statistik
curl -s "$B/leaderboard?limit=3"
curl -s $B/dashboard-stats

# Feedback
curl -s -X POST $B/feedback -H "Content-Type: application/json" -d '{"user":"R****T","score":80,"message":"Bagus"}'

# Admin (simpan cookie)
curl -s -c jar.txt -X POST $B/admin/login -H "Content-Type: application/json" -d '{"pin":"1234"}'
curl -s -b jar.txt $B/admin/feedback
curl -s -b jar.txt -o feedback_user.csv $B/admin/export/feedback
```

---

## 4. Uji Keamanan

| ID | Uji | Langkah | Hasil yang diharapkan | Kontrol |
|----|-----|---------|-----------------------|---------|
| T-01 | Kunci jawaban tidak bocor | Buka DevTools → Network → respons `/session/start` | Tidak ada `isMalware`, `hintText`, `goodEnding`, `badEnding` | S-01 |
| T-02 | Keputusan ganda | Kirim `decide` 2x untuk file yang sama | Kedua kali `409` | S-02 |
| T-03 | Path traversal | `/api/hash?file=../../.env`, `?file=..%2F..%2F.env`, `?file=..\\..\\.env` | `400`, isi file tidak tampil | S-07 |
| T-04 | Command injection | `/api/inspect?file=a.pdf;ls` dan `?file=$(whoami)` | `400`, perintah tidak dijalankan | S-08 |
| T-05 | SQL injection | Feedback `{"message":"'); DROP TABLE scores;--"}` | Tersimpan sebagai teks biasa, tabel tetap ada | S-04 |
| T-06 | XSS | Nama `<img src=x onerror=alert(1)>`, feedback `<script>alert(1)</script>` | Tidak ada alert di leaderboard / menu admin | S-05 |
| T-07 | CSV injection | Feedback `=HYPERLINK("http://contoh")`, ekspor, buka di Excel | Sel tampil sebagai teks `'=HYPERLINK...` | S-06 |
| T-08 | Brute force PIN | 6x login dengan PIN salah | Percobaan ke-6 `429` | S-09 |
| T-09 | Akses admin tanpa login | `GET /api/admin/export/scores` tanpa cookie | `401` | S-09 |
| T-10 | Body besar | POST body > 16 KB | `413` | S-11 |
| T-11 | Security headers | `curl -I http://127.0.0.1:5000/api/leaderboard` | Ada `X-Frame-Options: DENY`, `nosniff`, `Cache-Control: no-store` | S-10 |
| T-12 | Folder data tertutup | Buka `/data/skenario.json` dan `/data/filemate.db` di browser | `404` | S-15 |
| T-13 | Scanner lokal | Scan file di beranda sambil memantau Network | Tidak ada upload file | S-14 |

---

## 5. Uji Lintas Lingkungan

| Lingkungan | Yang dicek | Hasil yang diharapkan |
|------------|------------|-----------------------|
| Windows (dev) | `/api/hash`, `/api/inspect` | Berhasil; `engine` = `... (Fallback)` bila perintah Linux tidak ada |
| Linux / server | Endpoint yang sama | `engine` = `Linux CLI (...)`; hash sama dengan `sha256sum` manual |
| Tanpa backend | Buka `page/index.html` langsung dari file | Halaman tetap tampil memakai data lokal |
| Tema | Gelap/terang di semua halaman | Teks terbaca, pilihan tersimpan |
| Layar HP (360 px) | Semua halaman | Tidak ada scroll horizontal |
| Browser | Chrome, Firefox, Edge | Fungsi utama berjalan |

---

## 6. Checklist User Testing

Lakukan dengan **minimal 5 responden** di luar tim. Catat kode responden (`P01`, `P02`, …) dari feedback.

### 6.1 Persiapan
- [ ] Server berjalan, database sudah di-reset (atau pakai `DB_PATH` khusus sesi uji)
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
Ekspor hasil dari menu admin (`hasil.csv` & `feedback_user.csv`), lalu catat rata-rata skor,
sebaran kategori risiko, dan 3 masukan utama di `CHANGELOG.md` atau laporan.

---

## 7. Hasil Uji Terakhir

| Tanggal | Penguji | Lingkup | Hasil |
|---------|---------|---------|-------|
| 14/11/2026 | Kaysan | Smoke test semua endpoint via Flask test client (Windows) | Semua endpoint merespons sesuai kontrak; path traversal ditolak (`400`); keputusan ganda `409`; admin tanpa login `401`; endpoint tak dikenal `404` JSON |
