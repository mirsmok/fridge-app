import { useState } from 'react';

const UNITS = ['szt', 'g', 'kg', 'ml', 'l', 'op'];
const LOCATIONS = ['lodówka', 'zamrażarka', 'spiżarnia'];

function expiryInfo(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const exp = new Date(dateStr); exp.setHours(0,0,0,0);
  const diff = Math.round((exp - today) / 86400000);
  if (diff < 0) return { label: `Przeterminowane ${Math.abs(diff)}d temu`, cls: 'expiry-expired' };
  if (diff === 0) return { label: 'Wygasa dziś!', cls: 'expiry-danger' };
  if (diff <= 3) return { label: `Wygasa za ${diff}d`, cls: 'expiry-danger' };
  if (diff <= 7) return { label: `Wygasa za ${diff}d`, cls: 'expiry-warn' };
  return { label: `Ważne do: ${dateStr}`, cls: 'expiry-ok' };
}

function EditModal({ product, onSave, onClose }) {
  const [form, setForm] = useState({ ...product, expiry_date: product.expiry_date || '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    await fetch(`/api/products/${product.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, quantity: Number(form.quantity) }),
    });
    onSave();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">Edytuj produkt</div>
        <div className="form-group">
          <label className="form-label">Nazwa</label>
          <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Ilość</label>
            <input className="form-input" type="number" min="0" step="0.1"
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
            <input className="form-input" value={form.category} onChange={e => set('category', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Miejsce</label>
            <select className="form-input" value={form.location} onChange={e => set('location', e.target.value)}>
              {LOCATIONS.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Anuluj</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave}>Zapisz</button>
        </div>
      </div>
    </div>
  );
}

export default function ProductList({ products, onRefresh, onAddToShopping }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null);

  const deleteProduct = async (id) => {
    if (!confirm('Usunąć produkt?')) return;
    await fetch(`/api/products/${id}`, { method: 'DELETE' });
    onRefresh();
  };

  const today = new Date(); today.setHours(0,0,0,0);
  const in7 = new Date(today); in7.setDate(today.getDate() + 7);

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q);
    if (!matchSearch) return false;
    if (filter === 'expiring') {
      if (!p.expiry_date) return false;
      const exp = new Date(p.expiry_date);
      return exp <= in7;
    }
    if (filter === 'expired') {
      if (!p.expiry_date) return false;
      return new Date(p.expiry_date) < today;
    }
    return true;
  });

  const expiredCount = products.filter(p => p.expiry_date && new Date(p.expiry_date) < today).length;
  const expiringCount = products.filter(p => {
    if (!p.expiry_date) return false;
    const exp = new Date(p.expiry_date);
    return exp >= today && exp <= in7;
  }).length;

  return (
    <div>
      <input
        className="search-input"
        placeholder="🔍 Szukaj produktu…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: `Wszystkie (${products.length})` },
          { key: 'expiring', label: `⚠️ Wygasające (${expiringCount})` },
          { key: 'expired', label: `❌ Przeter. (${expiredCount})` },
        ].map(f => (
          <button key={f.key}
            className={`btn ${filter === f.key ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '0.72rem', padding: '5px 10px' }}
            onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="empty-state">
          <div className="emoji">🧊</div>
          <p>{search ? 'Brak wyników' : 'Lodówka pusta — dodaj pierwszy produkt!'}</p>
        </div>
      )}

      {filtered.map(p => {
        const exp = expiryInfo(p.expiry_date);
        return (
          <div key={p.id} className="card">
            <div className="product-card">
              {p.image_url
                ? <img className="product-img" src={p.image_url} alt="" />
                : <div className="product-img-placeholder">🥫</div>
              }
              <div className="product-info">
                <div className="product-name">{p.name}</div>
                <div className="product-meta">
                  {p.quantity} {p.unit}
                  {p.category ? ` · ${p.category}` : ''}
                  {p.location !== 'lodówka' ? ` · ${p.location}` : ''}
                </div>
                {exp && <div className={`product-meta ${exp.cls}`} style={{ marginTop: 4 }}>{exp.label}</div>}
              </div>
            </div>
            <div className="product-actions">
              <button className="btn btn-icon" onClick={() => setEditing(p)} title="Edytuj">✏️</button>
              <button className="btn btn-icon" onClick={() => deleteProduct(p.id)} title="Usuń">🗑️</button>
              <button className="btn btn-warn" style={{ fontSize: '0.72rem' }}
                onClick={() => onAddToShopping(p)}>
                + lista zakupów
              </button>
            </div>
          </div>
        );
      })}

      {editing && (
        <EditModal
          product={editing}
          onSave={() => { setEditing(null); onRefresh(); }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
