Arsitektur file folder yang akan direncakan

=====================================================

Mohon untuk menandai bagian yang sudah fix dikerjakan
Misalnya : README.md --- OK 13/11/2026

=====================================================


FileMate/
├── README.md                                                                    --- BELUM ADA
├── CHANGELOG.md                                                                 --- BELUM ADA
├── .env.example                  ← SECRET_KEY, ADMIN_PIN                        --- OK 18/11/2026
├── .gitignore                    ← .env, *.db, __pycache__, data/exports/*      --- SEBAGIAN 18/11/2026
│
├── docs/                         --- OK 14/11/2026
│   ├── ARCHITECTURE.md           ← gambaran sistem, alur, struktur folder        --- OK 14/11/2026 
│   ├── API_CONTRACT.md           ← semua endpoint + contoh JSON                  --- OK 14/11/2026
│   ├── DATA_SCHEMA.md            ← skenario.json + tabel SQL                     --- OK 14/11/2026
│   ├── SECURITY.md               ← kontrol keamanan (bahan sidang DKS)           --- OK 14/11/2026
│   └── TESTING.md                ← cara tes + checklist user testing             --- OK 14/11/2026
│
├── frontend/
│   ├── pages/                          --- OK 14/10/2026
│   │   ├── index.html
│   │   ├── play.html
│   │   ├── result.html
│   │   └── guide.html
│   └── assets/
│       ├── css/                        --- OK 14/10/2026
│       │   ├── base.css          ← variabel tema, reset, tipografi
│       │   ├── components.css    ← tombol, panel, modal, toast, form
│       │   └── pages.css         ← gaya khusus tiap halaman
│       ├── js/                         --- OK 14/10/2026
│       │   ├── api.js            ← fetch() bersama + penanganan error
│       │   ├── common.js         ← tema, modal, toast, escapeHTML, profil tim
│       │   ├── inspector.js      ← scanner beranda (tetap lokal di browser)
│       │   ├── leaderboard.js    ← render papan peringkat                        --- MIGRASI KE SERVER OK 16/11/2026
│       │   ├── game.js           ← lab simulasi                                  --- MIGRASI KE SERVER OK 16/11/2026
│       │   ├── result.js         ← halaman hasil + feedback                      --- MIGRASI KE SERVER OK 16/11/2026
│       │   └── admin.js          ← menu maintainer                               --- MIGRASI KE SERVER OK 16/11/2026
│       └── images/                     --- OK 13/10/2026
│
├── backend/                                                                     --- OK 18/11/2026 (server jalan)
│   ├── wsgi.py                   ← titik masuk gunicorn                          --- OK 18/11/2026
│   ├── requirements.txt                                                          --- OK 18/11/2026
│   └── app/
│       ├── __init__.py           ← create_app(), daftar blueprint, security headers  --- OK 18/11/2026
│       ├── config.py             ← baca .env, path data                          --- OK 18/11/2026
│       ├── db.py                 ← koneksi SQLite                                --- OK 18/11/2026
│       ├── common/                                                               --- OK 18/11/2026
│       │   ├── responses.py      ← format JSON sukses/error yang seragam         --- OK 18/11/2026
│       │   └── sanitize.py       ← sensor_nama(), sanitasi_teks_csv()            --- OK 18/11/2026
│       ├── simulation/                                                          --- OK 16/11/2026 (dipakai game.js)
│       │   ├── routes.py         ← /api/session/*                                --- OK 16/11/2026
│       │   ├── service.py        ← state sesi, nilai keputusan, hint             --- OK 16/11/2026
│       │   ├── scenario.py       ← baca & acak skenario.json                     --- OK 16/11/2026
│       │   └── linux_utils.py    ← sha256sum, file, ls -l pada dummy             --- OK 18/11/2026
│       ├── scoring/                                                              --- OK 18/11/2026
│       │   └── calculator.py     ← nilai(), kategori risiko                      --- OK 18/11/2026
│       ├── leaderboard/                                                          --- OK 18/11/2026
│       │   ├── routes.py                                                         --- OK 18/11/2026
│       │   └── repository.py     ← query SQL scores                              --- OK 18/11/2026
│       ├── feedback/                                                             --- OK 18/11/2026
│       │   ├── routes.py         ← (kosong: feedback lewat /api/session/<sid>/feedback)  --- OK 18/11/2026
│       │   └── repository.py     ← query SQL feedback                            --- OK 18/11/2026
│       └── admin/
│           ├── routes.py         ← login password, lihat feedback, unduh CSV, reset data  --- OK 16/11/2026
│           └── export.py         ← SQL → CSV                                     --- OK 18/11/2026
│
├── core/                         ← (TAMBAHAN, tidak ada di rencana awal)         --- OK 18/11/2026
│   ├── admin_auth.py             ← password admin, penundaan login, sesi admin   --- OK 18/11/2026
│   ├── admin_data.py             ← baca / export / kosongkan CSV (app.py)        --- OK 18/11/2026
│   ├── algorithms.py             ← skenario, skor, sensor nama, CSV (app.py)     --- OK 18/11/2026
│   ├── atur_password_cadangan.py ← skrip isi ADMIN_RECOVERY_HASH ke .env         --- OK 18/11/2026
│   ├── env.py                    ← pemuat .env untuk app.py                      --- OK 18/11/2026
│   ├── proxy.py                  ← ProxyFix (PROXY_COUNT)                        --- OK 18/11/2026
│   └── linux_utils.py            ← sha256sum / file / ls -l (app.py)             --- OK 18/11/2026
│
├── app.py                        ← (TAMBAHAN) server versi CSV, dipakai sekarang --- OK 18/11/2026
│
├── database/
│   └── schema.sql                                                               --- BELUM ADA (pakai SKEMA_BAWAAN di db.py)
│
├── data/                         ← TIDAK pernah disajikan ke browser
│   ├── scenarios/skenario.json   ← sekarang di data/skenario.json                --- OK 18/11/2026 (beda lokasi)
│   ├── dummy_files/              ← 18 file dummy                                 --- OK 18/11/2026
│   ├── filemate.db               ← dibuat otomatis oleh db.init_db()             --- OK 18/11/2026
│   └── exports/
│       ├── hasil.csv             ← sekarang di data/hasil.csv                    --- OK 18/11/2026 (beda lokasi)
│       └── feedback_user.csv     ← sekarang di data/feedback_user.csv            --- OK 18/11/2026 (beda lokasi)
│
├── scripts/                                                                     --- BELUM ADA
│   ├── init_db.py                ← belum perlu: tabel dibuat otomatis oleh db.py --- DIGANTIKAN db.init_db()
│   ├── buat_dummy.py             ← sekarang di data/buat_dummy.py                --- OK 18/11/2026 (beda lokasi)
│   └── export_csv.py             ← belum perlu: export lewat menu admin          --- DIGANTIKAN /api/admin/export/<jenis>
│
├── tests/                                                                       --- SEBAGIAN
│   ├── test_linux_utils.py       ← (TAMBAHAN) ada, tetapi GAGAL (lihat catatan)  --- PERLU DIPERBAIKI
│   ├── test_scoring.py                                                           --- BELUM ADA
│   ├── test_sanitize.py                                                          --- BELUM ADA
│   ├── test_scenario.py                                                          --- BELUM ADA
│   └── test_api.py                                                               --- BELUM ADA
│
└── deployment/                                                                  --- BELUM ADA
    ├── nginx.conf                ← panduan ada di docs/NGINX_KEAMANAN_ADMIN.md   --- BELUM ADA (file config)
    └── filemate.service          ← systemd (Docker opsional nanti)               --- BELUM ADA


=====================================================
CATATAN MIGRASI JS -> SERVER
=====================================================

[1] game.js (Lab Simulasi) --- MIGRASI KE SERVER OK 16/11/2026

    Tujuan: game.js hanya berisi logika tampilan + request ke server.
    Kunci jawaban, penilaian, dan skor tidak lagi ada di browser,
    sehingga tidak bisa dicontek / dimanipulasi lewat DevTools.

    Sebelum : soal + kunci jawaban (isMalware) diambil dari SCENARIO_BANK
              di scenario_data.js, benar/salah & skor dihitung di game.js,
              hasil disimpan ke localStorage.
    Sesudah : semua dinilai server.

    Endpoint yang dipakai game.js:
      POST /api/session/start          -> 3 skenario acak TANPA kunci jawaban
      POST /api/session/<sid>/decide   -> nilai 1 keputusan buka/hapus + skor berjalan;
                                          jika 1 kasus selesai, kirim ending & pembahasan
      POST /api/session/<sid>/hint     -> teks hint (penalti -5, dihitung 1x per kasus)
      POST /api/session/<sid>/finish   -> skor akhir, kesalahan per jenis, riwayat
      (endpoint untuk result.js: lihat catatan [2])

    Data yang hanya ada di server (dihapus dari respons ke browser):
      isMalware, payloadStatus, hintText, goodEnding, badEnding,
      lessonTitle, lessonBody, realLifeTip

    File yang diubah:
      tampilan/js/game.js                  ← ditulis ulang: UI + fetch ke /api/session/*
      tampilan/css/style.css               ← tambah .ext-neutral (warna X-Ray netral)
      backend/app/simulation/service.py    ← skor berjalan, ending per kasus, kesalahan
                                             per jenis, riwayat, IMPULSIVE, simpan_hasil()
      backend/app/simulation/scenario.py   ← payloadStatus & pembahasan ikut disembunyikan
      backend/app/simulation/routes.py     ← tambah /save; /finish tidak langsung simpan;
                                             rute lama GET /api/start-session DIHAPUS
                                             (mengirim kunci jawaban)
      app.py                               ← endpoint /api/session/* yang sama (memakai
                                             service.py dari backend/); skor disimpan ke
                                             hasil.csv; GET /api/start-session DIHAPUS

    Catatan:
      - Lab simulasi sekarang WAJIB lewat server (python app.py atau
        python backend/wsgi.py). Dibuka langsung dari file -> muncul pesan error.
      - SCENARIO_BANK di scenario_data.js sudah DIHAPUS (lihat catatan [4]).
      - Hasil Pemindaian Isi (payloadStatus) di X-Ray baru terlihat setelah
        pemain mengambil keputusan.

    Lanjutan:
      [x] result.js     -> lihat catatan [2] di bawah (OK 16/11/2026)
      [x] leaderboard.js-> lihat catatan [3] di bawah (OK 16/11/2026)
      [x] admin.js      -> lihat catatan [5] di bawah (OK 16/11/2026)
      [x] scenario_data.js -> lihat catatan [4] di bawah (OK 16/11/2026)


[2] result.js (Halaman Hasil) --- MIGRASI KE SERVER OK 16/11/2026

    Tujuan: result.js hanya menampilkan hasil dari server & mengirim
    nama / pesan feedback. Skor tidak bisa lagi diubah lewat localStorage.

    Sebelum : skor, kesalahan & riwayat dibaca dari localStorage (ditulis game.js),
              kategori risiko dihitung di browser, skor disimpan ke leaderboard
              localStorage, feedback disimpan ke localStorage (skor & inisial
              bisa dipalsukan).
    Sesudah : browser hanya menyimpan session id ('filemate_session_id').

    Endpoint yang dipakai result.js:
      GET  /api/session/<sid>/result     -> skor, kategori risiko, kesalahan per jenis,
                                            riwayat, status sudah disimpan / belum
      POST /api/session/<sid>/save       {username} -> simpan 1x ke leaderboard;
                                            skor dari server, nama disensor server (R****T)
      POST /api/session/<sid>/feedback   {message}  -> simpan 1x; inisial & skor
                                            diambil dari sesi di server, bukan dari browser

    Perlindungan:
      - Skor di body request diabaikan; yang disimpan selalu skor hasil /finish.
      - Simpan skor & kirim feedback hanya bisa 1x per sesi (berikutnya 409).
      - Hasil sesi kedaluwarsa setelah 1 jam (SESSION_TTL_DETIK).
      - Pesan feedback disanitasi (anti-XSS & anti-CSV Injection).

    File yang diubah:
      tampilan/js/result.js                ← ditulis ulang: UI + fetch ke /api/session/<sid>/*
      tampilan/js/game.js                  ← hanya menyimpan session id (skor tidak lagi
                                             ditulis ke localStorage)
      backend/app/simulation/service.py    ← ambil_hasil(), simpan_hasil() 1x,
                                             ambil_data_feedback() 1x
      backend/app/simulation/routes.py     ← tambah GET /result & POST /feedback
      app.py                               ← endpoint yang sama (CSV: hasil.csv &
                                             feedback_user.csv)

    Catatan:
      - Skor & feedback sekarang masuk ke server (hasil.csv / feedback_user.csv untuk
        app.py, tabel scores / feedback di filemate.db untuk backend/).
      - Papan peringkat beranda sudah membaca server (lihat catatan [3]).
        Menu Satgas juga sudah membaca server (lihat catatan [5]).


[3] leaderboard.js (Papan Peringkat Beranda) --- MIGRASI KE SERVER OK 16/11/2026

    Tujuan: leaderboard.js hanya merender data dari server. Tidak ada lagi
    penyimpanan / pengurutan skor di browser, jadi papan peringkat tidak bisa
    dipalsukan lewat localStorage dan sama untuk semua pengunjung.

    Sebelum : daftar skor disimpan di localStorage ('filemate_leaderboard'),
              getLeaderboard() / saveLeaderboard() dipakai result.js, sehingga tiap
              browser punya leaderboard sendiri & isinya bisa diubah pengguna.
    Sesudah : GET /api/leaderboard?limit=6
              - app.py   -> baca_leaderboard() dari data/hasil.csv
              - backend/ -> leaderboard/repository.py top_skor() dari tabel scores
              Urutan (skor tertinggi, lalu waktu tercepat) ditentukan server.
              Skor hanya bisa masuk lewat POST /api/session/<sid>/save (result.js).

    File yang diubah:
      tampilan/js/leaderboard.js  ← ditulis ulang: render dari GET /api/leaderboard;
                                    getLeaderboard(), saveLeaderboard(),
                                    DEFAULT_LEADERBOARD DIHAPUS; key lama
                                    'filemate_leaderboard' dibersihkan otomatis
      tampilan/js/dashboard.js    ← cadangan offline tidak lagi membaca leaderboard
                                    localStorage (sesi & rata-rata skor hanya dari server)
      page/result.html            ← script leaderboard.js dilepas (tidak dipakai result.js)
      (backend tidak perlu diubah: endpoint /api/leaderboard sudah ada di kedua server)

    Catatan:
      - Tampilan: "Memuat papan peringkat...", "Belum ada skor...", atau pesan
        "tidak dapat dimuat" bila server tidak berjalan.
      - Tombol "Reset Leaderboard" di menu Satgas sekarang mengosongkan data
        di server (lihat catatan [5]).


[4] scenario_data.js (Hapus SCENARIO_BANK) --- OK 16/11/2026

    Tujuan: kunci jawaban simulasi tidak lagi terkirim ke browser sama sekali.
    Sebelumnya, walau game.js sudah dinilai server, scenario_data.js masih dimuat
    di semua halaman & berisi isMalware, payloadStatus, hint, dan ending,
    sehingga jawaban masih bisa diintip lewat View Source / DevTools.

    Sebelum : scenario_data.js = SATGAS_TEAM + SCENARIO_BANK (bank soal lengkap
              dengan kunci jawaban). dashboard.js memakai SCENARIO_BANK sebagai
              cadangan statistik saat server mati.
    Sesudah : scenario_data.js hanya berisi SATGAS_TEAM (profil tim).
              Satu-satunya sumber soal = data/skenario.json di server
              (isinya sudah dicek identik dengan SCENARIO_BANK sebelum dihapus).

    File yang diubah:
      tampilan/js/scenario_data.js  ← SCENARIO_BANK DIHAPUS (132 -> 42 baris);
                                      SATGAS_TEAM tetap
      tampilan/js/dashboard.js      ← hitungStatistikLokal() DIHAPUS; semua angka
                                      dari GET /api/dashboard-stats; server mati -> "–"

    Catatan:
      - Hasil pencarian isMalware / payloadStatus / hintText / ending di folder
        page/ & tampilan/: tidak ada lagi (hanya tersisa di komentar).
      - Kalau mau menambah / mengubah soal, edit data/skenario.json saja.


[5] admin.js (Menu Satgas) --- MIGRASI KE SERVER OK 16/11/2026

    Tujuan: menu Satgas melihat & mengelola data ASLI di server, dan semua
    endpoint data admin hanya bisa dipakai setelah login.

    Sebelum : login sudah ke server, tetapi daftar masukan, Reset Leaderboard,
              Reset Masukan, dan Unduh CSV masih membaca/menghapus localStorage
              (admin tidak melihat data server; reset tidak menghapus apa-apa di server).
    Sesudah : semua tombol memakai server + cookie sesi admin.

    Endpoint (WAJIB login, tanpa login -> 401):
      GET  /api/admin/feedback?limit=      -> daftar masukan (terbaru di atas)
      GET  /api/admin/export/feedback      -> unduh CSV masukan (juga /export/scores)
      POST /api/admin/clear/scores         -> kosongkan papan peringkat
      POST /api/admin/clear/feedback       -> kosongkan masukan (nomor mulai lagi P01)
      POST /api/admin/logout               -> tutup sesi admin (tombol "Keluar")
    Catatan: /api/admin/reset sudah dipakai untuk ganti password (lupa password),
    jadi reset DATA memakai /api/admin/clear/<jenis>.

    Keamanan:
      - Login / buat password / reset password berhasil -> cookie sesi is_admin
        (HttpOnly, SameSite=Strict -> tidak bisa dibaca JS & aman dari CSRF).
      - Setiap Ctrl+Shift+L menutup sesi lama -> password selalu diminta ulang.
      - Selama penundaan login (password salah berkali-kali), endpoint data admin
        juga 429 & sesi admin yang sedang aktif dicabut.
      - CSV export disanitasi ulang (anti CSV Injection), pesan ditampilkan
        dengan escapeHTML (anti XSS).

    Endpoint lama yang DIHAPUS (menerima skor dari browser -> bisa dipalsukan):
      POST /api/submit-score     (app.py & backend/)  — sesuai SECURITY.md K-03
      POST /api/submit-feedback  (app.py & backend/)
      POST /api/feedback         (backend/)
      Pengganti: POST /api/session/<sid>/save & /api/session/<sid>/feedback

    File yang diubah:
      tampilan/js/admin.js                ← menu Satgas: fetch ke /api/admin/*; tombol
                                            Keluar; key lama 'filemate_feedbacks' dibersihkan
      app.py                              ← SECRET_KEY + cookie sesi admin; endpoint
                                            feedback/export/clear/logout; endpoint lama dihapus
      core/admin_data.py (BARU)           ← baca / export / kosongkan CSV untuk app.py
      backend/app/admin/routes.py         ← tambah POST /clear/<jenis>
      backend/app/leaderboard/repository.py ← hapus_semua_skor()
      backend/app/feedback/repository.py  ← hapus_semua_feedback()
      backend/app/leaderboard/routes.py   ← /submit-score dihapus
      backend/app/feedback/routes.py      ← /feedback & /submit-feedback dihapus
      backend/app/db.py                   ← CSV lama hanya diimpor SEKALI (tabel meta),
                                            agar data yang sudah di-reset admin tidak
                                            muncul lagi setelah server restart

    Catatan:
      - Tanpa SECRET_KEY di .env, kunci sesi dibuat acak tiap server start
        (admin perlu login ulang setelah server restart — aman, hanya kurang praktis).


=====================================================
STATUS MIGRASI JS -> SERVER: SELESAI (16/11/2026)
=====================================================
    Semua data & logika penilaian ada di server. File JS di tampilan/js/ hanya
    berisi logika tampilan + request ke server. Yang tetap di browser (sengaja):
      - inspector.js  : scanner file beranda (privasi: file tidak diunggah)
      - common.js     : tema terang/gelap ('filemate_theme' di localStorage)
      - scenario_data.js : SATGAS_TEAM (profil tim, bukan data rahasia)
      - localStorage 'filemate_session_id' : hanya ID sesi (bukan skor)

=====================================================
KEAMANAN LOGIN ADMIN — PERBAIKAN BERTAHAP
=====================================================
[1] Password cadangan dipindah ke .env --- SELESAI 18/11/2026
    Masalah: hash SHA-256 password cadangan tertulis di core/admin_auth.py
    (ikut ter-commit ke git). Hash itu bisa ditebak offline tanpa batas
    percobaan, dan password lamanya pernah tertulis di chat.

    Perubahan:
      core/env.py (BARU)                    ← pemuat .env untuk app.py (root)
      core/atur_password_cadangan.py (BARU) ← skrip: python -m core.atur_password_cadangan
                                              (input tersembunyi + konfirmasi, min. 12
                                              karakter; simpan SHA-256 ke .env; tambah
                                              SECRET_KEY acak jika belum ada)
      core/admin_auth.py                    ← hash bawaan DIHAPUS; dibaca dari
                                              ADMIN_RECOVERY_HASH di .env. Belum diatur
                                              -> /api/admin/recovery & /reset jawab 503.
                                              /api/admin/status kini punya has_recovery.
      .env.example (BARU)                   ← contoh isi .env (tanpa rahasia)
      .gitignore                            ← tambah .env

    Akibat: password cadangan lama TIDAK berlaku lagi (di kedua server).
    Hash lama masih ada di riwayat git, tetapi sudah tidak diterima.

[2] ProxyFix --- SELESAI 18/11/2026
      core/proxy.py (BARU)        ← pasang ProxyFix jika PROXY_COUNT di .env > 0
                                    (kosong = mati, WAJIB kosong saat jalan di laptop)
      app.py, backend/app/__init__.py ← memanggil pasang_proxy_fix(app)
    request.remote_addr kini berisi IP asli di balik Nginx/Cloudflare
    (SECURITY.md K-05). Header X-Forwarded-For palsu dari pengunjung diabaikan.

[3] Batas per IP + hitungan berkurang otomatis --- SELESAI 18/11/2026
      core/admin_auth.py (ditulis ulang bagian penundaan)
    - Per IP  : salah ke-5/15/25 -> tunda 30 dtk / 5 mnt / 1 jam;
                ke-35 -> IP itu wajib password cadangan. IP lain tidak terganggu.
    - Global  : total salah dari semua IP ke-50 -> tunda 5 mnt, ke-100 -> 1 jam,
                ke-150 -> login ditutup untuk semua (wajib password cadangan).
    - Hitungan kembali 0 setelah 24 jam tanpa salah (kecuali yang sudah
      mencapai batas "wajib password cadangan").
    - Login berhasil -> hitungan IP itu dihapus. Reset lewat password
      cadangan -> semua hitungan dihapus.
    - Selama tunda, /api/admin/* menjawab 429 untuk IP yang ditunda saja
      (atau untuk semua jika tunda global).
    - Gagal login dicatat ke log: "Login admin gagal: ip=... salah_ip=..."

[4] Batas password cadangan di file + sesi admin kedaluwarsa --- SELESAI 18/11/2026
    - Password cadangan salah: 5x / 5 mnt per IP + 20x / 24 jam total,
      disimpan di data/admin_lock.json (tidak hilang saat restart).
    - Sesi admin berakhir setelah 30 menit tidak aktif atau 8 jam sejak
      login (dicek di server + cookie ber-Expires). admin.js otomatis
      kembali ke form login (401).
    - app.py: MAX_CONTENT_LENGTH 16 KB (sama dengan backend/).

[5] Nginx limit_req --- PANDUAN DIBUAT 18/11/2026 (dikerjakan Yazid di server)
      docs/NGINX_KEAMANAN_ADMIN.md (BARU) ← real_ip Cloudflare, X-Forwarded-For,
                                            limit_req, PROXY_COUNT, firewall, cara uji
      core/PANDUAN_YAZID.txt              ← ditambah rujukan ke panduan di atas





=====================================================
PROGRESS BACKEND (di luar tampilan/ & frontend) — dicek 18/11/2026
=====================================================
Cara cek: kode dibaca per file + uji cepat kedua server dengan Flask test client
(POST /api/session/start -> 201, GET /api/leaderboard & /api/dashboard-stats -> 200).

[A] SUDAH SELESAI
    Server
      - app.py (root, penyimpanan CSV)    : server yang dipakai sekarang. Semua endpoint
                                            /api/session/*, /api/leaderboard, /api/dashboard-stats,
                                            /api/inspect, /api/hash, /api/admin/* jalan.
      - backend/ (Flask + SQLite)         : create_app(), 4 blueprint (simulation, leaderboard,
                                            feedback, admin), security headers, ProxyFix.
                                            20 endpoint /api terdaftar & bisa dijalankan.
      - backend/wsgi.py                   : python backend/wsgi.py / gunicorn (1 worker).
      - backend/requirements.txt          : Flask 3.x, gunicorn (non-Windows).
    Logika
      - simulation/ : sesi, skor berjalan, hint, ending, hasil, simpan 1x, feedback 1x
      - scoring/calculator.py : skor awal 100; -15 malware dibuka, -5 salah hapus,
                                -5 hint; kategori <=50 TINGGI / 51-80 SEDANG / >80 RENDAH
      - common/ : format JSON seragam, sensor_nama (R****T), anti-XSS & anti-CSV Injection
      - leaderboard/ & feedback/ repository : query SQL + hapus semua (reset admin)
      - admin/export.py : SQL -> CSV, tiap sel disanitasi ulang
      - db.py : tabel scores, feedback, meta dibuat otomatis; CSV lama diimpor 1x
    Keamanan login admin (core/admin_auth.py) : lihat bagian "KEAMANAN LOGIN ADMIN" [1]-[4]
    Data
      - data/skenario.json : 3 kategori skenario (satu-satunya sumber soal)
      - data/dummy_files/  : 18 file dummy aman untuk sha256sum / file / ls -l
      - data/buat_dummy.py : pembuat file dummy (tugas Rohit)
    Konfigurasi
      - .env.example : ADMIN_RECOVERY_HASH, SECRET_KEY, COOKIE_SECURE, PROXY_COUNT
      - docs/NGINX_KEAMANAN_ADMIN.md : panduan Nginx untuk Yazid

[B] SEBAGIAN / PERLU DIPERBAIKI
    1. tests/test_linux_utils.py GAGAL dijalankan
       (python -m unittest tests.test_linux_utils -> 18 tes: 1 failure, 22 error).
       Penyebab: tes memanggil core.linux_utils._is_linux, padahal fungsi itu tidak ada
       di core/linux_utils.py versi sekarang. Tes & kode perlu disamakan lagi.
    2. app.py masih punya POST /api/submit-score & /api/submit-feedback
       (ditambahkan lagi di merge fa40158 untuk result.js Fardan). Ini BERTENTANGAN
       dengan catatan migrasi [5] & SECURITY.md K-03 (skor dari browser bisa
       dipalsukan). Sudah dibatasi: skor 0-100 kelipatan 5, kategori dihitung server,
       maks. 5 kiriman / IP / 10 menit. Hapus lagi setelah result.js memakai
       /api/session/<sid>/save & /feedback.
    3. .gitignore belum memuat *.db, __pycache__/, data/exports/*.
       Akibatnya __pycache__/ & core/__pycache__/ & tests/__pycache__/ ikut ter-commit.
    4. Dua server berjalan paralel (app.py = CSV, backend/ = SQLite). Data keduanya
       TIDAK sinkron. Perlu diputuskan mana yang dipakai saat deploy.

[C] BELUM DIKERJAKAN
    - README.md, CHANGELOG.md
    - database/schema.sql      (sementara skema ada di SKEMA_BAWAAN, backend/app/db.py)
    - scripts/                 (init_db.py & export_csv.py sudah digantikan otomatis;
                                buat_dummy.py ada di data/)
    - tests/test_scoring.py, test_sanitize.py, test_scenario.py, test_api.py
    - deployment/nginx.conf, deployment/filemate.service

[D] BEDA DENGAN RENCANA (sengaja, tidak perlu diubah kecuali mau dirapikan)
    - Ada folder core/ & app.py di root (tidak ada di rencana awal).
    - skenario.json, hasil.csv, feedback_user.csv ada langsung di data/,
      bukan di data/scenarios/ & data/exports/.
    - buat_dummy.py ada di data/, bukan di scripts/.
    - .env.example berisi ADMIN_RECOVERY_HASH (bukan ADMIN_PIN).
