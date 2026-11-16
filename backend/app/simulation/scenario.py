# =====================================================================
# BANK SKENARIO — Tugas Rohit Al Bukhori
#   - muat_bank()        : membaca skenario.json
#   - pilih_skenario()   : 1 soal acak per kategori, urutan soal & file diacak
#   - versi_publik()     : versi skenario untuk browser (TANPA kunci jawaban)
#   - ringkasan_bank()   : statistik jumlah skenario/file/malware per kategori
# =====================================================================
import copy
import json
import random

from flask import current_app

KATEGORI = ("SPOOFING", "HASH", "FATIGUE")

# Field yang hanya boleh diketahui server (kunci jawaban, hint berbayar,
# ending & pembahasan). payloadStatus ikut disembunyikan karena isinya
# langsung menyebut "Trojan..." / "Bersih". Semua dikirim lewat /decide & /hint.
FIELD_RAHASIA_FILE = ("isMalware", "payloadStatus")
FIELD_RAHASIA_SKENARIO = ("hintText", "goodEnding", "badEnding", "lessonTitle", "lessonBody", "realLifeTip")


def muat_bank():
    with open(current_app.config["SKENARIO_PATH"], "r", encoding="utf-8") as f:
        return json.load(f)


def pilih_skenario():
    """Mengembalikan list 3 skenario (deep copy) yang sudah diacak."""
    bank = muat_bank()
    terpilih = [copy.deepcopy(random.choice(bank[k])) for k in KATEGORI if bank.get(k)]
    random.shuffle(terpilih)
    for sken in terpilih:
        random.shuffle(sken["files"])
    return terpilih


def versi_publik(sken):
    """Menghapus kunci jawaban agar tidak bisa dicontek lewat DevTools."""
    publik = {k: v for k, v in sken.items() if k not in FIELD_RAHASIA_SKENARIO}
    publik["files"] = [
        {k: v for k, v in f.items() if k not in FIELD_RAHASIA_FILE}
        for f in sken.get("files", [])
    ]
    return publik


def ringkasan_bank():
    kategori = {}
    total = {"skenario": 0, "file": 0, "malware": 0}
    try:
        bank = muat_bank()
    except (OSError, ValueError):
        bank = {}
    for nama_kat, daftar in bank.items():
        jml_file = sum(len(s.get("files", [])) for s in daftar)
        jml_malware = sum(1 for s in daftar for fl in s.get("files", []) if fl.get("isMalware"))
        kategori[nama_kat] = {"skenario": len(daftar), "file": jml_file, "malware": jml_malware}
        total["skenario"] += len(daftar)
        total["file"] += jml_file
        total["malware"] += jml_malware
    return kategori, total
