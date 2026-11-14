/* =========================================================
   FILEMATE LEADERBOARD.JS — Data & render papan peringkat
   Dipakai oleh index.html (render) dan result.html (simpan skor).
   ========================================================= */

// === [AWAL ZONA MIGRASI BACKEND 2 - TUGAS KAYSAN & YAZID] ===
const DEFAULT_LEADERBOARD = [
    { name: "R****T", score: 95, time: "01:12", risk: "RENDAH" },
    { name: "F****N", score: 90, time: "01:28", risk: "RENDAH" },
    { name: "K****N", score: 85, time: "01:45", risk: "RENDAH" },
    { name: "Y****D", score: 75, time: "02:05", risk: "SEDANG" }
];

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
