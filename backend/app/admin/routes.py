# =====================================================================
# RUTE MAINTAINER (ADMIN)
#   GET  /api/admin/status           -> {has_password, retry_after, require_recovery}
#   POST /api/admin/setup            {password_hash}           (hanya jika belum ada password)
#   POST /api/admin/login            {password_hash}
#   POST /api/admin/recovery         {recovery_hash}           (cek password cadangan)
#   POST /api/admin/reset            {recovery_hash, new_password_hash}
#   POST /api/admin/logout
#   GET  /api/admin/feedback?limit=
#   GET  /api/admin/export/<scores|feedback>   -> unduh CSV
# KEAMANAN (logika di core/admin_auth.py, dipakai bersama app.py):
#   - Frontend mengirim SHA-256(password); server menyimpan PBKDF2 dari hash itu
#   - Perbandingan constant-time (hmac.compare_digest)
#   - Password salah ke-5/15/25 -> tunda 30 dtk / 5 mnt / 1 jam;
#     ke-35 -> login ditutup, wajib password cadangan.
#     Selama ditunda, SEMUA endpoint /api/admin/* menjawab 429.
# =====================================================================
import sys
from functools import wraps

from flask import Blueprint, Response, jsonify, request, session

from ..common.responses import ambil_json, gagal, sukses
from ..common.sanitize import ke_int
from ..config import ROOT_DIR
from ..feedback import repository as feedback_repo
from . import export

if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)
from core import admin_auth  # noqa: E402  (dipakai bersama app.py di root)

bp = Blueprint("admin", __name__, url_prefix="/api/admin")


def _ip():
    return request.remote_addr or "?"


def _jawab(hasil, login_berhasil=False):
    body, kode = hasil
    if login_berhasil and kode == 200:
        session.clear()
        session["is_admin"] = True
    resp = jsonify(body)
    resp.status_code = kode
    if body.get("retry_after"):
        resp.headers["Retry-After"] = str(body["retry_after"])
    return resp


@bp.before_request
def tutup_saat_ditunda():
    """Selama penundaan aktif, semua endpoint admin ditolak."""
    hasil = admin_auth.cek_akses_api()
    if hasil is not None:
        session.pop("is_admin", None)
        return _jawab(hasil)
    return None


def wajib_admin(fn):
    @wraps(fn)
    def pembungkus(*args, **kwargs):
        if not session.get("is_admin"):
            return gagal("Butuh login admin.", 401)
        return fn(*args, **kwargs)
    return pembungkus


@bp.get("/status")
def status():
    return _jawab(admin_auth.rute_status())


@bp.post("/setup")
def setup():
    return _jawab(admin_auth.rute_setup(ambil_json().get("password_hash")), login_berhasil=True)


@bp.post("/login")
def login():
    return _jawab(admin_auth.rute_login(ambil_json().get("password_hash")), login_berhasil=True)


@bp.post("/recovery")
def cek_cadangan():
    return _jawab(admin_auth.rute_recovery(_ip(), ambil_json().get("recovery_hash")))


@bp.post("/reset")
def reset_password():
    body = ambil_json()
    return _jawab(
        admin_auth.rute_reset(_ip(), body.get("recovery_hash"), body.get("new_password_hash")),
        login_berhasil=True,
    )


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
