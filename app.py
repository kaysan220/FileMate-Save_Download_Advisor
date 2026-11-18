# =====================================================================
# SERVER UTAMA PYTHON FLASK — FILEMATE (SAFE DOWNLOAD ADVISOR)
# Tim Satgas Salah Download (Kelompok 6 RKS Polibatam)
# Cara menjalankan:
#   1. pip install flask
#   2. python app.py
#   3. Buka browser di http://127.0.0.1:5000
# =====================================================================
import os
import secrets
from datetime import timedelta
from functools import wraps
from flask import Flask, Response, jsonify, request, send_from_directory, redirect, session
from core.algorithms import (
    SKENARIO_PATH, tulis_log, baca_leaderboard, tulis_feedback,
    ringkasan_dashboard
)
from core.linux_utils import jalankan_sha256sum_linux, jalankan_inspeksi_linux
from core import admin_auth, admin_data
from core.proxy import pasang_proxy_fix
# Logika sesi simulasi dipakai bersama dengan backend/ (tidak disalin ulang)
from backend.app.simulation import service as sesi_service

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__)
app.config.update(
    SKENARIO_PATH=SKENARIO_PATH,
    SESSION_TTL_DETIK=60 * 60,   # sesi simulasi kedaluwarsa setelah 1 jam
    MAKS_SESI_AKTIF=500,         # batas sesi di memori (anti-DoS sederhana)
    # Cookie sesi login admin (menu Satgas). Tanpa SECRET_KEY di .env, kunci acak
    # dibuat tiap server start -> admin perlu login ulang setelah server restart.
    SECRET_KEY=os.environ.get("SECRET_KEY") or secrets.token_hex(32),
    SESSION_COOKIE_HTTPONLY=True,     # cookie tidak bisa dibaca JavaScript
    SESSION_COOKIE_SAMESITE="Strict", # cegah request dari situs lain (CSRF)
    SESSION_COOKIE_SECURE=os.environ.get("COOKIE_SECURE", "0") == "1",
    # Cookie admin ikut kedaluwarsa setelah 30 menit tidak aktif (dicek juga di server)
    PERMANENT_SESSION_LIFETIME=timedelta(seconds=admin_auth.SESI_IDLE_DETIK),
    MAX_CONTENT_LENGTH=16 * 1024,     # body request maksimal 16 KB (sama dengan backend/)
)
# IP asli pengunjung di balik Nginx/Cloudflare (aktif hanya jika PROXY_COUNT di .env)
pasang_proxy_fix(app)


# Header Keamanan HTTP (AppSec Hardening)
@app.after_request
def tambah_security_headers(response):
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


# Rute Halaman Statis Frontend (page/ dan tampilan/)
@app.route("/")
def root_index():
    return redirect("/page/dashboard.html")


@app.route("/page/<path:filename>")
def serve_pages(filename):
    return send_from_directory(os.path.join(BASE_DIR, "page"), filename)


@app.route("/tampilan/<path:filename>")
def serve_assets(filename):
    return send_from_directory(os.path.join(BASE_DIR, "tampilan"), filename)


@app.route("/image/<path:filename>")
def serve_images(filename):
    return send_from_directory(os.path.join(BASE_DIR, "image"), filename)


# =====================================================================
# ENDPOINT API BACKEND (UNTUK KONEKSI FETCH DARI FRONTEND)
# =====================================================================

# ---------------------------------------------------------------------
# SESI SIMULASI (dipakai tampilan/js/game.js) — kunci jawaban & skor di server.
# Rute lama GET /api/start-session dihapus karena mengirim kunci jawaban.
# ---------------------------------------------------------------------
def _ok(data, status=200):
    return jsonify({"status": "ok", "data": data}), status


@app.errorhandler(sesi_service.SesiError)
def tangani_sesi_error(e):
    return jsonify({"status": "error", "message": str(e)}), e.status


def _json_body():
    body = request.get_json(silent=True)
    return body if isinstance(body, dict) else {}


@app.route("/api/session/start", methods=["POST"])
def api_session_start():
    return _ok(sesi_service.mulai_sesi(), 201)


@app.route("/api/session/<sid>/decide", methods=["POST"])
def api_session_decide(sid):
    body = _json_body()
    return _ok(sesi_service.putuskan(
        sid, body.get("file_id"), body.get("action"), diperiksa=body.get("inspected") is True))


@app.route("/api/session/<sid>/hint", methods=["POST"])
def api_session_hint(sid):
    return _ok(sesi_service.minta_hint(sid, _json_body().get("scenario_id")))


@app.route("/api/session/<sid>/finish", methods=["POST"])
def api_session_finish(sid):
    return _ok(sesi_service.selesaikan(sid))


# Dipakai tampilan/js/result.js
@app.route("/api/session/<sid>/result", methods=["GET"])
def api_session_result(sid):
    return _ok(sesi_service.ambil_hasil(sid))


@app.route("/api/session/<sid>/save", methods=["POST"])
def api_session_save(sid):
    """Skor yang disimpan ke hasil.csv berasal dari hasil /finish di server."""
    username = _json_body().get("username", "")
    hasil = sesi_service.simpan_hasil(sid, username)
    tulis_log(username, hasil["score"], hasil["time"], hasil["risk_category"])
    return _ok(hasil, 201)


@app.route("/api/session/<sid>/feedback", methods=["POST"])
def api_session_feedback(sid):
    """Feedback terikat sesi: inisial & skor dari server, browser hanya mengirim pesan."""
    pesan = str(_json_body().get("message") or "").strip()
    if not pesan:
        return jsonify({"status": "error", "message": "Pesan masukan tidak boleh kosong."}), 400
    data = sesi_service.ambil_data_feedback(sid)
    if not tulis_feedback(data["user"], data["score"], pesan):
        sesi_service.batalkan_feedback(sid)
        return jsonify({"status": "error", "message": "Pesan masukan tidak valid."}), 400
    return _ok({"saved": True}, 201)


@app.route("/api/leaderboard", methods=["GET"])
def api_get_leaderboard():
    """Membaca daftar peringkat dari data/hasil.csv (Tugas Kaysan & Yazid)."""
    return jsonify(baca_leaderboard(limit=6))


@app.route("/api/dashboard-stats", methods=["GET"])
def api_dashboard_stats():
    """Ringkasan statistik skenario & sesi untuk halaman dashboard.html."""
    return jsonify(ringkasan_dashboard())


@app.route("/api/inspect", methods=["GET"])
def api_inspect_file():
    """Menjalankan utilitas Linux `file --mime-type` dan `ls -l` (Tugas Yazid)."""
    nama_file = request.args.get("file", "")
    try:
        hasil = jalankan_inspeksi_linux(nama_file)
        return jsonify({"status": "ok", "data": hasil})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400


@app.route("/api/hash", methods=["GET"])
def api_hash_file():
    """Menjalankan utilitas Linux `sha256sum` (Tugas Yazid)."""
    nama_file = request.args.get("file", "")
    try:
        hasil = jalankan_sha256sum_linux(nama_file)
        return jsonify({"status": "ok", "data": hasil})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400


# Endpoint lama POST /api/submit-score & /api/submit-feedback DIHAPUS (16/11/2026):
# keduanya menerima skor dari browser sehingga leaderboard/feedback bisa dipalsukan.
# Penggantinya: POST /api/session/<sid>/save & /api/session/<sid>/feedback (skor dari server).


# =====================================================================
# ENDPOINT PASSWORD MAINTAINER (ADMIN) — logika di core/admin_auth.py
# Frontend hanya mengirim SHA-256(password), tidak pernah password asli.
# Per IP: salah ke-5/15/25 -> tunda 30 dtk / 5 mnt / 1 jam; ke-35 -> wajib
# password cadangan. Ditambah batas global & hitungan yang kedaluwarsa 24 jam.
# Selama ditunda, semua /api/admin/* menjawab 429 untuk IP tersebut.
# =====================================================================
def _body():
    body = request.get_json(silent=True)
    return body if isinstance(body, dict) else {}


def _ip():
    # Sudah berisi IP asli jika ProxyFix aktif (core/proxy.py)
    return request.remote_addr or "?"


def _jawab(hasil, login_berhasil=False):
    body, kode = hasil
    if login_berhasil and kode == 200:
        admin_auth.mulai_sesi_admin(session)  # cookie sesi: dibutuhkan endpoint data admin
        session.permanent = True              # berlaku PERMANENT_SESSION_LIFETIME
    resp = jsonify(body)
    resp.status_code = kode
    if body.get("retry_after"):
        resp.headers["Retry-After"] = str(body["retry_after"])
    return resp


def _wajib_admin(fn):
    @wraps(fn)
    def pembungkus(*args, **kwargs):
        if not admin_auth.cek_sesi_admin(session):
            return jsonify({"status": "error",
                            "message": "Sesi admin berakhir atau belum login. Silakan login lagi."}), 401
        return fn(*args, **kwargs)
    return pembungkus


@app.before_request
def tutup_admin_saat_ditunda():
    if request.path.startswith("/api/admin/"):
        hasil = admin_auth.cek_akses_api(_ip())
        if hasil is not None:
            session.pop("is_admin", None)
            return _jawab(hasil)
    return None


@app.route("/api/admin/status", methods=["GET"])
def api_admin_status():
    return _jawab(admin_auth.rute_status(_ip()))


@app.route("/api/admin/setup", methods=["POST"])
def api_admin_setup():
    return _jawab(admin_auth.rute_setup(_body().get("password_hash")), login_berhasil=True)


@app.route("/api/admin/login", methods=["POST"])
def api_admin_login():
    return _jawab(admin_auth.rute_login(_ip(), _body().get("password_hash")), login_berhasil=True)


@app.route("/api/admin/recovery", methods=["POST"])
def api_admin_recovery():
    return _jawab(admin_auth.rute_recovery(_ip(), _body().get("recovery_hash")))


@app.route("/api/admin/reset", methods=["POST"])
def api_admin_reset():
    body = _body()
    return _jawab(admin_auth.rute_reset(
        _ip(), body.get("recovery_hash"), body.get("new_password_hash")),
        login_berhasil=True)


@app.route("/api/admin/logout", methods=["POST"])
def api_admin_logout():
    session.clear()
    return jsonify({"status": "ok", "data": {"logged_in": False}})


# ---------------------------------------------------------------------
# DATA MENU SATGAS (WAJIB LOGIN) — logika CSV di core/admin_data.py
# ---------------------------------------------------------------------
@app.route("/api/admin/feedback", methods=["GET"])
@_wajib_admin
def api_admin_feedback():
    try:
        limit = max(1, min(1000, int(request.args.get("limit", 100))))
    except (TypeError, ValueError):
        limit = 100
    return jsonify({"status": "ok", "data": admin_data.baca_feedback(limit)})


@app.route("/api/admin/export/<jenis>", methods=["GET"])
@_wajib_admin
def api_admin_export(jenis):
    try:
        nama, isi = admin_data.buat_csv_unduh(jenis)
    except ValueError as e:
        return jsonify({"status": "error", "message": str(e)}), 404
    return Response(
        "﻿" + isi,  # BOM agar Excel membaca UTF-8 dengan benar
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{nama}"', "Cache-Control": "no-store"},
    )


@app.route("/api/admin/clear/<jenis>", methods=["POST"])
@_wajib_admin
def api_admin_clear(jenis):
    try:
        jumlah = admin_data.kosongkan_data(jenis)
    except ValueError as e:
        return jsonify({"status": "error", "message": str(e)}), 404
    return jsonify({"status": "ok", "data": {"cleared": jenis, "deleted": jumlah}})


if __name__ == "__main__":
    print("====================================================")
    print(" 🛡️ Server FileMate Aktif di http://127.0.0.1:5000 ")
    print("====================================================")
    app.run(host="127.0.0.1", port=5000, debug=False)
