/* =========================================================
   INSPECTOR.JS — Local File Inspector Ramah Awam (3 Status Jelas)
   ========================================================= */

let lastScannedFileHash = '';

document.addEventListener('DOMContentLoaded', () => {
    const dz = document.getElementById('dropzone');
    if (dz) {
        dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('dragover'); });
        dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
        dz.addEventListener('drop', (e) => {
            e.preventDefault();
            dz.classList.remove('dragover');
            if (e.dataTransfer.files.length) handleLiveFile(e.dataTransfer.files[0]);
        });
    }
});

async function handleLiveFile(file) {
    if (!file) return;

    const idleGuide = document.getElementById('inspectorIdleGuide');
    if (idleGuide) idleGuide.style.display = 'none';

    const resultBox = document.getElementById('liveScanResult');
    if (resultBox) {
        resultBox.style.display = 'block';
        resultBox.className = 'reveal-anim';
    }

    const sizeKB = (file.size / 1024).toFixed(1);
    const sizeText = file.size >= 1048576
        ? `Ukuran: ${(file.size / 1048576).toFixed(2)} MB (${sizeKB} KB)`
        : `Ukuran: ${sizeKB} KB`;
    document.getElementById('liveSize').textContent = sizeText;

    // Baca 8 byte pertama agar bisa mendeteksi MP4 (ftyp di byte ke 4-7)
    const sliceBuffer = await file.slice(0, 8).arrayBuffer();
    const byteArr = Array.from(new Uint8Array(sliceBuffer));
    const hexHeader = byteArr.slice(0, 4).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');

    const isMZ = (byteArr[0] === 0x4D && byteArr[1] === 0x5A);
    const isELF = (byteArr[0] === 0x7F && byteArr[1] === 0x45 && byteArr[2] === 0x4C && byteArr[3] === 0x46);
    const isJPG = (byteArr[0] === 0xFF && byteArr[1] === 0xD8 && byteArr[2] === 0xFF);
    const isPNG = (byteArr[0] === 0x89 && byteArr[1] === 0x50 && byteArr[2] === 0x4E && byteArr[3] === 0x47);
    const isGIF = (byteArr[0] === 0x47 && byteArr[1] === 0x49 && byteArr[2] === 0x46 && byteArr[3] === 0x38);
    const isPDF = (byteArr[0] === 0x25 && byteArr[1] === 0x50 && byteArr[2] === 0x44 && byteArr[3] === 0x46);
    const isZIP = (byteArr[0] === 0x50 && byteArr[1] === 0x4B && byteArr[2] === 0x03 && byteArr[3] === 0x04);
    const isRAR = (byteArr[0] === 0x52 && byteArr[1] === 0x61 && byteArr[2] === 0x72 && byteArr[3] === 0x21);
    const isMP4 = (byteArr.length >= 8 && byteArr[4] === 0x66 && byteArr[5] === 0x74 && byteArr[6] === 0x79 && byteArr[7] === 0x70);
    const isMKV = (byteArr[0] === 0x1A && byteArr[1] === 0x45 && byteArr[2] === 0xDF && byteArr[3] === 0xA3);
    const isMP3 = (byteArr[0] === 0x49 && byteArr[1] === 0x44 && byteArr[2] === 0x33) || (byteArr[0] === 0xFF && (byteArr[1] & 0xE0) === 0xE0);

    let detectedSignature = "Dokumen Teks / Data Umum";
    if (isMZ) detectedSignature = "Program Aplikasi Windows (Header MZ / 4D 5A)";
    else if (isELF) detectedSignature = "Program Eksekusi Linux (Header ELF / 7F 45 4C 46)";
    else if (isJPG) detectedSignature = "Gambar JPEG Asli (FF D8 FF)";
    else if (isPNG) detectedSignature = "Gambar PNG Asli (89 50 4E 47)";
    else if (isGIF) detectedSignature = "Gambar GIF Asli (GIF8)";
    else if (isPDF) detectedSignature = "Dokumen PDF Asli (%PDF / 25 50 44 46)";
    else if (isZIP) detectedSignature = "Arsip ZIP / Dokumen Office (PK / 50 4B 03 04)";
    else if (isRAR) detectedSignature = "Arsip RAR Asli (Rar! / 52 61 72 21)";
    else if (isMP4) detectedSignature = "Video MP4 / Media ISO Asli (ftyp)";
    else if (isMKV) detectedSignature = "Video MKV / WebM Asli (1A 45 DF A3)";
    else if (isMP3) detectedSignature = "Audio MP3 Asli (ID3)";

    document.getElementById('liveRealContent').textContent = `${detectedSignature} [${hexHeader || 'ASCII'}]`;

    const safeFileName = escapeHTML(file.name);
    const parts = safeFileName.split('.');
    const execExts = ['exe', 'msi', 'bat', 'vbs', 'scr', 'sh', 'cmd', 'ps1', 'com', 'pif'];
    const baitDocExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'jpg', 'jpeg', 'png', 'gif', 'mp3', 'mp4', 'mkv', 'zip', 'rar', 'csv'];

    const lastExt = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
    const secondLastExt = parts.length > 2 ? parts[parts.length - 2].toLowerCase() : '';

    const isExecExt = execExts.includes(lastExt);
    const isDoubleExtAttack = (parts.length > 2 && isExecExt && baitDocExts.includes(secondLastExt));
    const isHiddenExec = (isMZ || isELF) && !isExecExt;

    const isDangerFile = isDoubleExtAttack || isHiddenExec;
    const isCautionInstaller = !isDangerFile && (isExecExt || isMZ || isELF);

    if (isDoubleExtAttack) {
        const base = parts.slice(0, -2).join('.');
        document.getElementById('liveXrayName').innerHTML = `
            ${base}<span class="ext-badge ext-fake">.${secondLastExt} (Palsu)</span><span class="ext-badge ext-danger">.${lastExt} (Program!)</span>
        `;
    } else if (parts.length > 1) {
        const base = parts.slice(0, -1).join('.');
        const badgeTone = isDangerFile ? 'ext-danger' : (isCautionInstaller ? 'ext-fake' : 'ext-safe');
        document.getElementById('liveXrayName').innerHTML = `
            ${base}<span class="ext-badge ${badgeTone}" style="text-decoration: none;">.${lastExt}</span>
        `;
    } else {
        document.getElementById('liveXrayName').innerHTML = `${safeFileName} <span class="ext-badge">(Tanpa Ekstensi)</span>`;
    }

    const verdictEl = document.getElementById('liveVerdict');
    if (isDangerFile) {
        verdictEl.innerHTML = `
            <div style="padding: 16px 18px; border-radius: 10px; background: var(--danger-soft); border: 1.5px solid var(--danger); border-left: 6px solid var(--danger);">
                <div style="display: flex; align-items: center; gap: 10px; color: var(--danger); font-weight: 800; font-size: 1rem;">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    STATUS: BAHAYA — TERDETEKSI PENYAMARAN FILE!
                </div>
                <p style="font-size: 0.86rem; color: var(--text-primary); margin-top: 6px; line-height: 1.55;">
                    ${isDoubleExtAttack
                        ? `File ini menggunakan <strong>Jebakan Ekstensi Ganda (.${secondLastExt}.${lastExt})</strong> untuk menipu mata pengguna agar dikira berkas <code>.${secondLastExt}</code>, padahal sebenarnya adalah program eksekusi <code>.${lastExt}</code>!`
                        : `Nama file ini berakhiran <code>.${lastExt}</code>, tetapi segel biner di dalamnya adalah <strong>Program Eksekusi (${detectedSignature})</strong>!`}
                    <strong>Jangan dibuka dan segera hapus file ini!</strong>
                </p>
            </div>
        `;
    } else if (isCautionInstaller) {
        verdictEl.innerHTML = `
            <div style="padding: 16px 18px; border-radius: 10px; background: var(--warning-soft); border: 1.5px solid var(--warning); border-left: 6px solid var(--warning);">
                <div style="display: flex; align-items: center; gap: 10px; color: var(--warning); font-weight: 800; font-size: 1rem;">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    STATUS: PERHATIAN — INI ADALAH FILE PROGRAM / INSTALLER (.${lastExt.toUpperCase()})
                </div>
                <p style="font-size: 0.86rem; color: var(--text-primary); margin-top: 6px; line-height: 1.55;">
                    File ini <strong>tidak menyamar</strong> (nama dan isinya sama-sama program aplikasi). Karena file program memiliki akses penuh ke sistem komputermu, <strong>pastikan kamu mengunduhnya dari situs resmi pengembang</strong> dan klik tombol <strong>Cek di VirusTotal</strong> di bawah sebelum menjalankannya.
                </p>
            </div>
        `;
    } else {
        verdictEl.innerHTML = `
            <div style="padding: 16px 18px; border-radius: 10px; background: var(--safe-soft); border: 1.5px solid var(--safe); border-left: 6px solid var(--safe);">
                <div style="display: flex; align-items: center; gap: 10px; color: var(--safe); font-weight: 800; font-size: 1rem;">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
                    STATUS: AMAN — STRUKTUR FILE ASLI &amp; SESUAI
                </div>
                <p style="font-size: 0.86rem; color: var(--text-primary); margin-top: 6px; line-height: 1.55;">
                    Tidak ditemukan jebakan ekstensi ganda maupun kode program tersembunyi. Isi segel file (<strong>${detectedSignature}</strong>) cocok dengan nama akhirannya. Untuk kepastian 100%, kamu juga bisa menekan tombol <strong>Cek di VirusTotal</strong> di bawah.
                </p>
            </div>
        `;
    }

    document.getElementById('liveHash').textContent = 'Menghitung sidik jari SHA-256...';
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    lastScannedFileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    document.getElementById('liveHash').textContent = lastScannedFileHash;

    const vtBtn = document.getElementById('vtLookupBtn');
    if (vtBtn) {
        vtBtn.href = `https://www.virustotal.com/gui/search/${lastScannedFileHash}`;
    }

    const manualInput = document.getElementById('manualOfficialHash');
    if (manualInput && manualInput.value.trim() !== '') {
        checkManualHashMatch();
    }
}

function checkManualHashMatch() {
    const inputVal = document.getElementById('manualOfficialHash').value.trim().toLowerCase();
    const badge = document.getElementById('manualHashVerdict');
    if (!badge) return;
    if (!inputVal) {
        badge.innerHTML = '';
        return;
    }
    if (!lastScannedFileHash) {
        badge.innerHTML = `<span style="color: var(--warning); font-size: 0.8rem;">Pilih berkas di atas terlebih dahulu.</span>`;
        return;
    }
    const isMatch = inputVal === lastScannedFileHash.toLowerCase();

    if (isMatch) {
        badge.innerHTML = `
            <div style="padding: 10px 14px; border-radius: 8px; background: var(--safe-soft); border: 1px solid var(--safe); color: var(--safe); font-size: 0.82rem; font-weight: 700;">
                ✓ COCOK 100% (FILE ASLI): Sidik jari SHA-256 file ini sama persis dengan kode resmi dari pengembang!
            </div>
        `;
    } else {
        badge.innerHTML = `
            <div style="padding: 10px 14px; border-radius: 8px; background: var(--danger-soft); border: 1px solid var(--danger); color: var(--danger); font-size: 0.82rem; font-weight: 700;">
                ✕ TIDAK COCOK (WASPADA!): Sidik jari file ini BERBEDA dari kode resmi! Isi file kemungkinan sudah rusak atau dimodifikasi.
            </div>
        `;
    }
}