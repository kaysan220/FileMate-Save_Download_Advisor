# =====================================================================
# REPOSITORY FEEDBACK — semua query SQL tabel `feedback`
# =====================================================================
from ..db import get_db


def simpan_feedback(inisial, skor, pesan):
    db = get_db()
    cur = db.execute(
        "INSERT INTO feedback (inisial_anonim, skor, pesan) VALUES (?, ?, ?)",
        (inisial, int(skor), pesan),
    )
    db.commit()
    return f"P{cur.lastrowid:02d}"


def semua_feedback(limit=None):
    sql = "SELECT id, inisial_anonim, skor, pesan, created_at FROM feedback ORDER BY id DESC"
    params = ()
    if limit:
        sql += " LIMIT ?"
        params = (int(limit),)
    return get_db().execute(sql, params).fetchall()


def ke_dict(row):
    return {
        "kode_responden": f"P{row['id']:02d}",
        "inisial_anonim": row["inisial_anonim"],
        "skor": row["skor"],
        "waktu_input": row["created_at"],
        "pesan": row["pesan"],
    }
