# =====================================================================
# KONEKSI DATABASE SQLITE
#   - get_db()   : satu koneksi per request (disimpan di flask.g)
#   - init_db()  : membuat tabel bila belum ada + impor CSV lama sekali saja
# =====================================================================
import csv
import os
import sqlite3

from flask import current_app, g

# Skema bawaan — dipakai bila database/schema.sql belum dibuat
SKEMA_BAWAAN = """
CREATE TABLE IF NOT EXISTS scores (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    nama_anonim      TEXT    NOT NULL,
    skor             INTEGER NOT NULL CHECK (skor BETWEEN 0 AND 100),
    waktu            TEXT    NOT NULL,
    kategori_risiko  TEXT    NOT NULL CHECK (kategori_risiko IN ('RENDAH','SEDANG','TINGGI')),
    created_at       TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS feedback (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    inisial_anonim   TEXT    NOT NULL,
    skor             INTEGER NOT NULL,
    pesan            TEXT    NOT NULL,
    created_at       TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_scores_skor ON scores (skor DESC, waktu ASC);
"""


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(current_app.config["DB_PATH"])
        g.db.row_factory = sqlite3.Row
    return g.db


def close_db(_exc=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def _baca_skema(path):
    if os.path.isfile(path):
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    return SKEMA_BAWAAN


def _impor_csv_lama(conn, cfg):
    """Memindahkan isi hasil.csv & feedback_user.csv lama ke SQLite (hanya jika tabel kosong)."""
    if conn.execute("SELECT COUNT(*) FROM scores").fetchone()[0] == 0 and os.path.isfile(cfg["LEGACY_HASIL_CSV"]):
        with open(cfg["LEGACY_HASIL_CSV"], "r", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                try:
                    conn.execute(
                        "INSERT INTO scores (nama_anonim, skor, waktu, kategori_risiko) VALUES (?, ?, ?, ?)",
                        (r["nama_anonim"], int(r["skor"]), r["waktu"], r["kategori_risiko"]),
                    )
                except (KeyError, ValueError, sqlite3.IntegrityError):
                    continue

    if conn.execute("SELECT COUNT(*) FROM feedback").fetchone()[0] == 0 and os.path.isfile(cfg["LEGACY_FEEDBACK_CSV"]):
        with open(cfg["LEGACY_FEEDBACK_CSV"], "r", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                try:
                    conn.execute(
                        "INSERT INTO feedback (inisial_anonim, skor, pesan) VALUES (?, ?, ?)",
                        (r["inisial_anonim"], int(r["skor"]), r["saran_dan_masukan"]),
                    )
                except (KeyError, ValueError, sqlite3.IntegrityError):
                    continue


def init_db(app):
    """Dipanggil sekali dari create_app()."""
    cfg = app.config
    os.makedirs(os.path.dirname(cfg["DB_PATH"]), exist_ok=True)
    with sqlite3.connect(cfg["DB_PATH"]) as conn:
        conn.executescript(_baca_skema(cfg["SCHEMA_PATH"]))
        _impor_csv_lama(conn, cfg)
    app.teardown_appcontext(close_db)
