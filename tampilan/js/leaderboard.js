/* =========================================================
   FILEMATE LEADERBOARD.JS — Data & render papan peringkat
   Dipakai oleh index.html (render) dan result.html (simpan skor).
   ========================================================= */

// === [AWAL ZONA MIGRASI BACKEND 2 - TUGAS KAYSAN & YAZID] ===
// Papan peringkat awalnya kosong; baru terisi setelah ada peserta yang menyimpan skor.
const DEFAULT_LEADERBOARD = [];

function getLeaderboard() {
    try {
        return JSON.parse(localStorage.getItem('filemate_leaderboard') || JSON.stringify(DEFAULT_LEADERBOARD));
    } catch (e) {
        return [...DEFAULT_LEADERBOARD];
    }
}

function saveLeaderboard(lb) {
    localStorage.setItem('filemate_leaderboard', JSON.stringify(lb));
}
// === [AKHIR ZONA MIGRASI BACKEND 2] ===

// RENDER LEADERBOARD BERANDA (index.html)
function renderHomeLeaderboard() {
    const container = document.getElementById('homeLeaderboardList');
    if (!container) return;

    const lb = getLeaderboard();

    container.innerHTML = '';
    if (!lb.length) {
        container.innerHTML = `
            <div style="padding: 14px; text-align: center; background: var(--bg-subtle); border-radius: 8px; border: 1px dashed var(--border-color); font-size: 0.85rem; color: var(--text-muted);">
                Belum ada skor. Jadilah yang pertama!
            </div>
        `;
        return;
    }
    lb.slice(0, 6).forEach((item, idx) => {
        const safeScore = Number(item.score) || 0;
        const scoreColor = safeScore > 80 ? 'var(--safe)' : (safeScore > 50 ? 'var(--warning)' : 'var(--danger)');
        container.innerHTML += `
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
    });
}

document.addEventListener('DOMContentLoaded', renderHomeLeaderboard);
