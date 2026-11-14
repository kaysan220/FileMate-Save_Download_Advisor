# =====================================================================
# UTILITAS LINUX — Tugas Muhamad Yazid Firdaus
#   sha256sum, file --mime-type, ls -l terhadap file di data/dummy_files/
# KEAMANAN:
#   - Anti-Path Traversal  : basename() + cek berada di dalam DUMMY_DIR
#   - Anti-Command Injection: subprocess.run([...], shell=False)
#   - Fallback Python bila dijalankan di Windows (perintah Linux tidak ada)
# =====================================================================
import hashlib
import os
import stat
import subprocess

from flask import current_app

TIMEOUT_DETIK = 3


def validasi_path_aman(nama_file):
    dummy_dir = os.path.abspath(current_app.config["DUMMY_DIR"])
    nama_bersih = os.path.basename(str(nama_file or "").replace("\\", "/"))
    if not nama_bersih or nama_bersih in (".", ".."):
        raise ValueError("Nama file tidak valid.")

    full_path = os.path.abspath(os.path.join(dummy_dir, nama_bersih))
    if os.path.commonpath([full_path, dummy_dir]) != dummy_dir:
        raise ValueError("Akses ditolak: percobaan Path Traversal terdeteksi!")
    if not os.path.isfile(full_path):
        raise FileNotFoundError(f"File dummy '{nama_bersih}' tidak ditemukan.")
    return full_path, nama_bersih


def _jalankan(perintah):
    hasil = subprocess.run(
        perintah, capture_output=True, text=True, check=True,
        timeout=TIMEOUT_DETIK, shell=False,
    )
    return hasil.stdout.strip()


def jalankan_sha256sum_linux(nama_file):
    full_path, nama_bersih = validasi_path_aman(nama_file)
    try:
        # GNU sha256sum menambahkan "\" di depan hash bila path mengandung backslash (Windows)
        hash_val = _jalankan(["sha256sum", full_path]).split()[0].lstrip("\\")
        engine = "Linux CLI (sha256sum)"
    except (OSError, subprocess.SubprocessError, IndexError):
        h = hashlib.sha256()
        with open(full_path, "rb") as f:
            for blok in iter(lambda: f.read(65536), b""):
                h.update(blok)
        hash_val = h.hexdigest()
        engine = "Python hashlib (Fallback)"
    return {"file": nama_bersih, "sha256": hash_val, "engine": engine}


def jalankan_inspeksi_linux(nama_file):
    full_path, nama_bersih = validasi_path_aman(nama_file)
    try:
        mime_out = _jalankan(["file", "-b", "--mime-type", full_path])
        perm_out = _jalankan(["ls", "-l", full_path]).split()[0]
        engine = "Linux CLI (file --mime-type & ls -l)"
    except (OSError, subprocess.SubprocessError, IndexError):
        mime_out = "application/octet-stream"
        perm_out = stat.filemode(os.stat(full_path).st_mode)
        engine = "Python os.stat (Fallback)"
    return {
        "file": nama_bersih,
        "mime_linux": mime_out,
        "permission_linux": perm_out,
        "engine": engine,
    }
