import { useState, useEffect } from 'react';

const CATEGORIES = ['ubezpieczenie','pojazd','tożsamość','nieruchomość','zdrowie','praca','inne'];
const CAT_ICONS = { ubezpieczenie:'🛡️', pojazd:'🚗', tożsamość:'🪪', nieruchomość:'🏠', zdrowie:'🏥', praca:'💼', inne:'📄' };

function daysDiff(d) {
  if (!d) return null;
  const now = new Date(); now.setHours(0,0,0,0);
  return Math.round((new Date(d) - now) / 86400000);
}

function ExpiryStatus({ date }) {
  if (!date) return <span style={{color:'var(--text2)',fontSize:'0.72rem'}}>Bezterminowy</span>;
  const d = daysDiff(date);
  if (d < 0) return <span className="expiry-expired" style={{fontSize:'0.75rem'}}>Wygasł {Math.abs(d)}d temu</span>;
  if (d === 0) return <span className="expiry-danger" style={{fontSize:'0.75rem'}}>Wygasa DZIŚ</span>;
  if (d <= 30) return <span className="expiry-danger" style={{fontSize:'0.75rem'}}>Wygasa za {d}d</span>;
  if (d <= 90) return <span className="expiry-warn" style={{fontSize:'0.75rem'}}>Wygasa za {d}d</span>;
  return <span className="expiry-ok" style={{fontSize:'0.75rem'}}>Ważny do {date}</span>;
}

function DocForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || { name:'', category:'inne', issue_date:'', expiry_date:'', reminder_days:30, notes:'' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onCancel()}>
      <div className="modal">
        <div className="modal-title">{initial?.id?'Edytuj dokument':'Nowy dokument'}</div>
        <div className="form-group">
          <label className="form-label">Nazwa *</label>
          <input className="form-input" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="np. OC samochodu" />
        </div>
        <div className="form-group">
          <label className="form-label">Kategoria</label>
          <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:8}}>
            {CATEGORIES.map(c=>(
              <button key={c} className={`btn ${form.category===c?'btn-primary':'btn-ghost'}`} style={{fontSize:'0.72rem',padding:'4px 8px'}}
                onClick={()=>set('category',c)}>{CAT_ICONS[c]} {c}</button>
            ))}
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Data wydania</label>
            <input className="form-input" type="date" value={form.issue_date} onChange={e=>set('issue_date',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Data ważności</label>
            <input className="form-input" type="date" value={form.expiry_date} onChange={e=>set('expiry_date',e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Przypomnienie (dni przed wygaśnięciem)</label>
          <div style={{display:'flex',gap:6,marginBottom:6}}>
            {[7,14,30,60,90].map(d=>(
              <button key={d} className={`btn ${form.reminder_days==d?'btn-primary':'btn-ghost'}`} style={{fontSize:'0.72rem',padding:'4px 8px'}} onClick={()=>set('reminder_days',d)}>{d}d</button>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Notatki</label>
          <textarea className="form-input" rows={2} value={form.notes} onChange={e=>set('notes',e.target.value)} style={{resize:'vertical'}} placeholder="nr polisy, numer dokumentu, itp." />
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-ghost" style={{flex:1}} onClick={onCancel}>Anuluj</button>
          <button className="btn btn-primary" style={{flex:1}} onClick={()=>onSave(form)} disabled={!form.name.trim()}>Zapisz</button>
        </div>
      </div>
    </div>
  );
}

export default function Documents() {
  const [docs, setDocs] = useState([]);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState('all');

  const load = () => fetch('/api/documents').then(r=>r.json()).then(setDocs);
  useEffect(()=>{ load(); },[]);

  const save = async (form) => {
    const method=form.id?'PUT':'POST';
    const url=form.id?`/api/documents/${form.id}`:'/api/documents';
    await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
    setEditing(null); setAdding(false); load();
  };

  const del = async (id) => {
    if(!confirm('Usunąć dokument?')) return;
    await fetch(`/api/documents/${id}`,{method:'DELETE'}); load();
  };

  const today = new Date().toISOString().split('T')[0];
  const in30 = new Date(Date.now()+30*86400000).toISOString().split('T')[0];

  const expiredCount = docs.filter(d=>d.expiry_date&&d.expiry_date<today).length;
  const expiringCount = docs.filter(d=>d.expiry_date&&d.expiry_date>=today&&d.expiry_date<=in30).length;

  const filtered = docs.filter(d => {
    if (filter==='expiring') return d.expiry_date && d.expiry_date <= in30;
    if (filter==='expired') return d.expiry_date && d.expiry_date < today;
    return true;
  });

  return (
    <div>
      <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
        <div style={{flex:1,display:'flex',gap:6,flexWrap:'wrap'}}>
          {[['all','Wszystkie'],['expiring',`Wygasające (${expiredCount+expiringCount})`],['expired',`Wygasłe (${expiredCount})`]].map(([k,l])=>(
            <button key={k} className={`btn ${filter===k?'btn-primary':'btn-ghost'}`} style={{fontSize:'0.72rem',padding:'5px 10px'}} onClick={()=>setFilter(k)}>{l}</button>
          ))}
        </div>
        <button className="btn btn-primary" onClick={()=>setAdding(true)}>+ Dodaj</button>
      </div>

      {filtered.length===0 && (
        <div className="empty-state"><div className="emoji">📄</div><p>Brak dokumentów — dodaj OC, ubezpieczenie domu, paszport!</p></div>
      )}

      {filtered.map(d => {
        const diff = daysDiff(d.expiry_date);
        const borderColor = !d.expiry_date ? 'var(--border)' : diff<0 ? 'var(--danger)' : diff<=30 ? 'var(--warn)' : 'var(--ok)';
        return (
          <div key={d.id} className="card" style={{borderLeft:`3px solid ${borderColor}`}}>
            <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
              <div style={{fontSize:'1.8rem',flexShrink:0}}>{CAT_ICONS[d.category]||'📄'}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:'0.9rem'}}>{d.name}</div>
                <div style={{fontSize:'0.72rem',color:'var(--text2)',marginTop:2}}>{d.category}</div>
                {d.issue_date && <div style={{fontSize:'0.72rem',color:'var(--text2)'}}>Wydany: {d.issue_date}</div>}
                <div style={{marginTop:4}}><ExpiryStatus date={d.expiry_date} /></div>
                {d.notes && <div style={{fontSize:'0.72rem',color:'var(--text2)',marginTop:4,fontStyle:'italic'}}>{d.notes}</div>}
              </div>
              <div style={{display:'flex',gap:4,flexShrink:0}}>
                <button className="btn btn-icon" onClick={()=>setEditing(d)}>✏️</button>
                <button className="btn btn-icon" onClick={()=>del(d.id)}>🗑️</button>
              </div>
            </div>
          </div>
        );
      })}

      {(adding||editing) && (
        <DocForm initial={editing} onSave={save} onCancel={()=>{setEditing(null);setAdding(false);}} />
      )}
    </div>
  );
}
