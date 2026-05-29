import { useState, useEffect, useRef } from 'react';
import { resizeImage } from '../lib/image.js';
import { matchPantry } from '../lib/pantry.js';

const CAT_ICONS = {
  dania: '🍽️', przekąski: '🥪', zupy: '🍲', desery: '🍰',
  ciasta: '🧁', napoje: '🥤', nalewki: '🍶', wędliny: '🥓',
  przetwory: '🫙', pieczywo: '🍞', sałatki: '🥗', inne: '📖',
};
const CATS = Object.keys(CAT_ICONS);

function AiPanel({ onResult, onClose }) {
  const [images, setImages] = useState([]);
  const [url, setUrl] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const addFiles = async (files) => {
    setError('');
    const arr = Array.from(files || []);
    for (const f of arr) {
      try { const d = await resizeImage(f); setImages(prev => [...prev, d]); }
      catch (e) { setError(String(e.message || e)); }
    }
  };

  const canAnalyze = images.length > 0 || url.trim() || desc.trim();

  const analyze = async () => {
    setLoading(true); setError('');
    try {
      const body = {};
      if (desc.trim()) body.prompt = desc.trim();
      if (images.length) body.images = images;
      if (url.trim()) body.url = url.trim();
      const r = await fetch('/api/recipe-ai', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      onResult(data.recipe || {});
    } catch (e) {
      setError(String(e.message || e));
    } finally { setLoading(false); }
  };

  return (
    <div style={{ background: 'var(--bg3)', border: '1px solid var(--accent)', borderRadius: 8, padding: 12, marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>🤖 Asystent AI</span>
        <button className="btn btn-icon" onClick={onClose}>✕</button>
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text2)', marginBottom: 10 }}>
        Opisz danie, dodaj zdjęcia lub wklej link — Gemini przygotuje przepis.
      </div>

      <label className="form-label">✍️ Opis dania</label>
      <textarea className="form-input" rows={2} style={{ marginBottom: 8, resize: 'vertical' }}
        placeholder="np. sałatka z tuńczyka, lekka i szybka" value={desc} onChange={e => setDesc(e.target.value)} />

      <div style={{ fontSize: '0.72rem', color: 'var(--text2)', textAlign: 'center', margin: '6px 0' }}>— lub —</div>

      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
        onChange={e => addFiles(e.target.files)} />
      <button className="btn btn-ghost" style={{ width: '100%', marginBottom: 8 }} onClick={() => fileRef.current?.click()}>
        📸 Dodaj zdjęcia ({images.length})
      </button>

      {images.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {images.map((src, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <img src={src} alt="" style={{ height: 50, width: 50, objectFit: 'cover', borderRadius: 4 }} />
              <button onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                style={{ position: 'absolute', top: -6, right: -6, background: 'var(--danger)', color: '#fff',
                  border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: '0.7rem', cursor: 'pointer' }}>✕</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: '0.72rem', color: 'var(--text2)', textAlign: 'center', margin: '6px 0' }}>— lub —</div>

      <input className="form-input" style={{ marginBottom: 8 }} placeholder="https://przepis-online.pl/..."
        value={url} onChange={e => setUrl(e.target.value)} />

      {error && <div className="alert-banner" style={{ marginBottom: 8, fontSize: '0.78rem' }}>⚠️ {error}</div>}

      <button className="btn btn-primary" style={{ width: '100%' }} onClick={analyze} disabled={loading || !canAnalyze}>
        {loading ? '⏳ Analizuję…' : '✨ Przygotuj przepis'}
      </button>
    </div>
  );
}

function RecipeForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || {
    title: '', category: 'dania', ingredients: '', instructions: '',
    prep_time: '', servings: '', image_url: '', notes: '', favourite: false,
    calories: '', protein: '', carbs: '', fat: '',
  });
  const [aiOpen, setAiOpen] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const applyAi = (rec) => {
    setForm(f => ({
      ...f,
      title: rec.title || f.title,
      category: CATS.includes(rec.category) ? rec.category : f.category,
      ingredients: rec.ingredients || f.ingredients,
      instructions: rec.instructions || f.instructions,
      prep_time: rec.prep_time || f.prep_time,
      servings: rec.servings || f.servings,
      calories: rec.calories || f.calories,
      protein: rec.protein || f.protein,
      carbs: rec.carbs || f.carbs,
      fat: rec.fat || f.fat,
    }));
    setAiOpen(false);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: '1rem', fontWeight: 700 }}>{initial?.id ? 'Edytuj przepis' : 'Nowy przepis'}</span>
          <button className="btn btn-primary" style={{ fontSize: '0.78rem', padding: '5px 10px' }}
            onClick={() => setAiOpen(o => !o)} title="Uzupełnij przez AI">
            🤖 AI
          </button>
        </div>

        {aiOpen && <AiPanel onResult={applyAi} onClose={() => setAiOpen(false)} />}

        <div className="form-group">
          <label className="form-label">Tytuł *</label>
          <input className="form-input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="np. Schabowy klasyczny" />
        </div>

        <div className="form-group">
          <label className="form-label">Kategoria</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {CATS.map(c => (
              <button key={c} className={`btn ${form.category === c ? 'btn-primary' : 'btn-ghost'}`} style={{ fontSize: '0.7rem', padding: '3px 7px' }}
                onClick={() => set('category', c)}>{CAT_ICONS[c]} {c}</button>
            ))}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Czas przygotowania</label>
            <input className="form-input" value={form.prep_time} onChange={e => set('prep_time', e.target.value)} placeholder="np. 45 min" />
          </div>
          <div className="form-group">
            <label className="form-label">Porcje</label>
            <input className="form-input" value={form.servings} onChange={e => set('servings', e.target.value)} placeholder="np. 4" />
          </div>
        </div>

        <label className="form-label">Wartości odżywcze (na porcję)</label>
        <div className="form-row" style={{ marginBottom: 14 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <input className="form-input" value={form.calories} onChange={e => set('calories', e.target.value)} placeholder="kcal" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <input className="form-input" value={form.protein} onChange={e => set('protein', e.target.value)} placeholder="białko g" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <input className="form-input" value={form.carbs} onChange={e => set('carbs', e.target.value)} placeholder="węgl. g" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <input className="form-input" value={form.fat} onChange={e => set('fat', e.target.value)} placeholder="tłuszcz g" />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Składniki (każdy w nowej linii)</label>
          <textarea className="form-input" rows={5} value={form.ingredients} onChange={e => set('ingredients', e.target.value)}
            placeholder={'500 g schabu\n2 jajka\nbułka tarta\nsól, pieprz'} style={{ resize: 'vertical' }} />
        </div>

        <div className="form-group">
          <label className="form-label">Przygotowanie</label>
          <textarea className="form-input" rows={6} value={form.instructions} onChange={e => set('instructions', e.target.value)}
            placeholder="Opis krok po kroku…" style={{ resize: 'vertical' }} />
        </div>

        <div className="form-group">
          <label className="form-label">Notatki</label>
          <textarea className="form-input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} style={{ resize: 'vertical' }} />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!form.favourite} onChange={e => set('favourite', e.target.checked)}
            style={{ width: 18, height: 18, accentColor: 'var(--warn)' }} />
          <span style={{ fontSize: '0.85rem' }}>⭐ Ulubiony (na górze listy)</span>
        </label>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onCancel}>Anuluj</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onSave(form)} disabled={!form.title.trim()}>Zapisz</button>
        </div>
      </div>
    </div>
  );
}

function Macro({ label, value, unit, color }) {
  if (!value) return null;
  return (
    <div style={{ flex: 1, textAlign: 'center', background: 'var(--bg3)', borderRadius: 8, padding: '8px 4px' }}>
      <div style={{ fontWeight: 700, fontSize: '0.95rem', color }}>{value}<span style={{ fontSize: '0.6rem', color: 'var(--text2)' }}>{unit}</span></div>
      <div style={{ fontSize: '0.62rem', color: 'var(--text2)' }}>{label}</div>
    </div>
  );
}

function ShoppingPicker({ recipe, products, onClose, onAdded }) {
  const lines = recipe.ingredients.split('\n').map(l => l.trim())
    .filter(l => l && !l.endsWith(':')); // pomiń nagłówki sekcji
  const [selected, setSelected] = useState(() =>
    // domyślnie zaznacz to, czego NIE ma w spiżarni
    lines.map(l => !matchPantry(l, products))
  );
  const [saving, setSaving] = useState(false);

  const toggle = (i) => setSelected(s => s.map((v, j) => j === i ? !v : v));

  const add = async () => {
    setSaving(true);
    for (let i = 0; i < lines.length; i++) {
      if (!selected[i]) continue;
      await fetch('/api/shopping', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: lines[i], quantity: 1, source: 'recipe' }),
      });
    }
    setSaving(false);
    onAdded(selected.filter(Boolean).length);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()} style={{ zIndex: 200 }}>
      <div className="modal">
        <div className="modal-title">🛒 Dodaj do listy zakupów</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text2)', marginBottom: 10 }}>
          Składniki ze spiżarni są domyślnie odznaczone.
        </div>
        {lines.map((l, i) => {
          const inP = matchPantry(l, products);
          return (
            <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer' }}>
              <input type="checkbox" checked={selected[i]} onChange={() => toggle(i)} style={{ width: 18, height: 18 }} />
              <span style={{ flex: 1, fontSize: '0.85rem' }}>{l}</span>
              {inP && <span style={{ fontSize: '0.6rem', color: 'var(--ok)', background: 'rgba(76,175,130,0.15)', padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}>✓ w spiżarni</span>}
            </label>
          );
        })}
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Anuluj</button>
          <button className="btn btn-ok" style={{ flex: 1 }} onClick={add} disabled={saving || !selected.some(Boolean)}>
            {saving ? 'Dodaję…' : `Dodaj (${selected.filter(Boolean).length})`}
          </button>
        </div>
      </div>
    </div>
  );
}

function RecipeView({ recipe, products, onClose, onEdit, onDelete, onShoppingAdded }) {
  const [picker, setPicker] = useState(false);
  const hasMacros = recipe.calories || recipe.protein || recipe.carbs || recipe.fat;
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{CAT_ICONS[recipe.category] || '📖'}</span>
            {recipe.title}
            {recipe.favourite ? <span>⭐</span> : null}
          </div>
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>

        <div style={{ fontSize: '0.75rem', color: 'var(--text2)', marginBottom: 12, display: 'flex', gap: 12 }}>
          {recipe.prep_time && <span>⏱️ {recipe.prep_time}</span>}
          {recipe.servings && <span>🍽️ {recipe.servings} porcji</span>}
          <span>{recipe.category}</span>
        </div>

        {hasMacros && (
          <>
            <div className="section-title">Wartości odżywcze (na porcję)</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <Macro label="kcal" value={recipe.calories} unit="" color="var(--accent)" />
              <Macro label="białko" value={recipe.protein} unit="g" color="var(--ok)" />
              <Macro label="węgle" value={recipe.carbs} unit="g" color="var(--warn)" />
              <Macro label="tłuszcz" value={recipe.fat} unit="g" color="var(--accent2)" />
            </div>
          </>
        )}

        {recipe.ingredients && (
          <>
            <div className="section-title">Składniki</div>
            <ul style={{ paddingLeft: 18, marginBottom: 10 }}>
              {recipe.ingredients.split('\n').filter(l => l.trim()).map((l, i) => {
                const isHeader = l.trim().endsWith(':');
                const inP = !isHeader && matchPantry(l, products);
                return (
                  <li key={i} style={{ fontSize: '0.88rem', marginBottom: 3, listStyle: isHeader ? 'none' : 'disc', marginLeft: isHeader ? -18 : 0, fontWeight: isHeader ? 700 : 400 }}>
                    {l}
                    {inP && <span style={{ fontSize: '0.6rem', color: 'var(--ok)', marginLeft: 6 }}>✓ spiżarnia</span>}
                  </li>
                );
              })}
            </ul>
            <button className="btn btn-ok" style={{ width: '100%', marginBottom: 12 }} onClick={() => setPicker(true)}>
              🛒 Dodaj składniki do zakupów
            </button>
          </>
        )}

        {recipe.instructions && (
          <>
            <div className="section-title">Przygotowanie</div>
            <div style={{ fontSize: '0.88rem', whiteSpace: 'pre-wrap', lineHeight: 1.5, marginBottom: 12 }}>
              {recipe.instructions}
            </div>
          </>
        )}

        {recipe.notes && (
          <>
            <div className="section-title">Notatki</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text2)', fontStyle: 'italic', marginBottom: 12 }}>{recipe.notes}</div>
          </>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => onEdit(recipe)}>✏️ Edytuj</button>
          <button className="btn btn-danger" onClick={() => onDelete(recipe.id)}>🗑️ Usuń</button>
        </div>
      </div>

      {picker && (
        <ShoppingPicker recipe={recipe} products={products}
          onClose={() => setPicker(false)}
          onAdded={(n) => { setPicker(false); onShoppingAdded?.(n); }} />
      )}
    </div>
  );
}

export default function Recipes({ onShoppingChanged }) {
  const [recipes, setRecipes] = useState([]);
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [toast, setToast] = useState(null); // { msg, loading }
  const toastTimer = useRef(null);

  const showToast = (msg, loading = false) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, loading });
    if (!loading) toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  const load = () => fetch('/api/recipes').then(r => r.json()).then(setRecipes);
  useEffect(() => {
    load();
    fetch('/api/products').then(r => r.json()).then(setProducts).catch(() => {});
  }, []);

  const save = async (form) => {
    const method = form.id ? 'PUT' : 'POST';
    const url = form.id ? `/api/recipes/${form.id}` : '/api/recipes';
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setEditing(null); setAdding(false); setViewing(null); load();
  };

  const del = async (id) => {
    if (!confirm('Usunąć przepis?')) return;
    await fetch(`/api/recipes/${id}`, { method: 'DELETE' });
    setViewing(null); load();
  };

  const toggleFav = async (r, e) => {
    e.stopPropagation();
    await fetch(`/api/recipes/${r.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...r, favourite: !r.favourite }) });
    load();
  };

  const addAllToShopping = async (r, e) => {
    e.stopPropagation();
    const lines = (r.ingredients || '').split('\n').map(l => l.trim()).filter(l => l && !l.endsWith(':'));
    if (lines.length === 0) { showToast('Przepis nie ma składników'); return; }
    showToast(`Dodaję ${lines.length} składników…`, true);
    for (const name of lines) {
      await fetch('/api/shopping', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, quantity: 1, source: 'recipe' }),
      });
    }
    onShoppingChanged?.();
    showToast(`Dodano ${lines.length} ${lines.length === 1 ? 'pozycję' : 'pozycji'} do zakupów`);
  };

  const filtered = recipes.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.title.toLowerCase().includes(q) || (r.ingredients || '').toLowerCase().includes(q);
    const matchCat = !catFilter || r.category === catFilter;
    return matchSearch && matchCat;
  });

  const RecipeCard = ({ r }) => (
    <div className="card" style={{ cursor: 'pointer' }} onClick={() => setViewing(r)}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ fontSize: '1.8rem', flexShrink: 0 }}>{CAT_ICONS[r.category] || '📖'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 4 }}>
            {r.title}
            {r.favourite ? <span style={{ fontSize: '0.8rem' }}>⭐</span> : null}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text2)', display: 'flex', gap: 10, marginTop: 2 }}>
            <span>{r.category}</span>
            {r.prep_time && <span>⏱️ {r.prep_time}</span>}
            {r.servings && <span>🍽️ {r.servings}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
          <button onClick={(e) => toggleFav(r, e)} title="Ulubiony"
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 4,
              fontSize: '1.3rem', lineHeight: 1, color: r.favourite ? 'var(--warn)' : 'var(--text2)',
            }}>{r.favourite ? '★' : '☆'}</button>
          <button onClick={(e) => addAllToShopping(r, e)} title="Dodaj składniki do zakupów"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, var(--ok), #3a9b6e)',
              boxShadow: '0 2px 6px rgba(76,175,130,0.4)',
            }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1" fill="#000" />
              <circle cx="20" cy="21" r="1" fill="#000" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
        <input className="search-input" style={{ flex: 1, marginBottom: 0 }} placeholder="🔍 Szukaj przepisu / składnika…" value={search} onChange={e => setSearch(e.target.value)} />
        <button className="btn btn-primary" onClick={() => setAdding(true)}>+ Dodaj</button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
        <button className={`btn ${!catFilter ? 'btn-primary' : 'btn-ghost'}`} style={{ fontSize: '0.7rem', padding: '3px 8px' }}
          onClick={() => setCatFilter('')}>Wszystkie</button>
        {CATS.map(c => (
          <button key={c} className={`btn ${catFilter === c ? 'btn-primary' : 'btn-ghost'}`} style={{ fontSize: '0.7rem', padding: '3px 7px' }}
            onClick={() => setCatFilter(catFilter === c ? '' : c)}>{CAT_ICONS[c]} {c}</button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="empty-state"><div className="emoji">📖</div><p>Brak przepisów — dodaj swój pierwszy!</p></div>
      )}

      {filtered.map(r => <RecipeCard key={r.id} r={r} />)}

      {(adding || editing) && (
        <RecipeForm initial={editing} onSave={save} onCancel={() => { setEditing(null); setAdding(false); }} />
      )}

      {viewing && !editing && (
        <RecipeView recipe={viewing} products={products} onClose={() => setViewing(null)}
          onEdit={(r) => { setEditing(r); }} onDelete={del}
          onShoppingAdded={(n) => {
            onShoppingChanged?.();
            showToast(`Dodano ${n} ${n === 1 ? 'pozycję' : 'pozycji'} do zakupów`);
          }} />
      )}

      {toast && (
        <div className="toast" style={{ background: toast.loading ? 'var(--accent)' : 'var(--ok)' }}>
          {toast.loading ? <span className="spinner" /> : <span>✅</span>}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
