import React, { useState } from 'react';
import { 
  Play, 
  Copy, 
  Check, 
  ExternalLink, 
  HardDrive, 
  Users, 
  Volume2, 
  ShieldCheck, 
  Film,
  Zap,
  Sparkles,
  Tv
} from 'lucide-react';
import { getSettings } from '../services/storage';
import { launchExternalPlayer } from '../services/playerUtils';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

const YoutubeIcon = ({ size = 11, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
    <path d="m10 15 5-3-5-3z" fill={color} />
  </svg>
);

export const StreamCard = ({ stream, onPlay }) => {
  const [copied, setCopied] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const settings = getSettings();

  const handleCopy = (e) => {
    e.stopPropagation();
    const url = stream.url || (stream.infoHash ? `magnet:?xt=urn:btih:${stream.infoHash}` : '');
    if (url) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setFeedbackMsg('Enlace copiado al portapapeles');
      setTimeout(() => {
        setCopied(false);
        setFeedbackMsg('');
      }, 2500);
    }
  };

  const handleOpenExternal = (e, playerOverride = null) => {
    e.stopPropagation();
    const url = stream.url || (stream.infoHash ? `magnet:?xt=urn:btih:${stream.infoHash}` : '');
    if (!url) return;

    const chosen = playerOverride || settings.externalPlayer || 'vlc';
    const res = launchExternalPlayer(url, stream.mainTitle, chosen);
    setFeedbackMsg(res.message);
    setTimeout(() => setFeedbackMsg(''), 4000);
  };

  const isVlcRecommended = stream.recommendedPlayer === 'vlc' || !stream.isWebReady;
  const isYouTube = stream.formatType === 'youtube' || stream.ytId;

  return (
    <div 
      className={`stream-card ${isVlcRecommended ? 'vlc-recommended' : 'web-ready'}`} 
      onClick={() => onPlay(stream)}
      style={{
        borderLeft: isVlcRecommended 
          ? '3px solid #f59e0b' 
          : isYouTube 
            ? '3px solid #ef4444' 
            : '3px solid #10b981'
      }}
    >
      <div className="stream-main-info">
        {/* Top Badges Row: Resolution, Provider, Debrid, Language, HDR, Source */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {/* Resolution Badge */}
          <Badge 
            variant="outline" 
            style={{ 
              fontWeight: 700,
              fontSize: '0.75rem',
              color: stream.resolution === '4K' ? '#f59e0b' : stream.resolution === '1080p' ? '#38bdf8' : 'hsl(var(--foreground))',
              borderColor: stream.resolution === '4K' ? 'rgba(245, 158, 11, 0.4)' : stream.resolution === '1080p' ? 'rgba(56, 189, 248, 0.4)' : 'hsl(var(--border))',
              backgroundColor: stream.resolution === '4K' ? 'rgba(245, 158, 11, 0.08)' : stream.resolution === '1080p' ? 'rgba(56, 189, 248, 0.08)' : 'transparent'
            }}
          >
            {stream.resolution}
          </Badge>

          {/* Provider Badge */}
          {stream.provider && (
            <Badge 
              variant="outline" 
              style={{ 
                fontSize: '0.68rem', 
                fontWeight: 600,
                color: 'hsl(var(--primary))',
                borderColor: 'hsl(var(--primary) / 0.35)',
                backgroundColor: 'hsl(var(--primary) / 0.08)'
              }}
            >
              <Sparkles size={10} style={{ marginRight: '3px' }} />
              {stream.provider}
            </Badge>
          )}

          {/* Debrid Cached Badge */}
          {stream.isCached && (
            <Badge variant="success" style={{ fontSize: '0.7rem' }}>
              <ShieldCheck size={11} />
              {stream.debridService ? `[${stream.debridService}+] Debrid` : 'Debrid Caché'}
            </Badge>
          )}

          {/* Language Flag & Label */}
          {stream.language && (
            <Badge 
              variant="outline" 
              style={{ 
                fontSize: '0.68rem', 
                color: '#10b981', 
                borderColor: 'rgba(16, 185, 129, 0.4)', 
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                fontWeight: 600 
              }}
              title={`Pista de idioma: ${stream.language.label}`}
            >
              <span>{stream.language.flag}</span>
              <span>{stream.language.label}</span>
            </Badge>
          )}

          {/* Visual Tags (HDR, Dolby Vision, IMAX, 10-bit) */}
          {stream.hdrTag && (
            <Badge variant="outline" style={{ fontSize: '0.65rem', color: '#ec4899', borderColor: 'rgba(236, 72, 153, 0.4)', backgroundColor: 'rgba(236, 72, 153, 0.08)', fontWeight: 600 }}>
              {stream.hdrTag}
            </Badge>
          )}

          {/* Source Release (REMUX, BluRay, WEB-DL) */}
          {stream.sourceRelease && (
            <Badge variant="outline" style={{ fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))', borderColor: 'hsl(var(--border))' }}>
              {stream.sourceRelease}
            </Badge>
          )}

          {/* Container Tag */}
          {stream.containerTag && (
            <Badge 
              variant="outline" 
              style={{ 
                fontSize: '0.65rem', 
                color: stream.containerTag === 'MKV' ? '#f59e0b' : 'hsl(var(--foreground))',
                borderColor: stream.containerTag === 'MKV' ? 'rgba(245, 158, 11, 0.35)' : 'hsl(var(--border))'
              }}
              title={`Contenedor multimedia: ${stream.containerTag}`}
            >
              <Film size={9} style={{ marginRight: '3px' }} />
              {stream.containerTag}
            </Badge>
          )}
        </div>

        {/* Stream Main Title */}
        <div className="stream-title-text" title={stream.rawTitle || stream.mainTitle}>
          {stream.mainTitle}
        </div>

        {/* Enhanced Bottom Meta Tags Row: Stream Type, Codec, Audio, Size, Seeds, Playability */}
        <div className="stream-details-row">
          {/* Tipo de Stream */}
          <span className="stream-detail-pill" title="Tipo de flujo / infraestructura">
            <Zap size={11} color="hsl(var(--primary))" />
            <span>{stream.streamType || (stream.isCached ? 'Debrid Stream' : 'HTTP Directo')}</span>
          </span>

          {/* Códec de Vídeo */}
          {stream.codec && (
            <span className="stream-detail-pill" title="Códec de compresión de vídeo">
              <span>{stream.codec}</span>
            </span>
          )}

          {/* Audio y Canales */}
          {stream.audio && (
            <span 
              className="stream-detail-pill" 
              style={{ 
                color: (stream.audio.includes('DTS') || stream.audio.includes('TrueHD') || stream.audio.includes('Atmos')) ? '#f59e0b' : 'inherit'
              }}
              title="Pista de audio y canales nativos"
            >
              <Volume2 size={11} />
              <span>{stream.audio}</span>
            </span>
          )}

          {/* Peso / Tamaño */}
          {stream.size && (
            <span className="stream-detail-pill" title="Tamaño del archivo en el servidor">
              <HardDrive size={11} />
              <span>{stream.size}</span>
            </span>
          )}

          {/* Semillas si aplica */}
          {stream.seeders !== null && (
            <span 
              className="stream-detail-pill" 
              style={{ color: stream.seeders > 50 ? '#10b981' : 'inherit' }}
              title="Disponibilidad P2P / semillas activas"
            >
              <Users size={11} />
              <span>{stream.seeders} seeds</span>
            </span>
          )}

          {/* Compatibilidad & Sugerencia de Reproducción */}
          {isYouTube ? (
            <span 
              className="stream-detail-pill" 
              style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.35)', backgroundColor: 'rgba(239, 68, 68, 0.08)' }}
              title="Vídeo oficial con reproductor integrado de YouTube"
            >
              <YoutubeIcon size={11} color="#ef4444" />
              <span>YouTube Integrado</span>
            </span>
          ) : stream.isWebReady ? (
            <span 
              className="stream-detail-pill" 
              style={{ color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.35)', backgroundColor: 'rgba(16, 185, 129, 0.08)', fontWeight: 600 }}
              title={stream.recommendationReason || "Compatible nativamente con el reproductor del navegador"}
            >
              <Check size={11} />
              <span>Web Compatible</span>
            </span>
          ) : (
            <span 
              className="stream-detail-pill" 
              style={{ color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.4)', backgroundColor: 'rgba(245, 158, 11, 0.1)', fontWeight: 600 }}
              title={`${stream.recommendationReason}: ${stream.detailedReasons?.join(' • ') || ''}`}
            >
              <ExternalLink size={11} />
              <span>{stream.badgeText || 'VLC Recomendado'}</span>
            </span>
          )}
        </div>

        {/* Feedback notification toast under row */}
        {feedbackMsg && (
          <div style={{
            fontSize: '0.72rem',
            color: '#10b981',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginTop: '2px',
            animation: 'fadeIn 0.15s ease'
          }}>
            <Check size={11} /> {feedbackMsg}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {/* Copy Button */}
        <Button 
          variant="ghost" 
          size="icon" 
          style={{ width: '2rem', height: '2rem' }}
          onClick={handleCopy} 
          title={copied ? '¡Copiado!' : stream.magnetUrl ? 'Copiar enlace Magnet Torrent' : 'Copiar enlace directo de stream'}
        >
          {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
        </Button>

        {/* VLC / External Player Button if stream has direct URL */}
        {stream.url && (
          <Button 
            variant={isVlcRecommended ? 'default' : 'outline'} 
            size="sm"
            style={{ 
              fontSize: '0.75rem', 
              gap: '4px', 
              height: '2rem', 
              padding: '0 0.65rem',
              backgroundColor: isVlcRecommended ? '#d97706' : undefined,
              color: isVlcRecommended ? '#ffffff' : undefined,
              borderColor: isVlcRecommended ? '#b45309' : undefined
            }}
            onClick={(e) => handleOpenExternal(e, 'vlc')} 
            title="Abrir en VLC Media Player (descarga playlist .M3U y copia URL al portapapeles)"
          >
            <ExternalLink size={12} />
            <span>VLC</span>
          </Button>
        )}

        {/* MPV Button for terminal or desktop MPV */}
        {stream.url && isVlcRecommended && (
          <Button 
            variant="outline" 
            size="sm"
            style={{ 
              fontSize: '0.75rem', 
              gap: '4px', 
              height: '2rem', 
              padding: '0 0.55rem'
            }}
            onClick={(e) => handleOpenExternal(e, 'mpv')} 
            title="Abrir en MPV Player o copiar comando CLI"
          >
            <Tv size={12} />
            <span>MPV</span>
          </Button>
        )}

        {/* Magnet button if pure Torrent without direct URL */}
        {stream.magnetUrl && !stream.url && (
          <a
            href={stream.magnetUrl}
            onClick={(e) => e.stopPropagation()}
            style={{ textDecoration: 'none' }}
            title="Abrir en cliente BitTorrent / Magnet"
          >
            <Button 
              variant="outline"
              size="sm"
              style={{ fontSize: '0.75rem', gap: '4px', height: '2rem', padding: '0 0.65rem', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.4)' }}
            >
              <ExternalLink size={12} />
              <span>Magnet</span>
            </Button>
          </a>
        )}

        {/* Main Play / Watch Button */}
        <Button 
          variant={isVlcRecommended ? 'outline' : 'default'}
          size="sm"
          className="stream-play-btn"
          style={{ 
            fontSize: '0.8rem', 
            height: '2rem', 
            padding: '0 0.85rem',
            fontWeight: 600
          }}
          onClick={(e) => {
            e.stopPropagation();
            onPlay(stream);
          }}
          title={isVlcRecommended ? 'Probar en reproductor web de Stremix con asistente de compatibilidad' : 'Reproducir inmediatamente en Stremix'}
        >
          <Play size={13} fill="currentColor" />
          <span>{isVlcRecommended ? 'Probar' : 'Ver'}</span>
        </Button>
      </div>
    </div>
  );
};
