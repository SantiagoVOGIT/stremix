import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  Server, 
  Key, 
  Zap, 
  Sliders, 
  ExternalLink, 
  RefreshCw, 
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  Film
} from 'lucide-react';
import { 
  getSettings, 
  saveSettings 
} from '../services/storage';
import { 
  PUBLIC_AIO_INSTANCES, 
  testAioConnection 
} from '../services/aiostream';

export const AioSettingsModal = ({ onClose, onSettingsUpdated }) => {
  const [settings, setSettings] = useState(getSettings());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testAioConnection(
        settings.aiostreamUrl, 
        settings.aiostreamConfigToken, 
        settings.aiostreamUserData
      );
      setTestResult(res);
    } catch (err) {
      setTestResult({ ok: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    saveSettings(settings);
    setSavedSuccess(true);
    if (onSettingsUpdated) onSettingsUpdated(settings);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" style={{ maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>
          <X size={20} />
        </button>

        <div style={{ padding: '28px 32px', borderBottom: '1px solid var(--border-glass)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="brand-icon" style={{ width: '42px', height: '42px' }}>
              <Server size={22} fill="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>
                Configuración de AIOStreams
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Personaliza la API de AIOStreams, tus servicios Debrid (Real-Debrid, Torbox) y opciones de reproducción.
              </p>
            </div>
          </div>
        </div>

        <div className="modal-body" style={{ padding: '28px 32px' }}>
          {/* Quick Guide Alert */}
          <div style={{
            background: 'rgba(139, 92, 246, 0.08)',
            border: '1px solid rgba(139, 92, 246, 0.25)',
            borderRadius: '12px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <HelpCircle size={22} color="var(--accent-violet)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.5 }}>
              <strong>¿Cómo funciona AIOStreams?</strong>
              <p style={{ marginTop: '4px' }}>
                AIOStreams consolida Torrentio, MediaFusion, Debrid y Usenet en un único super-feed. Puedes usar la versión de prueba incluida o conectar tu propia configuración de AIOStreams pegando tu Token o enlace de manifiesto a continuación.
              </p>
              <a 
                href="https://aiostreams.viren070.me/stremio/configure" 
                target="_blank" 
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  color: 'var(--accent-cyan)',
                  marginTop: '8px',
                  fontWeight: 600,
                  textDecoration: 'none'
                }}
              >
                Abrir portal de configuración de AIOStreams <ExternalLink size={13} />
              </a>
            </div>
          </div>

          {/* Instance Selection */}
          <div className="form-group">
            <label className="form-label">
              <span>Instancia de AIOStreams</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>Selecciona una o escribe tu URL</span>
            </label>
            <div className="instance-cards-grid">
              {PUBLIC_AIO_INSTANCES.map((inst) => {
                const isSelected = settings.aiostreamUrl === inst.url;
                return (
                  <div
                    key={inst.url}
                    className={`instance-card-select ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSettings({ ...settings, aiostreamUrl: inst.url })}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: isSelected ? '#fff' : 'var(--text-main)' }}>
                      {inst.name}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                      {inst.desc}
                    </div>
                  </div>
                );
              })}
            </div>

            <input
              type="text"
              className="form-input"
              style={{ marginTop: '8px' }}
              value={settings.aiostreamUrl}
              onChange={(e) => setSettings({ ...settings, aiostreamUrl: e.target.value })}
              placeholder="https://aiostreams.viren070.me"
            />
          </div>

          {/* Manifest URL or Config Token */}
          <div className="form-group">
            <label className="form-label">
              <span>Token de Configuración o Enlace Manifest</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Opcional (para tu Real-Debrid)</span>
            </label>
            <input
              type="text"
              className="form-input"
              value={settings.aiostreamConfigToken}
              onChange={(e) => setSettings({ ...settings, aiostreamConfigToken: e.target.value })}
              placeholder="Ej: https://aiostreams.viren070.me/stremio/u/tu-alias/manifest.json o tu token"
            />
            <span className="form-hint">
              Pega aquí el enlace de manifiesto que genera AIOStreams tras guardar tus addons y claves Debrid.
            </span>
          </div>

          {/* REST API User Data (Advanced) */}
          <div className="form-group">
            <label className="form-label">
              <span>UserData REST API (Avanzado)</span>
            </label>
            <input
              type="text"
              className="form-input"
              value={settings.aiostreamUserData}
              onChange={(e) => setSettings({ ...settings, aiostreamUserData: e.target.value })}
              placeholder="UserData JSON en Base64 para llamadas directas a /api/v1/search"
            />
          </div>

          {/* Test Connection Diagnostic Box */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-glass)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={18} color="var(--accent-amber)" />
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff' }}>
                  Diagnóstico de Conexión
                </span>
              </div>
              <button 
                className="btn-secondary" 
                style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                onClick={handleTestConnection}
                disabled={testing}
              >
                {testing ? <RefreshCw size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> : 'Probar Conexión'}
              </button>
            </div>

            {testResult && (
              <div style={{
                background: testResult.ok ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${testResult.ok ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                borderRadius: '8px',
                padding: '12px 14px',
                fontSize: '0.85rem'
              }}>
                {testResult.ok ? (
                  <div>
                    <div style={{ color: 'var(--accent-emerald)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Check size={16} /> Conexión Exitosa ({testResult.latency} ms)
                    </div>
                    <div style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                      Addon: <strong>{testResult.name}</strong> • Versión: <strong>{testResult.version}</strong>
                    </div>
                  </div>
                ) : (
                  <div style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={16} /> Error: {testResult.error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Preferences Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Calidad Preferida</label>
              <select
                className="form-input"
                value={settings.preferredResolution}
                onChange={(e) => setSettings({ ...settings, preferredResolution: e.target.value })}
              >
                <option value="all">Todas las calidades</option>
                <option value="4k">4K UHD (2160p)</option>
                <option value="1080p">1080p Full HD</option>
                <option value="720p">720p HD</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Ordenar Resultados Por</label>
              <select
                className="form-input"
                value={settings.sortBy}
                onChange={(e) => setSettings({ ...settings, sortBy: e.target.value })}
              >
                <option value="quality">Mejor Calidad (Bitrate/4K)</option>
                <option value="seeders">Más Semillas (P2P)</option>
                <option value="size">Tamaño de Archivo</option>
              </select>
            </div>
          </div>

          {/* Save / Cancel Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
            <button className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={handleSave}>
              {savedSuccess ? (
                <>
                  <Check size={18} /> ¡Guardado!
                </>
              ) : (
                'Guardar Ajustes'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
