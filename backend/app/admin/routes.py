# =====================================================================
# RUTE MAINTAINER (ADMIN)
#   POST /api/admin/login            {pin}
#   POST /api/admin/logout
#   GET  /api/admin/feedback?limit=
#   GET  /api/admin/export/<scores|feedback>   -> unduh CSV
# KEAMANAN:
#   - PIN dibaca dari .env (ADMIN_PIN); jika kosong, menu admin nonaktif
#   - Perbandingan constant-time (hmac.compare_digest)
#   - Pembatasan percobaan login: 5x gagal / 5 menit per IP
# =====================================================================
import hmac
import threading
import time
from functools import wraps

from flask import Blueprint, Response, current_app, request, session

from ..common.responses import ambil_json, gagal, sukses
from ..common.sanitize import ke_int
from ..feedback import repository as feedback_repo
from . import export

bp = Blueprint("admin", __name__, url_prefix="/api/admin")

MAKS_GAGAL = 5
JENDELA_DETIK = 5 * 60
_gagal_login = {}  # ip -> [timestamp, ...]
_kunci = threading.Lock()


def _terblokir(ip, sekarang):
    with _kunci:
        riwayat = [t for t in _gagal_login.get(ip, []) if sekarang - t < JENDELA_DETIK]
        _gagal_login[ip] = riwayat
        return len(riwayat) >= MAKS_GAGAL


def _catat_gagal(ip, sekarang):
    with _kunci:
        _gagal_login.setdefault(ip, []).append(sekarang)


def wajib_admin(fn):
    @wraps(fn)
    def pembungkus(*args, **kwargs):
        if not session.get("is_admin"):
            return gagal("Butuh login admin.", 401)
        return fn(*args, **kwargs)
    return pembungkus


@bp.post("/login")
def login():
    pin_benar = current_app.config.get("ADMIN_PIN", "")
    if not pin_benar:
        return gagal("Menu admin belum diaktifkan (ADMIN_PIN kosong).", 503)

    ip = request.remote_addr or "?"
    sekarang = time.time()
    if _terblokir(ip, sekarang):
        return gagal("Terlalu banyak percobaan. Coba lagi dalam 5 menit.", 429)

    pin = str(ambil_json().get("pin", ""))
    if not hmac.compare_digest(pin.encode(), pin_benar.encode()):
        _catat_gagal(ip, sekarang)
        return gagal("PIN salah.", 401)

    session.clear()
    session["is_admin"] = True
    return sukses({"logged_in": True})


@bp.post("/logout")
def logout():
    session.clear()
    return sukses({"logged_in": False})


@bp.get("/feedback")
@wajib_admin
def lihat_feedback():
    limit = ke_int(request.args.get("limit"), default=100, minimum=1, maksimum=1000)
    return sukses([feedback_repo.ke_dict(r) for r in feedback_repo.semua_feedback(limit)])


@bp.get("/export/<jenis>")
@wajib_admin
def unduh_csv(jenis):
    if jenis not in export.JENIS_EKSPOR:
        return gagal("Jenis ekspor harus 'scores' atau 'feedback'.", 404)
    nama, isi = export.buat_csv(jenis)
    return Response(
        "﻿" + isi,  # BOM agar Excel membaca UTF-8 dengan benar
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{nama}"'},
    )
