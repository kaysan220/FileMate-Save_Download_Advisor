/* =========================================================
   FILEMATE INSPECTOR.JS — Live File Scanner + VirusTotal +
   Manual Hash Matcher (index.html)
   Seluruh pemindaian tetap LOKAL di browser (file tidak diunggah).
   ========================================================= */

let lastScannedFileHash = '';

function initDropzone() {
    const dz = document.getElementById('dropzone');
    if (!dz) return;
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', (e) => {
        e.preventDefault();
        dz.classList.remove('dragover');
        if (e.dataTransfer.files.length) handleLiveFile(e.dataTransfer.files[0]);
    });
}

async function handleLiveFile(file) {
    if (!file) return;
    document.getElementById('liveScanResult').style.display = 'block';
    document.getElementById('liveSize').textContent = (file.size / 1024).toFixed(1) + ' KB';
    document.getElementById('liveMime').textContent = file.type || 'application/octet-stream';

    const sliceBuffer = await file.slice(0, 4).arrayBuffer();
    const byteArr = Array.from(new Uint8Array(sliceBuffer));
    const hexHeader = byteArr.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');

    let detectedSignature = "Dokumen / Data Umum";
    const isMZ = (byteArr[0] === 0x4D && byteArr[1] === 0x5A);
    const isELF = (byteArr[0] === 0x7F && byteArr[1] === 0x45 && byteArr[2] === 0x4C && byteArr[3] === 0x46);
    const isJPG = (byteArr[0] === 0xFF && byteArr[1] === 0xD8 && byteArr[2] === 0xFF);
    const isPNG = (byteArr[0] === 0x89 && byteArr[1] === 0x50 && byteArr[2] === 0x4E && byteArr[3] === 0x47);
    const isPDF = (byteArr[0] === 0x25 && byteArr[1] === 0x50 && byteArr[2] === 0x44 && byteArr[3] === 0x46);
    const isZIP = (byteArr[0] === 0x50 && byteArr[1] === 0x4B && byteArr[2] === 0x03 && byteArr[3] === 0x04);

    if (isMZ) detectedSignature = "Program Eksekusi Windows (PE32 / MZ)";
    else if (isELF) detectedSignature = "Program Eksekusi Linux (ELF)";
    else if (isJPG) detectedSignature = "Gambar JPEG Asli (FF D8 FF)";
    else if (isPNG) detectedSignature = "Gambar PNG Asli (89 50 4E 47)";
    else if (isPDF) detectedSignature = "Dokumen PDF Asli (%PDF)";
    else if (isZIP) detectedSignature = "Arsip ZIP / Dokumen Office Modern (PK)";

    const safeFileName = escapeHTML(file.name);
    const parts = safeFileName.split('.');
    const execExts = ['exe', 'msi', 'bat', 'vbs', 'scr', 'sh', 'cmd', 'ps1'];
    const lastExt = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
    const isExecExt = execExts.includes(lastExt);
    const isHiddenExec = (isMZ || isELF) && !isExecExt;

    if (parts.length > 2) {
        const base = parts.slice(0, -2).join('.');
        const firstExt = '.' + parts[parts.length - 2];
        const realExt = '.' + parts[parts.length - 1];
        document.getElementById('liveXrayName').innerHTML = `
            ${base}<span class="ext-badge ext-fake">${firstExt}</span><span class="ext-badge ${isExecExt ? 'ext-danger' : 'ext-safe'}">${realExt}</span>
        `;
        if (isExecExt || isHiddenExec) {
            document.getElementById('liveVerdict').innerHTML = `
                <span style="color: var(--danger); font-weight: 700;">🚨 BAHAYA: Terdeteksi Ekstensi Ganda Berupa Program (${realExt})!</span><br>
                <span style="color: var(--text-secondary); font-size: 0.84rem;">File ini menggunakan nama pengecoh <code>${firstExt}</code> tetapi aslinya adalah <strong>${detectedSignature}</strong>. Jangan dibuka kecuali kamu mengecek hash-nya di VirusTotal!</span>
            `;
        } else {
            document.getElementById('liveVerdict').innerHTML = `
                <span style="color: var(--safe); font-weight: 700;">✅ AMAN DARI SPOOFING: Nama Bertitik Ganda, Tapi Isi Biner Cocok (${detectedSignature})</span><br>
                <span style="color: var(--text-secondary); font-size: 0.84rem;">Walaupun memakai lebih dari satu titik, buntut terakhirnya adalah <code>${realExt}</code> dan segel binernya <code>[${hexHeader}]</code> terbukti bukan program eksekusi.</span>
            `;
        }
    } else {
        const base = parts[0];
        const realExt = parts.length > 1 ? '.' + parts[1] : '(Tanpa Ekstensi)';
        document.getElementById('liveXrayName').innerHTML = `
            ${base}<span class="ext-badge ${isHiddenExec ? 'ext-danger' : 'ext-safe'}">${realExt}</span>
        `;

        if (isHiddenExec) {
            document.getElementById('liveVerdict').innerHTML = `
                <span style="color: var(--danger); font-weight: 700;">🚨 BAHAYA: Penyamaran File! Ekstensi ${realExt} Tapi Isi Binernya Program!</span><br>
                <span style="color: var(--text-secondary); font-size: 0.84rem;">Nama file terlihat seperti <code>${realExt}</code>, tetapi segel biner di dalamnya adalah <strong>${detectedSignature} [${hexHeader}]</strong>!</span>
            `;
        } else if (isExecExt) {
            document.getElementById('liveVerdict').innerHTML = `
                <span style="color: var(--accent); font-weight: 700;">ℹ️ File Aplikasi / Installer (${detectedSignature})</span><br>
                <span style="color: var(--text-secondary); font-size: 0.84rem;">Struktur ekstensi dan header <code>[${hexHeader}]</code> jujur (tidak menyamar). Karena ini file program, silakan klik <strong>Cek di VirusTotal</strong> di bawah untuk memverifikasi reputasi keamanannya.</span>
            `;
        } else {
            document.getElementById('liveVerdict').innerHTML = `
                <span style="color: var(--safe); font-weight: 700;">✅ TERVERIFIKASI AMAN: ${detectedSignature} (Header: [${hexHeader || 'Text'}])</span><br>
                <span style="color: var(--text-secondary); font-size: 0.84rem;">Ekstensi <code>${realExt}</code> cocok dengan segel biner aslinya dan tidak ditemukan kode program eksekusi. <em>(Catatan: Jika file foto/dokumen pribadimu tertulis "Not Found" saat dicek di VirusTotal, itu wajar dan aman karena file pribadimu belum pernah diunggah ke database virus publik).</em></span>
            `;
        }
    }

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
        badge.innerHTML = `<span style="color: var(--warning);">Pilih file di atas terlebih dahulu!</span>`;
        return;
    }
    if (inputVal === lastScannedFileHash.toLowerCase()) {
        badge.innerHTML = `<span style="color: var(--safe); font-weight: 600;">✅ 100% COCOK! File kamu identik dan asli sesuai checksum developer.</span>`;
    } else {
        badge.innerHTML = `<span style="color: var(--danger); font-weight: 600;">❌ TIDAK COCOK (Mismatch)! Kode SHA-256 berbeda, hati-hati file mungkin sudah dimodifikasi!</span>`;
    }
}

document.addEventListener('DOMContentLoaded', initDropzone);
