/* =========================================================
   FILEMATE COMMON.JS — Utilitas bersama semua halaman
   (tema, modal, toast, escapeHTML, profil tim, navigasi sesi)
   Wajib dimuat PERTAMA sebelum modul JS lainnya.
   ========================================================= */

function escapeHTML(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Flag global: true jika user sengaja pindah halaman (dipakai game.js & beforeunload)
let isNavigatingIntentionally = false;

// 1. TEMA DARK / LIGHT MODE
function initTheme() {
    const saved = localStorage.getItem('filemate_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = saved === 'dark' ? '☀️ Light' : '🌙 Dark';
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('filemate_theme', next);
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = next === 'dark' ? '☀️ Light' : '🌙 Dark';
}

// Toast Notification Minimalis
let toastTimer = null;
function showToastNotification(htmlMessage) {
    let toast = document.getElementById('filemateToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'filemateToast';
        toast.className = 'toast-notify';
        document.body.appendChild(toast);
    }
    toast.innerHTML = htmlMessage;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

// Salin perintah terminal (guide.html)
function copyGuideCommand(cmdText, targetFileExample) {
    navigator.clipboard.writeText(cmdText);
    if (targetFileExample) {
        showToastNotification(`
            <strong style="color: var(--accent); display: block; margin-bottom: 2px;">Perintah disalin ke clipboard</strong>
            <span style="color: var(--text-secondary);">Ganti argumen <code class="mono" style="color: var(--text-primary);">${escapeHTML(targetFileExample)}</code> dengan nama file asli yang ingin kamu periksa.</span>
        `);
    } else {
        showToastNotification(`
            <strong style="color: var(--accent); display: block; margin-bottom: 2px;">Perintah disalin ke clipboard</strong>
            <span style="color: var(--text-secondary);">Siap dijalankan pada terminal di direktori target.</span>
        `);
    }
}

// 2. MODAL PROFIL TIM PENGEMBANG
function openTeamCredits() {
    const backdrop = document.getElementById('modalBackdrop');
    if (!backdrop || typeof SATGAS_TEAM === 'undefined') return;

    document.getElementById('modalTitle').innerHTML = `🛡️ Profil Tim Pengembang — Satgas Salah Download`;
    let cardsHtml = '';
    SATGAS_TEAM.forEach(m => {
        const cleanIg = (m.instagram || '').replace('@', '');
        cardsHtml += `
            <div class="member-card">
                <span class="role-badge">${escapeHTML(m.badge)}</span>
                <strong style="display: block; font-size: 0.96rem;">${escapeHTML(m.name)}</strong>
                <a href="https://instagram.com/${encodeURIComponent(cleanIg)}" target="_blank" rel="noopener noreferrer" class="mono" style="font-size: 0.78rem; color: var(--accent); text-decoration: none; display: inline-block; margin-top: 2px;">
                    Instagram: ${escapeHTML(m.instagram)} &nearr;
                </a>
                <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 6px;">${escapeHTML(m.specialty)}</p>
            </div>
        `;
    });

    document.getElementById('modalContent').innerHTML = `
        <p style="font-size: 0.88rem; color: var(--text-secondary);">
            Aplikasi <strong>FileMate (Safe Download Advisor)</strong> dirancang oleh <strong>Kelompok 6</strong> sebagai Mini PBL Program Studi Rekayasa Keamanan Siber Politeknik Negeri Batam.
        </p>
        <div class="team-grid">${cardsHtml}</div>
    `;
    backdrop.classList.add('open');
}

function closeModal() {
    const backdrop = document.getElementById('modalBackdrop');
    if (backdrop) backdrop.classList.remove('open');
}

// Konfirmasi keluar/restart sesi simulasi (play.html & result.html)
function confirmRestartSimulation(targetUrl = 'play.html') {
    const backdrop = document.getElementById('modalBackdrop');
    if (!backdrop) {
        isNavigatingIntentionally = true;
        window.location.href = targetUrl;
        return;
    }
    const isLeaving = targetUrl !== 'play.html';
    document.getElementById('modalTitle').innerHTML = isLeaving ? `Tinggalkan Sesi Simulasi?` : `Mulai Ulang Sesi Simulasi?`;
    document.getElementById('modalContent').innerHTML = `
        <p style="font-size: 0.88rem; color: var(--text-secondary); line-height: 1.55;">
            ${isLeaving
                ? `Sesi simulasi kamu sedang berjalan. Jika kamu keluar sekarang, progres dan skor pada sesi ini akan di-reset dari awal.`
                : `Skor sesi saat ini akan dikembalikan ke <strong>100 Pts</strong> dan urutan skenario beserta file akan diacak ulang.`}
        </p>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border-color);">
            <button type="button" class="btn btn-ghost btn-sm" onclick="closeModal()">Batal</button>
            <button type="button" class="btn ${isLeaving ? 'btn-danger' : 'btn-primary'} btn-sm" onclick="proceedNavigation('${escapeHTML(targetUrl)}')">
                ${isLeaving ? 'Ya, Keluar Sesi' : 'Ya, Mulai Ulang'}
            </button>
        </div>
    `;
    backdrop.classList.add('open');
}

function proceedNavigation(url) {
    isNavigatingIntentionally = true;
    window.location.href = url;
}

document.addEventListener('DOMContentLoaded', initTheme);
