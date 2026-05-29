import { useState, useRef, useEffect } from 'react';
import { logDbg as sharedLogDbg, readSessionLog } from '../lib/log.js';

const ITEMS_KEY = 'recognize_items';
const IMAGE_KEY = 'recognize_image';
const logDbg = (msg) => sharedLogDbg('Recognize', msg);

const UNITS = ['szt', 'g', 'kg', 'ml', 'l', 'op'];
const LOCATIONS = ['lodówka', 'zamrażarka', 'spiżarnia'];
const MAX_SIDE = 1280;

// Resize obrazu klientem do max MAX_SIDE × MAX_SIDE (JPEG q=0.85) — szybszy upload + tańsze API
function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Nie można odczytać pliku'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Nie można załadować obrazu'));
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_SIDE || height > MAX_SIDE) {
          const ratio = MAX_SIDE / Math.max(width, height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function Recognize({ onSaved }) {
  const [image, setImage] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [savingIdx, setSavingIdx] = useState(-1);
  const [savedCount, setSavedCount] = useState(0);
  const [defaultLocation, setDefaultLocation] = useState('lodówka');
  const [debug, setDebug] = useState(readSessionLog());
  const [hoveredIdx, setHoveredIdx] = useState(-1);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json())
      .then(s => setDebugEnabled(!!s.debug_enabled)).catch(() => {});
  }, []);

  // Restore zapisanych items + auto-resume gdy WebView się przeładował podczas uploadu
  useEffect(() => {
    try {
      const savedItems = sessionStorage.getItem(ITEMS_KEY);
      const savedImage = sessionStorage.getItem(IMAGE_KEY);

      if (savedItems) {
        const arr = JSON.parse(savedItems);
        if (Array.isArray(arr) && arr.length > 0) {
          setItems(arr);
          if (savedImage) setImage(savedImage);
          logDbg(`Restored ${arr.length} items from sessionStorage`);
          setDebug(readSessionLog());
          return;
        }
      }

      if (savedImage) {
        // Mamy zdjęcie ale nie mamy wyników — upload został przerwany przez restart WebView
        setImage(savedImage);
        logDbg('Wykryto przerwany upload — automatyczne wznawianie analizy');
        setDebug(readSessionLog());
        sendToGemini(savedImage);
      }
    } catch (e) {
      logDbg(`restore error: ${e.message}`);
    }
  }, []);

  const reset = () => {
    setImage(''); setItems([]); setLoading(false); setProgress('');
    setErrorMsg(''); setSavingIdx(-1); setSavedCount(0);
    sessionStorage.removeItem(ITEMS_KEY);
    sessionStorage.removeItem(IMAGE_KEY);
    if (fileRef.current) fileRef.current.value = '';
  };

  const sendToGemini = async (dataUrl) => {
    setErrorMsg('');
    try {
      setLoading(true);
      const base64 = dataUrl.split(',')[1];
      setProgress(`Wysyłam do Gemini (${Math.round(base64.length / 1024)} KB)…`);
      logDbg(`sendToGemini: ${Math.round(base64.length / 1024)} KB`);

      const r = await fetch('/api/recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mimeType: 'image/jpeg' }),
      });
      logDbg(`response status ${r.status}`);
      const text = await r.text();
      logDbg(`body ${text.length} chars: ${text.slice(0, 200)}`);
      let data;
      try { data = JSON.parse(text); }
      catch { throw new Error(`Niepoprawna odpowiedź serwera: ${text.slice(0, 200)}`); }

      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);

      const recognized = (data.items || []).map(it => ({
        ...it, accepted: true, expiry_date: '', location: defaultLocation,
      }));
      logDbg(`parsed ${recognized.length} items`);
      setItems(recognized);
      sessionStorage.setItem(ITEMS_KEY, JSON.stringify(recognized));
      if (recognized.length === 0) setErrorMsg('Gemini nie rozpoznał żadnych produktów na zdjęciu.');
    } catch (e) {
      logDbg(`ERROR: ${e.message}`);
      setErrorMsg(String(e.message || e));
    } finally {
      setLoading(false);
      setProgress('');
      setDebug(readSessionLog());
    }
  };

  const handleFile = async (file) => {
    if (!file) { logDbg('handleFile: no file'); return; }
    logDbg(`handleFile: file ${file.name} ${file.size}B type=${file.type}`);
    setErrorMsg(''); setItems([]); setSavedCount(0); setImage('');
    sessionStorage.removeItem(ITEMS_KEY);
    sessionStorage.removeItem(IMAGE_KEY);
    setDebug(readSessionLog());

    try {
      setLoading(true);
      setProgress('Przygotowuję zdjęcie…');
      const dataUrl = await resizeImage(file);
      setImage(dataUrl);
      sessionStorage.setItem(IMAGE_KEY, dataUrl);
      logDbg(`resized: ${Math.round(dataUrl.length / 1024)} KB`);
    } catch (e) {
      logDbg(`resize ERROR: ${e.message}`);
      setErrorMsg(String(e.message || e));
      setLoading(false);
      setProgress('');
      setDebug(readSessionLog());
      return;
    }

    // Wywołanie Gemini osobno, żeby auto-resume korzystał z tej samej ścieżki
    await sendToGemini(sessionStorage.getItem(IMAGE_KEY));
  };

  const updateItem = (idx, field, value) => {
    setItems(arr => arr.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const removeItem = (idx) => {
    setItems(arr => arr.filter((_, i) => i !== idx));
  };

  const saveAll = async () => {
    const indices = items.map((it, i) => it.accepted ? i : -1).filter(i => i >= 0);
    if (indices.length === 0) return;
    setSavedCount(0);
    for (const i of indices) {
      setSavingIdx(i);
      const it = items[i];
      try {
        await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: it.name,
            category: it.category || '',
            quantity: Number(it.quantity) || 1,
            unit: it.unit || 'szt',
            location: it.location || 'lodówka',
            expiry_date: it.expiry_date || null,
          }),
        });
        setSavedCount(c => c + 1);
      } catch {}
    }
    setSavingIdx(-1);
    const total = indices.length;
    setItems([]);
    setImage('');
    sessionStorage.removeItem(ITEMS_KEY);
    sessionStorage.removeItem(IMAGE_KEY);
    onSaved?.();
    setProgress(`Zapisano ${total} produktów`);
    setTimeout(() => setProgress(''), 3000);
  };

  return (
    <div>
      <div className="section-title">Rozpoznawanie ze zdjęcia (Gemini)</div>

      <input ref={fileRef} type="file" accept="image/*" capture="environment"
        style={{ display: 'none' }} onChange={e => handleFile(e.target.files?.[0])} />

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <button className="btn btn-primary" style={{ flex: 1, padding: '12px' }}
          onClick={() => fileRef.current?.click()} disabled={loading}>
          📸 Zrób / wybierz zdjęcie
        </button>
        {(image || items.length > 0 || errorMsg) && !loading && (
          <button className="btn btn-ghost" style={{ padding: '12px 16px' }} onClick={reset}>
            ✕ Reset
          </button>
        )}
      </div>

      {loading && (
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--accent)', borderRadius: 'var(--radius)',
          padding: 16, marginBottom: 12, textAlign: 'center',
        }}>
          <div style={{ fontSize: '1.8rem', marginBottom: 6 }}>⏳</div>
          <div style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: 4 }}>
            Analizuję zdjęcie…
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>{progress}</div>
        </div>
      )}

      {image && (
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
          <div style={{ position: 'relative', maxWidth: '100%', display: 'inline-block' }}>
            <img src={image} alt="" style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 8, display: 'block' }} />
            {items.map((it, idx) => {
              if (!Array.isArray(it.box) || it.box.length !== 4) return null;
              const [ymin, xmin, ymax, xmax] = it.box;
              const hovered = hoveredIdx === idx;
              const color = !it.accepted ? 'var(--text2)'
                : hovered ? 'var(--warn)' : 'var(--accent)';
              const bg = !it.accepted ? 'rgba(153,153,187,0.08)'
                : hovered ? 'rgba(240,160,48,0.18)' : 'rgba(79,142,247,0.08)';
              return (
                <div key={idx}
                  onClick={() => setHoveredIdx(idx === hoveredIdx ? -1 : idx)}
                  onDoubleClick={(e) => {
                    e.preventDefault(); e.stopPropagation();
                    updateItem(idx, 'accepted', !it.accepted);
                  }}
                  style={{
                    position: 'absolute',
                    left: `${xmin / 10}%`,
                    top: `${ymin / 10}%`,
                    width: `${(xmax - xmin) / 10}%`,
                    height: `${(ymax - ymin) / 10}%`,
                    border: `2px solid ${color}`,
                    background: bg,
                    borderRadius: 4, cursor: 'pointer',
                    transition: 'all 0.15s', pointerEvents: 'auto',
                    opacity: it.accepted ? 1 : 0.7,
                  }}>
                  <div style={{
                    position: 'absolute', top: -18, left: -2,
                    background: color, color: '#fff', fontSize: '0.62rem', fontWeight: 700,
                    padding: '1px 5px', borderRadius: 3, whiteSpace: 'nowrap',
                    textDecoration: it.accepted ? 'none' : 'line-through',
                  }}>
                    {idx + 1}. {it.name?.slice(0, 18)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="alert-banner" style={{ marginBottom: 12, whiteSpace: 'pre-wrap' }}>⚠️ {errorMsg}</div>
      )}

      {!loading && !errorMsg && progress && items.length === 0 && (
        <div style={{
          background: 'rgba(76,175,130,0.15)', border: '1px solid var(--ok)',
          borderRadius: 8, padding: 12, color: 'var(--ok)', textAlign: 'center', fontSize: '0.88rem',
          marginBottom: 12,
        }}>
          ✅ {progress}
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="form-group" style={{ marginBottom: 8 }}>
            <label className="form-label">Domyślne miejsce dla wszystkich</label>
            <select className="form-input" value={defaultLocation}
              onChange={e => {
                const loc = e.target.value;
                setDefaultLocation(loc);
                setItems(arr => arr.map(it => ({ ...it, location: loc })));
              }}>
              {LOCATIONS.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>

          <div className="section-title">Rozpoznane produkty ({items.filter(i => i.accepted).length}/{items.length})</div>

          {items.map((it, idx) => (
            <div key={idx} className="card"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(-1)}
              style={{
                opacity: it.accepted ? 1 : 0.4,
                border: hoveredIdx === idx ? '1px solid var(--warn)'
                  : (savingIdx === idx ? '1px solid var(--accent)' : undefined),
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{
                  background: 'var(--accent)', color: '#fff', fontSize: '0.7rem', fontWeight: 700,
                  padding: '2px 7px', borderRadius: 10, minWidth: 22, textAlign: 'center',
                }}>{idx + 1}</span>
                <input type="checkbox" checked={it.accepted}
                  onChange={e => updateItem(idx, 'accepted', e.target.checked)}
                  style={{ width: 20, height: 20 }} />
                <input className="form-input" value={it.name} onChange={e => updateItem(idx, 'name', e.target.value)}
                  style={{ flex: 1 }} placeholder="Nazwa" />
                {it.confidence !== undefined && (
                  <span style={{
                    fontSize: '0.65rem', color: it.confidence > 0.7 ? 'var(--ok)' : 'var(--warn)',
                    background: 'var(--bg3)', padding: '2px 6px', borderRadius: 4,
                  }}>
                    {Math.round(it.confidence * 100)}%
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <input className="form-input" type="number" min="0.1" step="0.1" value={it.quantity}
                  onChange={e => updateItem(idx, 'quantity', e.target.value)}
                  style={{ flex: 1 }} placeholder="Ilość" />
                <select className="form-input" value={it.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} style={{ flex: 1 }}>
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
                <select className="form-input" value={it.location} onChange={e => updateItem(idx, 'location', e.target.value)} style={{ flex: 1 }}>
                  {LOCATIONS.map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input className="form-input" value={it.category || ''}
                  onChange={e => updateItem(idx, 'category', e.target.value)}
                  style={{ flex: 1 }} placeholder="Kategoria" />
                <input className="form-input" type="date" value={it.expiry_date || ''}
                  onChange={e => updateItem(idx, 'expiry_date', e.target.value)}
                  style={{ flex: 1 }} />
                <button className="btn btn-danger" onClick={() => removeItem(idx)}>✕</button>
              </div>
            </div>
          ))}

          <button className="btn btn-ok" style={{ width: '100%', padding: '12px', marginTop: 8 }}
            onClick={saveAll} disabled={savingIdx >= 0 || items.filter(i => i.accepted).length === 0}>
            {savingIdx >= 0
              ? `⏳ Zapisuję ${savedCount + 1}/${items.filter(i => i.accepted).length}…`
              : `✅ Dodaj zaznaczone (${items.filter(i => i.accepted).length}) do spiżarni`}
          </button>
        </>
      )}

      {debugEnabled && (
        <div style={{
          marginTop: 20, padding: 10, background: 'var(--bg3)', border: '1px solid var(--border)',
          borderRadius: 6, fontSize: '0.65rem', color: 'var(--text2)', fontFamily: 'monospace',
          whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 200, overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <strong>🐛 Debug</strong>
            <button style={{ background: 'transparent', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: '0.7rem' }}
              onClick={() => { sessionStorage.removeItem('app_debug_log'); setDebug(''); }}>
              wyczyść
            </button>
          </div>
          state: loading={String(loading)} items={items.length} image={image ? `${Math.round(image.length/1024)}KB` : 'no'} err={errorMsg ? 'YES' : 'no'}
          {'\n---\n'}
          {debug || '(brak logów)'}
        </div>
      )}
    </div>
  );
}
