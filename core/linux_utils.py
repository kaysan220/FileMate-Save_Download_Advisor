# =====================================================================
# MODUL UTILITAS LINUX FILEMATE — TUGAS MUHAMAD YAZID FIRDAUS
#
# Menjalankan perintah ASLI Linux terhadap file di data/dummy_files/:
#   1. sha256sum        -> sidik jari (hash) file
#   2. file --mime-type -> tipe file yang sebenarnya (dari isi, bukan ekstensi)
#   3. ls -l            -> permission file (-rw-r--r-- / -rwxr-xr-x)
#
# PRINSIP KEAMANAN
#   - Nama file dari user TIDAK dibersihkan diam-diam, tapi DITOLAK kalau
#     mengandung "/", "\", NUL, "." atau "..". Penolakan dicatat di log.
#   - Path akhir di-resolve (realpath) lalu dipastikan masih di dalam
#     data/dummy_files/ (symlink keluar folder ikut ditolak).
#   - subprocess.run(list, shell=False): tidak ada shell, jadi karakter
#     seperti ; | $() tidak punya arti. Argumen "--" menutup argument injection.
#   - GAGAL ITU JUJUR: kalau perintah Linux hilang / timeout / error, fungsi
#     melempar UtilitasLinuxError. Tidak ada data palsu.
#   - Satu-satunya fallback: di OS NON-Linux (laptop Windows saat ngoding).
#     Fallback itu dilabeli jelas dan MIME-nya None (tidak dikarang).
# =====================================================================
import hashlib
import logging
import os
import shutil
import stat
import subprocess
import sys

log = logging.getLogger("filemate.linux_utils")

# Kalau file ini dipindah (mis. ke backend/app/simulation/), atur lewat
# environment variable FILEMATE_DUMMY_DIR atau ubah BASE_DIR di config.py.
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DUMMY_DIR = os.environ.get("FILEMATE_DUMMY_DIR") or os.path.join(
    BASE_DIR, "data", "dummy_files"
)
TIMEOUT_DETIK = 3
_MAKS_PANJANG_NAMA = 255
_HEX = set("0123456789abcdef")


class UtilitasLinuxError(RuntimeError):
    """Perintah Linux gagal / tidak tersedia / timeout / keluarannya aneh.

    Pesannya sengaja generik (aman ditampilkan ke user). Detail teknis
    hanya masuk ke log server.
    """


def _is_linux():
    return sys.platform.startswith("linux")


def validasi_path_aman(nama_file):
    """Kembalikan (path_lengkap, nama_file) kalau aman, kalau tidak lempar error.

    ValueError        -> nama file berbahaya / tidak valid
    FileNotFoundError -> nama valid, tapi file tidak ada di dummy_files/
    """
    if not isinstance(nama_file, str):
        raise ValueError("Nama file tidak valid")

    nama = nama_file
    if (
        not nama
        or len(nama) > _MAKS_PANJANG_NAMA
        or nama in (".", "..")
        or "/" in nama
        or "\\" in nama
        or "\x00" in nama
    ):
        log.warning("Nama file ditolak: %r", nama[:80])
        raise ValueError("Nama file tidak valid")

    root = os.path.realpath(DUMMY_DIR)
    full = os.path.realpath(os.path.join(root, nama))

    try:
        di_dalam = os.path.commonpath([root, full]) == root and full != root
    except ValueError:  # contoh: beda drive di Windows
        di_dalam = False

    if not di_dalam:
        log.warning("Path keluar dari dummy_files ditolak: %r", nama[:80])
        raise ValueError("Nama file tidak valid")

    if not os.path.isfile(full):
        raise FileNotFoundError("File tidak ditemukan")

    return full, nama


def _pastikan_ada(perintah):
    if shutil.which(perintah) is None:
        log.error("Perintah '%s' tidak ditemukan di PATH server", perintah)
        raise UtilitasLinuxError(f"Perintah '{perintah}' tidak tersedia di server")


def _jalankan(daftar_perintah):
    """Jalankan perintah tanpa shell; kembalikan stdout (sudah di-strip)."""
    nama = daftar_perintah[0]
    try:
        hasil = subprocess.run(
            daftar_perintah,
            capture_output=True,
            text=True,
            check=True,
            timeout=TIMEOUT_DETIK,
            shell=False,
        )
    except subprocess.TimeoutExpired:
        log.error("Perintah '%s' timeout (> %s detik)", nama, TIMEOUT_DETIK)
        raise UtilitasLinuxError(f"Perintah '{nama}' melewati batas waktu")
    except subprocess.CalledProcessError as e:
        log.error("Perintah '%s' gagal (kode %s): %s", nama, e.returncode, e.stderr)
        raise UtilitasLinuxError(f"Perintah '{nama}' gagal dijalankan")
    except OSError as e:
        log.error("Perintah '%s' tidak bisa dijalankan: %s", nama, e)
        raise UtilitasLinuxError(f"Perintah '{nama}' tidak tersedia di server")
    return hasil.stdout.strip()


def _sha256_python(path):
    h = hashlib.sha256()
    try:
        with open(path, "rb") as f:
            for blok in iter(lambda: f.read(8192), b""):
                h.update(blok)
    except OSError as e:
        log.error("Gagal membaca file untuk hash: %s", e)
        raise UtilitasLinuxError("File tidak bisa dibaca")
    return h.hexdigest()


def bisa_dieksekusi(permission):
    """True kalau string permission ala `ls -l` punya izin eksekusi (x/s/t)."""
    if not isinstance(permission, str) or len(permission) < 10:
        return False
    return permission[3] in "xs" or permission[6] in "xs" or permission[9] in "xt"


def jalankan_sha256sum_linux(nama_file):
    """`sha256sum -- <file>` -> {"file", "sha256", "engine"}"""
    full_path, nama = validasi_path_aman(nama_file)

    if _is_linux():
        _pastikan_ada("sha256sum")
        keluaran = _jalankan(["sha256sum", "--", full_path])
        hash_val = keluaran.split()[0] if keluaran else ""
        if len(hash_val) != 64 or not set(hash_val) <= _HEX:
            log.error("Keluaran sha256sum tidak valid: %r", keluaran[:100])
            raise UtilitasLinuxError("Keluaran sha256sum tidak valid")
        engine = "Linux CLI (sha256sum)"
    else:
        hash_val = _sha256_python(full_path)
        engine = "Python hashlib (fallback NON-Linux, hanya untuk pengembangan)"

    return {"file": nama, "sha256": hash_val, "engine": engine}


def jalankan_inspeksi_linux(nama_file):
    """`file -b --mime-type` + `ls -l` ->
    {"file", "mime_linux", "permission_linux", "bisa_dieksekusi", "engine"}
    """
    full_path, nama = validasi_path_aman(nama_file)

    if _is_linux():
        _pastikan_ada("file")
        _pastikan_ada("ls")
        mime = _jalankan(["file", "-b", "--mime-type", "--", full_path])
        ls_out = _jalankan(["ls", "-l", "--", full_path])
        # Ambil 10 karakter pertama: tanda "+" / "." (ACL/SELinux) ikut dibuang.
        perm = ls_out.split()[0][:10] if ls_out else ""
        if not mime or len(perm) != 10:
            log.error("Keluaran file/ls tidak valid: %r | %r", mime[:100], ls_out[:100])
            raise UtilitasLinuxError("Keluaran inspeksi tidak valid")
        engine = "Linux CLI (file --mime-type & ls -l)"
    else:
        try:
            perm = stat.filemode(os.stat(full_path).st_mode)
        except OSError as e:
            log.error("Gagal membaca atribut file: %s", e)
            raise UtilitasLinuxError("File tidak bisa dibaca")
        mime = None  # tidak diketahui; JANGAN dikarang
        engine = "Python os.stat (fallback NON-Linux, hanya untuk pengembangan)"

    return {
        "file": nama,
        "mime_linux": mime,
        "permission_linux": perm,
        "bisa_dieksekusi": bisa_dieksekusi(perm),
        "engine": engine,
    }
