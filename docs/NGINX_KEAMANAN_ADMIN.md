# Nginx: IP Asli & Pembatasan Request Login Admin

Untuk: Yazid (Linux & Infrastructure). Dari: Kaysan (backend).

Backend sudah membatasi login admin **per IP**: salah ke-5/15/25 ditunda 30 detik / 5 menit / 1 jam, dan salah ke-35 wajib password cadangan. Ada juga batas global dan batas untuk password cadangan. Logikanya ada di `core/admin_auth.py`.

Batas per IP itu hanya benar kalau Flask tahu **IP asli** pengunjung. Panduan ini berisi tiga hal yang perlu diatur di server:

1. Nginx meneruskan IP asli ke Flask.
2. `PROXY_COUNT` di `.env` sesuai dengan susunan proxy.
3. Nginx `limit_req` sebagai lapis pertama, supaya banjir request tertahan sebelum sampai ke Python.

---

## 1. Susunan yang diasumsikan

```
Pengunjung → Cloudflare → cloudflared → Nginx → Flask/Gunicorn
                          (tunnel)      (filemate_nginx)  (filemate_flask)
```

Cloudflare selalu mengisi header `CF-Connecting-IP` dengan IP asli pengunjung. Nginx akan membaca header itu, tetapi **hanya kalau request datang dari cloudflared**. Request dari sumber lain tidak dipercaya.

## 2. Konfigurasi Nginx

```nginx
# ---- di blok http { } (mis. /etc/nginx/nginx.conf atau conf.d/) ----

# (a) IP asli dari Cloudflare, HANYA dipercaya jika datang dari cloudflared.
#     Ganti dengan IP / subnet container cloudflared (cek: docker network inspect <network>).
#     Jika cloudflared berjalan langsung di host: set_real_ip_from 127.0.0.1;
set_real_ip_from 172.16.0.0/12;
real_ip_header   CF-Connecting-IP;

# (b) Zona pembatas request (kunci = IP asli, sudah benar setelah real_ip di atas)
limit_req_zone $binary_remote_addr zone=admin_login:10m rate=10r/m;   # login/cadangan
limit_req_zone $binary_remote_addr zone=admin_data:10m  rate=60r/m;   # menu Satgas
limit_req_zone $binary_remote_addr zone=api_umum:10m    rate=10r/s;   # game, leaderboard
limit_req_status 429;

# ---- di blok server { } ----
server {
    listen 80;
    server_tokens off;
    client_max_body_size 16k;          # sama dengan MAX_CONTENT_LENGTH di Flask

    # Header yang sama untuk semua lokasi ke Flask.
    # PENTING: X-Forwarded-For DITIMPA dengan $remote_addr (bukan ditambah),
    # jadi Flask selalu menerima satu IP bersih -> PROXY_COUNT=1.
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $remote_addr;
    proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;

    # Endpoint login & password cadangan: paling ketat (±10 request/menit per IP)
    location ~ ^/api/admin/(login|setup|recovery|reset)$ {
        limit_req zone=admin_login burst=5 nodelay;
        proxy_pass http://filemate_flask:5000;
    }

    # Endpoint admin lain (status, feedback, export, clear, logout)
    location /api/admin/ {
        limit_req zone=admin_data burst=20 nodelay;
        proxy_pass http://filemate_flask:5000;
    }

    # API umum (sesi game, leaderboard, dashboard)
    location /api/ {
        limit_req zone=api_umum burst=30 nodelay;
        proxy_pass http://filemate_flask:5000;
    }

    location / {
        proxy_pass http://filemate_flask:5000;
    }
}
```

Sesuaikan `filemate_flask:5000` dengan nama service atau port Flask di `docker-compose`.

Lalu jalankan:

```bash
sudo nginx -t && sudo systemctl reload nginx    # atau: docker compose restart filemate_nginx
```

## 3. `.env` di server

```env
PROXY_COUNT=1
COOKIE_SECURE=1          # situs diakses lewat HTTPS (Cloudflare)
ADMIN_RECOVERY_HASH=...  # isi lewat: python -m core.atur_password_cadangan
SECRET_KEY=...           # dibuat otomatis oleh skrip yang sama
```

Kenapa nilainya `1`? Nginx menimpa `X-Forwarded-For` dengan satu IP, jadi Flask cukup membaca satu nilai dari kanan. Kalau konfigurasi Nginx-nya berbeda, misalnya memakai `$proxy_add_x_forwarded_for`, angka ini harus dihitung ulang. Lihat bagian 5.

Di laptop (`python app.py` langsung), `PROXY_COUNT` **harus kosong**. Kalau tidak, siapa pun bisa memalsukan IP lewat header.

## 4. Wajib: Flask tidak boleh bisa diakses langsung

Semua pengaman di atas bisa dilewati kalau penyerang bisa langsung menghubungi Flask atau Nginx tanpa melalui Cloudflare. Karena itu:

- Di `docker-compose.yml`, service Flask **jangan** memakai `ports:` ke host. Cukup `expose: ["5000"]` di network internal.
- Nginx juga cukup bisa dijangkau cloudflared. Kalau port 80 dibuka ke internet, tutup dengan firewall:

```bash
sudo ufw deny 80
sudo ufw deny 5000
```

## 5. Cara mengecek IP yang diterima Flask

1. Buka menu admin (Ctrl+Shift+L) dan masukkan password yang salah satu kali.
2. Lihat log Flask:

```bash
docker compose logs filemate_flask | grep "Login admin gagal"
# Login admin gagal: ip=36.80.x.x salah_ip=1 salah_global=1
```

- `ip=` berisi **IP publik kamu** (cek di https://ifconfig.me): konfigurasi sudah benar.
- `ip=` berisi `172.x.x.x` atau `127.0.0.1`: IP asli belum sampai ke Flask. Periksa `set_real_ip_from` dan `PROXY_COUNT`.

3. Masukkan password admin yang benar supaya hitungan salah IP kamu kembali ke 0.

Uji pemalsuan header. Perintah ini dijalankan dari luar server, lewat domain Cloudflare:

```bash
curl -s -X POST https://<domain>/api/admin/login \
     -H "Content-Type: application/json" \
     -H "X-Forwarded-For: 1.2.3.4" \
     -d '{"password_hash":"00"}'
```

Di log, `ip=` harus tetap berisi IP asli kamu, **bukan** `1.2.3.4`.

## 6. Uji `limit_req`

```bash
for i in $(seq 1 40); do
  curl -s -o /dev/null -w "%{http_code} " https://<domain>/api/admin/status
done; echo
```

Sekitar 20 request pertama mendapat `200` (jatah `burst`), lalu sisanya mendapat `429` dari Nginx. Setelah satu menit, request kembali diterima.
