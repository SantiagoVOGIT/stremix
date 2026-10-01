import React, { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  RotateCw, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  X, 
  SkipForward, 
  Settings, 
  MessageSquare, 
  Check, 
  Sparkles, 
  ExternalLink, 
  AlertCircle,
  Upload
} from 'lucide-react';
import { fetchSubtitles, loadSubtitleVttBlob, srtToVtt } from '../services/subtitles';
import { saveProgress, addToHistory, getSettings } from '../services/storage';

export const VideoPlayer = ({ 
  stream, 
  mediaItem, 
  episode = null, 
  allEpisodes = [],
  availableStreams = [],
  onClose,
  onSwitchStream,
  onNextEpisode
}) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hlsRef = useRef(null);
  const controlsTimeoutRef = useRef(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [playbackError, setPlaybackError] = useState(null);

  // Subtitles & Audio state
  const [subtitlesList, setSubtitlesList] = useState([]);
  const [selectedSubId, setSelectedSubId] = useState('off');
  const [subBlobUrl, setSubBlobUrl] = useState(null);
  const [subDelay, setSubDelay] = useState(0);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [showStreamMenu, setShowStreamMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  // Next episode binge prompt
  const [showNextPrompt, setShowNextPrompt] = useState(false);
  const [nextCountdown, setNextCountdown] = useState(10);

  const videoId = episode ? episode.id || `${mediaItem.id}:${episode.season}:${episode.number || episode.episode}` : mediaItem.id;
  const streamUrl = stream?.url;

  // Format seconds to HH:MM:SS
  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Setup HLS / HTML5 Video Stream
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) {
      setPlaybackError('No se encontró una URL de reproducción directa para este stream.');
      return;
    }

    setPlaybackError(null);
    setIsPlaying(false);

    // If HLS (.m3u8)
    if (streamUrl.includes('.m3u8')) {
      if (Hls.isSupported()) {
        if (hlsRef.current) hlsRef.current.destroy();
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
        });
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().then(() => setIsPlaying(true)).catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            console.error('Fatal HLS error:', data);
            setPlaybackError('Error al reproducir el flujo HLS. Puedes abrirlo en VLC.');
          }
        });
        hlsRef.current = hls;
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
        video.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    } else {
      // Standard MP4/WebM
      video.src = streamUrl;
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    }

    // Add to history
    addToHistory({
      id: mediaItem.id,
      name: mediaItem.name,
      type: mediaItem.type,
      poster: mediaItem.poster,
      streamName: stream.rawName || stream.mainTitle
    });

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl, mediaItem]);

  // Load Subtitles
  useEffect(() => {
    let isMounted = true;
    const loadSubs = async () => {
      try {
        const subs = await fetchSubtitles(mediaItem.type || 'movie', videoId);
        if (isMounted) {
          setSubtitlesList(subs);
          // Auto select Spanish if available
          const spanish = subs.find(s => s.lang === 'spa' || s.lang === 'es');
          if (spanish) {
            handleSelectSubtitle(spanish.id, subs);
          }
        }
      } catch (err) {
        console.warn('Subtitles load warning:', err);
      }
    };

    loadSubs();
    return () => { isMounted = false; };
  }, [videoId, mediaItem.type]);

  const handleSelectSubtitle = async (subId, list = subtitlesList) => {
    setSelectedSubId(subId);
    if (subId === 'off') {
      setSubBlobUrl(null);
      return;
    }

    const sub = list.find(s => s.id === subId);
    if (sub && sub.url) {
      const blob = await loadSubtitleVttBlob(sub.url, subDelay);
      setSubBlobUrl(blob);
    }
  };

  // Adjust subtitle delay
  const handleAdjustSubDelay = async (delta) => {
    const newDelay = subDelay + delta;
    setSubDelay(newDelay);
    const sub = subtitlesList.find(s => s.id === selectedSubId);
    if (sub && sub.url) {
      const blob = await loadSubtitleVttBlob(sub.url, newDelay);
      setSubBlobUrl(blob);
    }
  };

  // Handle custom subtitle upload
  const handleUploadSubtitle = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target.result;
      const vtt = srtToVtt(text, subDelay);
      const blob = new Blob([vtt], { type: 'text/vtt' });
      const customUrl = URL.createObjectURL(blob);
      setSubBlobUrl(customUrl);
      setSelectedSubId('custom');
      setSubtitlesList(prev => [
        { id: 'custom', label: `Personalizado (${file.name})`, lang: 'custom' },
        ...prev
      ]);
    };
    reader.readAsText(file);
  };

  // Controls auto-hide
  const resetControlsTimer = () => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setControlsVisible(false);
    }, 3500);
  };

  useEffect(() => {
    window.addEventListener('mousemove', resetControlsTimer);
    return () => {
      window.removeEventListener('mousemove', resetControlsTimer);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying]);

  // Video time update & progress save
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    setCurrentTime(video.currentTime);
    setDuration(video.duration || 0);

    // Buffer calculation
    if (video.buffered.length > 0) {
      const end = video.buffered.end(video.buffered.length - 1);
      setBuffered(end);
    }

    // Save progress to local storage every 5 seconds
    if (video.duration > 0 && Math.floor(video.currentTime) % 5 === 0) {
      saveProgress({
        videoId,
        id: mediaItem.id,
        name: mediaItem.name,
        type: mediaItem.type,
        poster: mediaItem.poster,
        currentTime: video.currentTime,
        duration: video.duration,
        percentage: (video.currentTime / video.duration) * 100,
        episode: episode ? {
          season: episode.season,
          number: episode.number || episode.episode,
          name: episode.name
        } : null,
        streamTitle: stream.rawName || stream.mainTitle
      });
    }

    // Next episode trigger at >95% for series
    if (episode && allEpisodes.length > 0 && video.duration > 0) {
      const progressPercent = (video.currentTime / video.duration) * 100;
      if (progressPercent > 94 && !showNextPrompt) {
        setShowNextPrompt(true);
      }
    }
  };

  // Next Episode Countdown
  useEffect(() => {
    if (!showNextPrompt) return;
    const interval = setInterval(() => {
      setNextCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (onNextEpisode) onNextEpisode();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showNextPrompt, onNextEpisode]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      const video = videoRef.current;
      if (!video) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skip(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          skip(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(prev => {
            const next = Math.min(1, prev + 0.1);
            video.volume = next;
            return next;
          });
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(prev => {
            const next = Math.max(0, prev - 0.1);
            video.volume = next;
            return next;
          });
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        case 'Escape':
          e.preventDefault();
          if (isFullscreen) {
            toggleFullscreen();
          } else {
            onClose();
          }
          break;
        default:
          break;
      }
      resetControlsTimer();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isFullscreen, volume, isMuted]);

  // Controls actions
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const skip = (seconds) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(Math.max(0, video.currentTime + seconds), duration);
  };

  const handleScrub = (e) => {
    const video = videoRef.current;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    if (video && duration > 0) {
      video.currentTime = percentage * duration;
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e) => {
    const video = videoRef.current;
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (video) {
      video.volume = val;
      video.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleSpeedChange = (rate) => {
    const video = videoRef.current;
    if (video) video.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferPercent = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div 
      className="player-container" 
      ref={containerRef}
      onMouseMove={resetControlsTimer}
    >
      {/* HTML5 Video Element */}
      <video
        ref={videoRef}
        className="video-element"
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => {
          setIsPlaying(false);
          if (episode && onNextEpisode) onNextEpisode();
        }}
        onError={() => {
          setPlaybackError('El stream no pudo reproducirse en el navegador.');
        }}
      >
        {subBlobUrl && (
          <track
            src={subBlobUrl}
            kind="subtitles"
            srcLang="es"
            label="Subtítulos"
            default
          />
        )}
      </video>

      {/* Error Fallback Banner */}
      {playbackError && (
        <div style={{
          position: 'absolute',
          background: 'rgba(14, 18, 28, 0.95)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '16px',
          padding: '24px 32px',
          maxWidth: '520px',
          textAlign: 'center',
          backdropFilter: 'blur(20px)',
          zIndex: 40,
          boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
        }}>
          <AlertCircle size={42} color="#ef4444" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', color: '#fff' }}>
            No se pudo reproducir este stream directamente
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '18px' }}>
            {playbackError} Puedes abrirlo en VLC / reproductor externo o probar otro enlace de AIOStreams.
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            {streamUrl && (
              <button 
                className="btn-primary"
                onClick={() => { window.location.href = `vlc://${streamUrl}`; }}
              >
                <ExternalLink size={16} /> Abrir en VLC
              </button>
            )}
            <button 
              className="btn-secondary"
              onClick={() => setShowStreamMenu(true)}
            >
              Cambiar de Stream
            </button>
          </div>
        </div>
      )}

      {/* Next Episode Countdown Binge Overlay */}
      {showNextPrompt && onNextEpisode && (
        <div style={{
          position: 'absolute',
          bottom: '100px',
          right: '40px',
          background: 'rgba(14, 18, 28, 0.92)',
          border: '1px solid var(--accent-violet)',
          padding: '16px 22px',
          borderRadius: '14px',
          backdropFilter: 'blur(16px)',
          zIndex: 35,
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.8)'
        }}>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>
              Siguiente episodio en {nextCountdown}s...
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>
              Reproducir ahora
            </div>
          </div>
          <button 
            className="btn-primary" 
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            onClick={() => onNextEpisode()}
          >
            <SkipForward size={16} /> Ver Ya
          </button>
          <button 
            className="icon-btn" 
            style={{ width: '32px', height: '32px' }}
            onClick={() => setShowNextPrompt(false)}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Player Overlay Controls */}
      <div className={`player-overlay ${controlsVisible ? '' : 'idle'}`}>
        {/* Top Header Bar */}
        <div className="player-top-bar">
          <div className="player-title-info">
            <h2 className="player-title">{mediaItem.name}</h2>
            <div className="player-subtitle">
              {episode ? `Temporada ${episode.season} • Episodio ${episode.number || episode.episode}: ${episode.name}` : mediaItem.year}
              <span style={{ margin: '0 8px' }}>•</span>
              <span style={{ color: 'var(--accent-violet)', fontWeight: 600 }}>
                {stream.resolution} {stream.provider}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="icon-btn" onClick={onClose} title="Cerrar reproductor (Esc)">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Center Big Play Button (when paused) */}
        {!isPlaying && !playbackError && (
          <button className="player-center-play" onClick={togglePlay}>
            <Play size={32} fill="#fff" />
          </button>
        )}

        {/* Bottom Control Deck */}
        <div className="player-bottom-bar">
          {/* Interactive Scrub Bar */}
          <div className="scrub-container" onClick={handleScrub}>
            <div className="scrub-buffer" style={{ width: `${bufferPercent}%` }}></div>
            <div className="scrub-progress" style={{ width: `${progressPercent}%` }}>
              <div className="scrub-thumb"></div>
            </div>
          </div>

          {/* Controls Row */}
          <div className="player-controls-row">
            {/* Left Controls */}
            <div className="player-left-controls">
              <button className="icon-btn" onClick={togglePlay} title={isPlaying ? 'Pausar (Espacio)' : 'Reproducir (Espacio)'}>
                {isPlaying ? <Pause size={19} /> : <Play size={19} fill="#fff" />}
              </button>

              <button className="icon-btn" onClick={() => skip(-10)} title="Retroceder 10s (←)">
                <RotateCcw size={18} />
              </button>

              <button className="icon-btn" onClick={() => skip(10)} title="Avanzar 10s (→)">
                <RotateCw size={18} />
              </button>

              {episode && onNextEpisode && (
                <button className="icon-btn" onClick={onNextEpisode} title="Siguiente episodio">
                  <SkipForward size={18} />
                </button>
              )}

              <div className="volume-slider-wrap">
                <button className="icon-btn" onClick={toggleMute} title="Silenciar (M)">
                  {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="volume-slider"
                />
              </div>

              <div className="player-time-display">
                <span>{formatTime(currentTime)}</span>
                <span style={{ margin: '0 4px', color: 'var(--text-dim)' }}>/</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Right Controls */}
            <div className="player-right-controls" style={{ position: 'relative' }}>
              {/* Speed Switcher */}
              <div style={{ position: 'relative' }}>
                <button 
                  className="icon-btn"
                  onClick={() => { setShowSpeedMenu(!showSpeedMenu); setShowSubMenu(false); setShowStreamMenu(false); }}
                  title="Velocidad de reproducción"
                >
                  <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{playbackRate}x</span>
                </button>

                {showSpeedMenu && (
                  <div style={{
                    position: 'absolute',
                    bottom: '50px',
                    right: 0,
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '10px',
                    padding: '6px',
                    boxShadow: 'var(--shadow-lg)',
                    minWidth: '110px',
                    zIndex: 60
                  }}>
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                      <div
                        key={rate}
                        onClick={() => handleSpeedChange(rate)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          color: playbackRate === rate ? 'var(--accent-violet)' : '#fff',
                          fontWeight: playbackRate === rate ? 700 : 400,
                          display: 'flex',
                          justifyContent: 'space-between'
                        }}
                      >
                        <span>{rate}x</span>
                        {playbackRate === rate && <Check size={14} />}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Subtitles Popover */}
              <div style={{ position: 'relative' }}>
                <button 
                  className="icon-btn" 
                  onClick={() => { setShowSubMenu(!showSubMenu); setShowSpeedMenu(false); setShowStreamMenu(false); }}
                  title="Subtítulos"
                >
                  <MessageSquare size={18} />
                </button>

                {showSubMenu && (
                  <div style={{
                    position: 'absolute',
                    bottom: '50px',
                    right: 0,
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '12px',
                    padding: '12px',
                    boxShadow: 'var(--shadow-lg)',
                    width: '280px',
                    maxHeight: '320px',
                    overflowY: 'auto',
                    zIndex: 60
                  }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '8px', color: '#fff' }}>
                      Subtítulos (OpenSubtitles)
                    </div>

                    {/* Delay sync controls */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <span>Sincronización:</span>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <button className="icon-btn" style={{ width: '24px', height: '24px' }} onClick={() => handleAdjustSubDelay(-0.5)}>-</button>
                        <span>{subDelay}s</span>
                        <button className="icon-btn" style={{ width: '24px', height: '24px' }} onClick={() => handleAdjustSubDelay(0.5)}>+</button>
                      </div>
                    </div>

                    {/* Subtitle track list */}
                    <div 
                      onClick={() => handleSelectSubtitle('off')}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        color: selectedSubId === 'off' ? 'var(--accent-violet)' : '#fff',
                        fontWeight: selectedSubId === 'off' ? 700 : 400
                      }}
                    >
                      Desactivados
                    </div>

                    {subtitlesList.map((s) => (
                      <div 
                        key={s.id}
                        onClick={() => handleSelectSubtitle(s.id)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.82rem',
                          color: selectedSubId === s.id ? 'var(--accent-violet)' : 'var(--text-main)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderTop: '1px solid rgba(255,255,255,0.04)'
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.label}
                        </span>
                        {selectedSubId === s.id && <Check size={14} color="var(--accent-violet)" />}
                      </div>
                    ))}

                    {/* Upload custom subtitle button */}
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginTop: '8px',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px dashed var(--border-glass)',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)'
                    }}>
                      <Upload size={14} /> Subir archivo .SRT
                      <input type="file" accept=".srt,.vtt" onChange={handleUploadSubtitle} style={{ display: 'none' }} />
                    </label>
                  </div>
                )}
              </div>

              {/* Stream Switcher Popover */}
              {availableStreams.length > 1 && (
                <div style={{ position: 'relative' }}>
                  <button 
                    className="icon-btn" 
                    onClick={() => { setShowStreamMenu(!showStreamMenu); setShowSubMenu(false); setShowSpeedMenu(false); }}
                    title="Cambiar de stream AIOStreams"
                  >
                    <Sparkles size={18} color="var(--accent-violet)" />
                  </button>

                  {showStreamMenu && (
                    <div style={{
                      position: 'absolute',
                      bottom: '50px',
                      right: 0,
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-glass)',
                      borderRadius: '12px',
                      padding: '12px',
                      boxShadow: 'var(--shadow-lg)',
                      width: '320px',
                      maxHeight: '340px',
                      overflowY: 'auto',
                      zIndex: 60
                    }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '8px', color: '#fff' }}>
                        Cambiar Stream AIOStreams
                      </div>
                      {availableStreams.map((s) => (
                        <div
                          key={s.id}
                          onClick={() => {
                            setShowStreamMenu(false);
                            if (onSwitchStream) onSwitchStream(s);
                          }}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '8px',
                            marginBottom: '4px',
                            cursor: 'pointer',
                            background: s.id === stream.id ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255,255,255,0.02)',
                            border: s.id === stream.id ? '1px solid var(--accent-violet)' : '1px solid transparent',
                            fontSize: '0.82rem'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                            <span style={{ color: 'var(--accent-cyan)' }}>{s.resolution}</span>
                            <span style={{ color: 'var(--text-dim)' }}>{s.size}</span>
                          </div>
                          <div style={{ color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                            {s.mainTitle}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Fullscreen Button */}
              <button className="icon-btn" onClick={toggleFullscreen} title="Pantalla completa (F)">
                {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
