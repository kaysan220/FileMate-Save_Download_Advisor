/* =========================================================
   FILEMATE API.JS — fetch() bersama + penanganan error
   Semua pemanggilan backend Flask lewat helper di sini.
   Jika backend tidak aktif (file dibuka langsung), fungsi
   akan melempar error → pemanggil memakai fallback lokal.
   ========================================================= */

const API_BASE = '/api';

async function apiRequest(path, options = {}) {
    const res = await fetch(API_BASE + path, {
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
}

function apiGet(path) {
    return apiRequest(path);
}

function apiPost(path, body) {
    return apiRequest(path, { method: 'POST', body: JSON.stringify(body) });
}
