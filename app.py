# =====================================================================
# SERVER UTAMA PYTHON FLASK — FILEMATE (SAFE DOWNLOAD ADVISOR)
# Tim Satgas Salah Download (Kelompok 6 RKS Polibatam)
# Cara menjalankan:
#   1. pip install flask
#   2. python app.py
#   3. Buka browser di http://127.0.0.1:5000
# =====================================================================
import os
from flask import Flask, jsonify, request, send_from_directory, redirect
from core.algorithms import (
    baca_skenario, nilai, tulis_log, baca_leaderboard, tulis_feedback,
    ringkasan_dashboard
)
from core.linux_utils import jalankan_sha256sum_linux, jalankan_inspeksi_linux
from core import admin_auth

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__)


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

@app.route("/api/start-session", methods=["GET"])
def api_start_session():
    """Mengambil 3 skenario acak dari data/skenario.json (Tugas Rohit)."""
    return jsonify(baca_skenario())


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


@app.route("/api/submit-score", methods=["POST"])
def api_submit_score():
    """Menyimpan skor ke data/hasil.csv dengan nama disensor (Tugas Kaysan)."""
    body = request.get_json(silent=True) or {}
    nama_raw = body.get("username", "Anonim")
    waktu_str = body.get("time", "01:00")

    if "malware_opened" in body:
        skor_akhir, kategori = nilai(
            body.get("malware_opened", 0),
            body.get("false_alarm", 0),
            body.get("hints_used", 0)
        )
    else:
        skor_akhir = int(body.get("score", 100))
        kategori = "TINGGI" if skor_akhir <= 50 else ("SEDANG" if skor_akhir <= 80 else "RENDAH")

    nama_tersensor = tulis_log(nama_raw, skor_akhir, waktu_str, kategori)
    return jsonify({
        "status": "ok",
        "masked_name": nama_tersensor,
        "score": skor_akhir,
        "risk_category": kategori
    })


@app.route("/api/submit-feedback", methods=["POST"])
def api_submit_feedback():
    """Menyimpan saran responden ke data/feedback_user.csv (Tugas Kaysan & Yazid)."""
    body = request.get_json(silent=True) or {}
    inisial = body.get("user", "A****M")
    skor = body.get("score", 100)
    pesan = body.get("message", "")
    berhasil = tulis_feedback(inisial, skor, pesan)
    return jsonify({"status": "ok", "saved": berhasil})


# =====================================================================
# ENDPOINT PASSWORD MAINTAINER (ADMIN) — logika di core/admin_auth.py
# Frontend hanya mengirim SHA-256(password), tidak pernah password asli.
# Password salah ke-5/15/25 -> tunda 30 dtk / 5 mnt / 1 jam; ke-35 -> wajib
# password cadangan. Selama ditunda, semua /api/admin/* menjawab 429.
# =====================================================================
def _body():
    body = request.get_json(silent=True)
    return body if isinstance(body, dict) else {}


def _jawab(hasil):
    body, kode = hasil
    resp = jsonify(body)
    resp.status_code = kode
    if body.get("retry_after"):
        resp.headers["Retry-After"] = str(body["retry_after"])
    return resp


@app.before_request
def tutup_admin_saat_ditunda():
    if request.path.startswith("/api/admin/"):
        hasil = admin_auth.cek_akses_api()
        if hasil is not None:
            return _jawab(hasil)
    return None


@app.route("/api/admin/status", methods=["GET"])
def api_admin_status():
    return _jawab(admin_auth.rute_status())


@app.route("/api/admin/setup", methods=["POST"])
def api_admin_setup():
    return _jawab(admin_auth.rute_setup(_body().get("password_hash")))


@app.route("/api/admin/login", methods=["POST"])
def api_admin_login():
    return _jawab(admin_auth.rute_login(_body().get("password_hash")))


@app.route("/api/admin/recovery", methods=["POST"])
def api_admin_recovery():
    return _jawab(admin_auth.rute_recovery(request.remote_addr or "?", _body().get("recovery_hash")))


@app.route("/api/admin/reset", methods=["POST"])
def api_admin_reset():
    body = _body()
    return _jawab(admin_auth.rute_reset(
        request.remote_addr or "?", body.get("recovery_hash"), body.get("new_password_hash")))


if __name__ == "__main__":
    print("====================================================")
    print(" 🛡️ Server FileMate Aktif di http://127.0.0.1:5000 ")
    print("====================================================")
    app.run(host="127.0.0.1", port=5000, debug=False)
