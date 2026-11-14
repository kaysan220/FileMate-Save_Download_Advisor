# =====================================================================
# EKSPOR SQL -> CSV (untuk diunduh maintainer / bahan laporan)
# Setiap sel disanitasi ulang agar aman dibuka di Excel (CSV Injection).
# =====================================================================
import csv
import io
import os

from ..common.sanitize import sanitasi_teks_csv
from ..feedback import repository as feedback_repo
from ..leaderboard import repository as skor_repo

JENIS_EKSPOR = ("scores", "feedback")


def _sel(v):
    return v if isinstance(v, (int, float)) else sanitasi_teks_csv(v, max_len=1000)


def buat_csv(jenis):
    """Mengembalikan (nama_file, isi_csv_str)."""
    buf = io.StringIO()
    w = csv.writer(buf)

    if jenis == "scores":
        w.writerow(["nama_anonim", "skor", "waktu", "kategori_risiko", "dibuat"])
        for r in skor_repo.semua_skor():
            w.writerow([_sel(r["nama_anonim"]), r["skor"], _sel(r["waktu"]), r["kategori_risiko"], r["created_at"]])
        nama = "hasil.csv"
    elif jenis == "feedback":
        w.writerow(["kode_responden", "inisial_anonim", "skor", "waktu_input", "saran_dan_masukan"])
        for r in reversed(feedback_repo.semua_feedback()):
            d = feedback_repo.ke_dict(r)
            w.writerow([d["kode_responden"], _sel(d["inisial_anonim"]), d["skor"], d["waktu_input"], _sel(d["pesan"])])
        nama = "feedback_user.csv"
    else:
        raise ValueError("Jenis ekspor tidak dikenal.")

    return nama, buf.getvalue()


def simpan_ke_folder(jenis, export_dir):
    """Dipakai scripts/export_csv.py: menulis CSV ke data/exports/."""
    nama, isi = buat_csv(jenis)
    os.makedirs(export_dir, exist_ok=True)
    path = os.path.join(export_dir, nama)
    with open(path, "w", newline="", encoding="utf-8") as f:
        f.write(isi)
    return path
