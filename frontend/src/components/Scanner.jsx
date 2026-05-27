import { useEffect, useRef, useState, useCallback } from 'react';

export default function Scanner({ onScan, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const detectorRef = useRef(null);
  const activeRef = useRef(false);
  const lastConstraintRef = useRef(null);
  const stallCheckRef = useRef(null);
  const lastTimeRef = useRef(0);
  const stallCountRef = useRef(0);
  const [status, setStatus] = useState('loading');
  const [statusMsg, setStatusMsg] = useState('Uruchamianie…');
  const [errorMsg, setErrorMsg] = useState('');
  const [restartCount, setRestartCount] = useState(0);
  const [cameras, setCameras] = useState([]);
  const [hasFully, setHasFully] = useState(false);

  useEffect(() => {
    setHasFully(typeof window.fully === 'object' && typeof window.fully.scanQrCode === 'function');
  }, []);

  const scanWithFully = useCallback(() => {
    if (!window.fully) return;
    // FK Browser Plus: fully.scanQrCode(prompt, jsCallback) — wywoła globalny callback
    window.__onFullyBarcode = (code) => {
      if (code) onScan(code);
    };
    try {
      window.fully.scanQrCode('Skanuj kod kreskowy', '__onFullyBarcode');
    } catch (e) {
      setErrorMsg(`FK Browser native scanner error: ${e}`);
    }
  }, [onScan]);

  const stopCamera = useCallback(() => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    clearInterval(stallCheckRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const scanLoop = useCallback(() => {
    if (!activeRef.current) return;
    const video = videoRef.current;
    const detector = detectorRef.current;
    if (!video || !detector || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(scanLoop);
      return;
    }
    detector.detect(video)
      .then(barcodes => {
        if (!activeRef.current) return;
        if (barcodes.length > 0) {
          stopCamera();
          onScan(barcodes[0].rawValue);
        } else {
          rafRef.current = requestAnimationFrame(scanLoop);
        }
      })
      .catch(() => { rafRef.current = requestAnimationFrame(scanLoop); });
  }, [onScan, stopCamera]);

  const startCamera = useCallback(async (constraint) => {
    stopCamera();
    setStatus('loading');
    setErrorMsg('');
    setStatusMsg('Uruchamianie kamery…');

    if (!('BarcodeDetector' in window)) {
      setErrorMsg('BarcodeDetector niedostępny w tej wersji FK Browser / Android WebView. Zaktualizuj system WebView.');
      setStatus('error');
      return;
    }

    try {
      detectorRef.current = new BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
      });
    } catch (e) {
      setErrorMsg(`BarcodeDetector init error: ${e}`);
      setStatus('error');
      return;
    }

    try {
      lastConstraintRef.current = constraint;
      const stream = await navigator.mediaDevices.getUserMedia({ video: constraint });
      streamRef.current = stream;
      activeRef.current = true;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus('running');
      lastTimeRef.current = 0;
      stallCountRef.current = 0;
      rafRef.current = requestAnimationFrame(scanLoop);

      // Po pierwszym getUserMedia enumerateDevices zwraca prawdziwe labels
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videos = devices.filter(d => d.kind === 'videoinput');
        setCameras(videos);
      } catch {}

      // Detekcja zawieszenia strumienia (Motion Detection FK Browser może przerywać)
      stallCheckRef.current = setInterval(() => {
        if (!activeRef.current || !videoRef.current) return;
        const t = videoRef.current.currentTime;
        if (t === lastTimeRef.current) {
          stallCountRef.current += 1;
          if (stallCountRef.current >= 3) {
            // 3 × 1s = 3s bez nowej klatki — restart
            clearInterval(stallCheckRef.current);
            setStatusMsg('Strumień zawieszony — restart…');
            setRestartCount(c => c + 1);
            startCamera(lastConstraintRef.current);
          }
        } else {
          stallCountRef.current = 0;
          lastTimeRef.current = t;
        }
      }, 1000);
    } catch (e) {
      setErrorMsg(String(e));
      setStatus('error');
    }
  }, [stopCamera, scanLoop]);

  useEffect(() => {
    // FK Browser + Legacy Camera: sekwencja "warmup" — przednia, potem tylna
    // Bez tego pierwsza próba tylnej kamery nie działa, bo Motion Detection trzyma lock
    const init = async () => {
      setStatusMsg('Inicjalizacja kamery (warmup)…');
      await startCamera({ facingMode: 'user' });
      await new Promise(r => setTimeout(r, 800));
      await startCamera({ facingMode: 'environment' });
    };
    init();
    return () => stopCamera();
  }, []);

  return (
    <div>
      {hasFully && (
        <div style={{
          background: 'rgba(76,175,130,0.15)', border: '1px solid var(--ok)',
          borderRadius: 8, padding: '8px 12px', marginBottom: 10
        }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--ok)', marginBottom: 6 }}>
            ✅ Wykryto FK Browser Plus — natywny skaner (nie konfliktuje z Motion Detection)
          </div>
          <button className="btn btn-ok" style={{ width: '100%', fontSize: '0.85rem' }} onClick={scanWithFully}>
            📱 Skanuj natywnie (FK Browser)
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost" style={{ flex: 1, fontSize: '0.75rem', minWidth: 90 }}
          onClick={() => startCamera({ facingMode: 'environment' })}>📷 Tylna</button>
        <button className="btn btn-ghost" style={{ flex: 1, fontSize: '0.75rem', minWidth: 90 }}
          onClick={() => startCamera({ facingMode: 'user' })}>🤳 Przednia</button>
        {cameras.map((cam, idx) => (
          <button key={cam.deviceId} className="btn btn-ghost"
            style={{ flex: 1, fontSize: '0.7rem', minWidth: 90 }}
            onClick={() => startCamera({ deviceId: { exact: cam.deviceId } })}>
            #{idx}: {cam.label ? cam.label.slice(0, 14) : cam.deviceId.slice(0, 6)}
          </button>
        ))}
      </div>

      <div className="scanner-wrap" style={{ position: 'relative', minHeight: 200 }}>
        <video ref={videoRef} playsInline muted style={{ width: '100%', display: 'block' }} />
        {status === 'loading' && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: 'rgba(0,0,0,0.75)', borderRadius: 'var(--radius)'
          }}>
            <span style={{ color: '#fff', fontSize: '0.85rem' }}>⏳ {statusMsg}</span>
          </div>
        )}
      </div>

      {status === 'error' && (
        <div style={{
          background: 'rgba(224,82,82,0.15)', border: '1px solid var(--danger)',
          borderRadius: 8, padding: '10px 12px', margin: '8px 0',
          fontSize: '0.78rem', color: 'var(--danger)', wordBreak: 'break-all'
        }}>
          ⚠️ {errorMsg}
          <div style={{ marginTop: 8 }}>
            <button className="btn btn-warn" style={{ fontSize: '0.75rem' }}
              onClick={() => startCamera({ facingMode: 'environment' })}>Spróbuj ponownie</button>
          </div>
        </div>
      )}

      {status === 'running' && (
        <p style={{ color: 'var(--ok)', fontSize: '0.8rem', margin: '8px 0', textAlign: 'center' }}>
          📷 Skieruj kamerę na kod kreskowy{restartCount > 0 && ` (restarts: ${restartCount})`}
        </p>
      )}

      <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }}
        onClick={() => { stopCamera(); onClose(); }}>Anuluj</button>
    </div>
  );
}
