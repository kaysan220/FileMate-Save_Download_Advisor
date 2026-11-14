# =====================================================================
# RUTE LEADERBOARD & STATISTIK DASHBOARD
#   GET  /api/leaderboard?limit=6
#   GET  /api/dashboard-stats
#   POST /api/submit-score   (lama — skor dihitung dari data klien)
# =====================================================================
from flask import Blueprint, jsonify, request

from ..common.responses import ambil_json
from ..common.sanitize import ke_int, sanitasi_waktu, sensor_nama
from ..scoring.calculator import kategori_risiko, nilai
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
def submit_score_lama():
    """
    Endpoint lama untuk result.html. Lebih aman memakai /api/session/<sid>/finish
    karena di sana skor dihitung sepenuhnya oleh server.
    """
    body = ambil_json()
    if "malware_opened" in body:
        skor, kategori = nilai(body.get("malware_opened"), body.get("false_alarm"), body.get("hints_used"))
    else:
        skor = ke_int(body.get("score"), default=0, minimum=0, maksimum=100)
        kategori = kategori_risiko(skor)

    nama = sensor_nama(body.get("username"))
    repository.simpan_skor(nama, skor, sanitasi_waktu(body.get("time")), kategori)
    return jsonify({"status": "ok", "masked_name": nama, "score": skor, "risk_category": kategori})
