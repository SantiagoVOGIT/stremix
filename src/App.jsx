import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { HeroBanner } from './components/HeroBanner';
import { GenreSelector } from './components/GenreSelector';
import { MediaCard } from './components/MediaCard';
import { MediaModal } from './components/MediaModal';
import { VideoPlayer } from './components/VideoPlayer';
import { LibraryView } from './components/LibraryView';
import { AioSettingsModal } from './components/AioSettingsModal';
import { fetchCatalog } from './services/cinemeta';
import { fetchAioStreams } from './services/aiostream';
import { getSettings } from './services/storage';
import { RefreshCw, Film, Tv, Sparkles, AlertCircle } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState('discover');
  const [selectedGenre, setSelectedGenre] = useState(null);
  
  // Data states
  const [heroItems, setHeroItems] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [skipCount, setSkipCount] = useState(0);

  // Modals & Player states
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  // Video Player state
  const [playerState, setPlayerState] = useState(null); // { stream, mediaItem, episode, availableStreams }

  // Initial Load: Featured Hero Items & Initial Catalog
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const loadInitialData = async () => {
      try {
        const [popularMovies, popularSeries] = await Promise.all([
          fetchCatalog('movie', null, null, 0),
          fetchCatalog('series', null, null, 0)
        ]);

        if (isMounted) {
          // Curate top 6 visually rich items for Hero Banner
          const heroList = [
            ...(popularMovies.slice(0, 3)),
            ...(popularSeries.slice(0, 3))
          ].filter(item => Boolean(item.background || item.poster));

          setHeroItems(heroList);

          // Initial catalog depending on currentTab
          if (currentTab === 'movies') {
            setCatalogItems(popularMovies);
          } else if (currentTab === 'series') {
            setCatalogItems(popularSeries);
          } else {
            // Discover: combine top movies and series
            setCatalogItems([...popularMovies.slice(0, 24), ...popularSeries.slice(0, 24)]);
          }
        }
      } catch (err) {
        console.error('Error loading initial catalog:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadInitialData();
    return () => { isMounted = false; };
  }, []);

  // Reload catalog when currentTab or selectedGenre changes
  useEffect(() => {
    if (currentTab === 'library') return;

    let isMounted = true;
    setLoading(true);
    setSkipCount(0);

    const loadTabCatalog = async () => {
      try {
        let items = [];
        if (currentTab === 'movies') {
          items = await fetchCatalog('movie', selectedGenre, null, 0);
        } else if (currentTab === 'series') {
          items = await fetchCatalog('series', selectedGenre, null, 0);
        } else {
          // Discover
          const [m, s] = await Promise.all([
            fetchCatalog('movie', selectedGenre, null, 0),
            fetchCatalog('series', selectedGenre, null, 0)
          ]);
          items = [...(m.slice(0, 24)), ...(s.slice(0, 24))];
        }

        if (isMounted) {
          setCatalogItems(items);
        }
      } catch (err) {
        console.error('Error loading tab catalog:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadTabCatalog();
    return () => { isMounted = false; };
  }, [currentTab, selectedGenre]);

  // Load More (Pagination)
  const handleLoadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    const nextSkip = skipCount + 50;

    try {
      const type = currentTab === 'series' ? 'series' : 'movie';
      const moreItems = await fetchCatalog(type, selectedGenre, null, nextSkip);
      setCatalogItems(prev => [...prev, ...moreItems]);
      setSkipCount(nextSkip);
    } catch (e) {
      console.error('Error loading more:', e);
    } finally {
      setLoadingMore(false);
    }
  };

  // Launch Video Player from stream click
  const handlePlayStream = (stream, mediaItem, episode = null, availableStreams = []) => {
    setPlayerState({
      stream,
      mediaItem,
      episode,
      availableStreams: availableStreams.length > 0 ? availableStreams : [stream]
    });
  };

  // Quick Play directly from card or hero (auto-fetches top AIOStream)
  const handleQuickPlay = async (mediaItem) => {
    try {
      const result = await fetchAioStreams(mediaItem.type || 'movie', mediaItem.id, mediaItem);
      if (result.streams && result.streams.length > 0) {
        handlePlayStream(result.streams[0], mediaItem, null, result.streams);
      } else {
        setSelectedMedia(mediaItem);
      }
    } catch (e) {
      setSelectedMedia(mediaItem);
    }
  };

  // Resume playback from library item
  const handleResumePlayback = async (progressItem) => {
    try {
      const result = await fetchAioStreams(
        progressItem.type || 'movie', 
        progressItem.videoId || progressItem.id, 
        progressItem
      );
      if (result.streams && result.streams.length > 0) {
        handlePlayStream(result.streams[0], progressItem, progressItem.episode, result.streams);
      } else {
        setSelectedMedia(progressItem);
      }
    } catch (e) {
      setSelectedMedia(progressItem);
    }
  };

  // Switch Stream inside Video Player
  const handleSwitchStream = (newStream) => {
    if (!playerState) return;
    setPlayerState(prev => ({
      ...prev,
      stream: newStream
    }));
  };

  return (
    <div className="app-container">
      <div className="main-content">
        {/* Navigation Bar */}
        <Navbar
          currentTab={currentTab}
          onSelectTab={(tab) => {
            setCurrentTab(tab);
            setSelectedGenre(null);
          }}
          onSelectMedia={(item) => setSelectedMedia(item)}
          onOpenSettings={() => setShowSettings(true)}
        />

        {/* HERO BANNER (Shown in Discover, Movies, Series when no search/filter active) */}
        {currentTab !== 'library' && !selectedGenre && heroItems.length > 0 && (
          <HeroBanner
            items={heroItems}
            onSelectMedia={(item) => setSelectedMedia(item)}
            onPlayMedia={(item) => handleQuickPlay(item)}
          />
        )}

        {/* GENRE FILTER SELECTOR (Shown in Discover, Movies, Series) */}
        {currentTab !== 'library' && (
          <GenreSelector
            selectedGenre={selectedGenre}
            onSelectGenre={(g) => setSelectedGenre(g)}
          />
        )}

        {/* MAIN BODY CONTENT */}
        {currentTab === 'library' ? (
          <LibraryView
            onSelectMedia={(item) => setSelectedMedia(item)}
            onResumePlayback={handleResumePlayback}
          />
        ) : (
          <section className="section-wrapper">
            <div className="section-header">
              <div className="section-title-group">
                <h2 className="section-title">
                  {currentTab === 'movies' ? 'Películas Populares' : currentTab === 'series' ? 'Series de Televisión' : 'Explorar Catálogo AIO'}
                </h2>
                {selectedGenre && (
                  <span className="section-count-badge">
                    Género: {selectedGenre}
                  </span>
                )}
              </div>

              <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                {catalogItems.length} títulos disponibles
              </span>
            </div>

            {/* Media Grid */}
            {loading ? (
              <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw size={36} className="spin" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
                <p>Cargando catálogo cinematográfico...</p>
              </div>
            ) : catalogItems.length > 0 ? (
              <>
                <div className="media-grid">
                  {catalogItems.map((item) => (
                    <MediaCard
                      key={item.id}
                      item={item}
                      onSelect={(m) => setSelectedMedia(m)}
                      onQuickPlay={(m) => handleQuickPlay(m)}
                    />
                  ))}
                </div>

                {/* Load More Button */}
                <div style={{ textAlign: 'center', marginTop: '40px' }}>
                  <button 
                    className="btn-secondary" 
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    style={{ margin: '0 auto' }}
                  >
                    {loadingMore ? (
                      <>
                        <RefreshCw size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                        <span>Cargando más...</span>
                      </>
                    ) : (
                      <span>Cargar Más Títulos</span>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-dim)' }}>
                <Film size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                <p>No se encontraron títulos en esta categoría.</p>
              </div>
            )}
          </section>
        )}
      </div>

      {/* DETAIL MODAL */}
      {selectedMedia && (
        <MediaModal
          mediaItem={selectedMedia}
          onClose={() => setSelectedMedia(null)}
          onPlayStream={(stream, mediaItem, episode) => {
            setSelectedMedia(null);
            handlePlayStream(stream, mediaItem, episode);
          }}
        />
      )}

      {/* VIDEO PLAYER */}
      {playerState && (
        <VideoPlayer
          stream={playerState.stream}
          mediaItem={playerState.mediaItem}
          episode={playerState.episode}
          availableStreams={playerState.availableStreams}
          onClose={() => setPlayerState(null)}
          onSwitchStream={handleSwitchStream}
          onNextEpisode={() => {
            // Next episode logic
            if (playerState.episode) {
              const currentNum = playerState.episode.number || playerState.episode.episode || 1;
              const nextEpisode = {
                ...playerState.episode,
                number: currentNum + 1,
                episode: currentNum + 1,
                name: `Episodio ${currentNum + 1}`,
                id: `${playerState.mediaItem.id}:${playerState.episode.season}:${currentNum + 1}`
              };
              handleQuickPlay({
                ...playerState.mediaItem,
                currentEpisode: nextEpisode
              });
            }
          }}
        />
      )}

      {/* AIOSTREAMS SETTINGS MODAL */}
      {showSettings && (
        <AioSettingsModal
          onClose={() => setShowSettings(false)}
          onSettingsUpdated={() => {
            // Settings updated callback
          }}
        />
      )}
    </div>
  );
}
