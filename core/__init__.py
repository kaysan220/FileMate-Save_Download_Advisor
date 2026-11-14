# =====================================================================
# PAKET CORE FILEMATE — modul logika versi awal (dipakai app.py di root)
#
#   core.algorithms  -> Tugas Kaysan & Rohit (skenario, skor, sensor, CSV)
#   core.linux_utils -> Tugas Yazid (sha256sum, file --mime-type, ls -l)
#
# Semua fungsi publik diekspor di sini, sehingga cukup menulis:
#     from core import nilai, sensor_nama, jalankan_sha256sum_linux
#
# Catatan: versi terstruktur (blueprint + SQLite) ada di backend/app/.
# Paket core/ dipertahankan sebagai bahan belajar & fallback app.py.
# =====================================================================
from .algorithms import (
    BASE_DIR,
    FEEDBACK_CSV_PATH,
    HASIL_CSV_PATH,
    SKENARIO_PATH,
    baca_leaderboard,
    baca_skenario,
    nilai,
    ringkasan_dashboard,
    sanitasi_teks_csv,
    sensor_nama,
    tulis_feedback,
    tulis_log,
)
from .linux_utils import (
    DUMMY_DIR,
    jalankan_inspeksi_linux,
    jalankan_sha256sum_linux,
    validasi_path_aman,
)

__version__ = "1.0.0"

__all__ = [
    # Path data
    "BASE_DIR",
    "SKENARIO_PATH",
    "HASIL_CSV_PATH",
    "FEEDBACK_CSV_PATH",
    "DUMMY_DIR",
    # algorithms.py
    "baca_skenario",
    "nilai",
    "sensor_nama",
    "sanitasi_teks_csv",
    "tulis_log",
    "baca_leaderboard",
    "tulis_feedback",
    "ringkasan_dashboard",
    # linux_utils.py
    "validasi_path_aman",
    "jalankan_sha256sum_linux",
    "jalankan_inspeksi_linux",
]
