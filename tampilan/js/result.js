/* =========================================================
   FILEMATE RESULT.JS — Halaman hasil + simpan skor + feedback
   (result.html)
   Membutuhkan: common.js, leaderboard.js
   ========================================================= */

let resultScore = 100;
let resultSecs = 60;
let resultRiskCategory = 'RENDAH';
let currentMaskedUser = 'A***M';

function initResultPage() {
    if (!document.getElementById('displayScore')) return;

    resultScore = parseInt(localStorage.getItem('filemate_final_score') || '100');
    resultSecs = parseInt(localStorage.getItem('filemate_seconds') || '60');
    const mistakes = JSON.parse(localStorage.getItem('filemate_mistakes') || '{"SPOOFING":0,"HASH":0,"FATIGUE":0,"IMPULSIVE":0}');
    const historyLog = JSON.parse(localStorage.getItem('filemate_history') || '[]');

    document.getElementById('displayScore').textContent = `${resultScore} / 100`;

    resultRiskCategory = resultScore <= 50 ? 'TINGGI' : (resultScore <= 80 ? 'SEDANG' : 'RENDAH');
    const badgeColor = resultScore <= 50 ? 'var(--danger)' : (resultScore <= 80 ? 'var(--warning)' : 'var(--safe)');
    document.getElementById('riskCategoryBadge').innerHTML = `Kategori Risiko Perilaku: <strong style="color: ${badgeColor};">${resultRiskCategory}</strong>`;

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
        historyLog.forEach(h => {
            histContainer.innerHTML += `
                <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: var(--bg-subtle); border-radius: 6px; font-size: 0.82rem;">
                    <span class="mono">Kasus ${Number(h.stage) || 0}: <strong>${escapeHTML(h.file)}</strong></span>
                    <span style="color: ${h.correct ? 'var(--safe)' : 'var(--danger)'}; font-weight: 600;">${escapeHTML(h.note)}</span>
                </div>
            `;
        });
    }
}

// === [ZONA MIGRASI BACKEND 4 - TUGAS KAYSAN & YAZID]: Kirim POST ke `/api/submit-score` & `/api/submit-feedback` ===
function saveScoreAndOpenFeedback() {
    const rawInput = document.getElementById('finalUsername').value.trim() || 'Anonim';
    const cleanRaw = rawInput.replace(/[<>"'&]/g, '');
    currentMaskedUser = cleanRaw.length > 1 ? `${cleanRaw[0].toUpperCase()}***${cleanRaw[cleanRaw.length - 1].toUpperCase()}` : `${cleanRaw.toUpperCase()}***`;
    const timeStr = `${String(Math.floor(resultSecs / 60)).padStart(2, '0')}:${String(resultSecs % 60).padStart(2, '0')}`;

    const lb = getLeaderboard();
    lb.push({ name: currentMaskedUser, score: resultScore, time: timeStr, risk: resultRiskCategory });
    lb.sort((a, b) => b.score - a.score || a.time.localeCompare(b.time));
    saveLeaderboard(lb);

    document.getElementById('modalTitle').innerHTML = `💬 Bantu Kami Lebih Baik! (Skor ${escapeHTML(currentMaskedUser)} Tersimpan)`;
    document.getElementById('modalContent').innerHTML = `
        <p style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 12px;">
            Skormu (<strong>${resultScore} Pts</strong>) sudah tercatat di Papan Peringkat! Sebelum kembali ke beranda, boleh berikan <strong>saran atau masukanmu</strong> mengenai simulasi FileMate ini?
        </p>
        <textarea id="userFeedbackInput" rows="4" maxlength="300" placeholder="Tulis saran atau masukanmu di sini (misal: tampilannya mudah dipahami, atau tambahkan variasi soal lain)..." style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-subtle); color: var(--text-primary); font-family: inherit; font-size: 0.88rem; resize: vertical;"></textarea>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px;">
            <button class="btn btn-ghost btn-sm" onclick="window.location.href='index.html'">Lewati</button>
            <button class="btn btn-primary btn-sm" onclick="submitUserFeedback()">🚀 Kirim Masukan &amp; Ke Beranda</button>
        </div>
    `;
    document.getElementById('modalBackdrop').classList.add('open');
}

function submitUserFeedback() {
    const rawMsg = document.getElementById('userFeedbackInput').value.trim();
    const cleanMsg = rawMsg.replace(/[<>]/g, '');
    if (cleanMsg) {
        const feedbacks = JSON.parse(localStorage.getItem('filemate_feedbacks') || '[]');
        const now = new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
        feedbacks.push({
            user: currentMaskedUser,
            score: resultScore,
            date: now,
            message: cleanMsg
        });
        localStorage.setItem('filemate_feedbacks', JSON.stringify(feedbacks));
    }
    window.location.href = 'index.html';
}
// === [AKHIR ZONA MIGRASI BACKEND 4] ===

document.addEventListener('DOMContentLoaded', initResultPage);
