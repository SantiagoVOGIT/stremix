import React, { useState, useEffect } from 'react';
import { 
  X, 
  Play, 
  Star, 
  Bookmark, 
  Check, 
  Film, 
  Tv, 
  Clock, 
  Sparkles, 
  Filter,
  ArrowUpDown,
  RefreshCw,
  Video
} from 'lucide-react';
import { fetchMeta, groupEpisodesBySeason } from '../services/cinemeta';
import { fetchAioStreams } from '../services/aiostream';
import { StreamCard } from './StreamCard';
import { isFavorite, toggleFavorite } from '../services/storage';

export const MediaModal = ({ 
  mediaItem, 
  onClose, 
  onPlayStream 
}) => {
  const [details, setDetails] = useState(mediaItem);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [favorite, setFavorite] = useState(isFavorite(mediaItem.id));
  
  // Series Season & Episode State
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [seasonsData, setSeasonsData] = useState({});

  // Streams State
  const [streams, setStreams] = useState([]);
  const [loadingStreams, setLoadingStreams] = useState(true);
  const [streamSource, setStreamSource] = useState('');
  const [qualityFilter, setQualityFilter] = useState('all');
  const [sortFilter, setSortFilter] = useState('quality');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Load detailed metadata from Cinemeta
  useEffect(() => {
    let isMounted = true;
    setLoadingMeta(true);

    const loadMeta = async () => {
      try {
        const fullMeta = await fetchMeta(mediaItem.type || 'movie', mediaItem.id);
        if (isMounted && fullMeta) {
          setDetails((prev) => ({ ...prev, ...fullMeta }));

          if (fullMeta.type === 'series' && fullMeta.videos && fullMeta.videos.length > 0) {
            const grouped = groupEpisodesBySeason(fullMeta.videos);
            setSeasonsData(grouped);
            
            // Default to season 1 or first available season
            const seasonKeys = Object.keys(grouped).map(Number).sort((a,b) => a - b);
            const firstSeason = seasonKeys.find(s => s > 0) || seasonKeys[0] || 1;
            setSelectedSeason(firstSeason);
            
            if (grouped[firstSeason] && grouped[firstSeason].length > 0) {
              setSelectedEpisode(grouped[firstSeason][0]);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching detail meta:', err);
      } finally {
        if (isMounted) setLoadingMeta(false);
      }
    };

    loadMeta();
    return () => { isMounted = false; };
  }, [mediaItem]);

  // Determine current videoId for stream querying
  const currentVideoId = details.type === 'series' && selectedEpisode
    ? selectedEpisode.id || `${details.id}:${selectedEpisode.season}:${selectedEpisode.number || selectedEpisode.episode}`
    : details.id;

  // Load AIOStreams whenever currentVideoId changes
  useEffect(() => {
    let isMounted = true;
    setLoadingStreams(true);

    const loadStreams = async () => {
      try {
        const result = await fetchAioStreams(details.type || 'movie', currentVideoId, details);
        if (isMounted) {
          setStreams(result.streams || []);
          setStreamSource(result.source || 'AIOStreams');
        }
      } catch (err) {
        console.error('Error loading streams:', err);
      } finally {
        if (isMounted) setLoadingStreams(false);
      }
    };

    if (currentVideoId) {
      loadStreams();
    }

    return () => { isMounted = false; };
  }, [currentVideoId, details.id]);

  const handleToggleFav = () => {
    const newState = toggleFavorite(details);
    setFavorite(newState);
  };

  const handleSelectSeason = (seasonNum) => {
    setSelectedSeason(seasonNum);
    const eps = seasonsData[seasonNum];
    if (eps && eps.length > 0) {
      setSelectedEpisode(eps[0]);
    }
  };

  // Filter and sort streams
  let displayedStreams = [...streams];
  if (qualityFilter !== 'all') {
    displayedStreams = displayedStreams.filter(s => s.resolution === qualityFilter);
  }
  if (sortFilter === 'seeders') {
    displayedStreams.sort((a, b) => (b.seeders || 0) - (a.seeders || 0));
  } else if (sortFilter === 'size') {
    displayedStreams.sort((a, b) => (b.sizeBytes || 0) - (a.sizeBytes || 0));
  } else {
    displayedStreams.sort((a, b) => b.qualityScore - a.qualityScore);
  }

  const backdrop = details.background || details.poster;
  const rating = details.imdbRating || (details.popularity ? (details.popularity > 10 ? '7.9' : details.popularity.toFixed(1)) : '8.2');
  const genres = details.genres || details.genre || [];
  const cast = details.cast || [];
  const directors = details.director || [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button className="modal-close-btn" onClick={onClose}>
          <X size={20} />
        </button>

        {/* Hero Cover Banner */}
        <div className="modal-hero-cover">
          {backdrop && (
            <img 
              src={backdrop} 
              alt={details.name} 
              className="modal-backdrop-img"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          )}
          <div className="modal-hero-gradient"></div>

          <div className="modal-hero-content">
            <img 
              src={details.poster || 'https://images.metahub.space/poster/medium/default.png'} 
              alt={details.name} 
              className="modal-poster-thumb"
            />

            <div className="modal-title-area">
              <div className="modal-meta-row">
                <span className="hero-type-badge">
                  {details.type === 'series' ? 'Serie' : 'Película'}
                </span>
                {rating && (
                  <span className="hero-rating-badge">
                    <Star size={13} fill="#fbbf24" /> {rating} IMDb
                  </span>
                )}
                <span>{details.year || details.releaseInfo || '2024'}</span>
                {details.runtime && <span>• {details.runtime}</span>}
              </div>

              <h2 className="modal-title">{details.name}</h2>

              {genres.length > 0 && (
                <div className="hero-genres">
                  {genres.map((g, i) => (
                    <span key={i} className="hero-genre-tag">{g}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {/* Quick Actions Row */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button 
              className="btn-primary" 
              onClick={() => {
                if (streams.length > 0) {
                  onPlayStream(streams[0], details, selectedEpisode);
                }
              }}
              disabled={loadingStreams || streams.length === 0}
            >
              <Play size={18} fill="#fff" />
              <span>{streams.length > 0 ? 'Reproducir Mejor Opción' : 'Buscando Stream...'}</span>
            </button>

            <button className="btn-secondary" onClick={handleToggleFav}>
              {favorite ? <Check size={18} color="var(--accent-emerald)" /> : <Bookmark size={18} />}
              <span>{favorite ? 'Guardado en Biblioteca' : 'Guardar en Favoritos'}</span>
            </button>
          </div>

          {/* Synopsis */}
          {details.description && (
            <div>
              <h3 className="modal-section-title">Sinopsis</h3>
              <p className="modal-synopsis">{details.description}</p>
            </div>
          )}

          {/* Cast & Crew */}
          {(cast.length > 0 || directors.length > 0) && (
            <div>
              <h3 className="modal-section-title">Reparto y Dirección</h3>
              <div className="cast-chips">
                {directors.map((d, i) => (
                  <span key={`d-${i}`} className="cast-chip" style={{ borderColor: 'var(--accent-violet)', color: '#fff' }}>
                    🎬 Director: {d}
                  </span>
                ))}
                {cast.slice(0, 8).map((actor, i) => (
                  <span key={`a-${i}`} className="cast-chip">
                    👤 {actor}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Series Season & Episode Selector */}
          {details.type === 'series' && Object.keys(seasonsData).length > 0 && (
            <div>
              <h3 className="modal-section-title">
                <Tv size={18} />
                <span>Episodios</span>
              </h3>

              {/* Season Tabs */}
              <div className="season-selector">
                {Object.keys(seasonsData)
                  .map(Number)
                  .sort((a,b) => a - b)
                  .map((s) => (
                    <button
                      key={s}
                      className={`season-btn ${selectedSeason === s ? 'active' : ''}`}
                      onClick={() => handleSelectSeason(s)}
                    >
                      {s === 0 ? 'Especiales' : `Temporada ${s}`}
                    </button>
                  ))}
              </div>

              {/* Episode Grid */}
              <div className="episodes-grid">
                {(seasonsData[selectedSeason] || []).map((ep) => {
                  const isCurrent = selectedEpisode && (selectedEpisode.id === ep.id);
                  const epNum = ep.number || ep.episode || 1;
                  return (
                    <div 
                      key={ep.id || epNum}
                      className={`episode-card ${isCurrent ? 'active' : ''}`}
                      onClick={() => setSelectedEpisode(ep)}
                    >
                      <div className="episode-thumb-wrap">
                        {ep.thumbnail ? (
                          <img 
                            src={ep.thumbnail} 
                            alt={ep.name} 
                            className="episode-thumb"
                            loading="lazy"
                            onError={(e) => { e.target.src = details.background || details.poster; }}
                          />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
                            <Film size={28} />
                          </div>
                        )}
                        {isCurrent && (
                          <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'var(--accent-violet)', color: '#fff', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Play size={12} fill="#fff" />
                          </div>
                        )}
                      </div>

                      <div className="episode-card-body">
                        <span className="episode-number">T{selectedSeason} : E{epNum}</span>
                        <h4 className="episode-name">{ep.name || `Episodio ${epNum}`}</h4>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Streams Section */}
          <div className="streams-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="modal-section-title" style={{ margin: 0 }}>
                <Sparkles size={18} color="var(--accent-violet)" />
                <span>
                  Enlaces AIOStreams
                  {selectedEpisode ? ` (T${selectedSeason} E${selectedEpisode.number || selectedEpisode.episode})` : ''}
                </span>
                <span className="section-count-badge">
                  {loadingStreams ? 'Buscando...' : `${displayedStreams.length} disponibles`}
                </span>
              </h3>

              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                Fuente: {streamSource}
              </span>
            </div>

            {/* Filter and Sorting Bar */}
            <div className="stream-filter-bar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Filter size={15} color="var(--text-dim)" />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Calidad:</span>
                <div className="stream-quality-pills">
                  {['all', '4K', '1080p', '720p'].map((q) => (
                    <button
                      key={q}
                      className={`stream-pill ${qualityFilter === q ? 'active' : ''}`}
                      onClick={() => setQualityFilter(q)}
                    >
                      {q === 'all' ? 'Todas' : q}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ArrowUpDown size={15} color="var(--text-dim)" />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Ordenar por:</span>
                <select 
                  value={sortFilter} 
                  onChange={(e) => setSortFilter(e.target.value)}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid var(--border-glass)',
                    color: '#fff',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '0.82rem',
                    outline: 'none'
                  }}
                >
                  <option value="quality" style={{ background: '#121620' }}>Mejor Calidad</option>
                  <option value="seeders" style={{ background: '#121620' }}>Más Semillas</option>
                  <option value="size" style={{ background: '#121620' }}>Tamaño de Archivo</option>
                </select>
              </div>
            </div>

            {/* Stream List */}
            {loadingStreams ? (
              <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw size={28} className="spin" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
                <p>Consultando API de AIOStreams y resolviendo torrents/debrid...</p>
              </div>
            ) : displayedStreams.length > 0 ? (
              displayedStreams.map((s) => (
                <StreamCard 
                  key={s.id} 
                  stream={s} 
                  onPlay={() => onPlayStream(s, details, selectedEpisode)}
                />
              ))
            ) : (
              <div style={{ padding: '30px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
                <Video size={32} color="var(--text-dim)" style={{ marginBottom: '8px' }} />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                  No se encontraron streams con los filtros actuales.
                </p>
                <button 
                  className="btn-secondary" 
                  style={{ margin: '14px auto 0', padding: '8px 18px', fontSize: '0.85rem' }}
                  onClick={() => setQualityFilter('all')}
                >
                  Restablecer Filtros
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
