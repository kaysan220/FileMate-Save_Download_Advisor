# =====================================================================
# AUTENTIKASI PASSWORD MAINTAINER (ADMIN) — TUGAS KAYSAN
#
# Alur:
#   1. Awalnya belum ada password (file data/admin_password.json belum ada).
#   2. Admin pertama kali membuat password -> frontend mengirim SHA-256(password).
#   3. Server TIDAK menyimpan hash itu apa adanya: hash dari frontend di-hash
#      ulang dengan PBKDF2-SHA256 + salt acak, lalu disimpan ke file JSON.
#   4. Saat login, hash input diproses dengan salt yang sama lalu dibandingkan
#      dengan hash tersimpan memakai hmac.compare_digest (constant-time).
#   5. Lupa password -> verifikasi password cadangan tim (hanya hash-nya yang
#      ada di kode), lalu password baru menggantikan yang lama.
#
# Dipakai oleh app.py (root) dan backend/app/admin/routes.py.
# Modul ini murni Python standar (tanpa Flask).
# =====================================================================
import hashlib
import hmac
import json
import os
import re
import secrets
import threading
import time

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PASSWORD_PATH = os.environ.get("ADMIN_PASSWORD_PATH") or os.path.join(BASE_DIR, "data", "admin_password.json")

# SHA-256 dari password cadangan tim. Password aslinya tidak ditulis di kode.
# Bisa diganti lewat .env: ADMIN_RECOVERY_HASH=<sha256 hex>
RECOVERY_HASH = os.environ.get(
    "ADMIN_RECOVERY_HASH",
    "b0abacefe2ee0c1339a78aba1930ff2a1cd509f9d6be633242db6e502423be7c",
).lower()

PBKDF2_ITERASI = 200_000
_POLA_SHA256 = re.compile(r"^[0-9a-f]{64}$")

# ---------------------------------------------------------------------
# Penundaan bertahap untuk password SALAH saat login (jumlah kumulatif):
#   salah ke-5  -> tunda 30 detik
#   salah ke-15 -> tunda 5 menit
#   salah ke-25 -> tunda 1 jam
#   salah ke-35 -> login password ditutup, wajib pakai password cadangan
# Selama ditunda, SEMUA endpoint /api/admin/* ditolak (HTTP 429).
# Status disimpan di file agar tidak hilang saat server di-restart.
# ---------------------------------------------------------------------
TAHAP_TUNDA = {5: 30, 15: 5 * 60, 25: 60 * 60}
BATAS_WAJIB_CADANGAN = 35
LOCK_PATH = os.environ.get("ADMIN_LOCK_PATH") or os.path.join(BASE_DIR, "data", "admin_lock.json")

# Percobaan password CADANGAN yang salah: 5x / 5 menit per IP
MAKS_GAGAL = 5
JENDELA_DETIK = 5 * 60
_gagal = {}  # ip -> [timestamp, ...]
_kunci = threading.Lock()


# ---------------------------------------------------------------------
# Validasi & pembatasan percobaan
# ---------------------------------------------------------------------
def hash_valid(nilai):
    """Hash dari frontend wajib berupa 64 karakter hex (SHA-256)."""
    return isinstance(nilai, str) and bool(_POLA_SHA256.match(nilai.lower()))


def _tulis_json_atomik(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    sementara = path + ".tmp"
    with open(sementara, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    os.replace(sementara, path)
    try:
        os.chmod(path, 0o600)  # Linux: hanya pemilik yang bisa baca
    except OSError:
        pass


def _baca_lock():
    try:
        with open(LOCK_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return {
            "gagal": int(data.get("gagal", 0)),
            "terkunci_sampai": float(data.get("terkunci_sampai", 0)),
        }
    except (OSError, ValueError, TypeError, AttributeError):
        return {"gagal": 0, "terkunci_sampai": 0.0}


def status_kunci():
    """{gagal, sisa_detik, wajib_cadangan} — sisa_detik > 0 berarti sedang ditunda."""
    data = _baca_lock()
    sisa = max(0, int(round(data["terkunci_sampai"] - time.time() + 0.499)))
    return {
        "gagal": data["gagal"],
        "sisa_detik": sisa,
        "wajib_cadangan": data["gagal"] >= BATAS_WAJIB_CADANGAN,
    }


def catat_gagal_login():
    """Menambah hitungan password salah & memasang penundaan bila mencapai tahap."""
    with _kunci:
        data = _baca_lock()
        data["gagal"] += 1
        durasi = TAHAP_TUNDA.get(data["gagal"])
        if durasi:
            data["terkunci_sampai"] = time.time() + durasi
        _tulis_json_atomik(LOCK_PATH, data)
    return status_kunci()


def reset_kunci_login():
    with _kunci:
        try:
            os.remove(LOCK_PATH)
        except OSError:
            pass


def terblokir(ip):
    sekarang = time.time()
    with _kunci:
        riwayat = [t for t in _gagal.get(ip, []) if sekarang - t < JENDELA_DETIK]
        _gagal[ip] = riwayat
        return len(riwayat) >= MAKS_GAGAL


def catat_gagal(ip):
    with _kunci:
        _gagal.setdefault(ip, []).append(time.time())


def bersihkan_gagal(ip):
    with _kunci:
        _gagal.pop(ip, None)


# ---------------------------------------------------------------------
# Penyimpanan hash password
# ---------------------------------------------------------------------
def _pbkdf2(client_hash, salt_hex, iterasi):
    return hashlib.pbkdf2_hmac(
        "sha256", client_hash.lower().encode(), bytes.fromhex(salt_hex), iterasi
    ).hex()


def _baca():
    try:
        with open(PASSWORD_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict) and data.get("hash") and data.get("salt"):
            return data
    except (OSError, ValueError):
        pass
    return None


def _tulis(client_hash):
    salt = secrets.token_hex(16)
    data = {
        "algoritma": "pbkdf2_sha256(sha256_frontend)",
        "iterasi": PBKDF2_ITERASI,
        "salt": salt,
        "hash": _pbkdf2(client_hash, salt, PBKDF2_ITERASI),
        "diperbarui": time.strftime("%Y-%m-%d %H:%M:%S"),
    }
    _tulis_json_atomik(PASSWORD_PATH, data)


def sudah_ada_password():
    return _baca() is not None


def buat_password_pertama(client_hash):
    """Mengembalikan False jika password sudah pernah dibuat."""
    with _kunci:
        if _baca() is not None:
            return False
        _tulis(client_hash)
        return True


def cek_password(client_hash):
    data = _baca()
    if data is None:
        return False
    iterasi = int(data.get("iterasi", PBKDF2_ITERASI))
    hasil = _pbkdf2(client_hash, data["salt"], iterasi)
    return hmac.compare_digest(hasil, data["hash"])


def cek_password_cadangan(client_hash):
    return hmac.compare_digest(client_hash.lower(), RECOVERY_HASH)


def ganti_password(recovery_hash, client_hash_baru):
    """Ganti password memakai password cadangan. Mengembalikan True jika berhasil."""
    if not cek_password_cadangan(recovery_hash):
        return False
    with _kunci:
        _tulis(client_hash_baru)
    reset_kunci_login()  # password baru -> hitungan salah & penundaan dihapus
    return True


# ---------------------------------------------------------------------
# Logika rute bersama (dipakai app.py & backend/app/admin/routes.py)
# Setiap fungsi mengembalikan (body_dict, http_status).
# ---------------------------------------------------------------------
def _info_kunci(st):
    return {
        "retry_after": st["sisa_detik"],
        "require_recovery": st["wajib_cadangan"],
        "failed_attempts": st["gagal"],
    }


def _format_durasi(detik):
    if detik >= 3600:
        return f"{(detik + 3599) // 3600} jam"
    if detik >= 60:
        return f"{(detik + 59) // 60} menit"
    return f"{detik} detik"


def cek_akses_api():
    """Dipanggil sebelum SETIAP request /api/admin/*. None = boleh lanjut."""
    st = status_kunci()
    if st["sisa_detik"] > 0:
        return {
            "status": "error",
            "message": f"Terlalu banyak password salah. Akses ditunda {_format_durasi(st['sisa_detik'])}.",
            **_info_kunci(st),
        }, 429
    return None


def rute_status():
    st = status_kunci()
    return {"status": "ok", "data": {"has_password": sudah_ada_password(), **_info_kunci(st)}}, 200


def rute_login(password_hash):
    if not sudah_ada_password():
        return {"status": "error", "message": "Password admin belum dibuat."}, 409
    st = status_kunci()
    if st["wajib_cadangan"]:
        return {
            "status": "error",
            "message": "Login password ditutup karena terlalu banyak percobaan salah. Gunakan password cadangan.",
            **_info_kunci(st),
        }, 423
    if not hash_valid(password_hash) or not cek_password(password_hash):
        st = catat_gagal_login()
        if st["wajib_cadangan"]:
            pesan, kode = "Login password ditutup karena terlalu banyak percobaan salah. Gunakan password cadangan.", 423
        elif st["sisa_detik"] > 0:
            pesan, kode = f"Password salah. Akses ditunda {_format_durasi(st['sisa_detik'])}.", 429
        else:
            pesan, kode = "Password salah.", 401
        return {"status": "error", "message": pesan, **_info_kunci(st)}, kode
    reset_kunci_login()
    return {"status": "ok", "data": {"logged_in": True}}, 200


def rute_recovery(ip, recovery_hash):
    if terblokir(ip):
        return {"status": "error", "message": "Terlalu banyak percobaan password cadangan. Coba lagi dalam 5 menit."}, 429
    if not hash_valid(recovery_hash) or not cek_password_cadangan(recovery_hash):
        catat_gagal(ip)
        return {"status": "error", "message": "Password cadangan salah."}, 401
    return {"status": "ok", "data": {"valid": True}}, 200


def rute_reset(ip, recovery_hash, baru):
    if terblokir(ip):
        return {"status": "error", "message": "Terlalu banyak percobaan password cadangan. Coba lagi dalam 5 menit."}, 429
    if not hash_valid(recovery_hash) or not hash_valid(baru):
        return {"status": "error", "message": "Format hash tidak valid."}, 400
    if not ganti_password(recovery_hash, baru):
        catat_gagal(ip)
        return {"status": "error", "message": "Password cadangan salah."}, 401
    bersihkan_gagal(ip)
    return {"status": "ok", "data": {"logged_in": True}}, 200


def rute_setup(password_hash):
    if not hash_valid(password_hash):
        return {"status": "error", "message": "Format hash password tidak valid."}, 400
    if not buat_password_pertama(password_hash):
        return {"status": "error", "message": "Password admin sudah pernah dibuat."}, 409
    reset_kunci_login()
    return {"status": "ok", "data": {"logged_in": True}}, 200
