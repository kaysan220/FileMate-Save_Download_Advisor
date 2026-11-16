# =====================================================================
# RUTE FEEDBACK
#   Feedback pemain sekarang dikirim lewat POST /api/session/<sid>/feedback
#   (simulation/routes.py): inisial & skor diambil dari sesi di server.
#   Daftar / export / reset feedback ada di menu admin (admin/routes.py).
#
#   Endpoint lama POST /api/feedback & /api/submit-feedback DIHAPUS (16/11/2026)
#   karena menerima inisial & skor dari browser (bisa dipalsukan / spam).
# =====================================================================
from flask import Blueprint

bp = Blueprint("feedback", __name__, url_prefix="/api")

MAKS_PANJANG_PESAN = 300
