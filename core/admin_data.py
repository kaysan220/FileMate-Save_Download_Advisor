# =====================================================================
# DATA MENU SATGAS (ADMIN) VERSI CSV — dipakai app.py
#   baca_feedback()   -> daftar masukan terbaru dari data/feedback_user.csv
#   buat_csv_unduh()  -> isi CSV skor / feedback untuk diunduh maintainer
#   kosongkan_data()  -> reset leaderboard / feedback (sisakan baris header)
# Format data sama dengan backend/app/admin (versi SQLite), sehingga
# tampilan/js/admin.js bisa dipakai untuk kedua server.
# =====================================================================
import csv
import io
import os

from . import algorithms as alg

HEADER = {
    "scores": ["nama_anonim", "skor", "waktu", "kategori_risiko"],
    "feedback": ["kode_responden", "inisial_anonim", "skor", "waktu_input", "saran_dan_masukan"],
}
NAMA_FILE = {"scores": "hasil.csv", "feedback": "feedback_user.csv"}


def _path(jenis):
    # Dibaca saat dipanggil (bukan saat import) agar mengikuti alg.*_PATH terbaru
    return alg.HASIL_CSV_PATH if jenis == "scores" else alg.FEEDBACK_CSV_PATH


def _baca_baris(jenis):
    path = _path(jenis)
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def baca_feedback(limit=100):
    """Masukan terbaru lebih dulu, format sama dengan backend: kode_responden, inisial_anonim, skor, waktu_input, pesan."""
    hasil = []
    for r in reversed(_baca_baris("feedback")):
        try:
            skor = int(r.get("skor", 0))
        except (TypeError, ValueError):
            skor = 0
        hasil.append({
            "kode_responden": r.get("kode_responden", ""),
            "inisial_anonim": r.get("inisial_anonim", ""),
            "skor": skor,
            "waktu_input": r.get("waktu_input", ""),
            "pesan": r.get("saran_dan_masukan", ""),
        })
        if len(hasil) >= limit:
            break
    return hasil


def buat_csv_unduh(jenis):
    """Mengembalikan (nama_file, isi_csv). Setiap sel disanitasi ulang (anti CSV Injection)."""
    if jenis not in HEADER:
        raise ValueError("Jenis data harus 'scores' atau 'feedback'.")
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(HEADER[jenis])
    for r in _baca_baris(jenis):
        w.writerow([alg.sanitasi_teks_csv(r.get(k, ""), max_len=1000) for k in HEADER[jenis]])
    return NAMA_FILE[jenis], buf.getvalue()


def kosongkan_data(jenis):
    """Mengosongkan hasil.csv / feedback_user.csv (header tetap). Mengembalikan jumlah baris yang dihapus."""
    if jenis not in HEADER:
        raise ValueError("Jenis data harus 'scores' atau 'feedback'.")
    jumlah = len(_baca_baris(jenis))
    path = _path(jenis)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    sementara = path + ".tmp"
    with open(sementara, "w", newline="", encoding="utf-8") as f:
        csv.writer(f).writerow(HEADER[jenis])
    os.replace(sementara, path)
    return jumlah
