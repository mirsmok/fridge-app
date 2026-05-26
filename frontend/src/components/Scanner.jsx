import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

const SCANNER_ID = 'qr-reader';

export default function Scanner({ onScan, onClose }) {
  const scannerRef = useRef(null);
  const [cameras, setCameras] = useState([]);
  const [activeCamIdx, setActiveCamIdx] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | running | error
  const [errorMsg, setErrorMsg] = useState('');

  const stopScanner = async () => {
    const s = scannerRef.current;
    if (s && s.isScanning) {
      try { await s.stop(); } catch {}
    }
  };

  const startCamera = useCallback(async (camIdx, camList) => {
    const list = camList ?? cameras;
    if (!list.length) return;
    const cam = list[camIdx ?? activeCamIdx ?? 0];

    await stopScanner();

    const scanner = scannerRef.current;
    setStatus('loading');
    setErrorMsg('');

    try {
      await scanner.start(
        cam.id,
        { fps: 10, qrbox: { width: 260, height: 130 }, aspectRatio: 1.5 },
        (text) => {
          stopScanner();
          onScan(text);
        },
        () => {}
      );
      setActiveCamIdx(camIdx ?? 0);
      setStatus('running');
    } catch (e) {
      const msg = String(e);
      if (msg.includes('NotReadableError') || msg.includes('Could not start')) {
        setErrorMsg('Kamera zajęta przez inną aplikację. Spróbuj zamknąć inne aplikacje lub wybrać inną kamerę.');
      } else if (msg.includes('NotAllowedError')) {
        setErrorMsg('Brak uprawnień do kamery. Zezwól na dostęp w ustawieniach przeglądarki.');
      } else {
        setErrorMsg(`Błąd: ${msg}`);
      }
      setStatus('error');
    }
  }, [cameras, activeCamIdx, onScan]);

  useEffect(() => {
    const scanner = new Html5Qrcode(SCANNER_ID);
    scannerRef.current = scanner;

    Html5Qrcode.getCameras()
      .then(list => {
        if (!list.length) { setErrorMsg('Nie znaleziono kamer.'); setStatus('error'); return; }
        setCameras(list);
        // domyślnie tylna kamera
        const backIdx = list.findIndex(c =>
          c.label.toLowerCase().includes('back') ||
          c.label.toLowerCase().includes('rear') ||
          c.label.toLowerCase().includes('environment') ||
          c.label.toLowerCase().includes('tył')
        );
        const idx = backIdx >= 0 ? backIdx : list.length > 1 ? 1 : 0;
        startCamera(idx, list);
      })
      .catch(e => {
        setErrorMsg(`Nie można uzyskać listy kamer: ${e}`);
        setStatus('error');
      });

    return () => { stopScanner(); };
  }, []);

  const switchCamera = (idx) => {
    if (idx === activeCamIdx) return;
    startCamera(idx, cameras);
  };

  const isFront = (cam) =>
    cam.label.toLowerCase().includes('front') ||
    cam.label.toLowerCase().includes('user') ||
    cam.label.toLowerCase().includes('przód');

  return (
    <div>
      {/* Przełącznik aparatu */}
      {cameras.length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, justifyContent: 'center' }}>
          {cameras.map((cam, idx) => (
            <button
              key={cam.id}
              className={`btn ${activeCamIdx === idx ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: '0.78rem', flex: 1 }}
              onClick={() => switchCamera(idx)}
            >
              {isFront(cam) ? '🤳 Przedni' : `📷 ${cameras.length > 2 ? `Kamera ${idx + 1}` : 'Tylni'}`}
            </button>
          ))}
        </div>
      )}

      <div className="scanner-wrap" style={{ position: 'relative', minHeight: 180 }}>
        <div id={SCANNER_ID} />
        {status === 'loading' && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: 'rgba(0,0,0,0.6)', borderRadius: 'var(--radius)'
          }}>
            <span style={{ color: '#fff', fontSize: '0.85rem' }}>⏳ Uruchamianie kamery…</span>
          </div>
        )}
      </div>

      {status === 'error' && (
        <div style={{ background: 'rgba(224,82,82,0.15)', border: '1px solid var(--danger)', borderRadius: 8, padding: '10px 12px', marginBottom: 10, fontSize: '0.82rem', color: 'var(--danger)' }}>
          ⚠️ {errorMsg}
          {cameras.length > 1 && (
            <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
              {cameras.map((cam, idx) => idx !== activeCamIdx && (
                <button key={cam.id} className="btn btn-warn" style={{ fontSize: '0.75rem' }} onClick={() => switchCamera(idx)}>
                  Spróbuj {isFront(cam) ? 'przedni' : `kamerę ${idx + 1}`}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {status === 'running' && (
        <p style={{ color: 'var(--ok)', fontSize: '0.8rem', marginBottom: 8, textAlign: 'center' }}>
          📷 Skieruj kamerę na kod kreskowy
        </p>
      )}

      <button className="btn btn-ghost" style={{ width: '100%' }} onClick={onClose}>Anuluj</button>
    </div>
  );
}
