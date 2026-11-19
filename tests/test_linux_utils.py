# =====================================================================
# TES FUNGSIONAL & SECURITY UNTUK linux_utils.py (Tugas Yazid)
#
# Jalankan dari folder utama proyek (yang berisi folder core/ dan tests/):
#     python3 -m unittest -v tests.test_linux_utils
# atau jika file ditaruh sejajar dalam satu folder:
#     python3 -m unittest -v test_linux_utils.py
#
# Semua tes memakai folder sementara (TemporaryDirectory), jadi TIDAK
# menyentuh data/dummy_files asli.
# Tes yang butuh perintah asli Linux otomatis di-SKIP di Windows.
# Bukti pengujian untuk dosen WAJIB diambil dari Linux (0 skipped).
# =====================================================================
import hashlib
import os
import shutil
import stat
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

_DIR_TEST = os.path.dirname(os.path.abspath(__file__))
_DIR_PROYEK = os.path.dirname(_DIR_TEST)
if os.path.isfile(os.path.join(_DIR_PROYEK, "core", "linux_utils.py")):
    sys.path.insert(0, _DIR_PROYEK)
    from core import linux_utils as lu
else:
    # Struktur datar: pastikan mengimpor linux_utils.py di folder yang sama,
    # bukan file lama yang kebetulan ada di folder induk (mis. ~/Downloads/).
    sys.path.insert(0, _DIR_TEST)
    import linux_utils as lu

ADA_LINUX = sys.platform.startswith("linux")
ADA_CLI_LINUX = (
    ADA_LINUX
    and shutil.which("file") is not None
    and shutil.which("sha256sum") is not None
    and shutil.which("ls") is not None
    and shutil.which("stat") is not None
)
butuh_linux = unittest.skipUnless(
    ADA_CLI_LINUX, "butuh Linux + perintah file, sha256sum, ls, & stat"
)

JPEG_ASLI = (
    b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    b"\xff\xdb\x00\x43\x00" + b"\x08" * 64 + b"\xff\xd9"
)
PDF_ASLI = b"%PDF-1.7\n%Simulasi Dokumen PDF Aman FileMate\n"
PE_DUMMY = (
    b"MZ\x90\x00Simulasi Header PEExecutable Dummy FileMate "
    b"(Bukan Malware Asli) - Foto_Lokasi_Gedung.jpg"
)


class DasarTes(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = os.path.join(self._tmp.name, "dummy_files")
        os.makedirs(self.root)
        self.luar = os.path.join(self._tmp.name, "rahasia.txt")
        self._tulis(self.luar, b"INI DATA DI LUAR dummy_files", 0o644)

        self._tulis("aman.txt", b"Dokumen aman\n", 0o644)
        self._tulis("skrip.sh", b"#!/bin/sh\necho hi\n", 0o755)
        self._tulis("gambar.jpg", JPEG_ASLI, 0o644)
        self._tulis("dokumen.pdf", PDF_ASLI, 0o644)
        self._tulis("evil; touch PWNED.txt", b"isi biasa", 0o644)
        self._tulis("$(touch PWNED2.txt)", b"isi subshell", 0o644)
        self._tulis("`touch PWNED3.txt`", b"isi backtick", 0o644)
        self._tulis("-n", b"nama berawalan minus", 0o644)
        self._tulis("--help", b"nama seperti flag", 0o644)

        p = mock.patch.object(lu, "DUMMY_DIR", self.root)
        p.start()
        self.addCleanup(p.stop)

    def _tulis(self, nama, isi, mode):
        path = nama if os.path.isabs(nama) else os.path.join(self.root, nama)
        with open(path, "wb") as f:
            f.write(isi)
        os.chmod(path, mode)
        return path


# =====================================================================
# 1. TES VALIDASI PATH & INPUT
# =====================================================================
class TestValidasiPath(DasarTes):
    def test_input_berbahaya_ditolak(self):
        berbahaya = [
            "../../etc/passwd",
            "..",
            ".",
            "",
            "a/b.txt",
            "/etc/passwd",
            "..\\..\\windows\\system32",
            "aman.txt\x00.jpg",
            "../rahasia.txt",
            "x" * 256,
            "é" * 130,  # > 255 byte dalam UTF-8 (260 byte)
        ]
        for nama in berbahaya:
            with self.subTest(nama=repr(nama[:30])):
                with self.assertRaises(ValueError):
                    lu.validasi_path_aman(nama)

    def test_karakter_kontrol_dan_bidi_ditolak(self):
        """Tolak newline/CR/tab/ESC (anti log-forging) & Unicode RLO (anti spoofing)."""
        berbahaya = [
            "aman.txt\nFAKE LOG",
            "aman.txt\r\nFAKE",
            "aman\t.txt",
            "aman\x1b[31m.txt",
            "aman\x7f.txt",
            "undangan_\u202efdp.exe",  # Right-to-Left Override (RLO)
            "file\u2066test.txt",
        ]
        for nama in berbahaya:
            with self.subTest(nama=repr(nama)):
                with self.assertRaises(ValueError):
                    lu.validasi_path_aman(nama)

    def test_bukan_string_ditolak(self):
        for nilai in (None, 123, 3.14, b"aman.txt", ["aman.txt"], {"file": "aman.txt"}):
            with self.subTest(nilai=repr(nilai)):
                with self.assertRaises(ValueError):
                    lu.validasi_path_aman(nilai)

    def test_file_tidak_ada(self):
        with self.assertRaises(FileNotFoundError):
            lu.validasi_path_aman("tidak_ada.txt")

    def test_file_valid_diterima(self):
        path, nama = lu.validasi_path_aman("aman.txt")
        self.assertEqual(nama, "aman.txt")
        self.assertEqual(path, os.path.realpath(os.path.join(self.root, "aman.txt")))


# =====================================================================
# 2. TES KEAMANAN FILESYSTEM (SYMLINK, SPECIAL FILE, ANTI-DOS)
# =====================================================================
class TestKeamananFilesystem(DasarTes):
    def test_symlink_keluar_folder_ditolak(self):
        try:
            os.symlink(self.luar, os.path.join(self.root, "tautan_luar.txt"))
        except (OSError, NotImplementedError):
            self.skipTest("OS tidak mengizinkan symlink")
        with self.assertRaises(ValueError):
            lu.validasi_path_aman("tautan_luar.txt")

    def test_symlink_internal_juga_ditolak(self):
        """Symlink di dalam dummy_files pun ditolak untuk mencegah indirection."""
        try:
            os.symlink(
                os.path.join(self.root, "aman.txt"),
                os.path.join(self.root, "tautan_dalam.txt"),
            )
        except (OSError, NotImplementedError):
            self.skipTest("OS tidak mengizinkan symlink")
        with self.assertRaises(ValueError):
            lu.validasi_path_aman("tautan_dalam.txt")

    def test_direktori_ditolak(self):
        os.makedirs(os.path.join(self.root, "subfolder"))
        with self.assertRaises(ValueError):
            lu.validasi_path_aman("subfolder")

    @unittest.skipUnless(hasattr(os, "mkfifo"), "butuh OS POSIX dengan mkfifo")
    def test_fifo_named_pipe_ditolak(self):
        """FIFO bisa membuat sha256sum/file hang selamanya (DoS); wajib ditolak."""
        fifo_path = os.path.join(self.root, "pipa_jebakan")
        os.mkfifo(fifo_path)
        with self.assertRaises(ValueError):
            lu.validasi_path_aman("pipa_jebakan")

    def test_file_melebihi_batas_ukuran_ditolak(self):
        """Anti-DoS: file melebihi MAX_FILE_SIZE_BYTES wajib ditolak."""
        with mock.patch.object(lu, "MAX_FILE_SIZE_BYTES", 5):
            with self.assertRaises(lu.UtilitasLinuxError):
                lu.validasi_path_aman("aman.txt")

    def test_daftar_file_dummy_abaikan_symlink_dan_direktori(self):
        os.makedirs(os.path.join(self.root, "folder_x"))
        try:
            os.symlink(self.luar, os.path.join(self.root, "link_rahasia.txt"))
        except (OSError, NotImplementedError):
            pass
        daftar = lu.daftar_file_dummy()
        self.assertIn("aman.txt", daftar)
        self.assertNotIn("folder_x", daftar)
        self.assertNotIn("link_rahasia.txt", daftar)


# =====================================================================
# 3. TES KEAMANAN SUBPROCESS (INJECTION, ENV LEAK, ERROR DISCLOSURE)
# =====================================================================
class TestKeamananSubprocess(DasarTes):
    def test_command_injection_tidak_dieksekusi(self):
        """Karakter shell (; $() ``) di nama file tidak pernah dieksekusi."""
        kasus = [
            ("evil; touch PWNED.txt", b"isi biasa", "PWNED.txt"),
            ("$(touch PWNED2.txt)", b"isi subshell", "PWNED2.txt"),
            ("`touch PWNED3.txt`", b"isi backtick", "PWNED3.txt"),
        ]
        for nama, isi, file_pwned in kasus:
            with self.subTest(nama=nama):
                hasil = lu.jalankan_sha256sum_linux(nama)
                self.assertEqual(hasil["sha256"], hashlib.sha256(isi).hexdigest())
                self.assertFalse(os.path.exists(os.path.join(os.getcwd(), file_pwned)))
                self.assertFalse(os.path.exists(os.path.join(self.root, file_pwned)))

    def test_argument_injection_nama_diawali_minus(self):
        """Argumen '--' memastikan nama seperti '-n' atau '--help' bukan opsi CLI."""
        for nama, isi in [("-n", b"nama berawalan minus"), ("--help", b"nama seperti flag")]:
            with self.subTest(nama=nama):
                h = lu.jalankan_sha256sum_linux(nama)
                self.assertEqual(h["sha256"], hashlib.sha256(isi).hexdigest())
                if ADA_CLI_LINUX:
                    ins = lu.jalankan_inspeksi_linux(nama)
                    self.assertEqual(ins["mime_linux"], "text/plain")

    def test_subprocess_pakai_shell_false_devnull_dan_env_bersih(self):
        """Verifikasi langsung parameter keamanan yang dikirim ke subprocess.run."""
        palsu = subprocess.CompletedProcess(
            args=[], returncode=0, stdout="a" * 64 + "  /x\n", stderr=""
        )
        with mock.patch.dict(os.environ, {"SECRET_KEY": "RAHASIA_SUPER_123", "LD_PRELOAD": "/evil.so"}):
            with mock.patch.object(lu, "_is_linux", return_value=True), \
                 mock.patch.object(lu.shutil, "which", return_value="/usr/bin/sha256sum"), \
                 mock.patch.object(lu.subprocess, "run", return_value=palsu) as m_run:
                lu.jalankan_sha256sum_linux("aman.txt")

                self.assertEqual(m_run.call_count, 1)
                args, kwargs = m_run.call_args
                cmd = args[0]
                self.assertIsInstance(cmd, list)
                self.assertEqual(cmd[0], "/usr/bin/sha256sum")
                self.assertEqual(cmd[1], "--")
                self.assertFalse(kwargs.get("shell", True))
                self.assertEqual(kwargs.get("stdin"), subprocess.DEVNULL)
                self.assertTrue(kwargs.get("close_fds"))
                self.assertEqual(kwargs.get("timeout"), lu.TIMEOUT_DETIK)

                env_dipakai = kwargs.get("env", {})
                self.assertNotIn("SECRET_KEY", env_dipakai)
                self.assertNotIn("LD_PRELOAD", env_dipakai)
                self.assertEqual(env_dipakai.get("LC_ALL"), "C")

    def test_error_tidak_membocorkan_path_server_atau_stderr(self):
        """Pesan error dikirim langsung ke klien oleh app.py -> tidak boleh bocor info internal."""
        with mock.patch.object(lu, "_is_linux", return_value=True), \
             mock.patch.object(lu.shutil, "which", return_value="/usr/bin/file"), \
             mock.patch.object(
                 lu.subprocess,
                 "run",
                 side_effect=subprocess.CalledProcessError(
                     1, "file", stderr="/home/yazid/secret/internal/traceback"
                 ),
             ):
            with self.assertRaises(lu.UtilitasLinuxError) as ctx:
                lu.jalankan_inspeksi_linux("aman.txt")
            pesan = str(ctx.exception)
            self.assertNotIn("/home/yazid", pesan)
            self.assertNotIn("traceback", pesan)
            self.assertNotIn(self.root, pesan)

        with self.assertRaises(FileNotFoundError) as ctx_nf:
            lu.validasi_path_aman("tidak_ada.txt")
        self.assertNotIn(self.root, str(ctx_nf.exception))


# =====================================================================
# 4. TES FUNGSIONAL SHA-256 & INSPEKSI LINUX
# =====================================================================
class TestSha256(DasarTes):
    def test_hash_sama_dengan_hashlib(self):
        harapan = hashlib.sha256(b"Dokumen aman\n").hexdigest()
        self.assertEqual(lu.jalankan_sha256sum_linux("aman.txt")["sha256"], harapan)

    @butuh_linux
    def test_memakai_perintah_asli_linux(self):
        self.assertIn("Linux CLI", lu.jalankan_sha256sum_linux("aman.txt")["engine"])


@butuh_linux
class TestInspeksi(DasarTes):
    def test_mime_dibaca_dari_isi_bukan_ekstensi(self):
        self.assertEqual(lu.jalankan_inspeksi_linux("gambar.jpg")["mime_linux"], "image/jpeg")
        self.assertEqual(lu.jalankan_inspeksi_linux("aman.txt")["mime_linux"], "text/plain")
        self.assertEqual(lu.jalankan_inspeksi_linux("dokumen.pdf")["mime_linux"], "application/pdf")

    def test_jpg_palsu_terbongkar(self):
        """Skenario inti FileMate: ekstensi .jpg tapi isi PE executable (4D 5A) atau skrip."""
        self._tulis("poster.jpg", b"#!/bin/sh\necho jahat\n", 0o755)
        hasil_sh = lu.jalankan_inspeksi_linux("poster.jpg")
        self.assertNotEqual(hasil_sh["mime_linux"], "image/jpeg")
        self.assertTrue(hasil_sh["bisa_dieksekusi"])

        self._tulis("Foto_Lokasi_Gedung.jpg", PE_DUMMY, 0o755)
        hasil_pe = lu.jalankan_inspeksi_linux("Foto_Lokasi_Gedung.jpg")
        self.assertNotEqual(hasil_pe["mime_linux"], "image/jpeg")
        self.assertIn(
            hasil_pe["mime_linux"],
            ("application/x-dosexec", "application/vnd.microsoft.portable-executable"),
        )
        self.assertTrue(hasil_pe["bisa_dieksekusi"])

    def test_permission_dan_ukuran_sesuai(self):
        aman = lu.jalankan_inspeksi_linux("aman.txt")
        skrip = lu.jalankan_inspeksi_linux("skrip.sh")
        self.assertEqual(aman["permission_linux"], "-rw-r--r--")
        self.assertFalse(aman["bisa_dieksekusi"])
        self.assertEqual(aman["ukuran_bytes"], len(b"Dokumen aman\n"))

        self.assertEqual(skrip["permission_linux"], "-rwxr-xr-x")
        self.assertTrue(skrip["bisa_dieksekusi"])
        self.assertEqual(skrip["ukuran_bytes"], len(b"#!/bin/sh\necho hi\n"))

    def test_engine_linux(self):
        self.assertIn("Linux CLI", lu.jalankan_inspeksi_linux("aman.txt")["engine"])


# =====================================================================
# 5. TES GAGAL JUJUR & VALIDASI OUTPUT KETAT
# =====================================================================
class TestGagalHarusJujur(DasarTes):
    def test_perintah_hilang_bukan_data_palsu(self):
        with mock.patch.object(lu, "_is_linux", return_value=True), \
             mock.patch.object(lu.shutil, "which", return_value=None):
            with self.assertRaises(lu.UtilitasLinuxError):
                lu.jalankan_inspeksi_linux("skrip.sh")
            with self.assertRaises(lu.UtilitasLinuxError):
                lu.jalankan_sha256sum_linux("aman.txt")

    def test_timeout_jadi_error_jelas(self):
        with mock.patch.object(lu, "_is_linux", return_value=True), \
             mock.patch.object(lu.shutil, "which", return_value="/usr/bin/x"), \
             mock.patch.object(
                 lu.subprocess,
                 "run",
                 side_effect=subprocess.TimeoutExpired(cmd="x", timeout=3),
             ):
            with self.assertRaises(lu.UtilitasLinuxError):
                lu.jalankan_sha256sum_linux("aman.txt")

    def test_perintah_error_jadi_error_jelas(self):
        with mock.patch.object(lu, "_is_linux", return_value=True), \
             mock.patch.object(lu.shutil, "which", return_value="/usr/bin/x"), \
             mock.patch.object(
                 lu.subprocess,
                 "run",
                 side_effect=subprocess.CalledProcessError(1, "x", stderr="boom"),
             ):
            with self.assertRaises(lu.UtilitasLinuxError):
                lu.jalankan_inspeksi_linux("aman.txt")

    def test_keluaran_sha256_aneh_ditolak(self):
        for stdout_palsu in ("bukan-hash  x\n", "A" * 64 + "  x\n", "a" * 63 + "  x\n", ""):
            with self.subTest(stdout=repr(stdout_palsu[:20])):
                palsu = subprocess.CompletedProcess(
                    args=[], returncode=0, stdout=stdout_palsu, stderr=""
                )
                with mock.patch.object(lu, "_is_linux", return_value=True), \
                     mock.patch.object(lu.shutil, "which", return_value="/usr/bin/sha256sum"), \
                     mock.patch.object(lu.subprocess, "run", return_value=palsu):
                    with self.assertRaises(lu.UtilitasLinuxError):
                        lu.jalankan_sha256sum_linux("aman.txt")

    def test_keluaran_stdout_terlalu_panjang_ditolak(self):
        palsu = subprocess.CompletedProcess(
            args=[], returncode=0, stdout="a" * (lu._MAKS_PANJANG_STDOUT + 10), stderr=""
        )
        with mock.patch.object(lu, "_is_linux", return_value=True), \
             mock.patch.object(lu.shutil, "which", return_value="/usr/bin/sha256sum"), \
             mock.patch.object(lu.subprocess, "run", return_value=palsu):
            with self.assertRaises(lu.UtilitasLinuxError):
                lu.jalankan_sha256sum_linux("aman.txt")

    def test_keluaran_inspeksi_aneh_ditolak(self):
        respon_buruk = [
            subprocess.CompletedProcess(args=[], returncode=0, stdout="bukan mime valid\n", stderr=""),
            subprocess.CompletedProcess(args=[], returncode=0, stdout="-rw-r--r-- 1 u g 10 x\n", stderr=""),
            subprocess.CompletedProcess(args=[], returncode=0, stdout="10\n", stderr=""),
        ]
        with mock.patch.object(lu, "_is_linux", return_value=True), \
             mock.patch.object(lu.shutil, "which", return_value="/usr/bin/x"), \
             mock.patch.object(lu.subprocess, "run", side_effect=respon_buruk):
            with self.assertRaises(lu.UtilitasLinuxError):
                lu.jalankan_inspeksi_linux("aman.txt")

    def test_fallback_non_linux_dilabeli_dan_mime_tidak_dikarang(self):
        with mock.patch.object(lu, "_is_linux", return_value=False):
            hasil = lu.jalankan_inspeksi_linux("skrip.sh")
            self.assertIsNone(hasil["mime_linux"])
            self.assertIn("NON-Linux", hasil["engine"])
            st = os.stat(os.path.join(self.root, "skrip.sh"))
            self.assertEqual(hasil["permission_linux"], stat.filemode(st.st_mode))
            self.assertEqual(hasil["ukuran_bytes"], st.st_size)

            h = lu.jalankan_sha256sum_linux("aman.txt")
            self.assertIn("NON-Linux", h["engine"])


class TestBisaDieksekusi(unittest.TestCase):
    def test_tabel_kebenaran(self):
        kasus = {
            "-rw-r--r--": False,
            "-rwxr-xr-x": True,
            "-rwx------": True,
            "-rw-rw-r-x": True,
            "-rwsr-xr-x": True,
            "-rw-r--r-T": False,
            "-rw-r--r-t": True,
            "": False,
            None: False,
            "rwx": False,
        }
        for perm, harapan in kasus.items():
            with self.subTest(perm=perm):
                self.assertEqual(lu.bisa_dieksekusi(perm), harapan)


if __name__ == "__main__":
    unittest.main(verbosity=2)
