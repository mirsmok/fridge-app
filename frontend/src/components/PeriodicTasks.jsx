import { useState, useEffect } from 'react';

const CATEGORIES = ['dom','auto','ogrzewanie','elektryka','ogród','inne'];
const ICONS = ['🔧','🚗','🏠','🔥','💧','🌿','⚡','🧹','🔑','📋'];
const PRESETS = [
  { name:'Przegląd techniczny auta', icon:'🚗', interval_days:365, category:'auto' },
  { name:'Wymiana oleju', icon:'🚗', interval_days:180, category:'auto' },
  { name:'Przegląd kotła/pieca', icon:'🔥', interval_days:365, category:'ogrzewanie' },
  { name:'Wymiana filtra powietrza', icon:'🌿', interval_days:90, category:'dom' },
  { name:'Czyszczenie rynien', icon:'💧', interval_days:180, category:'dom' },
  { name:'Przegląd instalacji elektrycznej', icon:'⚡', interval_days:1825, category:'elektryka' },
  { name:'Ubezpieczenie domu OC', icon:'📋', interval_days:365, category:'dom' },
];

function daysDiff(d) {
  if (!d) return null;
  const now = new Date(); now.setHours(0,0,0,0);
  return Math.round((new Date(d) - now) / 86400000);
}

function StatusBadge({ nextDue }) {
  if (!nextDue) return <span style={{color:'var(--text2)',fontSize:'0.72rem'}}>Brak danych</span>;
  const d = daysDiff(nextDue);
  if (d < 0) return <span className="expiry-danger" style={{fontSize:'0.75rem'}}>⚠️ Zaległe {Math.abs(d)}d</span>;
  if (d === 0) return <span className="expiry-danger" style={{fontSize:'0.75rem'}}>⚠️ Dziś!</span>;
  if (d <= 7) return <span className="expiry-warn" style={{fontSize:'0.75rem'}}>Za {d} dni</span>;
  if (d <= 30) return <span className="expiry-warn" style={{fontSize:'0.75rem'}}>Za {d} dni</span>;
  return <span className="expiry-ok" style={{fontSize:'0.75rem'}}>Za {d} dni</span>;
}

function TaskForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || { name:'', description:'', category:'dom', icon:'🔧', interval_days:365, last_done:'', notes:'' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const [showPresets, setShowPresets] = useState(false);
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onCancel()}>
      <div className="modal">
        <div className="modal-title">{initial?.id?'Edytuj przegląd':'Nowy przegląd cykliczny'}</div>
        {!initial?.id && (
          <div style={{marginBottom:12}}>
            <button className="btn btn-ghost" style={{width:'100%',fontSize:'0.78rem'}} onClick={()=>setShowPresets(s=>!s)}>
              {showPresets?'▲':'▼'} Wybierz z szablonów
            </button>
            {showPresets && (
              <div style={{marginTop:8,display:'flex',flexDirection:'column',gap:6}}>
                {PRESETS.map((p,i)=>(
                  <button key={i} className="btn btn-ghost" style={{textAlign:'left',fontSize:'0.8rem'}}
                    onClick={()=>{ setForm(f=>({...f,...p,last_done:''})); setShowPresets(false); }}>
                    {p.icon} {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Nazwa *</label>
          <input className="form-input" value={form.name} onChange={e=>set('name',e.target.value)} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Ikona</label>
            <select className="form-input" value={form.icon} onChange={e=>set('icon',e.target.value)}>
              {ICONS.map(i=><option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Kategoria</label>
            <select className="form-input" value={form.category} onChange={e=>set('category',e.target.value)}>
              {CATEGORIES.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Interwał (dni)</label>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:6}}>
            {[[30,'1 mies.'],[90,'3 mies.'],[180,'6 mies.'],[365,'1 rok'],[730,'2 lata']].map(([d,l])=>(
              <button key={d} className={`btn ${form.interval_days==d?'btn-primary':'btn-ghost'}`} style={{fontSize:'0.72rem',padding:'4px 8px'}}
                onClick={()=>set('interval_days',d)}>{l}</button>
            ))}
          </div>
          <input className="form-input" type="number" min="1" value={form.interval_days} onChange={e=>set('interval_days',Number(e.target.value))} />
        </div>
        <div className="form-group">
          <label className="form-label">Ostatnio wykonano</label>
          <input className="form-input" type="date" value={form.last_done||''} onChange={e=>set('last_done',e.target.value)} />
        </div>
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

export default function PeriodicTasks() {
  const [tasks, setTasks] = useState([]);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState('all');

  const load = () => fetch('/api/periodic').then(r=>r.json()).then(setTasks);
  useEffect(()=>{ load(); },[]);

  const save = async (form) => {
    const method = form.id?'PUT':'POST';
    const url = form.id?`/api/periodic/${form.id}`:'/api/periodic';
    await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
    setEditing(null); setAdding(false); load();
  };

  const markDone = async (id) => {
    await fetch(`/api/periodic/${id}/done`,{method:'POST'});
    load();
  };

  const del = async (id) => {
    if(!confirm('Usunąć?')) return;
    await fetch(`/api/periodic/${id}`,{method:'DELETE'}); load();
  };

  const today = new Date().toISOString().split('T')[0];
  const dueCount = tasks.filter(t=>t.next_due&&t.next_due<=today).length;

  const filtered = tasks.filter(t => {
    if (filter==='due') return t.next_due && t.next_due <= today;
    if (filter==='soon') { const d=daysDiff(t.next_due); return d!==null && d>0 && d<=30; }
    return true;
  });

  return (
    <div>
      <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
        <div style={{flex:1,display:'flex',gap:6}}>
          {[['all','Wszystkie'],['due',`Zaległe${dueCount?` (${dueCount})`:'`'}`],['soon','Nadchodzące']].map(([k,l])=>(
            <button key={k} className={`btn ${filter===k?'btn-primary':'btn-ghost'}`} style={{fontSize:'0.72rem',padding:'5px 10px'}} onClick={()=>setFilter(k)}>{l}</button>
          ))}
        </div>
        <button className="btn btn-primary" style={{fontSize:'0.8rem'}} onClick={()=>setAdding(true)}>+ Dodaj</button>
      </div>

      {filtered.length===0 && (
        <div className="empty-state"><div className="emoji">🔄</div><p>Brak przeglądów — dodaj pierwszy!</p></div>
      )}

      {filtered.map(t => (
        <div key={t.id} className="card" style={{borderLeft:`3px solid ${t.next_due&&t.next_due<today?'var(--danger)':t.next_due&&daysDiff(t.next_due)<=30?'var(--warn)':'var(--ok)'}`}}>
          <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
            <div style={{fontSize:'1.8rem',flexShrink:0}}>{t.icon}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:600,fontSize:'0.9rem'}}>{t.name}</div>
              <div style={{fontSize:'0.72rem',color:'var(--text2)',marginTop:2}}>
                {t.category} · co {t.interval_days < 365 ? `${t.interval_days}d` : `${(t.interval_days/365).toFixed(1).replace('.0','')}r`}
              </div>
              {t.last_done && <div style={{fontSize:'0.72rem',color:'var(--text2)'}}>Ostatnio: {t.last_done}</div>}
              <div style={{marginTop:4}}><StatusBadge nextDue={t.next_due} /></div>
              {t.notes && <div style={{fontSize:'0.72rem',color:'var(--text2)',marginTop:4,fontStyle:'italic'}}>{t.notes}</div>}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:4,flexShrink:0}}>
              <button className="btn btn-ok" style={{fontSize:'0.7rem',padding:'5px 8px'}} onClick={()=>markDone(t.id)}>✓ Zrobione</button>
              <button className="btn btn-icon" onClick={()=>setEditing(t)}>✏️</button>
              <button className="btn btn-icon" onClick={()=>del(t.id)}>🗑️</button>
            </div>
          </div>
        </div>
      ))}

      {(adding||editing) && (
        <TaskForm initial={editing} onSave={save} onCancel={()=>{setEditing(null);setAdding(false);}} />
      )}
    </div>
  );
}
