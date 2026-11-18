# =====================================================================
# TES KEAMANAN core/linux_utils.py
#
# Jalankan dari folder root proyek:
#     python -m unittest tests.test_linux_utils -v
#
# Bagian "jalur Linux" disimulasikan dengan mock, jadi bisa dites di
# Windows juga. Kalau dijalankan di Linux asli, kelas TesLinuxAsli
# ikut menjalankan sha256sum / file / ls yang sungguhan.
# =====================================================================
import hashlib
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core import linux_utils as lu  # noqa: E402

HASH_CONTOH = "a" * 64


class _DenganFolderDummy(unittest.TestCase):
    """Bikin folder dummy sementara supaya tes tidak bergantung data asli."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.dummy = os.path.join(self.tmp, "dummy_files")
        os.mkdir(self.dummy)
        with open(os.path.join(self.dummy, "aman.txt"), "wb") as f:
            f.write(b"halo")
        # File RAHASIA di luar dummy_files — tidak boleh bisa diakses.
        with open(os.path.join(self.tmp, "rahasia.txt"), "wb") as f:
            f.write(b"password")
        p = mock.patch.object(lu, "DUMMY_DIR", self.dummy)
        p.start()
        self.addCleanup(p.stop)
        self.addCleanup(shutil.rmtree, self.tmp, True)


# ---------------------------------------------------------------------
# Prinsip 1 & 2: nama berbahaya DITOLAK, path tidak boleh keluar folder
# ---------------------------------------------------------------------
class TesValidasiNama(_DenganFolderDummy):
    NAMA_BERBAHAYA = [
        "",
        ".",
        "..",
        "../rahasia.txt",
        "..\\rahasia.txt",
        "sub/aman.txt",
        "/etc/passwd",
        "C:\\Windows\\win.ini",
        "aman.txt\x00.jpg",
        "a" * 256,
    ]

    def test_nama_berbahaya_ditolak(self):
        for nama in self.NAMA_BERBAHAYA:
            with self.subTest(nama=nama[:30]):
                with self.assertRaises(ValueError):
                    lu.validasi_path_aman(nama)

    def test_bukan_string_ditolak(self):
        for nilai in (None, 123, b"aman.txt", ["aman.txt"]):
            with self.subTest(nilai=nilai):
                with self.assertRaises(ValueError):
                    lu.validasi_path_aman(nilai)

    def test_penolakan_dicatat_di_log(self):
        with self.assertLogs("filemate.linux_utils", level="WARNING"):
            with self.assertRaises(ValueError):
                lu.validasi_path_aman("../rahasia.txt")

    def test_nama_valid_tapi_tidak_ada(self):
        with self.assertRaises(FileNotFoundError):
            lu.validasi_path_aman("tidak_ada.txt")

    def test_karakter_shell_tidak_berbahaya(self):
        # Tidak ada shell, jadi ini hanya nama file biasa yang tidak ada.
        for nama in ("a;ls", "$(whoami)", "x|cat", "`id`", "-rf"):
            with self.subTest(nama=nama):
                with self.assertRaises(FileNotFoundError):
                    lu.validasi_path_aman(nama)

    def test_nama_valid_diterima(self):
        full, nama = lu.validasi_path_aman("aman.txt")
        self.assertEqual(nama, "aman.txt")
        self.assertEqual(full, os.path.realpath(os.path.join(self.dummy, "aman.txt")))

    def test_symlink_keluar_folder_ditolak(self):
        link = os.path.join(self.dummy, "jebakan.txt")
        try:
            os.symlink(os.path.join(self.tmp, "rahasia.txt"), link)
        except (OSError, NotImplementedError):
            self.skipTest("Tidak bisa membuat symlink di OS/akun ini")
        with self.assertRaises(ValueError):
            lu.validasi_path_aman("jebakan.txt")


# ---------------------------------------------------------------------
# Prinsip 3: subprocess tanpa shell + "--"  (jalur Linux, disimulasikan)
# ---------------------------------------------------------------------
class TesJalurLinuxMock(_DenganFolderDummy):
    def setUp(self):
        super().setUp()
        for target, nilai in (
            ("_is_linux", mock.Mock(return_value=True)),
            ("shutil.which", mock.Mock(return_value="/usr/bin/x")),
        ):
            p = mock.patch.object(lu, target, nilai) if "." not in target \
                else mock.patch(f"core.linux_utils.{target}", nilai)
            p.start()
            self.addCleanup(p.stop)

    def _palsukan_run(self, stdout):
        return mock.patch(
            "core.linux_utils.subprocess.run",
            return_value=subprocess.CompletedProcess([], 0, stdout=stdout, stderr=""),
        )

    def test_sha256sum_dipanggil_aman(self):
        with self._palsukan_run(f"{HASH_CONTOH}  /x/aman.txt\n") as run:
            hasil = lu.jalankan_sha256sum_linux("aman.txt")
        args, kwargs = run.call_args
        perintah = args[0]
        self.assertIsInstance(perintah, list)          # list, bukan string
        self.assertEqual(perintah[0], "sha256sum")
        self.assertEqual(perintah[1], "--")            # tutup argument injection
        self.assertFalse(kwargs.get("shell", False))   # tanpa shell
        self.assertEqual(kwargs.get("timeout"), lu.TIMEOUT_DETIK)
        self.assertEqual(hasil["sha256"], HASH_CONTOH)
        self.assertIn("Linux CLI", hasil["engine"])

    def test_inspeksi_dipanggil_aman(self):
        keluaran = iter(["application/x-dosexec", "-rwxr-xr-x. 1 u g 4 Jan 1 aman.txt"])

        def palsu(perintah, **kw):
            self.assertFalse(kw.get("shell", False))
            self.assertIn("--", perintah)
            return subprocess.CompletedProcess(perintah, 0, stdout=next(keluaran), stderr="")

        with mock.patch("core.linux_utils.subprocess.run", side_effect=palsu):
            hasil = lu.jalankan_inspeksi_linux("aman.txt")
        self.assertEqual(hasil["mime_linux"], "application/x-dosexec")
        self.assertEqual(hasil["permission_linux"], "-rwxr-xr-x")  # "." dibuang
        self.assertTrue(hasil["bisa_dieksekusi"])

    # -------- Prinsip 4: GAGAL ITU JUJUR (tidak ada data palsu) --------
    def test_perintah_tidak_ada(self):
        with mock.patch("core.linux_utils.shutil.which", return_value=None):
            with self.assertRaises(lu.UtilitasLinuxError):
                lu.jalankan_sha256sum_linux("aman.txt")

    def test_timeout(self):
        err = subprocess.TimeoutExpired("sha256sum", lu.TIMEOUT_DETIK)
        with mock.patch("core.linux_utils.subprocess.run", side_effect=err):
            with self.assertRaises(lu.UtilitasLinuxError):
                lu.jalankan_sha256sum_linux("aman.txt")

    def test_exit_code_gagal(self):
        err = subprocess.CalledProcessError(1, "sha256sum", stderr="boom")
        with mock.patch("core.linux_utils.subprocess.run", side_effect=err):
            with self.assertRaises(lu.UtilitasLinuxError):
                lu.jalankan_sha256sum_linux("aman.txt")

    def test_keluaran_aneh_ditolak(self):
        for stdout in ("", "bukan-hash  file", "Z" * 64 + "  f"):
            with self.subTest(stdout=stdout[:20]):
                with self._palsukan_run(stdout):
                    with self.assertRaises(lu.UtilitasLinuxError):
                        lu.jalankan_sha256sum_linux("aman.txt")

    def test_pesan_error_tidak_bocorkan_detail(self):
        err = subprocess.CalledProcessError(1, "sha256sum", stderr="/home/server/rahasia")
        with mock.patch("core.linux_utils.subprocess.run", side_effect=err):
            with self.assertRaises(lu.UtilitasLinuxError) as ctx:
                lu.jalankan_sha256sum_linux("aman.txt")
        self.assertNotIn("/home/server", str(ctx.exception))


# ---------------------------------------------------------------------
# Prinsip 5: fallback NON-Linux diberi label & MIME tidak dikarang
# ---------------------------------------------------------------------
class TesFallbackNonLinux(_DenganFolderDummy):
    def setUp(self):
        super().setUp()
        p = mock.patch.object(lu, "_is_linux", return_value=False)
        p.start()
        self.addCleanup(p.stop)

    def test_hash_fallback_benar_dan_dilabeli(self):
        hasil = lu.jalankan_sha256sum_linux("aman.txt")
        self.assertEqual(hasil["sha256"], hashlib.sha256(b"halo").hexdigest())
        self.assertIn("fallback", hasil["engine"])

    def test_mime_fallback_none(self):
        hasil = lu.jalankan_inspeksi_linux("aman.txt")
        self.assertIsNone(hasil["mime_linux"])
        self.assertIn("fallback", hasil["engine"])


# ---------------------------------------------------------------------
# Tes dengan perintah Linux SUNGGUHAN (otomatis di-skip di Windows)
# ---------------------------------------------------------------------
@unittest.skipUnless(sys.platform.startswith("linux"), "Hanya di Linux")
class TesLinuxAsli(_DenganFolderDummy):
    def test_sha256sum_asli(self):
        hasil = lu.jalankan_sha256sum_linux("aman.txt")
        self.assertEqual(hasil["sha256"], hashlib.sha256(b"halo").hexdigest())
        self.assertIn("Linux CLI", hasil["engine"])

    def test_file_dan_ls_asli(self):
        hasil = lu.jalankan_inspeksi_linux("aman.txt")
        self.assertEqual(hasil["mime_linux"], "text/plain")
        self.assertRegex(hasil["permission_linux"], r"^-[rwx-]{9}$")


if __name__ == "__main__":
    unittest.main(verbosity=2)
