import { useState, useEffect } from 'react';

const ROLE_ICONS = { hydraulik:'🔧', elektryk:'⚡', gazownik:'🔥', malarz:'🖌️', murarz:'🧱', szklarz:'🪟', dekarz:'🏠', stróż:'🔑', lekarz:'🏥', pogotowie:'🚑', straż:'🚒', policja:'🚓', inne:'📞' };
const ROLES = Object.keys(ROLE_ICONS);

function ContactForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || { name:'', role:'inne', phone:'', email:'', notes:'', favourite:false });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onCancel()}>
      <div className="modal">
        <div className="modal-title">{initial?.id?'Edytuj kontakt':'Nowy kontakt'}</div>
        <div className="form-group">
          <label className="form-label">Imię / Nazwa *</label>
          <input className="form-input" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="np. Jan Kowalski" />
        </div>
        <div className="form-group">
          <label className="form-label">Rola / Specjalizacja</label>
          <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:6}}>
            {ROLES.map(r=>(
              <button key={r} className={`btn ${form.role===r?'btn-primary':'btn-ghost'}`} style={{fontSize:'0.7rem',padding:'3px 7px'}}
                onClick={()=>set('role',r)}>{ROLE_ICONS[r]} {r}</button>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Telefon</label>
          <input className="form-input" type="tel" value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="+48 000 000 000" />
        </div>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="form-input" type="email" value={form.email} onChange={e=>set('email',e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Notatki</label>
          <textarea className="form-input" rows={2} value={form.notes} onChange={e=>set('notes',e.target.value)} style={{resize:'vertical'}} />
        </div>
        <label style={{display:'flex',alignItems:'center',gap:8,marginBottom:14,cursor:'pointer'}}>
          <input type="checkbox" checked={!!form.favourite} onChange={e=>set('favourite',e.target.checked)}
            style={{width:18,height:18,accentColor:'var(--warn)'}} />
          <span style={{fontSize:'0.85rem'}}>⭐ Ulubiony (na górze listy)</span>
        </label>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-ghost" style={{flex:1}} onClick={onCancel}>Anuluj</button>
          <button className="btn btn-primary" style={{flex:1}} onClick={()=>onSave(form)} disabled={!form.name.trim()}>Zapisz</button>
        </div>
      </div>
    </div>
  );
}

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');

  const load = () => fetch('/api/contacts').then(r=>r.json()).then(setContacts);
  useEffect(()=>{ load(); },[]);

  const save = async (form) => {
    const method=form.id?'PUT':'POST';
    const url=form.id?`/api/contacts/${form.id}`:'/api/contacts';
    await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
    setEditing(null); setAdding(false); load();
  };

  const del = async (id) => {
    if(!confirm('Usunąć kontakt?')) return;
    await fetch(`/api/contacts/${id}`,{method:'DELETE'}); load();
  };

  const toggleFav = async (c) => {
    await fetch(`/api/contacts/${c.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...c,favourite:!c.favourite})});
    load();
  };

  const filtered = contacts.filter(c => {
    const q=search.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || c.role.toLowerCase().includes(q) || c.phone.includes(q);
  });

  const favs = filtered.filter(c=>c.favourite);
  const rest = filtered.filter(c=>!c.favourite);

  const ContactCard = ({c}) => (
    <div className="card">
      <div style={{display:'flex',gap:10,alignItems:'center'}}>
        <div style={{fontSize:'1.8rem',flexShrink:0}}>{ROLE_ICONS[c.role]||'📞'}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:'0.9rem',display:'flex',alignItems:'center',gap:4}}>
            {c.name}
            {c.favourite&&<span style={{fontSize:'0.8rem'}}>⭐</span>}
          </div>
          {c.role && <div style={{fontSize:'0.72rem',color:'var(--text2)'}}>{c.role}</div>}
          {c.phone && (
            <a href={`tel:${c.phone}`} style={{fontSize:'0.85rem',color:'var(--accent)',fontWeight:600,display:'block',marginTop:2,textDecoration:'none'}}>
              📞 {c.phone}
            </a>
          )}
          {c.email && <div style={{fontSize:'0.72rem',color:'var(--text2)'}}>{c.email}</div>}
          {c.notes && <div style={{fontSize:'0.72rem',color:'var(--text2)',marginTop:2,fontStyle:'italic'}}>{c.notes}</div>}
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:4,flexShrink:0}}>
          <button className="btn btn-icon" onClick={()=>toggleFav(c)} title="Ulubiony">{c.favourite?'★':'☆'}</button>
          <button className="btn btn-icon" onClick={()=>setEditing(c)}>✏️</button>
          <button className="btn btn-icon" onClick={()=>del(c.id)}>🗑️</button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{display:'flex',gap:8,marginBottom:12,alignItems:'center'}}>
        <input className="search-input" style={{flex:1,marginBottom:0}} placeholder="🔍 Szukaj kontaktu…" value={search} onChange={e=>setSearch(e.target.value)} />
        <button className="btn btn-primary" onClick={()=>setAdding(true)}>+ Dodaj</button>
      </div>

      {filtered.length===0 && (
        <div className="empty-state"><div className="emoji">📞</div><p>Brak kontaktów — dodaj hydraulika, elektryka, lekarza!</p></div>
      )}

      {favs.length>0 && <>
        <div className="section-title">⭐ Ulubione</div>
        {favs.map(c=><ContactCard key={c.id} c={c} />)}
      </>}

      {rest.length>0 && <>
        {favs.length>0 && <div className="section-title">Pozostałe</div>}
        {rest.map(c=><ContactCard key={c.id} c={c} />)}
      </>}

      {(adding||editing) && (
        <ContactForm initial={editing} onSave={save} onCancel={()=>{setEditing(null);setAdding(false);}} />
      )}
    </div>
  );
}
