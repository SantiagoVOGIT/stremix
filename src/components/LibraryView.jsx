import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Trash2, 
  Bookmark, 
  Clock, 
  Download, 
  Upload, 
  Sparkles
} from 'lucide-react';
import { 
  getContinueWatching, 
  removeProgress, 
  getFavorites, 
  getHistory,
  exportBackup,
  importBackup
} from '../services/storage';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';

export const LibraryView = ({ onSelectMedia, onResumePlayback }) => {
  const [activeTab, setActiveTab] = useState('continue');
  const [continueList, setContinueList] = useState([]);
  const [favoritesList, setFavoritesList] = useState([]);
  const [historyList, setHistoryList] = useState([]);
  const [importStatus, setImportStatus] = useState('');

  const reloadData = () => {
    setContinueList(getContinueWatching());
    setFavoritesList(getFavorites());
    setHistoryList(getHistory());
  };

  useEffect(() => {
    reloadData();
  }, []);

  const handleRemoveProgress = (e, videoId) => {
    e.stopPropagation();
    const updated = removeProgress(videoId);
    setContinueList(updated);
  };

  const handleExport = () => {
    const jsonStr = exportBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stremix_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const success = importBackup(evt.target.result);
      if (success) {
        setImportStatus('¡Datos importados con éxito!');
        reloadData();
      } else {
        setImportStatus('Error al importar el archivo JSON.');
      }
      setTimeout(() => setImportStatus(''), 3000);
    };
    reader.readAsText(file);
  };

  const formatSecs = (sec) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="section-wrapper" style={{ marginTop: '1.5rem' }}>
      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <Tabs value={activeTab} onValueChange={setActiveTab} style={{ width: 'auto' }}>
          <TabsList>
            <TabsTrigger value="continue">
              <Clock size={14} />
              <span>Continuar Viendo ({continueList.length})</span>
            </TabsTrigger>
            <TabsTrigger value="favorites">
              <Bookmark size={14} />
              <span>Favoritos ({favoritesList.length})</span>
            </TabsTrigger>
            <TabsTrigger value="history">
              <Sparkles size={14} />
              <span>Historial</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Backup Actions */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {importStatus && (
            <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>
              {importStatus}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={handleExport} title="Exportar copia de seguridad (JSON)">
            <Download size={14} />
            <span>Exportar</span>
          </Button>
          <label style={{ display: 'inline-flex', cursor: 'pointer' }}>
            <Button variant="outline" size="sm" as="span" title="Importar copia de seguridad (JSON)">
              <Upload size={14} />
              <span>Importar</span>
            </Button>
            <input type="file" accept=".json" onChange={handleImportFile} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {/* CONTINUAR VIENDO TAB */}
      {activeTab === 'continue' && (
        <div>
          {continueList.length === 0 ? (
            <div style={{ padding: '4rem 1rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>
              <Clock size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                No tienes reproducciones pendientes
              </h3>
              <p style={{ marginTop: '4px', fontSize: '0.85rem' }}>
                Cuando comiences a ver cualquier película o serie, tu progreso se guardará aquí automáticamente.
              </p>
            </div>
          ) : (
            <div className="media-grid">
              {continueList.map((item) => (
                <div 
                  key={item.videoId || item.id} 
                  className="media-card"
                  onClick={() => onSelectMedia({ id: item.id, name: item.name, type: item.type, poster: item.poster })}
                >
                  <div className="poster-wrapper">
                    <img 
                      src={item.poster || 'https://images.metahub.space/poster/medium/default.png'} 
                      alt={item.name} 
                      className="poster-img"
                    />

                    {/* Progress Bar overlay */}
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: '4px',
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      zIndex: 3
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min(100, Math.max(5, isNaN(item.percentage) ? (item.duration > 0 ? (item.currentTime / item.duration) * 100 : 5) : item.percentage))}%`,
                        backgroundColor: 'hsl(var(--primary))'
                      }}></div>
                    </div>

                    <div className="card-overlay">
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <Button 
                          variant="default"
                          size="sm"
                          style={{ flex: 1, fontSize: '0.8rem' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onResumePlayback) onResumePlayback(item);
                            else onSelectMedia(item);
                          }}
                        >
                          <Play size={13} fill="currentColor" />
                          <span>Reanudar</span>
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="icon"
                          style={{ width: '1.85rem', height: '1.85rem' }}
                          onClick={(e) => handleRemoveProgress(e, item.videoId || item.id)}
                          title="Quitar"
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="card-info">
                    <h3 className="card-title">{item.name}</h3>
                    <div className="card-meta-row">
                      <span style={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}>
                        {item.episode ? `T${item.episode.season}:E${item.episode.number || item.episode.episode || 1}` : 'Película'}
                      </span>
                      <span>
                        {formatSecs(item.currentTime)} / {formatSecs(item.duration)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* FAVORITOS TAB */}
      {activeTab === 'favorites' && (
        <div>
          {favoritesList.length === 0 ? (
            <div style={{ padding: '4rem 1rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>
              <Bookmark size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                Tu lista de favoritos está vacía
              </h3>
              <p style={{ marginTop: '4px', fontSize: '0.85rem' }}>
                Agrega películas o series presionando el icono del marcador en cualquier tarjeta.
              </p>
            </div>
          ) : (
            <div className="media-grid">
              {favoritesList.map((item) => (
                <div 
                  key={item.id} 
                  className="media-card"
                  onClick={() => onSelectMedia(item)}
                >
                  <div className="poster-wrapper">
                    <img 
                      src={item.poster || 'https://images.metahub.space/poster/medium/default.png'} 
                      alt={item.name} 
                      className="poster-img"
                    />
                    <div className="card-overlay">
                      <Button variant="default" size="sm" style={{ width: '100%' }}>
                        <Play size={13} fill="currentColor" />
                        <span>Ver Ficha</span>
                      </Button>
                    </div>
                  </div>
                  <div className="card-info">
                    <h3 className="card-title">{item.name}</h3>
                    <div className="card-meta-row">
                      <span>{item.year || '2024'}</span>
                      <span style={{ textTransform: 'capitalize' }}>
                        {item.type === 'series' ? 'Serie' : 'Película'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* HISTORIAL TAB */}
      {activeTab === 'history' && (
        <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-lg)', backgroundColor: 'hsl(var(--card))', padding: '1rem' }}>
          {historyList.length === 0 ? (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>
              <Clock size={32} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
              <p style={{ fontSize: '0.875rem' }}>No hay títulos en el historial.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {historyList.map((h, i) => (
                <div 
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid hsl(var(--border))',
                    backgroundColor: 'hsl(var(--muted) / 0.3)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img 
                      src={h.poster || 'https://images.metahub.space/poster/small/default.png'} 
                      alt={h.name} 
                      style={{ width: '2.25rem', height: '3.25rem', borderRadius: 'var(--radius-sm)', objectFit: 'cover' }}
                    />
                    <div>
                      <h4 style={{ fontSize: '0.875rem', color: 'hsl(var(--foreground))', fontWeight: 600 }}>{h.name}</h4>
                      <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginTop: '2px' }}>
                        <span>Stream: {h.streamName || 'AIOStreams'}</span>
                        <span style={{ margin: '0 6px' }}>•</span>
                        <span>{new Date(h.watchedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => onSelectMedia({ id: h.id, name: h.name, type: h.type, poster: h.poster })}
                  >
                    Ver
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
