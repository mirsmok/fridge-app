import { useState, useEffect } from 'react';

const METER_PRESETS = [
  { name:'Prąd', unit:'kWh', icon:'⚡' },
  { name:'Gaz', unit:'m³', icon:'🔥' },
  { name:'Woda zimna', unit:'m³', icon:'💧' },
  { name:'Woda ciepła', unit:'m³', icon:'🚿' },
  { name:'Ciepło', unit:'GJ', icon:'🌡️' },
];

function MiniChart({ readings }) {
  if (readings.length < 2) return null;
  const sorted = [...readings].sort((a,b)=>a.reading_date.localeCompare(b.reading_date));
  const diffs = sorted.slice(1).map((r,i)=>({ date:r.reading_date, val:r.value-sorted[i].value }));
  if (!diffs.length) return null;
  const max = Math.max(...diffs.map(d=>d.val), 0.01);
  const W=240, H=50;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H+20}`} style={{marginTop:8,display:'block'}}>
      {diffs.slice(-8).map((d,i,arr)=>{
        const bw=(W-8)/arr.length-2;
        const bh=Math.max(2,(d.val/max)*(H-4));
        const x=4+i*(bw+2), y=H-bh;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={bh} rx={2} fill="var(--accent)" opacity={0.7} />
            {i===arr.length-1&&<text x={x+bw/2} y={H+14} textAnchor="middle" fill="var(--text2)" fontSize={9}>{d.val.toFixed(1)}</text>}
          </g>
        );
      })}
    </svg>
  );
}

function AddReadingModal({ meter, onSave, onClose }) {
  const [value, setValue] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const lastVal = meter.last_reading?.value;
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-title">{meter.icon} Dodaj odczyt — {meter.name}</div>
        {lastVal && <div style={{fontSize:'0.78rem',color:'var(--text2)',marginBottom:12}}>Poprzedni odczyt: <strong>{lastVal} {meter.unit}</strong></div>}
        <div className="form-group">
          <label className="form-label">Stan licznika ({meter.unit}) *</label>
          <input className="form-input" type="number" step="0.001" value={value} onChange={e=>setValue(e.target.value)}
            placeholder={lastVal ? `poprzednio: ${lastVal}` : ''} autoFocus />
          {lastVal && value && Number(value)>lastVal && (
            <div style={{fontSize:'0.78rem',color:'var(--ok)',marginTop:4}}>Zużycie: {(Number(value)-lastVal).toFixed(3)} {meter.unit}</div>
          )}
        </div>
        <div className="form-group">
          <label className="form-label">Data odczytu</label>
          <input className="form-input" type="date" value={date} onChange={e=>setDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Notatka</label>
          <input className="form-input" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="opcjonalnie" />
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-ghost" style={{flex:1}} onClick={onClose}>Anuluj</button>
          <button className="btn btn-primary" style={{flex:1}} onClick={()=>onSave({value:Number(value),reading_date:date,notes})} disabled={!value}>Zapisz</button>
        </div>
      </div>
    </div>
  );
}

function AddMeterModal({ onSave, onClose }) {
  const [form, setForm] = useState({ name:'', unit:'kWh', icon:'⚡', location:'' });
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-title">Nowy licznik</div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>
          {METER_PRESETS.map(p=>(
            <button key={p.name} className="btn btn-ghost" style={{fontSize:'0.75rem'}} onClick={()=>setForm(f=>({...f,...p}))}>
              {p.icon} {p.name}
            </button>
          ))}
        </div>
        <div className="form-group">
          <label className="form-label">Nazwa *</label>
          <input className="form-input" value={form.name} onChange={e=>set('name',e.target.value)} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Jednostka</label>
            <input className="form-input" value={form.unit} onChange={e=>set('unit',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Ikona</label>
            <input className="form-input" value={form.icon} onChange={e=>set('icon',e.target.value)} style={{fontSize:'1.2rem'}} />
          </div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-ghost" style={{flex:1}} onClick={onClose}>Anuluj</button>
          <button className="btn btn-primary" style={{flex:1}} onClick={()=>onSave(form)} disabled={!form.name.trim()}>Dodaj</button>
        </div>
      </div>
    </div>
  );
}

export default function Meters() {
  const [meters, setMeters] = useState([]);
  const [addingReading, setAddingReading] = useState(null);
  const [addingMeter, setAddingMeter] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const load = () => fetch('/api/meters').then(r=>r.json()).then(setMeters);
  useEffect(()=>{ load(); },[]);

  const saveMeter = async (form) => {
    await fetch('/api/meters',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
    setAddingMeter(false); load();
  };

  const saveReading = async (form) => {
    await fetch(`/api/meters/${addingReading.id}/readings`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
    setAddingReading(null); load();
  };

  const delMeter = async (id) => {
    if(!confirm('Usunąć licznik i wszystkie odczyty?')) return;
    await fetch(`/api/meters/${id}`,{method:'DELETE'}); load();
  };

  const delReading = async (rid) => {
    await fetch(`/api/meters/readings/${rid}`,{method:'DELETE'}); load();
  };

  return (
    <div>
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
        <button className="btn btn-primary" onClick={()=>setAddingMeter(true)}>+ Licznik</button>
      </div>

      {meters.length===0 && (
        <div className="empty-state"><div className="emoji">📊</div><p>Brak liczników — dodaj prąd, gaz lub wodę!</p></div>
      )}

      {meters.map(m => {
        const sorted=[...m.readings].sort((a,b)=>a.reading_date.localeCompare(b.reading_date));
        const isExpanded=expanded===m.id;
        const last=m.last_reading;
        const prev=sorted.length>=2?sorted[sorted.length-2]:null;
        const lastUsage=last&&prev?last.value-prev.value:null;
        return (
          <div key={m.id} className="card">
            <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
              <div style={{fontSize:'2rem',flexShrink:0}}>{m.icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:'0.95rem'}}>{m.name}</div>
                <div style={{fontSize:'0.78rem',color:'var(--text2)'}}>
                  {last ? <><strong style={{color:'var(--text)'}}>{last.value} {m.unit}</strong> · {last.reading_date}</> : 'Brak odczytów'}
                </div>
                {lastUsage!==null && <div style={{fontSize:'0.72rem',color:'var(--accent)',marginTop:2}}>Zużycie: {lastUsage.toFixed(3)} {m.unit}</div>}
                {isExpanded && m.readings.length > 1 && <MiniChart readings={m.readings} />}
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:4,flexShrink:0}}>
                <button className="btn btn-primary" style={{fontSize:'0.72rem',padding:'5px 8px'}} onClick={()=>setAddingReading(m)}>+ Odczyt</button>
                <button className="btn btn-ghost" style={{fontSize:'0.72rem',padding:'4px 8px'}} onClick={()=>setExpanded(isExpanded?null:m.id)}>
                  {isExpanded?'▲ Zwiń':'▼ Historia'}
                </button>
                <button className="btn btn-icon" onClick={()=>delMeter(m.id)}>🗑️</button>
              </div>
            </div>
            {isExpanded && (
              <div style={{marginTop:12,borderTop:'1px solid var(--border)',paddingTop:10}}>
                {sorted.slice().reverse().map((r,i)=>(
                  <div key={r.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 0',borderBottom:'1px solid var(--border)',fontSize:'0.8rem'}}>
                    <span style={{color:'var(--text2)'}}>{r.reading_date}</span>
                    <span style={{fontWeight:600}}>{r.value} {m.unit}</span>
                    {i>0&&<span style={{color:'var(--accent)',fontSize:'0.72rem'}}>+{(r.value-sorted[sorted.length-2-i+1]?.value||0).toFixed(2)}</span>}
                    <button onClick={()=>delReading(r.id)} style={{background:'none',border:'none',color:'var(--text2)',cursor:'pointer',padding:'0 4px'}}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {addingMeter && <AddMeterModal onSave={saveMeter} onClose={()=>setAddingMeter(false)} />}
      {addingReading && <AddReadingModal meter={addingReading} onSave={saveReading} onClose={()=>setAddingReading(null)} />}
    </div>
  );
}
