# =====================================================================
# SKRIP PEMBUAT FILE DUMMY & GENERATOR SHA-256 OTOMATIS (LINUX CLI)
# Tugas Rohit Al Bukhori - FileMate (Safe Download Advisor)
# Jalankan di server Linux: python3 data/buat_dummy.py
# =====================================================================

import os
import json
import subprocess
import hashlib

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DUMMY_DIR = os.path.join(BASE_DIR, "dummy_files")
SKENARIO_FILE = os.path.join(BASE_DIR, "skenario.json")

os.makedirs(DUMMY_DIR, exist_ok=True)


def generate_safe_dummy_bytes(file_info):
    magic = file_info.get("magicBytes", "")
    real_name = file_info.get("realName", "dummy.txt")

    if "%PDF" in magic:
        return b"%PDF-1.7\n%Simulasi Dokumen PDF Aman FileMate - " + real_name.encode()
    elif "FF D8 FF" in magic:
        return b"\xff\xd8\xff\xe0\x00\x10JFIF\x00Simulasi Gambar JPEG FileMate - " + real_name.encode()
    elif "89 50 4E 47" in magic:
        return b"\x89PNG\r\n\x1a\nSimulasi Gambar PNG FileMate - " + real_name.encode()
    elif "50 4B 03 04" in magic:
        return b"PK\x03\x04Simulasi Arsip ZIP/Office FileMate - " + real_name.encode()
    elif "#!/bin/sh" in magic:
        return b"#!/bin/sh\n# Simulasi Script Pelatihan FileMate - " + real_name.encode() + b"\necho 'Simulasi FileMate'\n"
    elif "4D 5A" in magic:
        return b"MZ\x90\x00Simulasi Header PEExecutable Dummy FileMate (Bukan Malware Asli) - " + real_name.encode()
    else:
        return b"Simulasi File Teks/Script Pelatihan FileMate - " + real_name.encode()


def hitung_sha256_linux(filepath):
    """Menjalankan perintah asli Linux `sha256sum` dengan fallback Python."""
    try:
        hasil = subprocess.run(
            ["sha256sum", filepath],
            capture_output=True,
            text=True,
            check=True,
            timeout=5,
            shell=False
        )
        return hasil.stdout.strip().split()[0], "Linux CLI (sha256sum)"
    except Exception:
        with open(filepath, "rb") as f:
            return hashlib.sha256(f.read()).hexdigest(), "Python hashlib (Fallback)"


def buat_hash_mismatch(real_hash):
    """Mengubah 8 karakter di tengah hash asli untuk simulasi file yang dimodifikasi."""
    tengah = "".join("0" if c != "0" else "f" for c in real_hash[24:32])
    return real_hash[:24] + tengah + real_hash[32:]


def main():
    # 1. Hapus file dummy lama agar folder dummy_files selalu bersih
    for file_lama in os.listdir(DUMMY_DIR):
        path_lama = os.path.join(DUMMY_DIR, file_lama)
        if os.path.isfile(path_lama):
            os.remove(path_lama)

    with open(SKENARIO_FILE, "r", encoding="utf-8") as f:
        bank = json.load(f)

    count = 0
    engine_terakhir = ""

    for kategori, daftar_skenario in bank.items():
        for sken in daftar_skenario:
            for f_info in sken["files"]:
                fname = f_info["realName"]
                fpath = os.path.join(DUMMY_DIR, fname)

                # 2. Buat file fisik dummy sesuai Magic Bytes
                with open(fpath, "wb") as out:
                    out.write(generate_safe_dummy_bytes(f_info))

                # 3. Set permission Linux (755 untuk executable/script, 644 untuk dokumen pasif)
                try:
                    os.chmod(fpath, 0o755 if "x" in f_info.get("perm", "") else 0o644)
                except Exception:
                    pass

                # 4. Generate SHA-256 asli dari server Linux
                real_hash, engine_terakhir = hitung_sha256_linux(fpath)
                f_info["hash"] = real_hash

                # 5. Sinkronkan expectedHash otomatis
                if f_info.get("expectedHash") is not None:
                    if f_info.get("isMalware", False):
                        f_info["expectedHash"] = buat_hash_mismatch(real_hash)
                    else:
                        f_info["expectedHash"] = real_hash

                count += 1
                print(f"[OK] {fname} -> {real_hash[:16]}... ({engine_terakhir})")

    # 6. Simpan hasil hash ke data/skenario.json
    with open(SKENARIO_FILE, "w", encoding="utf-8") as out_json:
        json.dump(bank, out_json, indent=4, ensure_ascii=False)

    print(f"\nSelesai! {count} file dummy dibuat & skenario.json diperbarui via {engine_terakhir}.")


if __name__ == "__main__":
    main()