/* =========================================================
   FILEMATE RESULT.JS — Halaman hasil + simpan skor + feedback
   (result.html)
   Membutuhkan: common.js (escapeHTML, modal, toast)

   SUDAH DIMIGRASI KE SERVER (backend/app/simulation/):
   - Skor, kategori risiko, diagnosis & riwayat dari GET /api/session/<sid>/result
   - Simpan ke leaderboard lewat POST /api/session/<sid>/save (skor dari server)
   - Feedback lewat POST /api/session/<sid>/feedback (inisial & skor dari server)
   Browser hanya menyimpan session id (filemate_session_id) dari game.js.
   ========================================================= */

let resultSessionId = null;
let resultData = null;          // hasil dari server (hanya untuk ditampilkan)
let currentMaskedUser = 'A****M';
let resultRequestPending = false;

// ---------- Request ke server ----------
async function resultApi(method, path, body) {
    let res;
    try {
        res = await fetch('/api/session/' + encodeURIComponent(resultSessionId) + path, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined
        });
    } catch (e) {
        const err = new Error('Server backend tidak aktif. Jalankan server Python terlebih dahulu.');
        err.status = 0;
        throw err;
    }
    let json = {};
    try { json = await res.json(); } catch (e) { /* respons bukan JSON */ }
    if (!res.ok) {
        const err = new Error(json.message || ('HTTP ' + res.status));
        err.status = res.status;
        throw err;
    }
    return json.data;
}

function riskColor(category) {
    if (category === 'TINGGI') return 'var(--danger)';
    if (category === 'SEDANG') return 'var(--warning)';
    return 'var(--safe)';
}

// Teks diagnosis = logika tampilan, berdasarkan hitungan kesalahan dari server
function diagnosisText(mistakes) {
    const m = mistakes || {};
    if (m.SPOOFING > 0) return "Kamu masih rentan terkecoh oleh penyamaran ekstensi ganda atau file gambar (.jpg) yang memiliki header program eksekusi.";
    if (m.HASH > 0) return "Kamu kurang teliti mencocokkan nilai integritas SHA-256 dengan checksum resmi developer.";
    if (m.FATIGUE > 0) return "Kamu mengalami penurunan ketelitian (Awareness Fatigue) saat memeriksa 10 file sekaligus.";
    return "Luar biasa! Kamu selalu memeriksa struktur ekstensi, magic bytes, dan checksum SHA-256 sebelum membuka file.";
}

function showResultUnavailable(message) {
    document.getElementById('displayScore').textContent = '– / 100';
    document.getElementById('riskCategoryBadge').innerHTML = '';
    document.getElementById('diagnosisText').textContent = message;
    document.getElementById('historyReviewList').innerHTML =
        `<span style="font-size: 0.82rem; color: var(--text-muted);">Belum ada riwayat simulasi.</span>`;
    setSaveFormLocked('Mainkan simulasi terlebih dahulu untuk menyimpan skor.');
}

// Mengunci input nama & tombol simpan (sudah tersimpan / hasil tidak tersedia)
function setSaveFormLocked(placeholder) {
    const input = document.getElementById('finalUsername');
    const btn = document.querySelector('[onclick="saveScoreAndOpenFeedback()"]');
    if (input) { input.disabled = true; input.value = ''; input.placeholder = placeholder; }
    if (btn) btn.disabled = true;
}

function showResultError(message) {
    if (typeof showToastNotification === 'function') {
        showToastNotification(`<strong style="color: var(--danger);">⚠️ ${escapeHTML(message)}</strong>`);
    } else {
        alert(message);
    }
}

// ---------- Tampilkan hasil ----------
async function initResultPage() {
    if (!document.getElementById('displayScore')) return;

    resultSessionId = localStorage.getItem('filemate_session_id');
    if (!resultSessionId) {
        showResultUnavailable('Belum ada hasil simulasi. Mainkan Lab Simulasi terlebih dahulu.');
        return;
    }

    try {
        resultData = await resultApi('GET', '/result');
    } catch (e) {
        showResultUnavailable(e.message);
        return;
    }

    document.getElementById('displayScore').textContent = `${Number(resultData.score) || 0} / 100`;
    document.getElementById('riskCategoryBadge').innerHTML =
        `Kategori Risiko Perilaku: <strong style="color: ${riskColor(resultData.risk_category)};">${escapeHTML(resultData.risk_category)}</strong>`;
    document.getElementById('diagnosisText').textContent = diagnosisText(resultData.mistakes);

    const histContainer = document.getElementById('historyReviewList');
    const historyLog = resultData.history || [];
    if (historyLog.length === 0) {
        histContainer.innerHTML = `<span style="font-size: 0.82rem; color: var(--text-muted);">Belum ada riwayat simulasi.</span>`;
    } else {
        histContainer.innerHTML = historyLog.map(h => `
            <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: var(--bg-subtle); border-radius: 6px; font-size: 0.82rem;">
                <span class="mono">Kasus ${Number(h.stage) || 0}: <strong>${escapeHTML(h.file)}</strong></span>
                <span style="color: ${h.correct ? 'var(--safe)' : 'var(--danger)'}; font-weight: 600;">${escapeHTML(h.note)}</span>
            </div>
        `).join('');
    }

    if (resultData.saved) {
        currentMaskedUser = resultData.masked_name || currentMaskedUser;
        setSaveFormLocked(`Skor sudah tersimpan sebagai ${currentMaskedUser}`);
    }
}

// ---------- Simpan skor ke leaderboard (server) ----------
async function saveScoreAndOpenFeedback() {
    if (!resultData || resultRequestPending) return;
    const username = document.getElementById('finalUsername').value.trim();

    resultRequestPending = true;
    let saved;
    try {
        saved = await resultApi('POST', '/save', { username });
    } catch (e) {
        resultRequestPending = false;
        if (e.status === 409) {
            setSaveFormLocked('Skor sesi ini sudah tersimpan');
        }
        showResultError(e.message);
        return;
    }
    resultRequestPending = false;

    currentMaskedUser = saved.masked_name;
    resultData.saved = true;
    setSaveFormLocked(`Skor sudah tersimpan sebagai ${currentMaskedUser}`);

    if (resultData.feedback_sent) {
        showToastNotification(`<strong style="color: var(--safe);">✅ Skor ${escapeHTML(currentMaskedUser)} tersimpan!</strong>`);
        return;
    }
    openFeedbackForm(saved.score);
}

function openFeedbackForm(score) {
    document.getElementById('modalTitle').innerHTML = `💬 Bantu Kami Lebih Baik! (Skor ${escapeHTML(currentMaskedUser)} Tersimpan)`;
    document.getElementById('modalContent').innerHTML = `
        <p style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 12px;">
            Skormu (<strong>${Number(score) || 0} Pts</strong>) sudah tercatat di Papan Peringkat! Sebelum kembali ke beranda, boleh berikan <strong>saran atau masukanmu</strong> mengenai simulasi FileMate ini?
        </p>
        <textarea id="userFeedbackInput" rows="4" maxlength="300" placeholder="Tulis saran atau masukanmu di sini (misal: tampilannya mudah dipahami, atau tambahkan variasi soal lain)..." style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-subtle); color: var(--text-primary); font-family: inherit; font-size: 0.88rem; resize: vertical;"></textarea>
        <div id="feedbackErrorMsg" style="color: var(--danger); font-size: 0.78rem; margin-top: 6px; min-height: 18px;"></div>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px;">
            <button class="btn btn-ghost btn-sm" onclick="window.location.href='index.html'">Lewati</button>
            <button class="btn btn-primary btn-sm" id="btnSendFeedback" onclick="submitUserFeedback()">🚀 Kirim Masukan &amp; Ke Beranda</button>
        </div>
    `;
    document.getElementById('modalBackdrop').classList.add('open');
}

// ---------- Kirim feedback (server) ----------
async function submitUserFeedback() {
    if (resultRequestPending) return;
    const message = document.getElementById('userFeedbackInput').value.trim();
    if (!message) {
        window.location.href = 'index.html'; // kosong = sama dengan "Lewati"
        return;
    }

    const btn = document.getElementById('btnSendFeedback');
    const err = document.getElementById('feedbackErrorMsg');
    resultRequestPending = true;
    if (btn) btn.disabled = true;
    try {
        await resultApi('POST', '/feedback', { message });
    } catch (e) {
        resultRequestPending = false;
        if (btn) btn.disabled = false;
        if (e.status === 409) {
            window.location.href = 'index.html'; // sudah pernah dikirim
            return;
        }
        if (err) err.textContent = e.message;
        return;
    }
    window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', initResultPage);
