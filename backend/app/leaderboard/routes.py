# =====================================================================
# RUTE LEADERBOARD & STATISTIK DASHBOARD
#   GET  /api/leaderboard?limit=6      (tampilan/js/leaderboard.js)
#   GET  /api/dashboard-stats          (tampilan/js/common.js)
#   POST /api/submit-score             (tampilan/js/result.js)
#        {username, score, time} -> skor dihitung di browser (frontend saat ini),
#        divalidasi & dibatasi per IP di common/kiriman.py (SECURITY.md K-03).
#        Sama persis dengan endpoint di app.py.
# Alur yang lebih aman (skor dihitung server) tetap tersedia di
# POST /api/session/<sid>/save (simulation/routes.py).
# =====================================================================
from flask import Blueprint, jsonify, request

from ..common.kiriman import cek_batas_kiriman, validasi_skor
from ..common.responses import ambil_json, sukses
from ..common.sanitize import ke_int
from ..simulation.scenario import ringkasan_bank
from . import repository

bp = Blueprint("leaderboard", __name__, url_prefix="/api")


@bp.get("/leaderboard")
def leaderboard():
    limit = ke_int(request.args.get("limit"), default=6, minimum=1, maksimum=50)
    return jsonify(repository.top_skor(limit))


@bp.get("/dashboard-stats")
def dashboard_stats():
    kategori, total = ringkasan_bank()
    stat = repository.statistik_skor()
    return jsonify({
        "total_skenario": total["skenario"],
        "total_file": total["file"],
        "total_malware": total["malware"],
        "total_aman": total["file"] - total["malware"],
        "kategori": kategori,
        **stat,
    })


@bp.post("/submit-score")
def submit_skor():
    """Body: {username, score, time}. Nama disensor & disimpan ke tabel scores."""
    data = validasi_skor(ambil_json())
    cek_batas_kiriman("skor")
    repository.simpan_skor(data["masked_name"], data["score"], data["time"], data["risk_category"])
    return sukses(data, 201)
