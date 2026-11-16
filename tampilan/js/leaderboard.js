/* =========================================================
   FILEMATE LEADERBOARD.JS — Render papan peringkat (index.html)
   Membutuhkan: common.js (escapeHTML), api.js (apiGet)

   SUDAH DIMIGRASI KE SERVER:
   - Data diambil dari GET /api/leaderboard?limit=6
     (app.py -> data/hasil.csv, backend/ -> tabel scores di SQLite)
   - Urutan peringkat ditentukan server (skor tertinggi, lalu waktu tercepat)
   - Skor masuk ke leaderboard hanya lewat result.js -> POST /api/session/<sid>/save
   File ini hanya berisi logika tampilan + request ke server.
   ========================================================= */

const LEADERBOARD_LIMIT = 6;

function leaderboardMessage(text, dashed = true) {
    return `
        <div style="padding: 14px; text-align: center; background: var(--bg-subtle); border-radius: 8px; border: 1px ${dashed ? 'dashed' : 'solid'} var(--border-color); font-size: 0.85rem; color: var(--text-muted);">
            ${text}
        </div>
    `;
}

// RENDER LEADERBOARD BERANDA (index.html)
async function renderHomeLeaderboard() {
    const container = document.getElementById('homeLeaderboardList');
    if (!container) return;

    container.innerHTML = leaderboardMessage('Memuat papan peringkat...', false);

    let lb;
    try {
        lb = await apiGet(`/leaderboard?limit=${LEADERBOARD_LIMIT}`);
    } catch (e) {
        container.innerHTML = leaderboardMessage('Papan peringkat tidak dapat dimuat. Pastikan server Python sudah berjalan.');
        return;
    }

    if (!Array.isArray(lb) || !lb.length) {
        container.innerHTML = leaderboardMessage('Belum ada skor. Jadilah yang pertama!');
        return;
    }

    container.innerHTML = lb.slice(0, LEADERBOARD_LIMIT).map((item, idx) => {
        const safeScore = Number(item.score) || 0;
        const scoreColor = safeScore > 80 ? 'var(--safe)' : (safeScore > 50 ? 'var(--warning)' : 'var(--danger)');
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: var(--bg-subtle); border-radius: 8px; border: 1px solid var(--border-color); font-size: 0.88rem;">
                <div>
                    <strong style="color: var(--accent); margin-right: 8px;">#${idx + 1}</strong>
                    <strong class="mono">${escapeHTML(item.name)}</strong>
                </div>
                <div>
                    <strong style="color: ${scoreColor};">${safeScore} Pts</strong>
                    <small class="mono" style="color: var(--text-muted); margin-left: 6px;">(${escapeHTML(item.time)})</small>
                </div>
            </div>
        `;
    }).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    // Sisa data versi lama (leaderboard di localStorage) tidak dipakai lagi
    try { localStorage.removeItem('filemate_leaderboard'); } catch (e) { /* storage diblokir */ }
    renderHomeLeaderboard();
});
