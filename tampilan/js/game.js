/* =========================================================
   FILEMATE GAME.JS — Engine Lab Simulasi 3 Kasus Acak
   + Proteksi Refresh, X-Ray, SHA-256, Keputusan User (play.html)
   Membutuhkan: common.js (escapeHTML, modal, confirmRestartSimulation)

   SUDAH DIMIGRASI KE SERVER (backend/app/simulation/):
   - Soal diambil dari POST /api/session/start (TANPA kunci jawaban)
   - Benar/salah dinilai server lewat POST /api/session/<sid>/decide
   - Hint, skor berjalan, ending & pembahasan dikirim server
   - Skor akhir dihitung server lewat POST /api/session/<sid>/finish
   File ini hanya berisi logika tampilan + request ke server.
   ========================================================= */
let sessionId = null;
let sessionScenarios = {};
let activeStage = 1;
let currentScore = 100;
let secondsElapsed = 0;
let isRequestPending = false;
const hintCache = {}; // scenario_id -> {hint_author, hint_text}; penalti hint hanya 1x per kasus

// ---------- Request ke server simulasi ----------
async function simApi(path, body) {
    let res;
    try {
        res = await fetch('/api/session' + path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body || {})
        });
    } catch (e) {
        throw new Error('Server backend tidak aktif. Jalankan server Python terlebih dahulu.');
    }
    let json = {};
    try { json = await res.json(); } catch (e) { /* respons bukan JSON */ }
    if (!res.ok) throw new Error(json.message || ('HTTP ' + res.status));
    return json.data;
}

function showGameError(message) {
    document.getElementById('modalTitle').innerHTML = `<span style="color: var(--danger);">⚠️ Terjadi Kendala</span>`;
    document.getElementById('modalContent').innerHTML = `<p style="font-size: 0.9rem;">${escapeHTML(message)}</p>`;
    document.getElementById('modalBackdrop').classList.add('open');
}

function showSessionLoadError(message) {
    const panel = document.getElementById('sandboxPanel');
    if (!panel) return;
    panel.innerHTML = `
        <h2 style="font-size: 1.2rem;">⚠️ Lab Simulasi Tidak Dapat Dimulai</h2>
        <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 8px;">${escapeHTML(message)}</p>
        <p style="color: var(--text-muted); font-size: 0.84rem; margin-top: 8px;">
            Soal & penilaian simulasi disimpan di server agar tidak bisa dicontek. Jalankan <code>python app.py</code>
            lalu buka <code>http://127.0.0.1:5000</code>.
        </p>
        <button class="btn btn-primary btn-sm" style="margin-top: 14px;" onclick="isNavigatingIntentionally = true; window.location.reload()">↻ Coba Lagi</button>
    `;
}

function setScore(score) {
    currentScore = Number(score) || 0;
    const el = document.getElementById('scoreIndicator');
    if (el) el.textContent = `${currentScore} Pts`;
}

// ---------- Mulai sesi ----------
async function initSandboxSession() {
    if (!document.getElementById('sandboxPanel')) return;

    let data;
    try {
        data = await simApi('/start');
    } catch (e) {
        showSessionLoadError(e.message);
        return;
    }
    sessionId = data.session_id;
    data.scenarios.forEach((scen, index) => { sessionScenarios[index + 1] = scen; });
    setScore(data.current_score);

    setInterval(() => {
        secondsElapsed++;
        const m = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
        const s = String(secondsElapsed % 60).padStart(2, '0');
        const el = document.getElementById('timerIndicator');
        if (el) el.textContent = `${m}:${s}`;
    }, 1000);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R'))) {
            e.preventDefault();
            confirmRestartSimulation('play.html');
        }
    });

    document.querySelectorAll('.navbar a').forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (href && !href.startsWith('javascript')) {
                e.preventDefault();
                confirmRestartSimulation(href);
            }
        });
    });

    window.addEventListener('beforeunload', (e) => {
        if (!isNavigatingIntentionally) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    switchScenario(1);
}

function switchScenario(num) {
    activeStage = num;
    const c = sessionScenarios[num];
    document.getElementById('stageIndicator').textContent = `Kasus ${num} dari 3`;
    document.getElementById('caseTitle').textContent = `Kasus ${num}: ${c.title}`;
    document.getElementById('caseStory').textContent = c.story;
    document.getElementById('folderPath').textContent = `📁 ${c.path}`;

    const hashBox = document.getElementById('officialHashBox');
    const hashValContainer = document.getElementById('officialHashValue');
    const filesWithHash = c.files.filter(f => f.expectedHash);

    if (hashBox && hashValContainer) {
        if (filesWithHash.length > 0) {
            hashBox.style.display = 'block';
            hashValContainer.innerHTML = filesWithHash.map(f => `
                <div style="margin-top: 6px; padding: 6px 10px; background: var(--bg-surface); border-radius: 6px; border: 1px solid var(--border-color);">
                    <span style="color: var(--accent); font-weight: 700;">📄 ${escapeHTML(f.shownName.trim())}</span><br>
                    <span style="font-size: 0.78rem; color: var(--text-secondary);">SHA-256 Resmi: <code>${escapeHTML(f.expectedHash)}</code></span>
                </div>
            `).join('');
        } else if (c.officialHash) {
            hashBox.style.display = 'block';
            hashValContainer.textContent = c.officialHash;
        } else {
            hashBox.style.display = 'none';
        }
    }

    const drawer = document.getElementById('feedbackDrawer');
    if (drawer) drawer.classList.remove('show');

    const nextBtn = document.getElementById('btnNextStage');
    if (nextBtn) {
        nextBtn.innerHTML = num < 3 ? `Lanjut ke Kasus Berikutnya &rarr;` : `Lihat Hasil &amp; Evaluasi Akhir &rarr;`;
    }

    renderFiles();
    if (c.result) showScenarioLessonWithEnding(c);
}

function renderFiles() {
    const c = sessionScenarios[activeStage];
    const container = document.getElementById('fileRowsContainer');
    if (!container) return;
    container.innerHTML = '';

    let doneCount = 0;
    c.files.forEach((f, idx) => {
        if (f.status) doneCount++;

        let actionArea = '';
        if (f.status === 'OPENED_SAFE') {
            actionArea = `<span class="file-status-tag" style="background: var(--safe-soft); color: var(--safe);">✅ Dibuka (Aman)</span>`;
        } else if (f.status === 'QUARANTINED_CORRECT') {
            actionArea = `<span class="file-status-tag" style="background: var(--safe-soft); color: var(--safe);">🛡️ Ancaman Telah Terhapus</span>`;
        } else if (f.status === 'INFECTED') {
            actionArea = `<span class="file-status-tag" style="background: var(--danger-soft); color: var(--danger);">💥 Malware Terpicu (-15 Pts)</span>`;
        } else if (f.status === 'FALSE_ALARM') {
            actionArea = `<span class="file-status-tag" style="background: var(--warning-soft); color: var(--warning);">⚠️ File Aman Dihapus (-5 Pts)</span>`;
        } else {
            const dis = isRequestPending ? 'disabled' : '';
            actionArea = `
                <button class="btn btn-safe btn-sm" ${dis} onclick="takeAction(${idx}, 'OPEN')">📂 Buka File</button>
                <button class="btn btn-danger btn-sm" ${dis} onclick="takeAction(${idx}, 'QUARANTINE')">🗑️ Hapus File</button>
            `;
        }

        const inspectedBadge = f.inspected ? `<span style="font-size: 0.72rem; color: var(--accent); margin-left: 6px;">[Diperiksa ✓]</span>` : '';

        const row = document.createElement('div');
        row.className = 'file-item';
        row.innerHTML = `
            <div>
                <strong class="mono" style="font-size: 0.95rem;">📄 ${escapeHTML(f.shownName)}</strong>
                <span style="font-size: 0.8rem; color: var(--text-muted); margin-left: 6px;">(${escapeHTML(f.size)})</span>
                ${inspectedBadge}
            </div>
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                <button class="btn btn-ghost btn-sm" onclick="openXrayAnimated(${idx})">🔍 X-Ray Inspect</button>
                <button class="btn btn-ghost btn-sm" onclick="openHashAnimated(${idx})">#️⃣ Cek SHA-256</button>
                ${actionArea}
            </div>
        `;
        container.appendChild(row);
    });

    document.getElementById('progressStatus').textContent = `Diselesaikan: ${doneCount} / ${c.files.length} file`;
}

// Warna di X-Ray hanya berdasarkan BUKTI yang terlihat (ekstensi & permission),
// bukan kunci jawaban — server tidak mengirim isMalware ke browser.
const EKSTENSI_EKSEKUSI = ['.exe', '.bat', '.cmd', '.vbs', '.js', '.ps1', '.sh', '.scr', '.msi', '.com', '.jar'];
function looksExecutable(f) {
    return (f.perm || '').includes('x') || EKSTENSI_EKSEKUSI.includes(String(f.realExt || '').toLowerCase());
}

// 6. ANIMASI X-RAY DENGAN LABEL "File Permission:"
function openXrayAnimated(idx) {
    const f = sessionScenarios[activeStage].files[idx];
    f.inspected = true;
    renderFiles();

    document.getElementById('modalTitle').textContent = '🔍 Pemindaian X-Ray & Kamus Metadata';
    document.getElementById('modalContent').innerHTML = `
        <div style="padding: 12px 0;">
            <div id="scanStageText" class="mono" style="font-size: 0.85rem; color: var(--accent);">[1/3] Membaca magic bytes &amp; signature biner...</div>
            <div class="scan-progress-wrap"><div class="scan-progress-bar" id="scanProgressBar"></div></div>
        </div>
        <div id="xrayFinalOutput" style="display: none;"></div>
    `;
    document.getElementById('modalBackdrop').classList.add('open');

    const bar = document.getElementById('scanProgressBar');
    const txt = document.getElementById('scanStageText');

    setTimeout(() => { bar.style.width = '50%'; txt.textContent = '[2/3] Memeriksa embedded payload &amp; file permission...'; }, 220);
    setTimeout(() => { bar.style.width = '100%'; txt.textContent = '[3/3] Pemindaian selesai!'; }, 500);

    setTimeout(() => {
        const executable = looksExecutable(f);
        const baseName = f.realName.replace(f.fakeExt || '', '').replace(f.realExt, '');
        const visualName = f.fakeExt
            ? `${escapeHTML(baseName)}<span class="ext-badge ext-fake">${escapeHTML(f.fakeExt)} (Pengecoh)</span> &rarr; <span class="ext-badge ext-danger">${escapeHTML(f.realExt)} (Ekstensi Asli!)</span>`
            : `${escapeHTML(baseName)}<span class="ext-badge ${executable ? 'ext-danger' : 'ext-neutral'}">${escapeHTML(f.realExt)}</span>`;

        const permExplain = (f.perm || '').includes('x')
            ? `⚠️ Ada huruf 'x' (Executable): File ini bisa mengeksekusi kode program di sistem! Dokumen/foto biasa tidak boleh punya izin 'x'.`
            : `✅ Hanya baca/tulis ('rw-'): File pasif biasa, tidak memiliki izin eksekusi program.`;

        // Hasil pemindaian isi baru dibuka server setelah keputusan diambil
        const payloadText = f.payloadStatus
            ? `<span class="mono">${escapeHTML(f.payloadStatus)}</span>`
            : `<span style="color: var(--text-muted);">🔒 Terungkap setelah kamu mengambil keputusan</span>`;

        const out = document.getElementById('xrayFinalOutput');
        out.style.display = 'block';
        out.className = 'reveal-anim';
        out.innerHTML = `
            <div class="xray-box">
                <div class="xray-scanline"></div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 6px;">BEDAH EKSTENSI &amp; HEADER:</div>
                <div class="mono" style="font-size: 1rem; font-weight: 600;">${visualName}</div>
            </div>
            <div style="font-size: 0.85rem; display: flex; flex-direction: column; gap: 10px; margin-top: 12px;">
                <div>
                    <span style="color: var(--text-muted);">Nama Fisik Sebenarnya:</span> <strong class="mono">${escapeHTML(f.realName)}</strong>
                </div>
                <div>
                    <span style="color: var(--text-muted);">MIME Type (Identitas File):</span> <span class="mono">${escapeHTML(f.mime)}</span>
                    <span class="explain-pill">💡 Penjelasan Awam: Jenis asli file yang dikenali sistem operasi, terlepas dari nama filenya.</span>
                </div>
                <div>
                    <span style="color: var(--text-muted);">Header Biner (Magic Bytes):</span> <strong class="mono" style="color: ${executable ? 'var(--danger)' : 'var(--text-primary)'};">${escapeHTML(f.magicBytes)}</strong>
                    <span class="explain-pill">💡 Penjelasan Awam: Segel kode pertama di dalam isi file (misal %PDF untuk PDF asli, atau MZ untuk program .exe).</span>
                </div>
                <div>
                    <span style="color: var(--text-muted);">Pemindaian Isi (Payload):</span> ${payloadText}
                </div>
                <div>
                    <span style="color: var(--text-muted);">File Permission:</span> <span class="mono">${escapeHTML(f.perm)}</span>
                    <span class="explain-pill">${permExplain}</span>
                </div>
            </div>
        `;
    }, 750);
}

// 7. ANIMASI MATRIX SHA-256 (Mendukung expectedHash per file)
function openHashAnimated(idx) {
    const f = sessionScenarios[activeStage].files[idx];
    f.inspected = true;
    renderFiles();

    const targetOfficialHash = f.expectedHash || (sessionScenarios[activeStage].officialHash && f.realName.endsWith('.zip') ? sessionScenarios[activeStage].officialHash : null);
    document.getElementById('modalTitle').textContent = '#️⃣ Generator Checksum SHA-256';

    let compareSection = '';
    if (targetOfficialHash) {
        compareSection = `
            <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border-color);">
                <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 8px;">
                    Target SHA-256 Resmi untuk <strong>${escapeHTML(f.shownName.trim())}</strong>:<br>
                    <code class="mono" style="color: var(--text-secondary); word-break: break-all;">${escapeHTML(targetOfficialHash)}</code>
                </div>
                <button class="btn btn-primary btn-sm" id="btnCompareHash" style="display: none;" onclick="animateHashDiff('${escapeHTML(f.hash)}', '${escapeHTML(targetOfficialHash)}')">⚡ Bandingkan Otomatis dengan Hash Resmi</button>
                <div id="hashCompareResult" style="margin-top: 12px;"></div>
            </div>
        `;
    } else {
        compareSection = `
            <div style="margin-top: 14px; padding: 10px 12px; background: var(--bg-subtle); border-radius: 8px; border-left: 3px solid var(--accent); font-size: 0.82rem; color: var(--text-secondary);">
                ℹ️ Pengirim tidak menyertakan kode SHA-256 resmi untuk <code>${escapeHTML(f.shownName.trim())}</code>. Gunakan <strong>🔍 X-Ray Inspect</strong> untuk memeriksa keaslian header biner dan <em>File Permission</em>-nya.
            </div>
        `;
    }

    document.getElementById('modalContent').innerHTML = `
        <div style="font-size: 0.85rem; color: var(--text-secondary);">Menjalankan <code>sha256sum</code> pada <strong>${escapeHTML(f.realName)}</strong>:</div>
        <div id="matrixHashBox" class="mono" style="background: var(--bg-subtle); padding: 12px; border-radius: 8px; margin-top: 8px; font-size: 0.82rem; word-break: break-all; color: var(--accent);">Memproses...</div>
        <span class="explain-pill" style="margin-top: 6px;">💡 Sidik jari unik 64 karakter. Jika isi file diubah hacker 1 huruf saja, kode ini pasti berubah drastis.</span>
        ${compareSection}
    `;
    document.getElementById('modalBackdrop').classList.add('open');

    const targetHash = f.hash;
    const hexChars = '0123456789abcdef';
    let step = 0;
    const box = document.getElementById('matrixHashBox');

    const interval = setInterval(() => {
        step++;
        const locked = Math.floor((step / 16) * targetHash.length);
        let output = targetHash.substring(0, locked);
        for (let i = locked; i < targetHash.length; i++) output += hexChars[Math.floor(Math.random() * 16)];
        box.textContent = output;

        if (step >= 16) {
            clearInterval(interval);
            box.textContent = targetHash;
            const btn = document.getElementById('btnCompareHash');
            if (btn) btn.style.display = 'inline-flex';
        }
    }, 35);
}

function animateHashDiff(fileHash, officialHash) {
    const resBox = document.getElementById('hashCompareResult');
    resBox.innerHTML = `
        <div style="background: var(--bg-subtle); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color);">
            <div id="diffStream" class="mono" style="font-size: 0.8rem; word-break: break-all;"></div>
            <div id="diffVerdict" style="margin-top: 10px; font-size: 0.85rem; font-weight: 600;"></div>
        </div>
    `;
    const stream = document.getElementById('diffStream');
    const verdict = document.getElementById('diffVerdict');
    let i = 0, mismatch = false;

    const scanInterval = setInterval(() => {
        for (let c = 0; c < 4 && i < fileHash.length; c++, i++) {
            if (fileHash[i] !== officialHash[i]) {
                mismatch = true;
                stream.innerHTML += `<span class="hash-char-diff">${escapeHTML(fileHash[i])}</span>`;
            } else {
                stream.innerHTML += `<span class="hash-char-match">${escapeHTML(fileHash[i])}</span>`;
            }
        }
        if (i >= fileHash.length) {
            clearInterval(scanInterval);
            verdict.style.color = mismatch ? 'var(--danger)' : 'var(--safe)';
            verdict.innerHTML = mismatch ? '❌ MISMATCH! Karakter merah menunjukkan file telah dimodifikasi/disisipi malware. Wajib dihapus!' : '✅ 100% IDENTIK & AMAN! Checksum sesuai dengan rilis resmi.';
        }
    }, 25);
}

// 8. KEPUTUSAN TINDAKAN USER — dinilai oleh server
async function takeAction(idx, action) {
    if (isRequestPending) return;
    const stage = activeStage;
    const c = sessionScenarios[stage];
    const f = c.files[idx];
    if (f.status) return;

    isRequestPending = true;
    renderFiles();
    let res;
    try {
        res = await simApi(`/${encodeURIComponent(sessionId)}/decide`, {
            file_id: f.id,
            action: action === 'OPEN' ? 'open' : 'delete',
            inspected: Boolean(f.inspected)
        });
    } catch (e) {
        isRequestPending = false;
        if (stage === activeStage) renderFiles();
        showGameError(e.message);
        return;
    }
    isRequestPending = false;

    f.payloadStatus = res.payload_status;
    if (res.outcome === 'malware_opened') f.status = 'INFECTED';
    else if (res.outcome === 'false_alarm') f.status = 'FALSE_ALARM';
    else f.status = res.is_malware ? 'QUARANTINED_CORRECT' : 'OPENED_SAFE';
    setScore(res.current_score);

    if (res.scenario_done) {
        c.result = {
            ending_type: res.ending_type,
            ending: res.ending,
            lesson_title: res.lesson_title,
            lesson_body: res.lesson_body,
            real_life_tip: res.real_life_tip
        };
    }

    if (f.status === 'INFECTED') {
        const panel = document.getElementById('sandboxPanel');
        panel.classList.remove('malware-triggered');
        void panel.offsetWidth;
        panel.classList.add('malware-triggered');

        document.getElementById('modalTitle').innerHTML = `<span style="color: var(--danger);">🚨 PERINGATAN: MALWARE DIEKSEKUSI!</span>`;
        document.getElementById('modalContent').innerHTML = `
            <p style="font-size: 0.92rem;">Kamu membuka file berbahaya: <strong class="mono">${escapeHTML(f.realName)}</strong>!</p>
            <div style="margin-top: 12px; padding: 12px; background: var(--danger-soft); border-left: 3px solid var(--danger); border-radius: 6px; font-size: 0.85rem;">
                <strong>Mengapa file ini berbahaya?</strong><br>
                • Header/Magic Bytes: <code>${escapeHTML(f.magicBytes)}</code><br>
                • Analisis Payload: <code>${escapeHTML(f.payloadStatus)}</code>
            </div>
        `;
        document.getElementById('modalBackdrop').classList.add('open');
    }

    if (stage === activeStage) {
        renderFiles();
        if (c.result) showScenarioLessonWithEnding(c);
    }
}

function showScenarioLessonWithEnding(c) {
    const drawer = document.getElementById('feedbackDrawer');
    if (!drawer || !c.result) return;
    const r = c.result;

    // Teks ending & pembahasan berasal dari data/skenario.json di server (boleh berisi <strong>, <code>)
    const endingHtml = `<div class="ending-box ${r.ending_type === 'bad' ? 'ending-bad' : 'ending-good'}">${r.ending}</div>`;

    drawer.innerHTML = `
        <div style="font-size: 0.75rem; font-weight: 700; color: var(--accent); text-transform: uppercase;">
            📖 Akhir Cerita &amp; Pembahasan Kasus ${activeStage}
        </div>
        ${endingHtml}
        <h3 style="font-size: 1.02rem; margin-top: 14px;">${r.lesson_title}</h3>
        <p style="font-size: 0.87rem; color: var(--text-secondary); margin-top: 4px;">${r.lesson_body}</p>
        <div style="margin-top: 10px; padding: 10px 12px; background: var(--bg-surface); border-radius: 8px; border: 1px solid var(--border-color); font-size: 0.84rem;">
            🛠️ <strong>Tips Dunia Nyata:</strong> ${r.real_life_tip}
        </div>
    `;
    drawer.classList.add('show');
}

async function showHint() {
    const c = sessionScenarios[activeStage];
    if (!c || !sessionId) return;

    let hint = hintCache[c.id];
    if (!hint) {
        try {
            hint = await simApi(`/${encodeURIComponent(sessionId)}/hint`, { scenario_id: c.id });
        } catch (e) {
            showGameError(e.message);
            return;
        }
        hintCache[c.id] = hint;
        setScore(hint.current_score);
    }

    document.getElementById('modalTitle').textContent = '💡 Bantuan Analis Satgas (-5 Pts)';
    document.getElementById('modalContent').innerHTML = `
        <div style="padding: 12px; background: var(--bg-subtle); border-radius: 8px; border-left: 3px solid var(--accent);">
            <div style="font-size: 0.78rem; color: var(--accent); font-weight: 700; margin-bottom: 4px;">
                🎙️ Pesan dari ${escapeHTML(hint.hint_author)}:
            </div>
            <p style="font-size: 0.9rem;">"${escapeHTML(hint.hint_text)}"</p>
        </div>
    `;
    document.getElementById('modalBackdrop').classList.add('open');
}

async function nextScenario() {
    if (!sessionId || isRequestPending) return;
    const currentFiles = sessionScenarios[activeStage].files;
    const allAnswered = currentFiles.every(f => f.status !== undefined && f.status !== null);

    if (!allAnswered) {
        document.getElementById('modalTitle').textContent = '⚠️ Tindakan Belum Lengkap';
        document.getElementById('modalContent').innerHTML = `<p style="font-size: 0.9rem;">Selesaikan keputusan (<strong>Buka File</strong> atau <strong>Hapus File</strong>) pada seluruh file di folder ini sebelum lanjut!</p>`;
        document.getElementById('modalBackdrop').classList.add('open');
        return;
    }

    if (activeStage < 3) {
        switchScenario(activeStage + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }

    isRequestPending = true;
    try {
        await simApi(`/${encodeURIComponent(sessionId)}/finish`);
    } catch (e) {
        isRequestPending = false;
        showGameError(e.message);
        return;
    }

    // Hanya session id yang diteruskan ke result.html. Skor, diagnosis & riwayat
    // diambil result.js langsung dari server (GET /api/session/<sid>/result).
    localStorage.setItem('filemate_session_id', sessionId);
    ['filemate_final_score', 'filemate_seconds', 'filemate_mistakes', 'filemate_history']
        .forEach(k => localStorage.removeItem(k)); // sisa versi lama
    isNavigatingIntentionally = true;
    window.location.href = 'result.html';
}
document.addEventListener('DOMContentLoaded', initSandboxSession);
