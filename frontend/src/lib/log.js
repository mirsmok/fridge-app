// Współdzielona utilka logowania — sessionStorage (zawsze) + backend (gdy debug włączony)
const DEBUG_KEY = 'app_debug_log';

export function logDbg(source, msg) {
  const t = new Date().toLocaleTimeString();
  try {
    const prev = sessionStorage.getItem(DEBUG_KEY) || '';
    sessionStorage.setItem(DEBUG_KEY, `[${t}] [${source}] ${msg}\n${prev}`.slice(0, 8000));
  } catch {}
  // Backend ignoruje gdy debug wyłączony
  fetch('/api/debug', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ msg, source }),
  }).catch(() => {});
}

export function readSessionLog() {
  try { return sessionStorage.getItem(DEBUG_KEY) || ''; } catch { return ''; }
}

export function clearSessionLog() {
  try { sessionStorage.removeItem(DEBUG_KEY); } catch {}
}
