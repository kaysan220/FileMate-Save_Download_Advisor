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
#      disimpan, di file .env — tidak di kode/git), lalu password baru
#      menggantikan yang lama.
#
# Pembatasan percobaan (detail di bagian "PENUNDAAN LOGIN" di bawah):
#   - Per IP  : salah ke-5/15/25 -> tunda 30 dtk / 5 mnt / 1 jam;
#               ke-35 -> IP itu wajib memakai password cadangan.
#   - Global  : rem darurat bila serangan datang dari banyak IP.
#   - Hitungan berkurang otomatis: kembali 0 setelah 24 jam tanpa salah.
#   - Password cadangan: 5x salah / 5 mnt per IP + 20x salah / 24 jam total.
#   - Semua status disimpan di data/admin_lock.json (bertahan saat restart).
#   - Sesi admin berakhir setelah 30 menit tidak aktif (maks. 8 jam).
#
# IP diambil dari request.remote_addr. Di balik Nginx/Cloudflare, nilai itu
# hanya benar jika ProxyFix dipasang (PROXY_COUNT di .env, lihat core/proxy.py).
#
# Dipakai oleh app.py (root) dan backend/app/admin/routes.py.
# Modul ini murni Python standar (tanpa Flask).
# =====================================================================
import hashlib
import hmac
import json
import logging
import os
import re
import secrets
import threading
import time

from core.env import muat_env

muat_env()  # .env di root proyek (ADMIN_RECOVERY_HASH, SECRET_KEY, PROXY_COUNT, ...)

log = logging.getLogger("filemate.admin")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PASSWORD_PATH = os.environ.get("ADMIN_PASSWORD_PATH") or os.path.join(BASE_DIR, "data", "admin_password.json")
LOCK_PATH = os.environ.get("ADMIN_LOCK_PATH") or os.path.join(BASE_DIR, "data", "admin_lock.json")

# Password cadangan tim: HANYA hash SHA-256-nya yang disimpan, dan hanya di .env
# (ADMIN_RECOVERY_HASH=<sha256 hex>). Tidak ada nilai bawaan di kode / git.
# Atur lewat: python -m core.atur_password_cadangan
# Jika belum diatur, fitur "Lupa password" ditolak (HTTP 503).

PBKDF2_ITERASI = 200_000
_POLA_SHA256 = re.compile(r"^[0-9a-f]{64}$")

# ---------------------------------------------------------------------
# PENUNDAAN LOGIN (password admin salah)
# ---------------------------------------------------------------------
# Lapis per IP — hanya IP penyerang yang tertunda, admin di IP lain aman.
TAHAP_TUNDA_IP = {5: 30, 15: 5 * 60, 25: 60 * 60}
BATAS_CADANGAN_IP = 35          # IP ini hanya bisa masuk lewat password cadangan

# Lapis global — rem darurat jika serangan datang dari BANYAK IP sekaligus.
TAHAP_TUNDA_GLOBAL = {50: 5 * 60, 100: 60 * 60}
BATAS_CADANGAN_GLOBAL = 150     # login password ditutup untuk semua orang

# Hitungan kembali 0 jika tidak ada password salah selama 24 jam
# (tidak berlaku jika sudah mencapai batas "wajib password cadangan").
LUPA_SETELAH_DETIK = 24 * 60 * 60
MAKS_IP_TERCATAT = 1000         # batas ukuran file lock

# ---------------------------------------------------------------------
# PASSWORD CADANGAN salah
# ---------------------------------------------------------------------
CADANGAN_MAKS_IP = 5
CADANGAN_JENDELA_IP = 5 * 60
CADANGAN_MAKS_GLOBAL = 20
CADANGAN_JENDELA_GLOBAL = 24 * 60 * 60

# ---------------------------------------------------------------------
# SESI ADMIN (cookie Flask)
# ---------------------------------------------------------------------
SESI_IDLE_DETIK = 30 * 60       # keluar otomatis jika 30 menit tidak aktif
SESI_MAKS_DETIK = 8 * 60 * 60   # maksimal 8 jam sejak login

_kunci = threading.Lock()


# ---------------------------------------------------------------------
# Utilitas file
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


# ---------------------------------------------------------------------
# Penyimpanan status penundaan (data/admin_lock.json)
#   {"global": {gagal, terkunci_sampai, terakhir},
#    "ip": {"<ip>": {gagal, terkunci_sampai, terakhir}},
#    "cadangan_ip": {"<ip>": [waktu, ...]}, "cadangan_global": [waktu, ...]}
# ---------------------------------------------------------------------
def _entri(d):
    try:
        return {
            "gagal": max(0, int(d.get("gagal", 0))),
            "terkunci_sampai": float(d.get("terkunci_sampai", 0)),
            "terakhir": float(d.get("terakhir", 0)),
        }
    except (TypeError, ValueError, AttributeError):
        return {"gagal": 0, "terkunci_sampai": 0.0, "terakhir": 0.0}


def _daftar_waktu(nilai):
    if not isinstance(nilai, list):
        return []
    return [float(t) for t in nilai if isinstance(t, (int, float))]


def _baca_lock():
    try:
        with open(LOCK_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            raise ValueError
    except (OSError, ValueError):
        data = {}
    if "gagal" in data and "global" not in data:  # format lama (sebelum per IP)
        data = {"global": data}
    ip = data.get("ip") if isinstance(data.get("ip"), dict) else {}
    cad_ip = data.get("cadangan_ip") if isinstance(data.get("cadangan_ip"), dict) else {}
    return {
        "global": _entri(data.get("global") or {}),
        "ip": {str(k): _entri(v) for k, v in ip.items()},
        "cadangan_ip": {str(k): _daftar_waktu(v) for k, v in cad_ip.items()},
        "cadangan_global": _daftar_waktu(data.get("cadangan_global")),
    }


def _kedaluwarsa(e, batas_cadangan, sekarang):
    """Hitungan dilupakan setelah 24 jam tanpa salah (kecuali sudah wajib cadangan)."""
    return (
        e["gagal"] < batas_cadangan
        and e["terkunci_sampai"] <= sekarang
        and sekarang - e["terakhir"] >= LUPA_SETELAH_DETIK
    )


def _batasi_ip(data):
    """Batas ukuran file: buang IP yang paling lama tidak aktif (yang wajib cadangan dipertahankan)."""
    if len(data["ip"]) <= MAKS_IP_TERCATAT:
        return
    urut = sorted(
        data["ip"].items(),
        key=lambda kv: (kv[1]["gagal"] >= BATAS_CADANGAN_IP, kv[1]["terakhir"]),
        reverse=True,
    )
    data["ip"] = dict(urut[:MAKS_IP_TERCATAT])


def _rapikan(data, sekarang):
    g = data["global"]
    if g["gagal"] and _kedaluwarsa(g, BATAS_CADANGAN_GLOBAL, sekarang):
        data["global"] = _entri({})
    data["ip"] = {
        ip: e for ip, e in data["ip"].items()
        if e["gagal"] and not _kedaluwarsa(e, BATAS_CADANGAN_IP, sekarang)
    }
    _batasi_ip(data)
    data["cadangan_ip"] = {
        ip: [t for t in w if sekarang - t < CADANGAN_JENDELA_IP]
        for ip, w in data["cadangan_ip"].items()
    }
    data["cadangan_ip"] = {ip: w for ip, w in data["cadangan_ip"].items() if w}
    data["cadangan_global"] = [t for t in data["cadangan_global"] if sekarang - t < CADANGAN_JENDELA_GLOBAL]
    return data


def _sisa(e, sekarang):
    return max(0, int(round(e["terkunci_sampai"] - sekarang + 0.499)))


def status_kunci(ip):
    """Status penundaan untuk IP ini (gabungan lapis per IP & global).

    {gagal, sisa_detik, wajib_cadangan, lingkup} — sisa_detik > 0 berarti ditunda.
    lingkup = "ip" / "global" / None (lapis mana yang sedang menahan).
    """
    sekarang = time.time()
    data = _rapikan(_baca_lock(), sekarang)
    e_ip = data["ip"].get(ip, _entri({}))
    g = data["global"]
    sisa_ip, sisa_g = _sisa(e_ip, sekarang), _sisa(g, sekarang)
    wajib_ip = e_ip["gagal"] >= BATAS_CADANGAN_IP
    wajib_g = g["gagal"] >= BATAS_CADANGAN_GLOBAL
    lingkup = None
    if sisa_g > 0 or wajib_g:
        lingkup = "global"
    elif sisa_ip > 0 or wajib_ip:
        lingkup = "ip"
    return {
        "gagal": e_ip["gagal"],
        "sisa_detik": max(sisa_ip, sisa_g),
        "wajib_cadangan": wajib_ip or wajib_g,
        "lingkup": lingkup,
    }


def _naikkan(e, tahap, sekarang):
    e["gagal"] += 1
    e["terakhir"] = sekarang
    durasi = tahap.get(e["gagal"])
    if durasi:
        e["terkunci_sampai"] = sekarang + durasi


def catat_gagal_login(ip):
    """Menambah hitungan salah (per IP & global) & memasang penundaan bila mencapai tahap."""
    sekarang = time.time()
    with _kunci:
        data = _rapikan(_baca_lock(), sekarang)
        e_ip = data["ip"].setdefault(ip, _entri({}))
        _naikkan(e_ip, TAHAP_TUNDA_IP, sekarang)
        _naikkan(data["global"], TAHAP_TUNDA_GLOBAL, sekarang)
        _batasi_ip(data)
        _tulis_json_atomik(LOCK_PATH, data)
        log.warning("Login admin gagal: ip=%s salah_ip=%d salah_global=%d",
                    ip, e_ip["gagal"], data["global"]["gagal"])
    return status_kunci(ip)


def bersihkan_ip(ip):
    """Login berhasil -> hitungan salah IP ini dihapus (hitungan global tetap)."""
    with _kunci:
        data = _baca_lock()
        if data["ip"].pop(ip, None) is not None:
            _tulis_json_atomik(LOCK_PATH, data)


def reset_kunci_login():
    """Password admin diganti / dibuat -> semua penundaan & hitungan dihapus."""
    with _kunci:
        try:
            os.remove(LOCK_PATH)
        except OSError:
            pass


# ---------------------------------------------------------------------
# Batas percobaan password cadangan (disimpan di file yang sama)
# ---------------------------------------------------------------------
def cadangan_terblokir(ip):
    """None jika boleh mencoba, atau pesan penolakan."""
    data = _rapikan(_baca_lock(), time.time())
    if len(data["cadangan_global"]) >= CADANGAN_MAKS_GLOBAL:
        return "Terlalu banyak percobaan password cadangan hari ini. Coba lagi dalam 24 jam."
    if len(data["cadangan_ip"].get(ip, [])) >= CADANGAN_MAKS_IP:
        return "Terlalu banyak percobaan password cadangan. Coba lagi dalam 5 menit."
    return None


def catat_gagal_cadangan(ip):
    sekarang = time.time()
    with _kunci:
        data = _rapikan(_baca_lock(), sekarang)
        data["cadangan_ip"].setdefault(ip, []).append(sekarang)
        data["cadangan_global"].append(sekarang)
        _tulis_json_atomik(LOCK_PATH, data)
    log.warning("Password cadangan salah: ip=%s", ip)


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


def recovery_hash_tersimpan():
    """Hash password cadangan dari .env, atau None jika belum diatur / formatnya salah."""
    nilai = (os.environ.get("ADMIN_RECOVERY_HASH") or "").strip().lower()
    return nilai if _POLA_SHA256.match(nilai) else None


def cadangan_tersedia():
    return recovery_hash_tersimpan() is not None


def cek_password_cadangan(client_hash):
    tersimpan = recovery_hash_tersimpan()
    if tersimpan is None or not isinstance(client_hash, str):
        return False
    return hmac.compare_digest(client_hash.lower(), tersimpan)


def ganti_password(recovery_hash, client_hash_baru):
    """Ganti password memakai password cadangan. Mengembalikan True jika berhasil."""
    if not cek_password_cadangan(recovery_hash):
        return False
    with _kunci:
        _tulis(client_hash_baru)
    reset_kunci_login()  # password baru -> semua hitungan salah & penundaan dihapus
    return True


# ---------------------------------------------------------------------
# Sesi admin (dict-like: flask.session). Tanpa Flask agar bisa dipakai
# app.py & backend/ sekaligus.
# ---------------------------------------------------------------------
def mulai_sesi_admin(sesi):
    sekarang = int(time.time())
    sesi.clear()
    sesi["is_admin"] = True
    sesi["admin_mulai"] = sekarang
    sesi["admin_aktif"] = sekarang


def cek_sesi_admin(sesi):
    """True jika sesi admin masih berlaku (sekaligus memperbarui waktu aktif).

    Sesi berakhir jika 30 menit tidak aktif atau sudah 8 jam sejak login.
    """
    if not sesi.get("is_admin"):
        return False
    sekarang = int(time.time())
    try:
        mulai = int(sesi.get("admin_mulai", 0))
        aktif = int(sesi.get("admin_aktif", 0))
    except (TypeError, ValueError):
        mulai = aktif = 0
    if sekarang - aktif > SESI_IDLE_DETIK or sekarang - mulai > SESI_MAKS_DETIK:
        sesi.clear()
        return False
    sesi["admin_aktif"] = sekarang
    return True


# ---------------------------------------------------------------------
# Logika rute bersama (dipakai app.py & backend/app/admin/routes.py)
# Setiap fungsi mengembalikan (body_dict, http_status).
# ---------------------------------------------------------------------
_PESAN_DITUTUP = "Login password ditutup karena terlalu banyak percobaan salah. Gunakan password cadangan."
_PESAN_CADANGAN_BELUM_DIATUR = (
    "Password cadangan belum diatur di server. Hubungi tim backend "
    "(jalankan: python -m core.atur_password_cadangan)."
)


def _info_kunci(st):
    return {
        "retry_after": st["sisa_detik"],
        "require_recovery": st["wajib_cadangan"],
        "failed_attempts": st["gagal"],
        "lock_scope": st["lingkup"],
    }


def _format_durasi(detik):
    if detik >= 3600:
        return f"{(detik + 3599) // 3600} jam"
    if detik >= 60:
        return f"{(detik + 59) // 60} menit"
    return f"{detik} detik"


def cek_akses_api(ip):
    """Dipanggil sebelum SETIAP request /api/admin/*. None = boleh lanjut."""
    st = status_kunci(ip)
    if st["sisa_detik"] > 0:
        return {
            "status": "error",
            "message": f"Terlalu banyak password salah. Akses ditunda {_format_durasi(st['sisa_detik'])}.",
            **_info_kunci(st),
        }, 429
    return None


def rute_status(ip):
    st = status_kunci(ip)
    return {"status": "ok", "data": {
        "has_password": sudah_ada_password(),
        "has_recovery": cadangan_tersedia(),
        **_info_kunci(st),
    }}, 200


def rute_login(ip, password_hash):
    if not sudah_ada_password():
        return {"status": "error", "message": "Password admin belum dibuat."}, 409
    st = status_kunci(ip)
    if st["wajib_cadangan"]:
        return {"status": "error", "message": _PESAN_DITUTUP, **_info_kunci(st)}, 423
    if not hash_valid(password_hash) or not cek_password(password_hash):
        st = catat_gagal_login(ip)
        if st["wajib_cadangan"]:
            pesan, kode = _PESAN_DITUTUP, 423
        elif st["sisa_detik"] > 0:
            pesan, kode = f"Password salah. Akses ditunda {_format_durasi(st['sisa_detik'])}.", 429
        else:
            pesan, kode = "Password salah.", 401
        return {"status": "error", "message": pesan, **_info_kunci(st)}, kode
    bersihkan_ip(ip)
    log.info("Login admin berhasil: ip=%s", ip)
    return {"status": "ok", "data": {"logged_in": True}}, 200


def rute_recovery(ip, recovery_hash):
    if not cadangan_tersedia():
        return {"status": "error", "message": _PESAN_CADANGAN_BELUM_DIATUR}, 503
    pesan = cadangan_terblokir(ip)
    if pesan:
        return {"status": "error", "message": pesan}, 429
    if not hash_valid(recovery_hash) or not cek_password_cadangan(recovery_hash):
        catat_gagal_cadangan(ip)
        return {"status": "error", "message": "Password cadangan salah."}, 401
    return {"status": "ok", "data": {"valid": True}}, 200


def rute_reset(ip, recovery_hash, baru):
    if not cadangan_tersedia():
        return {"status": "error", "message": _PESAN_CADANGAN_BELUM_DIATUR}, 503
    pesan = cadangan_terblokir(ip)
    if pesan:
        return {"status": "error", "message": pesan}, 429
    if not hash_valid(recovery_hash) or not hash_valid(baru):
        return {"status": "error", "message": "Format hash tidak valid."}, 400
    if not ganti_password(recovery_hash, baru):
        catat_gagal_cadangan(ip)
        return {"status": "error", "message": "Password cadangan salah."}, 401
    log.warning("Password admin direset memakai password cadangan: ip=%s", ip)
    return {"status": "ok", "data": {"logged_in": True}}, 200


def rute_setup(password_hash):
    if not hash_valid(password_hash):
        return {"status": "error", "message": "Format hash password tidak valid."}, 400
    if not buat_password_pertama(password_hash):
        return {"status": "error", "message": "Password admin sudah pernah dibuat."}, 409
    reset_kunci_login()
    return {"status": "ok", "data": {"logged_in": True}}, 200
