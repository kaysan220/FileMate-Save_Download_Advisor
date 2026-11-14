# =====================================================================
# RUTE SIMULASI
#   Baru (kunci jawaban di server):
#     POST /api/session/start            {username}
#     POST /api/session/<sid>/decide     {file_id, action: open|delete}
#     POST /api/session/<sid>/hint       {scenario_id}
#     POST /api/session/<sid>/finish     -> skor disimpan ke leaderboard
#   Lama (dipertahankan agar frontend saat ini tetap jalan):
#     GET  /api/start-session, /api/inspect?file=, /api/hash?file=
# =====================================================================
from flask import Blueprint, jsonify, request

from ..common.responses import ambil_json, gagal, sukses
from ..leaderboard import repository as skor_repo
from . import scenario, service
from .linux_utils import jalankan_inspeksi_linux, jalankan_sha256sum_linux

bp = Blueprint("simulation", __name__, url_prefix="/api")


@bp.errorhandler(service.SesiError)
def _tangani_sesi_error(e):
    return gagal(e, e.status)


# ---------------------- Sesi simulasi (baru) -------------------------
@bp.post("/session/start")
def mulai():
    body = ambil_json()
    return sukses(service.mulai_sesi(body.get("username", "")), 201)


@bp.post("/session/<sid>/decide")
def putuskan(sid):
    body = ambil_json()
    return sukses(service.putuskan(sid, body.get("file_id"), body.get("action")))


@bp.post("/session/<sid>/hint")
def hint(sid):
    body = ambil_json()
    return sukses(service.minta_hint(sid, body.get("scenario_id")))


@bp.post("/session/<sid>/finish")
def selesai(sid):
    hasil = service.selesaikan(sid)
    skor_repo.simpan_skor(hasil["masked_name"], hasil["score"], hasil["time"], hasil["risk_category"])
    return sukses(hasil)


# ---------------------- Utilitas Linux --------------------------------
@bp.get("/inspect")
def inspeksi():
    try:
        return sukses(jalankan_inspeksi_linux(request.args.get("file", "")))
    except (ValueError, FileNotFoundError) as e:
        return gagal(e, 400)


@bp.get("/hash")
def hash_file():
    try:
        return sukses(jalankan_sha256sum_linux(request.args.get("file", "")))
    except (ValueError, FileNotFoundError) as e:
        return gagal(e, 400)


# ---------------------- Kompatibilitas lama ---------------------------
@bp.get("/start-session")
def start_session_lama():
    """Format lama: {"1": skenario, "2": ..., "3": ...} lengkap dengan kunci jawaban."""
    return jsonify({str(i): s for i, s in enumerate(scenario.pilih_skenario(), start=1)})
