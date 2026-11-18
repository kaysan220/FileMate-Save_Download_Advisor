# =====================================================================
# APLIKASI FLASK FILEMATE — application factory
#   create_app(): memuat config, inisialisasi DB, mendaftarkan blueprint,
#                 memasang security headers & (opsional) halaman statis.
# =====================================================================
import os
import sys
from datetime import timedelta

from flask import Flask, redirect, send_from_directory

from .common.responses import gagal
from .config import Config, ROOT_DIR

if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)
from core import admin_auth  # noqa: E402
from core.proxy import pasang_proxy_fix  # noqa: E402


def create_app(config_override=None):
    app = Flask(__name__, static_folder=None)
    app.config.from_object(Config)
    # Cookie admin kedaluwarsa setelah 30 menit tidak aktif (dicek juga di server)
    app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(seconds=admin_auth.SESI_IDLE_DETIK)
    if config_override:
        app.config.update(config_override)

    from . import db
    db.init_db(app)

    from .admin.routes import bp as admin_bp
    from .feedback.routes import bp as feedback_bp
    from .leaderboard.routes import bp as leaderboard_bp
    from .simulation.routes import bp as simulation_bp

    for bp in (simulation_bp, leaderboard_bp, feedback_bp, admin_bp):
        app.register_blueprint(bp)

    # IP asli pengunjung di balik Nginx/Cloudflare (aktif hanya jika PROXY_COUNT di .env)
    pasang_proxy_fix(app)
    _pasang_security_headers(app)
    _pasang_error_handler(app)
    if app.config["SERVE_STATIC"]:
        _pasang_rute_statis(app)

    return app


def _pasang_security_headers(app):
    @app.after_request
    def tambah_header(resp):
        resp.headers["X-Frame-Options"] = "DENY"
        resp.headers["X-Content-Type-Options"] = "nosniff"
        resp.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        resp.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        if resp.mimetype == "application/json" or resp.mimetype == "text/csv":
            resp.headers["Cache-Control"] = "no-store"
        return resp


def _pasang_error_handler(app):
    # Hanya rute /api/* yang dijawab dalam JSON; halaman lain memakai default Flask.
    from flask import request

    def _json_atau_default(e, pesan, status):
        if request.path.startswith("/api/"):
            return gagal(pesan, status)
        return e

    @app.errorhandler(404)
    def tidak_ditemukan(e):
        return _json_atau_default(e, "Endpoint tidak ditemukan.", 404)

    @app.errorhandler(405)
    def metode_salah(e):
        return _json_atau_default(e, "Metode HTTP tidak diizinkan.", 405)

    @app.errorhandler(413)
    def terlalu_besar(e):
        return _json_atau_default(e, "Ukuran request terlalu besar.", 413)

    @app.errorhandler(500)
    def error_server(e):
        app.logger.exception("Error server")
        return _json_atau_default(e, "Terjadi kesalahan di server.", 500)


def _pasang_rute_statis(app):
    """Mode pengembangan: Flask menyajikan halaman (di produksi diganti Nginx)."""
    dirs = app.config["STATIC_DIRS"]

    @app.get("/")
    def beranda():
        return redirect("/page/dashboard.html")

    def _buat_rute(prefix, folder):
        def sajikan(filename):
            return send_from_directory(folder, filename)
        sajikan.__name__ = f"statis_{prefix}"
        app.add_url_rule(f"/{prefix}/<path:filename>", view_func=sajikan, methods=["GET"])

    for prefix, folder in dirs.items():
        if os.path.isdir(folder):
            _buat_rute(prefix, folder)
