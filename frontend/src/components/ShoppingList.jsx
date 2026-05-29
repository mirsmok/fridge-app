import { useState } from 'react';
import { matchPantry } from '../lib/pantry.js';

export default function ShoppingList({ items, onRefresh, products = [] }) {
  const [newName, setNewName] = useState('');
  const [newQty, setNewQty] = useState(1);
  const [adding, setAdding] = useState(false);

  const toggle = async (item) => {
    await fetch(`/api/shopping/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checked: !item.checked, quantity: item.quantity }),
    });
    onRefresh();
  };

  const remove = async (id) => {
    await fetch(`/api/shopping/${id}`, { method: 'DELETE' });
    onRefresh();
  };

  const clearChecked = async () => {
    if (!confirm('Usunąć zaznaczone pozycje?')) return;
    await fetch('/api/shopping', { method: 'DELETE' });
    onRefresh();
  };

  const clearAll = async () => {
    if (!confirm('Wyczyścić CAŁĄ listę zakupów?')) return;
    await fetch('/api/shopping?all=1', { method: 'DELETE' });
    onRefresh();
  };

  const addItem = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    await fetch('/api/shopping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), quantity: Number(newQty) }),
    });
    setNewName('');
    setNewQty(1);
    setAdding(false);
    onRefresh();
  };

  const unchecked = items.filter(i => !i.checked);
  const checked = items.filter(i => i.checked);

  return (
    <div>
      <form onSubmit={addItem} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          className="form-input"
          placeholder="Dodaj produkt…"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          style={{ flex: 1 }}
        />
        <input
          className="form-input"
          type="number" min="1" step="1"
          value={newQty}
          onChange={e => setNewQty(e.target.value)}
          style={{ width: 56 }}
        />
        <button className="btn btn-primary" type="submit" disabled={adding}>+</button>
      </form>

      {items.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <button className="btn btn-danger" style={{ fontSize: '0.72rem', padding: '5px 12px' }} onClick={clearAll}>
            🗑️ Wyczyść całą listę
          </button>
        </div>
      )}

      {items.length === 0 && (
        <div className="empty-state">
          <div className="emoji">🛒</div>
          <p>Lista zakupów jest pusta</p>
        </div>
      )}

      {unchecked.length > 0 && (
        <>
          <div className="section-title">Do kupienia ({unchecked.length})</div>
          {unchecked.map(item => {
            const inP = matchPantry(item.name, products);
            return (
              <div key={item.id} className="shopping-item">
                <input type="checkbox" className="shopping-checkbox" checked={false} onChange={() => toggle(item)} />
                <span className="shopping-name">
                  {item.name}
                  {inP && <span style={{ fontSize: '0.6rem', color: 'var(--ok)', background: 'rgba(76,175,130,0.15)', padding: '2px 6px', borderRadius: 4, marginLeft: 6, whiteSpace: 'nowrap' }}>✓ w spiżarni</span>}
                </span>
                <span className="shopping-qty">{item.quantity} {item.unit}</span>
                <button className="btn btn-icon" style={{ padding: '4px 6px' }} onClick={() => remove(item.id)}>✕</button>
              </div>
            );
          })}
        </>
      )}

      {checked.length > 0 && (
        <>
          <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Kupione ({checked.length})</span>
            <button className="btn btn-danger" style={{ fontSize: '0.68rem', padding: '3px 8px' }} onClick={clearChecked}>
              Wyczyść
            </button>
          </div>
          {checked.map(item => (
            <div key={item.id} className="shopping-item checked">
              <input type="checkbox" className="shopping-checkbox" checked={true} onChange={() => toggle(item)} />
              <span className="shopping-name checked">{item.name}</span>
              <span className="shopping-qty">{item.quantity} {item.unit}</span>
              <button className="btn btn-icon" style={{ padding: '4px 6px' }} onClick={() => remove(item.id)}>✕</button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
