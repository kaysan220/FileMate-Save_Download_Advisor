/* =========================================================
   RESULT.JS — Otomatis Simpan Skor Agen & Evaluasi Akhir
   ========================================================= */

let currentMaskedUser = 'A****M';
let currentRawUser = 'Anonim';
let finalSessionScore = 100;
let finalSessionSecs = 60;
let finalRiskCategory = 'RENDAH';

function confirmRestartSimulation(targetUrl = 'play.html') {
    window.location.href = targetUrl;
}

async function autoRecordAgentScore() {
    const alreadySaved = localStorage.getItem('filemate_session_saved') === 'true';
    if (alreadySaved) return;

    const timeStr = `${String(Math.floor(finalSessionSecs / 60)).padStart(2, '0')}:${String(finalSessionSecs % 60).padStart(2, '0')}`;
    const defaultLb = [
        { name: "R****T", score: 95, time: "01:12", risk: "RENDAH" },
        { name: "F****N", score: 90, time: "01:28", risk: "RENDAH" },
        { name: "K****N", score: 85, time: "01:45", risk: "RENDAH" },
        { name: "Y****D", score: 75, time: "02:05", risk: "SEDANG" }
    ];

    let lb = JSON.parse(localStorage.getItem('filemate_leaderboard') || JSON.stringify(defaultLb));
    lb.push({ name: currentMaskedUser, score: finalSessionScore, time: timeStr, risk: finalRiskCategory });
    lb.sort((a, b) => b.score - a.score || a.time.localeCompare(b.time));
    localStorage.setItem('filemate_leaderboard', JSON.stringify(lb));
    localStorage.setItem('filemate_session_saved', 'true');

    if (typeof apiFetchJSON === 'function') {
        await apiFetchJSON('/api/submit-score', {
            method: 'POST',
            body: JSON.stringify({ username: currentRawUser, score: finalSessionScore, time: timeStr })
        });
    }
}

function initResultPage() {
    const scoreEl = document.getElementById('displayScore');
    if (!scoreEl) return;

    currentRawUser = localStorage.getItem('filemate_agent_raw') || 'Anonim';
    currentMaskedUser = localStorage.getItem('filemate_agent_masked') || 'A****M';
    finalSessionScore = parseInt(localStorage.getItem('filemate_final_score') || '100');
    finalSessionSecs = parseInt(localStorage.getItem('filemate_seconds') || '60');
    const mistakes = JSON.parse(localStorage.getItem('filemate_mistakes') || '{"SPOOFING":0,"HASH":0,"FATIGUE":0,"IMPULSIVE":0}');
    const historyLog = JSON.parse(localStorage.getItem('filemate_history') || '[]');

    const agentDisp = document.getElementById('savedAgentDisplay');
    if (agentDisp) agentDisp.textContent = currentMaskedUser;

    scoreEl.textContent = `${finalSessionScore} / 100`;
    finalRiskCategory = finalSessionScore <= 50 ? 'TINGGI' : (finalSessionScore <= 80 ? 'SEDANG' : 'RENDAH');
    const badgeColor = finalSessionScore <= 50 ? 'var(--danger)' : (finalSessionScore <= 80 ? 'var(--warning)' : 'var(--safe)');
    document.getElementById('riskCategoryBadge').innerHTML = `Kategori Risiko Perilaku: <strong style="color: ${badgeColor};">${finalRiskCategory}</strong>`;

    let diag = "Luar biasa! Kamu selalu memeriksa struktur ekstensi, magic bytes, dan checksum SHA-256 sebelum membuka file.";
    if (mistakes.SPOOFING > 0) {
        diag = "Kamu masih rentan terkecoh oleh penyamaran ekstensi ganda atau file gambar (.jpg) yang memiliki header program eksekusi.";
    } else if (mistakes.HASH > 0) {
        diag = "Kamu kurang teliti mencocokkan nilai integritas SHA-256 dengan checksum resmi developer.";
    } else if (mistakes.FATIGUE > 0) {
        diag = "Kamu mengalami penurunan ketelitian (Awareness Fatigue) saat memeriksa 10 file sekaligus.";
    }
    document.getElementById('diagnosisText').textContent = diag;

    const histContainer = document.getElementById('historyReviewList');
    if (historyLog.length === 0) {
        histContainer.innerHTML = `<span style="font-size: 0.82rem; color: var(--text-muted);">Belum ada riwayat simulasi.</span>`;
    } else {
        histContainer.innerHTML = '';
        historyLog.forEach(h => {
            histContainer.innerHTML += `
                <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: var(--bg-subtle); border-radius: 6px; font-size: 0.82rem;">
                    <span class="mono">Kasus ${h.stage}: <strong>${escapeHTML(h.file)}</strong></span>
                    <span style="color: ${h.correct ? 'var(--safe)' : 'var(--danger)'}; font-weight: 600;">${escapeHTML(h.note)}</span>
                </div>
            `;
        });
    }

    autoRecordAgentScore();
}

function openFeedbackModalManual() {
    document.getElementById('modalTitle').innerHTML = `
        <span style="display:inline-flex;align-items:center;gap:8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Bantu Kami Lebih Baik! (Agen ${escapeHTML(currentMaskedUser)})
        </span>
    `;
    document.getElementById('modalContent').innerHTML = `
        <p style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 12px;">
            Skormu (<strong>${finalSessionScore} Pts</strong>) sudah tercatat di Papan Peringkat! Boleh berikan <strong>saran atau masukanmu</strong> mengenai simulasi FileMate ini?
        </p>
        <textarea id="userFeedbackInput" rows="4" maxlength="300" placeholder="Tulis saran atau masukanmu di sini (misal: tampilannya mudah dipahami, atau tambahkan variasi soal lain)..." style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-subtle); color: var(--text-primary); font-family: inherit; font-size: 0.88rem; resize: vertical;"></textarea>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px;">
            <button class="btn btn-ghost btn-sm" onclick="closeModal()">Tutup</button>
            <button class="btn btn-primary btn-sm" onclick="submitUserFeedback()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                Kirim Masukan &amp; Ke Beranda
            </button>
        </div>
    `;
    document.getElementById('modalBackdrop').classList.add('open');
}

async function submitUserFeedback() {
    const rawMsg = document.getElementById('userFeedbackInput').value.trim();
    const cleanMsg = rawMsg.replace(/[<>]/g, '');
    if (cleanMsg) {
        const feedbacks = JSON.parse(localStorage.getItem('filemate_feedbacks') || '[]');
        const now = new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
        feedbacks.push({
            user: currentMaskedUser,
            score: finalSessionScore,
            date: now,
            message: cleanMsg
        });
        localStorage.setItem('filemate_feedbacks', JSON.stringify(feedbacks));

        if (typeof apiFetchJSON === 'function') {
            await apiFetchJSON('/api/submit-feedback', {
                method: 'POST',
                body: JSON.stringify({ user: currentMaskedUser, score: finalSessionScore, message: cleanMsg })
            });
        }
    }
    window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', () => {
    initResultPage();
});