# =====================================================================
# RUTE FEEDBACK
#   POST /api/submit-feedback          (tampilan/js/result.js)
#        {user, score, message} -> inisial & skor berasal dari browser
#        (frontend saat ini), divalidasi & dibatasi per IP di
#        common/kiriman.py (SECURITY.md K-03). Sama persis dengan app.py.
#
#   Alur yang lebih aman: POST /api/session/<sid>/feedback
#   (simulation/routes.py) — inisial & skor diambil dari sesi di server.
#   Daftar / export / reset feedback ada di menu admin (admin/routes.py).
# =====================================================================
from flask import Blueprint

from ..common.kiriman import MAKS_PANJANG_PESAN, cek_batas_kiriman, validasi_feedback
from ..common.responses import ambil_json, sukses
from ..common.sanitize import sanitasi_teks_csv
from . import repository

bp = Blueprint("feedback", __name__, url_prefix="/api")

__all__ = ["bp", "MAKS_PANJANG_PESAN"]


@bp.post("/submit-feedback")
def submit_feedback():
    """Body: {user, score, message}. Disimpan ke tabel feedback."""
    data = validasi_feedback(ambil_json())
    cek_batas_kiriman("feedback")
    kode = repository.simpan_feedback(sanitasi_teks_csv(data["user"], max_len=10), data["score"], data["message"])
    return sukses({"saved": True, "kode_responden": kode}, 201)
