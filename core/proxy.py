# =====================================================================
# PROXYFIX — IP ASLI PENGUNJUNG DI BALIK NGINX / CLOUDFLARE TUNNEL
#
# Tanpa ini, di balik reverse proxy request.remote_addr selalu berisi IP
# proxy (mis. 172.18.0.3), sehingga semua pengunjung dianggap SATU orang
# oleh pembatas login admin (SECURITY.md K-05).
#
# ProxyFix membaca header X-Forwarded-For DARI KANAN sebanyak PROXY_COUNT.
# Bagian kiri header bisa dipalsukan pengunjung, jadi tidak pernah dibaca.
#
# Pengaturan di .env:
#   PROXY_COUNT=      (kosong / 0) -> ProxyFix MATI. Wajib saat `python app.py`
#                     langsung di laptop: kalau aktif tanpa proxy, siapa pun
#                     bisa memalsukan IP lewat header.
#   PROXY_COUNT=1     -> satu proxy tepercaya di depan Flask (mis. Nginx yang
#                     sudah membersihkan IP dari Cloudflare dengan modul real_ip).
#   PROXY_COUNT=2     -> dua proxy yang masing-masing menambah X-Forwarded-For.
# Lihat docs/NGINX_KEAMANAN_ADMIN.md untuk cara menentukan angkanya.
# =====================================================================
import logging
import os

from werkzeug.middleware.proxy_fix import ProxyFix

from core.env import muat_env

MAKS_PROXY = 5
log = logging.getLogger("filemate.proxy")


def jumlah_proxy():
    muat_env()
    try:
        n = int((os.environ.get("PROXY_COUNT") or "0").strip())
    except ValueError:
        log.warning("PROXY_COUNT tidak valid, ProxyFix dimatikan.")
        return 0
    return max(0, min(MAKS_PROXY, n))


def pasang_proxy_fix(app):
    """Memasang ProxyFix pada app Flask jika PROXY_COUNT > 0. Mengembalikan jumlahnya."""
    n = jumlah_proxy()
    if n > 0:
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=n)
    app.config["PROXY_COUNT"] = n
    return n
