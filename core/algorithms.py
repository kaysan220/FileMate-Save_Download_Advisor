# =====================================================================
# MODUL ALGORITMA & LOGIKA PENILAIAN — TUGAS KAYSAN NAWFAL & ROHIT
# Mata Kuliah: Algoritma & Pemrograman + Dasar Keamanan Siber
# Berisi 5 Fungsi Modular Utama sesuai panduan Mini PBL:
#   1. baca_skenario()      -> Membaca & mengacak 3 skenario dari skenario.json
#   2. nilai()              -> Menghitung skor akhir & klasifikasi kategori risiko
#   3. sensor_nama()        -> Pseudonimisasi nama user (R****T) & Sanitasi Anti-XSS
#   4. tulis_log()          -> Menyimpan skor ke hasil.csv (Anti-CSV Injection)
#   5. tulis_feedback()     -> Menyimpan masukan responden ke feedback_user.csv
#   6. ringkasan_dashboard()-> Statistik ikhtisar untuk halaman dashboard.html
# =====================================================================
import os
import json
import csv
import random
import re
from datetime import datetime
from core.linux_utils import jalankan_sha256sum_linux

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKENARIO_PATH = os.path.join(BASE_DIR, "data", "skenario.json")
HASIL_CSV_PATH = os.path.join(BASE_DIR, "data", "hasil.csv")
FEEDBACK_CSV_PATH = os.path.join(BASE_DIR, "data", "feedback_user.csv")


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

        for f_item in kopi_files:
            if not f_item.get("hash"):
                hasil_cli = jalankan_sha256sum_linux(f_item["realName"])
                if "sha256" in hasil_cli:
                    real_h = hasil_cli["sha256"]
                    f_item["hash"] = real_h
                    if f_item.get("expectedHash") is not None:
                        if f_item.get("isMalware", False):
                            tengah = "".join("0" if c != "0" else "f" for c in real_h[24:32])
                            f_item["expectedHash"] = real_h[:24] + tengah + real_h[32:]
                        else:
                            f_item["expectedHash"] = real_h

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

    if skor_akhir <= 50:
        kategori = "TINGGI"
    elif skor_akhir <= 80:
        kategori = "SEDANG"
    else:
        kategori = "RENDAH"

    return skor_akhir, kategori


# 3. FUNGSI SANITASI & PSEUDONIMISASI NAMA (KEAMANAN & PRIVASI DATA)
def sensor_nama(nama_input):
    """
    Membersihkan input nama dari karakter berbahaya (< > " ' & = + - @)
    dan menyensor nama menjadi huruf awal & akhir saja (contoh: Rohit -> R****T).
    Jika kosong (edge-case), otomatis menjadi A****M (Anonim).
    """
    bersih = re.sub(r'[<>"\'&=+\-@]', '', str(nama_input or '')).strip()
    if not bersih:
        bersih = "Anonim"
    bersih = bersih[:20]  # Batasi maksimal 20 karakter

    if len(bersih) > 1:
        return f"{bersih[0].upper()}****{bersih[-1].upper()}"
    return f"{bersih.upper()}****"


def sanitasi_teks_csv(teks, max_len=300):
    """
    Mencegah XSS dan CSV Formula Injection saat disimpan ke file .csv.
    """
    bersih = re.sub(r'[<>]', '', str(teks or '')).strip()[:max_len]
    if bersih and bersih[0] in ('=', '+', '-', '@'):
        bersih = "'" + bersih
    return bersih


# 4. FUNGSI PENCATATAN LOG LEADERBOARD KE hasil.csv (TUGAS KAYSAN & YAZID)
def tulis_log(nama_input, skor, waktu_str, kategori_risiko):
    """
    Menyimpan baris baru ke data/hasil.csv secara aman.
    """
    nama_aman = sensor_nama(nama_input)
    skor_aman = max(0, min(100, int(skor)))
    waktu_aman = sanitasi_teks_csv(waktu_str, max_len=10)
    kategori_aman = kategori_risiko if kategori_risiko in ("TINGGI", "SEDANG", "RENDAH") else "RENDAH"

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
    """
    pesan_aman = sanitasi_teks_csv(pesan_saran, max_len=300)
    if not pesan_aman:
        return False

    urutan = 1
    if os.path.exists(FEEDBACK_CSV_PATH):
        with open(FEEDBACK_CSV_PATH, "r", encoding="utf-8") as f:
            urutan = max(1, sum(1 for _ in f))

    kode_resp = f"P{urutan:02d}"
    waktu_skrg = datetime.now().strftime("%d/%m/%Y %H.%M")

    file_exists = os.path.exists(FEEDBACK_CSV_PATH)
    with open(FEEDBACK_CSV_PATH, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(["kode_responden", "inisial_anonim", "skor", "waktu_input", "saran_dan_masukan"])
        writer.writerow([kode_resp, sanitasi_teks_csv(inisial_user, 10), int(skor), waktu_skrg, pesan_aman])

    return True


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
