/* =========================================================
   FILEMATE DASHBOARD.JS — Statistik ikhtisar & demo hero
   (dashboard.html)
   ========================================================= */

// Semua statistik diambil dari backend Flask (/api/dashboard-stats):
// jumlah skenario/file/jebakan dari data/skenario.json, sesi & rata-rata skor dari data skor.
// Jika backend tidak aktif, angka ditampilkan "–" (tidak ada lagi data soal di browser).
function tampilkanStatistik(st) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    if (!st) {
        ['statSkenario', 'statFile', 'statMalware', 'statAman', 'statSesi', 'statRataSkor'].forEach(id => set(id, '–'));
        return;
    }
    set('statSkenario', st.total_skenario);
    set('statFile', st.total_file);
    set('statMalware', st.total_malware);
    set('statAman', st.total_aman);
    set('statSesi', st.total_sesi);
    set('statRataSkor', st.total_sesi ? st.rata_rata_skor : '–');
}

async function renderDashboardStats() {
    if (!document.getElementById('dashStats')) return;
    try {
        tampilkanStatistik(await apiGet('/dashboard-stats'));
    } catch (e) {
        tampilkanStatistik(null); // Backend offline: data hanya tersedia di server
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
