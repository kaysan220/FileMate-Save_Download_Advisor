# DATA SCHEMA — FileMate

Dokumen ini menjelaskan sumber data FileMate *(diperbarui 21/11/2026)*:

1. **`skenario.json`** — bank skenario (dibaca saja, dikelola tim).
2. **Data hasil pengguna** — tergantung server yang dijalankan:
   - `app.py` → **CSV** `data/hasil.csv` & `data/feedback_user.csv` (bagian 2A)
   - `backend/` → **SQLite** `data/filemate.db` (bagian 2B)
3. **State sesi di memori**, **file CSV ekspor**, dan **data admin**.

---

## 1. `skenario.json`

Lokasi: `data/skenario.json` (`config.py` juga mencari `data/scenarios/skenario.json` lebih dulu).
Dibaca oleh `backend/app/simulation/scenario.py` (kedua server) dan `core/algorithms.py`
(`ringkasan_dashboard()` untuk `app.py`).

> **Aturan sinkron (wajib):** isi `skenario.json` harus **identik** dengan `SCENARIO_BANK` di
> `tampilan/js/scenario_data.js`. Frontend saat ini (`game.js`) menilai jawaban dari
> `SCENARIO_BANK` di browser, sedangkan statistik dashboard dihitung server dari `skenario.json`.
> Jika soal diubah, ubah **keduanya**, lalu jalankan `python data/buat_dummy.py` dan
> `python -m unittest tests.test_sinkron_frontend` (tes `test_skenario_json_sama_dengan_scenario_bank_frontend`).

### 1.1 Struktur tingkat atas

```json
{
  "SPOOFING": [ <Skenario>, ... ],
  "HASH":     [ <Skenario>, ... ],
  "FATIGUE":  [ <Skenario>, ... ]
}
```
Setiap sesi mengambil **1 skenario acak per kategori**. Kategori yang kosong dilewati.
Isi saat ini: SPOOFING 2, HASH 1, FATIGUE 1 skenario (19 file, 9 malware).

### 1.2 Objek Skenario

| Field         | Tipe     | Wajib | Publik* | Keterangan |
|---------------|----------|-------|---------|------------|
| `id`          | string   | ✔     | ✔       | Unik di seluruh bank, mis. `hash_forum_01` |
| `type`        | string   | ✔     | ✔       | `SPOOFING` \| `HASH` \| `FATIGUE` |
| `title`       | string   | ✔     | ✔       | Judul kasus |
| `story`       | string   | ✔     | ✔       | Narasi kasus |
| `path`        | string   | ✔     | ✔       | Folder palsu, mis. `~/Downloads/Forum_Installer/` |
| `hintAuthor`  | string   |       | ✔       | Nama anggota tim pemberi hint |
| `hintText`    | string   |       | ✘       | Isi hint — hanya lewat `/hint` (penalti) |
| `goodEnding`  | string (HTML) |  | ✘       | Ditampilkan jika tidak ada malware yang dibuka |
| `badEnding`   | string (HTML) |  | ✘       | Ditampilkan jika ada malware yang dibuka |
| `lessonTitle` | string   |       | ✘       | Judul pelajaran — dikirim lewat `/decide` saat skenario selesai |
| `lessonBody`  | string (HTML) |  | ✘       | Isi pelajaran — idem |
| `realLifeTip` | string (HTML) |  | ✘       | Tips dunia nyata — idem |
| `files`       | File[]   | ✔     | ✔       | Daftar file dalam skenario |

\* **Publik** = ikut dikirim ke browser oleh `versi_publik()` saat `/api/session/start`
(alur sesi). Frontend lama yang memuat `SCENARIO_BANK` tetap melihat semua field (SECURITY.md K-02).

### 1.3 Objek File

| Field           | Tipe          | Wajib | Publik | Keterangan |
|-----------------|---------------|-------|--------|------------|
| `id`            | string        | ✔     | ✔      | Unik di seluruh bank, mis. `hs1_f1` |
| `shownName`     | string        | ✔     | ✔      | Nama yang terlihat pengguna (bisa menyamar) |
| `realName`      | string        | ✔     | ✔      | Nama file fisik di `data/dummy_files/` |
| `fakeExt`       | string\|null  |       | ✔      | Ekstensi palsu (mis. `.pdf` pada `.pdf.exe`) |
| `realExt`       | string        | ✔     | ✔      | Ekstensi asli |
| `mime`          | string        | ✔     | ✔      | MIME type asli |
| `magicBytes`    | string        | ✔     | ✔      | Deskripsi header, mis. `"50 4B 03 04 (ZIP Archive)"` |
| `payloadStatus` | string        |       | ✘      | Hasil "X-Ray" (praktis membocorkan jawaban) — dikirim lewat `/decide` |
| `perm`          | string        | ✔     | ✔      | Permission gaya `ls -l`, mis. `-rwxr-xr-x` |
| `size`          | string        |       | ✔      | Ukuran tampilan, mis. `"14.2 MB"` |
| `hash`          | string (64 hex)| ✔    | ✔      | SHA-256 **naratif** yang ditampilkan di soal. *Bukan* hash asli file dummy (`/api/hash` menghitung hash asli yang berbeda) |
| `expectedHash`  | string\|null  |       | ✔      | SHA-256 "resmi developer" untuk dicocokkan dengan `hash` |
| `isMalware`     | boolean       | ✔     | ✘      | **Kunci jawaban** — hanya di server |

### 1.4 Contoh

```json
{
  "id": "hash_forum_01",
  "type": "HASH",
  "title": "Verifikasi Paket Installer & Modul Runtime dari Forum",
  "story": "Kamu mengunduh Patch_Update_v2.zip ...",
  "path": "~/Downloads/Forum_Installer/",
  "hintAuthor": "Kaysan Nawfal (Backend & Scoring Logic)",
  "hintText": "Klik '#️⃣ Cek SHA-256' ...",
  "goodEnding": "🎬 <strong>Ending Skenario Ini (Keputusan Tepat!):</strong> ...",
  "badEnding": "🎬 <strong>Ending Skenario Ini (Insiden Terjadi!):</strong> ...",
  "lessonTitle": "Prinsip Integrity (CIA Triad) Melalui Verifikasi SHA-256",
  "lessonBody": "Nama dan ukuran file yang tampak sama tidak menjamin keaslian isinya ...",
  "realLifeTip": "Selalu jalankan <code>sha256sum</code> ...",
  "files": [
    {
      "id": "hs1_f1",
      "shownName": "Patch_Update_v2.zip",
      "realName": "Patch_Update_v2.zip",
      "fakeExt": null,
      "realExt": ".zip",
      "mime": "application/zip",
      "magicBytes": "50 4B 03 04 (ZIP Archive)",
      "payloadStatus": "Hash Mismatch! (Isi arsip telah dimodifikasi pihak ketiga)",
      "perm": "-rw-r--r--",
      "size": "14.2 MB",
      "hash": "e3b0c44298fc1c149afbf4c8996fb92499999999649b934ca495991b7852b855",
      "expectedHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "isMalware": true
    }
  ]
}
```

### 1.5 Aturan penulisan skenario
- `id` skenario dan `id` file **harus unik** di seluruh bank (state sesi memakai `id` sebagai kunci).
- `realName` harus ada sebagai file di `data/dummy_files/` agar `/api/inspect` & `/api/hash` berhasil.
  Jalankan `python data/buat_dummy.py` setelah menambah file baru — skrip membuat file dummy aman
  berisi header sesuai `magicBytes` (`%PDF`, `FF D8 FF`, `89 50 4E 47`, `50 4B 03 04`, `D0 CF 11 E0`,
  `#!/bin/sh`, `4D 5A`, lainnya teks) dan mengatur `chmod 755`/`644` sesuai `perm`. Skrip **tidak**
  mengubah `skenario.json`. Saat ini ada **19 file** dummy (satu per file skenario).
- Field HTML (`goodEnding`, `badEnding`, `realLifeTip`) hanya boleh memakai tag sederhana
  (`<strong>`, `<em>`, `<br>`, `<code>`) dan **tidak boleh** berisi masukan pengguna.
- File dummy **tidak boleh** berisi kode berbahaya sungguhan — hanya header (magic bytes) simulasi.

---

## 2A. CSV (`app.py`)

Ditulis oleh `core/algorithms.py` (`tulis_log()`, `tulis_feedback()`); penulisan dikunci
(`threading.Lock`) karena server berjalan multi-thread. Kosongkan lewat menu admin
(`core/admin_data.kosongkan_data()` — baris header tetap).

| File | Header | Contoh baris |
|------|--------|--------------|
| `data/hasil.csv` | `nama_anonim,skor,waktu,kategori_risiko` | `R****T,85,01:45,RENDAH` |
| `data/feedback_user.csv` | `kode_responden,inisial_anonim,skor,waktu_input,saran_dan_masukan` | `P01,R****T,85,2026-11-21 10:15:00,Simulasinya membantu!` |

- `kode_responden` = jumlah baris data + 1 (`P01`, `P02`, …), mulai lagi dari `P01` setelah dikosongkan.
- `waktu_input` memakai format `YYYY-MM-DD HH:MM:SS` (sama dengan `created_at` di SQLite).
- Aturan nilai sama dengan tabel SQLite di bawah (skor 0–100, kategori daftar putih, teks disanitasi).

## 2B. Database SQLite (`backend/`)

Lokasi: `data/filemate.db` (bisa diganti lewat env `DB_PATH`). Skema dibaca dari
`database/schema.sql`; jika file itu belum ada, dipakai `SKEMA_BAWAAN` di `backend/app/db.py`.
Database dibuat otomatis saat `create_app()` dijalankan.

### 2.1 Tabel `scores`

```sql
CREATE TABLE IF NOT EXISTS scores (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    nama_anonim      TEXT    NOT NULL,
    skor             INTEGER NOT NULL CHECK (skor BETWEEN 0 AND 100),
    waktu            TEXT    NOT NULL,
    kategori_risiko  TEXT    NOT NULL CHECK (kategori_risiko IN ('RENDAH','SEDANG','TINGGI')),
    created_at       TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_scores_skor ON scores (skor DESC, waktu ASC);
```

| Kolom             | Contoh                | Keterangan |
|-------------------|-----------------------|------------|
| `nama_anonim`     | `R****T`              | Hasil `sensor_nama()` — nama asli **tidak pernah** disimpan |
| `skor`            | `85`                  | 0–100 |
| `waktu`           | `01:45`               | Durasi `mm:ss` |
| `kategori_risiko` | `RENDAH`              | `>80` RENDAH, `51–80` SEDANG, `≤50` TINGGI |
| `created_at`      | `2026-11-14 13:54:36` | Waktu lokal server |

### 2.2 Tabel `feedback`

```sql
CREATE TABLE IF NOT EXISTS feedback (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    inisial_anonim   TEXT    NOT NULL,
    skor             INTEGER NOT NULL,
    pesan            TEXT    NOT NULL,
    created_at       TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);
```

| Kolom            | Contoh                     | Keterangan |
|------------------|----------------------------|------------|
| `inisial_anonim` | `R****T`                   | Maks 10 karakter |
| `skor`           | `80`                       | Skor pengguna saat memberi feedback |
| `pesan`          | `Simulasinya membantu!`    | Sudah disanitasi, maks 300 karakter |
| `created_at`     | `2026-11-14 13:54:36`      | |

Kode responden **tidak disimpan**, tetapi dibentuk dari `id`: `P{id:02d}` → `P01`, `P02`, …

### 2.3 Diagram

```
┌────────────────────────┐      ┌────────────────────────┐
│ scores                 │      │ feedback               │
├────────────────────────┤      ├────────────────────────┤
│ id  PK                 │      │ id  PK                 │
│ nama_anonim            │      │ inisial_anonim         │
│ skor        0..100     │      │ skor                   │
│ waktu       mm:ss      │      │ pesan       ≤300 char  │
│ kategori_risiko        │      │ created_at             │
│ created_at             │      └────────────────────────┘
└────────────────────────┘
```
Kedua tabel sengaja **tidak berelasi** — feedback bersifat anonim dan tidak ditautkan ke skor.

### 2.4 Migrasi dari CSV lama
Saat tabel masih kosong, `db._impor_csv_lama()` menyalin isi `hasil.csv` dan
`feedback_user.csv` lama ke SQLite **sekali seumur database** (penanda `csv_lama_diimpor` di tabel
`meta`), sehingga data yang sudah di-reset admin tidak muncul lagi setelah restart. Baris yang rusak
dilewati. Setelah itu data CSV dan SQLite **tidak disinkronkan** — tiap server menulis ke
penyimpanannya sendiri.

| CSV lama            | Kolom yang dibaca                              | Tabel tujuan |
|---------------------|------------------------------------------------|--------------|
| `hasil.csv`         | nama_anonim, skor, waktu, kategori_risiko      | `scores`     |
| `feedback_user.csv` | inisial_anonim, skor, saran_dan_masukan        | `feedback`   |

---

## 3. State Sesi Simulasi (memori)

Disimpan di dict `_sesi` pada `backend/app/simulation/service.py`, dilindungi `threading.Lock`.
**Tidak** disimpan ke database.

```python
_sesi[session_id] = {
    "nama":      "R****T",
    "mulai":     1763100000.0,                  # time.time()
    "skenario":  {scenario_id: <Skenario lengkap>},
    "urutan":    [scenario_id, ...],            # urutan tampilan
    "file":      {file_id: {"scenario_id": ..., "isMalware": bool,
                            "payloadStatus": "...", "realName": "..."}},
    "keputusan": {file_id: "open" | "delete"},
    "urutan_keputusan": [file_id, ...],         # untuk riwayat di halaman hasil
    "impulsif":  0,                             # keputusan tanpa inspeksi
    "hint":      {scenario_id, ...},            # set
}

_hasil[session_id] = {                          # setelah /finish, menunggu /save & /feedback
    "selesai":  1763100300.0,
    "hasil":    {score, risk_category, time, mistakes, history, scenarios, ...},
    "nama":     None | "R****T",                # terisi setelah /save (1x)
    "feedback": False | True,                   # True setelah /feedback (1x)
}
```
- `session_id`: `secrets.token_urlsafe(16)`.
- `_sesi` & `_hasil` kedaluwarsa setelah `SESSION_TTL_DETIK` (3600 detik); dibersihkan setiap kali sesi baru dibuat.
- Maksimal `MAKS_SESI_AKTIF` (500) sesi.
- `/finish` memindahkan sesi dari `_sesi` ke `_hasil`.

### 3.1 Batas kiriman frontend (memori)
`backend/app/common/kiriman.py` menyimpan `_riwayat[(jenis, ip)] = [timestamp, ...]` untuk
`/api/submit-score` (`jenis="skor"`) dan `/api/submit-feedback` (`jenis="feedback"`). Hilang saat restart.

### 3.2 Data admin (file JSON, tidak boleh di-commit)
| File | Isi |
|------|-----|
| `data/admin_password.json` | `algoritma`, `iterasi` (200000), `salt`, `hash` PBKDF2, `diperbarui` |
| `data/admin_lock.json` | hitungan password salah per IP & global, waktu tunda, percobaan password cadangan |

---

## 4. Ekspor CSV

Dibuat oleh `backend/app/admin/export.py` (`backend/`) atau `core/admin_data.py` (`app.py`) lewat
`GET /api/admin/export/<scores|feedback>`. Setiap sel teks disanitasi ulang dengan `sanitasi_teks_csv()`.
File diawali BOM UTF-8 agar terbaca benar di Excel.

| File                | Header `backend/` | Header `app.py` |
|---------------------|-------------------|-----------------|
| `hasil.csv`         | `nama_anonim,skor,waktu,kategori_risiko,dibuat` | `nama_anonim,skor,waktu,kategori_risiko` |
| `feedback_user.csv` | `kode_responden,inisial_anonim,skor,waktu_input,saran_dan_masukan` | sama |

---

## 5. Aturan Skor (referensi)

Dari `backend/app/scoring/calculator.py`:

| Komponen                     | Nilai |
|------------------------------|-------|
| Skor awal                    | 100   |
| Membuka malware              | −15 per file |
| Menghapus file aman          | −5 per file |
| Memakai hint                 | −5 per skenario (alur sesi) / −5 per klik (frontend saat ini) |
| Batas bawah                  | 0     |

Karena semua nilai kelipatan 5, skor yang valid selalu kelipatan 5 — dipakai server untuk
menolak skor kiriman frontend yang mustahil (`KELIPATAN_SKOR` di `calculator.py`).

| Skor   | Kategori risiko |
|--------|-----------------|
| 81–100 | RENDAH          |
| 51–80  | SEDANG          |
| 0–50   | TINGGI          |
