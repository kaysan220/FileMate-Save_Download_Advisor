/* =========================================================
   GAME.JS — Engine Lab Simulasi, Onboarding Nama Awal, & 3 Variasi Ending
   ========================================================= */

let sessionScenarios = {};
let activeStage = 1;
let currentScore = 100;
let secondsElapsed = 0;
let sessionTimerInterval = null;
let currentAgentRawName = '';
let currentAgentMaskedName = 'A****M';
let mistakeTracker = { SPOOFING: 0, HASH: 0, FATIGUE: 0, IMPULSIVE: 0 };
let actionHistoryLog = [];
let isNavigatingIntentionally = false;
let ransomTimerInterval = null;
let liveTelemetryInterval = null;

const GAME_SVGS = {
    folder: `<svg class="svg-inline" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
    file: `<svg class="svg-inline" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
    search: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    hash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>`,
    open: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
    trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
    check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    shield: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    alert: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    lock: `<svg class="svg-inline" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
    book: `<svg class="svg-inline" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
    tool: `<svg class="svg-inline" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`
};

function maskAgentName(raw) {
    const clean = String(raw || '').trim().replace(/[<>"'&]/g, '');
    if (!clean) return 'A****M';
    return clean.length > 1
        ? `${clean[0].toUpperCase()}****${clean[clean.length - 1].toUpperCase()}`
        : `${clean.toUpperCase()}****`;
}

function stripLeadingEmojis(htmlStr) {
    return String(htmlStr || '')
        .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
        .trim();
}

function shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function startSessionTimer() {
    clearInterval(sessionTimerInterval);
    sessionTimerInterval = setInterval(() => {
        secondsElapsed++;
        const m = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
        const s = String(secondsElapsed % 60).padStart(2, '0');
        const el = document.getElementById('timerIndicator');
        if (el) el.textContent = `${m}:${s}`;
    }, 1000);
}

// =========================================================
// GERBANG INPUT NAMA AGEN DI AWAL MASUK PLAY.HTML
// =========================================================
function promptAgentNameAtStart() {
    const backdrop = document.getElementById('modalBackdrop');
    const closeBtn = document.getElementById('modalCloseBtn');
    if (!backdrop) {
        startSessionTimer();
        return;
    }
    if (closeBtn) closeBtn.style.display = 'none';

    const savedRaw = localStorage.getItem('filemate_agent_raw') || '';
    const initialMasked = maskAgentName(savedRaw || 'Anonim');

    document.getElementById('modalTitle').innerHTML = `
        <span style="display:inline-flex;align-items:center;gap:8px;">
            ${GAME_SVGS.shield} Registrasi Agen Investigasi Satgas
        </span>
    `;
    document.getElementById('modalContent').innerHTML = `
        <p style="font-size: 0.88rem; color: var(--text-secondary); line-height: 1.55; margin-bottom: 14px;">
            Sebelum memulai 3 Kasus Investigasi, masukkan nama panggilanmu. Demi privasi, namamu akan <strong>otomatis disamarkan (Pseudonimisasi)</strong> pada Papan Peringkat.
        </p>
        <div style="background: var(--bg-subtle); padding: 14px; border-radius: 10px; border: 1px solid var(--border-color);">
            <label style="font-size: 0.78rem; color: var(--text-muted); display: block; margin-bottom: 6px;">
                Nama Panggilan / Inisial Agen:
            </label>
            <input type="text" id="startAgentInput" class="pin-input-clean" maxlength="18" placeholder="Ketik nama panggilanmu (contoh: Fardan)..." value="${escapeHTML(savedRaw)}" oninput="updateLiveMaskedPreview(this.value)" onkeydown="if(event.key==='Enter') confirmStartAgentSession()">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; font-size: 0.8rem;">
                <span style="color: var(--text-muted);">Tampilan di Papan Peringkat:</span>
                <strong id="liveMaskedPreview" class="mono" style="color: var(--safe); background: var(--safe-soft); padding: 2px 10px; border-radius: 4px;">${escapeHTML(initialMasked)}</strong>
            </div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border-color);">
            <a href="index.html" class="btn btn-ghost btn-sm" onclick="isNavigatingIntentionally=true;">&larr; Kembali ke Beranda</a>
            <button type="button" class="btn btn-primary btn-sm" onclick="confirmStartAgentSession()">
                Mulai Investigasi Sekarang &rarr;
            </button>
        </div>
    `;
    backdrop.classList.add('open');

    setTimeout(() => {
        const inp = document.getElementById('startAgentInput');
        if (inp) inp.focus();
    }, 80);
}

function updateLiveMaskedPreview(val) {
    const prev = document.getElementById('liveMaskedPreview');
    if (prev) prev.textContent = maskAgentName(val || 'Anonim');
}

function confirmStartAgentSession() {
    const inp = document.getElementById('startAgentInput');
    const rawVal = (inp ? inp.value.trim() : '') || 'Anonim';
    currentAgentRawName = rawVal.replace(/[<>"'&]/g, '');
    currentAgentMaskedName = maskAgentName(currentAgentRawName);

    localStorage.setItem('filemate_agent_raw', currentAgentRawName);
    localStorage.setItem('filemate_agent_masked', currentAgentMaskedName);

    const agentBadge = document.getElementById('agentNameIndicator');
    if (agentBadge) agentBadge.textContent = currentAgentMaskedName;

    const closeBtn = document.getElementById('modalCloseBtn');
    if (closeBtn) closeBtn.style.display = '';

    closeModal();
    startSessionTimer();
}

function confirmRestartSimulation(targetUrl = 'play.html') {
    const backdrop = document.getElementById('modalBackdrop');
    if (!backdrop) {
        isNavigatingIntentionally = true;
        window.location.href = targetUrl;
        return;
    }
    const closeBtn = document.getElementById('modalCloseBtn');
    if (closeBtn) closeBtn.style.display = '';

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

function initSandboxSession() {
    if (!document.getElementById('sandboxPanel') || typeof SCENARIO_BANK === 'undefined') return;

    const pickOne = (pool) => JSON.parse(JSON.stringify(pool[Math.floor(Math.random() * pool.length)]));
    const selectedPool = [
        pickOne(SCENARIO_BANK.SPOOFING),
        pickOne(SCENARIO_BANK.HASH),
        pickOne(SCENARIO_BANK.FATIGUE)
    ];

    const randomizedOrder = shuffleArray(selectedPool);
    randomizedOrder.forEach((scen, index) => {
        scen.files = shuffleArray(scen.files);
        sessionScenarios[index + 1] = scen;
    });

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
    promptAgentNameAtStart();
}

function switchScenario(num) {
    activeStage = num;
    const c = sessionScenarios[num];
    document.getElementById('stageIndicator').textContent = `Kasus ${num} dari 3`;
    document.getElementById('caseTitle').textContent = `Kasus ${num}: ${c.title}`;
    document.getElementById('caseStory').textContent = c.story;
    document.getElementById('folderPath').innerHTML = `${GAME_SVGS.folder} ${escapeHTML(c.path)}`;

    const hashBox = document.getElementById('officialHashBox');
    const hashValContainer = document.getElementById('officialHashValue');
    const filesWithHash = c.files.filter(f => f.expectedHash);

    if (hashBox && hashValContainer) {
        if (filesWithHash.length > 0) {
            hashBox.style.display = 'block';
            hashValContainer.innerHTML = filesWithHash.map(f => `
                <div style="margin-top: 6px; padding: 6px 10px; background: var(--bg-surface); border-radius: 6px; border: 1px solid var(--border-color);">
                    <span style="color: var(--accent); font-weight: 700;">${GAME_SVGS.file} ${escapeHTML(f.shownName.trim())}</span><br>
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
            actionArea = `<span class="file-status-tag" style="background: var(--safe-soft); color: var(--safe);">${GAME_SVGS.check} Dibuka (Aman)</span>`;
        } else if (f.status === 'QUARANTINED_CORRECT') {
            actionArea = `<span class="file-status-tag" style="background: var(--safe-soft); color: var(--safe);">${GAME_SVGS.shield} Ancaman Telah Terhapus</span>`;
        } else if (f.status === 'INFECTED') {
            actionArea = `<span class="file-status-tag" style="background: var(--danger-soft); color: var(--danger);">${GAME_SVGS.alert} Malware Terpicu (-15 Pts)</span>`;
        } else if (f.status === 'FALSE_ALARM') {
            actionArea = `<span class="file-status-tag" style="background: var(--warning-soft); color: var(--warning);">${GAME_SVGS.alert} File Aman Dihapus (-5 Pts)</span>`;
        } else {
            actionArea = `
                <button class="btn btn-safe btn-sm" onclick="takeAction(${idx}, 'OPEN')">${GAME_SVGS.open} Buka File</button>
                <button class="btn btn-danger btn-sm" onclick="takeAction(${idx}, 'QUARANTINE')">${GAME_SVGS.trash} Hapus File</button>
            `;
        }

        const inspectedBadge = f.inspected ? `<span style="font-size: 0.72rem; color: var(--accent); margin-left: 6px;">[Diperiksa]</span>` : '';

        const row = document.createElement('div');
        row.className = 'file-item';
        row.innerHTML = `
            <div>
                <strong class="mono" style="font-size: 0.95rem;">${GAME_SVGS.file} ${escapeHTML(f.shownName)}</strong>
                <span style="font-size: 0.8rem; color: var(--text-muted); margin-left: 6px;">(${escapeHTML(f.size)})</span>
                ${inspectedBadge}
            </div>
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                <button class="btn btn-ghost btn-sm" onclick="openXrayAnimated(${idx})">${GAME_SVGS.search} X-Ray Inspect</button>
                <button class="btn btn-ghost btn-sm" onclick="openHashAnimated(${idx})">${GAME_SVGS.hash} Cek SHA-256</button>
                ${actionArea}
            </div>
        `;
        container.appendChild(row);
    });

    document.getElementById('progressStatus').textContent = `Diselesaikan: ${doneCount} / ${c.files.length} file`;

    if (doneCount === c.files.length) {
        showScenarioLessonWithEnding(c);
    }
}

function openXrayAnimated(idx) {
    const f = sessionScenarios[activeStage].files[idx];
    f.inspected = true;
    renderFiles();

    document.getElementById('modalTitle').textContent = 'Forensic X-Ray Table // Bedah Fisik & Biner Berkas';
    document.getElementById('modalContent').innerHTML = `<div id="xrayFinalOutput"></div>`;
    document.getElementById('modalBackdrop').classList.add('open');

    const baseName = f.realName.replace(f.fakeExt || '', '').replace(f.realExt, '');
    const visualName = f.fakeExt
        ? `${escapeHTML(baseName)}<span class="ext-badge ext-fake">${escapeHTML(f.fakeExt)} (Disguise)</span> &rarr; <span class="ext-badge ext-danger">${escapeHTML(f.realExt)} (Real Binary)</span>`
        : `${escapeHTML(baseName)}<span class="ext-badge ${f.isMalware ? 'ext-danger' : 'ext-safe'}">${escapeHTML(f.realExt)}</span>`;

    const claimedType = f.fakeExt ? `CLAIMED: ${f.fakeExt.toUpperCase()}` : `SURFACE: ${f.realExt.toUpperCase()}`;

    const desk2D = typeof buildForensicDesk2D === 'function' ? buildForensicDesk2D({
        stageId: 'modalForensicStage',
        shownName: f.shownName.trim(),
        claimedType: claimedType,
        realSignature: f.magicBytes,
        realMime: f.mime,
        perm: f.perm,
        isThreat: f.isMalware,
        payloadNote: f.payloadStatus,
        visualNameHTML: visualName,
        permText: f.perm
    }) : '';

    const maskedTopTarget = `${escapeHTML(f.shownName.trim())} <span class="ext-badge" style="background:#152238;color:#94A3B8;border:1px solid #1E2F4D;">[SAPU 100% UNTUK BUKA EKSTENSI]</span>`;

    const out = document.getElementById('xrayFinalOutput');
    out.className = 'reveal-anim';
    out.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:6px;">
            <span class="mono" style="font-size:0.78rem;color:var(--text-muted);">TARGET: <strong id="modalForensicStage_topTarget" style="color:var(--text-primary);">${maskedTopTarget}</strong></span>
            <span class="mono" id="modalForensicStage_topPerm" style="font-size:0.75rem;color:var(--accent);">PERMISSION: [TERKUNCI]</span>
        </div>
        ${desk2D}
    `;

    if (typeof attachForensicDeskEvents === 'function') {
        attachForensicDeskEvents('modalForensicStage');
    }
}

function openHashAnimated(idx) {
    const f = sessionScenarios[activeStage].files[idx];
    f.inspected = true;
    renderFiles();

    const targetOfficialHash = f.expectedHash || (sessionScenarios[activeStage].officialHash && f.realName.endsWith('.zip') ? sessionScenarios[activeStage].officialHash : null);
    document.getElementById('modalTitle').textContent = 'Pencocokan Segel Keaslian File (SHA-256)';

    const seal2D = typeof buildMechanicalSeal2D === 'function' ? buildMechanicalSeal2D({
        stageId: 'modalSealStage',
        fileHash: f.hash,
        officialHash: targetOfficialHash
    }) : '';

    document.getElementById('modalContent').innerHTML = `
        <div style="font-size: 0.84rem; color: var(--text-secondary); margin-bottom: 8px;">
            Berkas yang diperiksa: <strong class="mono" style="color: var(--text-primary);">${escapeHTML(f.shownName.trim())}</strong>
        </div>

        ${seal2D}

        <div style="background: var(--bg-subtle); padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color); margin-top: 10px; font-size: 0.76rem;">
            <div style="color: var(--text-muted); margin-bottom: 4px;">Detail Kode SHA-256 Lengkap (Output <code>sha256sum</code>):</div>
            <div class="mono" style="color: var(--accent); word-break: break-all;">${escapeHTML(f.hash)}</div>
            ${targetOfficialHash ? `
                <div style="color: var(--text-muted); margin-top: 8px; margin-bottom: 4px;">Kode SHA-256 Resmi dari Pengirim:</div>
                <div class="mono" style="color: var(--text-secondary); word-break: break-all;">${escapeHTML(targetOfficialHash)}</div>
            ` : `
                <div style="color: var(--text-muted); margin-top: 6px;">
                    <em>Catatan: Pengirim tidak mencantumkan kode resmi untuk file ini. Pastikan kamu memeriksa isi dalamnya lewat tombol <strong>X-Ray Inspect</strong>.</em>
                </div>
            `}
        </div>
    `;
    document.getElementById('modalBackdrop').classList.add('open');

    if (targetOfficialHash && typeof engageMechanicalSealLock === 'function') {
        const isMatch = f.hash.toLowerCase() === targetOfficialHash.toLowerCase();
        setTimeout(() => {
            engageMechanicalSealLock('modalSealStage', isMatch);
        }, 350);
    }
}

function takeAction(idx, action) {
    const c = sessionScenarios[activeStage];
    const f = c.files[idx];

    if (!f.inspected) {
        mistakeTracker.IMPULSIVE++;
        const panel = document.getElementById('sandboxPanel');
        if (panel) {
            panel.classList.remove('shake-error');
            void panel.offsetWidth;
            panel.classList.add('shake-error');
        }
        document.getElementById('modalTitle').innerHTML = `${GAME_SVGS.lock} Prinsip Zero Trust: Wajib Inspeksi File!`;
        document.getElementById('modalContent').innerHTML = `
            <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.6;">
                Kamu belum memeriksa berkas <strong class="mono" style="color: var(--text-primary);">${escapeHTML(f.shownName)}</strong>!<br><br>
                Dalam prosedur keamanan siber, mengeksekusi atau menghapus berkas secara menebak-nebak sangat berbahaya. Silakan klik tombol <strong>X-Ray Inspect</strong> atau <strong>Cek SHA-256</strong> terlebih dahulu pada berkas ini sebelum mengambil keputusan.
            </p>
            <div style="display: flex; justify-content: flex-end; margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border-color);">
                <button type="button" class="btn btn-primary btn-sm" onclick="closeModal()">Mengerti, Saya Periksa Dulu</button>
            </div>
        `;
        document.getElementById('modalBackdrop').classList.add('open');
        return;
    }

    if (action === 'OPEN' && f.isMalware) {
        f.status = 'INFECTED';
        mistakeTracker[c.type]++;
        updateScore(-15);
        actionHistoryLog.push({ file: f.realName, stage: activeStage, userAction: "Dibuka", correct: false, note: "Malware Terpicu (-15 Pts)" });

        const panel = document.getElementById('sandboxPanel');
        panel.classList.remove('malware-triggered');
        void panel.offsetWidth;
        panel.classList.add('malware-triggered');

        showToastNotification(`<strong style="color: var(--danger);">BAHAYA: Berkas '${escapeHTML(f.shownName)}' mengeksekusi payload berbahaya! (-15 Pts)</strong>`);
    } else if (action === 'OPEN' && !f.isMalware) {
        f.status = 'OPENED_SAFE';
        actionHistoryLog.push({ file: f.realName, stage: activeStage, userAction: "Dibuka", correct: true, note: "Tepat (File Aman)" });
    } else if (action === 'QUARANTINE' && f.isMalware) {
        f.status = 'QUARANTINED_CORRECT';
        actionHistoryLog.push({ file: f.realName, stage: activeStage, userAction: "Hapus", correct: true, note: "Tepat (Ancaman Dihapus)" });
    } else if (action === 'QUARANTINE' && !f.isMalware) {
        f.status = 'FALSE_ALARM';
        mistakeTracker[c.type]++;
        updateScore(-5);
        actionHistoryLog.push({ file: f.realName, stage: activeStage, userAction: "Hapus", correct: false, note: "Salah Hapus File Aman (-5 Pts)" });
        showToastNotification(`<strong style="color: var(--warning);">PERINGATAN: Kamu menghapus berkas aman '${escapeHTML(f.shownName)}'! (-5 Pts)</strong>`);
    }
    renderFiles();
}

function startTypewriter(elementId, text, speed = 14) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.innerHTML = '';
    let i = 0;
    const interval = setInterval(() => {
        if (!document.getElementById(elementId)) {
            clearInterval(interval);
            return;
        }
        if (i < text.length) {
            if (text.substr(i, 4) === '<br>') {
                el.innerHTML += '<br>';
                i += 4;
            } else {
                el.innerHTML += text.charAt(i);
                i++;
            }
        } else {
            clearInterval(interval);
        }
    }, speed);
}

function buildBadEndingWings() {
    const leftRows = [
        ['PID 1308', 'Malware_Exec.bin'],
        ['PID 1094', 'Ransomware_Lock'],
        ['PID 2188', 'Session_Stealer'],
        ['PID 1222', 'Akun_Email_Sync'],
        ['PID 1658', 'C2_Exfil_Socket']
    ];

    const leftTableRowsHTML = leftRows.map((r, idx) => `
        <tr class="wing-proc-row ${idx === 0 ? 'active-scan-row' : ''}">
            <td>${r[0]}</td>
            <td>${r[1]}</td>
        </tr>
    `).join('');

    return {
        leftWing: `
            <div class="cyber-wing-col">
                <div class="wing-module-box">
                    <div class="wing-top-tabs">
                        <div class="wing-tab-alert">${GAME_SVGS.alert} WARNING</div>
                        <div class="wing-tab-muted"><span>SYSTEM</span><span>//</span></div>
                    </div>
                    <div class="wing-solid-banner">
                        <span>WARNING</span>
                        <span>SYS_0${activeStage}</span>
                    </div>
                    <div class="wing-body-pad">
                        <div class="wing-stat-row">
                            <span>System Binary</span>
                            <div class="wing-bar-track"><div class="wing-bar-fill" id="wingBar1" style="width: 82%;"></div></div>
                        </div>
                        <div class="wing-stat-row">
                            <span>Status Stream</span>
                            <div class="wing-bar-track"><div class="wing-bar-fill" id="wingBar2" style="width: 64%;"></div></div>
                        </div>
                        <div class="wing-stat-row">
                            <span>System Status</span>
                            <strong style="color: #F87171; font-size: 0.65rem;">COMPROMISED</strong>
                        </div>
                    </div>
                </div>

                <div class="wing-module-box">
                    <div class="wing-solid-banner">
                        <span>TRIGGER ACTIVE</span>
                        <span>TRG // 01</span>
                    </div>
                    <div class="wing-trigger-grid">
                        <div class="wing-excl-box">!</div>
                        <div>
                            <div style="height: 6px; width: 75%; background: rgba(248,113,113,0.35); border-radius: 3px; margin-bottom: 6px;"></div>
                            <div style="height: 6px; width: 50%; background: rgba(148,163,184,0.2); border-radius: 3px; margin-bottom: 6px;"></div>
                            <div style="text-align: right; font-size: 0.6rem; color: #64748B; letter-spacing: 2px;">////</div>
                        </div>
                    </div>
                </div>

                <div class="wing-module-box">
                    <table class="wing-data-table" id="wingLeftTable">
                        <thead>
                            <tr><th>DATA</th><th>DESCRIPTION</th></tr>
                        </thead>
                        <tbody>${leftTableRowsHTML}</tbody>
                    </table>
                </div>
            </div>
        `,
        rightWing: `
            <div class="cyber-wing-col">
                <div class="wing-module-box">
                    <div class="wing-top-tabs">
                        <div class="wing-tab-alert">/// CASE 0${activeStage}</div>
                        <div class="wing-tab-muted"><span>IAI</span><span>_ ■ ✕</span></div>
                    </div>
                    <div class="wing-body-pad">
                        <div class="wing-stat-row">
                            <span>SYSTEM</span>
                            <strong style="color: #E2E8F0;">ACTIVE</strong>
                        </div>
                        <div class="wing-stat-row">
                            <span>EXFIL RATIO</span>
                            <strong id="wingLoadPct" style="color: #F87171;">38%</strong>
                        </div>
                        <div class="wing-bar-track" style="width: 100%; margin-top: 4px;">
                            <div class="wing-bar-fill" id="wingBar3" style="width: 38%;"></div>
                        </div>
                    </div>
                </div>

                <div class="wing-module-box">
                    <div class="wing-solid-banner">
                        <span>TRIGGER ACTIVE</span>
                        <span>LOCK // 02</span>
                    </div>
                    <div class="wing-trigger-grid">
                        <div class="wing-excl-box" style="animation: none;">
                            <svg class="wing-gear-spin" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="3"/>
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                            </svg>
                        </div>
                        <div>
                            <div style="font-size: 0.62rem; color: #94A3B8; margin-bottom: 4px;">ACTIVE MONITOR</div>
                            <div class="wing-bar-track" style="width: 100%;"><div class="wing-bar-fill" id="wingBar4" style="width: 74%;"></div></div>
                            <div style="text-align: right; font-size: 0.6rem; color: #64748B; letter-spacing: 2px; margin-top: 4px;">////</div>
                        </div>
                    </div>
                </div>

                <div class="wing-module-box">
                    <table class="wing-data-table" id="wingRightTable">
                        <thead>
                            <tr><th>STATUS</th><th>DATA</th><th>COUNT</th></tr>
                        </thead>
                        <tbody>
                            <tr class="wing-stat-tr active-scan-row"><td>S_01</td><td class="wing-num-a">9</td><td class="wing-num-b">0</td></tr>
                            <tr class="wing-stat-tr"><td>D_02</td><td class="wing-num-a">-14</td><td class="wing-num-b">8</td></tr>
                            <tr class="wing-stat-tr"><td>P_03</td><td class="wing-num-a">122</td><td class="wing-num-b">4</td></tr>
                            <tr class="wing-stat-tr"><td>K_04</td><td class="wing-num-a">8</td><td class="wing-num-b">1</td></tr>
                            <tr class="wing-stat-tr"><td>R_05</td><td class="wing-num-a">221</td><td class="wing-num-b">9</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `
    };
}

function buildWarnEndingWings(c) {
    const safeFiles = c.files.filter(f => !f.isMalware);
    const purgedSafe = c.files.filter(f => f.status === 'FALSE_ALARM');
    const remainSafe = safeFiles.length - purgedSafe.length;
    const availPct = safeFiles.length ? Math.round((remainSafe / safeFiles.length) * 100) : 0;

    const dossierCards = purgedSafe.map(f => `
        <div class="purged-dossier-item">
            <div style="color: #FBBF24; font-weight: 700; display: flex; justify-content: space-between;">
                <span>PURGED FILE</span><span>-5 PTS</span>
            </div>
            <div style="color: #E2E8F0; margin-top: 2px; word-break: break-all;">${escapeHTML(f.shownName.trim())}</div>
            <div style="color: #64748B; font-size: 0.58rem; margin-top: 2px;">STATUS: LEGITIMATE DATA LOST</div>
        </div>
    `).join('');

    return {
        leftWing: `
            <div class="cyber-wing-col">
                <div class="wing-module-box">
                    <div class="wing-solid-banner">
                        <span>PURGED DOCUMENT DOSSIER</span>
                        <span>${purgedSafe.length} LOST</span>
                    </div>
                    <div class="wing-body-pad">
                        ${dossierCards}
                    </div>
                </div>

                <div class="wing-module-box">
                    <div class="wing-top-tabs">
                        <div class="wing-tab-alert">CIA TRIAD</div>
                        <div class="wing-tab-muted"><span>AUDIT</span><span>//</span></div>
                    </div>
                    <div class="wing-body-pad">
                        <div class="wing-stat-row">
                            <span>CONFIDENTIALITY</span>
                            <strong style="color: #2CE574;">SAFE</strong>
                        </div>
                        <div class="wing-stat-row">
                            <span>INTEGRITY</span>
                            <strong style="color: #2CE574;">INTACT</strong>
                        </div>
                        <div class="wing-stat-row">
                            <span>AVAILABILITY</span>
                            <strong style="color: #FBBF24;">DEGRADED (${availPct}%)</strong>
                        </div>
                    </div>
                </div>
            </div>
        `,
        rightWing: `
            <div class="cyber-wing-col">
                <div class="wing-module-box">
                    <div class="wing-solid-banner">
                        <span>DATA AVAILABILITY GAUGE</span>
                        <span>LIVE</span>
                    </div>
                    <div class="avail-gauge-wrap">
                        <svg width="130" height="130" viewBox="0 0 120 120">
                            <circle cx="60" cy="60" r="48" fill="none" stroke="#152238" stroke-width="10"/>
                            <circle cx="60" cy="60" r="48" fill="none" stroke="#FBBF24" stroke-width="10"
                                stroke-dasharray="301" stroke-dashoffset="${Math.round(301 * (1 - availPct / 100))}"
                                transform="rotate(-90 60 60)" stroke-linecap="round"/>
                            <text x="60" y="58" text-anchor="middle" fill="#FBBF24" font-family="JetBrains Mono, monospace" font-size="20" font-weight="800">${availPct}%</text>
                            <text x="60" y="74" text-anchor="middle" fill="#94A3B8" font-family="JetBrains Mono, monospace" font-size="8">AVAILABILITY</text>
                        </svg>
                        <div style="font-size: 0.64rem; color: #CBD5E1; margin-top: 4px;">
                            Dokumen Sah Tersisa: <strong>${remainSafe} dari ${safeFiles.length}</strong>
                        </div>
                    </div>
                </div>

                <div class="wing-module-box">
                    <div class="wing-body-pad">
                        <div class="wing-stat-row">
                            <span>FALSE POSITIVE PENALTY</span>
                            <strong style="color: #FBBF24;">-${purgedSafe.length * 5} PTS</strong>
                        </div>
                        <div class="wing-bar-track" style="width: 100%; margin-top: 6px;">
                            <div class="wing-bar-fill" id="wingBar3" style="width: ${availPct}%;"></div>
                        </div>
                    </div>
                </div>
            </div>
        `
    };
}

function buildGoodEndingWings(c) {
    const fileAuditRows = c.files.slice(0, 6).map((f, idx) => `
        <tr class="wing-proc-row ${idx === 0 ? 'active-scan-row' : ''}">
            <td style="max-width: 125px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHTML(f.shownName.trim())}</td>
            <td style="color: #2CE574; font-weight: 700;">${f.isMalware ? 'BLOCKED ✓' : 'VERIFIED ✓'}</td>
        </tr>
    `).join('');

    return {
        leftWing: `
            <div class="cyber-wing-col">
                <div class="wing-module-box">
                    <div class="wing-solid-banner">
                        <span>REAL-TIME AUDIT LOG</span>
                        <span>OK // 100%</span>
                    </div>
                    <table class="wing-data-table" id="wingLeftTable">
                        <thead>
                            <tr><th>TARGET FILE</th><th>VERDICT</th></tr>
                        </thead>
                        <tbody>${fileAuditRows}</tbody>
                    </table>
                </div>

                <div class="wing-module-box">
                    <div class="wing-top-tabs">
                        <div class="wing-tab-alert">ZERO TRUST</div>
                        <div class="wing-tab-muted"><span>PROTOCOL</span><span>✓</span></div>
                    </div>
                    <div class="wing-body-pad">
                        <div class="wing-stat-row"><span>[✓] MAGIC BYTES</span><strong style="color:#2CE574;">AUDITED</strong></div>
                        <div class="wing-stat-row"><span>[✓] SHA-256 SEAL</span><strong style="color:#2CE574;">MATCHED</strong></div>
                        <div class="wing-stat-row"><span>[✓] PERMISSION</span><strong style="color:#2CE574;">LOCKED</strong></div>
                    </div>
                </div>
            </div>
        `,
        rightWing: `
            <div class="cyber-wing-col">
                <div class="wing-module-box">
                    <div class="wing-solid-banner">
                        <span>SYSTEM PULSE MONITOR</span>
                        <span>STABLE</span>
                    </div>
                    <div class="wing-body-pad" style="background: #060B14;">
                        <svg width="100%" height="58" viewBox="0 0 210 58" fill="none">
                            <path d="M0 29 H35 L45 10 L55 48 L65 18 L75 40 L85 29 H125 L135 12 L145 46 L155 20 L165 36 L175 29 H210"
                                stroke="rgba(44,229,116,0.22)" stroke-width="1.5"/>
                            <path class="pulse-wave-path" d="M0 29 H35 L45 10 L55 48 L65 18 L75 40 L85 29 H125 L135 12 L145 46 L155 20 L165 36 L175 29 H210"
                                stroke="#2CE574" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                </div>

                <div class="wing-module-box">
                    <div class="wing-top-tabs">
                        <div class="wing-tab-alert">FIREWALL TRAFFIC</div>
                        <div class="wing-tab-muted"><span>PASS</span><span>100%</span></div>
                    </div>
                    <div class="wing-body-pad">
                        <div class="wing-stat-row">
                            <span>DEFENCE PASS</span>
                            <strong style="color: #2CE574;">100%</strong>
                        </div>
                        <div class="wing-stat-row">
                            <span>SESSION SCORE</span>
                            <strong style="color: #2CE574;">${currentScore} PTS</strong>
                        </div>
                        <div class="wing-stat-row">
                            <span>FALSE ALARMS</span>
                            <strong style="color: #2CE574;">0 INCIDENTS</strong>
                        </div>
                        <div class="wing-bar-track" style="width: 100%; margin-top: 6px;">
                            <div class="wing-bar-fill" style="width: 100%;"></div>
                        </div>
                    </div>
                </div>
            </div>
        `
    };
}

function startLiveWingTelemetry() {
    clearInterval(liveTelemetryInterval);
    let activeIdx = 0;
    liveTelemetryInterval = setInterval(() => {
        if (!document.getElementById('cyberFullscreenOverlay')) {
            clearInterval(liveTelemetryInterval);
            return;
        }

        const leftRows = document.querySelectorAll('#wingLeftTable .wing-proc-row');
        if (leftRows.length > 0) {
            activeIdx = (activeIdx + 1) % leftRows.length;
            leftRows.forEach((r, i) => r.classList.toggle('active-scan-row', i === activeIdx));
        }

        const rightRows = document.querySelectorAll('#wingRightTable .wing-stat-tr');
        if (rightRows.length > 0) {
            rightRows.forEach((r, i) => r.classList.toggle('active-scan-row', i === (rightRows.length - 1 - (activeIdx % rightRows.length))));
        }

        const b1 = document.getElementById('wingBar1');
        const b2 = document.getElementById('wingBar2');
        const b4 = document.getElementById('wingBar4');
        const loadTxt = document.getElementById('wingLoadPct');

        if (b1 && b2) {
            const randPct1 = 55 + Math.floor(Math.random() * 40);
            const randPct2 = 40 + Math.floor(Math.random() * 55);
            const randPct3 = 35 + Math.floor(Math.random() * 60);
            b1.style.width = `${randPct1}%`;
            b2.style.width = `${randPct2}%`;
            if (b4) b4.style.width = `${randPct1}%`;
            if (loadTxt) loadTxt.textContent = `${randPct3}%`;
        }

        document.querySelectorAll('#wingRightTable .wing-num-a').forEach(cell => {
            cell.textContent = Math.floor(Math.random() * 260) - 15;
        });
        document.querySelectorAll('#wingRightTable .wing-num-b').forEach(cell => {
            cell.textContent = Math.floor(Math.random() * 19);
        });
    }, 380);
}

function showScenarioLessonWithEnding(c) {
    const anyInfected = c.files.some(f => f.status === 'INFECTED');
    const falseAlarmCount = c.files.filter(f => f.status === 'FALSE_ALARM').length;
    const allDeleted = c.files.every(f => f.status === 'QUARANTINED_CORRECT' || f.status === 'FALSE_ALARM');

    let overlay = document.getElementById('cyberFullscreenOverlay');
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.id = 'cyberFullscreenOverlay';

    const cleanBadEnding = stripLeadingEmojis(c.badEnding);
    const cleanGoodEnding = stripLeadingEmojis(c.goodEnding);

    if (anyInfected) {
        const wings = buildBadEndingWings();
        overlay.className = 'cyber-fullscreen-overlay bad-mode heavy-impact-shake';
        overlay.innerHTML = `
            <div class="cyber-hazard-rail cyber-hazard-rail-left"></div>
            <div class="cyber-hazard-rail cyber-hazard-rail-right"></div>
            <div class="hud-corner-bracket tl"></div>
            <div class="hud-corner-bracket tr"></div>
            <div class="hud-corner-bracket bl"></div>
            <div class="hud-corner-bracket br"></div>

            <div class="cyber-lockdown-stage">
                ${wings.leftWing}

                <div class="cyber-terminal-card" id="endingMainCard">
                    <div class="cyber-terminal-header">
                        <span>CRITICAL MALWARE INCIDENT — KASUS ${activeStage}</span>
                        <span class="mono">SYSTEM COMPROMISED</span>
                    </div>
                    <div class="cyber-terminal-body">
                        <div class="cyber-hero-visual">
                            <div class="cyber-icon-badge" id="ransomLockBadge">
                                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#F87171" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" fill="rgba(239,68,68,0.2)"></rect>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                    <circle cx="12" cy="16" r="1.5" fill="#F87171"></circle>
                                </svg>
                            </div>
                            <div class="ransom-headline" style="color: #F87171;">YOUR FILES HAVE BEEN ENCRYPTED</div>
                            <div style="font-size: 0.82rem; color: #FDA4AF;">Simulasi Dampak Eksekusi Malware / Ransomware &amp; Infostealer</div>

                            <div class="ransom-timer-box">
                                <div style="font-size: 0.7rem; color: #FCA5A5; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px;">Time Left Before Data Exfiltration</div>
                                <div class="ransom-timer-digits" id="ransomLiveCountdown">02 : 23 : 59 : 18</div>
                                <div class="ransom-timer-labels">
                                    <span>Days</span><span>Hours</span><span>Minutes</span><span>Seconds</span>
                                </div>
                            </div>
                        </div>

                        <div class="cyber-log-stream mono">
                            <span class="typewriter-log" id="endingLiveLog"></span>
                        </div>

                        <div style="color: var(--text-secondary); font-size: 0.86rem; margin-bottom: 14px; background: rgba(220,38,38,0.08); padding: 12px 14px; border-radius: 8px; border-left: 3px solid var(--danger);">
                            ${cleanBadEnding}
                        </div>

                        <div style="display: flex; justify-content: flex-end;">
                            <button type="button" class="btn btn-danger btn-sm" onclick="dismissCyberOverlay()">Pelajari Evaluasi &amp; Lanjutkan &rarr;</button>
                        </div>
                    </div>
                </div>

                ${wings.rightWing}
            </div>
        `;
        document.body.appendChild(overlay);
        startRansomCountdown();
        startLiveWingTelemetry();

        setTimeout(() => {
            const b = document.getElementById('ransomLockBadge');
            if (b) b.classList.add('slam-active');
            startTypewriter('endingLiveLog', '[!] PAYLOAD EXECUTED: Malicious binary bypassed user verification.<br>[!] CRYPTO-LOCKER: Encrypting local documents & extracting session cookies...');
        }, 220);

    } else if (falseAlarmCount > 0) {
        const wings = buildWarnEndingWings(c);
        overlay.className = 'cyber-fullscreen-overlay warn-mode subtle-hazard-shudder';
        const warnTitle = allDeleted
            ? `DATA AVAILABILITY LOST (SEMUA FILE DIHAPUS!)`
            : `FALSE POSITIVE ALERT (${falseAlarmCount} FILE AMAN TERHAPUS)`;

        const warnDesc = allDeleted
            ? `<strong>Peringatan Prinsip Availability (CIA Triad):</strong> Kamu memang tidak terinfeksi malware, tetapi kamu <strong>menghapus seluruh berkas</strong> di dalam folder ini termasuk dokumen penting yang sah! Di dunia kerja nyata, menghapus semua file secara membabi buta sama merugikannya dengan serangan siber.`
            : `<strong>Evaluasi Ketelitian:</strong> Kamu berhasil menghindari eksekusi malware, tetapi kamu tidak sengaja menghapus <strong>${falseAlarmCount} dokumen asli yang aman</strong> (Penalti <code>-${falseAlarmCount * 5} Pts</code>). Pastikan selalu memverifikasi header <code>%PDF</code>, <code>PNG</code>, atau <code>SHA-256</code> agar dokumen sah tetap terselamatkan!`;

        const warnTickerText = `/// OPERATIONAL WARNING — DATA AVAILABILITY IMPACT — ${falseAlarmCount} LEGITIMATE FILE(S) MISTAKENLY PURGED — ZERO MALWARE INFECTION /// `.repeat(4);

        overlay.innerHTML = `
            <div class="cyber-horiz-ticker top"><div class="ticker-track-move">${warnTickerText}</div></div>
            <div class="cyber-horiz-ticker bottom"><div class="ticker-track-move">${warnTickerText}</div></div>
            <div class="hud-corner-bracket tl"></div>
            <div class="hud-corner-bracket tr"></div>
            <div class="hud-corner-bracket bl"></div>
            <div class="hud-corner-bracket br"></div>

            <div class="cyber-lockdown-stage">
                ${wings.leftWing}

                <div class="cyber-terminal-card" id="endingMainCard">
                    <div class="cyber-terminal-header">
                        <span>OPERATIONAL WARNING — KASUS ${activeStage}</span>
                        <span class="mono">AVAILABILITY IMPACT</span>
                    </div>
                    <div class="cyber-terminal-body">
                        <div class="cyber-hero-visual">
                            <div class="cyber-icon-badge" id="ransomLockBadge">
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" fill="rgba(245,158,11,0.18)"></path>
                                    <line x1="12" y1="9" x2="12" y2="13"></line>
                                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                                </svg>
                            </div>
                            <div class="ransom-headline" style="color: #FBBF24;">${warnTitle}</div>
                            <div style="font-size: 0.82rem; color: #FDE68A;">Bebas Infeksi Malware, Namun Kehilangan Dokumen Sah</div>
                        </div>

                        <div class="cyber-log-stream mono">
                            <span class="typewriter-log" id="endingLiveLog"></span>
                        </div>

                        <div style="color: var(--text-secondary); font-size: 0.86rem; margin-bottom: 16px; background: rgba(217,119,6,0.08); padding: 12px 14px; border-radius: 8px; border-left: 3px solid var(--warning);">
                            ${warnDesc}
                        </div>

                        <div style="display: flex; justify-content: flex-end;">
                            <button type="button" class="btn btn-primary btn-sm" onclick="dismissCyberOverlay()">Mengerti &amp; Lanjutkan &rarr;</button>
                        </div>
                    </div>
                </div>

                ${wings.rightWing}
            </div>
        `;
        document.body.appendChild(overlay);
        startLiveWingTelemetry();

        setTimeout(() => {
            const b = document.getElementById('ransomLockBadge');
            if (b) b.classList.add('slam-active');
            startTypewriter('endingLiveLog', `[!] MALWARE INFECTION: 0 (Blocked)<br>[!] COLLATERAL DAMAGE: ${falseAlarmCount} legitimate file(s) mistakenly deleted (-${falseAlarmCount * 5} Pts).`);
        }, 220);

    } else {
        const wings = buildGoodEndingWings(c);
        overlay.className = 'cyber-fullscreen-overlay good-mode';
        const goodTickerText = `/// STATUS: SYSTEM SAFE /// ZERO THREATS DETECTED /// HUMAN FIREWALL ACTIVE /// SECURITY AUDIT PASSED 100% /// `.repeat(4);

        overlay.innerHTML = `
            <div class="cyber-horiz-ticker top"><div class="ticker-track-move">${goodTickerText}</div></div>
            <div class="cyber-horiz-ticker bottom"><div class="ticker-track-move">${goodTickerText}</div></div>
            <div class="hud-corner-bracket tl"></div>
            <div class="hud-corner-bracket tr"></div>
            <div class="hud-corner-bracket bl"></div>
            <div class="hud-corner-bracket br"></div>

            <div class="cyber-lockdown-stage">
                ${wings.leftWing}

                <div class="cyber-terminal-card" id="endingMainCard">
                    <div class="cyber-terminal-header">
                        <span>SECURITY AUDIT PASSED — KASUS ${activeStage}</span>
                        <span class="mono">HUMAN FIREWALL VERIFIED</span>
                    </div>
                    <div class="cyber-terminal-body">
                        <div class="cyber-hero-visual">
                            <div class="cyber-icon-badge" id="ransomLockBadge">
                                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#2CE574" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="rgba(44,229,116,0.18)"></path>
                                    <polyline points="9 12 11 14 15 10"></polyline>
                                </svg>
                            </div>
                            <div class="ransom-headline" style="color: #2CE574;">SYSTEM SECURED &amp; VERIFIED</div>
                            <div style="font-size: 0.82rem; color: #A7F3D0;">Seluruh Ancaman Dihapus &amp; Dokumen Sah Berhasil Diselamatkan</div>
                        </div>

                        <div class="cyber-soc-grid">
                            <div class="cyber-soc-metric">
                                <span>FILE INTEGRITY</span>
                                <strong style="color: var(--safe);">100% INTACT</strong>
                            </div>
                            <div class="cyber-soc-metric">
                                <span>MALWARE BLOCKED</span>
                                <strong style="color: var(--safe);">QUARANTINED</strong>
                            </div>
                            <div class="cyber-soc-metric">
                                <span>DECISION ACCURACY</span>
                                <strong style="color: var(--safe);">PERFECT</strong>
                            </div>
                        </div>

                        <div class="cyber-log-stream mono">
                            <span class="typewriter-log" id="endingLiveLog"></span>
                        </div>

                        <div style="color: var(--text-secondary); font-size: 0.86rem; margin-bottom: 16px; background: rgba(44,229,116,0.08); padding: 12px 14px; border-radius: 8px; border-left: 3px solid var(--safe);">
                            ${cleanGoodEnding}
                        </div>

                        <div style="display: flex; justify-content: flex-end;">
                            <button type="button" class="btn btn-primary btn-sm" onclick="dismissCyberOverlay()">Lanjutkan &rarr;</button>
                        </div>
                    </div>
                </div>

                ${wings.rightWing}
            </div>
        `;
        document.body.appendChild(overlay);
        startLiveWingTelemetry();

        setTimeout(() => {
            const b = document.getElementById('ransomLockBadge');
            if (b) b.classList.add('slam-active');
            startTypewriter('endingLiveLog', `[!] SCENARIO SUCCESSFUL: Systems fully operational & guarded.<br>[!] THREAT NEUTRALIZED: Signature scanning verifies folder is sterile.`);
        }, 220);
    }

    const drawer = document.getElementById('feedbackDrawer');
    if (drawer) {
        const endingClass = anyInfected ? 'ending-bad' : (falseAlarmCount > 0 ? 'ending-bad' : 'ending-good');
        const endingText = anyInfected ? cleanBadEnding : cleanGoodEnding;
        drawer.innerHTML = `
            <div style="font-size: 0.75rem; font-weight: 700; color: var(--accent); text-transform: uppercase;">
                ${GAME_SVGS.book} Akhir Cerita &amp; Pembahasan Kasus ${activeStage}
            </div>
            <div class="ending-box ${endingClass}">${endingText}</div>
            <h3 style="font-size: 1.02rem; margin-top: 14px;">${c.lessonTitle}</h3>
            <p style="font-size: 0.87rem; color: var(--text-secondary); margin-top: 4px;">${c.lessonBody}</p>
            <div style="margin-top: 10px; padding: 10px 12px; background: var(--bg-surface); border-radius: 8px; border: 1px solid var(--border-color); font-size: 0.84rem;">
                ${GAME_SVGS.tool} <strong>Tips Dunia Nyata:</strong> ${c.realLifeTip}
            </div>
        `;
        drawer.classList.add('show');
    }
}

function startRansomCountdown() {
    clearInterval(ransomTimerInterval);
    let totalSecs = (2 * 86400) + (23 * 3600) + (59 * 60) + 18;
    ransomTimerInterval = setInterval(() => {
        totalSecs = Math.max(0, totalSecs - 1);
        const d = String(Math.floor(totalSecs / 86400)).padStart(2, '0');
        const h = String(Math.floor((totalSecs % 86400) / 3600)).padStart(2, '0');
        const m = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
        const s = String(totalSecs % 60).padStart(2, '0');
        const el = document.getElementById('ransomLiveCountdown');
        if (el) {
            el.textContent = `${d} : ${h} : ${m} : ${s}`;
        } else {
            clearInterval(ransomTimerInterval);
        }
    }, 1000);
}

function dismissCyberOverlay() {
    clearInterval(ransomTimerInterval);
    clearInterval(liveTelemetryInterval);
    const overlay = document.getElementById('cyberFullscreenOverlay');
    if (overlay) overlay.remove();
}

function showHint() {
    updateScore(-5);
    const c = sessionScenarios[activeStage];
    document.getElementById('modalTitle').textContent = 'Bantuan Analis Satgas (-5 Pts)';
    document.getElementById('modalContent').innerHTML = `
        <div style="padding: 12px; background: var(--bg-subtle); border-radius: 8px; border-left: 3px solid var(--accent);">
            <div style="font-size: 0.78rem; color: var(--accent); font-weight: 700; margin-bottom: 4px;">
                Pesan dari ${escapeHTML(c.hintAuthor)}:
            </div>
            <p style="font-size: 0.9rem;">"${escapeHTML(c.hintText)}"</p>
        </div>
    `;
    document.getElementById('modalBackdrop').classList.add('open');
}

function updateScore(delta) {
    currentScore = Math.max(0, currentScore + delta);
    const el = document.getElementById('scoreIndicator');
    if (el) el.textContent = `${currentScore} Pts`;
}

function nextScenario() {
    const currentFiles = sessionScenarios[activeStage].files;
    const allAnswered = currentFiles.every(f => f.status !== undefined && f.status !== null);

    if (!allAnswered) {
        document.getElementById('modalTitle').textContent = 'Tindakan Belum Lengkap';
        document.getElementById('modalContent').innerHTML = `<p style="font-size: 0.9rem;">Selesaikan keputusan (<strong>Buka File</strong> atau <strong>Hapus File</strong>) pada seluruh file di folder ini sebelum lanjut!</p>`;
        document.getElementById('modalBackdrop').classList.add('open');
        return;
    }

    if (activeStage < 3) {
        switchScenario(activeStage + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        isNavigatingIntentionally = true;
        localStorage.setItem('filemate_final_score', currentScore);
        localStorage.setItem('filemate_seconds', secondsElapsed);
        localStorage.setItem('filemate_mistakes', JSON.stringify(mistakeTracker));
        localStorage.setItem('filemate_history', JSON.stringify(actionHistoryLog));
        localStorage.setItem('filemate_session_saved', 'false');
        window.location.href = 'result.html';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initSandboxSession();
});