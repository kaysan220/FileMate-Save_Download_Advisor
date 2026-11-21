# =====================================================================
# KONFIGURASI APLIKASI — membaca .env & menentukan lokasi folder data
# =====================================================================
import os
import secrets

from .common.kiriman import BAWAAN_BATAS_PER_IP, BAWAAN_JENDELA_DETIK, angka_env

# backend/app/config.py -> naik 2 tingkat = folder backend/, 3 tingkat = root proyek
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT_DIR = os.path.dirname(BACKEND_DIR)


def _muat_env(path):
    """Parser .env sederhana (KEY=VALUE) tanpa dependensi tambahan."""
    if not os.path.isfile(path):
        return
    with open(path, "r", encoding="utf-8") as f:
        for baris in f:
            baris = baris.strip()
            if not baris or baris.startswith("#") or "=" not in baris:
                continue
            kunci, nilai = baris.split("=", 1)
            nilai = nilai.strip().strip('"').strip("'")
            os.environ.setdefault(kunci.strip(), nilai)


def _pilih_path(*kandidat):
    """Mengembalikan path pertama yang ada; jika tidak ada, kandidat pertama."""
    for p in kandidat:
        if os.path.exists(p):
            return p
    return kandidat[0]


_muat_env(os.path.join(ROOT_DIR, ".env"))

DATA_DIR = os.path.join(ROOT_DIR, "data")


class Config:
    # --- Rahasia (WAJIB diisi di .env saat deploy) ---
    SECRET_KEY = os.environ.get("SECRET_KEY") or secrets.token_hex(32)
    # Password admin tidak lagi di .env: dibuat lewat menu maintainer (Ctrl+Shift+L)
    # dan disimpan sebagai hash di data/admin_password.json (lihat core/admin_auth.py).

    # --- Keamanan cookie sesi admin ---
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Strict"
    SESSION_COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "0") == "1"
    MAX_CONTENT_LENGTH = 16 * 1024  # body JSON maksimal 16 KB

    # --- Lokasi data (struktur baru, dengan fallback ke struktur lama) ---
    DATA_DIR = DATA_DIR
    SKENARIO_PATH = _pilih_path(
        os.path.join(DATA_DIR, "scenarios", "skenario.json"),
        os.path.join(DATA_DIR, "skenario.json"),
    )
    DUMMY_DIR = os.path.join(DATA_DIR, "dummy_files")
    DB_PATH = os.environ.get("DB_PATH") or os.path.join(DATA_DIR, "filemate.db")
    SCHEMA_PATH = os.path.join(ROOT_DIR, "database", "schema.sql")
    EXPORT_DIR = os.path.join(DATA_DIR, "exports")

    # CSV lama — diimpor otomatis ke SQLite saat database masih kosong
    LEGACY_HASIL_CSV = _pilih_path(
        os.path.join(DATA_DIR, "exports", "hasil.csv"),
        os.path.join(DATA_DIR, "hasil.csv"),
    )
    LEGACY_FEEDBACK_CSV = _pilih_path(
        os.path.join(DATA_DIR, "exports", "feedback_user.csv"),
        os.path.join(DATA_DIR, "feedback_user.csv"),
    )

    # --- Frontend (mode pengembangan: Flask ikut menyajikan halaman) ---
    # Saat produksi, Nginx yang menyajikan frontend -> set SERVE_STATIC=0
    SERVE_STATIC = os.environ.get("SERVE_STATIC", "1") == "1"
    STATIC_DIRS = {
        "page": _pilih_path(os.path.join(ROOT_DIR, "frontend", "pages"), os.path.join(ROOT_DIR, "page")),
        "tampilan": _pilih_path(os.path.join(ROOT_DIR, "frontend", "assets"), os.path.join(ROOT_DIR, "tampilan")),
        "image": _pilih_path(os.path.join(ROOT_DIR, "frontend", "assets", "images"), os.path.join(ROOT_DIR, "image")),
    }

    # --- Sesi simulasi ---
    SESSION_TTL_DETIK = 60 * 60       # sesi simulasi kedaluwarsa setelah 1 jam
    MAKS_SESI_AKTIF = 500             # batas sesi di memori (anti-DoS sederhana)

    # --- Batas kiriman /api/submit-score & /api/submit-feedback per IP ---
    # (sama dengan app.py; lihat common/kiriman.py dan .env.example)
    SUBMIT_BATAS_PER_IP = angka_env("SUBMIT_BATAS_PER_IP", BAWAAN_BATAS_PER_IP)
    SUBMIT_JENDELA_DETIK = angka_env("SUBMIT_JENDELA_DETIK", BAWAAN_JENDELA_DETIK)
