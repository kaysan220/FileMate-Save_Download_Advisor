/* =========================================================
   FILEMATE ADMIN.JS — Menu Maintainer Tim Satgas
   =========================================================
   AKSES RAHASIA TIM SATGAS (MURNI CTRL + SHIFT + L)
   Alur password (disimpan di backend sebagai hash):
     1. Belum ada password  -> buat password + konfirmasi
     2. Sudah ada password  -> masukkan password
     3. Lupa password       -> password cadangan tim -> password baru + konfirmasi
   Password tidak pernah dikirim apa adanya: frontend mengirim
   SHA-256(password), backend menyimpan & membandingkan hash.
   Menu setelah login menampilkan 3 tombol:
     1. Reset Leaderboard
     2. Reset Masukan
     3. Unduh CSV Feedback
   ========================================================= */
const ADMIN_MIN_PASSWORD = 8;
let adminRecoveryHash = null; // hash password cadangan, hanya disimpan di memori selama reset

function initSecretMaintainerTrigger() {
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
            e.preventDefault();
            promptMaintainerAccess();
        }
    });
}

// ---------- SHA-256 (crypto.subtle, dengan cadangan JS murni untuk akses via http://IP-LAN) ----------
async function sha256Hex(text) {
    const bytes = new TextEncoder().encode(text);
    if (window.crypto && window.crypto.subtle) {
        const buf = await window.crypto.subtle.digest('SHA-256', bytes);
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return sha256Fallback(bytes);
}

function sha256Fallback(bytes) {
    const K = [
        0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
        0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
        0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
        0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
        0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
        0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
        0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
        0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    ];
    const ror = (x, n) => (x >>> n) | (x << (32 - n));
    const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const len = bytes.length;
    const total = Math.ceil((len + 9) / 64) * 64;
    const msg = new Uint8Array(total);
    msg.set(bytes);
    msg[len] = 0x80;
    const view = new DataView(msg.buffer);
    view.setUint32(total - 8, Math.floor(len / 0x20000000));
    view.setUint32(total - 4, (len * 8) >>> 0);
    const W = new Uint32Array(64);
    for (let i = 0; i < total; i += 64) {
        for (let t = 0; t < 16; t++) W[t] = view.getUint32(i + t * 4);
        for (let t = 16; t < 64; t++) {
            const s0 = ror(W[t - 15], 7) ^ ror(W[t - 15], 18) ^ (W[t - 15] >>> 3);
            const s1 = ror(W[t - 2], 17) ^ ror(W[t - 2], 19) ^ (W[t - 2] >>> 10);
            W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
        }
        let [a, b, c, d, e, f, g, h] = H;
        for (let t = 0; t < 64; t++) {
            const t1 = (h + (ror(e, 6) ^ ror(e, 11) ^ ror(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + W[t]) >>> 0;
            const t2 = ((ror(a, 2) ^ ror(a, 13) ^ ror(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
            h = g; g = f; f = e; e = (d + t1) >>> 0;
            d = c; c = b; b = a; a = (t1 + t2) >>> 0;
        }
        [a, b, c, d, e, f, g, h].forEach((v, k) => { H[k] = (H[k] + v) >>> 0; });
    }
    return H.map(v => v.toString(16).padStart(8, '0')).join('');
}

// ---------- Pemanggilan API admin (membaca pesan error dari backend) ----------
async function adminApi(method, path, body) {
    try {
        const res = await fetch('/api/admin' + path, {
            method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: body ? JSON.stringify(body) : undefined
        });
        let json = {};
        try { json = await res.json(); } catch (e) { /* respons bukan JSON */ }
        const info = (json && json.data) || json || {};
        return {
            ok: res.ok, status: res.status, data: json.data,
            message: json.message || ('HTTP ' + res.status),
            retryAfter: Number(json.retry_after || info.retry_after) || 0,
            requireRecovery: Boolean(json.require_recovery || info.require_recovery)
        };
    } catch (e) {
        return { ok: false, status: 0, message: 'Server backend tidak aktif. Jalankan server Python terlebih dahulu.' };
    }
}

// ---------- Komponen tampilan modal ----------
function adminField(id, placeholder, onEnter) {
    return `
        <input type="password" id="${id}" class="pin-input-clean" placeholder="${placeholder}" autocomplete="off"
            ${onEnter ? `onkeydown="if(event.key==='Enter') ${onEnter}()"` : ''}
            style="width: 100%; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-subtle); color: var(--text-primary); margin-bottom: 8px;">
    `;
}

function renderAdminForm({ title, desc, fields, submitLabel, submitFn, extra = '', cancelFn = 'closeModal' }) {
    const backdrop = document.getElementById('modalBackdrop');
    if (!backdrop) return;
    stopAdminCountdown();
    document.getElementById('modalTitle').innerHTML = title;
    document.getElementById('modalContent').innerHTML = `
        <p style="font-size: 0.86rem; color: var(--text-secondary); margin-bottom: 12px;">${desc}</p>
        <div>
            ${fields}
            <div id="pinErrorMsg" style="color: var(--danger); font-size: 0.78rem; margin-top: 2px; min-height: 18px; font-weight: 500;"></div>
            ${extra}
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-color);">
            <button type="button" class="btn btn-ghost btn-sm" onclick="${cancelFn}()">Batal</button>
            <button type="button" class="btn btn-primary btn-sm" id="adminSubmitBtn" onclick="${submitFn}()">${submitLabel}</button>
        </div>
    `;
    backdrop.classList.add('open');
    setTimeout(() => {
        const first = document.querySelector('#modalContent input');
        if (first) first.focus();
    }, 60);
}

function showAdminError(msg, clearIds = []) {
    const err = document.getElementById('pinErrorMsg');
    const card = document.getElementById('modalCard');
    if (err) err.textContent = msg;
    if (card) {
        card.classList.remove('shake-error');
        void card.offsetWidth;
        card.classList.add('shake-error');
    }
    clearIds.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const focusEl = document.getElementById(clearIds[0]);
    if (focusEl) focusEl.focus();
}

function setAdminBusy(busy) {
    const btn = document.getElementById('adminSubmitBtn');
    if (btn) btn.disabled = busy;
}

function readField(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
}

// Validasi password baru + konfirmasi. Mengembalikan pesan error atau ''.
function validateNewPassword(pw, confirm) {
    if (pw.length < ADMIN_MIN_PASSWORD) return `Password minimal ${ADMIN_MIN_PASSWORD} karakter.`;
    if (pw !== confirm) return 'Konfirmasi password tidak sama.';
    return '';
}

// ---------- Penundaan: input & tombol dikunci, hitung mundur ----------
let adminCountdownTimer = null;

function stopAdminCountdown() {
    if (adminCountdownTimer) clearInterval(adminCountdownTimer);
    adminCountdownTimer = null;
}

function formatCountdown(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const mmss = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    return h > 0 ? h + ':' + mmss : mmss;
}

function showAdminLocked(seconds) {
    renderAdminForm({
        title: '⏳ Akses Maintainer Ditunda',
        desc: 'Terlalu banyak password salah. Selama penundaan, input password dan akses server admin ditutup.',
        fields: `
            <input type="password" class="pin-input-clean" placeholder="Input dikunci sementara..." disabled
                style="width: 100%; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-subtle); color: var(--text-muted); margin-bottom: 8px; cursor: not-allowed;">
            <div style="text-align: center; font-size: 0.9rem; color: var(--warning); font-weight: 600; margin: 4px 0 6px;">
                Coba lagi dalam <span class="mono" id="adminCountdown">${formatCountdown(seconds)}</span>
            </div>`,
        submitLabel: 'Verifikasi', submitFn: 'promptMaintainerAccess'
    });
    const btn = document.getElementById('adminSubmitBtn');
    if (btn) btn.disabled = true;

    const backdrop = document.getElementById('modalBackdrop');
    const selesai = Date.now() + seconds * 1000;
    adminCountdownTimer = setInterval(() => {
        if (!backdrop.classList.contains('open')) return stopAdminCountdown(); // modal ditutup
        const sisa = Math.max(0, Math.ceil((selesai - Date.now()) / 1000));
        const el = document.getElementById('adminCountdown');
        if (el) el.textContent = formatCountdown(sisa);
        if (sisa <= 0) {
            stopAdminCountdown();
            promptMaintainerAccess(); // penundaan selesai -> tanya status lagi ke server
        }
    }, 1000);
}

// Menangani respons penundaan (429) & login ditutup (423). true = sudah ditangani.
function handleAdminLock(res) {
    if (res.status === 429 && res.retryAfter > 0) {
        showAdminLocked(res.retryAfter);
        return true;
    }
    if (res.status === 423 || res.requireRecovery) {
        showAdminRecovery(true);
        return true;
    }
    return false;
}

// ---------- Titik masuk: Ctrl + Shift + L ----------
async function promptMaintainerAccess() {
    if (!document.getElementById('modalBackdrop')) return;
    adminRecoveryHash = null;
    const res = await adminApi('GET', '/status');
    if (handleAdminLock(res)) return;
    if (!res.ok) {
        renderAdminForm({
            title: '🔒 Akses Maintainer Tim Satgas',
            desc: 'Menu maintainer membutuhkan server backend.',
            fields: '', submitLabel: 'Coba Lagi', submitFn: 'promptMaintainerAccess'
        });
        showAdminError(res.message);
        return;
    }
    if (res.data && res.data.has_password) showAdminLogin();
    else showAdminSetup();
}

// 1) Password pertama
function showAdminSetup() {
    renderAdminForm({
        title: '🔐 Buat Password Maintainer',
        desc: `Password admin belum dibuat. Buat password baru (minimal ${ADMIN_MIN_PASSWORD} karakter) lalu konfirmasi ulang.`,
        fields: adminField('adminNewPw', 'Password baru...') + adminField('adminNewPw2', 'Konfirmasi password...', 'submitAdminSetup'),
        submitLabel: 'Simpan Password', submitFn: 'submitAdminSetup'
    });
}

async function submitAdminSetup() {
    const pw = readField('adminNewPw');
    const msg = validateNewPassword(pw, readField('adminNewPw2'));
    if (msg) return showAdminError(msg, ['adminNewPw', 'adminNewPw2']);

    setAdminBusy(true);
    const res = await adminApi('POST', '/setup', { password_hash: await sha256Hex(pw) });
    setAdminBusy(false);
    if (handleAdminLock(res)) return;
    if (res.status === 409) return showAdminLogin();
    if (!res.ok) return showAdminError(res.message);
    openFeedbackViewer();
    showToastNotification(`<strong style="color: var(--safe);">✅ Password maintainer berhasil dibuat!</strong>`);
}

// 2) Login
function showAdminLogin() {
    renderAdminForm({
        title: '🔒 Akses Maintainer Tim Satgas',
        desc: 'Masukkan password maintainer untuk melihat rekapitulasi masukan pengguna dan manajemen data demo.',
        fields: adminField('maintainerPinField', 'Masukkan password maintainer...', 'verifyMaintainerPin'),
        submitLabel: 'Verifikasi', submitFn: 'verifyMaintainerPin',
        extra: `<a href="#" onclick="event.preventDefault(); showAdminRecovery()" style="font-size: 0.8rem; color: var(--accent);">Lupa password?</a>`
    });
}

async function verifyMaintainerPin() {
    const pw = readField('maintainerPinField');
    if (!pw) return showAdminError('Password wajib diisi.', ['maintainerPinField']);

    setAdminBusy(true);
    const res = await adminApi('POST', '/login', { password_hash: await sha256Hex(pw) });
    setAdminBusy(false);
    if (handleAdminLock(res)) return;
    if (res.status === 409) return showAdminSetup();
    if (!res.ok) return showAdminError(res.status === 401 ? 'Password tidak sesuai. Akses ditolak.' : res.message, ['maintainerPinField']);
    openFeedbackViewer();
}

// 3) Lupa password / login ditutup: password cadangan tim
// forced = true -> login password ditutup (terlalu banyak salah), tidak bisa kembali ke login
function showAdminRecovery(forced = false) {
    adminRecoveryHash = null;
    renderAdminForm({
        title: forced ? '⛔ Login Password Ditutup' : '🛟 Lupa Password Maintainer',
        desc: forced
            ? 'Akses ditolak karena terlalu banyak percobaan password salah. Masukkan password cadangan tim untuk membuat password baru.'
            : 'Masukkan password cadangan tim untuk membuat password baru.',
        fields: adminField('adminRecoveryPw', 'Password cadangan...', 'submitAdminRecovery'),
        submitLabel: 'Lanjut', submitFn: 'submitAdminRecovery',
        cancelFn: forced ? 'closeModal' : 'showAdminLogin'
    });
}

async function submitAdminRecovery() {
    const pw = readField('adminRecoveryPw');
    if (!pw) return showAdminError('Password cadangan wajib diisi.', ['adminRecoveryPw']);

    setAdminBusy(true);
    const hash = await sha256Hex(pw);
    const res = await adminApi('POST', '/recovery', { recovery_hash: hash });
    setAdminBusy(false);
    if (res.status === 429 && res.retryAfter > 0) return showAdminLocked(res.retryAfter);
    if (!res.ok) return showAdminError(res.status === 401 ? 'Password cadangan salah.' : res.message, ['adminRecoveryPw']);
    adminRecoveryHash = hash;
    showAdminResetForm();
}

function showAdminResetForm() {
    renderAdminForm({
        title: '🔑 Buat Password Baru',
        desc: `Password cadangan benar. Masukkan password baru (minimal ${ADMIN_MIN_PASSWORD} karakter) lalu konfirmasi ulang.`,
        fields: adminField('adminNewPw', 'Password baru...') + adminField('adminNewPw2', 'Konfirmasi password baru...', 'submitAdminReset'),
        submitLabel: 'Simpan Password Baru', submitFn: 'submitAdminReset', cancelFn: 'showAdminLogin'
    });
}

async function submitAdminReset() {
    if (!adminRecoveryHash) return showAdminRecovery();
    const pw = readField('adminNewPw');
    const msg = validateNewPassword(pw, readField('adminNewPw2'));
    if (msg) return showAdminError(msg, ['adminNewPw', 'adminNewPw2']);

    setAdminBusy(true);
    const res = await adminApi('POST', '/reset', {
        recovery_hash: adminRecoveryHash,
        new_password_hash: await sha256Hex(pw)
    });
    setAdminBusy(false);
    if (res.status === 429 && res.retryAfter > 0) return showAdminLocked(res.retryAfter);
    if (!res.ok) {
        if (res.status === 401) {
            showAdminRecovery();
            return showAdminError('Password cadangan salah.', ['adminRecoveryPw']);
        }
        return showAdminError(res.message);
    }
    adminRecoveryHash = null;
    openFeedbackViewer();
    showToastNotification(`<strong style="color: var(--safe);">✅ Password maintainer berhasil diganti!</strong>`);
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
            Apakah kamu yakin ingin mengosongkan seluruh <strong>Papan Peringkat (Leaderboard)</strong>?<br>
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
    showToastNotification(`<strong style="color: var(--safe);">✅ Papan Peringkat berhasil dikosongkan!</strong>`);
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
