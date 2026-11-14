# =====================================================================
# FORMAT RESPONS JSON SERAGAM
#   Sukses : {"status": "ok",    "data": ...}
#   Gagal  : {"status": "error", "message": "..."}
# =====================================================================
from flask import jsonify, request


def sukses(data=None, status=200, **ekstra):
    body = {"status": "ok", "data": data}
    body.update(ekstra)
    return jsonify(body), status


def gagal(pesan, status=400):
    return jsonify({"status": "error", "message": str(pesan)}), status


def ambil_json():
    """Membaca body JSON dengan aman; selalu mengembalikan dict."""
    body = request.get_json(silent=True)
    return body if isinstance(body, dict) else {}
