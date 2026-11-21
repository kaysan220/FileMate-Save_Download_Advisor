# =====================================================================
# MODUL ALGORITMA & LOGIKA PENILAIAN — TUGAS KAYSAN NAWFAL & ROHIT
# Mata Kuliah: Algoritma & Pemrograman + Dasar Keamanan Siber
# Berisi 5 Fungsi Modular Utama sesuai panduan Mini PBL:
#   1. baca_skenario()      -> Membaca & mengacak 3 skenario dari skenario.json
#   2. nilai()              -> Menghitung skor akhir & klasifikasi kategori risiko
#      kategori_risiko()    -> Percabangan kategori (dipakai nilai() & tulis_log())
#   3. sensor_nama()        -> Pseudonimisasi nama user (R****T) & Sanitasi Anti-XSS
#   4. tulis_log()          -> Menyimpan skor ke hasil.csv (Anti-CSV Injection)
#   5. tulis_feedback()     -> Menyimpan masukan responden ke feedback_user.csv
#   6. ringkasan_dashboard()-> Statistik ikhtisar untuk halaman dashboard.html
#
# SINKRON dengan backend/ (versi SQLite): aturan skor, kategori risiko,
# sensor nama, sanitasi CSV, dan format data yang dikembalikan sama persis
# dengan backend/app/scoring/calculator.py & backend/app/common/sanitize.py
# (diuji di tests/test_sinkron_frontend.py).
# =====================================================================
import os
import json
import csv
import random
import re
import threading
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKENARIO_PATH = os.path.join(BASE_DIR, "data", "skenario.json")
HASIL_CSV_PATH = os.path.join(BASE_DIR, "data", "hasil.csv")
FEEDBACK_CSV_PATH = os.path.join(BASE_DIR, "data", "feedback_user.csv")

KATEGORI_VALID = ("RENDAH", "SEDANG", "TINGGI")
_AWALAN_FORMULA = ("=", "+", "-", "@", "\t", "\r")
# Inisial yang SUDAH disensor (R****T / A****) — dikirim result.js ke /api/submit-feedback
_POLA_SUDAH_DISENSOR = re.compile(r"[^*]\*{4}[^*]?")
# Server Flask berjalan multi-thread: penulisan CSV dikunci agar baris & kode
# responden (P01, P02, ...) tidak bertabrakan.
_kunci_csv = threading.Lock()


# 1. FUNGSI MEMBACA & MENGACAK SKENARIO (TUGAS ROHIT & KAYSAN)
def baca_skenario():
    """
    Membaca bank skenario dari data/skenario.json, memilih 1 soal acak
    dari masing-masing kategori (SPOOFING, HASH, FATIGUE), lalu mengacak
    urutan kemunculan soal dan urutan file di dalamnya.
    """
    with open(SKENARIO_PATH, "r", encoding="utf-8") as f:
        bank = json.load(f)

    terpilih = [
        random.choice(bank["SPOOFING"]),
        random.choice(bank["HASH"]),
        random.choice(bank["FATIGUE"])
    ]
    random.shuffle(terpilih)

    sesi_skenario = {}
    for idx, sken in enumerate(terpilih, start=1):
        kopi_sken = dict(sken)
        kopi_files = list(kopi_sken["files"])
        random.shuffle(kopi_files)
        kopi_sken["files"] = kopi_files
        sesi_skenario[str(idx)] = kopi_sken

    return sesi_skenario


# 2. FUNGSI PERHITUNGAN SKOR & KLASIFIKASI RISIKO (TUGAS KAYSAN)
def nilai(jumlah_malware_dibuka, jumlah_salah_hapus, jumlah_hint):
    """
    Menghitung skor akhir dari nilai awal 100 dengan bobot penalti:
      - Membuka file berbahaya (malware): -15 poin
      - Menghapus file aman (false alarm): -5 poin
      - Menggunakan bantuan (Hint): -5 poin
    Edge-case: Skor tidak boleh kurang dari 0 (max(0, skor)).
    Klasifikasi Kategori Risiko:
      - Skor <= 50  : TINGGI
      - Skor 51-80  : SEDANG
      - Skor > 80   : RENDAH
    """
    skor_awal = 100
    penalti = (int(jumlah_malware_dibuka) * 15) + (int(jumlah_salah_hapus) * 5) + (int(jumlah_hint) * 5)
    skor_akhir = max(0, skor_awal - penalti)
    return skor_akhir, kategori_risiko(skor_akhir)


def kategori_risiko(skor):
    """Percabangan kategori risiko: <= 50 TINGGI, 51-80 SEDANG, > 80 RENDAH."""
    if skor <= 50:
        return "TINGGI"
    if skor <= 80:
        return "SEDANG"
    return "RENDAH"


# 3. FUNGSI SANITASI & PSEUDONIMISASI NAMA (KEAMANAN & PRIVASI DATA)
def sensor_nama(nama_input):
    """
    Membersihkan input nama dari karakter berbahaya (< > " ' & = + - @)
    dan menyensor nama menjadi huruf awal & akhir saja (contoh: Rohit -> R****T).
    Jika kosong (edge-case), otomatis menjadi A****M (Anonim).
    Idempoten: inisial yang sudah tersensor (R****T, A****) tidak disensor dua kali.
    """
    bersih = re.sub(r'[<>"\'&=+\-@]', '', str(nama_input or '')).strip()
    bersih = bersih[:20]  # Batasi maksimal 20 karakter
    if not bersih:
        bersih = "Anonim"
    if _POLA_SUDAH_DISENSOR.fullmatch(bersih):
        return bersih.upper()

    if len(bersih) > 1:
        return f"{bersih[0].upper()}****{bersih[-1].upper()}"
    return f"{bersih.upper()}****"


def sanitasi_teks_csv(teks, max_len=300):
    """
    Mencegah XSS dan CSV Formula Injection saat disimpan ke file .csv:
    membuang < >, memotong panjang, dan memberi awalan ' pada teks yang
    diawali karakter formula (= + - @ TAB CR).
    """
    bersih = re.sub(r'[<>]', '', str(teks or '')).strip()[:max_len]
    if bersih and bersih[0] in _AWALAN_FORMULA:
        bersih = "'" + bersih
    return bersih


# 4. FUNGSI PENCATATAN LOG LEADERBOARD KE hasil.csv (TUGAS KAYSAN & YAZID)
def tulis_log(nama_input, skor, waktu_str, kategori):
    """
    Menyimpan baris baru ke data/hasil.csv secara aman.
    Mengembalikan nama yang sudah disensor (R****T).
    """
    nama_aman = sensor_nama(nama_input)
    skor_aman = max(0, min(100, int(skor)))
    waktu_aman = sanitasi_teks_csv(waktu_str, max_len=10)
    # Kategori tidak dikenal -> dihitung ulang dari skor (sama dengan backend/)
    kategori_aman = kategori if kategori in KATEGORI_VALID else kategori_risiko(skor_aman)

    with _kunci_csv:
        file_exists = os.path.exists(HASIL_CSV_PATH)
        with open(HASIL_CSV_PATH, "a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            if not file_exists:
                writer.writerow(["nama_anonim", "skor", "waktu", "kategori_risiko"])
            writer.writerow([nama_aman, skor_aman, waktu_aman, kategori_aman])

    return nama_aman


def baca_leaderboard(limit=6):
    """
    Membaca isi data/hasil.csv, mengurutkan dari skor tertinggi, dan mengembalikan daftar Top N.
    """
    if not os.path.exists(HASIL_CSV_PATH):
        return []

    rows = []
    with open(HASIL_CSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            try:
                rows.append({
                    "name": r["nama_anonim"],
                    "score": int(r["skor"]),
                    "time": r["waktu"],
                    "risk": r["kategori_risiko"]
                })
            except Exception:
                continue

    rows.sort(key=lambda x: (-x["score"], x["time"]))
    return rows[:limit]


# 5. FUNGSI PENCATATAN FEEDBACK RESPONDEN KE feedback_user.csv
def tulis_feedback(inisial_user, skor, pesan_saran):
    """
    Menyimpan masukan/saran pengguna ke data/feedback_user.csv untuk dokumentasi User Testing.
    Mengembalikan kode responden (P01, P02, ...) atau None jika pesan kosong
    — sama dengan backend/app/feedback/repository.simpan_feedback().
    """
    pesan_aman = sanitasi_teks_csv(pesan_saran, max_len=300)
    if not pesan_aman:
        return None

    with _kunci_csv:
        file_exists = os.path.exists(FEEDBACK_CSV_PATH)
        jumlah_baris = 0
        if file_exists:
            # Dihitung per baris CSV (bukan per baris teks) agar pesan yang berisi
            # enter tidak membuat nomor responden meloncat.
            with open(FEEDBACK_CSV_PATH, "r", encoding="utf-8", newline="") as f:
                jumlah_baris = sum(1 for _ in csv.DictReader(f))

        kode_resp = f"P{jumlah_baris + 1:02d}"
        # Format waktu sama dengan kolom created_at di SQLite (backend/)
        waktu_skrg = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        with open(FEEDBACK_CSV_PATH, "a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            if not file_exists:
                writer.writerow(["kode_responden", "inisial_anonim", "skor", "waktu_input", "saran_dan_masukan"])
            writer.writerow([kode_resp, sanitasi_teks_csv(inisial_user, 10), int(skor), waktu_skrg, pesan_aman])

    return kode_resp


# 6. FUNGSI RINGKASAN STATISTIK UNTUK HALAMAN DASHBOARD (dashboard.html)
def ringkasan_dashboard():
    """
    Menghitung ikhtisar singkat FileMate untuk halaman Dashboard:
      - Jumlah skenario & file per kategori ancaman dari data/skenario.json
      - Jumlah file jebakan (malware) vs file aman
      - Jumlah sesi simulasi, rata-rata skor & sebaran kategori risiko dari data/hasil.csv
    Edge-case: Jika file data belum ada / rusak, nilai default 0 dikembalikan.
    """
    kategori = {}
    total_file = total_malware = total_skenario = 0
    try:
        with open(SKENARIO_PATH, "r", encoding="utf-8") as f:
            bank = json.load(f)
        for nama_kat, daftar in bank.items():
            jml_file = sum(len(s.get("files", [])) for s in daftar)
            jml_malware = sum(1 for s in daftar for fl in s.get("files", []) if fl.get("isMalware"))
            kategori[nama_kat] = {"skenario": len(daftar), "file": jml_file, "malware": jml_malware}
            total_skenario += len(daftar)
            total_file += jml_file
            total_malware += jml_malware
    except (OSError, ValueError):
        pass

    skor_list = []
    sebaran = {"RENDAH": 0, "SEDANG": 0, "TINGGI": 0}
    if os.path.exists(HASIL_CSV_PATH):
        with open(HASIL_CSV_PATH, "r", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                try:
                    skor_list.append(int(r["skor"]))
                except (KeyError, ValueError, TypeError):
                    continue
                if r.get("kategori_risiko") in sebaran:
                    sebaran[r["kategori_risiko"]] += 1

    return {
        "total_skenario": total_skenario,
        "total_file": total_file,
        "total_malware": total_malware,
        "total_aman": total_file - total_malware,
        "kategori": kategori,
        "total_sesi": len(skor_list),
        "rata_rata_skor": round(sum(skor_list) / len(skor_list)) if skor_list else 0,
        "sebaran_risiko": sebaran,
    }
