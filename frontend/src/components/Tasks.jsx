import { useState, useEffect } from 'react';

const PRIORITIES = ['low','normal','high','urgent'];
const PRIORITY_LABELS = { low:'Niska', normal:'Normalna', high:'Wysoka', urgent:'Pilne' };
const PRIORITY_COLOR = { low:'var(--text2)', normal:'var(--accent)', high:'var(--warn)', urgent:'var(--danger)' };
const CATEGORIES = ['dom','zakupy','auto','praca','rodzina','inne'];

function daysDiff(d) {
  if (!d) return null;
  const now = new Date(); now.setHours(0,0,0,0);
  return Math.round((new Date(d) - now) / 86400000);
}

function DueLabel({ date, completed }) {
  if (!date || completed) return null;
  const d = daysDiff(date);
  if (d < 0) return <span className="expiry-danger"> · {Math.abs(d)}d temu</span>;
  if (d === 0) return <span className="expiry-danger"> · dziś</span>;
  if (d <= 3) return <span className="expiry-warn"> · za {d}d</span>;
  return <span style={{color:'var(--text2)'}}> · {date}</span>;
}

function TaskForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || { title:'', description:'', category:'inne', priority:'normal', due_date:'' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onCancel()}>
      <div className="modal">
        <div className="modal-title">{initial?.id ? 'Edytuj zadanie' : 'Nowe zadanie'}</div>
        <div className="form-group">
          <label className="form-label">Tytuł *</label>
          <input className="form-input" value={form.title} onChange={e=>set('title',e.target.value)} placeholder="Co do zrobienia?" />
        </div>
        <div className="form-group">
          <label className="form-label">Opis</label>
          <textarea className="form-input" rows={2} value={form.description} onChange={e=>set('description',e.target.value)} style={{resize:'vertical'}} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Priorytet</label>
            <select className="form-input" value={form.priority} onChange={e=>set('priority',e.target.value)}>
              {PRIORITIES.map(p=><option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
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
          <label className="form-label">Termin</label>
          <input className="form-input" type="date" value={form.due_date} onChange={e=>set('due_date',e.target.value)} />
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-ghost" style={{flex:1}} onClick={onCancel}>Anuluj</button>
          <button className="btn btn-primary" style={{flex:1}} onClick={()=>onSave(form)} disabled={!form.title.trim()}>Zapisz</button>
        </div>
      </div>
    </div>
  );
}

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState('open');
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);

  const load = () => fetch('/api/tasks').then(r=>r.json()).then(setTasks);
  useEffect(()=>{ load(); },[]);

  const save = async (form) => {
    const method = form.id ? 'PUT' : 'POST';
    const url = form.id ? `/api/tasks/${form.id}` : '/api/tasks';
    await fetch(url, { method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) });
    setEditing(null); setAdding(false); load();
  };

  const toggle = async (t) => {
    await fetch(`/api/tasks/${t.id}`, {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({...t, completed:!t.completed})
    });
    load();
  };

  const del = async (id) => {
    if(!confirm('Usunąć zadanie?')) return;
    await fetch(`/api/tasks/${id}`,{method:'DELETE'}); load();
  };

  const today = new Date().toISOString().split('T')[0];
  const filtered = tasks.filter(t => {
    if (filter==='open') return !t.completed;
    if (filter==='today') return !t.completed && t.due_date===today;
    if (filter==='overdue') return !t.completed && t.due_date && t.due_date<today;
    if (filter==='done') return t.completed;
    return true;
  });

  const overdueCount = tasks.filter(t=>!t.completed&&t.due_date&&t.due_date<today).length;
  const todayCount = tasks.filter(t=>!t.completed&&t.due_date===today).length;

  return (
    <div>
      <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
        <div style={{flex:1,display:'flex',gap:6,flexWrap:'wrap'}}>
          {[['open','Otwarte'],['today',`Dziś${todayCount?` (${todayCount})`:''}`,],['overdue',`Zaległe${overdueCount?` (${overdueCount})`:''}`,],['done','Ukończone']].map(([k,l])=>(
            <button key={k} className={`btn ${filter===k?'btn-primary':'btn-ghost'}`} style={{fontSize:'0.72rem',padding:'5px 10px'}} onClick={()=>setFilter(k)}>{l}</button>
          ))}
        </div>
        <button className="btn btn-primary" style={{fontSize:'0.8rem'}} onClick={()=>setAdding(true)}>+ Dodaj</button>
      </div>

      {filtered.length===0 && (
        <div className="empty-state"><div className="emoji">✅</div><p>{filter==='done'?'Brak ukończonych zadań':'Brak zadań w tej kategorii'}</p></div>
      )}

      {filtered.map(t => {
        const d = daysDiff(t.due_date);
        const isOverdue = !t.completed && t.due_date && t.due_date < today;
        return (
          <div key={t.id} className="card" style={{opacity:t.completed?0.55:1,borderLeft:`3px solid ${t.completed?'var(--ok)':PRIORITY_COLOR[t.priority]}`}}>
            <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
              <input type="checkbox" checked={!!t.completed} onChange={()=>toggle(t)}
                style={{width:20,height:20,marginTop:2,accentColor:'var(--ok)',flexShrink:0,cursor:'pointer'}} />
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:'0.9rem',textDecoration:t.completed?'line-through':'none'}}>{t.title}</div>
                {t.description && <div style={{fontSize:'0.78rem',color:'var(--text2)',marginTop:2}}>{t.description}</div>}
                <div style={{fontSize:'0.72rem',color:'var(--text2)',marginTop:4}}>
                  <span style={{color:PRIORITY_COLOR[t.priority],fontWeight:600}}>{PRIORITY_LABELS[t.priority]}</span>
                  {' · '}{t.category}
                  <DueLabel date={t.due_date} completed={t.completed} />
                </div>
              </div>
              <div style={{display:'flex',gap:4,flexShrink:0}}>
                {!t.completed && <button className="btn btn-icon" onClick={()=>setEditing(t)}>✏️</button>}
                <button className="btn btn-icon" onClick={()=>del(t.id)}>🗑️</button>
              </div>
            </div>
          </div>
        );
      })}

      {(adding||editing) && (
        <TaskForm
          initial={editing}
          onSave={save}
          onCancel={()=>{setEditing(null);setAdding(false);}}
        />
      )}
    </div>
  );
}
