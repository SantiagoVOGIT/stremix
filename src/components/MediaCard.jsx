import React, { useState } from 'react';
import { Play, Star, Bookmark, Check } from 'lucide-react';
import { isFavorite, toggleFavorite } from '../services/storage';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

export const MediaCard = ({ item, onSelect, onQuickPlay }) => {
  const [favorite, setFavorite] = useState(isFavorite(item.id));
  const posterUrl = item.poster || 'https://images.metahub.space/poster/medium/default.png';
  const rating = item.imdbRating || (item.popularity ? (item.popularity > 10 ? '7.8' : item.popularity.toFixed(1)) : null);
  const year = item.year || item.releaseInfo || '';
  const typeText = item.type === 'series' ? 'Serie' : 'Película';

  const handleToggleFav = (e) => {
    e.stopPropagation();
    const newState = toggleFavorite(item);
    setFavorite(newState);
  };

  const handlePlayClick = (e) => {
    e.stopPropagation();
    if (onQuickPlay) {
      onQuickPlay(item);
    } else {
      onSelect(item);
    }
  };

  return (
    <div className="media-card" onClick={() => onSelect(item)}>
      <div className="poster-wrapper">
        <img 
          src={posterUrl} 
          alt={item.name} 
          className="poster-img"
          loading="lazy"
          onError={(e) => {
            e.target.src = 'https://images.metahub.space/poster/medium/default.png';
          }}
        />

        {/* Top Badges */}
        <div style={{
          position: 'absolute',
          top: '0.5rem',
          left: '0.5rem',
          right: '0.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 3,
          pointerEvents: 'none'
        }}>
          {rating ? (
            <Badge variant="secondary" style={{ backgroundColor: 'rgba(9, 9, 11, 0.85)', backdropFilter: 'blur(4px)', color: '#fbbf24', fontSize: '0.7rem', padding: '1px 6px' }}>
              <Star size={10} fill="#fbbf24" />
              <span>{rating}</span>
            </Badge>
          ) : (
            <span></span>
          )}
          <Badge variant="outline" style={{ backgroundColor: 'rgba(9, 9, 11, 0.85)', backdropFilter: 'blur(4px)', fontSize: '0.65rem', textTransform: 'uppercase', padding: '1px 6px' }}>
            {typeText}
          </Badge>
        </div>

        {/* Hover Overlay */}
        <div className="card-overlay">
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <Button 
              variant="default"
              size="sm"
              style={{ flex: 1, fontSize: '0.8rem' }}
              onClick={handlePlayClick}
            >
              <Play size={13} fill="currentColor" />
              <span>Ver</span>
            </Button>
            <Button 
              variant={favorite ? 'default' : 'secondary'}
              size="icon"
              style={{ width: '1.85rem', height: '1.85rem', flexShrink: 0 }}
              onClick={handleToggleFav}
              title={favorite ? 'Quitar de guardados' : 'Guardar en biblioteca'}
            >
              {favorite ? <Check size={13} /> : <Bookmark size={13} />}
            </Button>
          </div>
        </div>
      </div>

      <div className="card-info">
        <h3 className="card-title" title={item.name}>{item.name}</h3>
        <div className="card-meta-row">
          <span>{year}</span>
          {item.genres && item.genres.length > 0 && (
            <span style={{ maxWidth: '6rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.genres[0]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
