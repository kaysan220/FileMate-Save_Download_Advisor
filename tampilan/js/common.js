/* =========================================================
   COMMON.JS — Core UI, Scroll Reveal (Dashboard & Guide), & 2D Engines
   ========================================================= */

function escapeHTML(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getThemeButtonHTML(theme) {
    if (theme === 'dark') {
        return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> Light`;
    }
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> Dark`;
}

function initTheme() {
    const saved = localStorage.getItem('filemate_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    const btn = document.getElementById('themeToggle');
    if (btn) btn.innerHTML = getThemeButtonHTML(saved);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('filemate_theme', next);
    const btn = document.getElementById('themeToggle');
    if (btn) btn.innerHTML = getThemeButtonHTML(next);
}

function ensureDashboardNavButton() {
    const navActions = document.querySelector('.nav-actions');
    if (!navActions) return;

    const currentPath = window.location.pathname.toLowerCase();
    const isDashboard = currentPath.endsWith('dashboard.html');
    const hasDashLink = Array.from(navActions.querySelectorAll('a')).some(a =>
        (a.getAttribute('href') || '').includes('dashboard.html')
    );

    if (!isDashboard && !hasDashLink) {
        const dashBtn = document.createElement('a');
        dashBtn.href = 'dashboard.html';
        dashBtn.className = 'btn btn-ghost btn-sm';
        dashBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> Dashboard`;

        if (currentPath.endsWith('play.html')) {
            dashBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (typeof confirmRestartSimulation === 'function') {
                    confirmRestartSimulation('dashboard.html');
                } else {
                    window.location.href = 'dashboard.html';
                }
            });
        }
        navActions.insertBefore(dashBtn, navActions.firstChild);
    }
}

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

// =========================================================
// 0A. ANIMASI SCROLL REVEAL OTOMATIS PADA DASHBOARD.HTML
// =========================================================
function initDashboardScrollReveal() {
    if (!document.querySelector('.dash-hero')) return;

    const singleTargets = document.querySelectorAll(
        '.dash-hero > div:first-child, .hero-dossier-card, .dash-section-label, .dash-section-title, .dash-prose, .dash-firewall'
    );
    singleTargets.forEach((el, idx) => {
        el.classList.add('scroll-reveal-init');
        if (idx < 2) el.style.transitionDelay = `${idx * 90}ms`;
    });

    document.querySelectorAll('#dashStats .stat-tile').forEach((tile, idx) => {
        tile.classList.add('scroll-reveal-init');
        tile.style.transitionDelay = `${idx * 70}ms`;
    });

    document.querySelectorAll('.dash-cards').forEach(group => {
        group.querySelectorAll('.dash-card').forEach((card, idx) => {
            card.classList.add('scroll-reveal-init');
            card.style.transitionDelay = `${idx * 95}ms`;
        });
    });

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('scroll-reveal-visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.14, rootMargin: '0px 0px -30px 0px' });

    document.querySelectorAll('.scroll-reveal-init').forEach(el => observer.observe(el));
}

// =========================================================
// 0B. HERO INTERACTIVE SPLIT-X-RAY CURTAIN (dashboard.html)
// =========================================================
const HERO_EVIDENCE_CASES = [
    {
        outerTitle: 'PDF DOCUMENT',
        outerFile: 'Kontrak_Magang_2026.pdf',
        outerSub: 'Lampiran Email HRD (Tampak Normal)',
        innerHeader: 'DISGUISE: 4D 5A (PE32 .EXE)',
        innerPayload: 'REAL NAME: Kontrak_Magang_2026.pdf.exe',
        stamp: 'DISGUISE DETECTED',
        metaOuter: 'Kontrak_Magang.pdf',
        metaInner: '4D 5A (PE32 .EXE)',
        metaPerm: '-rwxr-xr-x'
    },
    {
        outerTitle: 'ZIP ARCHIVE',
        outerFile: 'Patch_Update_v2.zip',
        outerSub: 'Ukuran & Nama Identik dengan Rilis Resmi',
        innerHeader: 'SHA-256 MISMATCH (TAMPERED)',
        innerPayload: 'PAYLOAD: Trojan Stealer Injected',
        stamp: 'SEAL CORRUPTED',
        metaOuter: 'Patch_Update_v2.zip',
        metaInner: 'SHA-256 MISMATCH',
        metaPerm: '-rw-r--r--'
    },
    {
        outerTitle: 'JPEG IMAGE',
        outerFile: 'Denah_Ruangan_Kantor.jpg',
        outerSub: 'Foto Lampiran Grup Kelas / Kantor',
        innerHeader: 'BINARY HEADER: 4D 5A (MZ EXEC)',
        innerPayload: 'ALERT: Malware Berkedok Gambar .JPG',
        stamp: 'PAYLOAD DETECTED',
        metaOuter: 'Denah_Ruangan.jpg',
        metaInner: '4D 5A (MZ EXEC)',
        metaPerm: '-rwxr-xr-x'
    }
];

let currentHeroSplitPct = 75;

function updateHeroStampBySplit(splitPct) {
    const stampEl = document.getElementById('heroDossierStamp');
    if (!stampEl) return;
    if (splitPct <= 50) {
        stampEl.classList.add('stamped');
    } else {
        stampEl.classList.remove('stamped');
    }
}

function switchHeroEvidence(index) {
    const stage = document.getElementById('heroCurtainStage');
    if (!stage) return;
    const item = HERO_EVIDENCE_CASES[index] || HERO_EVIDENCE_CASES[0];

    document.querySelectorAll('.ev-tab').forEach((btn, idx) => {
        btn.classList.toggle('active', idx === index);
    });

    const normalEl = document.getElementById('heroLayerNormal');
    const xrayEl = document.getElementById('heroLayerXray');
    const stampEl = document.getElementById('heroDossierStamp');

    if (normalEl) {
        normalEl.innerHTML = `
            <svg width="360" height="190" viewBox="0 0 360 190" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="34" y="14" width="292" height="162" rx="6" fill="#E2E8F0" stroke="#94A3B8" stroke-width="2"/>
                <rect x="52" y="30" width="135" height="22" rx="4" fill="#0F172A"/>
                <text x="62" y="45" fill="#38BDF8" font-family="JetBrains Mono, monospace" font-size="10" font-weight="700">${escapeHTML(item.outerTitle)}</text>
                <rect x="52" y="64" width="210" height="8" rx="4" fill="#94A3B8"/>
                <rect x="52" y="80" width="175" height="8" rx="4" fill="#CBD5E1"/>
                <rect x="52" y="96" width="235" height="8" rx="4" fill="#CBD5E1"/>
                <rect x="52" y="122" width="256" height="36" rx="4" fill="#F8FAFC" stroke="#CBD5E1"/>
                <text x="62" y="139" fill="#0F172A" font-family="JetBrains Mono, monospace" font-size="10.5" font-weight="700">${escapeHTML(item.outerFile)}</text>
                <text x="62" y="152" fill="#64748B" font-family="Inter, sans-serif" font-size="9">${escapeHTML(item.outerSub)}</text>
            </svg>
        `;
    }

    if (xrayEl) {
        xrayEl.innerHTML = `
            <svg width="360" height="190" viewBox="0 0 360 190" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="34" y="14" width="292" height="162" rx="6" fill="#140408" stroke="#EF4444" stroke-width="2" stroke-dasharray="6 4"/>
                <path d="M48 45H120L140 65H220L240 45H310" stroke="#DC2626" stroke-width="1.6" opacity="0.7"/>
                <path d="M48 145H110L135 120H230L250 145H310" stroke="#DC2626" stroke-width="1.6" opacity="0.7"/>
                <rect x="146" y="58" width="68" height="68" rx="8" fill="#450A0A" stroke="#F87171" stroke-width="2"/>
                <polygon points="180,68 200,106 160,106" fill="none" stroke="#F87171" stroke-width="2"/>
                <line x1="180" y1="82" x2="180" y2="95" stroke="#F87171" stroke-width="2.2"/>
                <circle cx="180" cy="101" r="2" fill="#F87171"/>
                <rect x="48" y="24" width="264" height="22" rx="4" fill="rgba(220,38,38,0.22)"/>
                <text x="58" y="39" fill="#FCA5A5" font-family="JetBrains Mono, monospace" font-size="10" font-weight="700">${escapeHTML(item.innerHeader)}</text>
                <rect x="48" y="140" width="264" height="22" rx="4" fill="rgba(220,38,38,0.25)"/>
                <text x="58" y="155" fill="#F87171" font-family="JetBrains Mono, monospace" font-size="9.5" font-weight="700">${escapeHTML(item.innerPayload)}</text>
            </svg>
        `;
    }

    if (stampEl) stampEl.textContent = item.stamp;
    const mOut = document.getElementById('heroMetaOuter');
    const mIn = document.getElementById('heroMetaInner');
    const mPerm = document.getElementById('heroMetaPerm');
    if (mOut) mOut.textContent = item.metaOuter;
    if (mIn) mIn.textContent = item.metaInner;
    if (mPerm) mPerm.textContent = item.metaPerm;

    updateHeroStampBySplit(currentHeroSplitPct);
}

function initHeroSplitCurtain() {
    const stage = document.getElementById('heroCurtainStage');
    if (!stage) return;

    currentHeroSplitPct = 75;
    stage.style.setProperty('--split-pos', '75%');
    switchHeroEvidence(0);

    const updateSplit = (clientX) => {
        const rect = stage.getBoundingClientRect();
        const pct = Math.max(8, Math.min(92, ((clientX - rect.left) / rect.width) * 100));
        currentHeroSplitPct = pct;
        stage.style.setProperty('--split-pos', `${pct.toFixed(1)}%`);
        updateHeroStampBySplit(pct);
    };

    stage.addEventListener('pointermove', (e) => updateSplit(e.clientX));
    stage.addEventListener('pointerdown', (e) => updateSplit(e.clientX));
}

// =========================================================
// 1. ENGINE 2D "PAPERS, PLEASE" FORENSIC X-RAY DESK
// =========================================================
const DESK_STATE_MAP = {};

function buildForensicDesk2D(config) {
    const {
        stageId = 'deskStage_1',
        shownName = 'Document.pdf',
        claimedType = 'PDF DOCUMENT',
        realSignature = '25 50 44 46 (%PDF)',
        realMime = 'application/pdf',
        perm = '-rw-r--r--',
        isThreat = false,
        payloadNote = 'Clean',
        visualNameHTML = '',
        permText = ''
    } = config;

    const hasExec = String(perm).includes('x');
    const stampText = isThreat ? 'THREAT DETECTED' : 'VERIFIED AUTHENTIC';
    const stampClass = isThreat ? 'stamp-danger' : 'stamp-safe';

    DESK_STATE_MAP[stageId] = {
        isThreat,
        hasExec,
        visualNameHTML: visualNameHTML || escapeHTML(shownName),
        permText: permText || escapeHTML(perm),
        unlocked: false
    };

    const surfaceSVG = `
        <svg width="360" height="200" viewBox="0 0 360 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="44" y="18" width="276" height="170" rx="6" fill="rgba(0,0,0,0.55)"/>
            <rect x="40" y="14" width="276" height="170" rx="6" fill="#E2E8F0" stroke="#94A3B8" stroke-width="2"/>
            <path d="M286 14L316 44H292C288.686 44 286 41.3137 286 38V14Z" fill="#CBD5E1"/>
            <rect x="58" y="32" width="120" height="22" rx="4" fill="#0F172A"/>
            <text x="68" y="47" fill="#38BDF8" font-family="JetBrains Mono, monospace" font-size="10" font-weight="700">${escapeHTML(claimedType)}</text>
            <rect x="58" y="68" width="210" height="8" rx="4" fill="#94A3B8"/>
            <rect x="58" y="84" width="180" height="8" rx="4" fill="#CBD5E1"/>
            <rect x="58" y="100" width="230" height="8" rx="4" fill="#CBD5E1"/>
            <rect x="58" y="116" width="150" height="8" rx="4" fill="#CBD5E1"/>
            <rect x="58" y="140" width="240" height="28" rx="4" fill="#F8FAFC" stroke="#CBD5E1"/>
            <text x="68" y="158" fill="#0F172A" font-family="JetBrains Mono, monospace" font-size="10" font-weight="700">${escapeHTML(shownName.slice(0, 28))}</text>
        </svg>
    `;

    const xraySVG = isThreat ? `
        <svg width="360" height="200" viewBox="0 0 360 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="40" y="14" width="276" height="170" rx="6" fill="#140408" stroke="#EF4444" stroke-width="2" stroke-dasharray="6 4"/>
            <path d="M55 45H120L140 65H220L240 45H295" stroke="#DC2626" stroke-width="1.8" opacity="0.75"/>
            <path d="M55 155H110L135 130H230L250 155H295" stroke="#DC2626" stroke-width="1.8" opacity="0.75"/>
            <path d="M90 25V80L115 100V170" stroke="#EF4444" stroke-width="1.2" opacity="0.5"/>
            <path d="M270 25V75L245 100V170" stroke="#EF4444" stroke-width="1.2" opacity="0.5"/>
            <g class="xray-core-pulse">
                <rect x="142" y="62" width="76" height="76" rx="8" fill="#450A0A" stroke="#F87171" stroke-width="2.2"/>
                <polygon points="180,74 202,114 158,114" fill="none" stroke="#F87171" stroke-width="2.2"/>
                <line x1="180" y1="88" x2="180" y2="102" stroke="#F87171" stroke-width="2.5"/>
                <circle cx="180" cy="108" r="2" fill="#F87171"/>
            </g>
            <rect x="54" y="24" width="252" height="22" rx="4" fill="rgba(220,38,38,0.22)"/>
            <text x="64" y="39" fill="#FCA5A5" font-family="JetBrains Mono, monospace" font-size="10" font-weight="700">DISGUISE BREACH: ${escapeHTML(realSignature)}</text>
            <rect x="54" y="150" width="252" height="22" rx="4" fill="rgba(220,38,38,0.25)"/>
            <text x="64" y="165" fill="#F87171" font-family="JetBrains Mono, monospace" font-size="9.5" font-weight="700">PAYLOAD: ${escapeHTML(payloadNote.slice(0, 32))}</text>
        </svg>
    ` : `
        <svg width="360" height="200" viewBox="0 0 360 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="40" y="14" width="276" height="170" rx="6" fill="#031810" stroke="#2CE574" stroke-width="2"/>
            <line x1="56" y1="54" x2="300" y2="54" stroke="rgba(44,229,116,0.25)" stroke-width="1"/>
            <line x1="56" y1="98" x2="300" y2="98" stroke="rgba(44,229,116,0.25)" stroke-width="1"/>
            <line x1="56" y1="142" x2="300" y2="142" stroke="rgba(44,229,116,0.25)" stroke-width="1"/>
            <g class="xray-core-pulse">
                <circle cx="180" cy="98" r="36" fill="rgba(44,229,116,0.12)" stroke="#2CE574" stroke-width="2"/>
                <path d="M180 72L200 80V96C200 110 191 120 180 125C169 120 160 110 160 96V80L180 72Z" fill="rgba(44,229,116,0.2)" stroke="#2CE574" stroke-width="2"/>
                <polyline points="171,98 177,104 190,91" fill="none" stroke="#2CE574" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
            </g>
            <rect x="54" y="24" width="252" height="22" rx="4" fill="rgba(44,229,116,0.15)"/>
            <text x="64" y="39" fill="#86EFAC" font-family="JetBrains Mono, monospace" font-size="10" font-weight="700">HEADER VERIFIED: ${escapeHTML(realSignature)}</text>
            <rect x="54" y="150" width="252" height="22" rx="4" fill="rgba(44,229,116,0.15)"/>
            <text x="64" y="165" fill="#2CE574" font-family="JetBrains Mono, monospace" font-size="9.5" font-weight="700">MIME: ${escapeHTML(realMime)} (CLEAN)</text>
        </svg>
    `;

    const lensReticleSVG = `
        <svg viewBox="0 0 180 180" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="90" cy="90" r="72" stroke="#1CC8EE" stroke-width="2.2" opacity="0.9" id="${stageId}_reticleRing"/>
            <g class="reticle-spin">
                <circle cx="90" cy="90" r="66" stroke="#1CC8EE" stroke-width="1.2" stroke-dasharray="14 10 4 10" opacity="0.75" id="${stageId}_reticleTeeth"/>
                <line x1="90" y1="12" x2="90" y2="22" stroke="#1CC8EE" stroke-width="2"/>
                <line x1="90" y1="158" x2="90" y2="168" stroke="#1CC8EE" stroke-width="2"/>
                <line x1="12" y1="90" x2="22" y2="90" stroke="#1CC8EE" stroke-width="2"/>
                <line x1="158" y1="90" x2="168" y2="90" stroke="#1CC8EE" stroke-width="2"/>
            </g>
            <line x1="84" y1="90" x2="96" y2="90" stroke="rgba(255,255,255,0.45)" stroke-width="1"/>
            <line x1="90" y1="84" x2="90" y2="96" stroke="rgba(255,255,255,0.45)" stroke-width="1"/>
        </svg>
    `;

    return `
        <div class="forensic-desk-wrap">
            <div class="forensic-hud-topbar">
                <span>ARAHKAN &amp; SAPU LENSA DI ATAS DOKUMEN SAMPAI 100%</span>
                <span class="hud-coord-pill" id="${stageId}_coords">LENS STANDBY</span>
            </div>

            <div class="forensic-desk-stage" id="${stageId}" style="--lens-x: -120px; --lens-y: -120px; --lens-r: 68px;">
                <div class="desk-layer-surface">${surfaceSVG}</div>
                <div class="desk-layer-xray ${isThreat ? 'threat-xray-bg' : 'safe-xray-bg'}" id="${stageId}_underlay">${xraySVG}</div>
                <div class="xray-lens-reticle" id="${stageId}_lensReticle">${lensReticleSVG}</div>
                <div class="forensic-stamp-badge ${stampClass}" id="${stageId}_stamp">${stampText}</div>
            </div>

            <div class="forensic-hud-bottombar">
                <span class="mono" style="color: #94A3B8;">SCAN COVERAGE: <strong id="${stageId}_pct" style="color: var(--accent);">0%</strong></span>
                <div class="coverage-meter-track">
                    <div class="coverage-meter-fill" id="${stageId}_bar" style="width: 0%;"></div>
                </div>
                <button type="button" class="btn btn-ghost btn-sm" style="padding: 3px 10px; font-size: 0.72rem;" onclick="triggerAutoSweep2D('${stageId}')">
                    Auto-Sweep
                </button>
            </div>
        </div>

        <div class="mech-perm-bar" id="${stageId}_permBar">
            <div class="mech-perm-cell">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748B" stroke-width="2" id="${stageId}_rIco"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                <div><strong style="display:block;color:#94A3B8;" id="${stageId}_rLabel">READ (?)</strong><span style="color:#64748B;">Menunggu Scan 100%</span></div>
            </div>
            <div class="mech-perm-cell">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748B" stroke-width="2" id="${stageId}_wIco"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                <div><strong style="display:block;color:#94A3B8;" id="${stageId}_wLabel">WRITE (?)</strong><span style="color:#64748B;">Menunggu Scan 100%</span></div>
            </div>
            <div class="mech-perm-cell" id="${stageId}_xCell">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#64748B" stroke-width="2.2" id="${stageId}_xIco">
                    <rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>
                </svg>
                <div>
                    <strong style="display:block;color:#94A3B8;" id="${stageId}_xLabel">
                        EXEC STATUS (?)
                    </strong>
                    <span style="color:#64748B;" id="${stageId}_xSub">
                        Sapu dokumen s/d 100%
                    </span>
                </div>
            </div>
        </div>
    `;
}

function attachForensicDeskEvents(stageId) {
    const stage = document.getElementById(stageId);
    if (!stage) return;

    const COLS = 8;
    const ROWS = 6;
    const TARGET_SECTORS = 36;
    const scannedSectors = new Set();
    const checkpoints = { top: false, center: false, bottom: false };

    const coordEl = document.getElementById(`${stageId}_coords`);
    const pctEl = document.getElementById(`${stageId}_pct`);
    const barEl = document.getElementById(`${stageId}_bar`);
    const stampEl = document.getElementById(`${stageId}_stamp`);

    const updateLensPos = (clientX, clientY) => {
        const rect = stage.getBoundingClientRect();
        const x = Math.max(24, Math.min(rect.width - 24, clientX - rect.left));
        const y = Math.max(24, Math.min(rect.height - 24, clientY - rect.top));
        stage.style.setProperty('--lens-x', `${x}px`);
        stage.style.setProperty('--lens-y', `${y}px`);

        if (coordEl) {
            coordEl.textContent = `LENS X:${String(Math.round(x)).padStart(3, '0')} Y:${String(Math.round(y)).padStart(3, '0')}`;
        }

        const normX = (x / rect.width - 0.18) / 0.64;
        const normY = (y / rect.height - 0.10) / 0.80;

        if (normX >= 0 && normX <= 1 && normY >= 0 && normY <= 1) {
            const c = Math.min(COLS - 1, Math.max(0, Math.floor(normX * COLS)));
            const r = Math.min(ROWS - 1, Math.max(0, Math.floor(normY * ROWS)));

            scannedSectors.add(`${c}_${r}`);
            if (c + 1 < COLS) scannedSectors.add(`${c + 1}_${r}`);
            if (r + 1 < ROWS) scannedSectors.add(`${c}_${r + 1}`);

            if (normY < 0.34) checkpoints.top = true;
            else if (normY < 0.68) checkpoints.center = true;
            else checkpoints.bottom = true;
        }

        const sectorRatio = Math.min(1, scannedSectors.size / TARGET_SECTORS);
        const cpCount = (checkpoints.top ? 1 : 0) + (checkpoints.center ? 1 : 0) + (checkpoints.bottom ? 1 : 0);
        const cpRatio = cpCount / 3;

        const rawPct = Math.round((sectorRatio * 70) + (cpRatio * 30));
        const finalPct = (cpCount === 3 && scannedSectors.size >= TARGET_SECTORS) ? 100 : Math.min(96, rawPct);

        if (pctEl) pctEl.textContent = `${finalPct}%`;
        if (barEl) barEl.style.width = `${finalPct}%`;

        const st = DESK_STATE_MAP[stageId];
        if (finalPct >= 100 && st && !st.unlocked) {
            st.unlocked = true;
            revealForensicOutcome2D(stageId);
            setTimeout(() => {
                if (stampEl) stampEl.classList.add('stamped');
            }, 350);
        }
    };

    stage.addEventListener('pointermove', (e) => updateLensPos(e.clientX, e.clientY));
    stage.addEventListener('pointerdown', (e) => updateLensPos(e.clientX, e.clientY));
}

function revealForensicOutcome2D(stageId) {
    const st = DESK_STATE_MAP[stageId];
    if (!st) return;

    const rIco = document.getElementById(`${stageId}_rIco`);
    const rLabel = document.getElementById(`${stageId}_rLabel`);
    const wIco = document.getElementById(`${stageId}_wIco`);
    const wLabel = document.getElementById(`${stageId}_wLabel`);
    const xCell = document.getElementById(`${stageId}_xCell`);
    const xIco = document.getElementById(`${stageId}_xIco`);
    const xLabel = document.getElementById(`${stageId}_xLabel`);
    const xSub = document.getElementById(`${stageId}_xSub`);

    const reticleRing = document.getElementById(`${stageId}_reticleRing`);
    const reticleTeeth = document.getElementById(`${stageId}_reticleTeeth`);

    if (reticleRing && reticleTeeth) {
        reticleRing.setAttribute('stroke', st.isThreat ? '#F87171' : '#2CE574');
        reticleTeeth.setAttribute('stroke', st.isThreat ? '#EF4444' : '#2CE574');
    }

    if (rIco) rIco.setAttribute('stroke', '#38BDF8');
    if (rLabel) { rLabel.style.color = '#E2E8F0'; rLabel.textContent = 'READ (r)'; }
    if (wIco) wIco.setAttribute('stroke', '#38BDF8');
    if (wLabel) { wLabel.style.color = '#E2E8F0'; wLabel.textContent = 'WRITE (w)'; }

    if (st.hasExec) {
        if (xCell) xCell.className = 'mech-perm-cell active-exec-danger';
        if (xIco) {
            xIco.setAttribute('stroke', '#F87171');
            xIco.innerHTML = '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>';
        }
        if (xLabel) { xLabel.style.color = '#F87171'; xLabel.textContent = 'EXEC ACTIVE (x)'; }
        if (xSub) { xSub.style.color = '#CBD5E1'; xSub.textContent = 'Bahaya: Bisa Jalan Sendiri!'; }
    } else {
        if (xCell) xCell.className = 'mech-perm-cell passive-exec-safe';
        if (xIco) {
            xIco.setAttribute('stroke', '#2CE574');
            xIco.innerHTML = '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>';
        }
        if (xLabel) { xLabel.style.color = '#2CE574'; xLabel.textContent = 'EXEC LOCKED (-)'; }
        if (xSub) { xSub.style.color = '#CBD5E1'; xSub.textContent = 'Aman: Dokumen Pasif'; }
    }

    const topTargetEl = document.getElementById(`${stageId}_topTarget`);
    const topPermEl = document.getElementById(`${stageId}_topPerm`);
    if (topTargetEl) topTargetEl.innerHTML = st.visualNameHTML;
    if (topPermEl) topPermEl.textContent = `PERMISSION: ${st.permText}`;
}

function triggerAutoSweep2D(stageId) {
    const stage = document.getElementById(stageId);
    if (!stage) return;
    const pctEl = document.getElementById(`${stageId}_pct`);
    const barEl = document.getElementById(`${stageId}_bar`);
    const stampEl = document.getElementById(`${stageId}_stamp`);
    const coordEl = document.getElementById(`${stageId}_coords`);

    const waypoints = [
        { x: '28%', y: '26%' },
        { x: '72%', y: '28%' },
        { x: '68%', y: '52%' },
        { x: '30%', y: '55%' },
        { x: '34%', y: '78%' },
        { x: '70%', y: '76%' },
        { x: '50%', y: '50%' }
    ];
    let step = 0;
    const sweepTimer = setInterval(() => {
        if (step < waypoints.length) {
            stage.style.setProperty('--lens-x', waypoints[step].x);
            stage.style.setProperty('--lens-y', waypoints[step].y);
            if (coordEl) coordEl.textContent = `AUTO-SWEEP STEP ${step + 1}/7`;
            step++;
            const pct = Math.min(100, Math.round((step / waypoints.length) * 100));
            if (pctEl) pctEl.textContent = `${pct}%`;
            if (barEl) barEl.style.width = `${pct}%`;
        } else {
            clearInterval(sweepTimer);
            const st = DESK_STATE_MAP[stageId];
            if (st) st.unlocked = true;
            revealForensicOutcome2D(stageId);
            setTimeout(() => {
                if (stampEl) stampEl.classList.add('stamped');
            }, 250);
        }
    }, 240);
}

// =========================================================
// 2. ENGINE 2D MECHANICAL SEAL MATCHER (SHA-256)
// =========================================================
function buildMechanicalSeal2D(config) {
    const {
        stageId = 'sealStage_1',
        fileHash = '',
        officialHash = null
    } = config;

    const hasOfficial = Boolean(officialHash);
    const isMatch = hasOfficial && (fileHash.toLowerCase() === officialHash.toLowerCase());
    const shortFileHash = fileHash ? `${fileHash.slice(0, 8)}...${fileHash.slice(-8)}` : '---';
    const shortOfficialHash = officialHash ? `${officialHash.slice(0, 8)}...${officialHash.slice(-8)}` : 'TIDAK TERSEDIA';

    if (hasOfficial) {
        const rightPlateColor = isMatch ? '#1CC8EE' : '#F87171';
        const rightTeethPath = isMatch
            ? 'M180 42 H198 V66 H180 V90 H198 V114 H180 V138'
            : 'M180 42 H198 V58 H168 V96 H198 V122 H170 V138';

        return `
            <div class="forensic-desk-wrap">
                <div class="forensic-hud-topbar">
                    <span>MEJA PENCOCOKAN SEGEL SHA-256 (KIRI: RESMI vs KANAN: FILE INI)</span>
                    <span class="hud-coord-pill" id="${stageId}_state">MENUNGGU UJI SEGEL</span>
                </div>

                <div class="seal-desk-stage" id="${stageId}">
                    <svg width="380" height="170" viewBox="0 0 380 170" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <g class="seal-plate-left">
                            <rect x="24" y="26" width="156" height="118" rx="6" fill="#0D1627" stroke="#1CC8EE" stroke-width="2"/>
                            <path d="M180 42 H162 V66 H180 V90 H162 V114 H180 V138" fill="#070C16" stroke="#1CC8EE" stroke-width="2"/>
                            <text x="38" y="54" fill="#94A3B8" font-family="Inter, sans-serif" font-size="9.5" font-weight="700">SEGEL RESMI PENGIRIM</text>
                            <rect x="38" y="66" width="112" height="24" rx="4" fill="#070C16" stroke="#1E2F4D"/>
                            <text x="45" y="82" fill="#1CC8EE" font-family="JetBrains Mono, monospace" font-size="9.5" font-weight="700">${escapeHTML(shortOfficialHash)}</text>
                            <text x="38" y="114" fill="#64748B" font-family="Inter, sans-serif" font-size="8.5">Cetakan Kunci Asli</text>
                        </g>

                        <g class="seal-plate-right">
                            <rect x="180" y="26" width="176" height="118" rx="6" fill="#0D1627" stroke="${rightPlateColor}" stroke-width="2"/>
                            <path d="${rightTeethPath}" fill="#0D1627" stroke="${rightPlateColor}" stroke-width="2"/>
                            <text x="206" y="54" fill="#94A3B8" font-family="Inter, sans-serif" font-size="9.5" font-weight="700">SEGEL FILE INI</text>
                            <rect x="206" y="66" width="134" height="24" rx="4" fill="#070C16" stroke="#1E2F4D"/>
                            <text x="214" y="82" fill="${rightPlateColor}" font-family="JetBrains Mono, monospace" font-size="9.5" font-weight="700">${escapeHTML(shortFileHash)}</text>
                            <text x="206" y="114" fill="#64748B" font-family="Inter, sans-serif" font-size="8.5">${isMatch ? 'Bentuk Gerigi Identik' : 'Bentuk Gerigi Berbeda!'}</text>
                        </g>
                    </svg>

                    <div class="forensic-stamp-badge ${isMatch ? 'stamp-safe' : 'stamp-danger'}" id="${stageId}_stamp">
                        ${isMatch ? 'SEGEL COCOK (ASLI)' : 'SEGEL BEDA (PALSU)'}
                    </div>
                </div>

                <div class="forensic-hud-bottombar">
                    <span id="${stageId}_verdictText" style="color: #CBD5E1; font-size: 0.78rem;">
                        Klik tombol di kanan untuk mengadu kecocokan kedua keping segel.
                    </span>
                    <button type="button" class="btn btn-primary btn-sm" onclick="engageMechanicalSealLock('${stageId}', ${isMatch})">
                        Adu Kedua Segel
                    </button>
                </div>
            </div>
        `;
    }

    return `
        <div class="forensic-desk-wrap">
            <div class="forensic-hud-topbar">
                <span>VISUALISASI CARA KERJA SEGEL SHA-256</span>
                <span class="hud-coord-pill" id="${stageId}_state">SEGEL UTUH</span>
            </div>

            <div class="seal-desk-stage" id="${stageId}">
                <svg width="360" height="180" viewBox="0 0 360 180" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="24" y="16" width="312" height="152" rx="6" fill="#0D1627" stroke="#1CC8EE" stroke-width="2" id="${stageId}_box"/>
                    <text x="44" y="42" fill="#94A3B8" font-family="Inter, sans-serif" font-size="10" font-weight="700">CETAKAN GIGI KUNCI FILE (SHA-256):</text>
                    <path d="M44 86 H85 V64 H115 V86 H150 V58 H185 V86 H220 V68 H255 V86 H316" stroke="rgba(44,229,116,0.22)" stroke-width="2" stroke-dasharray="4 3"/>
                    <path id="${stageId}_teeth" d="M44 86 H85 V64 H115 V86 H150 V58 H185 V86 H220 V68 H255 V86 H316" stroke="#2CE574" stroke-width="3" stroke-linecap="square"/>
                    <line x1="36" y1="116" x2="324" y2="116" stroke="#1E2F4D" stroke-width="1"/>
                    <text x="44" y="142" fill="#CBD5E1" font-family="JetBrains Mono, monospace" font-size="9.5" id="${stageId}_sub">
                        Isi File Utuh -> Bentuk Gigi Kunci Tetap Sama
                    </text>
                </svg>
            </div>

            <div class="forensic-hud-bottombar">
                <span style="color: #94A3B8; font-size: 0.76rem;">
                    Apa jadinya jika isi file diubah hacker 1 huruf saja?
                </span>
                <button type="button" class="btn btn-ghost btn-sm" id="${stageId}_simBtn" onclick="toggleSingleSealTamper('${stageId}')">
                    Coba Ubah 1 Huruf Isi File
                </button>
            </div>
        </div>
    `;
}

function engageMechanicalSealLock(stageId, isMatch) {
    const stage = document.getElementById(stageId);
    const stamp = document.getElementById(`${stageId}_stamp`);
    const statePill = document.getElementById(`${stageId}_state`);
    const verdictTxt = document.getElementById(`${stageId}_verdictText`);
    if (!stage) return;

    stage.classList.remove('locked-match', 'locked-mismatch');
    void stage.offsetWidth;

    if (isMatch) {
        stage.classList.add('locked-match');
        if (statePill) {
            statePill.style.color = 'var(--safe)';
            statePill.textContent = 'TERKUNCI PAS (100% COCOK)';
        }
        if (verdictTxt) {
            verdictTxt.innerHTML = `<strong style="color: var(--safe);">Segel menyatu sempurna!</strong> File ini 100% asli dan belum dimodifikasi.`;
        }
    } else {
        stage.classList.add('locked-mismatch');
        if (statePill) {
            statePill.style.color = 'var(--danger)';
            statePill.textContent = 'GAGAL MENGUNCI (BERBEDA!)';
        }
        if (verdictTxt) {
            verdictTxt.innerHTML = `<strong style="color: var(--danger);">Gerigi segel bertabrakan!</strong> Isi file sudah diubah/disisipi malware. Wajib dihapus!`;
        }
    }

    setTimeout(() => {
        if (stamp) stamp.classList.add('stamped');
    }, 320);
}

function toggleSingleSealTamper(stageId) {
    const stage = document.getElementById(stageId);
    const box = document.getElementById(`${stageId}_box`);
    const teeth = document.getElementById(`${stageId}_teeth`);
    const sub = document.getElementById(`${stageId}_sub`);
    const state = document.getElementById(`${stageId}_state`);
    const btn = document.getElementById(`${stageId}_simBtn`);
    if (!stage || !teeth) return;

    const tampered = stage.classList.toggle('is-tampered');
    if (tampered) {
        box.setAttribute('stroke', '#F87171');
        teeth.setAttribute('stroke', '#F87171');
        teeth.setAttribute('d', 'M44 86 H70 V54 H95 V96 H135 V62 H165 V92 H210 V54 H265 V86 H316');
        sub.setAttribute('fill', '#F87171');
        sub.textContent = 'Isi Diubah 1 Huruf -> Bentuk Gigi Kunci Berubah Total!';
        state.style.color = 'var(--danger)';
        state.textContent = 'SEGEL RUSAK / BERUBAH';
        btn.textContent = 'Kembalikan ke Asli';
    } else {
        box.setAttribute('stroke', '#1CC8EE');
        teeth.setAttribute('stroke', '#2CE574');
        teeth.setAttribute('d', 'M44 86 H85 V64 H115 V86 H150 V58 H185 V86 H220 V68 H255 V86 H316');
        sub.setAttribute('fill', '#CBD5E1');
        sub.textContent = 'Isi File Utuh -> Bentuk Gigi Kunci Tetap Sama';
        state.style.color = 'var(--accent)';
        state.textContent = 'SEGEL UTUH';
        btn.textContent = 'Coba Ubah 1 Huruf Isi File';
    }
}

// =========================================================
// 3. MULTI-OS TAB SWITCHER, COMMAND GENERATOR, & GUIDE ANIMATIONS (guide.html)
// =========================================================
let currentCustomGuideFile = '';

function triggerGuideArgFlash() {
    document.querySelectorAll('.os-pane.active .cmd-arg').forEach(el => {
        el.classList.remove('arg-flash-active');
        void el.offsetWidth;
        el.classList.add('arg-flash-active');
    });
}

function switchGuideOS(osKey) {
    document.querySelectorAll('.os-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-os') === osKey);
    });
    document.querySelectorAll('.os-pane').forEach(pane => {
        pane.classList.toggle('active', pane.getAttribute('data-os-pane') === osKey);
    });
    triggerGuideArgFlash();
}

function copyGuideCommand(cmdText, targetFileExample) {
    let finalCmd = cmdText;
    if (currentCustomGuideFile && targetFileExample) {
        const formattedFile = currentCustomGuideFile.includes(' ')
            ? `"${currentCustomGuideFile}"`
            : currentCustomGuideFile;
        const winFormattedFile = currentCustomGuideFile.includes(' ')
            ? `".\\${currentCustomGuideFile}"`
            : `.\\${currentCustomGuideFile}`;

        if (targetFileExample.startsWith('.\\')) {
            finalCmd = cmdText.split(targetFileExample).join(winFormattedFile);
        } else {
            finalCmd = cmdText.split(targetFileExample).join(formattedFile);
        }
    }

    navigator.clipboard.writeText(finalCmd);

    if (typeof event !== 'undefined' && event && event.currentTarget) {
        const btn = event.currentTarget;
        if (!btn.getAttribute('data-orig-label')) {
            btn.setAttribute('data-orig-label', btn.innerHTML);
        }
        btn.classList.add('copied-active');
        btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Tersalin`;
        setTimeout(() => {
            btn.classList.remove('copied-active');
            btn.innerHTML = btn.getAttribute('data-orig-label') || 'Salin';
        }, 1400);
    }

    if (currentCustomGuideFile && targetFileExample) {
        showToastNotification(`
            <strong style="color: var(--safe); display: block; margin-bottom: 2px;">Perintah Kustom Disalin ke Clipboard</strong>
            <span style="color: var(--text-secondary);">Menggunakan target file: <code class="mono" style="color: var(--text-primary);">${escapeHTML(currentCustomGuideFile)}</code></span>
        `);
    } else if (targetFileExample) {
        showToastNotification(`
            <strong style="color: var(--accent); display: block; margin-bottom: 2px;">Perintah disalin ke clipboard</strong>
            <span style="color: var(--text-secondary);">Ganti argumen <code class="mono" style="color: var(--text-primary);">${escapeHTML(targetFileExample)}</code> atau gunakan <strong>Command Builder</strong> di bagian atas halaman.</span>
        `);
    } else {
        showToastNotification(`
            <strong style="color: var(--accent); display: block; margin-bottom: 2px;">Perintah disalin ke clipboard</strong>
            <span style="color: var(--text-secondary);">Siap dijalankan pada terminal di direktori target.</span>
        `);
    }
}

function initGuideCommandGenerator() {
    const firstGuideCard = document.querySelector('.guide-card');
    if (!firstGuideCard || document.getElementById('realCaseCmdGenerator')) return;

    document.querySelectorAll('.cmd-arg').forEach(el => {
        el.setAttribute('data-orig-arg', el.textContent);
    });

    const banner = document.createElement('div');
    banner.id = 'realCaseCmdGenerator';
    banner.className = 'cmd-generator-banner';
    banner.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <span class="mono" style="font-size: 0.74rem; font-weight: 700; color: var(--accent); text-transform: uppercase;">
                REAL-CASE CLI BUILDER // GENERATOR ARGUMEN TERMINAL OTOMATIS
            </span>
            <span class="mono" style="font-size: 0.72rem; color: var(--safe);">WINDOWS &bull; MACOS &bull; LINUX</span>
        </div>
        <h3 style="font-size: 1.08rem; margin-top: 4px;">Sesuaikan Seluruh Perintah Terminal dengan Nama File Aslimu</h3>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">
            Pilih berkas dari perangkatmu atau ketik namanya di bawah ini. Seluruh sintaks perintah <strong>Windows PowerShell/CMD</strong>, <strong>macOS</strong>, dan <strong>Linux</strong> di halaman ini akan otomatis mengikat nama berkas tersebut!
        </p>
        <div class="cmd-gen-controls">
            <input type="text" id="customGuideFileName" class="cmd-gen-input" placeholder="Ketik nama berkas target (misal: Kontrak Kerja 2026.pdf)..." oninput="applyCustomGuideFileName(this.value)">
            <input type="file" id="customGuideFilePicker" style="display: none;" onchange="if(this.files[0]) { document.getElementById('customGuideFileName').value = this.files[0].name; applyCustomGuideFileName(this.files[0].name); }">
            <button type="button" class="btn btn-primary btn-sm" onclick="document.getElementById('customGuideFilePicker').click()">
                Pilih Berkas Lokal
            </button>
            <button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('customGuideFileName').value=''; applyCustomGuideFileName('');">
                Reset Argumen
            </button>
        </div>
        <div id="customGuideStatus" class="mono" style="margin-top: 8px; font-size: 0.78rem; color: var(--safe); display: none;"></div>
    `;

    firstGuideCard.parentNode.insertBefore(banner, firstGuideCard);
}

function applyCustomGuideFileName(rawName) {
    currentCustomGuideFile = String(rawName || '').trim();
    const statusEl = document.getElementById('customGuideStatus');

    document.querySelectorAll('.cmd-arg').forEach(el => {
        const orig = el.getAttribute('data-orig-arg') || '';
        if (!currentCustomGuideFile) {
            el.textContent = orig;
            el.style.color = '';
            return;
        }
        if (/^\d+$/.test(orig.trim())) return;

        const quoted = currentCustomGuideFile.includes(' ')
            ? `"${currentCustomGuideFile}"`
            : currentCustomGuideFile;

        if (orig.includes('  Patch_Update_v2.zip')) {
            el.textContent = orig.replace('Patch_Update_v2.zip', currentCustomGuideFile);
        } else if (orig.startsWith('.\\')) {
            el.textContent = currentCustomGuideFile.includes(' ')
                ? `".\\${currentCustomGuideFile}"`
                : `.\\${currentCustomGuideFile}`;
        } else {
            el.textContent = quoted;
        }
        el.style.color = 'var(--safe)';
    });

    triggerGuideArgFlash();

    if (statusEl) {
        if (currentCustomGuideFile) {
            statusEl.style.display = 'block';
            statusEl.innerHTML = `[TARGET LOCKED]: Seluruh perintah Windows, macOS, & Linux kini diarahkan ke "${escapeHTML(currentCustomGuideFile)}"`;
        } else {
            statusEl.style.display = 'none';
        }
    }
}

function initGuidePageAnimations() {
    if (!document.querySelector('.guide-card')) return;

    const guideBlocks = document.querySelectorAll(
        'main.container > div:first-child, #globalOsBar, #realCaseCmdGenerator, .guide-card'
    );
    guideBlocks.forEach((el, idx) => {
        el.classList.add('scroll-reveal-init');
        if (idx < 4) {
            el.style.transitionDelay = `${idx * 75}ms`;
        }
    });

    const cardObs = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('scroll-reveal-visible');
                cardObs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -24px 0px' });

    document.querySelectorAll('.scroll-reveal-init').forEach(el => cardObs.observe(el));

    const magicTable = document.querySelector('.magic-table');
    if (magicTable) {
        const rows = magicTable.querySelectorAll('tbody tr');
        rows.forEach((r, idx) => {
            r.classList.add('magic-row-init');
            r.style.transitionDelay = `${idx * 65}ms`;
        });

        const tableObs = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                rows.forEach(r => r.classList.add('magic-row-visible'));
                tableObs.disconnect();
            }
        }, { threshold: 0.2 });

        tableObs.observe(magicTable);
    }
}

function openTeamCredits() {
    const backdrop = document.getElementById('modalBackdrop');
    if (!backdrop || typeof SATGAS_TEAM === 'undefined') return;

    document.getElementById('modalTitle').innerHTML = `
        <span style="display:inline-flex;align-items:center;gap:8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Profil Tim Pengembang — Satgas Salah Download
        </span>
    `;
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

function hitungStatistikLokal() {
    let totalSkenario = 0, totalFile = 0, totalMalware = 0;
    if (typeof SCENARIO_BANK !== 'undefined') {
        Object.values(SCENARIO_BANK).forEach(daftar => {
            totalSkenario += daftar.length;
            daftar.forEach(s => {
                totalFile += s.files.length;
                totalMalware += s.files.filter(f => f.isMalware).length;
            });
        });
    }
    let lb = [];
    try { lb = JSON.parse(localStorage.getItem('filemate_leaderboard') || '[]'); } catch (e) { lb = []; }
    const skor = lb.map(r => Number(r.score)).filter(n => !isNaN(n));
    return {
        total_skenario: totalSkenario,
        total_file: totalFile,
        total_malware: totalMalware,
        total_aman: totalFile - totalMalware,
        total_sesi: skor.length,
        rata_rata_skor: skor.length ? Math.round(skor.reduce((a, b) => a + b, 0) / skor.length) : 0
    };
}

function animateCounterValue(id, targetVal) {
    const el = document.getElementById(id);
    if (!el) return;
    if (targetVal === '–' || isNaN(Number(targetVal))) {
        el.textContent = targetVal;
        return;
    }
    const finalNum = Number(targetVal);
    let current = 0;
    const step = Math.max(1, Math.ceil(finalNum / 16));
    const timer = setInterval(() => {
        current += step;
        if (current >= finalNum) {
            el.textContent = finalNum;
            clearInterval(timer);
        } else {
            el.textContent = current;
        }
    }, 30);
}

function tampilkanStatistik(st) {
    animateCounterValue('statSkenario', st.total_skenario);
    animateCounterValue('statFile', st.total_file);
    animateCounterValue('statMalware', st.total_malware);
    animateCounterValue('statAman', st.total_aman);
    animateCounterValue('statSesi', st.total_sesi);
    animateCounterValue('statRataSkor', st.total_sesi ? st.rata_rata_skor : '–');
}

async function renderDashboardStats() {
    const statsEl = document.getElementById('dashStats');
    if (!statsEl) return;

    let finalStats = hitungStatistikLokal();
    if (typeof apiFetchJSON === 'function') {
        const remoteStats = await apiFetchJSON('/api/dashboard-stats');
        if (remoteStats) finalStats = remoteStats;
    }

    let counted = false;
    const obs = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !counted) {
            counted = true;
            tampilkanStatistik(finalStats);
            obs.disconnect();
        }
    }, { threshold: 0.2 });
    obs.observe(statsEl);
}

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    ensureDashboardNavButton();
    initDashboardScrollReveal();
    renderDashboardStats();
    initHeroSplitCurtain();
    initGuideCommandGenerator();
    initGuidePageAnimations();
});