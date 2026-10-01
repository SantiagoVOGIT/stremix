import React, { useState } from 'react';
import { Play, Star, Bookmark, Check } from 'lucide-react';
import { isFavorite, toggleFavorite } from '../services/storage';

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
        <div className="card-badges">
          {rating ? (
            <span className="card-rating-badge">
              <Star size={11} fill="#fbbf24" />
              <span>{rating}</span>
            </span>
          ) : (
            <span></span>
          )}
          <span className="card-type-badge">{typeText}</span>
        </div>

        {/* Hover Overlay with Quick Actions */}
        <div className="card-overlay">
          <div className="card-quick-actions">
            <button className="quick-play-btn" onClick={handlePlayClick}>
              <Play size={15} fill="#fff" />
              <span>Ver</span>
            </button>
            <button 
              className={`quick-fav-btn ${favorite ? 'active' : ''}`}
              onClick={handleToggleFav}
              title={favorite ? 'Quitar de guardados' : 'Guardar en biblioteca'}
            >
              {favorite ? <Check size={16} /> : <Bookmark size={16} />}
            </button>
          </div>
        </div>
      </div>

      <div className="card-info">
        <h3 className="card-title" title={item.name}>{item.name}</h3>
        <div className="card-meta-row">
          <span>{year}</span>
          {item.genres && item.genres.length > 0 && (
            <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.genres[0]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
