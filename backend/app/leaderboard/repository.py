# =====================================================================
# REPOSITORY SKOR — semua query SQL tabel `scores`
# Selalu memakai parameter (?) -> aman dari SQL Injection.
# =====================================================================
from ..db import get_db
from ..scoring.calculator import KATEGORI_VALID


def simpan_skor(nama_anonim, skor, waktu, kategori):
    kategori = kategori if kategori in KATEGORI_VALID else "TINGGI"
    db = get_db()
    db.execute(
        "INSERT INTO scores (nama_anonim, skor, waktu, kategori_risiko) VALUES (?, ?, ?, ?)",
        (nama_anonim, max(0, min(100, int(skor))), waktu, kategori),
    )
    db.commit()


def top_skor(limit=6):
    rows = get_db().execute(
        "SELECT nama_anonim, skor, waktu, kategori_risiko FROM scores "
        "ORDER BY skor DESC, waktu ASC, id ASC LIMIT ?",
        (max(1, min(100, int(limit))),),
    ).fetchall()
    return [
        {"name": r["nama_anonim"], "score": r["skor"], "time": r["waktu"], "risk": r["kategori_risiko"]}
        for r in rows
    ]


def statistik_skor():
    db = get_db()
    total, rata = db.execute("SELECT COUNT(*), AVG(skor) FROM scores").fetchone()
    sebaran = {k: 0 for k in ("RENDAH", "SEDANG", "TINGGI")}
    for r in db.execute("SELECT kategori_risiko, COUNT(*) AS n FROM scores GROUP BY kategori_risiko"):
        if r["kategori_risiko"] in sebaran:
            sebaran[r["kategori_risiko"]] = r["n"]
    return {"total_sesi": total, "rata_rata_skor": round(rata) if rata is not None else 0, "sebaran_risiko": sebaran}


def semua_skor():
    return get_db().execute(
        "SELECT id, nama_anonim, skor, waktu, kategori_risiko, created_at FROM scores ORDER BY id"
    ).fetchall()
