import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  MessageSquare, 
  Check, 
  Sparkles, 
  ExternalLink, 
  AlertCircle, 
  Upload, 
  Copy, 
  Film,
  PictureInPicture,
  Clock,
  Tv,
  Terminal
} from 'lucide-react';
import { fetchSubtitles, srtToVtt, loadSubtitleText } from '../services/subtitles';
import { saveProgress, addToHistory, getSettings, getProgress } from '../services/storage';
import { buildStreamProxyUrl } from '../services/aiostream';
import { launchExternalPlayer, getMpvCliCommand } from '../services/playerUtils';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';

export const VideoPlayer = ({ 
  stream, 
  mediaItem, 
  episode = null, 
  allEpisodes = [],
  availableStreams = [],
  onClose,
  onSwitchStream,
  onSelectEpisode,
  onNextEpisode
}) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hlsRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const scrubBarRef = useRef(null);
  const clickTimeoutRef = useRef(null);
  const pendingSeekRef = useRef(null);
  const proxyAttemptedRef = useRef(true);
  const subBlobUrlRef = useRef(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [prevVolume, setPrevVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPiP, setIsPiP] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [playbackError, setPlaybackError] = useState(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);

  // Scrub Hover & Drag state
  const [isDraggingScrub, setIsDraggingScrub] = useState(false);
  const [scrubHoverTime, setScrubHoverTime] = useState(null);
  const [scrubHoverPos, setScrubHoverPos] = useState(0);

  // Resume Progress Prompt state
  const [savedResumeTime, setSavedResumeTime] = useState(null);
  const [showResumePrompt, setShowResumePrompt] = useState(false);

  // Subtitles, Audio & Episodes popover state
  const [subtitlesList, setSubtitlesList] = useState([]);
  const [selectedSubId, setSelectedSubId] = useState('off');
  const [subBlobUrl, setSubBlobUrl] = useState(null);
  const [currentRawSubText, setCurrentRawSubText] = useState(null);
  const [subDelay, setSubDelay] = useState(0);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [showStreamMenu, setShowStreamMenu] = useState(false);
  const [showEpisodeMenu, setShowEpisodeMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  // Next episode binge prompt
  const [showNextPrompt, setShowNextPrompt] = useState(false);
  const [nextCountdown, setNextCountdown] = useState(10);

  const [externalFeedback, setExternalFeedback] = useState('');

  const settings = getSettings();
  const videoId = episode ? (episode.id || `${mediaItem.id}:${episode.season}:${episode.number || episode.episode}`) : mediaItem.id;
  const streamUrl = stream?.url;
  const isMkv = stream?.formatType === 'mkv' || (streamUrl && streamUrl.toLowerCase().includes('.mkv'));
  const mediaTitle = mediaItem?.name || stream?.mainTitle || 'Stremix Stream';
  const infoHash = stream?.infoHash;
  const preferredPlayer = settings.externalPlayer || 'vlc';

  // Check if this stream is a YouTube video (Trailer or YouTube stream)
  const isYouTube = useMemo(() => {
    if (!stream) return false;
    if (stream.formatType === 'youtube' || stream.ytId) return true;
    if (streamUrl && (streamUrl.includes('youtube.com') || streamUrl.includes('youtu.be'))) return true;
    return false;
  }, [stream, streamUrl]);

  // Extract YouTube ID if applicable
  const youtubeVideoId = useMemo(() => {
    if (!isYouTube) return null;
    if (stream?.ytId) return stream.ytId;
    if (!streamUrl) return null;
    const match = streamUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match ? match[1] : null;
  }, [isYouTube, stream, streamUrl]);

  // Calculate real next episode object from allEpisodes
  const nextEpisodeData = useMemo(() => {
    if (!episode || !allEpisodes || allEpisodes.length === 0) return null;
    const currentIndex = allEpisodes.findIndex(e => 
      e.id === episode.id || 
      (e.season === episode.season && (e.number || e.episode) === (episode.number || episode.episode))
    );
    if (currentIndex >= 0 && currentIndex < allEpisodes.length - 1) {
      return allEpisodes[currentIndex + 1];
    }
    return null;
  }, [episode, allEpisodes]);

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

  // Launch external player
  const handleOpenExternal = useCallback((overridePlayer) => {
    const target = streamUrl || (infoHash ? `magnet:?xt=urn:btih:${infoHash}` : '');
    if (!target) return;

    const chosen = overridePlayer || preferredPlayer;
    const res = launchExternalPlayer(target, mediaTitle, chosen);
    setExternalFeedback(res.message);
    setTimeout(() => setExternalFeedback(''), 4500);
  }, [streamUrl, infoHash, mediaTitle, preferredPlayer]);

  // Sync fullscreen state with document events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement || document.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Check saved progress on mount
  useEffect(() => {
    const existing = getProgress(videoId);
    if (existing && existing.currentTime > 15 && (!existing.duration || (existing.currentTime / existing.duration) < 0.95)) {
      setSavedResumeTime(existing.currentTime);
      setShowResumePrompt(true);
    }
  }, [videoId]);

  // Resume or start over
  const handleApplyResume = () => {
    const video = videoRef.current;
    if (video && savedResumeTime) {
      video.currentTime = savedResumeTime;
      setCurrentTime(savedResumeTime);
    }
    setShowResumePrompt(false);
  };

  const handleDismissResume = () => {
    setShowResumePrompt(false);
  };

  // Setup HLS / HTML5 Video Stream / YouTube
  useEffect(() => {
    // If YouTube stream, no video element setup required
    if (isYouTube) {
      setIsBuffering(false);
      setPlaybackError(null);
      setIsPlaying(true);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    if (!streamUrl) {
      if (stream?.infoHash) {
        setPlaybackError('Este stream es un Torrent P2P. Se requiere un cliente BitTorrent o reproductor externo como VLC.');
      } else {
        setPlaybackError('No se encontró una URL de reproducción directa para este enlace.');
      }
      setIsBuffering(false);
      return;
    }

    setPlaybackError(null);
    setIsBuffering(true);
    setIsPlaying(false);

    // Try playback: if HLS (.m3u8)
    if (streamUrl.includes('.m3u8')) {
      proxyAttemptedRef.current = false;
      if (Hls.isSupported()) {
        if (hlsRef.current) {
          hlsRef.current.destroy();
        }
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
        });
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsBuffering(false);
          video.play().then(() => setIsPlaying(true)).catch(() => {
            setIsPlaying(false);
            setIsBuffering(false);
          });
        });
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            console.warn('HLS stream fatal error:', data.type);
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.warn('Attempting HLS network error recovery...');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.warn('Attempting HLS media error recovery...');
                hls.recoverMediaError();
                break;
              default:
                hls.destroy();
                setIsBuffering(false);
                setPlaybackError('El flujo HLS no pudo reproducirse directamente en el navegador.');
                break;
            }
          }
        });
        hlsRef.current = hls;
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
        video.play().then(() => {
          setIsPlaying(true);
          setIsBuffering(false);
        }).catch(() => {
          setIsPlaying(false);
          setIsBuffering(false);
        });
      }
    } else {
      // Standard video: route through proxy with range support if external link and proxy enabled
      const useProxy = settings.useProxy !== false;
      const shouldUseProxy = useProxy && streamUrl.startsWith('http') && !streamUrl.includes('localhost');
      proxyAttemptedRef.current = shouldUseProxy;

      const playableSrc = shouldUseProxy
        ? buildStreamProxyUrl(streamUrl, stream?.behaviorHints?.headers)
        : streamUrl;

      video.src = playableSrc;
      video.play().then(() => {
        setIsPlaying(true);
        setIsBuffering(false);
        setPlaybackError(null);
      }).catch((e) => {
        // Autoplay may be blocked by browser policy without user gesture
        setIsPlaying(false);
        setIsBuffering(false);
        console.warn('Playback gesture note:', e.message);
      });
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
      // Save last position on unmount if played > 5s
      if (video && video.currentTime > 5 && video.duration > 0) {
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
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    };
  }, [streamUrl, videoId, mediaItem, stream, episode, settings.useProxy, isYouTube]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (subBlobUrlRef.current) {
        URL.revokeObjectURL(subBlobUrlRef.current);
        subBlobUrlRef.current = null;
      }
    };
  }, []);

  const handleSelectSubtitle = useCallback(async (subId, list = subtitlesList) => {
    setSelectedSubId(subId);
    if (subId === 'off') {
      if (subBlobUrlRef.current) {
        URL.revokeObjectURL(subBlobUrlRef.current);
        subBlobUrlRef.current = null;
      }
      setSubBlobUrl(null);
      setCurrentRawSubText(null);
      if (videoRef.current?.textTracks) {
        for (let i = 0; i < videoRef.current.textTracks.length; i++) {
          videoRef.current.textTracks[i].mode = 'disabled';
        }
      }
      return;
    }

    const sub = list.find(s => s.id === subId);
    if (sub && sub.url) {
      try {
        const text = await loadSubtitleText(sub.url);
        if (text) {
          setCurrentRawSubText(text);
          const vtt = srtToVtt(text, subDelay);
          const blob = new Blob([vtt], { type: 'text/vtt' });
          if (subBlobUrlRef.current) {
            URL.revokeObjectURL(subBlobUrlRef.current);
          }
          const newUrl = URL.createObjectURL(blob);
          subBlobUrlRef.current = newUrl;
          setSubBlobUrl(newUrl);
        }
      } catch (e) {
        console.error('Error applying subtitle:', e);
      }
    }
  }, [subtitlesList, subDelay]);

  // Load Subtitles list
  useEffect(() => {
    let isMounted = true;
    const loadSubs = async () => {
      try {
        const subs = await fetchSubtitles(mediaItem.type || 'movie', videoId);
        let combined = [...subs];

        // Merge any subtitles provided by AIOStreams / Debrid addon
        if (stream?.subtitles && Array.isArray(stream.subtitles)) {
          stream.subtitles.forEach((extSub, idx) => {
            if (extSub.url && !combined.some(s => s.url === extSub.url)) {
              combined.unshift({
                id: extSub.id || `stream-sub-${idx}`,
                label: extSub.label || extSub.lang || `Pista Subtítulos ${idx + 1}`,
                lang: extSub.lang || 'es',
                url: extSub.url
              });
            }
          });
        }

        if (isMounted) {
          setSubtitlesList(combined);
          // Auto select Spanish if available and preferred
          if (settings.subtitlesLanguage === 'spa') {
            const spanish = combined.find(s => s.lang === 'spa' || s.lang === 'es' || s.lang === 'lat');
            if (spanish) {
              handleSelectSubtitle(spanish.id, combined);
            }
          }
        }
      } catch (err) {
        console.warn('Subtitles load warning:', err);
      }
    };

    loadSubs();
    return () => { isMounted = false; };
  }, [videoId, mediaItem.type, stream, settings.subtitlesLanguage, handleSelectSubtitle]);

  const handleAdjustSubDelay = (delta) => {
    const newDelay = parseFloat((subDelay + delta).toFixed(1));
    setSubDelay(newDelay);

    if (currentRawSubText) {
      const vtt = srtToVtt(currentRawSubText, newDelay);
      const blob = new Blob([vtt], { type: 'text/vtt' });
      if (subBlobUrlRef.current) {
        URL.revokeObjectURL(subBlobUrlRef.current);
      }
      const newUrl = URL.createObjectURL(blob);
      subBlobUrlRef.current = newUrl;
      setSubBlobUrl(newUrl);
    }
  };

  const handleUploadSubtitle = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      setCurrentRawSubText(text);
      const vtt = srtToVtt(text, subDelay);
      const blob = new Blob([vtt], { type: 'text/vtt' });
      if (subBlobUrlRef.current) {
        URL.revokeObjectURL(subBlobUrlRef.current);
      }
      const customUrl = URL.createObjectURL(blob);
      subBlobUrlRef.current = customUrl;
      setSubBlobUrl(customUrl);
      setSelectedSubId('custom');
      setSubtitlesList(prev => [
        { id: 'custom', label: `Local (${file.name})`, lang: 'custom' },
        ...prev
      ]);
    };
    reader.readAsText(file);
  };

  // Ensure textTracks mode showing when subtitle changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !subBlobUrl) return;
    const timer = setTimeout(() => {
      if (video.textTracks && video.textTracks.length > 0) {
        for (let i = 0; i < video.textTracks.length; i++) {
          video.textTracks[i].mode = 'showing';
        }
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [subBlobUrl]);

  // Controls auto-hide timer
  const resetControlsTimer = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !showSubMenu && !showStreamMenu && !showSpeedMenu && !showEpisodeMenu && !isDraggingScrub) {
        setControlsVisible(false);
      }
    }, 3500);
  }, [isPlaying, showSubMenu, showStreamMenu, showSpeedMenu, showEpisodeMenu, isDraggingScrub]);

  // Update time and buffered ranges
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    setCurrentTime(video.currentTime);
    if (video.buffered.length > 0) {
      setBuffered(video.buffered.end(video.buffered.length - 1));
    }

    // Periodic progress saving (every 10 seconds)
    const sec = Math.floor(video.currentTime);
    if (sec > 5 && sec % 10 === 0 && video.duration > 0) {
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

    // Next episode countdown
    if (episode && allEpisodes.length > 0 && video.duration > 0 && settings.autoPlayNext !== false) {
      const progressPercent = (video.currentTime / video.duration) * 100;
      if (progressPercent > 94 && !showNextPrompt) {
        setShowNextPrompt(true);
      }
    }
  };

  // Next episode countdown timer
  useEffect(() => {
    if (!showNextPrompt) return;
    const interval = setInterval(() => {
      setNextCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (onNextEpisode) onNextEpisode(nextEpisodeData);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showNextPrompt, onNextEpisode, nextEpisodeData]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  const skip = useCallback((seconds) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(Math.max(0, video.currentTime + seconds), duration);
    setCurrentTime(video.currentTime);
  }, [duration]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isMuted || volume === 0) {
      const restored = prevVolume > 0 ? prevVolume : 0.8;
      video.muted = false;
      video.volume = restored;
      setVolume(restored);
      setIsMuted(false);
    } else {
      setPrevVolume(volume);
      video.muted = true;
      video.volume = 0;
      setVolume(0);
      setIsMuted(true);
    }
  }, [isMuted, volume, prevVolume]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {});
      } else if (containerRef.current.webkitRequestFullscreen) {
        containerRef.current.webkitRequestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
      setIsFullscreen(false);
    }
  }, []);

  const togglePiP = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiP(false);
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
        setIsPiP(true);
      }
    } catch (err) {
      console.warn('PiP error:', err);
    }
  }, []);

  // Video click handler: distinguish single click (play/pause) from double click (fullscreen)
  const handleVideoClick = () => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      toggleFullscreen();
    } else {
      clickTimeoutRef.current = setTimeout(() => {
        togglePlay();
        clickTimeoutRef.current = null;
      }, 250);
    }
  };

  const handleVolumeChange = (e) => {
    const video = videoRef.current;
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (video) {
      video.volume = val;
      const muted = val === 0;
      video.muted = muted;
      setIsMuted(muted);
      if (val > 0) setPrevVolume(val);
    }
  };

  const handleSpeedChange = (rate) => {
    const video = videoRef.current;
    if (video) video.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
  };

  const handleCopyStream = () => {
    const target = streamUrl || (stream?.infoHash ? `magnet:?xt=urn:btih:${stream.infoHash}` : '');
    if (target) {
      navigator.clipboard.writeText(target);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    }
  };

  const handleCopyCliCommand = () => {
    if (streamUrl) {
      const cmd = getMpvCliCommand(streamUrl);
      navigator.clipboard.writeText(cmd);
      setCopiedCli(true);
      setTimeout(() => setCopiedCli(false), 2500);
    }
  };

  // Scrub bar dragging and hovering
  const calculateScrubTime = (e) => {
    if (!scrubBarRef.current || duration <= 0) return { time: 0, pos: 0 };
    const rect = scrubBarRef.current.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percentage = clickX / rect.width;
    return { time: percentage * duration, pos: clickX };
  };

  const handleScrubMouseDown = (e) => {
    setIsDraggingScrub(true);
    const { time } = calculateScrubTime(e);
    const video = videoRef.current;
    if (video && duration > 0) {
      video.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleScrubMouseMove = (e) => {
    const { time, pos } = calculateScrubTime(e);
    setScrubHoverTime(time);
    setScrubHoverPos(pos);
    if (isDraggingScrub) {
      const video = videoRef.current;
      if (video && duration > 0) {
        video.currentTime = time;
        setCurrentTime(time);
      }
    }
  };

  const handleScrubMouseLeave = () => {
    if (!isDraggingScrub) {
      setScrubHoverTime(null);
    }
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDraggingScrub) {
        setIsDraggingScrub(false);
        setScrubHoverTime(null);
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDraggingScrub]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const video = videoRef.current;
      if (!video) return;

      switch (e.code) {
        case 'Space':
        case 'KeyK':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
        case 'KeyJ':
          e.preventDefault();
          skip(-10);
          break;
        case 'ArrowRight':
        case 'KeyL':
          e.preventDefault();
          skip(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(prev => {
            const next = Math.min(1, parseFloat((prev + 0.1).toFixed(1)));
            video.volume = next;
            video.muted = false;
            setIsMuted(false);
            return next;
          });
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(prev => {
            const next = Math.max(0, parseFloat((prev - 0.1).toFixed(1)));
            video.volume = next;
            if (next === 0) {
              video.muted = true;
              setIsMuted(true);
            }
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
        case 'KeyP':
          e.preventDefault();
          togglePiP();
          break;
        case 'Escape':
          e.preventDefault();
          if (isFullscreen) {
            toggleFullscreen();
          } else {
            onClose();
          }
          break;
        case 'Digit0':
        case 'Digit1':
        case 'Digit2':
        case 'Digit3':
        case 'Digit4':
        case 'Digit5':
        case 'Digit6':
        case 'Digit7':
        case 'Digit8':
        case 'Digit9': {
          e.preventDefault();
          const percent = parseInt(e.code.replace('Digit', ''), 10) / 10;
          if (duration > 0) {
            video.currentTime = duration * percent;
            setCurrentTime(video.currentTime);
          }
          break;
        }
        default:
          break;
      }
      resetControlsTimer();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, skip, toggleMute, toggleFullscreen, togglePiP, isFullscreen, onClose, duration, resetControlsTimer]);

  // Alternate web-compatible streams for switcher
  const webCompatibleStreams = useMemo(() => {
    return availableStreams.filter(s => s.id !== stream?.id && s.isWebReady);
  }, [availableStreams, stream]);

  // Switch stream preserving current playback position
  const handleInternalSwitchStream = (newStream) => {
    setShowStreamMenu(false);
    if (videoRef.current && videoRef.current.currentTime > 0) {
      pendingSeekRef.current = videoRef.current.currentTime;
    }
    if (onSwitchStream) {
      onSwitchStream(newStream);
    }
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration || 0);
    if (pendingSeekRef.current !== null && pendingSeekRef.current > 0) {
      const seekTarget = Math.min(pendingSeekRef.current, (video.duration > 0 ? video.duration : pendingSeekRef.current));
      video.currentTime = seekTarget;
      setCurrentTime(seekTarget);
      pendingSeekRef.current = null;
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferPercent = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div 
      className="player-container" 
      ref={containerRef}
      onMouseMove={resetControlsTimer}
    >
      {/* 1. YouTube Integrated Embed Player */}
      {isYouTube && youtubeVideoId ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${youtubeVideoId}?autoplay=1&enablejsapi=1&rel=0&modestbranding=1`}
          title={mediaTitle}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="video-element"
          style={{ border: 'none', width: '100%', height: '100%', zIndex: 10 }}
        />
      ) : (
        /* 2. HTML5 Video Element (MP4, HLS, WebM, Direct HTTP Range) */
        <video
          ref={videoRef}
          className="video-element"
          onClick={handleVideoClick}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => {
            setIsBuffering(false);
            setIsPlaying(true);
          }}
          onCanPlay={() => setIsBuffering(false)}
          onLoadedData={() => setIsBuffering(false)}
          onSeeking={() => setIsBuffering(true)}
          onSeeked={() => setIsBuffering(false)}
          onEnded={() => {
            setIsPlaying(false);
            if (episode && onNextEpisode) onNextEpisode(nextEpisodeData);
          }}
          onError={() => {
            const video = videoRef.current;
            // If proxy was used and failed, try falling back to direct URL once before showing error card
            if (proxyAttemptedRef.current && video && streamUrl?.startsWith('http')) {
              console.warn('Proxy stream attempt failed, trying direct stream fallback...');
              proxyAttemptedRef.current = false;
              video.src = streamUrl;
              video.play().then(() => {
                setIsPlaying(true);
                setIsBuffering(false);
                setPlaybackError(null);
              }).catch(() => {
                setIsPlaying(false);
                setIsBuffering(false);
              });
              return;
            }

            setIsBuffering(false);
            const err = video?.error;
            if (err && err.code === 4) {
              setPlaybackError('El formato de este stream (MKV, audio DTS-HD/TrueHD o HEVC) no puede ser demuxeado por el decodificador web del navegador.');
            } else if (err && err.code === 2) {
              setPlaybackError('Error de red al conectar con el servidor de streaming.');
            } else {
              setPlaybackError('No se pudo decodificar este archivo directamente en el navegador web.');
            }
          }}
        >
          {subBlobUrl && (
            <track
              key={subBlobUrl}
              src={subBlobUrl}
              kind="subtitles"
              srcLang="es"
              label="Subtítulos"
              default
            />
          )}
        </video>
      )}

      {/* Buffering Spinner Overlay */}
      {isBuffering && !playbackError && !isYouTube && (
        <div className="player-buffering-overlay">
          <div className="player-spinner"></div>
          <span style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
            Cargando flujo AIOStreams...
          </span>
        </div>
      )}

      {/* Resume Progress Prompt Toast */}
      {showResumePrompt && !isYouTube && (
        <div style={{
          position: 'absolute',
          top: '4.5rem',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          padding: '0.75rem 1.25rem',
          borderRadius: 'var(--radius-md)',
          zIndex: 45,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <Clock size={16} color="hsl(var(--primary))" />
          <span style={{ fontSize: '0.85rem', color: 'hsl(var(--foreground))' }}>
            ¿Reanudar desde <strong>{formatTime(savedResumeTime)}</strong>?
          </span>
          <Button variant="default" size="sm" onClick={handleApplyResume}>
            Reanudar
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDismissResume}>
            Desde el inicio
          </Button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* REMASTERED ALTERNATIVE PLAYBACK ASSISTANT (SHADCN CARD)                   */}
      {/* Shown when stream cannot play in web or throws decode/media error         */}
      {/* ========================================================================= */}
      {playbackError && !isYouTube && (
        <Card style={{
          position: 'absolute',
          maxWidth: '42rem',
          width: '92%',
          zIndex: 40,
          boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.9)',
          borderColor: 'rgba(245, 158, 11, 0.35)',
          backgroundColor: 'hsl(var(--card))'
        }}>
          <CardHeader style={{ textAlign: 'center', paddingBottom: '0.5rem' }}>
            <div style={{
              width: '3.5rem',
              height: '3.5rem',
              borderRadius: '50%',
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 10px',
              color: '#f59e0b'
            }}>
              <AlertCircle size={28} />
            </div>

            <CardTitle style={{ fontSize: '1.25rem', color: 'hsl(var(--foreground))' }}>
              {stream?.containerTag === 'MKV' ? 'Contenedor Matroska (.MKV) Detectado' : 'Reproductor Externo Recomendado'}
            </CardTitle>
            <CardDescription style={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))', marginTop: '4px' }}>
              {playbackError}
            </CardDescription>

            {/* Stream Characteristics Tags */}
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '8px' }}>
              <Badge variant="outline" style={{ color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.4)' }}>
                {stream?.resolution || 'HD'}
              </Badge>
              {stream?.containerTag && (
                <Badge variant="outline">
                  Contenedor: {stream.containerTag}
                </Badge>
              )}
              {stream?.audio && (
                <Badge variant="outline" style={{ color: stream.audio.includes('DTS') ? '#f59e0b' : 'inherit' }}>
                  Audio: {stream.audio}
                </Badge>
              )}
              {stream?.codec && (
                <Badge variant="outline">
                  Códec: {stream.codec}
                </Badge>
              )}
              {stream?.size && (
                <Badge variant="outline">
                  Tamaño: {stream.size}
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '0.5rem' }}>
            {/* Primary Action Buttons */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {streamUrl && (
                <Button 
                  variant="default"
                  onClick={() => handleOpenExternal('vlc')}
                  style={{ fontWeight: 600, gap: '6px' }}
                >
                  <ExternalLink size={15} /> Abrir en VLC Media Player
                </Button>
              )}

              {streamUrl && (
                <Button 
                  variant="outline"
                  onClick={() => handleOpenExternal('mpv')}
                  style={{ gap: '6px' }}
                >
                  <Tv size={15} /> Abrir en MPV
                </Button>
              )}

              {stream?.magnetUrl && (
                <a 
                  href={stream.magnetUrl} 
                  target="_blank" 
                  rel="noreferrer"
                  style={{ textDecoration: 'none' }}
                >
                  <Button variant="outline" style={{ gap: '6px', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.4)' }}>
                    <ExternalLink size={15} /> Abrir Enlace Magnet
                  </Button>
                </a>
              )}

              <Button 
                variant="outline"
                onClick={handleCopyStream}
                style={{ gap: '6px' }}
              >
                {copiedUrl ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                <span>{copiedUrl ? '¡URL Copiada!' : 'Copiar URL Directa'}</span>
              </Button>

              {streamUrl && (
                <Button 
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyCliCommand}
                  style={{ gap: '5px', fontSize: '0.78rem' }}
                  title="Copiar comando mpv '...' para la terminal"
                >
                  <Terminal size={13} />
                  <span>{copiedCli ? '¡Comando copiado!' : 'Copiar comando MPV'}</span>
                </Button>
              )}
            </div>

            {/* Instruction Tip */}
            <div style={{
              backgroundColor: 'hsl(var(--muted) / 0.5)',
              border: '1px solid hsl(var(--border))',
              borderRadius: 'var(--radius-sm)',
              padding: '0.625rem 0.875rem',
              fontSize: '0.75rem',
              color: 'hsl(var(--muted-foreground))',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              justifyContent: 'center'
            }}>
              <span>💡 Al hacer clic en <strong>VLC</strong> se descarga la lista <code>.m3u</code> que Windows asocia directamente con VLC, y además se copia el enlace a tu portapapeles para <code>Ctrl + N</code>.</span>
            </div>

            {/* Web-compatible alternatives list if available */}
            {webCompatibleStreams.length > 0 && (
              <div style={{ borderTop: '1px solid hsl(var(--border))', paddingTop: '10px' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'hsl(var(--foreground))', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={14} color="#10b981" />
                  <span>O continúa viendo en la web con estas opciones compatibles ({webCompatibleStreams.length}):</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '10rem', overflowY: 'auto' }}>
                  {webCompatibleStreams.slice(0, 3).map((alt) => (
                    <div 
                      key={alt.id}
                      onClick={() => handleInternalSwitchStream(alt)}
                      style={{
                        backgroundColor: 'hsl(var(--muted) / 0.4)',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 'var(--radius-sm)',
                        padding: '6px 10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.78rem',
                        transition: 'background-color 0.15s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Badge variant="outline" style={{ color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.4)', fontSize: '0.68rem', padding: '1px 5px' }}>
                          {alt.resolution}
                        </Badge>
                        <span style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>{alt.provider}</span>
                        {alt.language && <span>{alt.language.flag}</span>}
                        <span style={{ color: 'hsl(var(--muted-foreground))' }}>• {alt.size}</span>
                      </div>
                      <Button variant="default" size="sm" style={{ height: '1.65rem', fontSize: '0.72rem', padding: '0 8px' }}>
                        <Play size={10} fill="currentColor" /> Cambiar
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {externalFeedback && (
              <div style={{ fontSize: '0.8rem', color: '#10b981', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Check size={14} /> {externalFeedback}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Next Episode Countdown Binge Overlay */}
      {showNextPrompt && onNextEpisode && (
        <div style={{
          position: 'absolute',
          bottom: '5.5rem',
          right: '2.5rem',
          backgroundColor: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          padding: '1rem 1.25rem',
          borderRadius: 'var(--radius-md)',
          zIndex: 35,
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600 }}>
              Siguiente episodio en {nextCountdown}s...
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
              {nextEpisodeData ? `T${nextEpisodeData.season} E${nextEpisodeData.number || nextEpisodeData.episode}: ${nextEpisodeData.name || ''}` : 'Reproducir ahora'}
            </div>
          </div>
          <Button 
            variant="default" 
            size="sm"
            onClick={() => onNextEpisode && onNextEpisode(nextEpisodeData)}
          >
            <SkipForward size={14} /> Ver Ya
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            style={{ width: '1.75rem', height: '1.75rem' }}
            onClick={() => setShowNextPrompt(false)}
          >
            <X size={14} />
          </Button>
        </div>
      )}

      {/* Player Overlay Controls */}
      <div className={`player-overlay ${controlsVisible ? '' : 'idle'}`}>
        {/* Top Header Bar */}
        <div className="player-top-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'hsl(var(--foreground))' }}>
              {mediaItem.name}
            </h2>
            <div style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))', display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px', flexWrap: 'wrap' }}>
              <span>{episode ? `T${episode.season} E${episode.number || episode.episode}: ${episode.name}` : mediaItem.year}</span>
              <span>•</span>
              <Badge variant="outline" style={{ fontSize: '0.7rem' }}>
                {stream.resolution}
              </Badge>
              {stream.provider && (
                <Badge variant="outline" style={{ fontSize: '0.7rem' }}>
                  {stream.provider}
                </Badge>
              )}
              {stream.debridService && (
                <Badge variant="success" style={{ fontSize: '0.7rem' }}>
                  {stream.debridService}
                </Badge>
              )}
              {isYouTube ? (
                <Badge variant="outline" style={{ fontSize: '0.7rem', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}>
                  YouTube Oficial
                </Badge>
              ) : isMkv ? (
                <Badge variant="secondary" style={{ fontSize: '0.7rem', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.4)' }}>
                  MKV (Alta Fidelidad)
                </Badge>
              ) : null}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {externalFeedback && (
              <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                <Check size={12} /> {externalFeedback}
              </span>
            )}

            {streamUrl && !isYouTube && (
              <Button 
                variant="outline" 
                size="sm" 
                style={{ fontSize: '0.75rem', gap: '4px', height: '2rem' }}
                onClick={() => handleOpenExternal()}
                title="Abrir este stream en tu reproductor local (descarga .m3u y copia URL)"
              >
                <ExternalLink size={12} />
                <span>VLC / MPV</span>
              </Button>
            )}

            <Button variant="outline" size="icon" className="player-close-btn" onClick={onClose} title="Cerrar reproductor (Esc)">
              <X size={16} />
            </Button>
          </div>
        </div>

        {/* Center Big Play Button (when paused, not buffering, and not YouTube) */}
        {!isPlaying && !playbackError && !isBuffering && !isYouTube && (
          <button 
            onClick={togglePlay}
            style={{
              alignSelf: 'center',
              width: '4.25rem',
              height: '4.25rem',
              borderRadius: '9999px',
              backgroundColor: 'hsl(var(--primary))',
              color: 'hsl(var(--primary-foreground))',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 0 30px rgba(0,0,0,0.6)',
              transition: 'transform 0.15s ease'
            }}
          >
            <Play size={26} fill="currentColor" />
          </button>
        )}

        {/* Bottom Control Deck (Only for HTML5 Video, YouTube handles its own internal controls) */}
        {!isYouTube && (
          <div>
            {/* Interactive Scrub Bar */}
            <div 
              className="scrub-container" 
              ref={scrubBarRef}
              onMouseDown={handleScrubMouseDown}
              onMouseMove={handleScrubMouseMove}
              onMouseLeave={handleScrubMouseLeave}
            >
              {/* Hover Tooltip */}
              {scrubHoverTime !== null && (
                <div 
                  className="scrub-tooltip"
                  style={{ left: `${scrubHoverPos}px` }}
                >
                  {formatTime(scrubHoverTime)}
                </div>
              )}
              <div className="scrub-buffer" style={{ width: `${bufferPercent}%` }}></div>
              <div className="scrub-progress" style={{ width: `${progressPercent}%` }}>
                <div className="scrub-thumb"></div>
              </div>
            </div>

            {/* Controls Row */}
            <div className="player-controls-row">
              {/* Left Controls */}
              <div className="player-left-controls">
                <Button variant="ghost" size="icon" onClick={togglePlay} title={isPlaying ? 'Pausar (Espacio)' : 'Reproducir (Espacio)'}>
                  {isPlaying ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}
                </Button>

                <Button variant="ghost" size="icon" onClick={() => skip(-10)} title="Retroceder 10s (← / J)">
                  <RotateCcw size={16} />
                </Button>

                <Button variant="ghost" size="icon" onClick={() => skip(10)} title="Avanzar 10s (→ / L)">
                  <RotateCw size={16} />
                </Button>

                {episode && onNextEpisode && (
                  <Button variant="ghost" size="icon" onClick={() => onNextEpisode(nextEpisodeData)} title="Siguiente episodio">
                    <SkipForward size={16} />
                  </Button>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Button variant="ghost" size="icon" onClick={toggleMute} title="Silenciar / Activar sonido (M)">
                    {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </Button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    style={{ width: '4.5rem', accentColor: 'hsl(var(--foreground))', cursor: 'pointer' }}
                  />
                </div>

                <div className="player-time-display">
                  <span>{formatTime(currentTime)}</span>
                  <span style={{ margin: '0 4px', color: 'hsl(var(--muted-foreground))' }}>/</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Right Controls */}
              <div className="player-right-controls" style={{ position: 'relative' }}>
                {/* Speed Switcher */}
                <div style={{ position: 'relative' }}>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => { setShowSpeedMenu(!showSpeedMenu); setShowSubMenu(false); setShowStreamMenu(false); setShowEpisodeMenu(false); }}
                    title="Velocidad de reproducción"
                    style={{ fontSize: '0.75rem', fontWeight: 600 }}
                  >
                    {playbackRate}x
                  </Button>

                  {showSpeedMenu && (
                    <div style={{
                      position: 'absolute',
                      bottom: '3rem',
                      right: 0,
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 'var(--radius-md)',
                      padding: '4px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                      minWidth: '7.5rem',
                      zIndex: 60
                    }}>
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                        <div
                          key={rate}
                          onClick={() => handleSpeedChange(rate)}
                          style={{
                            padding: '5px 10px',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            color: playbackRate === rate ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                            fontWeight: playbackRate === rate ? 700 : 400,
                            display: 'flex',
                            justifyContent: 'space-between',
                            backgroundColor: playbackRate === rate ? 'hsl(var(--accent))' : 'transparent'
                          }}
                        >
                          <span>{rate}x</span>
                          {playbackRate === rate && <Check size={12} />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Subtitles Menu */}
                <div style={{ position: 'relative' }}>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => { setShowSubMenu(!showSubMenu); setShowSpeedMenu(false); setShowStreamMenu(false); setShowEpisodeMenu(false); }}
                    title="Subtítulos"
                  >
                    <MessageSquare size={16} />
                  </Button>

                  {showSubMenu && (
                    <div style={{
                      position: 'absolute',
                      bottom: '3rem',
                      right: 0,
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 'var(--radius-md)',
                      padding: '10px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                      width: '18rem',
                      maxHeight: '20rem',
                      overflowY: 'auto',
                      zIndex: 60
                    }}>
                      <div style={{ fontWeight: 600, fontSize: '0.8125rem', marginBottom: '6px', color: 'hsl(var(--foreground))' }}>
                        Subtítulos (OpenSubtitles)
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                        <span>Sincronización:</span>
                        <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                          <Button variant="outline" size="sm" style={{ width: '1.5rem', height: '1.5rem', padding: 0 }} onClick={() => handleAdjustSubDelay(-0.5)}>-</Button>
                          <span>{subDelay > 0 ? `+${subDelay}` : subDelay}s</span>
                          <Button variant="outline" size="sm" style={{ width: '1.5rem', height: '1.5rem', padding: 0 }} onClick={() => handleAdjustSubDelay(0.5)}>+</Button>
                        </div>
                      </div>

                      <div 
                        onClick={() => handleSelectSubtitle('off')}
                        style={{
                          padding: '6px 8px',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          color: selectedSubId === 'off' ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                          fontWeight: selectedSubId === 'off' ? 600 : 400,
                          backgroundColor: selectedSubId === 'off' ? 'hsl(var(--accent))' : 'transparent'
                        }}
                      >
                        Desactivados
                      </div>

                      {subtitlesList.map((s) => (
                        <div 
                          key={s.id}
                          onClick={() => handleSelectSubtitle(s.id)}
                          style={{
                            padding: '6px 8px',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            color: selectedSubId === s.id ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: selectedSubId === s.id ? 'hsl(var(--accent))' : 'transparent'
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {s.label}
                          </span>
                          {selectedSubId === s.id && <Check size={12} />}
                        </div>
                      ))}

                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        marginTop: '6px',
                        padding: '5px 8px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px dashed hsl(var(--border))',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        color: 'hsl(var(--muted-foreground))'
                      }}>
                        <Upload size={12} /> Cargar archivo .SRT local
                        <input type="file" accept=".srt,.vtt" onChange={handleUploadSubtitle} style={{ display: 'none' }} />
                      </label>
                    </div>
                  )}
                </div>

                {/* Episode Picker Popover (for Series) */}
                {allEpisodes.length > 1 && onSelectEpisode && (
                  <div style={{ position: 'relative' }}>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => { 
                        setShowEpisodeMenu(!showEpisodeMenu); 
                        setShowSubMenu(false); 
                        setShowSpeedMenu(false); 
                        setShowStreamMenu(false); 
                      }}
                      title="Episodios de la serie"
                    >
                      <Film size={16} />
                    </Button>

                    {showEpisodeMenu && (
                      <div style={{
                        position: 'absolute',
                        bottom: '3rem',
                        right: 0,
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 'var(--radius-md)',
                        padding: '8px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                        width: '20rem',
                        maxHeight: '22rem',
                        overflowY: 'auto',
                        zIndex: 60
                      }}>
                        <div style={{ fontWeight: 600, fontSize: '0.8125rem', marginBottom: '8px', color: 'hsl(var(--foreground))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>Episodios ({allEpisodes.length})</span>
                          {episode && (
                            <span style={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))' }}>
                              T{episode.season} E{episode.number || episode.episode}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          {allEpisodes.map((ep) => {
                            const isCurrent = episode && (
                              ep.id === episode.id ||
                              (ep.season === episode.season && (ep.number || ep.episode) === (episode.number || episode.episode))
                            );
                            return (
                              <div
                                key={ep.id || `${ep.season}-${ep.number || ep.episode}`}
                                onClick={() => {
                                  setShowEpisodeMenu(false);
                                  onSelectEpisode(ep);
                                }}
                                style={{
                                  padding: '6px 8px',
                                  borderRadius: 'var(--radius-sm)',
                                  cursor: 'pointer',
                                  backgroundColor: isCurrent ? 'hsl(var(--accent))' : 'transparent',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  fontSize: '0.78rem'
                                }}
                              >
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', overflow: 'hidden' }}>
                                  <Badge variant={isCurrent ? "default" : "outline"} style={{ fontSize: '0.65rem', flexShrink: 0 }}>
                                    T{ep.season} E{ep.number || ep.episode}
                                  </Badge>
                                  <span style={{ 
                                    whiteSpace: 'nowrap', 
                                    overflow: 'hidden', 
                                    textOverflow: 'ellipsis',
                                    color: isCurrent ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                                    fontWeight: isCurrent ? 600 : 400
                                  }}>
                                    {ep.name || ep.title || `Episodio ${ep.number || ep.episode}`}
                                  </span>
                                </div>
                                {isCurrent && <Check size={13} color="hsl(var(--primary))" />}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Stream Switcher Popover */}
                {availableStreams.length > 1 && (
                  <div style={{ position: 'relative' }}>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => { 
                        setShowStreamMenu(!showStreamMenu); 
                        setShowSubMenu(false); 
                        setShowSpeedMenu(false); 
                        setShowEpisodeMenu(false); 
                      }}
                      title="Cambiar de stream AIOStreams"
                    >
                      <Sparkles size={16} />
                    </Button>

                    {showStreamMenu && (
                      <div style={{
                        position: 'absolute',
                        bottom: '3rem',
                        right: 0,
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 'var(--radius-md)',
                        padding: '8px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                        width: '22rem',
                        maxHeight: '22rem',
                        overflowY: 'auto',
                        zIndex: 60
                      }}>
                        <div style={{ fontWeight: 600, fontSize: '0.8125rem', marginBottom: '8px', color: 'hsl(var(--foreground))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>Streams Disponibles ({availableStreams.length})</span>
                          <span style={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))' }}>Mantiene el minuto</span>
                        </div>
                        {availableStreams.map((s) => {
                          const isCurrentStream = s.id === stream?.id;
                          return (
                            <div
                              key={s.id}
                              onClick={() => handleInternalSwitchStream(s)}
                              style={{
                                padding: '8px',
                                borderRadius: 'var(--radius-sm)',
                                marginBottom: '5px',
                                cursor: 'pointer',
                                backgroundColor: isCurrentStream ? 'hsl(var(--accent))' : 'hsl(var(--card))',
                                border: `1px solid ${isCurrentStream ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
                                fontSize: '0.78rem',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
                                  <Badge variant="secondary" style={{ fontSize: '0.68rem', padding: '1px 5px' }}>
                                    {s.resolution}
                                  </Badge>
                                  {s.provider && (
                                    <Badge variant="outline" style={{ fontSize: '0.68rem', padding: '1px 5px' }}>
                                      {s.provider}
                                    </Badge>
                                  )}
                                  {s.language && s.language.flag && (
                                    <span style={{ fontSize: '0.75rem' }} title={s.language.label}>
                                      {s.language.flag}
                                    </span>
                                  )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.72rem' }}>{s.size}</span>
                                  {isCurrentStream && <Check size={12} color="hsl(var(--primary))" />}
                                </div>
                              </div>
                              <div style={{ color: 'hsl(var(--muted-foreground))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '4px', fontSize: '0.72rem' }}>
                                {s.mainTitle || s.rawTitle}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Picture in Picture */}
                {document.pictureInPictureEnabled && (
                  <Button variant="ghost" size="icon" onClick={togglePiP} title="Imagen dentro de imagen (P)">
                    <PictureInPicture size={16} color={isPiP ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))'} />
                  </Button>
                )}

                {/* Fullscreen Button */}
                <Button variant="ghost" size="icon" onClick={toggleFullscreen} title="Pantalla completa (F)">
                  {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
