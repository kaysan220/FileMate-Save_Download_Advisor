# =====================================================================
# TES SINKRONISASI BACKEND <-> FRONTEND
#
# Jalankan dari folder root proyek:
#     python -m unittest tests.test_sinkron_frontend -v
#
# Frontend saat ini (tampilan/js/) hanya memanggil 4 endpoint:
#     GET  /api/dashboard-stats   (common.js)
#     GET  /api/leaderboard       (leaderboard.js)
#     POST /api/submit-score      (result.js)  {username, score, time}
#     POST /api/submit-feedback   (result.js)  {user, score, message}
# Tes di bawah mengirim request PERSIS seperti frontend ke KEDUA server
# (app.py versi CSV dan backend/ versi SQLite) dan memastikan jawabannya sama.
# Data yang dipakai disalin ke folder sementara, jadi data asli tidak tersentuh.
# =====================================================================
import csv
import importlib.util
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from backend.app import create_app  # noqa: E402
from backend.app.common import kiriman  # noqa: E402
from backend.app.common.sanitize import sanitasi_teks_csv as sanitasi_backend  # noqa: E402
from backend.app.common.sanitize import sensor_nama as sensor_backend  # noqa: E402
from backend.app.scoring.calculator import nilai as nilai_backend  # noqa: E402
from core import algorithms as alg  # noqa: E402

SKENARIO_JSON = os.path.join(ROOT, "data", "skenario.json")
SCENARIO_DATA_JS = os.path.join(ROOT, "tampilan", "js", "scenario_data.js")
DUMMY_DIR = os.path.join(ROOT, "data", "dummy_files")


def _muat_server_csv():
    """Memuat app.py (root) dengan nama lain agar tidak bentrok dengan paket backend/app."""
    spec = importlib.util.spec_from_file_location("filemate_server_csv", os.path.join(ROOT, "app.py"))
    modul = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modul)
    return modul


SERVER_CSV = _muat_server_csv()


# ---------------------------------------------------------------------
# Kontrak yang harus dipenuhi KEDUA server (dipanggil oleh frontend)
# ---------------------------------------------------------------------
class _KontrakFrontend:
    def setUp(self):
        kiriman.reset_batas_kiriman()
        self.addCleanup(kiriman.reset_batas_kiriman)
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp, True)
        self.app = self.buat_app()
        self.client = self.app.test_client()

    # result.js: autoRecordAgentScore()
    def kirim_skor(self, username="Rohit", score=85, time="01:45"):
        return self.client.post("/api/submit-score",
                                json={"username": username, "score": score, "time": time})

    # result.js: submitUserFeedback()
    def kirim_feedback(self, user="R****T", score=85, message="Simulasinya membantu!"):
        return self.client.post("/api/submit-feedback",
                                json={"user": user, "score": score, "message": message})

    # ---------------- /api/submit-score ----------------
    def test_submit_score_seperti_result_js(self):
        r = self.kirim_skor()
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.get_json(), {"status": "ok", "data": {
            "masked_name": "R****T", "score": 85, "time": "01:45", "risk_category": "RENDAH"}})

    def test_kategori_risiko_dihitung_server(self):
        for skor, kategori in ((100, "RENDAH"), (85, "RENDAH"), (80, "SEDANG"), (55, "SEDANG"),
                               (50, "TINGGI"), (0, "TINGGI")):
            with self.subTest(skor=skor):
                kiriman.reset_batas_kiriman()
                r = self.kirim_skor(score=skor)
                self.assertEqual(r.status_code, 201)
                self.assertEqual(r.get_json()["data"]["risk_category"], kategori)

    def test_skor_tidak_valid_ditolak(self):
        for skor in (101, -5, 87, "85", 85.0, True, None):
            with self.subTest(skor=skor):
                r = self.kirim_skor(score=skor)
                self.assertEqual(r.status_code, 400)
                self.assertEqual(r.get_json(), {"status": "error", "message": "Skor tidak valid."})
        for waktu in ("", "1:2:3", "01:60", "abc", None):
            with self.subTest(waktu=waktu):
                self.assertEqual(self.kirim_skor(time=waktu).status_code, 400)
        self.assertEqual(self.client.get("/api/leaderboard").get_json(), [])

    def test_nama_disensor_dan_dibersihkan(self):
        self.kirim_skor(username="")
        self.kirim_skor(username="<script>alert(1)</script>")
        nama = sorted(x["name"] for x in self.client.get("/api/leaderboard").get_json())
        # "<script>alert(1)</script>" -> "scriptalert(1)/script" -> dipotong 20 huruf -> "...scrip"
        self.assertEqual(nama, ["A****M", "S****P"])

    def test_batas_kiriman_per_ip(self):
        with mock.patch.dict(self.app.config, {"SUBMIT_BATAS_PER_IP": 2}):
            self.assertEqual(self.kirim_skor().status_code, 201)
            self.assertEqual(self.kirim_skor().status_code, 201)
            r = self.kirim_skor()
            self.assertEqual(r.status_code, 429)
            self.assertEqual(r.get_json()["message"], "Terlalu banyak kiriman skor. Coba lagi nanti.")
            # batas skor & feedback dihitung terpisah
            self.assertEqual(self.kirim_feedback().status_code, 201)

    # ---------------- /api/leaderboard ----------------
    def test_leaderboard_sesuai_leaderboard_js(self):
        self.kirim_skor("Fardan", 90, "01:28")
        self.kirim_skor("Rohit", 90, "01:12")
        self.kirim_skor("Yazid", 45, "02:05")
        lb = self.client.get("/api/leaderboard").get_json()
        self.assertIsInstance(lb, list)   # leaderboard.js memakai Array.isArray()
        self.assertEqual([x["name"] for x in lb], ["R****T", "F****N", "Y****D"])
        for baris in lb:
            self.assertEqual(set(baris), {"name", "score", "time", "risk"})
        self.assertEqual(lb[2], {"name": "Y****D", "score": 45, "time": "02:05", "risk": "TINGGI"})

    def test_leaderboard_maksimal_6_dan_limit(self):
        for i in range(8):
            kiriman.reset_batas_kiriman()
            self.kirim_skor(f"Agen{i}", 100 - i * 5, "01:00")
        self.assertEqual(len(self.client.get("/api/leaderboard").get_json()), 6)
        self.assertEqual(len(self.client.get("/api/leaderboard?limit=3").get_json()), 3)
        self.assertEqual(len(self.client.get("/api/leaderboard?limit=abc").get_json()), 6)

    # ---------------- /api/submit-feedback ----------------
    def test_submit_feedback_seperti_result_js(self):
        r = self.kirim_feedback()
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.get_json(), {"status": "ok", "data": {"saved": True, "kode_responden": "P01"}})
        self.assertEqual(self.kirim_feedback(user="A****").get_json()["data"]["kode_responden"], "P02")
        tersimpan = self.baca_feedback()
        self.assertEqual([f["inisial"] for f in tersimpan], ["R****T", "A****"])  # tidak disensor 2x

    def test_feedback_disanitasi(self):
        self.kirim_feedback(message='=HYPERLINK("http://jahat") <b>tebal</b>')
        self.assertEqual(self.baca_feedback()[0]["pesan"], '\'=HYPERLINK("http://jahat") btebal/b')

    def test_feedback_tidak_valid_ditolak(self):
        for body in ({"user": "R****T", "score": 85, "message": "  <> "},
                     {"user": "R****T", "score": 85},
                     {"user": "R****T", "score": 999, "message": "ok"}):
            with self.subTest(body=body):
                self.assertEqual(self.client.post("/api/submit-feedback", json=body).status_code, 400)
        self.assertEqual(self.baca_feedback(), [])

    # ---------------- /api/dashboard-stats ----------------
    def test_dashboard_stats_sesuai_common_js(self):
        self.kirim_skor(score=90)
        self.kirim_skor(score=45)
        st = self.client.get("/api/dashboard-stats").get_json()
        # field yang dibaca tampilkanStatistik() di common.js
        self.assertEqual(
            {k: st[k] for k in ("total_skenario", "total_file", "total_malware", "total_aman",
                                "total_sesi", "rata_rata_skor")},
            {"total_skenario": 4, "total_file": 19, "total_malware": 9, "total_aman": 10,
             "total_sesi": 2, "rata_rata_skor": 68},
        )
        self.assertEqual(st["sebaran_risiko"], {"RENDAH": 1, "SEDANG": 0, "TINGGI": 1})


class TesServerCSV(_KontrakFrontend, unittest.TestCase):
    """app.py (root) — data/hasil.csv & data/feedback_user.csv."""

    def buat_app(self):
        self.hasil_csv = os.path.join(self.tmp, "hasil.csv")
        self.feedback_csv = os.path.join(self.tmp, "feedback_user.csv")
        for nama, nilai in (("HASIL_CSV_PATH", self.hasil_csv), ("FEEDBACK_CSV_PATH", self.feedback_csv)):
            p = mock.patch.object(alg, nama, nilai)
            p.start()
            self.addCleanup(p.stop)
        return SERVER_CSV.app

    def baca_feedback(self):
        if not os.path.exists(self.feedback_csv):
            return []
        with open(self.feedback_csv, encoding="utf-8", newline="") as f:
            return [{"inisial": r["inisial_anonim"], "pesan": r["saran_dan_masukan"]} for r in csv.DictReader(f)]


class TesServerSQLite(_KontrakFrontend, unittest.TestCase):
    """backend/ — data/filemate.db (tabel scores & feedback)."""

    def buat_app(self):
        self.db = os.path.join(self.tmp, "test.db")
        return create_app({"TESTING": True, "DB_PATH": self.db,
                           "LEGACY_HASIL_CSV": "", "LEGACY_FEEDBACK_CSV": ""})

    def baca_feedback(self):
        with sqlite3.connect(self.db) as conn:
            return [{"inisial": i, "pesan": p}
                    for i, p in conn.execute("SELECT inisial_anonim, pesan FROM feedback ORDER BY id")]


# ---------------------------------------------------------------------
# core/algorithms.py (app.py) == backend/app (logika yang sama)
# ---------------------------------------------------------------------
class TesLogikaCoreSamaDenganBackend(unittest.TestCase):
    def test_nilai_dan_kategori(self):
        for args in ((0, 0, 0), (1, 1, 1), (2, 0, 3), (7, 0, 0), (0, 4, 0), (3, 2, 1)):
            with self.subTest(args=args):
                self.assertEqual(alg.nilai(*args), nilai_backend(*args))

    def test_sensor_nama(self):
        for nama in ("Rohit", "", None, "A", "a", "  budi  ", "<b>x</b>", "R****T", "A****",
                     "=cmd|calc", "Muhammad Fardan Super Panjang", "-Budi"):
            with self.subTest(nama=nama):
                self.assertEqual(alg.sensor_nama(nama), sensor_backend(nama))

    def test_sensor_nama_idempoten(self):
        for nama in ("Rohit", "A", "", "Yazid"):
            sekali = alg.sensor_nama(nama)
            self.assertEqual(alg.sensor_nama(sekali), sekali)

    def test_sanitasi_csv(self):
        for teks in ("=1+1", "+x", "-x", "@x", "<script>", "biasa", "x" * 400, "", None):
            with self.subTest(teks=str(teks)[:10]):
                self.assertEqual(alg.sanitasi_teks_csv(teks), sanitasi_backend(teks))


# ---------------------------------------------------------------------
# Data server == data frontend
# ---------------------------------------------------------------------
class TesDataSinkron(unittest.TestCase):
    def setUp(self):
        with open(SKENARIO_JSON, encoding="utf-8") as f:
            self.bank = json.load(f)

    @unittest.skipUnless(shutil.which("node"), "Butuh Node.js untuk membaca scenario_data.js")
    def test_skenario_json_sama_dengan_scenario_bank_frontend(self):
        # game.js masih memakai SCENARIO_BANK di browser; skor yang dikirim ke
        # server & statistik dashboard hanya benar jika kedua bank soal identik.
        skrip = ("const fs=require('fs');"
                 "const s=fs.readFileSync(process.argv[1],'utf8');"
                 "process.stdout.write(JSON.stringify(new Function(s+'\\n;return SCENARIO_BANK;')()));")
        hasil = subprocess.run(["node", "-e", skrip, SCENARIO_DATA_JS], capture_output=True,
                               text=True, encoding="utf-8", timeout=30, check=True)
        self.assertEqual(json.loads(hasil.stdout), self.bank,
                         "data/skenario.json berbeda dengan SCENARIO_BANK di tampilan/js/scenario_data.js")

    def test_semua_file_skenario_ada_di_dummy_files(self):
        nama = [f["realName"] for daftar in self.bank.values() for s in daftar for f in s["files"]]
        hilang = [n for n in nama if not os.path.isfile(os.path.join(DUMMY_DIR, n))]
        self.assertEqual(hilang, [], "Jalankan: python data/buat_dummy.py")

    def test_id_unik(self):
        id_skenario = [s["id"] for daftar in self.bank.values() for s in daftar]
        id_file = [f["id"] for daftar in self.bank.values() for s in daftar for f in s["files"]]
        self.assertEqual(len(id_skenario), len(set(id_skenario)))
        self.assertEqual(len(id_file), len(set(id_file)))

    def test_isi_dummy_sesuai_buat_dummy(self):
        spec = importlib.util.spec_from_file_location("buat_dummy", os.path.join(ROOT, "data", "buat_dummy.py"))
        modul = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(modul)
        for daftar in self.bank.values():
            for s in daftar:
                for f in s["files"]:
                    with self.subTest(file=f["realName"]):
                        with open(os.path.join(DUMMY_DIR, f["realName"]), "rb") as isi:
                            self.assertEqual(isi.read(), modul.generate_safe_dummy_bytes(f))


if __name__ == "__main__":
    unittest.main(verbosity=2)
