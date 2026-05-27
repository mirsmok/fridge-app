const express = require('express');
const cors = require('cors');
const https = require('https');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = 3001;
const db = new Database(path.join(__dirname, 'fridge.db'));

app.use(cors());
app.use(express.json());

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barcode TEXT, name TEXT NOT NULL, category TEXT DEFAULT '',
    image_url TEXT DEFAULT '', quantity REAL DEFAULT 1, unit TEXT DEFAULT 'szt',
    expiry_date TEXT, added_date TEXT DEFAULT (date('now')),
    location TEXT DEFAULT 'lodówka', notes TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS shopping_list (
    id INTEGER PRIMARY KEY AUTOINCREMENT, barcode TEXT DEFAULT '', name TEXT NOT NULL,
    quantity REAL DEFAULT 1, unit TEXT DEFAULT 'szt',
    added_date TEXT DEFAULT (date('now')), checked INTEGER DEFAULT 0, source TEXT DEFAULT 'manual'
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL, description TEXT DEFAULT '',
    category TEXT DEFAULT 'inne', priority TEXT DEFAULT 'normal',
    due_date TEXT, completed INTEGER DEFAULT 0,
    completed_date TEXT, created_date TEXT DEFAULT (date('now'))
  );
  CREATE TABLE IF NOT EXISTS periodic_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, description TEXT DEFAULT '',
    category TEXT DEFAULT 'dom', icon TEXT DEFAULT '🔧',
    interval_days INTEGER DEFAULT 365,
    last_done TEXT, next_due TEXT, notes TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS meters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, unit TEXT DEFAULT 'kWh',
    icon TEXT DEFAULT '⚡', location TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS meter_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meter_id INTEGER NOT NULL, value REAL NOT NULL,
    reading_date TEXT DEFAULT (date('now')), notes TEXT DEFAULT '',
    FOREIGN KEY (meter_id) REFERENCES meters(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS appliances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, category TEXT DEFAULT 'inne',
    brand TEXT DEFAULT '', model TEXT DEFAULT '',
    purchase_date TEXT, warranty_months INTEGER,
    last_service TEXT, service_interval_months INTEGER,
    notes TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, category TEXT DEFAULT 'inne',
    issue_date TEXT, expiry_date TEXT,
    reminder_days INTEGER DEFAULT 30, notes TEXT DEFAULT '',
    created_date TEXT DEFAULT (date('now'))
  );
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, role TEXT DEFAULT '',
    phone TEXT DEFAULT '', email TEXT DEFAULT '',
    notes TEXT DEFAULT '', favourite INTEGER DEFAULT 0
  );
`);

function calcNextDue(lastDone, intervalDays) {
  if (!lastDone) return null;
  const d = new Date(lastDone);
  d.setDate(d.getDate() + Number(intervalDays));
  return d.toISOString().split('T')[0];
}

// ── products ──────────────────────────────────────────────────────────────────
app.get('/api/products', (_, res) => res.json(db.prepare(`
  SELECT * FROM products ORDER BY
  CASE WHEN expiry_date IS NULL OR expiry_date='' THEN 1 ELSE 0 END,
  expiry_date ASC, name ASC`).all()));
app.post('/api/products', (req, res) => {
  const { barcode,name,category,image_url,quantity,unit,expiry_date,location,notes } = req.body;
  const r = db.prepare(`INSERT INTO products (barcode,name,category,image_url,quantity,unit,expiry_date,location,notes) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(barcode||'',name,category||'',image_url||'',quantity??1,unit||'szt',expiry_date||null,location||'lodówka',notes||'');
  res.json(db.prepare('SELECT * FROM products WHERE id=?').get(r.lastInsertRowid));
});
app.put('/api/products/:id', (req, res) => {
  const { name,category,quantity,unit,expiry_date,location,notes } = req.body;
  db.prepare(`UPDATE products SET name=?,category=?,quantity=?,unit=?,expiry_date=?,location=?,notes=? WHERE id=?`)
    .run(name,category||'',quantity,unit||'szt',expiry_date||null,location||'lodówka',notes||'',req.params.id);
  res.json(db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id));
});
app.delete('/api/products/:id', (req, res) => { db.prepare('DELETE FROM products WHERE id=?').run(req.params.id); res.json({success:true}); });

// ── barcode ───────────────────────────────────────────────────────────────────
const barcodeCache = new Map();

function fetchBarcode(code) {
  return new Promise((resolve) => {
    const url = `https://world.openfoodfacts.org/api/v2/product/${code}?fields=product_name,product_name_pl,categories_tags,image_front_url,quantity`;
    const req = https.get(url, { timeout: 9000 }, (resp) => {
      let data = '';
      resp.on('data', c => data += c);
      resp.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.status === 1) {
            const p = json.product;
            const name = p.product_name_pl || p.product_name || '';
            const cats = p.categories_tags || [];
            const category = cats.find(c => c.startsWith('pl:'))?.replace('pl:', '')
              || cats[0]?.replace(/^[a-z]{2}:/, '') || '';
            resolve({ found: true, name, category, image_url: p.image_front_url || '', quantity_hint: p.quantity || '' });
          } else {
            resolve({ found: false });
          }
        } catch { resolve({ found: false }); }
      });
    });
    req.on('error', () => resolve({ found: false }));
    req.on('timeout', () => { req.destroy(); resolve({ found: false }); });
  });
}

app.get('/api/barcode/:code', async (req, res) => {
  const code = req.params.code;

  if (barcodeCache.has(code)) {
    return res.json(barcodeCache.get(code));
  }

  let result = await fetchBarcode(code);

  // retry raz jeśli nie znaleziono — cold connection fix
  if (!result.found) {
    await new Promise(r => setTimeout(r, 500));
    result = await fetchBarcode(code);
  }

  if (result.found) barcodeCache.set(code, result);
  res.json(result);
});

// ── shopping ──────────────────────────────────────────────────────────────────
app.get('/api/shopping', (_,res) => res.json(db.prepare('SELECT * FROM shopping_list ORDER BY checked ASC, added_date DESC').all()));
app.post('/api/shopping', (req,res) => {
  const {barcode,name,quantity,unit,source}=req.body;
  const r=db.prepare(`INSERT INTO shopping_list (barcode,name,quantity,unit,source) VALUES (?,?,?,?,?)`).run(barcode||'',name,quantity??1,unit||'szt',source||'manual');
  res.json(db.prepare('SELECT * FROM shopping_list WHERE id=?').get(r.lastInsertRowid));
});
app.put('/api/shopping/:id', (req,res) => {
  db.prepare('UPDATE shopping_list SET checked=?,quantity=? WHERE id=?').run(req.body.checked?1:0,req.body.quantity??1,req.params.id);
  res.json(db.prepare('SELECT * FROM shopping_list WHERE id=?').get(req.params.id));
});
app.delete('/api/shopping/:id', (req,res) => { db.prepare('DELETE FROM shopping_list WHERE id=?').run(req.params.id); res.json({success:true}); });
app.delete('/api/shopping', (_,res) => { db.prepare('DELETE FROM shopping_list WHERE checked=1').run(); res.json({success:true}); });

// ── tasks ─────────────────────────────────────────────────────────────────────
app.get('/api/tasks', (_,res) => res.json(db.prepare(`
  SELECT * FROM tasks ORDER BY completed ASC,
  CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
  due_date ASC, created_date DESC`).all()));
app.post('/api/tasks', (req,res) => {
  const {title,description,category,priority,due_date}=req.body;
  const r=db.prepare(`INSERT INTO tasks (title,description,category,priority,due_date) VALUES (?,?,?,?,?)`)
    .run(title,description||'',category||'inne',priority||'normal',due_date||null);
  res.json(db.prepare('SELECT * FROM tasks WHERE id=?').get(r.lastInsertRowid));
});
app.put('/api/tasks/:id', (req,res) => {
  const {title,description,category,priority,due_date,completed}=req.body;
  const completed_date=completed?new Date().toISOString().split('T')[0]:null;
  db.prepare(`UPDATE tasks SET title=?,description=?,category=?,priority=?,due_date=?,completed=?,completed_date=? WHERE id=?`)
    .run(title,description||'',category||'inne',priority||'normal',due_date||null,completed?1:0,completed_date,req.params.id);
  res.json(db.prepare('SELECT * FROM tasks WHERE id=?').get(req.params.id));
});
app.delete('/api/tasks/:id', (req,res) => { db.prepare('DELETE FROM tasks WHERE id=?').run(req.params.id); res.json({success:true}); });

// ── periodic tasks ────────────────────────────────────────────────────────────
app.get('/api/periodic', (_,res) => res.json(db.prepare('SELECT * FROM periodic_tasks ORDER BY next_due ASC, name ASC').all()));
app.post('/api/periodic', (req,res) => {
  const {name,description,category,icon,interval_days,last_done,notes}=req.body;
  const next_due=calcNextDue(last_done,interval_days||365);
  const r=db.prepare(`INSERT INTO periodic_tasks (name,description,category,icon,interval_days,last_done,next_due,notes) VALUES (?,?,?,?,?,?,?,?)`)
    .run(name,description||'',category||'dom',icon||'🔧',interval_days||365,last_done||null,next_due,notes||'');
  res.json(db.prepare('SELECT * FROM periodic_tasks WHERE id=?').get(r.lastInsertRowid));
});
app.put('/api/periodic/:id', (req,res) => {
  const {name,description,category,icon,interval_days,last_done,notes}=req.body;
  const next_due=calcNextDue(last_done,interval_days||365);
  db.prepare(`UPDATE periodic_tasks SET name=?,description=?,category=?,icon=?,interval_days=?,last_done=?,next_due=?,notes=? WHERE id=?`)
    .run(name,description||'',category||'dom',icon||'🔧',interval_days||365,last_done||null,next_due,notes||'',req.params.id);
  res.json(db.prepare('SELECT * FROM periodic_tasks WHERE id=?').get(req.params.id));
});
app.post('/api/periodic/:id/done', (req,res) => {
  const task=db.prepare('SELECT * FROM periodic_tasks WHERE id=?').get(req.params.id);
  if(!task) return res.status(404).json({error:'not found'});
  const today=new Date().toISOString().split('T')[0];
  const next_due=calcNextDue(today,task.interval_days);
  db.prepare('UPDATE periodic_tasks SET last_done=?,next_due=? WHERE id=?').run(today,next_due,req.params.id);
  res.json(db.prepare('SELECT * FROM periodic_tasks WHERE id=?').get(req.params.id));
});
app.delete('/api/periodic/:id', (req,res) => { db.prepare('DELETE FROM periodic_tasks WHERE id=?').run(req.params.id); res.json({success:true}); });

// ── meters ────────────────────────────────────────────────────────────────────
app.get('/api/meters', (_,res) => {
  const meters=db.prepare('SELECT * FROM meters ORDER BY name').all();
  res.json(meters.map(m => ({
    ...m,
    last_reading: db.prepare('SELECT * FROM meter_readings WHERE meter_id=? ORDER BY reading_date DESC LIMIT 1').get(m.id)||null,
    readings: db.prepare('SELECT * FROM meter_readings WHERE meter_id=? ORDER BY reading_date DESC LIMIT 24').all(m.id)
  })));
});
app.post('/api/meters', (req,res) => {
  const {name,unit,icon,location}=req.body;
  const r=db.prepare(`INSERT INTO meters (name,unit,icon,location) VALUES (?,?,?,?)`).run(name,unit||'kWh',icon||'⚡',location||'');
  res.json(db.prepare('SELECT * FROM meters WHERE id=?').get(r.lastInsertRowid));
});
app.delete('/api/meters/:id', (req,res) => { db.prepare('DELETE FROM meters WHERE id=?').run(req.params.id); res.json({success:true}); });
app.post('/api/meters/:id/readings', (req,res) => {
  const {value,reading_date,notes}=req.body;
  const r=db.prepare(`INSERT INTO meter_readings (meter_id,value,reading_date,notes) VALUES (?,?,?,?)`)
    .run(req.params.id,value,reading_date||new Date().toISOString().split('T')[0],notes||'');
  res.json(db.prepare('SELECT * FROM meter_readings WHERE id=?').get(r.lastInsertRowid));
});
app.delete('/api/meters/readings/:id', (req,res) => { db.prepare('DELETE FROM meter_readings WHERE id=?').run(req.params.id); res.json({success:true}); });

// ── appliances ────────────────────────────────────────────────────────────────
app.get('/api/appliances', (_,res) => res.json(db.prepare('SELECT * FROM appliances ORDER BY name').all()));
app.post('/api/appliances', (req,res) => {
  const {name,category,brand,model,purchase_date,warranty_months,last_service,service_interval_months,notes}=req.body;
  const r=db.prepare(`INSERT INTO appliances (name,category,brand,model,purchase_date,warranty_months,last_service,service_interval_months,notes) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(name,category||'inne',brand||'',model||'',purchase_date||null,warranty_months||null,last_service||null,service_interval_months||null,notes||'');
  res.json(db.prepare('SELECT * FROM appliances WHERE id=?').get(r.lastInsertRowid));
});
app.put('/api/appliances/:id', (req,res) => {
  const {name,category,brand,model,purchase_date,warranty_months,last_service,service_interval_months,notes}=req.body;
  db.prepare(`UPDATE appliances SET name=?,category=?,brand=?,model=?,purchase_date=?,warranty_months=?,last_service=?,service_interval_months=?,notes=? WHERE id=?`)
    .run(name,category||'inne',brand||'',model||'',purchase_date||null,warranty_months||null,last_service||null,service_interval_months||null,notes||'',req.params.id);
  res.json(db.prepare('SELECT * FROM appliances WHERE id=?').get(req.params.id));
});
app.delete('/api/appliances/:id', (req,res) => { db.prepare('DELETE FROM appliances WHERE id=?').run(req.params.id); res.json({success:true}); });

// ── documents ─────────────────────────────────────────────────────────────────
app.get('/api/documents', (_,res) => res.json(db.prepare(`
  SELECT * FROM documents ORDER BY
  CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END, expiry_date ASC, name ASC`).all()));
app.post('/api/documents', (req,res) => {
  const {name,category,issue_date,expiry_date,reminder_days,notes}=req.body;
  const r=db.prepare(`INSERT INTO documents (name,category,issue_date,expiry_date,reminder_days,notes) VALUES (?,?,?,?,?,?)`)
    .run(name,category||'inne',issue_date||null,expiry_date||null,reminder_days??30,notes||'');
  res.json(db.prepare('SELECT * FROM documents WHERE id=?').get(r.lastInsertRowid));
});
app.put('/api/documents/:id', (req,res) => {
  const {name,category,issue_date,expiry_date,reminder_days,notes}=req.body;
  db.prepare(`UPDATE documents SET name=?,category=?,issue_date=?,expiry_date=?,reminder_days=?,notes=? WHERE id=?`)
    .run(name,category||'inne',issue_date||null,expiry_date||null,reminder_days??30,notes||'',req.params.id);
  res.json(db.prepare('SELECT * FROM documents WHERE id=?').get(req.params.id));
});
app.delete('/api/documents/:id', (req,res) => { db.prepare('DELETE FROM documents WHERE id=?').run(req.params.id); res.json({success:true}); });

// ── contacts ──────────────────────────────────────────────────────────────────
app.get('/api/contacts', (_,res) => res.json(db.prepare('SELECT * FROM contacts ORDER BY favourite DESC, name ASC').all()));
app.post('/api/contacts', (req,res) => {
  const {name,role,phone,email,notes,favourite}=req.body;
  const r=db.prepare(`INSERT INTO contacts (name,role,phone,email,notes,favourite) VALUES (?,?,?,?,?,?)`)
    .run(name,role||'',phone||'',email||'',notes||'',favourite?1:0);
  res.json(db.prepare('SELECT * FROM contacts WHERE id=?').get(r.lastInsertRowid));
});
app.put('/api/contacts/:id', (req,res) => {
  const {name,role,phone,email,notes,favourite}=req.body;
  db.prepare(`UPDATE contacts SET name=?,role=?,phone=?,email=?,notes=?,favourite=? WHERE id=?`)
    .run(name,role||'',phone||'',email||'',notes||'',favourite?1:0,req.params.id);
  res.json(db.prepare('SELECT * FROM contacts WHERE id=?').get(req.params.id));
});
app.delete('/api/contacts/:id', (req,res) => { db.prepare('DELETE FROM contacts WHERE id=?').run(req.params.id); res.json({success:true}); });

// ── alerts ────────────────────────────────────────────────────────────────────
app.get('/api/alerts', (_,res) => {
  const today=new Date().toISOString().split('T')[0];
  const in7=new Date(Date.now()+7*86400000).toISOString().split('T')[0];
  const in30=new Date(Date.now()+30*86400000).toISOString().split('T')[0];
  const alerts=[];

  db.prepare(`SELECT * FROM tasks WHERE completed=0 AND due_date IS NOT NULL AND due_date<?`).all(today)
    .forEach(t=>alerts.push({type:'task',level:'danger',id:t.id,msg:`Zaległe zadanie: ${t.title}`,date:t.due_date,module:'tasks'}));
  db.prepare(`SELECT * FROM tasks WHERE completed=0 AND due_date=?`).all(today)
    .forEach(t=>alerts.push({type:'task',level:'warn',id:t.id,msg:`Zadanie na dziś: ${t.title}`,date:t.due_date,module:'tasks'}));
  db.prepare(`SELECT * FROM periodic_tasks WHERE next_due IS NOT NULL AND next_due<=?`).all(in7)
    .forEach(t=>alerts.push({type:'periodic',level:t.next_due<today?'danger':'warn',id:t.id,msg:`Przegląd: ${t.name}`,date:t.next_due,module:'periodic'}));
  db.prepare(`SELECT * FROM products WHERE expiry_date IS NOT NULL AND expiry_date!='' AND expiry_date<=?`).all(in7)
    .forEach(p=>alerts.push({type:'product',level:p.expiry_date<today?'danger':'warn',id:p.id,msg:`Produkt: ${p.name}`,date:p.expiry_date,module:'fridge'}));
  db.prepare(`SELECT * FROM documents WHERE expiry_date IS NOT NULL AND expiry_date<=?`).all(in30)
    .forEach(d=>alerts.push({type:'document',level:d.expiry_date<today?'danger':'warn',id:d.id,msg:`Dokument: ${d.name}`,date:d.expiry_date,module:'documents'}));

  db.prepare('SELECT * FROM appliances WHERE purchase_date IS NOT NULL AND warranty_months IS NOT NULL').all()
    .forEach(a=>{
      const wd=new Date(a.purchase_date); wd.setMonth(wd.getMonth()+a.warranty_months);
      const we=wd.toISOString().split('T')[0];
      if(we<=in30) alerts.push({type:'appliance',level:we<today?'info':'warn',id:a.id,msg:`Gwarancja: ${a.name}`,date:we,module:'appliances'});
      if(a.last_service&&a.service_interval_months){
        const sd=new Date(a.last_service); sd.setMonth(sd.getMonth()+a.service_interval_months);
        const sn=sd.toISOString().split('T')[0];
        if(sn<=in30) alerts.push({type:'appliance',level:sn<today?'danger':'warn',id:a.id,msg:`Serwis: ${a.name}`,date:sn,module:'appliances'});
      }
    });

  alerts.sort((a,b)=>({danger:0,warn:1,info:2}[a.level]??3)-({danger:0,warn:1,info:2}[b.level]??3)||(a.date||'').localeCompare(b.date||''));
  res.json(alerts);
});

app.get('/api/rootca', (_, res) => {
  const caPath = require('os').homedir() + '/.local/share/mkcert/rootCA.pem';
  if (require('fs').existsSync(caPath)) {
    res.setHeader('Content-Type', 'application/x-x509-ca-cert');
    res.setHeader('Content-Disposition', 'attachment; filename="fridge-rootCA.crt"');
    res.sendFile(caPath);
  } else {
    res.status(404).json({ error: 'CA not found' });
  }
});

app.get('/fridge-panel.js', (_, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`
class FridgePanel extends HTMLElement {
  set panel(_) {
    this.style.cssText = 'display:block;width:100%;height:100%';
    this.innerHTML = '<iframe src="https://192.168.10.185:5173" allow="camera;microphone;fullscreen" style="width:100%;height:100vh;border:none;display:block"></iframe>';
  }
}
customElements.define('fridge-panel', FridgePanel);
  `.trim());
});

app.listen(PORT, ()=>console.log(`Dom: http://localhost:${PORT}`));
