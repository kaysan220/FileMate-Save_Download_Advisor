/* =========================================================
   API.JS — Wrapper Fetch Backend Python Flask & Fallback Lokal
   ========================================================= */

async function apiFetchJSON(url, options = {}) {
    try {
        const res = await fetch(url, {
            headers: { 'Content-Type': 'application/json' },
            ...options
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
    } catch (err) {
        return null;
    }
}