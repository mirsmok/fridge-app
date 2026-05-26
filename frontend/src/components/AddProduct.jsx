import { useState } from 'react';
import Scanner from './Scanner.jsx';

const UNITS = ['szt', 'g', 'kg', 'ml', 'l', 'op'];
const LOCATIONS = ['lodówka', 'zamrażarka', 'spiżarnia'];

const empty = { barcode: '', name: '', category: '', image_url: '', quantity: 1, unit: 'szt', expiry_date: '', location: 'lodówka', notes: '' };

export default function AddProduct({ onAdded }) {
  const [scanning, setScanning] = useState(false);
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);
  const [lookupMsg, setLookupMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleScan = async (code) => {
    setScanning(false);
    set('barcode', code);
    setLoading(true);
    setLookupMsg('Szukam produktu…');
    try {
      const r = await fetch(`/api/barcode/${encodeURIComponent(code)}`);
      const data = await r.json();
      if (data.found) {
        setForm(f => ({
          ...f,
          barcode: code,
          name: data.name || f.name,
          category: data.category || f.category,
          image_url: data.image_url || f.image_url,
        }));
        setLookupMsg(`✅ Znaleziono: ${data.name}`);
      } else {
        setLookupMsg('⚠️ Nieznany produkt — uzupełnij ręcznie');
      }
    } catch {
      setLookupMsg('⚠️ Błąd sieci — uzupełnij ręcznie');
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, quantity: Number(form.quantity) }),
    });
    setSaving(false);
    setForm(empty);
    setLookupMsg('');
    onAdded();
  };

  if (scanning) {
    return (
      <div>
        <div className="section-title">Skanuj kod kreskowy</div>
        <Scanner onScan={handleScan} onClose={() => setScanning(false)} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="section-title">Nowy produkt</div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={() => setScanning(true)}>
          📷 Skanuj kod kreskowy
        </button>
        {form.barcode && (
          <button type="button" className="btn btn-ghost" style={{ fontSize: '0.72rem' }}
            onClick={() => { setForm(empty); setLookupMsg(''); }}>
            ✕ Wyczyść
          </button>
        )}
      </div>

      {form.barcode && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text2)', marginBottom: 10 }}>
          Kod: <code style={{ color: 'var(--accent)' }}>{form.barcode}</code>
        </div>
      )}

      {lookupMsg && (
        <div style={{ fontSize: '0.82rem', marginBottom: 12, color: lookupMsg.startsWith('✅') ? 'var(--ok)' : 'var(--warn)' }}>
          {loading ? '⏳ ' : ''}{lookupMsg}
        </div>
      )}

      {form.image_url && (
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <img src={form.image_url} alt="" style={{ height: 80, objectFit: 'contain', borderRadius: 8 }} />
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Nazwa *</label>
        <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)}
          placeholder="np. Mleko 3,2%" required />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Ilość</label>
          <input className="form-input" type="number" min="0.1" step="0.1"
            value={form.quantity} onChange={e => set('quantity', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Jednostka</label>
          <select className="form-input" value={form.unit} onChange={e => set('unit', e.target.value)}>
            {UNITS.map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Data ważności</label>
        <input className="form-input" type="date" value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Kategoria</label>
          <input className="form-input" value={form.category} onChange={e => set('category', e.target.value)}
            placeholder="np. nabiał" />
        </div>
        <div className="form-group">
          <label className="form-label">Miejsce</label>
          <select className="form-input" value={form.location} onChange={e => set('location', e.target.value)}>
            {LOCATIONS.map(l => <option key={l}>{l}</option>)}
          </select>
        </div>
      </div>

      <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={saving}>
        {saving ? 'Zapisuję…' : '✅ Dodaj do lodówki'}
      </button>
    </form>
  );
}
