# =====================================================================
# ATUR PASSWORD CADANGAN ADMIN (dijalankan manual oleh tim backend)
#
#   python -m core.atur_password_cadangan
#
# - Password diketik tersembunyi (tidak tampil di layar) + konfirmasi ulang.
# - Yang disimpan HANYA SHA-256-nya, ke baris ADMIN_RECOVERY_HASH di file .env
#   (sama persis dengan hash yang dikirim tampilan/js/admin.js).
# - Jika SECRET_KEY belum ada di .env, sekalian dibuatkan kunci acak agar
#   login admin tidak hilang setiap server restart.
# - Server harus di-restart setelah menjalankan skrip ini.
# File .env ada di .gitignore: JANGAN di-commit / dikirim lewat chat.
# =====================================================================
import getpass
import hashlib
import os
import secrets
import sys

from core.env import ENV_PATH

MIN_PANJANG = 12


def _baca_baris(path):
    if not os.path.isfile(path):
        return []
    with open(path, "r", encoding="utf-8-sig") as f:
        return f.read().splitlines()


def _set_kunci(baris, kunci, nilai, timpa=True):
    """Mengganti baris KUNCI=... jika ada (bila timpa=True), atau menambahkannya."""
    for i, b in enumerate(baris):
        if b.strip().split("=", 1)[0].strip() == kunci and not b.strip().startswith("#"):
            if timpa:
                baris[i] = f"{kunci}={nilai}"
            return False
    baris.append(f"{kunci}={nilai}")
    return True


def _tulis_atomik(path, baris):
    sementara = path + ".tmp"
    with open(sementara, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(baris) + "\n")
    os.replace(sementara, path)
    try:
        os.chmod(path, 0o600)  # Linux: hanya pemilik yang bisa baca
    except OSError:
        pass


def main():
    print("=== Atur password cadangan admin FileMate ===")
    print(f"Minimal {MIN_PANJANG} karakter. Ketikan tidak akan tampil di layar.\n")
    pw = getpass.getpass("Password cadangan baru : ")
    if len(pw) < MIN_PANJANG:
        print(f"Gagal: password cadangan minimal {MIN_PANJANG} karakter.")
        return 1
    if pw != getpass.getpass("Konfirmasi ulang      : "):
        print("Gagal: konfirmasi tidak sama.")
        return 1

    baris = _baca_baris(ENV_PATH)
    _set_kunci(baris, "ADMIN_RECOVERY_HASH", hashlib.sha256(pw.encode("utf-8")).hexdigest())
    kunci_baru = _set_kunci(baris, "SECRET_KEY", secrets.token_hex(32), timpa=False)
    _tulis_atomik(ENV_PATH, baris)

    print(f"\nBerhasil. Hash password cadangan disimpan di {ENV_PATH}")
    if kunci_baru:
        print("SECRET_KEY acak juga ditambahkan (login admin bertahan setelah restart).")
    print("Restart server Python agar perubahan berlaku.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
