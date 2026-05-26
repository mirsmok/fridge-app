import { useState, useEffect } from 'react';

const MODULE_LABELS = { tasks:'Zadania', periodic:'Przeglądy', product:'Spiżarnia', document:'Dokumenty', appliance:'Urządzenia', fridge:'Spiżarnia' };
const LEVEL_ICON = { danger:'🔴', warn:'🟡', info:'🔵' };

function daysDiff(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  const t = new Date(); t.setHours(0,0,0,0);
  return Math.round((d - t) / 86400000);
}

function DateLabel({ date }) {
  const d = daysDiff(date);
  if (d === null) return null;
  if (d < 0) return <span className="expiry-danger"> ({Math.abs(d)}d temu)</span>;
  if (d === 0) return <span className="expiry-danger"> (dziś)</span>;
  if (d <= 7) return <span className="expiry-warn"> (za {d}d)</span>;
  return <span className="expiry-ok"> (za {d}d)</span>;
}

export default function Dashboard({ onNavigate }) {
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [alertsR, tasksR, productsR, periodicR, shoppingR] = await Promise.all([
      fetch('/api/alerts').then(r=>r.json()),
      fetch('/api/tasks').then(r=>r.json()),
      fetch('/api/products').then(r=>r.json()),
      fetch('/api/periodic').then(r=>r.json()),
      fetch('/api/shopping').then(r=>r.json()),
    ]);
    setAlerts(alertsR);
    const today = new Date().toISOString().split('T')[0];
    setStats({
      tasksOpen: tasksR.filter(t=>!t.completed).length,
      tasksToday: tasksR.filter(t=>!t.completed && t.due_date===today).length,
      products: productsR.length,
      periodicDue: periodicR.filter(t=>t.next_due && t.next_due<=today).length,
      shoppingPending: shoppingR.filter(i=>!i.checked).length,
    });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const danger = alerts.filter(a=>a.level==='danger');
  const warn = alerts.filter(a=>a.level==='warn');

  const modules = [
    { key:'tasks', icon:'✅', label:'Zadania', badge: stats.tasksOpen, sub: stats.tasksToday ? `${stats.tasksToday} na dziś` : `${stats.tasksOpen||0} otwartych` },
    { key:'periodic', icon:'🔄', label:'Przeglądy', badge: stats.periodicDue, sub: stats.periodicDue ? `${stats.periodicDue} zaległych` : 'wszystko OK' },
    { key:'fridge', icon:'🧊', label:'Spiżarnia', badge: 0, sub: `${stats.products||0} produktów` },
    { key:'shopping', icon:'🛒', label:'Zakupy', badge: stats.shoppingPending, sub: `${stats.shoppingPending||0} do kupienia` },
    { key:'meters', icon:'📊', label:'Liczniki', badge: 0, sub: 'odczyty' },
    { key:'appliances', icon:'🔧', label:'Urządzenia', badge: 0, sub: 'sprzęt domowy' },
    { key:'documents', icon:'📄', label:'Dokumenty', badge: 0, sub: 'ważne dokumenty' },
    { key:'contacts', icon:'📞', label:'Kontakty', badge: 0, sub: 'serwis & pomoc' },
  ];

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
        <div>
          <div style={{fontSize:'0.72rem',color:'var(--text2)'}}>
            {new Date().toLocaleDateString('pl-PL',{weekday:'long',day:'numeric',month:'long'})}
          </div>
        </div>
        <button className="btn btn-ghost" style={{fontSize:'0.75rem'}} onClick={load}>↻ Odśwież</button>
      </div>

      {loading && <div style={{color:'var(--text2)',fontSize:'0.85rem',marginBottom:16}}>Ładowanie…</div>}

      {!loading && alerts.length > 0 && (
        <div style={{marginBottom:16}}>
          <div className="section-title">⚠️ Alerty ({alerts.length})</div>
          {danger.map((a,i) => (
            <div key={i} className="alert-item danger" onClick={()=>onNavigate(a.module)}>
              <span>{LEVEL_ICON[a.level]}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:'0.85rem',fontWeight:600}}>{a.msg}</div>
                <div style={{fontSize:'0.72rem',color:'var(--text2)'}}>{MODULE_LABELS[a.type]}<DateLabel date={a.date}/></div>
              </div>
              <span style={{fontSize:'0.75rem',color:'var(--text2)'}}>›</span>
            </div>
          ))}
          {warn.map((a,i) => (
            <div key={i} className="alert-item warn" onClick={()=>onNavigate(a.module)}>
              <span>{LEVEL_ICON[a.level]}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:'0.85rem',fontWeight:600}}>{a.msg}</div>
                <div style={{fontSize:'0.72rem',color:'var(--text2)'}}>{MODULE_LABELS[a.type]}<DateLabel date={a.date}/></div>
              </div>
              <span style={{fontSize:'0.75rem',color:'var(--text2)'}}>›</span>
            </div>
          ))}
        </div>
      )}

      {!loading && alerts.length === 0 && (
        <div style={{background:'rgba(76,175,130,0.1)',border:'1px solid var(--ok)',borderRadius:'var(--radius)',padding:'10px 14px',marginBottom:16,fontSize:'0.85rem',color:'var(--ok)'}}>
          ✅ Wszystko w porządku — brak alertów
        </div>
      )}

      <div className="section-title">Moduły</div>
      <div className="module-grid">
        {modules.map(m => (
          <div key={m.key} className="module-card" onClick={()=>onNavigate(m.key)}>
            <div style={{fontSize:'1.8rem',marginBottom:4}}>{m.icon}</div>
            <div style={{fontWeight:700,fontSize:'0.85rem'}}>{m.label}</div>
            <div style={{fontSize:'0.7rem',color:'var(--text2)',marginTop:2}}>{m.sub}</div>
            {m.badge > 0 && <span className="module-badge">{m.badge}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
