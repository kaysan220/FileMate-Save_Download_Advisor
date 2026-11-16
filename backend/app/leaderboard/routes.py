# =====================================================================
# RUTE LEADERBOARD & STATISTIK DASHBOARD
#   GET  /api/leaderboard?limit=6
#   GET  /api/dashboard-stats
# Skor hanya bisa masuk lewat POST /api/session/<sid>/save (simulation/routes.py).
# Endpoint lama POST /api/submit-score DIHAPUS (16/11/2026) karena menerima skor
# dari browser sehingga leaderboard bisa dipalsukan (SECURITY.md K-03).
# =====================================================================
from flask import Blueprint, jsonify, request

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
