import { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard.jsx';
import Tasks from './components/Tasks.jsx';
import PeriodicTasks from './components/PeriodicTasks.jsx';
import ProductList from './components/ProductList.jsx';
import AddProduct from './components/AddProduct.jsx';
import ShoppingList from './components/ShoppingList.jsx';
import Meters from './components/Meters.jsx';
import Appliances from './components/Appliances.jsx';
import Documents from './components/Documents.jsx';
import Contacts from './components/Contacts.jsx';

const MODULES = {
  dashboard: { label:'Dom',       icon:'🏠' },
  tasks:     { label:'Zadania',   icon:'✅' },
  periodic:  { label:'Przeglądy', icon:'🔄' },
  fridge:    { label:'Spiżarnia', icon:'🧊' },
  add:       { label:'Dodaj',     icon:'＋' },
  shopping:  { label:'Zakupy',    icon:'🛒' },
  meters:    { label:'Liczniki',  icon:'📊' },
  appliances:{ label:'Urządzenia',icon:'🔧' },
  documents: { label:'Dokumenty', icon:'📄' },
  contacts:  { label:'Kontakty',  icon:'📞' },
};

export default function App() {
  const [tab, setTab] = useState('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [products, setProducts] = useState([]);
  const [shopping, setShopping] = useState([]);

  const fetchAlerts = () => fetch('/api/alerts').then(r=>r.json()).then(setAlerts).catch(()=>{});
  const fetchProducts = () => fetch('/api/products').then(r=>r.json()).then(setProducts).catch(()=>{});
  const fetchShopping = () => fetch('/api/shopping').then(r=>r.json()).then(setShopping).catch(()=>{});

  useEffect(() => { fetchAlerts(); fetchProducts(); fetchShopping(); }, []);

  const navigate = (module) => { setTab(module); setMenuOpen(false); };

  const addToShopping = async (product) => {
    await fetch('/api/shopping',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({barcode:product.barcode,name:product.name,unit:product.unit,source:'fridge'})});
    fetchShopping();
  };

  const shoppingPending = shopping.filter(i=>!i.checked).length;
  const totalAlerts = alerts.length;
  const dangerAlerts = alerts.filter(a=>a.level==='danger').length;

  return (
    <div className="app">
      <header className="app-header">
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:'1.1rem'}}>{MODULES[tab]?.icon}</span>
          <h1>{MODULES[tab]?.label || 'Dom'}</h1>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {totalAlerts>0 && tab!=='dashboard' && (
            <span className="expiry-badge" onClick={()=>navigate('dashboard')} style={{cursor:'pointer'}}>
              {dangerAlerts>0?'🔴':'🟡'} {totalAlerts}
            </span>
          )}
          <button className="btn btn-icon" onClick={()=>setMenuOpen(true)} style={{fontSize:'1.2rem',padding:'4px 8px'}}>☰</button>
        </div>
      </header>

      <main className="app-main">
        {tab==='dashboard'  && <Dashboard onNavigate={navigate} />}
        {tab==='tasks'      && <Tasks />}
        {tab==='periodic'   && <PeriodicTasks />}
        {tab==='fridge'     && <ProductList products={products} onRefresh={fetchProducts} onAddToShopping={addToShopping} />}
        {tab==='add'        && <AddProduct onAdded={()=>{ fetchProducts(); fetchAlerts(); setTab('fridge'); }} />}
        {tab==='shopping'   && <ShoppingList items={shopping} onRefresh={fetchShopping} />}
        {tab==='meters'     && <Meters />}
        {tab==='appliances' && <Appliances />}
        {tab==='documents'  && <Documents />}
        {tab==='contacts'   && <Contacts />}
      </main>

      <nav className="bottom-nav">
        {[
          ['dashboard','🏠','Dom'],
          ['tasks','✅','Zadania'],
          ['fridge','🧊','Spiżarnia'],
          ['periodic','🔄','Przeglądy'],
        ].map(([key,icon,label])=>(
          <button key={key} className={tab===key?'active':''} onClick={()=>navigate(key)}>
            <span>{icon}</span>
            <span>{label}</span>
            {key==='dashboard' && totalAlerts>0 && <span className="nav-badge">{totalAlerts}</span>}
          </button>
        ))}
        <button className={['meters','appliances','documents','contacts','shopping','add'].includes(tab)?'active':''} onClick={()=>setMenuOpen(true)}>
          <span>☰</span><span>Więcej</span>
          {shoppingPending>0 && <span className="nav-badge">{shoppingPending}</span>}
        </button>
      </nav>

      {menuOpen && (
        <div className="modal-overlay" onClick={()=>setMenuOpen(false)}>
          <div className="modal">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <span style={{fontWeight:700,fontSize:'1rem'}}>Wszystkie moduły</span>
              <button className="btn btn-icon" onClick={()=>setMenuOpen(false)}>✕</button>
            </div>
            <div className="module-grid">
              {[
                ['shopping','🛒','Zakupy',shoppingPending],
                ['add','＋','Dodaj produkt',0],
                ['meters','📊','Liczniki',0],
                ['appliances','🔧','Urządzenia',0],
                ['documents','📄','Dokumenty',0],
                ['contacts','📞','Kontakty',0],
              ].map(([key,icon,label,badge])=>(
                <div key={key} className={`module-card ${tab===key?'active':''}`} onClick={()=>navigate(key)}>
                  <div style={{fontSize:'1.8rem',marginBottom:4}}>{icon}</div>
                  <div style={{fontWeight:700,fontSize:'0.8rem'}}>{label}</div>
                  {badge>0 && <span className="module-badge">{badge}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
