Arsitektur file folder yang akan direncakan

=====================================================

Mohon untuk menandai bagian yang sudah fix dikerjakan
Misalnya : README.md --- OK 13/11/2026

=====================================================


FileMate/
├── README.md
├── CHANGELOG.md
├── .env.example                  ← SECRET_KEY, ADMIN_PIN
├── .gitignore                    ← .env, *.db, __pycache__, data/exports/*
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
├── backend/
│   ├── wsgi.py                   ← titik masuk gunicorn
│   ├── requirements.txt
│   └── app/
│       ├── __init__.py           ← create_app(), daftar blueprint, security headers
│       ├── config.py             ← baca .env, path data
│       ├── db.py                 ← koneksi SQLite
│       ├── common/
│       │   ├── responses.py      ← format JSON sukses/error yang seragam
│       │   └── sanitize.py       ← sensor_nama(), sanitasi_teks_csv()
│       ├── simulation/                                                          --- OK 16/11/2026 (dipakai game.js)
│       │   ├── routes.py         ← /api/session/*                                --- OK 16/11/2026
│       │   ├── service.py        ← state sesi, nilai keputusan, hint             --- OK 16/11/2026
│       │   ├── scenario.py       ← baca & acak skenario.json                     --- OK 16/11/2026
│       │   └── linux_utils.py    ← sha256sum, file, ls -l pada dummy
│       ├── scoring/
│       │   └── calculator.py     ← nilai(), kategori risiko
│       ├── leaderboard/
│       │   ├── routes.py
│       │   └── repository.py     ← query SQL scores
│       ├── feedback/
│       │   ├── routes.py
│       │   └── repository.py     ← query SQL feedback
│       └── admin/
│           ├── routes.py         ← login password, lihat feedback, unduh CSV, reset data  --- OK 16/11/2026
│           └── export.py         ← SQL → CSV
│
├── database/
│   └── schema.sql
│
├── data/                         ← TIDAK pernah disajikan ke browser
│   ├── scenarios/skenario.json
│   ├── dummy_files/
│   ├── filemate.db               ← dibuat oleh init_db.py
│   └── exports/
│       ├── hasil.csv
│       └── feedback_user.csv
│
├── scripts/
│   ├── init_db.py
│   ├── buat_dummy.py             ← buat dummy + isi hash asli ke JSON
│   └── export_csv.py
│
├── tests/
│   ├── test_scoring.py
│   ├── test_sanitize.py
│   ├── test_scenario.py
│   └── test_api.py
│
└── deployment/
    ├── nginx.conf
    └── filemate.service          ← systemd (Docker opsional nanti)


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
