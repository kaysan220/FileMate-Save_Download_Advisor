# =====================================================================
# PEMUAT FILE .env — dipakai app.py (root) melalui core/admin_auth.py
# Parser sederhana KEY=VALUE tanpa dependensi tambahan (sama seperti
# backend/app/config.py). Variabel yang sudah ada di environment sistem
# TIDAK ditimpa (os.environ.setdefault).
# =====================================================================
import os

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(ROOT_DIR, ".env")


def muat_env(path=ENV_PATH):
    if not os.path.isfile(path):
        return
    with open(path, "r", encoding="utf-8-sig") as f:
        for baris in f:
            baris = baris.strip()
            if not baris or baris.startswith("#") or "=" not in baris:
                continue
            kunci, nilai = baris.split("=", 1)
            nilai = nilai.strip().strip('"').strip("'")
            os.environ.setdefault(kunci.strip(), nilai)
