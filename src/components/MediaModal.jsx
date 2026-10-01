import React, { useState, useEffect, useMemo } from 'react';
import { 
  Play, 
  Star, 
  Bookmark, 
  Check, 
  Tv, 
  Film, 
  Sparkles, 
  ArrowUpDown,
  RefreshCw,
  Video,
  ExternalLink,
  Search,
  AlertCircle,
  Settings,
  X,
  Clock,
  Calendar,
  Globe,
  Award,
  Clapperboard,
  User
} from 'lucide-react';
import { fetchMeta, groupEpisodesBySeason } from '../services/cinemeta';
import { fetchAioStreams } from '../services/aiostream';
import { StreamCard } from './StreamCard';
import { isFavorite, toggleFavorite, getSettings, getProgress } from '../services/storage';
import { launchExternalPlayer } from '../services/playerUtils';
import { Dialog, DialogContent } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';

const YoutubeIcon = ({ size = 14, color = "#ef4444" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
    <path d="m10 15 5-3-5-3z" fill={color} />
  </svg>
);

export const MediaModal = ({ 
  mediaItem, 
  onClose, 
  onPlayStream,
  onOpenSettings
}) => {
  const [details, setDetails] = useState(mediaItem);
  const [favorite, setFavorite] = useState(isFavorite(mediaItem.id));
  
  // Series Season & Episode State - Initialize from mediaItem if passed
  const initialEp = mediaItem.episode || mediaItem.currentEpisode || null;
  const [selectedSeason, setSelectedSeason] = useState(initialEp?.season || 1);
  const [selectedEpisode, setSelectedEpisode] = useState(initialEp);
  const [seasonsData, setSeasonsData] = useState({});

  // Streams State
  const [streams, setStreams] = useState([]);
  const [loadingStreams, setLoadingStreams] = useState(true);
  const [streamSource, setStreamSource] = useState('');
  const [requiresConfig, setRequiresConfig] = useState(false);
  
  const settings = getSettings();

  // Link Options Filters
  const [qualityFilter, setQualityFilter] = useState(settings.preferredResolution || 'all');
  const [webReadyOnly, setWebReadyOnly] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const [streamSearchQuery, setStreamSearchQuery] = useState('');
  const [sortFilter, setSortFilter] = useState(settings.sortBy || 'quality');
  
  const [activeModalTab, setActiveModalTab] = useState('streams');
  const [externalMsg, setExternalMsg] = useState('');

  // Load detailed metadata from Cinemeta
  useEffect(() => {
    let isMounted = true;

    const loadMeta = async () => {
      try {
        const fullMeta = await fetchMeta(mediaItem.type || 'movie', mediaItem.id);
        if (isMounted && fullMeta) {
          setDetails((prev) => ({ ...prev, ...fullMeta }));

          if (fullMeta.type === 'series' && fullMeta.videos && fullMeta.videos.length > 0) {
            const grouped = groupEpisodesBySeason(fullMeta.videos);
            setSeasonsData(grouped);
            
            // If already had an initial episode, match it
            if (initialEp) {
              const matchedEp = fullMeta.videos.find(v => 
                v.id === initialEp.id || 
                (v.season === initialEp.season && (v.number || v.episode) === (initialEp.number || initialEp.episode))
              );
              if (matchedEp) {
                setSelectedSeason(matchedEp.season || 1);
                setSelectedEpisode(matchedEp);
                return;
              }
            }

            const seasonKeys = Object.keys(grouped).map(Number).sort((a,b) => a - b);
            const firstSeason = seasonKeys.find(s => s > 0) || seasonKeys[0] || 1;
            setSelectedSeason(firstSeason);
            
            if (grouped[firstSeason] && grouped[firstSeason].length > 0) {
              setSelectedEpisode(grouped[firstSeason][0]);
            }
          } else if (fullMeta.type === 'series') {
            const fallbackEp = {
              season: 1,
              number: 1,
              episode: 1,
              id: `${fullMeta.id || mediaItem.id}:1:1`,
              name: 'Episodio 1'
            };
            setSeasonsData({ 1: [fallbackEp] });
            setSelectedSeason(1);
            setSelectedEpisode(fallbackEp);
          }
        }
      } catch (err) {
        console.error('Error fetching detail meta:', err);
      }
    };

    loadMeta();
    return () => { isMounted = false; };
  }, [mediaItem, initialEp]);

  // Determine current videoId for stream querying safely
  const isSeries = details.type === 'series';
  const currentVideoId = isSeries
    ? (selectedEpisode ? (selectedEpisode.id || `${details.id}:${selectedEpisode.season}:${selectedEpisode.number || selectedEpisode.episode}`) : null)
    : details.id;

  // Load AIOStreams whenever currentVideoId changes
  useEffect(() => {
    // If it's a series and episode is not yet selected, don't trigger invalid root series stream request
    if (isSeries && !currentVideoId) return;

    let isMounted = true;
    setLoadingStreams(true);
    setRequiresConfig(false);

    const loadStreams = async () => {
      try {
        const result = await fetchAioStreams(details.type || 'movie', currentVideoId, details);
        if (isMounted) {
          setStreams(result.streams || []);
          setStreamSource(result.source || 'AIOStreams');
          setRequiresConfig(Boolean(result.requiresConfig));
        }
      } catch (err) {
        console.error('Error loading streams:', err);
      } finally {
        if (isMounted) setLoadingStreams(false);
      }
    };

    loadStreams();
    return () => { isMounted = false; };
  }, [currentVideoId, details.id, details.type, isSeries]);

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

  // Extract unique languages from current streams
  const availableLanguages = useMemo(() => {
    const langs = new Map();
    streams.forEach(s => {
      if (s.language && s.language.code) {
        langs.set(s.language.code, s.language);
      }
    });
    return Array.from(langs.values());
  }, [streams]);

  // Stream counts
  const count4k = useMemo(() => streams.filter(s => s.resolution === '4K').length, [streams]);
  const count1080p = useMemo(() => streams.filter(s => s.resolution === '1080p').length, [streams]);
  const count720p = useMemo(() => streams.filter(s => s.resolution === '720p').length, [streams]);
  const countWebReady = useMemo(() => streams.filter(s => s.isWebReady).length, [streams]);

  // Filter and sort streams
  const displayedStreams = useMemo(() => {
    let list = [...streams];

    // 1. Quality filter
    if (qualityFilter !== 'all') {
      list = list.filter(s => s.resolution === qualityFilter);
    }

    // 2. Web ready filter
    if (webReadyOnly) {
      list = list.filter(s => s.isWebReady);
    }

    // 3. Language filter
    if (selectedLanguage !== 'all') {
      list = list.filter(s => s.language?.code === selectedLanguage);
    }

    // 4. Live text search inside stream
    if (streamSearchQuery.trim()) {
      const q = streamSearchQuery.toLowerCase();
      list = list.filter(s => 
        (s.mainTitle && s.mainTitle.toLowerCase().includes(q)) ||
        (s.rawTitle && s.rawTitle.toLowerCase().includes(q)) ||
        (s.provider && s.provider.toLowerCase().includes(q)) ||
        (s.codec && s.codec.toLowerCase().includes(q)) ||
        (s.sourceRelease && s.sourceRelease.toLowerCase().includes(q)) ||
        (s.language && s.language.label.toLowerCase().includes(q)) ||
        (s.audio && s.audio.toLowerCase().includes(q))
      );
    }

    // 5. Sorting
    if (sortFilter === 'seeders') {
      list.sort((a, b) => (b.seeders || 0) - (a.seeders || 0));
    } else if (sortFilter === 'size') {
      list.sort((a, b) => (b.sizeBytes || 0) - (a.sizeBytes || 0));
    } else if (sortFilter === 'spanish') {
      list.sort((a, b) => {
        const aEsp = a.language && (a.language.code === 'lat' || a.language.code === 'spa' || a.language.code === 'multi') ? 1 : 0;
        const bEsp = b.language && (b.language.code === 'lat' || b.language.code === 'spa' || b.language.code === 'multi') ? 1 : 0;
        if (bEsp !== aEsp) return bEsp - aEsp;
        return b.qualityScore - a.qualityScore;
      });
    } else {
      list.sort((a, b) => b.qualityScore - a.qualityScore);
    }

    return list;
  }, [streams, qualityFilter, webReadyOnly, selectedLanguage, streamSearchQuery, sortFilter]);

  const handleResetFilters = () => {
    setQualityFilter('all');
    setWebReadyOnly(false);
    setSelectedLanguage('all');
    setStreamSearchQuery('');
    setSortFilter('quality');
  };

  const handlePlayBestOption = () => {
    // Prefer best web-ready stream if available, otherwise first stream
    const bestWeb = displayedStreams.find(s => s.isWebReady);
    const targetStream = bestWeb || displayedStreams[0] || streams[0];
    if (targetStream) {
      onPlayStream(targetStream, details, selectedEpisode, streams, details.videos || []);
    }
  };

  const handlePlayTrailer = () => {
    const trailerStream = streams.find(s => s.formatType === 'youtube' || s.ytId);
    if (trailerStream) {
      onPlayStream(trailerStream, details, null, streams, details.videos || []);
    } else if (details.trailerStreams && details.trailerStreams.length > 0) {
      const t = details.trailerStreams[0];
      const trailerObj = {
        id: `trailer-${t.ytId}`,
        mainTitle: `Tráiler Oficial de ${details.name}`,
        url: `https://www.youtube.com/watch?v=${t.ytId}`,
        ytId: t.ytId,
        formatType: 'youtube',
        isWebReady: true,
        resolution: '1080p',
        containerTag: 'YOUTUBE'
      };
      onPlayStream(trailerObj, details, null, streams, details.videos || []);
    }
  };

  const backdrop = details.background || details.poster;
  const rating = details.imdbRating || (details.popularity ? (details.popularity > 10 ? '7.9' : details.popularity.toFixed(1)) : '8.2');
  const genres = details.genres || details.genre || [];

  // Parse Directors, Writers, and Cast
  const directors = Array.isArray(details.director) ? details.director : (details.director ? [details.director] : []);
  const writers = Array.isArray(details.writer) ? details.writer : (details.writer ? [details.writer] : []);
  const castList = useMemo(() => {
    if (!details.cast) return [];
    if (Array.isArray(details.cast)) {
      return details.cast.map((item, idx) => {
        if (typeof item === 'string') {
          // Check if formatted like "Actor Name (Character Name)"
          const match = item.match(/^(.*?)\s*\((.*?)\)$/);
          if (match) {
            return { id: idx, name: match[1].trim(), character: match[2].trim() };
          }
          return { id: idx, name: item.trim(), character: '' };
        }
        return { id: idx, name: item.name || '', character: item.character || '' };
      });
    }
    return [];
  }, [details.cast]);

  const extPlayerName = (settings.externalPlayer || 'vlc').toUpperCase();

  // Helper for Actor Initials Avatar color
  const getAvatarGradient = (name = '') => {
    const colors = [
      'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
      'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
      'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
      'linear-gradient(135deg, #10b981 0%, #047857 100%)',
      'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)',
      'linear-gradient(135deg, #06b6d4 0%, #0e7490 100%)'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const getInitials = (name = '') => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return (name[0] || 'A').toUpperCase();
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="modal-sheet" 
        style={{ 
          maxWidth: '56rem', 
          width: '94vw',
          maxHeight: '92vh',
          padding: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'hsl(var(--card))'
        }}
      >
        {/* Modal Hero / Backdrop Header */}
        <div style={{
          position: 'relative',
          minHeight: '16rem',
          width: '100%',
          overflow: 'hidden',
          backgroundColor: '#09090b',
          flexShrink: 0
        }}>
          {backdrop && (
            <img 
              src={backdrop} 
              alt={details.name} 
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center 25%',
                opacity: 0.38,
                filter: 'saturate(1.2) contrast(1.1)'
              }}
            />
          )}

          {/* Gradients */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, hsl(var(--card)) 0%, rgba(9,9,11,0.85) 60%, rgba(9,9,11,0.4) 100%)'
          }} />
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to right, hsl(var(--card)) 0%, transparent 60%)'
          }} />

          {/* Close Button */}
          <button 
            onClick={onClose}
            className="modal-close-btn"
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              background: 'rgba(0,0,0,0.6)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '50%',
              width: '2.25rem',
              height: '2.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              cursor: 'pointer',
              zIndex: 20,
              backdropFilter: 'blur(8px)',
              transition: 'all 0.2s'
            }}
          >
            <X size={16} />
          </button>

          {/* Hero Content inside Header */}
          <div style={{
            position: 'relative',
            zIndex: 10,
            padding: '1.75rem 2rem 1.25rem',
            display: 'flex',
            gap: '1.5rem',
            alignItems: 'flex-end',
            minHeight: '16rem'
          }}>
            {/* Poster Thumbnail */}
            {details.poster && (
              <img 
                src={details.poster} 
                alt={details.name}
                style={{
                  width: '6.5rem',
                  height: '9.5rem',
                  objectFit: 'cover',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  boxShadow: '0 12px 30px rgba(0,0,0,0.8)',
                  flexShrink: 0
                }}
              />
            )}

            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {/* Type and Rating Badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <Badge variant="default" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {details.type === 'series' ? 'Serie TV' : 'Película'}
                </Badge>

                {rating && (
                  <Badge variant="outline" style={{ color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.4)', backgroundColor: 'rgba(245, 158, 11, 0.08)' }}>
                    <Star size={12} fill="#f59e0b" style={{ marginRight: '4px' }} />
                    <span>{rating} IMDb</span>
                  </Badge>
                )}

                {details.year && (
                  <span style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
                    {details.year}
                  </span>
                )}

                {details.runtime && (
                  <span style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} /> {details.runtime}
                  </span>
                )}

                {details.country && (
                  <span style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Globe size={12} /> {details.country}
                  </span>
                )}
              </div>

              {/* Title */}
              <h2 style={{
                fontSize: '1.75rem',
                fontWeight: 800,
                color: '#fff',
                letterSpacing: '-0.025em',
                lineHeight: 1.2
              }}>
                {details.name}
              </h2>

              {/* Genres Pills */}
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {genres.slice(0, 4).map((g, idx) => (
                  <span 
                    key={idx}
                    style={{
                      fontSize: '0.72rem',
                      color: 'rgba(255,255,255,0.75)',
                      backgroundColor: 'rgba(255,255,255,0.08)',
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      border: '1px solid rgba(255,255,255,0.1)'
                    }}
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Action Bar (Reproducir mejor opción, VLC, Favoritos) */}
        <div style={{
          padding: '0.75rem 2rem',
          backgroundColor: 'hsl(var(--muted) / 0.3)',
          borderBottom: '1px solid hsl(var(--border))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Main Play Action */}
            <Button 
              variant="default" 
              onClick={handlePlayBestOption}
              disabled={streams.length === 0}
              style={{ fontWeight: 600, gap: '6px' }}
            >
              <Play size={15} fill="currentColor" />
              <span>
                {selectedEpisode 
                  ? `Reproducir T${selectedSeason} E${selectedEpisode.number || selectedEpisode.episode}` 
                  : 'Reproducir Mejor Stream'}
              </span>
            </Button>

            {/* External Player Direct Launch */}
            {streams.length > 0 && streams[0].url && (
              <Button 
                variant="outline"
                onClick={() => {
                  const res = launchExternalPlayer(streams[0].url, `${details.name} - ${streams[0].resolution}`, settings.externalPlayer || 'vlc');
                  setExternalMsg(res.message);
                  setTimeout(() => setExternalMsg(''), 4500);
                }}
                title={`Abrir el mejor stream en ${extPlayerName} (descarga lista .m3u y copia URL)`}
              >
                <ExternalLink size={14} />
                <span>Abrir en {extPlayerName}</span>
              </Button>
            )}

            {/* Trailer preview button */}
            {(details.trailerStreams?.length > 0 || streams.some(s => s.formatType === 'youtube')) && (
              <Button 
                variant="outline" 
                onClick={handlePlayTrailer}
                title="Ver tráiler oficial en alta definición"
              >
                <YoutubeIcon size={14} />
                <span>Ver Tráiler</span>
              </Button>
            )}

            {/* Favorite toggle */}
            <Button variant="secondary" onClick={handleToggleFav}>
              {favorite ? <Check size={15} color="#10b981" /> : <Bookmark size={15} />}
              <span>{favorite ? 'Guardado' : 'Guardar'}</span>
            </Button>
          </div>

          {externalMsg && (
            <span style={{ 
              fontSize: '0.75rem', 
              color: '#10b981', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '5px', 
              background: 'rgba(16, 185, 129, 0.1)', 
              padding: '3px 10px', 
              borderRadius: 'var(--radius-sm)', 
              border: '1px solid rgba(16, 185, 129, 0.3)' 
            }}>
              <Check size={13} /> {externalMsg}
            </span>
          )}
        </div>

        {/* Modal Tabs Body: Streams / Episodes / Info */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 2rem 2rem' }}>
          <Tabs value={activeModalTab} onValueChange={setActiveModalTab}>
            <TabsList style={{ width: '100%', justifyContent: 'flex-start', marginBottom: '1.25rem' }}>
              <TabsTrigger value="streams">
                <Sparkles size={14} />
                <span>Enlaces AIOStreams ({streams.length})</span>
              </TabsTrigger>
              {isSeries && (
                <TabsTrigger value="episodes">
                  <Tv size={14} />
                  <span>Episodios ({details.videos?.length || 0})</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="info">
                <Film size={14} />
                <span>Sinopsis & Reparto</span>
              </TabsTrigger>
            </TabsList>

            {/* ============================================================= */}
            {/* TAB 1: ENLACES AIOSTREAMS (REMASTERED CON SHADCN)             */}
            {/* ============================================================= */}
            <TabsContent value="streams">
              <div className="streams-container">
                {/* Configuration Required Notice */}
                {requiresConfig && (
                  <Card style={{ backgroundColor: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
                    <CardContent style={{ padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <AlertCircle size={18} color="#f59e0b" style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: '0.8125rem', color: 'hsl(var(--foreground))' }}>
                          Tu instancia de AIOStreams requiere configuración de proveedores/Debrid. Se muestran streams garantizados compatibles.
                        </span>
                      </div>
                      {onOpenSettings && (
                        <Button variant="outline" size="sm" onClick={onOpenSettings} style={{ borderColor: 'rgba(245, 158, 11, 0.5)', height: '1.85rem' }}>
                          <Settings size={12} /> Configurar AIOStreams
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Filter and Sorting Control Deck (Card based) */}
                <Card style={{ backgroundColor: 'hsl(var(--muted) / 0.35)' }}>
                  <CardContent style={{ padding: '0.875rem 1rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {/* Top Row: Search Input + Sorting */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, minWidth: '15rem' }}>
                        <Search size={14} color="hsl(var(--muted-foreground))" style={{ position: 'absolute', left: '10px', pointerEvents: 'none' }} />
                        <input 
                          type="text"
                          placeholder="Filtrar por audio, códec o fuente (ej: Latino, x265, TrueHD, Torrentio)..."
                          value={streamSearchQuery}
                          onChange={(e) => setStreamSearchQuery(e.target.value)}
                          style={{
                            width: '100%',
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: 'var(--radius-sm)',
                            padding: '6px 28px 6px 32px',
                            fontSize: '0.8125rem',
                            color: 'hsl(var(--foreground))',
                            outline: 'none'
                          }}
                        />
                        {streamSearchQuery && (
                          <button
                            onClick={() => setStreamSearchQuery('')}
                            style={{
                              position: 'absolute',
                              right: '8px',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'hsl(var(--muted-foreground))'
                            }}
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ArrowUpDown size={13} color="hsl(var(--muted-foreground))" />
                        <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>Ordenar:</span>
                        <select 
                          value={sortFilter} 
                          onChange={(e) => setSortFilter(e.target.value)}
                          style={{
                            background: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            color: 'hsl(var(--foreground))',
                            borderRadius: 'var(--radius-sm)',
                            padding: '5px 10px',
                            fontSize: '0.75rem',
                            outline: 'none'
                          }}
                        >
                          <option value="quality" style={{ background: '#09090b' }}>Mejor Calidad</option>
                          <option value="spanish" style={{ background: '#09090b' }}>Audio Español Primero</option>
                          <option value="seeders" style={{ background: '#09090b' }}>Más Semillas</option>
                          <option value="size" style={{ background: '#09090b' }}>Tamaño</option>
                        </select>
                      </div>
                    </div>

                    {/* Bottom Row: Quality Badges + Web Ready + Language Pills */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                      {/* Quality Buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginRight: '4px' }}>Resolución:</span>
                        <Button
                          variant={qualityFilter === 'all' ? 'default' : 'ghost'}
                          size="sm"
                          style={{ height: '1.75rem', padding: '0 0.6rem', fontSize: '0.72rem' }}
                          onClick={() => setQualityFilter('all')}
                        >
                          Todas ({streams.length})
                        </Button>
                        {count4k > 0 && (
                          <Button
                            variant={qualityFilter === '4K' ? 'default' : 'ghost'}
                            size="sm"
                            style={{ height: '1.75rem', padding: '0 0.6rem', fontSize: '0.72rem', color: qualityFilter === '4K' ? undefined : '#f59e0b' }}
                            onClick={() => setQualityFilter('4K')}
                          >
                            4K ({count4k})
                          </Button>
                        )}
                        {count1080p > 0 && (
                          <Button
                            variant={qualityFilter === '1080p' ? 'default' : 'ghost'}
                            size="sm"
                            style={{ height: '1.75rem', padding: '0 0.6rem', fontSize: '0.72rem', color: qualityFilter === '1080p' ? undefined : '#38bdf8' }}
                            onClick={() => setQualityFilter('1080p')}
                          >
                            1080p ({count1080p})
                          </Button>
                        )}
                        {count720p > 0 && (
                          <Button
                            variant={qualityFilter === '720p' ? 'default' : 'ghost'}
                            size="sm"
                            style={{ height: '1.75rem', padding: '0 0.6rem', fontSize: '0.72rem' }}
                            onClick={() => setQualityFilter('720p')}
                          >
                            720p ({count720p})
                          </Button>
                        )}
                      </div>

                      {/* Web Ready Only + Language buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                        <Button
                          variant={webReadyOnly ? 'default' : 'outline'}
                          size="sm"
                          style={{ 
                            height: '1.75rem', 
                            padding: '0 0.65rem', 
                            fontSize: '0.72rem', 
                            color: webReadyOnly ? undefined : '#10b981', 
                            borderColor: 'rgba(16, 185, 129, 0.4)' 
                          }}
                          onClick={() => setWebReadyOnly(!webReadyOnly)}
                          title="Mostrar únicamente streams con códec compatible nativamente con el navegador"
                        >
                          <Check size={11} style={{ marginRight: '4px' }} /> Solo Web ({countWebReady})
                        </Button>

                        {availableLanguages.map((lang) => (
                          <Button
                            key={lang.code}
                            variant={selectedLanguage === lang.code ? 'default' : 'outline'}
                            size="sm"
                            style={{ height: '1.75rem', padding: '0 0.6rem', fontSize: '0.72rem' }}
                            onClick={() => setSelectedLanguage(selectedLanguage === lang.code ? 'all' : lang.code)}
                            title={`Filtrar por ${lang.label}`}
                          >
                            <span>{lang.flag}</span>
                            <span style={{ marginLeft: '4px' }}>{lang.label.split(' ')[0]}</span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Status Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', padding: '0 4px' }}>
                  <span>
                    {selectedEpisode ? `Episodio Seleccionado: T${selectedSeason} E${selectedEpisode.number || selectedEpisode.episode} - ${selectedEpisode.name || ''}` : 'Película Completa'}
                  </span>
                  <span>Fuente: {streamSource} • Mostrando {displayedStreams.length} de {streams.length} streams</span>
                </div>

                {/* Streams List */}
                {loadingStreams ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>
                    <RefreshCw size={26} className="spin" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
                    <p style={{ fontSize: '0.875rem' }}>Consultando tu instancia de AIOStreams...</p>
                  </div>
                ) : displayedStreams.length > 0 ? (
                  displayedStreams.map((s) => (
                    <StreamCard 
                      key={s.id} 
                      stream={s} 
                      onPlay={() => onPlayStream(s, details, selectedEpisode, streams, details.videos || [])}
                    />
                  ))
                ) : (
                  <Card style={{ backgroundColor: 'hsl(var(--muted) / 0.2)', textAlign: 'center', padding: '2rem' }}>
                    <Video size={32} color="hsl(var(--muted-foreground))" style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                    <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', marginBottom: '12px' }}>
                      No se encontraron streams disponibles con los filtros actuales seleccionados.
                    </p>
                    <Button variant="outline" size="sm" onClick={handleResetFilters} style={{ margin: '0 auto' }}>
                      Restablecer Filtros
                    </Button>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* ============================================================= */}
            {/* TAB 2: EPISODIOS (REMASTERED CON SHADCN)                      */}
            {/* ============================================================= */}
            {isSeries && (
              <TabsContent value="episodes">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Season Navigation Bar */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    gap: '12px',
                    flexWrap: 'wrap',
                    backgroundColor: 'hsl(var(--muted) / 0.3)',
                    padding: '0.625rem 0.875rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid hsl(var(--border))'
                  }}>
                    <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '2px 0' }}>
                      {Object.keys(seasonsData).map(Number).sort((a,b) => a - b).map((s) => {
                        const epCount = seasonsData[s]?.length || 0;
                        return (
                          <Button
                            key={s}
                            variant={selectedSeason === s ? 'default' : 'outline'}
                            size="sm"
                            style={{ fontWeight: 600, fontSize: '0.78rem' }}
                            onClick={() => handleSelectSeason(s)}
                          >
                            <span>{s === 0 ? 'Especiales' : `Temporada ${s}`}</span>
                            <Badge variant={selectedSeason === s ? 'secondary' : 'outline'} style={{ marginLeft: '6px', fontSize: '0.68rem', padding: '0 5px' }}>
                              {epCount}
                            </Badge>
                          </Button>
                        );
                      })}
                    </div>

                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                      {(seasonsData[selectedSeason] || []).length} episodios en Temporada {selectedSeason}
                    </span>
                  </div>

                  {/* Episodes Grid with shadcn Cards */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(16rem, 1fr))',
                    gap: '14px'
                  }}>
                    {(seasonsData[selectedSeason] || []).map((ep) => {
                      const isCurrent = selectedEpisode && (
                        selectedEpisode.id === ep.id || 
                        (selectedEpisode.season === ep.season && (selectedEpisode.number || selectedEpisode.episode) === (ep.number || ep.episode))
                      );
                      const epNum = ep.number || ep.episode || 1;
                      const epVideoId = ep.id || `${details.id}:${ep.season}:${epNum}`;
                      const progressInfo = getProgress(epVideoId);
                      const isWatched = progressInfo && progressInfo.percentage > 85;
                      const hasProgress = progressInfo && progressInfo.percentage > 5 && !isWatched;

                      // Air date formatting
                      let airDateFormatted = '';
                      if (ep.released) {
                        try {
                          const d = new Date(ep.released);
                          airDateFormatted = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
                        } catch {}
                      }

                      return (
                        <Card 
                          key={ep.id || `${selectedSeason}-${epNum}`}
                          className={`episode-card ${isCurrent ? 'selected-episode' : ''}`}
                          onClick={() => {
                            setSelectedEpisode(ep);
                            setActiveModalTab('streams');
                          }}
                          style={{
                            border: `1px solid ${isCurrent ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
                            boxShadow: isCurrent ? '0 0 0 1px hsl(var(--primary)), 0 8px 20px rgba(0,0,0,0.5)' : undefined,
                            cursor: 'pointer',
                            overflow: 'hidden',
                            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                            display: 'flex',
                            flexDirection: 'column'
                          }}
                        >
                          {/* 16:9 Thumbnail preview */}
                          <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', backgroundColor: 'hsl(var(--muted))', overflow: 'hidden' }}>
                            <img 
                              src={ep.thumbnail || details.background || details.poster} 
                              alt={ep.name} 
                              style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }}
                              loading="lazy"
                              onError={(e) => { e.target.src = details.background || details.poster; }}
                            />

                            {/* Gradient Overlay */}
                            <div style={{
                              position: 'absolute',
                              inset: 0,
                              background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 60%)'
                            }} />

                            {/* Episode Tag (T1 : E1) */}
                            <div style={{
                              position: 'absolute',
                              top: '8px',
                              left: '8px',
                              backgroundColor: 'rgba(0,0,0,0.75)',
                              backdropFilter: 'blur(4px)',
                              border: '1px solid rgba(255,255,255,0.15)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '2px 7px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: '#fff'
                            }}>
                              T{selectedSeason} : E{epNum}
                            </div>

                            {/* Watched or Progress status badge */}
                            {isWatched && (
                              <div style={{
                                position: 'absolute',
                                top: '8px',
                                right: '8px',
                                backgroundColor: 'rgba(16, 185, 129, 0.85)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '2px 6px',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}>
                                <Check size={10} /> Visto
                              </div>
                            )}

                            {/* Play button overlay on hover */}
                            <div className="episode-play-overlay">
                              <Play size={20} fill="#fff" color="#fff" />
                            </div>

                            {/* Progress bar at bottom of thumbnail */}
                            {hasProgress && (
                              <div style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                height: '3px',
                                backgroundColor: 'rgba(255,255,255,0.2)'
                              }}>
                                <div style={{
                                  width: `${progressInfo.percentage}%`,
                                  height: '100%',
                                  backgroundColor: 'hsl(var(--primary))'
                                }} />
                              </div>
                            )}
                          </div>

                          {/* Episode Details */}
                          <CardContent style={{ padding: '0.875rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <h4 style={{ 
                                fontSize: '0.875rem', 
                                fontWeight: 600, 
                                color: 'hsl(var(--foreground))',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }} title={ep.name}>
                                {ep.name || `Episodio ${epNum}`}
                              </h4>
                              {ep.rating && (
                                <span style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
                                  <Star size={10} fill="#f59e0b" /> {ep.rating}
                                </span>
                              )}
                            </div>

                            {airDateFormatted && (
                              <span style={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Calendar size={11} /> {airDateFormatted}
                              </span>
                            )}

                            {/* Overview snippet */}
                            <p style={{
                              fontSize: '0.75rem',
                              color: 'hsl(var(--muted-foreground))',
                              lineHeight: 1.4,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              marginTop: '2px'
                            }}>
                              {ep.overview || ep.description || 'Sin descripción disponible para este episodio.'}
                            </p>

                            {/* Action Button inside Card Footer */}
                            <div style={{ marginTop: 'auto', paddingTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                              <Button 
                                variant={isCurrent ? 'default' : 'outline'} 
                                size="sm" 
                                style={{ height: '1.75rem', fontSize: '0.72rem', gap: '4px' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedEpisode(ep);
                                  setActiveModalTab('streams');
                                }}
                              >
                                <Sparkles size={11} />
                                <span>Ver Enlaces</span>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              </TabsContent>
            )}

            {/* ============================================================= */}
            {/* TAB 3: INFO DEL CONTENIDO (SINOPSIS Y REPARTO REMASTERED)      */}
            {/* ============================================================= */}
            <TabsContent value="info">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* 1. Synopsis Card */}
                <Card>
                  <CardHeader style={{ paddingBottom: '0.5rem' }}>
                    <CardTitle style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Film size={16} color="hsl(var(--primary))" />
                      <span>Sinopsis Oficial</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p style={{ fontSize: '0.9rem', color: 'hsl(var(--foreground))', lineHeight: 1.65, opacity: 0.9 }}>
                      {details.description || 'No hay sinopsis disponible actualmente para este título.'}
                    </p>

                    {/* Quick Metadata Chips */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '1rem' }}>
                      {details.awards && (
                        <Badge variant="outline" style={{ color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.4)', backgroundColor: 'rgba(245, 158, 11, 0.08)' }}>
                          <Award size={12} style={{ marginRight: '4px' }} />
                          {details.awards}
                        </Badge>
                      )}
                      {details.releaseInfo && (
                        <Badge variant="outline">
                          <Calendar size={12} style={{ marginRight: '4px' }} />
                          Estreno: {details.releaseInfo}
                        </Badge>
                      )}
                      {details.runtime && (
                        <Badge variant="outline">
                          <Clock size={12} style={{ marginRight: '4px' }} />
                          Duración: {details.runtime}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* 2. Production & Creators Card */}
                {(directors.length > 0 || writers.length > 0) && (
                  <Card>
                    <CardHeader style={{ paddingBottom: '0.5rem' }}>
                      <CardTitle style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clapperboard size={16} color="hsl(var(--primary))" />
                        <span>Dirección y Guion</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {directors.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', minWidth: '5.5rem' }}>
                            Dirección:
                          </span>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {directors.map((d, i) => (
                              <Badge key={`dir-${i}`} variant="default" style={{ fontSize: '0.78rem' }}>
                                {d}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {writers.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', minWidth: '5.5rem' }}>
                            Guionistas:
                          </span>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {writers.map((w, i) => (
                              <Badge key={`wri-${i}`} variant="outline" style={{ fontSize: '0.78rem' }}>
                                {w}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* 3. Cast & Crew (Reparto Principal) with Avatar Cards */}
                <Card>
                  <CardHeader style={{ paddingBottom: '0.75rem' }}>
                    <CardTitle style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <User size={16} color="hsl(var(--primary))" />
                      <span>Reparto Principal ({castList.length})</span>
                    </CardTitle>
                    <CardDescription>
                      Actores y personajes principales de la producción
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {castList.length > 0 ? (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(10.5rem, 1fr))',
                        gap: '10px'
                      }}>
                        {castList.map((actor) => (
                          <div 
                            key={actor.id}
                            style={{
                              backgroundColor: 'hsl(var(--muted) / 0.4)',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: 'var(--radius-md)',
                              padding: '0.625rem 0.75rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              transition: 'transform 0.15s, border-color 0.15s'
                            }}
                          >
                            {/* Stylized Initials Avatar */}
                            <div style={{
                              width: '2.5rem',
                              height: '2.5rem',
                              borderRadius: '50%',
                              background: getAvatarGradient(actor.name),
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.85rem',
                              flexShrink: 0,
                              boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                            }}>
                              {getInitials(actor.name)}
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontSize: '0.8125rem',
                                fontWeight: 600,
                                color: 'hsl(var(--foreground))',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }} title={actor.name}>
                                {actor.name}
                              </div>
                              {actor.character && (
                                <div style={{
                                  fontSize: '0.72rem',
                                  color: 'hsl(var(--muted-foreground))',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }} title={actor.character}>
                                  como {actor.character}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>
                        No hay información detallada de reparto para este título.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};
