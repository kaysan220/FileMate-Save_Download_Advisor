# =====================================================================
# SANITASI INPUT — Pseudonimisasi nama, Anti-XSS & Anti-CSV Injection
# =====================================================================
import re

_KARAKTER_BERBAHAYA = re.compile(r'[<>"\'&=+\-@]')
_AWALAN_FORMULA = ("=", "+", "-", "@", "\t", "\r")
# Inisial yang SUDAH disensor (R****T / A****). result.js mengirim inisial
# bentuk ini ke /api/submit-feedback, jadi tidak boleh disensor dua kali.
_POLA_SUDAH_DISENSOR = re.compile(r"[^*]\*{4}[^*]?")


def sensor_nama(nama_input):
    """
    Membersihkan nama dari karakter berbahaya lalu menyensornya menjadi
    huruf awal & akhir saja (contoh: Rohit -> R****T).
    Edge-case: input kosong -> A****M (Anonim).
    Idempoten: inisial yang sudah tersensor (R****T, A****) dikembalikan apa adanya.
    """
    bersih = _KARAKTER_BERBAHAYA.sub("", str(nama_input or "")).strip()[:20]
    if not bersih:
        bersih = "Anonim"
    if _POLA_SUDAH_DISENSOR.fullmatch(bersih):
        return bersih.upper()
    if len(bersih) > 1:
        return f"{bersih[0].upper()}****{bersih[-1].upper()}"
    return f"{bersih.upper()}****"


def sanitasi_teks_csv(teks, max_len=300):
    """
    Membuang tag HTML (< >), memotong panjang teks, dan menambahkan tanda
    kutip di depan teks yang diawali karakter formula (CSV Injection).
    """
    bersih = re.sub(r"[<>]", "", str(teks or "")).strip()[:max_len]
    if bersih and bersih[0] in _AWALAN_FORMULA:
        bersih = "'" + bersih
    return bersih


def sanitasi_waktu(waktu_str):
    """Hanya menerima format mm:ss (contoh 01:45); selain itu -> 00:00."""
    teks = str(waktu_str or "").strip()
    return teks if re.fullmatch(r"\d{1,3}:[0-5]\d", teks) else "00:00"


def ke_int(nilai, default=0, minimum=None, maksimum=None):
    """Konversi aman ke int dengan batas bawah/atas opsional."""
    try:
        hasil = int(nilai)
    except (TypeError, ValueError):
        hasil = default
    if minimum is not None:
        hasil = max(minimum, hasil)
    if maksimum is not None:
        hasil = min(maksimum, hasil)
    return hasil
