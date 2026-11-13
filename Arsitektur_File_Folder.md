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
├── docs/
│   ├── ARCHITECTURE.md           ← gambaran sistem, alur, struktur folder
│   ├── API_CONTRACT.md           ← semua endpoint + contoh JSON
│   ├── DATA_SCHEMA.md            ← skenario.json + tabel SQL
│   ├── SECURITY.md               ← kontrol keamanan (bahan sidang DKS)
│   └── TESTING.md                ← cara tes + checklist user testing
│
├── frontend/
│   ├── pages/
│   │   ├── index.html
│   │   ├── play.html
│   │   ├── result.html
│   │   └── guide.html
│   └── assets/
│       ├── css/
│       │   ├── base.css          ← variabel tema, reset, tipografi
│       │   ├── components.css    ← tombol, panel, modal, toast, form
│       │   └── pages.css         ← gaya khusus tiap halaman
│       ├── js/
│       │   ├── api.js            ← fetch() bersama + penanganan error
│       │   ├── common.js         ← tema, modal, toast, escapeHTML, profil tim
│       │   ├── inspector.js      ← scanner beranda (tetap lokal di browser)
│       │   ├── leaderboard.js    ← render papan peringkat
│       │   ├── game.js           ← lab simulasi
│       │   ├── result.js         ← halaman hasil + feedback
│       │   └── admin.js          ← menu maintainer
│       └── images/
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
│       ├── simulation/
│       │   ├── routes.py         ← /api/session/*
│       │   ├── service.py        ← state sesi, nilai keputusan, hint
│       │   ├── scenario.py       ← baca & acak skenario.json
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
│           ├── routes.py         ← login PIN, lihat feedback, unduh CSV
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