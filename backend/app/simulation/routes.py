# =====================================================================
# RUTE SIMULASI (dipakai tampilan/js/game.js)
#   Kunci jawaban & skor hanya di server:
#     POST /api/session/start            -> 3 skenario versi publik
#     POST /api/session/<sid>/decide     {file_id, action: open|delete, inspected}
#     POST /api/session/<sid>/hint       {scenario_id}
#     POST /api/session/<sid>/finish     -> skor akhir + diagnosis + riwayat
#   Dipakai tampilan/js/result.js:
#     GET  /api/session/<sid>/result     -> hasil akhir untuk ditampilkan
#     POST /api/session/<sid>/save       {username} -> simpan 1x ke leaderboard
#     POST /api/session/<sid>/feedback   {message}  -> feedback 1x (inisial & skor dari server)
#   Utilitas Linux:
#     GET  /api/inspect?file=, /api/hash?file=
#   (GET /api/start-session lama DIHAPUS karena mengirim kunci jawaban)
# =====================================================================
from flask import Blueprint, request

from ..common.responses import ambil_json, gagal, sukses
from ..common.sanitize import sanitasi_teks_csv
from ..feedback import repository as feedback_repo
from ..feedback.routes import MAKS_PANJANG_PESAN
from ..leaderboard import repository as skor_repo
from . import service
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
    return sukses(service.putuskan(
        sid, body.get("file_id"), body.get("action"), diperiksa=body.get("inspected") is True
    ))


@bp.post("/session/<sid>/hint")
def hint(sid):
    body = ambil_json()
    return sukses(service.minta_hint(sid, body.get("scenario_id")))


@bp.post("/session/<sid>/finish")
def selesai(sid):
    return sukses(service.selesaikan(sid))


@bp.get("/session/<sid>/result")
def hasil_akhir(sid):
    return sukses(service.ambil_hasil(sid))


@bp.post("/session/<sid>/save")
def simpan(sid):
    """Skor yang disimpan berasal dari hasil /finish di server, bukan dari browser."""
    hasil = service.simpan_hasil(sid, ambil_json().get("username", ""))
    skor_repo.simpan_skor(hasil["masked_name"], hasil["score"], hasil["time"], hasil["risk_category"])
    return sukses(hasil, 201)


@bp.post("/session/<sid>/feedback")
def feedback_sesi(sid):
    """Feedback terikat sesi: inisial & skor dari server, browser hanya mengirim pesan."""
    pesan = sanitasi_teks_csv(ambil_json().get("message"), max_len=MAKS_PANJANG_PESAN)
    if not pesan:
        return gagal("Pesan masukan tidak boleh kosong.", 400)
    data = service.ambil_data_feedback(sid)
    try:
        kode = feedback_repo.simpan_feedback(sanitasi_teks_csv(data["user"], max_len=10), data["score"], pesan)
    except Exception:
        service.batalkan_feedback(sid)
        raise
    return sukses({"kode_responden": kode}, 201)


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
