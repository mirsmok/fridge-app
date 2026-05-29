import { useState, useEffect } from 'react';
import { logDbg } from '../lib/log.js';

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [log, setLog] = useState('');
  const [logVisible, setLogVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(setSettings).catch(() => setSettings({ debug_enabled: false }));
  }, []);

  const updateSetting = async (key, value) => {
    setSaving(true);
    logDbg('Settings', `${key} → ${value}`);
    try {
      const r = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
      const data = await r.json();
      setSettings(data);
      // Po włączeniu debugu wyślij jeszcze raz potwierdzenie — będzie pierwszy wpis w pliku log
      if (key === 'debug_enabled' && value === true) {
        logDbg('Settings', 'debug_enabled=true (pierwszy wpis po włączeniu)');
      }
    } finally { setSaving(false); }
  };

  const refreshLog = async () => {
    const r = await fetch('/api/debug');
    const text = await r.text();
    setLog(text);
    setLogVisible(true);
  };

  const clearLog = async () => {
    await fetch('/api/debug', { method: 'DELETE' });
    setLog('');
  };

  if (!settings) {
    return <div className="empty-state"><div className="emoji">⏳</div><p>Ładuję ustawienia…</p></div>;
  }

  return (
    <div>
      <div className="section-title">Diagnostyka</div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
              🐛 Debug: <span style={{ color: settings.debug_enabled ? 'var(--ok)' : 'var(--text2)' }}>
                {settings.debug_enabled ? 'WŁĄCZONY' : 'wyłączony'}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text2)', marginTop: 2 }}>
              Zapisuje logi działania aplikacji na serwerze (~/fridge-app/backend/debug.log)
            </div>
          </div>
          <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24 }}>
            <input type="checkbox" checked={!!settings.debug_enabled} disabled={saving}
              onChange={e => updateSetting('debug_enabled', e.target.checked)}
              style={{ opacity: 0, width: 0, height: 0 }} />
            <span style={{
              position: 'absolute', cursor: 'pointer', inset: 0,
              background: settings.debug_enabled ? 'var(--accent)' : 'var(--bg3)',
              borderRadius: 24, transition: '0.2s',
            }}>
              <span style={{
                position: 'absolute', height: 18, width: 18, top: 3,
                left: settings.debug_enabled ? 23 : 3,
                background: '#fff', borderRadius: '50%', transition: '0.2s',
              }} />
            </span>
          </label>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={refreshLog}>
          📄 Pokaż log z serwera
        </button>
        <button className="btn btn-danger" onClick={clearLog} disabled={!log}>
          🗑️ Wyczyść
        </button>
      </div>

      {logVisible && (
        <div style={{
          background: 'var(--bg3)', border: '1px solid var(--border)',
          borderRadius: 6, padding: 10, fontSize: '0.7rem', color: 'var(--text2)',
          fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          maxHeight: 400, overflowY: 'auto',
        }}>
          {log || '(pusty log)'}
        </div>
      )}
    </div>
  );
}
