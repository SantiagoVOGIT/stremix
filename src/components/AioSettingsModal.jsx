import React, { useState, useEffect } from 'react';
import { 
  Server, 
  Key, 
  Zap, 
  ExternalLink, 
  RefreshCw, 
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  Check
} from 'lucide-react';
import { 
  getSettings, 
  saveSettings 
} from '../services/storage';
import { 
  PUBLIC_AIO_INSTANCES, 
  testAioConnection,
  normalizeAioUrl
} from '../services/aiostream';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';

export const AioSettingsModal = ({ onClose, onSettingsUpdated }) => {
  const [settings, setSettings] = useState(getSettings());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

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
    // If the token is a full URL, auto-sync aiostreamUrl to its origin
    const normalized = normalizeAioUrl(settings.aiostreamConfigToken, settings.aiostreamUrl);
    const updatedSettings = {
      ...settings,
      aiostreamUrl: normalized?.origin || settings.aiostreamUrl
    };

    saveSettings(updatedSettings);
    setSavedSuccess(true);
    if (onSettingsUpdated) onSettingsUpdated(updatedSettings);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1000);
  };

  return (
    <Dialog open={true} onClose={onClose}>
      <DialogContent onClose={onClose} style={{ maxWidth: '42rem', maxHeight: '90vh', overflowY: 'auto', padding: '1.75rem' }}>
        <DialogHeader style={{ padding: 0, paddingBottom: '1rem', borderBottom: '1px solid hsl(var(--border))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="brand-icon">
              <Server size={18} fill="currentColor" />
            </div>
            <div>
              <DialogTitle>Configuración de AIOStreams</DialogTitle>
              <DialogDescription>
                Conecta tu instancia de AIOStreams, manifiesto personalizado o cuentas Debrid.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1.25rem' }}>
          {/* Quick Info Box */}
          <div style={{
            backgroundColor: 'hsl(var(--muted) / 0.5)',
            border: '1px solid hsl(var(--border))',
            borderRadius: 'var(--radius-md)',
            padding: '0.875rem 1rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px'
          }}>
            <HelpCircle size={18} color="hsl(var(--muted-foreground))" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.5 }}>
              <strong style={{ color: 'hsl(var(--foreground))' }}>¿Tienes un enlace de manifiesto o token?</strong>
              <p style={{ marginTop: '2px' }}>
                Pega a continuación tu enlace (soporta enlaces de Stremio <code>stremio://...</code> o <code>https://.../manifest.json</code>). Stremix normalizará la conexión automáticamente.
              </p>
              <a 
                href="https://aiostreams.viren070.me/stremio/configure" 
                target="_blank" 
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: 'hsl(var(--foreground))',
                  marginTop: '6px',
                  fontWeight: 600,
                  textDecoration: 'underline',
                  fontSize: '0.775rem'
                }}
              >
                Abrir portal de configuración de AIOStreams <ExternalLink size={11} />
              </a>
            </div>
          </div>

          {/* Preset Instances Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
              Instancia de AIOStreams
            </label>
            <div className="instance-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {PUBLIC_AIO_INSTANCES.map((inst) => {
                const isSelected = settings.aiostreamUrl === inst.url;
                return (
                  <div
                    key={inst.url}
                    onClick={() => setSettings({ ...settings, aiostreamUrl: inst.url })}
                    style={{
                      padding: '0.625rem 0.75rem',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${isSelected ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
                      backgroundColor: isSelected ? 'hsl(var(--accent))' : 'hsl(var(--card))',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                      {inst.name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', marginTop: '2px' }}>
                      {inst.desc}
                    </div>
                  </div>
                );
              })}
            </div>

            <Input
              style={{ marginTop: '4px' }}
              value={settings.aiostreamUrl}
              onChange={(e) => setSettings({ ...settings, aiostreamUrl: e.target.value })}
              placeholder="https://aiostreams.viren070.me"
            />
          </div>

          {/* Config Token or Manifest URL */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'hsl(var(--foreground))', display: 'flex', justifyContent: 'space-between' }}>
              <span>Token de Configuración o Enlace Manifest</span>
              <span style={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))' }}>Soporta stremio:// y https://</span>
            </label>
            <Input
              className="aio-token-input"
              value={settings.aiostreamConfigToken}
              onChange={(e) => setSettings({ ...settings, aiostreamConfigToken: e.target.value })}
              placeholder="Ej: https://aiostreams.viren070.me/stremio/u/tu-alias/manifest.json o tu token"
            />
            <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
              Pega aquí el enlace de manifiesto generado por tu instancia de AIOStreams tras guardar tus claves Debrid.
            </span>
          </div>

          {/* Live Test Diagnostic Box */}
          <div style={{
            backgroundColor: 'hsl(var(--muted) / 0.3)',
            border: '1px solid hsl(var(--border))',
            borderRadius: 'var(--radius-md)',
            padding: '0.875rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Zap size={15} color="#fbbf24" />
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                  Diagnóstico de Conexión
                </span>
              </div>
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={handleTestConnection}
                disabled={testing}
              >
                {testing ? <RefreshCw size={13} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> : 'Probar Conexión'}
              </Button>
            </div>

            {testResult && (
              <div style={{
                backgroundColor: testResult.ok ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${testResult.ok ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                borderRadius: 'var(--radius-sm)',
                padding: '0.625rem 0.75rem',
                fontSize: '0.8125rem'
              }}>
                {testResult.ok ? (
                  <div>
                    <div style={{ color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Check size={15} /> Conexión Exitosa ({testResult.latency} ms)
                    </div>
                    <div style={{ color: 'hsl(var(--muted-foreground))', marginTop: '2px', fontSize: '0.75rem' }}>
                      Addon: <strong>{testResult.name}</strong> • Versión: <strong>{testResult.version}</strong>
                    </div>
                  </div>
                ) : (
                  <div style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={15} /> Error: {testResult.error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Preferences Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                Calidad Preferida
              </label>
              <select
                className="ui-input"
                value={settings.preferredResolution || 'all'}
                onChange={(e) => setSettings({ ...settings, preferredResolution: e.target.value })}
              >
                <option value="all" style={{ background: '#09090b' }}>Todas las calidades</option>
                <option value="4k" style={{ background: '#09090b' }}>4K UHD (2160p)</option>
                <option value="1080p" style={{ background: '#09090b' }}>1080p Full HD</option>
                <option value="720p" style={{ background: '#09090b' }}>720p HD</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                Criterio de Ordenamiento de Enlaces
              </label>
              <select
                className="ui-input"
                value={settings.sortBy || 'quality'}
                onChange={(e) => setSettings({ ...settings, sortBy: e.target.value })}
              >
                <option value="quality" style={{ background: '#09090b' }}>Mayor Calidad (4K &gt; 1080p)</option>
                <option value="spanish" style={{ background: '#09090b' }}>🇲🇽 / 🇪🇸 Audio Español Primero</option>
                <option value="seeders" style={{ background: '#09090b' }}>Más Semillas (P2P)</option>
                <option value="size" style={{ background: '#09090b' }}>Mayor Tamaño de Archivo</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                Idioma Predeterminado de Subtítulos
              </label>
              <select
                className="ui-input"
                value={settings.subtitlesLanguage || 'spa'}
                onChange={(e) => setSettings({ ...settings, subtitlesLanguage: e.target.value })}
              >
                <option value="spa" style={{ background: '#09090b' }}>Español (Latino / Castellano)</option>
                <option value="eng" style={{ background: '#09090b' }}>Inglés (English)</option>
                <option value="all" style={{ background: '#09090b' }}>Todos los idiomas</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                Reproductor Externo
              </label>
              <select
                className="ui-input"
                value={settings.externalPlayer || 'vlc'}
                onChange={(e) => setSettings({ ...settings, externalPlayer: e.target.value })}
              >
                <option value="vlc" style={{ background: '#09090b' }}>VLC Media Player</option>
                <option value="mpv" style={{ background: '#09090b' }}>MPV Player</option>
                <option value="potplayer" style={{ background: '#09090b' }}>PotPlayer</option>
              </select>
            </div>
          </div>

          {/* Toggle Switches */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '4px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.8125rem', color: 'hsl(var(--foreground))' }}>
              <input
                type="checkbox"
                checked={settings.autoPlayNext !== false}
                onChange={(e) => setSettings({ ...settings, autoPlayNext: e.target.checked })}
                style={{ accentColor: 'hsl(var(--primary))', width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span><strong>Auto-Binge:</strong> Reproducir automáticamente el siguiente episodio en series</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.8125rem', color: 'hsl(var(--foreground))' }}>
              <input
                type="checkbox"
                checked={settings.useProxy !== false}
                onChange={(e) => setSettings({ ...settings, useProxy: e.target.checked })}
                style={{ accentColor: 'hsl(var(--primary))', width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span><strong>Proxy Anti-CORS:</strong> Habilitar streaming proxy con soporte de rangos HTTP 206 (Recomendado)</span>
            </label>
          </div>
        </div>

        <DialogFooter style={{ padding: 0, paddingTop: '1.25rem', marginTop: '1.25rem' }}>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="default" onClick={handleSave}>
            {savedSuccess ? (
              <>
                <Check size={15} /> ¡Guardado!
              </>
            ) : (
              'Guardar Configuración'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
