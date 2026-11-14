/* =========================================================
   FILEMATE ADMIN.JS — Menu Maintainer Tim Satgas
   =========================================================
   AKSES RAHASIA TIM SATGAS (MURNI CTRL + SHIFT + L)
   PIN Rahasia Tim: katakbijer
   Menampilkan 3 Tombol Terpisah:
     1. Reset Leaderboard
     2. Reset Masukan
     3. Unduh CSV Feedback
   ========================================================= */
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

    document.getElementById('modalTitle').innerHTML = `🔒 Akses Maintainer Tim Satgas`;
    document.getElementById('modalContent').innerHTML = `
        <p style="font-size: 0.86rem; color: var(--text-secondary); margin-bottom: 12px;">
            Masukkan PIN Maintainer untuk melihat rekapitulasi masukan pengguna dan manajemen data demo.
        </p>
        <div>
            <input type="password" id="maintainerPinField" class="pin-input-clean" placeholder="Masukkan PIN Maintainer..." autocomplete="off" onkeydown="if(event.key==='Enter') verifyMaintainerPin()" style="width: 100%; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-subtle); color: var(--text-primary);">
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
    document.getElementById('modalTitle').innerHTML = `🛠️ Menu Satgas — Rekap Masukan (${feedbacks.length})`;

    let listHtml = '';
    if (feedbacks.length === 0) {
        listHtml = `<p style="font-size: 0.88rem; color: var(--text-muted); padding: 12px 0;">Belum ada saran/masukan dari pengguna.</p>`;
    } else {
        feedbacks.forEach((fb, i) => {
            listHtml += `
                <div style="padding: 10px 12px; background: var(--bg-subtle); border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 8px; font-size: 0.85rem;">
                    <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 4px; color: var(--text-muted); font-size: 0.76rem; margin-bottom: 4px;">
                        <span>Responden #${i + 1} (<strong class="mono" style="color: var(--accent);">${escapeHTML(fb.user)}</strong> • Skor: ${Number(fb.score) || 0})</span>
                        <span>${escapeHTML(fb.date)}</span>
                    </div>
                    <div style="color: var(--text-primary); word-break: break-word;">"${escapeHTML(fb.message)}"</div>
                </div>
            `;
        });
    }

    // Tampilkan 3 Tombol Terpisah Secara Permanen
    document.getElementById('modalContent').innerHTML = `
        <p style="font-size: 0.84rem; color: var(--text-secondary); margin-bottom: 12px;">
            Saat Backend Python aktif, seluruh data ini disimpan langsung di server Linux (<code>chmod 600 data/feedback_user.csv</code>).
        </p>
        <div style="max-height: 240px; overflow-y: auto; margin-bottom: 14px; padding-right: 4px;">
            ${listHtml}
        </div>
        <div class="maintainer-footer-actions" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; padding-top: 14px; border-top: 1px solid var(--border-color);">
            <div class="maintainer-reset-group" style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button type="button" class="btn btn-danger btn-sm" onclick="confirmResetLeaderboardOnly()">🗑️ Reset Leaderboard</button>
                <button type="button" class="btn btn-danger btn-sm" onclick="confirmResetFeedbackOnly()">🗑️ Reset Masukan</button>
            </div>
            <button type="button" class="btn btn-primary btn-sm" onclick="exportFeedbackCSV()">📥 Unduh CSV Feedback</button>
        </div>
    `;
    backdrop.classList.add('open');
}

// Tombol 1: Konfirmasi & Eksekusi Reset Leaderboard Saja
function confirmResetLeaderboardOnly() {
    document.getElementById('modalTitle').innerHTML = `⚠️ Konfirmasi Reset Leaderboard`;
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
    showToastNotification(`<strong style="color: var(--safe);">✅ Papan Peringkat berhasil di-reset ke data awal!</strong>`);
}

// Tombol 2: Konfirmasi & Eksekusi Reset Masukan/Feedback Saja
function confirmResetFeedbackOnly() {
    document.getElementById('modalTitle').innerHTML = `⚠️ Konfirmasi Reset Masukan`;
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
    showToastNotification(`<strong style="color: var(--safe);">✅ Daftar saran &amp; masukan berhasil dikosongkan!</strong>`);
}

// Tombol 3: Unduh CSV Feedback
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

document.addEventListener('DOMContentLoaded', initSecretMaintainerTrigger);
