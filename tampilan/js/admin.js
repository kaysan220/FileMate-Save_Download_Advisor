/* =========================================================
   ADMIN.JS — Menu Maintainer Tim Satgas (Ctrl + Shift + L) — 0% Emoji
   ========================================================= */

const ADMIN_SVGS = {
    lock: `<svg class="svg-inline" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
    tool: `<svg class="svg-inline" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
    trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
    download: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    alert: `<svg class="svg-inline" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
};

function initSecretMaintainerTrigger() {
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
            e.preventDefault();
            promptMaintainerAccess();
        }
    });
}

function promptMaintainerAccess() {
    const backdrop = document.getElementById('modalBackdrop');
    if (!backdrop) return;

    document.getElementById('modalTitle').innerHTML = `${ADMIN_SVGS.lock} Akses Maintainer Tim Satgas`;
    document.getElementById('modalContent').innerHTML = `
        <p style="font-size: 0.86rem; color: var(--text-secondary); margin-bottom: 12px;">
            Masukkan PIN Maintainer untuk melihat rekapitulasi masukan pengguna dan manajemen data demo.
        </p>
        <div>
            <input type="password" id="maintainerPinField" class="pin-input-clean" placeholder="Masukkan PIN Maintainer..." autocomplete="off" onkeydown="if(event.key==='Enter') verifyMaintainerPin()">
            <div id="pinErrorMsg" style="color: var(--danger); font-size: 0.78rem; margin-top: 6px; min-height: 18px; font-weight: 500;"></div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-color);">
            <button class="btn btn-ghost btn-sm" onclick="closeModal()">Batal</button>
            <button class="btn btn-primary btn-sm" onclick="verifyMaintainerPin()">Verifikasi</button>
        </div>
    `;
    backdrop.classList.add('open');
    setTimeout(() => {
        const input = document.getElementById('maintainerPinField');
        if (input) input.focus();
    }, 60);
}

function verifyMaintainerPin() {
    const input = document.getElementById('maintainerPinField');
    const err = document.getElementById('pinErrorMsg');
    const card = document.getElementById('modalCard');
    if (!input) return;

    if (input.value === "katakbijer") {
        openFeedbackViewer();
    } else {
        if (err) err.textContent = "PIN tidak sesuai. Akses ditolak.";
        if (card) {
            card.classList.remove('shake-error');
            void card.offsetWidth;
            card.classList.add('shake-error');
        }
        input.value = '';
        input.focus();
    }
}

function openFeedbackViewer() {
    const backdrop = document.getElementById('modalBackdrop');
    if (!backdrop) return;

    const feedbacks = JSON.parse(localStorage.getItem('filemate_feedbacks') || '[]');
    document.getElementById('modalTitle').innerHTML = `${ADMIN_SVGS.tool} Menu Satgas — Rekap Masukan (${feedbacks.length})`;

    let listHtml = '';
    if (feedbacks.length === 0) {
        listHtml = `<p style="font-size: 0.88rem; color: var(--text-muted); padding: 12px 0;">Belum ada saran/masukan dari pengguna.</p>`;
    } else {
        feedbacks.forEach((fb, i) => {
            listHtml += `
                <div style="padding: 10px 12px; background: var(--bg-subtle); border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 8px; font-size: 0.85rem;">
                    <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 4px; color: var(--text-muted); font-size: 0.76rem; margin-bottom: 4px;">
                        <span>Responden #${i + 1} (<strong class="mono" style="color: var(--accent);">${escapeHTML(fb.user)}</strong> — Skor: ${Number(fb.score) || 0})</span>
                        <span>${escapeHTML(fb.date)}</span>
                    </div>
                    <div style="color: var(--text-primary); word-break: break-word;">"${escapeHTML(fb.message)}"</div>
                </div>
            `;
        });
    }

    document.getElementById('modalContent').innerHTML = `
        <p style="font-size: 0.84rem; color: var(--text-secondary); margin-bottom: 12px;">
            Saat Backend Python aktif, seluruh data ini disimpan langsung di server Linux (<code>chmod 600 data/feedback_user.csv</code>).
        </p>
        <div style="max-height: 240px; overflow-y: auto; margin-bottom: 14px; padding-right: 4px;">
            ${listHtml}
        </div>
        <div class="maintainer-footer-actions">
            <div class="maintainer-reset-group">
                <button type="button" class="btn btn-danger btn-sm" onclick="confirmResetLeaderboardOnly()">${ADMIN_SVGS.trash} Reset Leaderboard</button>
                <button type="button" class="btn btn-danger btn-sm" onclick="confirmResetFeedbackOnly()">${ADMIN_SVGS.trash} Reset Masukan</button>
            </div>
            <button type="button" class="btn btn-primary btn-sm" onclick="exportFeedbackCSV()">${ADMIN_SVGS.download} Unduh CSV Feedback</button>
        </div>
    `;
    backdrop.classList.add('open');
}

function confirmResetLeaderboardOnly() {
    document.getElementById('modalTitle').innerHTML = `${ADMIN_SVGS.alert} Konfirmasi Reset Leaderboard`;
    document.getElementById('modalContent').innerHTML = `
        <p style="font-size: 0.88rem; color: var(--text-secondary); line-height: 1.55;">
            Apakah kamu yakin ingin mengembalikan <strong>Papan Peringkat (Leaderboard)</strong> ke 4 data awal demo?<br>
            <span style="font-size: 0.8rem; color: var(--text-muted);">(Catatan: Data saran &amp; masukan responden tidak akan ikut terhapus).</span>
        </p>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border-color);">
            <button type="button" class="btn btn-ghost btn-sm" onclick="openFeedbackViewer()">Batal</button>
            <button type="button" class="btn btn-danger btn-sm" onclick="executeResetLeaderboardOnly()">Ya, Reset Leaderboard</button>
        </div>
    `;
}

function executeResetLeaderboardOnly() {
    localStorage.removeItem('filemate_leaderboard');
    if (typeof renderHomeLeaderboard === 'function') renderHomeLeaderboard();
    openFeedbackViewer();
    showToastNotification(`<strong style="color: var(--safe);">Papan Peringkat berhasil di-reset ke data awal.</strong>`);
}

function confirmResetFeedbackOnly() {
    document.getElementById('modalTitle').innerHTML = `${ADMIN_SVGS.alert} Konfirmasi Reset Masukan`;
    document.getElementById('modalContent').innerHTML = `
        <p style="font-size: 0.88rem; color: var(--text-secondary); line-height: 1.55;">
            Apakah kamu yakin ingin menghapus seluruh daftar <strong>Saran &amp; Masukan Responden</strong> di browser ini?<br>
            <span style="font-size: 0.8rem; color: var(--text-muted);">(Catatan: Data skor di Papan Peringkat tidak akan berubah).</span>
        </p>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border-color);">
            <button type="button" class="btn btn-ghost btn-sm" onclick="openFeedbackViewer()">Batal</button>
            <button type="button" class="btn btn-danger btn-sm" onclick="executeResetFeedbackOnly()">Ya, Reset Masukan</button>
        </div>
    `;
}

function executeResetFeedbackOnly() {
    localStorage.removeItem('filemate_feedbacks');
    openFeedbackViewer();
    showToastNotification(`<strong style="color: var(--safe);">Daftar saran &amp; masukan berhasil dikosongkan.</strong>`);
}

function exportFeedbackCSV() {
    const feedbacks = JSON.parse(localStorage.getItem('filemate_feedbacks') || '[]');
    if (!feedbacks.length) {
        showToastNotification(`<strong style="color: var(--warning);">Belum ada data masukan responden untuk diunduh.</strong>`);
        return;
    }
    let csvContent = "Kode_Responden,Inisial_Anonim,Skor,Waktu_Input,Saran_dan_Masukan\n";
    feedbacks.forEach((f, idx) => {
        const code = `P${String(idx + 1).padStart(2, '0')}`;
        let cleanMsg = String(f.message || '').replace(/"/g, '""');
        if (/^[=+\-@]/.test(cleanMsg)) cleanMsg = "'" + cleanMsg;
        csvContent += `${code},${f.user},${f.score},"${f.date}","${cleanMsg}"\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "feedback_user.csv";
    a.click();
}

document.addEventListener('DOMContentLoaded', () => {
    initSecretMaintainerTrigger();
});