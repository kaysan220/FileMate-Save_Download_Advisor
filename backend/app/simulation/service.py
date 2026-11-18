# =====================================================================
# LAYANAN SESI SIMULASI — state sesi, penilaian keputusan, hint, skor
#
# Kunci jawaban (isMalware, payloadStatus, hint, ending, pembahasan)
# hanya disimpan di server. Browser cukup mengirim keputusan
# "open"/"delete" per file, server yang menilai & menghitung skor.
#
# Alur:
#   mulai_sesi()     -> 3 skenario versi publik (tanpa kunci jawaban)
#   putuskan()       -> nilai 1 keputusan; jika 1 skenario selesai, kirim ending + pembahasan
#   minta_hint()     -> teks hint (penalti dihitung 1x per skenario)
#   selesaikan()     -> skor akhir, diagnosis per jenis, riwayat; hasil disimpan sementara
#   ambil_hasil()    -> hasil akhir untuk ditampilkan di result.html
#   simpan_hasil()   -> hasil yang sudah selesai disimpan 1x ke leaderboard dengan nama pemain
#   ambil_data_feedback() -> inisial & skor untuk feedback (1x per sesi)
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
from ..scoring.calculator import kategori_risiko, nilai
from . import scenario as scenario_mod

AKSI_VALID = ("open", "delete")
JENIS_KESALAHAN = ("SPOOFING", "HASH", "FATIGUE", "IMPULSIVE")

_sesi = {}   # sid -> state sesi yang sedang dimainkan
_hasil = {}  # sid -> hasil akhir yang menunggu disimpan ke leaderboard
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
    for sid in [s for s, d in _hasil.items() if sekarang - d["selesai"] > ttl]:
        del _hasil[sid]


def _ambil(sid):
    data = _sesi.get(str(sid or ""))
    if data is None:
        raise SesiError("Sesi tidak ditemukan atau sudah kedaluwarsa.", 404)
    return data


def _format_waktu(detik):
    detik = max(0, int(detik))
    return f"{detik // 60:02d}:{detik % 60:02d}"


def _hasil_keputusan(is_malware, aksi):
    """outcome: safe | malware_opened | false_alarm"""
    if is_malware and aksi == "open":
        return "malware_opened"
    if not is_malware and aksi == "delete":
        return "false_alarm"
    return "safe"


def _skor_saat_ini(data):
    malware = sum(1 for fid, aksi in data["keputusan"].items()
                  if _hasil_keputusan(data["file"][fid]["isMalware"], aksi) == "malware_opened")
    salah_hapus = sum(1 for fid, aksi in data["keputusan"].items()
                      if _hasil_keputusan(data["file"][fid]["isMalware"], aksi) == "false_alarm")
    return nilai(malware, salah_hapus, len(data["hint"]))[0]


def _catatan_riwayat(aksi, outcome):
    if outcome == "malware_opened":
        return "Dibuka", "Malware Terpicu (-15 Pts)"
    if outcome == "false_alarm":
        return "Hapus", "Salah Hapus File Aman (-5 Pts)"
    return ("Dibuka", "Tepat (File Aman)") if aksi == "open" else ("Hapus", "Tepat (Ancaman Dihapus)")


def _pembahasan_skenario(data, sken):
    """Ending + pembahasan 1 skenario. Ending buruk jika ada malware yang dibuka."""
    ada_insiden = any(
        _hasil_keputusan(bool(f.get("isMalware")), data["keputusan"].get(f["id"], "open")) == "malware_opened"
        for f in sken["files"]
    )
    return {
        "ending_type": "bad" if ada_insiden else "good",
        "ending": sken.get("badEnding" if ada_insiden else "goodEnding", ""),
        "lesson_title": sken.get("lessonTitle", ""),
        "lesson_body": sken.get("lessonBody", ""),
        "real_life_tip": sken.get("realLifeTip", ""),
    }


# ---------------------------------------------------------------------
# API layanan
# ---------------------------------------------------------------------
def mulai_sesi(username=""):
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
            # file_id -> data rahasia yang hanya diketahui server
            "file": {
                f["id"]: {
                    "scenario_id": s["id"],
                    "isMalware": bool(f.get("isMalware")),
                    "payloadStatus": f.get("payloadStatus", ""),
                    "realName": f.get("realName", f["id"]),
                }
                for s in skenario for f in s["files"]
            },
            "keputusan": {},      # file_id -> "open"/"delete"
            "urutan_keputusan": [],  # file_id sesuai urutan diputuskan (untuk riwayat)
            "impulsif": 0,        # keputusan tanpa memeriksa file lebih dulu
            "hint": set(),        # scenario_id yang hint-nya sudah dibuka
        }

    return {
        "session_id": sid,
        "current_score": 100,
        "scenarios": [scenario_mod.versi_publik(s) for s in skenario],
    }


def putuskan(sid, file_id, aksi, diperiksa=False):
    if aksi not in AKSI_VALID:
        raise SesiError("Aksi harus 'open' atau 'delete'.")
    file_id = str(file_id or "")
    with _kunci:
        data = _ambil(sid)
        info = data["file"].get(file_id)
        if info is None:
            raise SesiError("File tidak ada di sesi ini.", 404)
        if file_id in data["keputusan"]:
            raise SesiError("Keputusan untuk file ini sudah dikunci.", 409)
        data["keputusan"][file_id] = aksi
        data["urutan_keputusan"].append(file_id)
        if not diperiksa:
            data["impulsif"] += 1

        sken = data["skenario"][info["scenario_id"]]
        skenario_selesai = all(f["id"] in data["keputusan"] for f in sken["files"])
        skor = _skor_saat_ini(data)
        pembahasan = _pembahasan_skenario(data, sken) if skenario_selesai else None

    malware = info["isMalware"]
    hasil = {
        "file_id": file_id,
        "action": aksi,
        "correct": (aksi == "delete") == malware,
        "is_malware": malware,
        "outcome": _hasil_keputusan(malware, aksi),
        "payload_status": info["payloadStatus"],
        "current_score": skor,
        "scenario_done": skenario_selesai,
    }
    if pembahasan:
        hasil.update(pembahasan)
    return hasil


def minta_hint(sid, scenario_id):
    with _kunci:
        data = _ambil(sid)
        sken = data["skenario"].get(str(scenario_id or ""))
        if sken is None:
            raise SesiError("Skenario tidak ada di sesi ini.", 404)
        data["hint"].add(sken["id"])
        jumlah = len(data["hint"])
        skor = _skor_saat_ini(data)
    return {
        "scenario_id": sken["id"],
        "hint_author": sken.get("hintAuthor", ""),
        "hint_text": sken.get("hintText", ""),
        "hints_used": jumlah,
        "current_score": skor,
    }


def selesaikan(sid):
    """Menghitung skor akhir. Hasil disimpan sementara sampai pemain menyimpannya ke leaderboard."""
    sekarang = time.time()
    with _kunci:
        data = _ambil(sid)
        del _sesi[sid]

    malware_dibuka = salah_hapus = 0
    kesalahan = {k: 0 for k in JENIS_KESALAHAN}
    kesalahan["IMPULSIVE"] = data["impulsif"]
    ringkasan = []
    for scen_id in data["urutan"]:
        sken = data["skenario"][scen_id]
        salah = 0
        for f in sken["files"]:
            # File yang belum diputuskan dianggap "dibuka" (perilaku asal klik)
            outcome = _hasil_keputusan(bool(f.get("isMalware")), data["keputusan"].get(f["id"], "open"))
            if outcome == "malware_opened":
                malware_dibuka += 1
                salah += 1
            elif outcome == "false_alarm":
                salah_hapus += 1
                salah += 1
        if sken.get("type") in kesalahan:
            kesalahan[sken["type"]] += salah
        ringkasan.append({
            "scenario_id": scen_id,
            "type": sken.get("type", ""),
            "title": sken.get("title", ""),
            "mistakes": salah,
            **_pembahasan_skenario(data, sken),
        })

    riwayat = []
    for fid in data["urutan_keputusan"]:
        info = data["file"][fid]
        aksi = data["keputusan"][fid]
        outcome = _hasil_keputusan(info["isMalware"], aksi)
        label_aksi, catatan = _catatan_riwayat(aksi, outcome)
        riwayat.append({
            "file": info["realName"],
            "stage": data["urutan"].index(info["scenario_id"]) + 1,
            "userAction": label_aksi,
            "correct": outcome == "safe",
            "note": catatan,
        })

    skor, kategori = nilai(malware_dibuka, salah_hapus, len(data["hint"]))
    durasi = int(sekarang - data["mulai"])
    hasil = {
        "score": skor,
        "risk_category": kategori,
        "time": _format_waktu(durasi),
        "seconds": durasi,
        "malware_opened": malware_dibuka,
        "false_alarm": salah_hapus,
        "hints_used": len(data["hint"]),
        "mistakes": kesalahan,
        "history": riwayat,
        "scenarios": ringkasan,
    }
    with _kunci:
        _hasil[sid] = {
            "selesai": sekarang,
            "hasil": hasil,
            "nama": None,          # diisi saat disimpan ke leaderboard
            "feedback": False,     # feedback hanya boleh 1x per sesi
        }
    return hasil


def _ambil_hasil(sid):
    data = _hasil.get(str(sid or ""))
    if data is None:
        raise SesiError("Hasil simulasi tidak ditemukan atau sudah kedaluwarsa. Silakan main lagi.", 404)
    return data


def ambil_hasil(sid):
    """Hasil akhir untuk ditampilkan di result.html (sumbernya server, bukan localStorage)."""
    with _kunci:
        data = _ambil_hasil(sid)
        return {
            **data["hasil"],
            "saved": data["nama"] is not None,
            "masked_name": data["nama"],
            "feedback_sent": data["feedback"],
        }


def simpan_hasil(sid, username):
    """Menandai hasil sesi disimpan ke leaderboard (hanya 1x). Skor berasal dari server."""
    with _kunci:
        data = _ambil_hasil(sid)
        if data["nama"] is not None:
            raise SesiError("Skor sesi ini sudah disimpan ke leaderboard.", 409)
        data["nama"] = sensor_nama(username)
        skor = data["hasil"]["score"]
        return {
            "masked_name": data["nama"],
            "score": skor,
            "time": data["hasil"]["time"],
            "risk_category": kategori_risiko(skor),
        }


def ambil_data_feedback(sid):
    """Inisial & skor untuk feedback diambil dari sesi di server (hanya 1x per sesi)."""
    with _kunci:
        data = _ambil_hasil(sid)
        if data["feedback"]:
            raise SesiError("Masukan untuk sesi ini sudah dikirim.", 409)
        data["feedback"] = True
        return {
            "user": data["nama"] or sensor_nama(""),
            "score": data["hasil"]["score"],
        }


def batalkan_feedback(sid):
    """Dipanggil bila pesan feedback kosong/gagal disimpan agar pemain bisa mencoba lagi."""
    with _kunci:
        data = _hasil.get(str(sid or ""))
        if data is not None:
            data["feedback"] = False
