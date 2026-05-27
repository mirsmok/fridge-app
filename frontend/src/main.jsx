import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import Scanner from './components/Scanner.jsx';
import './App.css';

const TIMEOUT_SECS = 90;

function ScannerPage() {
  const [remaining, setRemaining] = useState(TIMEOUT_SECS);
  const remainingRef = useRef(TIMEOUT_SECS);

  useEffect(() => {
    const interval = setInterval(() => {
      remainingRef.current -= 1;
      if (remainingRef.current <= 10) {
        setRemaining(remainingRef.current);
      }
      if (remainingRef.current <= 0) {
        window.close();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleScan = useCallback((code) => {
    if (window.opener) {
      window.opener.postMessage({ type: 'barcode', code }, '*');
      window.close();
    } else {
      localStorage.setItem('scanner_result', code);
      localStorage.setItem('scanner_result_time', Date.now().toString());
      window.history.back();
    }
  }, []);

  const handleClose = useCallback(() => {
    if (window.opener) window.close();
    else window.history.back();
  }, []);

  return (
    <div style={{ padding: 16, background: 'var(--bg)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="section-title" style={{ margin: 0 }}>Skanuj kod kreskowy</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {remaining <= 10 && (
            <span style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>Zamknięcie za {remaining}s</span>
          )}
          <button className="btn btn-ghost" style={{ fontSize: '1.1rem', padding: '6px 14px' }} onClick={handleClose}>✕ Zamknij</button>
        </div>
      </div>
      <Scanner onScan={handleScan} onClose={handleClose} />
    </div>
  );
}

const isScanner = new URLSearchParams(window.location.search).get('scanner') === '1';

ReactDOM.createRoot(document.getElementById('root')).render(
  isScanner
    ? <ScannerPage />
    : <React.StrictMode><App /></React.StrictMode>
);
