# =====================================================================
# KALKULATOR SKOR & KATEGORI RISIKO — Tugas Kaysan Nawfal
#   Skor awal 100, penalti:
#     - membuka file berbahaya (malware) : -15
#     - menghapus file aman (false alarm): -5
#     - memakai hint                     : -5
#   Kategori: <=50 TINGGI | 51-80 SEDANG | >80 RENDAH
# =====================================================================
from ..common.sanitize import ke_int

SKOR_AWAL = 100
PENALTI_MALWARE = 15
PENALTI_FALSE_ALARM = 5
PENALTI_HINT = 5

KATEGORI_VALID = ("RENDAH", "SEDANG", "TINGGI")


def kategori_risiko(skor):
    skor = ke_int(skor, default=0)
    if skor <= 50:
        return "TINGGI"
    if skor <= 80:
        return "SEDANG"
    return "RENDAH"


def nilai(jumlah_malware_dibuka, jumlah_salah_hapus, jumlah_hint):
    """Mengembalikan (skor_akhir, kategori). Skor tidak pernah < 0."""
    penalti = (
        ke_int(jumlah_malware_dibuka, minimum=0) * PENALTI_MALWARE
        + ke_int(jumlah_salah_hapus, minimum=0) * PENALTI_FALSE_ALARM
        + ke_int(jumlah_hint, minimum=0) * PENALTI_HINT
    )
    skor_akhir = max(0, SKOR_AWAL - penalti)
    return skor_akhir, kategori_risiko(skor_akhir)
