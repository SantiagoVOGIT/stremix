import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Trash2, 
  Bookmark, 
  Clock, 
  Download, 
  Upload, 
  Check, 
  Film, 
  Tv, 
  Sparkles,
  ExternalLink 
} from 'lucide-react';
import { 
  getContinueWatching, 
  removeProgress, 
  getFavorites, 
  getHistory,
  exportBackup,
  importBackup
} from '../services/storage';

export const LibraryView = ({ onSelectMedia, onResumePlayback }) => {
  const [activeTab, setActiveTab] = useState('continue'); // 'continue', 'favorites', 'history'
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
    <div className="section-wrapper" style={{ marginTop: '20px' }}>
      {/* Sub-nav Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className={`nav-tab-btn ${activeTab === 'continue' ? 'active' : ''}`}
            onClick={() => setActiveTab('continue')}
          >
            <Clock size={16} />
            <span>Continuar Viendo ({continueList.length})</span>
          </button>
          <button 
            className={`nav-tab-btn ${activeTab === 'favorites' ? 'active' : ''}`}
            onClick={() => setActiveTab('favorites')}
          >
            <Bookmark size={16} />
            <span>Favoritos ({favoritesList.length})</span>
          </button>
          <button 
            className={`nav-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <Sparkles size={16} />
            <span>Historial</span>
          </button>
        </div>

        {/* Backup Actions */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {importStatus && (
            <span style={{ fontSize: '0.85rem', color: 'var(--accent-emerald)', fontWeight: 600 }}>
              {importStatus}
            </span>
          )}
          <button className="icon-btn" onClick={handleExport} title="Exportar copia de seguridad (JSON)">
            <Download size={18} />
          </button>
          <label className="icon-btn" title="Importar copia de seguridad (JSON)" style={{ cursor: 'pointer' }}>
            <Upload size={18} />
            <input type="file" accept=".json" onChange={handleImportFile} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {/* CONTINUAR VIENDO TAB */}
      {activeTab === 'continue' && (
        <div>
          {continueList.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Clock size={48} color="var(--text-dim)" style={{ margin: '0 auto 16px' }} />
              <h3>No tienes reproducciones pendientes</h3>
              <p style={{ marginTop: '6px', fontSize: '0.9rem', color: 'var(--text-dim)' }}>
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
                      height: '6px',
                      background: 'rgba(0,0,0,0.6)',
                      zIndex: 3
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min(100, Math.max(5, item.percentage || 0))}%`,
                        background: 'var(--gradient-brand)'
                      }}></div>
                    </div>

                    <div className="card-overlay">
                      <div className="card-quick-actions">
                        <button 
                          className="quick-play-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onResumePlayback) onResumePlayback(item);
                            else onSelectMedia(item);
                          }}
                        >
                          <Play size={15} fill="#fff" />
                          <span>Reanudar</span>
                        </button>
                        <button 
                          className="quick-fav-btn" 
                          onClick={(e) => handleRemoveProgress(e, item.videoId || item.id)}
                          title="Quitar de continuar viendo"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="card-info">
                    <h3 className="card-title">{item.name}</h3>
                    <div className="card-meta-row">
                      <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
                        {item.episode ? `T${item.episode.season}:E${item.episode.number}` : 'Película'}
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
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Bookmark size={48} color="var(--text-dim)" style={{ margin: '0 auto 16px' }} />
              <h3>Tu lista de favoritos está vacía</h3>
              <p style={{ marginTop: '6px', fontSize: '0.9rem', color: 'var(--text-dim)' }}>
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
                      <button className="quick-play-btn" style={{ width: '100%' }}>
                        <Play size={15} fill="#fff" />
                        <span>Ver Ficha</span>
                      </button>
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
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-glass)', borderRadius: '16px', padding: '16px' }}>
          {historyList.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Clock size={36} color="var(--text-dim)" style={{ margin: '0 auto 12px' }} />
              <p>No hay títulos en el historial.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {historyList.map((h, i) => (
                <div 
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-glass)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <img 
                      src={h.poster || 'https://images.metahub.space/poster/small/default.png'} 
                      alt={h.name} 
                      style={{ width: '38px', height: '54px', borderRadius: '6px', objectFit: 'cover' }}
                    />
                    <div>
                      <h4 style={{ fontSize: '0.95rem', color: '#fff', fontWeight: 600 }}>{h.name}</h4>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                        <span>Stream: {h.streamName || 'AIOStreams'}</span>
                        <span style={{ margin: '0 6px' }}>•</span>
                        <span>{new Date(h.watchedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <button 
                    className="btn-secondary" 
                    style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                    onClick={() => onSelectMedia({ id: h.id, name: h.name, type: h.type, poster: h.poster })}
                  >
                    Ver
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
