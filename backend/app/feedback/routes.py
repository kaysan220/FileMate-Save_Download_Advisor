# =====================================================================
# RUTE FEEDBACK
#   POST /api/feedback          {user, score, message}   (baru)
#   POST /api/submit-feedback   (alias lama untuk result.html)
# =====================================================================
from flask import Blueprint, jsonify

from ..common.responses import ambil_json, gagal, sukses
from ..common.sanitize import ke_int, sanitasi_teks_csv
from . import repository

bp = Blueprint("feedback", __name__, url_prefix="/api")

MAKS_PANJANG_PESAN = 300


def _simpan_dari_body():
    body = ambil_json()
    pesan = sanitasi_teks_csv(body.get("message"), max_len=MAKS_PANJANG_PESAN)
    if not pesan:
        return None
    inisial = sanitasi_teks_csv(body.get("user") or "A****M", max_len=10)
    skor = ke_int(body.get("score"), default=0, minimum=0, maksimum=100)
    return repository.simpan_feedback(inisial, skor, pesan)


@bp.post("/feedback")
def kirim_feedback():
    kode = _simpan_dari_body()
    if kode is None:
        return gagal("Pesan feedback tidak boleh kosong.", 400)
    return sukses({"kode_responden": kode}, 201)


@bp.post("/submit-feedback")
def kirim_feedback_lama():
    kode = _simpan_dari_body()
    return jsonify({"status": "ok", "saved": kode is not None})
