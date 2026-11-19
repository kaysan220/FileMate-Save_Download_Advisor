# =====================================================================
# MODUL UTILITAS LINUX FILEMATE — TUGAS MUHAMAD YAZID FIRDAUS
#
# Menjalankan perintah ASLI Linux terhadap file di data/dummy_files/:
#   1. sha256sum        -> sidik jari (hash) file
#   2. file --mime-type -> tipe file yang sebenarnya (dari isi, bukan ekstensi)
#   3. ls -l            -> permission file (-rw-r--r-- / -rwxr-xr-x)
#   4. stat -c %s       -> ukuran file asli (byte)
#
# PRINSIP KEAMANAN (APPSEC HARDENING)
#   - Input nama file TIDAK dibersihkan diam-diam, tetapi DITOLAK jika
#     bukan string, kosong, > 255 byte UTF-8, ".", "..", mengandung "/",
#     "\", NUL, karakter kontrol ASCII (termasuk \n/\r), atau karakter
#     Unicode Bidi Override (seperti RLO U+202E). Penolakan dicatat di log
#     dengan repr() agar aman dari log forging.
#   - Semua symlink (baik keluar maupun di dalam dummy_files/) DITOLAK.
#     Hanya regular file (stat.S_ISREG) yang diterima; direktori, FIFO,
#     socket, dan device file ditolak untuk mencegah hang/DoS.
#   - Path hasil resolve (realpath) dipastikan tetap berada di dalam
#     DUMMY_DIR (mencegah path traversal).
#   - Batas ukuran file maksimal (MAX_FILE_SIZE_BYTES) diterapkan untuk
#     mencegah resource exhaustion / DoS saat hashing.
#   - subprocess.run(list, shell=False, stdin=DEVNULL, close_fds=True):
#     tanpa shell, argumen "--" menutup argument/flag injection, timeout
#     ketat, dan environment dibersihkan (LC_ALL=C, tanpa SECRET_KEY dll.).
#   - Output setiap perintah divalidasi ketat dengan regex & batas panjang.
#   - GAGAL ITU JUJUR: jika perintah Linux hilang / timeout / gagal /
#     keluarannya aneh, lempar UtilitasLinuxError dengan pesan generik
#     (detail teknis hanya masuk log server, tidak bocor ke klien HTTP).
#   - Satu-satunya fallback: OS NON-Linux (saat pengembangan di Windows).
#     Fallback dilabeli jelas dan mime_linux = None (tidak dikarang).
# =====================================================================
import hashlib
import logging
import os
import re
import shutil
import stat
import subprocess
import sys

log = logging.getLogger("filemate.linux_utils")

# Jika modul ini dipindah (mis. ke backend/app/simulation/), atur lokasi
# dummy_files lewat environment variable FILEMATE_DUMMY_DIR.
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DUMMY_DIR = os.environ.get("FILEMATE_DUMMY_DIR") or os.path.join(
    BASE_DIR, "data", "dummy_files"
)

TIMEOUT_DETIK = 3
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB (anti-DoS)
_MAKS_PANJANG_NAMA_BYTES = 255
_MAKS_PANJANG_STDOUT = 4096

# Karakter kontrol Unicode Bidirectional (sering dipakai untuk spoofing nama file)
_BIDI_CONTROLS = frozenset({
    "\u202a", "\u202b", "\u202c", "\u202d", "\u202e",
    "\u2066", "\u2067", "\u2068", "\u2069",
    "\u200e", "\u200f", "\u061c",
})

# Regex validasi ketat untuk keluaran perintah Linux
_RE_SHA256 = re.compile(r"^[0-9a-f]{64}$")
_RE_MIME = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9.+-]*/[a-zA-Z0-9][a-zA-Z0-9.+-]*$")
_RE_PERM_REGULER = re.compile(
    r"^-[r-][w-][xsStT-][r-][w-][xsStT-][r-][w-][xsStT-]$"
)
_RE_UKURAN = re.compile(r"^[0-9]+$")

# PATH standar yang aman untuk child process di Linux
_SAFE_PATH = "/usr/local/bin:/usr/bin:/bin"


class UtilitasLinuxError(RuntimeError):
    """Perintah Linux gagal / tidak tersedia / timeout / keluarannya aneh.

    Pesannya sengaja generik agar aman dikembalikan oleh API ke klien.
    Detail teknis hanya dicatat di log server.
    """


def _is_linux():
    return sys.platform.startswith("linux")


def _env_bersih():
    """Bangun environment minimal untuk subprocess agar tidak membocorkan
    variabel sensitif (mis. SECRET_KEY) dan memaksa locale POSIX/C.
    """
    return {
        "PATH": _SAFE_PATH,
        "LC_ALL": "C",
        "LANG": "C",
    }


def _mengandung_karakter_terlarang(nama):
    """True jika nama file mengandung separator path, NUL, karakter kontrol
    ASCII (0x00-0x1F, 0x7F), atau karakter kontrol Unicode Bidi.
    """
    for ch in nama:
        code = ord(ch)
        if ch in ("/", "\\") or code < 32 or code == 127 or ch in _BIDI_CONTROLS:
            return True
    return False


def validasi_path_aman(nama_file):
    """Kembalikan (path_lengkap, nama_file) jika aman; jika tidak lempar error.

    ValueError         -> nama file berbahaya / tidak valid / symlink / bukan regular file
    FileNotFoundError  -> nama valid, tetapi file tidak ada di dummy_files/
    UtilitasLinuxError -> file melebihi batas ukuran atau gagal diperiksa atributnya
    """
    if not isinstance(nama_file, str):
        raise ValueError("Nama file tidak valid")

    nama = nama_file
    if (
        not nama
        or nama in (".", "..")
        or len(nama.encode("utf-8", errors="surrogateescape")) > _MAKS_PANJANG_NAMA_BYTES
        or _mengandung_karakter_terlarang(nama)
    ):
        log.warning("Nama file ditolak: %r", nama[:80])
        raise ValueError("Nama file tidak valid")

    root = os.path.realpath(DUMMY_DIR)
    kandidat = os.path.join(root, nama)

    # Tolak semua symlink secara eksplisit (termasuk symlink internal)
    try:
        st_lstat = os.lstat(kandidat)
    except FileNotFoundError:
        raise FileNotFoundError("File tidak ditemukan")
    except OSError as e:
        log.error("Gagal memeriksa lstat untuk %r: %s", nama[:80], e)
        raise UtilitasLinuxError("File tidak bisa diakses")

    if stat.S_ISLNK(st_lstat.st_mode):
        log.warning("Symlink ditolak: %r", nama[:80])
        raise ValueError("Nama file tidak valid")

    if not stat.S_ISREG(st_lstat.st_mode):
        log.warning("Bukan file reguler ditolak: %r (mode=%o)", nama[:80], st_lstat.st_mode)
        raise ValueError("Nama file tidak valid")

    # Double-check canonical path tetap berada di dalam root
    full = os.path.realpath(kandidat)
    try:
        di_dalam = os.path.commonpath([root, full]) == root and full != root
    except ValueError:  # mis. beda drive di Windows
        di_dalam = False

    if not di_dalam:
        log.warning("Path keluar dari dummy_files ditolak: %r", nama[:80])
        raise ValueError("Nama file tidak valid")

    if st_lstat.st_size > MAX_FILE_SIZE_BYTES:
        log.warning(
            "File melebihi batas ukuran (%d > %d): %r",
            st_lstat.st_size,
            MAX_FILE_SIZE_BYTES,
            nama[:80],
        )
        raise UtilitasLinuxError("Ukuran file melebihi batas yang diizinkan")

    return full, nama


def _cari_perintah(perintah):
    """Pastikan perintah tersedia di PATH dan kembalikan path eksekusinya."""
    lokasi = shutil.which(perintah)
    if lokasi is None:
        log.error("Perintah '%s' tidak ditemukan di PATH server", perintah)
        raise UtilitasLinuxError(f"Perintah '{perintah}' tidak tersedia di server")
    return lokasi


def _jalankan(daftar_perintah, nama_log=None):
    """Jalankan perintah tanpa shell dengan env bersih; kembalikan stdout."""
    nama = nama_log or os.path.basename(daftar_perintah[0])
    try:
        hasil = subprocess.run(
            daftar_perintah,
            stdin=subprocess.DEVNULL,
            capture_output=True,
            text=True,
            check=True,
            timeout=TIMEOUT_DETIK,
            shell=False,
            close_fds=True,
            env=_env_bersih(),
        )
    except subprocess.TimeoutExpired:
        log.error("Perintah '%s' timeout (> %s detik)", nama, TIMEOUT_DETIK)
        raise UtilitasLinuxError(f"Perintah '{nama}' melewati batas waktu")
    except subprocess.CalledProcessError as e:
        log.error("Perintah '%s' gagal (kode %s): %s", nama, e.returncode, (e.stderr or "")[:200])
        raise UtilitasLinuxError(f"Perintah '{nama}' gagal dijalankan")
    except OSError as e:
        log.error("Perintah '%s' tidak bisa dijalankan: %s", nama, e)
        raise UtilitasLinuxError(f"Perintah '{nama}' tidak tersedia di server")

    stdout = hasil.stdout or ""
    if len(stdout) > _MAKS_PANJANG_STDOUT:
        log.error("Keluaran perintah '%s' terlalu panjang (%d karakter)", nama, len(stdout))
        raise UtilitasLinuxError(f"Keluaran perintah '{nama}' tidak valid")
    return stdout.strip()


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
    """True jika string permission ala `ls -l` punya izin eksekusi (x/s/t)."""
    if not isinstance(permission, str) or len(permission) < 10:
        return False
    return permission[3] in "xs" or permission[6] in "xs" or permission[9] in "xt"


def daftar_file_dummy():
    """Kembalikan daftar nama file reguler (non-symlink) di DUMMY_DIR secara terurut."""
    root = os.path.realpath(DUMMY_DIR)
    if not os.path.isdir(root):
        return []
    hasil = []
    try:
        with os.scandir(root) as it:
            for entry in it:
                try:
                    if not entry.is_symlink() and entry.is_file(follow_symlinks=False):
                        if not _mengandung_karakter_terlarang(entry.name):
                            hasil.append(entry.name)
                except OSError:
                    continue
    except OSError as e:
        log.error("Gagal membaca direktori dummy_files: %s", e)
        return []
    return sorted(hasil)


def jalankan_sha256sum_linux(nama_file):
    """`sha256sum -- <file>` -> {"file", "sha256", "engine"}"""
    full_path, nama = validasi_path_aman(nama_file)

    if _is_linux():
        bin_sha = _cari_perintah("sha256sum")
        keluaran = _jalankan([bin_sha, "--", full_path], nama_log="sha256sum")
        hash_val = keluaran.split()[0] if keluaran else ""
        if not _RE_SHA256.match(hash_val):
            log.error("Keluaran sha256sum tidak valid: %r", keluaran[:100])
            raise UtilitasLinuxError("Keluaran sha256sum tidak valid")
        engine = "Linux CLI (sha256sum)"
    else:
        hash_val = _sha256_python(full_path)
        engine = "Python hashlib (fallback NON-Linux, hanya untuk pengembangan)"

    return {"file": nama, "sha256": hash_val, "engine": engine}


def jalankan_inspeksi_linux(nama_file):
    """`file -b --mime-type` + `ls -l` + `stat -c %s` ->
    {
        "file": str,
        "mime_linux": str | None,
        "permission_linux": str,
        "bisa_dieksekusi": bool,
        "ukuran_bytes": int,
        "engine": str,
    }
    """
    full_path, nama = validasi_path_aman(nama_file)

    if _is_linux():
        bin_file = _cari_perintah("file")
        bin_ls = _cari_perintah("ls")
        bin_stat = _cari_perintah("stat")

        mime = _jalankan([bin_file, "-b", "--mime-type", "--", full_path], nama_log="file")
        ls_out = _jalankan([bin_ls, "-l", "--", full_path], nama_log="ls")
        stat_out = _jalankan([bin_stat, "-c", "%s", "--", full_path], nama_log="stat")

        # Ambil 10 karakter pertama: tanda "+" / "." (ACL/SELinux) ikut dibuang.
        perm = ls_out.split()[0][:10] if ls_out else ""
        if (
            not _RE_MIME.match(mime)
            or not _RE_PERM_REGULER.match(perm)
            or not _RE_UKURAN.match(stat_out)
        ):
            log.error(
                "Keluaran inspeksi tidak valid: mime=%r | ls=%r | stat=%r",
                mime[:100],
                ls_out[:100],
                stat_out[:50],
            )
            raise UtilitasLinuxError("Keluaran inspeksi tidak valid")

        ukuran = int(stat_out)
        engine = "Linux CLI (file --mime-type, ls -l, stat)"
    else:
        try:
            st = os.stat(full_path)
            perm = stat.filemode(st.st_mode)
            ukuran = st.st_size
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
        "ukuran_bytes": ukuran,
        "engine": engine,
    }
