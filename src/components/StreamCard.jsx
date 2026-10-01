import React, { useState } from 'react';
import { Play, Copy, Check, ExternalLink, HardDrive, Users, Volume2 } from 'lucide-react';
import { getSettings } from '../services/storage';

export const StreamCard = ({ stream, onPlay }) => {
  const [copied, setCopied] = useState(false);
  const settings = getSettings();

  const handleCopy = (e) => {
    e.stopPropagation();
    const url = stream.url || (stream.infoHash ? `magnet:?xt=urn:btih:${stream.infoHash}` : '');
    if (url) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenExternal = (e) => {
    e.stopPropagation();
    const url = stream.url;
    if (!url) return;

    const player = settings.externalPlayer || 'vlc';
    if (player === 'vlc') {
      window.location.href = `vlc://${url}`;
    } else if (player === 'mpv') {
      window.location.href = `mpv://${url}`;
    } else {
      window.open(url, '_blank');
    }
  };

  const resClass = stream.resolution === '4K' 
    ? 'res-4k' 
    : stream.resolution === '1080p' 
    ? 'res-1080p' 
    : 'res-720p';

  return (
    <div className="stream-card" onClick={() => onPlay(stream)}>
      <div className="stream-main-info">
        {/* Badges Row */}
        <div className="stream-header-row">
          <span className={`badge-res ${resClass}`}>
            {stream.resolution}
          </span>

          {stream.isCached && (
            <span className="badge-debrid">
              {stream.debridService ? `⚡ [${stream.debridService}+] Instantáneo` : '⚡ Debrid En Caché'}
            </span>
          )}

          <span className="badge-provider">
            {stream.provider || 'AIOStreams'}
          </span>

          {stream.codec && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {stream.codec}
            </span>
          )}
        </div>

        {/* Title */}
        <div className="stream-title-text" title={stream.rawTitle || stream.mainTitle}>
          {stream.mainTitle}
        </div>

        {/* Specs Details Row */}
        <div className="stream-details-row">
          {stream.size && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <HardDrive size={13} /> {stream.size}
            </span>
          )}

          {stream.seeders !== null && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: stream.seeders > 50 ? '#10b981' : 'var(--text-dim)' }}>
              <Users size={13} /> {stream.seeders} seeds
            </span>
          )}

          {stream.audio && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Volume2 size={13} /> {stream.audio}
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="stream-actions">
        <button 
          className="icon-btn" 
          onClick={handleCopy} 
          title={copied ? '¡Copiado!' : 'Copiar enlace directo de stream'}
          style={{ width: '36px', height: '36px' }}
        >
          {copied ? <Check size={16} color="var(--accent-emerald)" /> : <Copy size={16} />}
        </button>

        {stream.url && (
          <button 
            className="icon-btn" 
            onClick={handleOpenExternal} 
            title="Abrir en reproductor externo (VLC / MPV)"
            style={{ width: '36px', height: '36px' }}
          >
            <ExternalLink size={16} />
          </button>
        )}

        <button 
          className="stream-play-btn"
          onClick={(e) => {
            e.stopPropagation();
            onPlay(stream);
          }}
        >
          <Play size={15} fill="#fff" />
          <span>Reproducir</span>
        </button>
      </div>
    </div>
  );
};
