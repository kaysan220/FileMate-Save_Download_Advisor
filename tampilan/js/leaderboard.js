/* =========================================================
   LEADERBOARD.JS — Render Papan Peringkat Anonim (Tactical Roster UI)
   ========================================================= */

async function renderHomeLeaderboard() {
    const container = document.getElementById('homeLeaderboardList');
    if (!container) return;

    const defaultLb = [
        { name: "R****T", score: 95, time: "01:12", risk: "RENDAH" },
        { name: "F****N", score: 90, time: "01:28", risk: "RENDAH" },
        { name: "K****N", score: 85, time: "01:45", risk: "RENDAH" },
        { name: "Y****D", score: 75, time: "02:05", risk: "SEDANG" }
    ];

    let lb = JSON.parse(localStorage.getItem('filemate_leaderboard') || JSON.stringify(defaultLb));
    if (typeof apiFetchJSON === 'function') {
        const remoteLb = await apiFetchJSON('/api/leaderboard');
        if (Array.isArray(remoteLb) && remoteLb.length > 0) {
            lb = remoteLb;
        }
    }

    // Header kolom tabel kecil agar sejajar rapi
    let html = `
        <div style="display: grid; grid-template-columns: 34px 1fr auto; gap: 10px; padding: 0 10px 6px 10px; border-bottom: 1px solid var(--border-color); font-size: 0.68rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">
            <span>Rank</span>
            <span>Agen Satgas</span>
            <span style="text-align: right;">Skor &amp; Waktu</span>
        </div>
    `;

    lb.slice(0, 6).forEach((item, idx) => {
        const rank = idx + 1;
        const safeScore = Number(item.score) || 0;
        const scoreColor = safeScore > 80 ? 'var(--safe)' : (safeScore > 50 ? 'var(--warning)' : 'var(--danger)');
        const riskLabel = item.risk || (safeScore > 80 ? 'RENDAH' : (safeScore > 50 ? 'SEDANG' : 'TINGGI'));

        // Warna medali lencana peringkat 1, 2, 3
        let rankBadgeStyle = `background: var(--bg-main); color: var(--text-muted); border: 1px solid var(--border-color);`;
        let rowBorderStyle = `border: 1px solid var(--border-color);`;

        if (rank === 1) {
            rankBadgeStyle = `background: rgba(251, 191, 36, 0.16); color: #FBBF24; border: 1px solid rgba(251, 191, 36, 0.55);`;
            rowBorderStyle = `border: 1px solid rgba(251, 191, 36, 0.35);`;
        } else if (rank === 2) {
            rankBadgeStyle = `background: rgba(148, 163, 184, 0.18); color: #E2E8F0; border: 1px solid rgba(148, 163, 184, 0.5);`;
        } else if (rank === 3) {
            rankBadgeStyle = `background: rgba(217, 119, 6, 0.16); color: #F59E0B; border: 1px solid rgba(217, 119, 6, 0.45);`;
        }

        html += `
            <div style="display: grid; grid-template-columns: 34px 1fr auto; align-items: center; gap: 10px; padding: 10px 12px; background: var(--bg-subtle); border-radius: 9px; ${rowBorderStyle} transition: transform 0.15s ease;">
                <div class="mono" style="width: 30px; height: 30px; border-radius: 7px; display: flex; align-items: center; justify-content: center; font-size: 0.78rem; font-weight: 800; ${rankBadgeStyle}">
                    #${rank}
                </div>

                <div style="min-width: 0;">
                    <strong class="mono" style="font-size: 0.9rem; color: var(--text-primary); display: block; line-height: 1.2;">
                        ${escapeHTML(item.name)}
                    </strong>
                    <span style="font-size: 0.68rem; color: var(--text-muted); display: inline-flex; align-items: center; gap: 4px; margin-top: 2px;">
                        Risiko: <strong style="color: ${scoreColor};">${escapeHTML(riskLabel)}</strong>
                    </span>
                </div>

                <div style="text-align: right;">
                    <strong class="mono" style="font-size: 0.92rem; color: ${scoreColor}; display: block; line-height: 1.2;">
                        ${safeScore} Pts
                    </strong>
                    <span class="mono" style="font-size: 0.71rem; color: var(--text-muted); display: inline-flex; align-items: center; gap: 3px; margin-top: 2px;">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        ${escapeHTML(item.time)}
                    </span>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', () => {
    renderHomeLeaderboard();
});