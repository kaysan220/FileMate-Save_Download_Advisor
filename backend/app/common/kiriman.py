# =====================================================================
# KIRIMAN SKOR & FEEDBACK DARI FRONTEND — dipakai app.py DAN backend/
#
# Frontend saat ini (tampilan/js/game.js + result.js) menghitung skor di
# browser, lalu mengirim:
#     POST /api/submit-score    {username, score, time}     (result.js)
#     POST /api/submit-feedback {user, score, message}      (result.js)
#
# Karena nilainya berasal dari klien (SECURITY.md K-03), server TIDAK
# percaya begitu saja:
#   - skor wajib int 0-100 dan kelipatan 5 (semua penalti -15/-5/-5),
#   - waktu wajib MM:SS, kategori risiko dihitung server,
#   - nama disensor ulang (R****T), pesan disanitasi (anti-XSS & CSV Injection),
#   - jumlah kiriman dibatasi per IP: SUBMIT_BATAS_PER_IP kiriman per
#     SUBMIT_JENDELA_DETIK (bawaan 5 per 10 menit, bisa diatur di .env).
#
# Kedua server memakai modul ini, sehingga aturan & pesan error-nya selalu sama.
# =====================================================================
import os
import re
import threading
import time

from flask import current_app, request

from ..scoring.calculator import KELIPATAN_SKOR, SKOR_AWAL, kategori_risiko
from .sanitize import sanitasi_teks_csv, sensor_nama

MAKS_PANJANG_PESAN = 300   # sama dengan maxlength textarea di result.js
BAWAAN_BATAS_PER_IP = 5
BAWAAN_JENDELA_DETIK = 10 * 60

_POLA_WAKTU = re.compile(r"^\d{1,3}:[0-5]\d$")   # format timeStr di result.js
_MAKS_KUNCI = 5000                               # cegah dict tumbuh tanpa batas

_riwayat = {}              # (jenis, ip) -> [timestamp monotonic, ...]
_kunci = threading.Lock()


class KirimanError(Exception):
    """Kiriman frontend ditolak. Pesannya aman ditampilkan (status 4xx)."""

    def __init__(self, pesan, status=400):
        super().__init__(pesan)
        self.status = status


def angka_env(nama, bawaan):
    """Membaca angka bulat positif dari environment/.env; tidak valid -> nilai bawaan."""
    try:
        nilai = int(str(os.environ.get(nama) or "").strip())
    except ValueError:
        return bawaan
    return nilai if nilai > 0 else bawaan


def konfigurasi_env():
    """Pengaturan batas kiriman untuk app.config (dipakai app.py & backend/app/config.py)."""
    return {
        "SUBMIT_BATAS_PER_IP": angka_env("SUBMIT_BATAS_PER_IP", BAWAAN_BATAS_PER_IP),
        "SUBMIT_JENDELA_DETIK": angka_env("SUBMIT_JENDELA_DETIK", BAWAAN_JENDELA_DETIK),
    }


# ---------------------------------------------------------------------
# Validasi isi kiriman
# ---------------------------------------------------------------------
def _skor_valid(nilai):
    if isinstance(nilai, bool) or not isinstance(nilai, int):
        raise KirimanError("Skor tidak valid.")
    if not 0 <= nilai <= SKOR_AWAL or nilai % KELIPATAN_SKOR != 0:
        raise KirimanError("Skor tidak valid.")
    return nilai


def validasi_skor(body):
    """Body /api/submit-score -> {masked_name, score, time, risk_category}."""
    skor = _skor_valid(body.get("score"))
    waktu = str(body.get("time") or "")
    if not _POLA_WAKTU.match(waktu):
        raise KirimanError("Format waktu harus MM:SS.")
    return {
        "masked_name": sensor_nama(body.get("username", "")),
        "score": skor,
        "time": waktu,
        "risk_category": kategori_risiko(skor),
    }


def validasi_feedback(body):
    """Body /api/submit-feedback -> {user, score, message} yang sudah aman disimpan."""
    skor = _skor_valid(body.get("score"))
    pesan = sanitasi_teks_csv(body.get("message"), max_len=MAKS_PANJANG_PESAN)
    if not pesan:
        raise KirimanError("Pesan masukan tidak boleh kosong.")
    return {"user": sensor_nama(body.get("user", "")), "score": skor, "message": pesan}


# ---------------------------------------------------------------------
# Pembatas jumlah kiriman per IP (anti-spam leaderboard / feedback)
# Disimpan di memori: hilang saat restart, cukup untuk 1 worker.
# ---------------------------------------------------------------------
_PESAN_BATAS = {
    "skor": "Terlalu banyak kiriman skor. Coba lagi nanti.",
    "feedback": "Terlalu banyak kiriman masukan. Coba lagi nanti.",
}


def cek_batas_kiriman(jenis):
    """Mencatat 1 kiriman dari IP ini; melempar KirimanError(429) jika melewati batas."""
    cfg = current_app.config
    batas = cfg.get("SUBMIT_BATAS_PER_IP", BAWAAN_BATAS_PER_IP)
    jendela = cfg.get("SUBMIT_JENDELA_DETIK", BAWAAN_JENDELA_DETIK)
    sekarang = time.monotonic()
    kunci = (jenis, request.remote_addr or "?")  # IP asli jika ProxyFix aktif (core/proxy.py)

    with _kunci:
        jejak = [t for t in _riwayat.get(kunci, []) if sekarang - t < jendela]
        boleh = len(jejak) < batas
        if boleh:
            jejak.append(sekarang)
        _riwayat[kunci] = jejak
        if len(_riwayat) > _MAKS_KUNCI:
            for k in list(_riwayat):
                _riwayat[k] = [t for t in _riwayat[k] if sekarang - t < jendela]
                if not _riwayat[k]:
                    del _riwayat[k]

    if not boleh:
        raise KirimanError(_PESAN_BATAS.get(jenis, "Terlalu banyak kiriman. Coba lagi nanti."), 429)


def reset_batas_kiriman():
    """Mengosongkan catatan kiriman (dipakai tes)."""
    with _kunci:
        _riwayat.clear()
