# DATA SCHEMA — FileMate

Dokumen ini menjelaskan dua sumber data FileMate:

1. **`skenario.json`** — bank skenario (dibaca saja, dikelola tim).
2. **SQLite `filemate.db`** — data hasil pengguna (`scores`, `feedback`).

Ditambah **state sesi di memori** dan **file CSV ekspor**.

---

## 1. `skenario.json`

Lokasi: `data/scenarios/skenario.json` (sementara masih `data/skenario.json`; `config.py`
mencari keduanya). Dibaca oleh `backend/app/simulation/scenario.py`.

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
| `goodEnding`  | string (HTML) |  | ✘       | Ditampilkan jika 0 kesalahan |
| `badEnding`   | string (HTML) |  | ✘       | Ditampilkan jika ada kesalahan |
| `lessonTitle` | string   |       | ✔       | Judul pelajaran |
| `lessonBody`  | string   |       | ✔       | Isi pelajaran |
| `realLifeTip` | string (HTML) |  | ✔       | Tips dunia nyata |
| `files`       | File[]   | ✔     | ✔       | Daftar file dalam skenario |

\* **Publik** = ikut dikirim ke browser oleh `versi_publik()` saat `/api/session/start`.

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
| `payloadStatus` | string        |       | ✔      | Hasil "X-Ray" |
| `perm`          | string        | ✔     | ✔      | Permission gaya `ls -l`, mis. `-rwxr-xr-x` |
| `size`          | string        |       | ✔      | Ukuran tampilan, mis. `"14.2 MB"` |
| `hash`          | string (64 hex)| ✔    | ✔      | SHA-256 file (diisi asli oleh `buat_dummy.py`) |
| `expectedHash`  | string\|null  |       | ✔      | SHA-256 "resmi developer" untuk skenario HASH |
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
  dan mengisi `hash` dengan SHA-256 aslinya.
- Field HTML (`goodEnding`, `badEnding`, `realLifeTip`) hanya boleh memakai tag sederhana
  (`<strong>`, `<em>`, `<br>`, `<code>`) dan **tidak boleh** berisi masukan pengguna.
- File dummy **tidak boleh** berisi kode berbahaya sungguhan — hanya header (magic bytes) simulasi.

---

## 2. Database SQLite

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
`feedback_user.csv` lama ke SQLite **sekali saja**. Baris yang rusak dilewati.

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
    "file":      {file_id: {"scenario_id": ..., "isMalware": bool}},
    "keputusan": {file_id: "open" | "delete"},
    "hint":      {scenario_id, ...},            # set
}
```
- `session_id`: `secrets.token_urlsafe(16)`.
- Kedaluwarsa setelah `SESSION_TTL_DETIK` (3600 detik); dibersihkan setiap kali sesi baru dibuat.
- Maksimal `MAKS_SESI_AKTIF` (500) sesi.
- Dihapus saat `/finish`.

---

## 4. Ekspor CSV

Dibuat oleh `backend/app/admin/export.py` (unduhan admin) dan nantinya `scripts/export_csv.py`
(ke `data/exports/`). Setiap sel teks disanitasi ulang dengan `sanitasi_teks_csv()`.

| File                | Header |
|---------------------|--------|
| `hasil.csv`         | `nama_anonim,skor,waktu,kategori_risiko,dibuat` |
| `feedback_user.csv` | `kode_responden,inisial_anonim,skor,waktu_input,saran_dan_masukan` |

---

## 5. Aturan Skor (referensi)

Dari `backend/app/scoring/calculator.py`:

| Komponen                     | Nilai |
|------------------------------|-------|
| Skor awal                    | 100   |
| Membuka malware              | −15 per file |
| Menghapus file aman          | −5 per file |
| Memakai hint                 | −5 per skenario |
| Batas bawah                  | 0     |

| Skor   | Kategori risiko |
|--------|-----------------|
| 81–100 | RENDAH          |
| 51–80  | SEDANG          |
| 0–50   | TINGGI          |
