/* =========================================================================
   SCENARIO_DATA.JS — Data profil tim (dipakai pop-up "Tim Satgas" di semua halaman)
   - SCENARIO_BANK sudah dipindah ke data/skenario.json di server & dihapus dari sini,
     agar kunci jawaban simulasi tidak bisa diintip lewat View Source / DevTools.
   - Jangan hapus variabel `SATGAS_TEAM` karena dipakai untuk Pop-up Profil Tim!
   - Jangan menaruh kunci jawaban / data penilaian di file ini lagi.
   ========================================================================= */

const SATGAS_TEAM = [
    { 
        name: "Muhammad Fardan", 
        instagram: "@bymfn_", 
        role: "Project Leader & UI/UX Designer", 
        badge: "PROJECT LEAD & FRONTEND", 
        specialty: "Arsitektur antarmuka interaktif, alur pengguna, & konsep Dasar Keamanan Siber (DKS)." 
    },
    { 
        name: "Muhamad Yazid Firdaus", 
        instagram: "@zyffa_", 
        role: "Linux & Infrastructure Specialist", 
        badge: "LINUX & NGINX INFRA", 
        specialty: "Konfigurasi server Nginx, manajemen permission file Linux, & utilitas sistem." 
    },
    { 
        name: "Kaysan Nawfal", 
        instagram: "@kaysan_220", 
        role: "Backend & Logic Developer", 
        badge: "PYTHON & SCORING LOGIC", 
        specialty: "Algoritma perhitungan skor risiko, aturan bobot keputusan, & validasi edge-cases." 
    },
    { 
        name: "Rohit Al Bukhori", 
        instagram: "@rht.alb_", 
        role: "Scenario & Data Handling Developer", 
        badge: "THREAT SCENARIO & DATA", 
        specialty: "Perancangan bank skenario ancaman, pengacakan soal, & panduan keamanan dunia nyata." 
    }
];

// SCENARIO_BANK (bank soal + kunci jawaban) sudah DIHAPUS dari frontend (16/11/2026).
// Satu-satunya sumber soal sekarang data/skenario.json di server, dikirim ke browser
// lewat POST /api/session/start TANPA kunci jawaban (lihat backend/app/simulation/).