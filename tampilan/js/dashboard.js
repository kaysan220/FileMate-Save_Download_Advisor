/* =========================================================
   FILEMATE DASHBOARD.JS — Statistik ikhtisar & demo hero
   (dashboard.html)
   ========================================================= */

// Statistik diambil dari backend Flask (/api/dashboard-stats).
// Jika backend tidak aktif (file dibuka langsung), dihitung dari SCENARIO_BANK & localStorage.
function hitungStatistikLokal() {
    let totalSkenario = 0, totalFile = 0, totalMalware = 0;
    if (typeof SCENARIO_BANK !== 'undefined') {
        Object.values(SCENARIO_BANK).forEach(daftar => {
            totalSkenario += daftar.length;
            daftar.forEach(s => {
                totalFile += s.files.length;
                totalMalware += s.files.filter(f => f.isMalware).length;
            });
        });
    }
    let lb = [];
    try { lb = JSON.parse(localStorage.getItem('filemate_leaderboard') || '[]'); } catch (e) { lb = []; }
    const skor = lb.map(r => Number(r.score)).filter(n => !isNaN(n));
    return {
        total_skenario: totalSkenario,
        total_file: totalFile,
        total_malware: totalMalware,
        total_aman: totalFile - totalMalware,
        total_sesi: skor.length,
        rata_rata_skor: skor.length ? Math.round(skor.reduce((a, b) => a + b, 0) / skor.length) : 0
    };
}

function tampilkanStatistik(st) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('statSkenario', st.total_skenario);
    set('statFile', st.total_file);
    set('statMalware', st.total_malware);
    set('statAman', st.total_aman);
    set('statSesi', st.total_sesi);
    set('statRataSkor', st.total_sesi ? st.rata_rata_skor : '–');
}

async function renderDashboardStats() {
    if (!document.getElementById('dashStats')) return;
    tampilkanStatistik(hitungStatistikLokal());
    try {
        tampilkanStatistik(await apiGet('/dashboard-stats'));
    } catch (e) {
        // Backend offline: tetap memakai statistik lokal.
    }
}

// Demo hero: memperlihatkan bahwa nama file bisa menipu
function initHeroReveal() {
    const card = document.getElementById('heroDemo');
    if (!card) return;
    const btn = document.getElementById('heroDemoBtn');
    let revealed = false;
    let autoTimer = null;

    const render = () => {
        card.classList.toggle('revealed', revealed);
        document.getElementById('heroDemoName').innerHTML = revealed
            ? `Kontrak_Magang<span class="ext-badge ext-fake">.pdf</span><span class="ext-badge ext-danger">.exe</span>`
            : `Kontrak_Magang<span class="ext-badge ext-safe">.pdf</span>`;
        document.getElementById('heroDemoMagic').textContent = revealed ? '4D 5A (MZ) · Program Windows' : '?? ?? ?? ??';
        document.getElementById('heroDemoPerm').textContent = revealed ? '-rwxr-xr-x' : '-rw-r--r-- ?';
        document.getElementById('heroDemoVerdict').innerHTML = revealed
            ? `<span style="color: var(--danger); font-weight: 700;">🚨 Bukan PDF. Ini program yang menyamar.</span>`
            : `<span style="color: var(--text-muted);">Terlihat seperti dokumen biasa…</span>`;
        if (btn) btn.textContent = revealed ? '↺ Lihat Lagi' : '🔍 X-Ray File Ini';
    };

    const toggle = () => { revealed = !revealed; render(); };
    if (btn) btn.addEventListener('click', () => { clearInterval(autoTimer); toggle(); });
    render();

    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduceMotion) autoTimer = setInterval(toggle, 3500);
}

document.addEventListener('DOMContentLoaded', () => {
    renderDashboardStats();
    initHeroReveal();
});
