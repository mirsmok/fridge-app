import { useState, useEffect } from 'react';

const CATEGORIES = ['AGD','RTV','ogrzewanie','klimatyzacja','narzędzia','auto','inne'];

function addMonths(dateStr, months) {
  if (!dateStr || !months) return null;
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + Number(months));
  return d.toISOString().split('T')[0];
}

function daysDiff(d) {
  if (!d) return null;
  const now = new Date(); now.setHours(0,0,0,0);
  return Math.round((new Date(d) - now) / 86400000);
}

function StatusChip({ label, date }) {
  if (!date) return null;
  const d = daysDiff(date);
  const cls = d < 0 ? 'expiry-expired' : d <= 30 ? 'expiry-danger' : d <= 90 ? 'expiry-warn' : 'expiry-ok';
  const text = d < 0 ? `${label}: wygasła` : d === 0 ? `${label}: dziś!` : `${label}: ${date}`;
  return <span className={cls} style={{fontSize:'0.72rem',display:'block',marginTop:2}}>{text}</span>;
}

function ApplianceForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || { name:'', category:'AGD', brand:'', model:'', purchase_date:'', warranty_months:'', last_service:'', service_interval_months:'', notes:'' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const warrantyEnd = addMonths(form.purchase_date, form.warranty_months);
  const nextService = addMonths(form.last_service, form.service_interval_months);
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onCancel()}>
      <div className="modal">
        <div className="modal-title">{initial?.id?'Edytuj urządzenie':'Nowe urządzenie'}</div>
        <div className="form-group">
          <label className="form-label">Nazwa *</label>
          <input className="form-input" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="np. Pralka" />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Kategoria</label>
            <select className="form-input" value={form.category} onChange={e=>set('category',e.target.value)}>
              {CATEGORIES.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Marka</label>
            <input className="form-input" value={form.brand} onChange={e=>set('brand',e.target.value)} placeholder="np. Bosch" />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Model</label>
          <input className="form-input" value={form.model} onChange={e=>set('model',e.target.value)} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Data zakupu</label>
            <input className="form-input" type="date" value={form.purchase_date} onChange={e=>set('purchase_date',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Gwarancja (mies.)</label>
            <input className="form-input" type="number" min="0" value={form.warranty_months} onChange={e=>set('warranty_months',e.target.value)} />
          </div>
        </div>
        {warrantyEnd && <div style={{fontSize:'0.75rem',color:'var(--text2)',marginBottom:10}}>Koniec gwarancji: <strong>{warrantyEnd}</strong></div>}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Ostatni serwis</label>
            <input className="form-input" type="date" value={form.last_service} onChange={e=>set('last_service',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Serwis co (mies.)</label>
            <input className="form-input" type="number" min="0" value={form.service_interval_months} onChange={e=>set('service_interval_months',e.target.value)} />
          </div>
        </div>
        {nextService && <div style={{fontSize:'0.75rem',color:'var(--text2)',marginBottom:10}}>Następny serwis: <strong>{nextService}</strong></div>}
        <div className="form-group">
          <label className="form-label">Notatki</label>
          <textarea className="form-input" rows={2} value={form.notes} onChange={e=>set('notes',e.target.value)} style={{resize:'vertical'}} />
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-ghost" style={{flex:1}} onClick={onCancel}>Anuluj</button>
          <button className="btn btn-primary" style={{flex:1}} onClick={()=>onSave(form)} disabled={!form.name.trim()}>Zapisz</button>
        </div>
      </div>
    </div>
  );
}

export default function Appliances() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState('all');

  const load = () => fetch('/api/appliances').then(r=>r.json()).then(setItems);
  useEffect(()=>{ load(); },[]);

  const save = async (form) => {
    const method=form.id?'PUT':'POST';
    const url=form.id?`/api/appliances/${form.id}`:'/api/appliances';
    await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
    setEditing(null); setAdding(false); load();
  };

  const del = async (id) => {
    if(!confirm('Usunąć urządzenie?')) return;
    await fetch(`/api/appliances/${id}`,{method:'DELETE'}); load();
  };

  const today = new Date().toISOString().split('T')[0];
  const in30 = new Date(Date.now()+30*86400000).toISOString().split('T')[0];

  const enriched = items.map(a => ({
    ...a,
    warrantyEnd: addMonths(a.purchase_date, a.warranty_months),
    nextService: addMonths(a.last_service, a.service_interval_months),
  }));

  const filtered = enriched.filter(a => {
    if (filter==='alert') return (a.warrantyEnd&&a.warrantyEnd<=in30) || (a.nextService&&a.nextService<=in30);
    return true;
  });

  const alertCount = enriched.filter(a=>(a.warrantyEnd&&a.warrantyEnd<=in30)||(a.nextService&&a.nextService<=in30)).length;

  return (
    <div>
      <div style={{display:'flex',gap:6,marginBottom:12,alignItems:'center'}}>
        <div style={{flex:1,display:'flex',gap:6}}>
          {[['all','Wszystkie'],['alert',`Alerty${alertCount?` (${alertCount})`:'`'}`]].map(([k,l])=>(
            <button key={k} className={`btn ${filter===k?'btn-primary':'btn-ghost'}`} style={{fontSize:'0.72rem',padding:'5px 10px'}} onClick={()=>setFilter(k)}>{l}</button>
          ))}
        </div>
        <button className="btn btn-primary" onClick={()=>setAdding(true)}>+ Dodaj</button>
      </div>

      {filtered.length===0 && (
        <div className="empty-state"><div className="emoji">🔧</div><p>Brak urządzeń — dodaj pierwszą pralkę, lodówkę lub kocioł!</p></div>
      )}

      {filtered.map(a=>(
        <div key={a.id} className="card">
          <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:'0.95rem'}}>{a.name}</div>
              <div style={{fontSize:'0.75rem',color:'var(--text2)',marginTop:2}}>
                {[a.brand,a.model,a.category].filter(Boolean).join(' · ')}
              </div>
              {a.purchase_date && <div style={{fontSize:'0.72rem',color:'var(--text2)'}}>Zakup: {a.purchase_date}</div>}
              <StatusChip label="Gwarancja" date={a.warrantyEnd} />
              <StatusChip label="Serwis" date={a.nextService} />
              {a.notes && <div style={{fontSize:'0.72rem',color:'var(--text2)',marginTop:4,fontStyle:'italic'}}>{a.notes}</div>}
            </div>
            <div style={{display:'flex',gap:4,flexShrink:0}}>
              <button className="btn btn-icon" onClick={()=>setEditing(a)}>✏️</button>
              <button className="btn btn-icon" onClick={()=>del(a.id)}>🗑️</button>
            </div>
          </div>
        </div>
      ))}

      {(adding||editing) && (
        <ApplianceForm initial={editing} onSave={save} onCancel={()=>{setEditing(null);setAdding(false);}} />
      )}
    </div>
  );
}
