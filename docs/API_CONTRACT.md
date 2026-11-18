# API CONTRACT — FileMate

Base URL: `/api` (pengembangan: `http://127.0.0.1:5000/api`).
Semua body request & respons berformat JSON (`Content-Type: application/json`), kecuali unduhan CSV.
Body request maksimal **16 KB** (lebih dari itu → `413`).

---

## 1. Format Respons Standar

Didefinisikan di `backend/app/common/responses.py`.

```json
// Sukses
{ "status": "ok", "data": { ... } }

// Gagal
{ "status": "error", "message": "Pesan yang aman ditampilkan ke pengguna." }
```

| Kode | Arti |
|------|------|
| 200  | Berhasil |
| 201  | Data baru dibuat (sesi, feedback) |
| 400  | Input tidak valid |
| 401  | Belum login admin / PIN salah |
| 404  | Endpoint, sesi, file, atau skenario tidak ditemukan |
| 405  | Metode HTTP salah |
| 409  | Keputusan file sudah dikunci |
| 413  | Body terlalu besar |
| 429  | Terlalu banyak percobaan login |
| 500  | Error server (detail hanya di log server) |
| 503  | Server penuh (sesi) / admin belum diaktifkan |

> Endpoint bertanda **[LAMA]** belum memakai format standar ini dan disimpan hanya untuk
> kompatibilitas frontend lama. Jangan dipakai untuk fitur baru.

---

## 2. Ringkasan Endpoint

| Metode | Path                                 | Modul        | Auth  |
|--------|--------------------------------------|--------------|-------|
| POST   | `/api/session/start`                 | simulation   | –     |
| POST   | `/api/session/<sid>/decide`          | simulation   | sid   |
| POST   | `/api/session/<sid>/hint`            | simulation   | sid   |
| POST   | `/api/session/<sid>/finish`          | simulation   | sid   |
| GET    | `/api/inspect?file=<nama>`           | simulation   | –     |
| GET    | `/api/hash?file=<nama>`              | simulation   | –     |
| GET    | `/api/leaderboard?limit=<n>`         | leaderboard  | –     |
| GET    | `/api/dashboard-stats`               | leaderboard  | –     |
| POST   | `/api/feedback`                      | feedback     | –     |
| POST   | `/api/admin/login`                   | admin        | –     |
| POST   | `/api/admin/logout`                  | admin        | –     |
| GET    | `/api/admin/feedback?limit=<n>`      | admin        | admin |
| GET    | `/api/admin/export/<scores|feedback>`| admin        | admin |
| GET    | `/api/start-session` **[LAMA]**      | simulation   | –     |
| POST   | `/api/submit-score` **[AKTIF – result.js]** | app.py | –  |
| POST   | `/api/submit-feedback` **[AKTIF – result.js]** | app.py | – |

---

## 3. Simulasi

### 3.1 `POST /api/session/start`
Memulai sesi baru: memilih 1 skenario acak per kategori (SPOOFING, HASH, FATIGUE),
mengacak urutan skenario dan file.

**Request**
```json
{ "username": "Rohit" }
```
`username` opsional. Disensor menjadi `R****T`; kosong → `A****M`.

**Respons `201`**
```json
{
  "status": "ok",
  "data": {
    "session_id": "q3Zt1kX0d9...",
    "masked_name": "R****T",
    "scenarios": [
      {
        "id": "hash_forum_01",
        "type": "HASH",
        "title": "Verifikasi Paket Installer & Modul Runtime dari Forum",
        "story": "Kamu mengunduh Patch_Update_v2.zip ...",
        "path": "~/Downloads/Forum_Installer/",
        "hintAuthor": "Kaysan Nawfal (Backend & Scoring Logic)",
        "lessonTitle": "Prinsip Integrity (CIA Triad) ...",
        "lessonBody": "...",
        "realLifeTip": "...",
        "files": [
          {
            "id": "hs1_f1",
            "shownName": "Patch_Update_v2.zip",
            "realName": "Patch_Update_v2.zip",
            "fakeExt": null,
            "realExt": ".zip",
            "mime": "application/zip",
            "magicBytes": "50 4B 03 04 (ZIP Archive)",
            "payloadStatus": "Hash Mismatch! ...",
            "perm": "-rw-r--r--",
            "size": "14.2 MB",
            "hash": "e3b0c442...",
            "expectedHash": "e3b0c442..."
          }
        ]
      }
    ]
  }
}
```
Field yang **dihapus** dari versi publik: `isMalware` (file), `hintText`, `goodEnding`, `badEnding` (skenario).

**Error:** `503` jika sesi aktif sudah mencapai `MAKS_SESI_AKTIF` (500).

---

### 3.2 `POST /api/session/<sid>/decide`
Mengunci keputusan untuk satu file. Setiap file hanya bisa diputuskan **sekali**.

**Request**
```json
{ "file_id": "ft6", "action": "delete" }
```
`action` ∈ `"open"` | `"delete"`.

**Respons `200`**
```json
{
  "status": "ok",
  "data": {
    "file_id": "ft6",
    "action": "delete",
    "correct": true,
    "is_malware": true,
    "outcome": "safe"
  }
}
```
| `outcome`        | Arti                               |
|------------------|------------------------------------|
| `safe`           | Keputusan benar                    |
| `malware_opened` | Membuka file berbahaya (penalti -15)|
| `false_alarm`    | Menghapus file aman (penalti -5)   |

**Error**
```json
// 400 — action tidak valid
{ "status": "error", "message": "Aksi harus 'open' atau 'delete'." }
// 404 — sesi kedaluwarsa / file bukan milik sesi
{ "status": "error", "message": "File tidak ada di sesi ini." }
// 409 — file sudah diputuskan
{ "status": "error", "message": "Keputusan untuk file ini sudah dikunci." }
```

---

### 3.3 `POST /api/session/<sid>/hint`
Membuka hint satu skenario. Dihitung **sekali per skenario** (meminta ulang tidak menambah penalti).

**Request**
```json
{ "scenario_id": "fatigue_usb_01" }
```

**Respons `200`**
```json
{
  "status": "ok",
  "data": {
    "scenario_id": "fatigue_usb_01",
    "hint_author": "Muhamad Yazid Firdaus (Linux & Infrastructure)",
    "hint_text": "Jangan lengah saat memeriksa 10 file! ...",
    "hints_used": 1
  }
}
```
**Error:** `404` skenario tidak ada di sesi.

---

### 3.4 `POST /api/session/<sid>/finish`
Menghitung skor akhir, **menyimpan ke leaderboard**, dan menghapus sesi dari memori.
File yang belum diputuskan dianggap `open`. Body kosong.

**Respons `200`**
```json
{
  "status": "ok",
  "data": {
    "masked_name": "R****T",
    "score": 70,
    "risk_category": "SEDANG",
    "time": "02:14",
    "malware_opened": 1,
    "false_alarm": 2,
    "hints_used": 1,
    "scenarios": [
      {
        "scenario_id": "spoof_beasiswa_01",
        "title": "...",
        "mistakes": 1,
        "ending": "🎬 <strong>Ending Skenario Ini ...</strong>",
        "lesson_title": "...",
        "lesson_body": "...",
        "real_life_tip": "..."
      }
    ]
  }
}
```
> `ending`, `lesson_body`, `real_life_tip` berisi HTML terbatas dari `skenario.json` (data tepercaya milik tim).

**Error:** `404` sesi tidak ditemukan / sudah selesai.

---

### 3.5 `GET /api/inspect?file=<nama>`
Menjalankan `file -b --mime-type` dan `ls -l` pada file di `data/dummy_files/`.

**Respons `200`**
```json
{
  "status": "ok",
  "data": {
    "file": "Patch_Update_v2.zip",
    "mime_linux": "application/zip",
    "permission_linux": "-rw-r--r--",
    "engine": "Linux CLI (file --mime-type & ls -l)"
  }
}
```
`engine` bernilai `"Python os.stat (Fallback)"` bila perintah Linux tidak tersedia.

**Error `400`**
```json
{ "status": "error", "message": "File dummy 'app.py' tidak ditemukan." }
```

### 3.6 `GET /api/hash?file=<nama>`
**Respons `200`**
```json
{
  "status": "ok",
  "data": {
    "file": "Patch_Update_v2.zip",
    "sha256": "9f86d081884c7d65...",
    "engine": "Linux CLI (sha256sum)"
  }
}
```
Fallback: `"Python hashlib (Fallback)"`. Error sama seperti `/inspect`.

---

## 4. Leaderboard & Dashboard

### 4.1 `GET /api/leaderboard?limit=6`
`limit` 1–50 (default 6). Urut skor tertinggi, lalu waktu tercepat.

**Respons `200`** — *array langsung (belum memakai format standar)*
```json
[
  { "name": "R****T", "score": 95, "time": "01:12", "risk": "RENDAH" },
  { "name": "F****N", "score": 90, "time": "01:28", "risk": "RENDAH" }
]
```

### 4.2 `GET /api/dashboard-stats`
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

---

## 5. Feedback

### `POST /api/feedback`
**Request**
```json
{ "user": "R****T", "score": 80, "message": "Simulasinya membantu!" }
```
| Field     | Aturan |
|-----------|--------|
| `message` | wajib, tag `< >` dibuang, maks 300 karakter, diberi `'` bila diawali `= + - @` |
| `user`    | opsional (default `A****M`), maks 10 karakter |
| `score`   | dibatasi 0–100 |

**Respons `201`**
```json
{ "status": "ok", "data": { "kode_responden": "P02" } }
```
**Error `400`**
```json
{ "status": "error", "message": "Pesan feedback tidak boleh kosong." }
```

---

## 6. Admin (Maintainer)

Admin aktif hanya jika `ADMIN_PIN` diisi di `.env`. Autentikasi memakai cookie sesi Flask
(`HttpOnly`, `SameSite=Strict`). Frontend harus memanggil dengan `credentials: 'same-origin'`
(bawaan `fetch` untuk origin yang sama).

### 6.1 `POST /api/admin/login`
**Request** `{ "pin": "xxxxxx" }`

| Respons | Body |
|---------|------|
| `200` | `{ "status": "ok", "data": { "logged_in": true } }` |
| `401` | `{ "status": "error", "message": "PIN salah." }` |
| `429` | `{ "status": "error", "message": "Terlalu banyak percobaan. Coba lagi dalam 5 menit." }` |
| `503` | `{ "status": "error", "message": "Menu admin belum diaktifkan (ADMIN_PIN kosong)." }` |

### 6.2 `POST /api/admin/logout`
`200` → `{ "status": "ok", "data": { "logged_in": false } }`

### 6.3 `GET /api/admin/feedback?limit=100`
`limit` 1–1000. Urut terbaru dulu.
```json
{
  "status": "ok",
  "data": [
    {
      "kode_responden": "P02",
      "inisial_anonim": "R****T",
      "skor": 80,
      "waktu_input": "2026-11-14 13:54:36",
      "pesan": "Simulasinya membantu!"
    }
  ]
}
```
Tanpa login → `401 { "status": "error", "message": "Butuh login admin." }`

### 6.4 `GET /api/admin/export/<jenis>`
`jenis` ∈ `scores` | `feedback`. Respons berupa file CSV (UTF-8 dengan BOM agar terbaca Excel).

```
HTTP/1.1 200 OK
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="feedback_user.csv"

kode_responden,inisial_anonim,skor,waktu_input,saran_dan_masukan
P01,R****T,95,2026-11-14 13:54:36,Tampilan simulasi X-Ray ...
```
| jenis      | Nama file           | Kolom |
|------------|---------------------|-------|
| `scores`   | `hasil.csv`         | nama_anonim, skor, waktu, kategori_risiko, dibuat |
| `feedback` | `feedback_user.csv` | kode_responden, inisial_anonim, skor, waktu_input, saran_dan_masukan |

Jenis lain → `404`.

---

## 7. Endpoint Lama [LAMA]

Dipertahankan agar halaman yang belum dimigrasi tetap jalan. **Rencana: dihapus setelah
`game.js` dan `result.js` memakai `/api/session/*`.**

| Endpoint | Request | Respons | Masalah |
|----------|---------|---------|---------|
| `GET /api/start-session` | – | `{"1": skenario, "2": ..., "3": ...}` **lengkap dengan `isMalware`** | Kunci jawaban bocor ke browser |
| `POST /api/submit-score` | `{username, score, time}` — `score` int 0–100 kelipatan 5, `time` `MM:SS` | `201 {"status":"ok","data":{masked_name, score, time, risk_category}}`; `400` input tidak valid; `429` >5 kiriman/IP/10 menit | Skor berasal dari klien → masih bisa dipalsukan dalam batas validasi (K-03) |
| `POST /api/submit-feedback` | `{user, score, message}` — `user` disensor ulang di server | `201 {"status":"ok","data":{"saved":true}}`; `400`; `429` | Skor berasal dari klien (K-03) |

---

## 8. Contoh Pemakaian di Frontend

```js
// assets/js/api.js menyediakan apiGet / apiPost
const { data: sesi } = await apiPost('/session/start', { username });
const hasil = await apiPost(`/session/${sesi.session_id}/decide`, { file_id: 'ft6', action: 'delete' });
const akhir = await apiPost(`/session/${sesi.session_id}/finish`, {});
```
