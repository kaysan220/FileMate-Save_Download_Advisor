# =====================================================================
# LAYANAN SESI SIMULASI — state sesi, penilaian keputusan, hint
#
# Kunci jawaban (isMalware) hanya disimpan di server. Browser cukup
# mengirim keputusan "open"/"delete" per file, server yang menilai.
#
# CATATAN DEPLOY: state disimpan di memori proses. Jalankan gunicorn
# dengan 1 worker (boleh banyak thread), atau pindahkan ke SQLite/Redis
# bila nanti butuh banyak worker.
# =====================================================================
import secrets
import threading
import time

from flask import current_app

from ..common.sanitize import sensor_nama
from ..scoring.calculator import nilai
from . import scenario as scenario_mod

AKSI_VALID = ("open", "delete")

_sesi = {}
_kunci = threading.Lock()


class SesiError(Exception):
    """Kesalahan yang aman ditampilkan ke pengguna (status 4xx)."""

    def __init__(self, pesan, status=400):
        super().__init__(pesan)
        self.status = status


# ---------------------------------------------------------------------
# Utilitas internal
# ---------------------------------------------------------------------
def _bersihkan_kedaluwarsa(sekarang):
    ttl = current_app.config["SESSION_TTL_DETIK"]
    for sid in [s for s, d in _sesi.items() if sekarang - d["mulai"] > ttl]:
        del _sesi[sid]


def _ambil(sid):
    data = _sesi.get(str(sid or ""))
    if data is None:
        raise SesiError("Sesi tidak ditemukan atau sudah kedaluwarsa.", 404)
    return data


def _format_waktu(detik):
    detik = max(0, int(detik))
    return f"{detik // 60:02d}:{detik % 60:02d}"


# ---------------------------------------------------------------------
# API layanan
# ---------------------------------------------------------------------
def mulai_sesi(username):
    skenario = scenario_mod.pilih_skenario()
    sekarang = time.time()
    sid = secrets.token_urlsafe(16)

    with _kunci:
        _bersihkan_kedaluwarsa(sekarang)
        if len(_sesi) >= current_app.config["MAKS_SESI_AKTIF"]:
            raise SesiError("Server sedang penuh, coba lagi beberapa saat.", 503)
        _sesi[sid] = {
            "nama": sensor_nama(username),
            "mulai": sekarang,
            "skenario": {s["id"]: s for s in skenario},
            "urutan": [s["id"] for s in skenario],
            # file_id -> {"scenario_id", "isMalware"}
            "file": {f["id"]: {"scenario_id": s["id"], "isMalware": bool(f.get("isMalware"))}
                     for s in skenario for f in s["files"]},
            "keputusan": {},      # file_id -> "open"/"delete"
            "hint": set(),        # scenario_id yang hint-nya sudah dibuka
        }

    return {
        "session_id": sid,
        "masked_name": _sesi[sid]["nama"],
        "scenarios": [scenario_mod.versi_publik(s) for s in skenario],
    }


def putuskan(sid, file_id, aksi):
    if aksi not in AKSI_VALID:
        raise SesiError("Aksi harus 'open' atau 'delete'.")
    with _kunci:
        data = _ambil(sid)
        info = data["file"].get(str(file_id or ""))
        if info is None:
            raise SesiError("File tidak ada di sesi ini.", 404)
        if file_id in data["keputusan"]:
            raise SesiError("Keputusan untuk file ini sudah dikunci.", 409)
        data["keputusan"][file_id] = aksi

    malware = info["isMalware"]
    benar = (aksi == "delete") == malware
    return {
        "file_id": file_id,
        "action": aksi,
        "correct": benar,
        "is_malware": malware,
        "outcome": ("safe" if benar else ("malware_opened" if malware else "false_alarm")),
    }


def minta_hint(sid, scenario_id):
    with _kunci:
        data = _ambil(sid)
        sken = data["skenario"].get(str(scenario_id or ""))
        if sken is None:
            raise SesiError("Skenario tidak ada di sesi ini.", 404)
        data["hint"].add(sken["id"])
        jumlah = len(data["hint"])
    return {
        "scenario_id": sken["id"],
        "hint_author": sken.get("hintAuthor", ""),
        "hint_text": sken.get("hintText", ""),
        "hints_used": jumlah,
    }


def selesaikan(sid):
    """Menghitung skor akhir dan menghapus sesi. Mengembalikan hasil + data skor untuk disimpan."""
    with _kunci:
        data = _ambil(sid)
        del _sesi[sid]

    malware_dibuka = salah_hapus = 0
    ringkasan = []
    for scen_id in data["urutan"]:
        sken = data["skenario"][scen_id]
        salah = 0
        for f in sken["files"]:
            aksi = data["keputusan"].get(f["id"])
            # File yang belum diputuskan dianggap "dibuka" (perilaku asal klik)
            aksi = aksi or "open"
            if f.get("isMalware") and aksi == "open":
                malware_dibuka += 1
                salah += 1
            elif not f.get("isMalware") and aksi == "delete":
                salah_hapus += 1
                salah += 1
        ringkasan.append({
            "scenario_id": scen_id,
            "title": sken.get("title", ""),
            "mistakes": salah,
            "ending": sken.get("goodEnding" if salah == 0 else "badEnding", ""),
            "lesson_title": sken.get("lessonTitle", ""),
            "lesson_body": sken.get("lessonBody", ""),
            "real_life_tip": sken.get("realLifeTip", ""),
        })

    skor, kategori = nilai(malware_dibuka, salah_hapus, len(data["hint"]))
    return {
        "masked_name": data["nama"],
        "score": skor,
        "risk_category": kategori,
        "time": _format_waktu(time.time() - data["mulai"]),
        "malware_opened": malware_dibuka,
        "false_alarm": salah_hapus,
        "hints_used": len(data["hint"]),
        "scenarios": ringkasan,
    }
