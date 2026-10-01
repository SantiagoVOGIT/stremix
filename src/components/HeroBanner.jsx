import React, { useState, useEffect } from 'react';
import { Play, Info, Star, ChevronLeft, ChevronRight } from 'lucide-react';

export const HeroBanner = ({ items = [], onSelectMedia, onPlayMedia }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Auto-rotation every 8 seconds
  useEffect(() => {
    if (!items || items.length === 0 || isPaused) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [items, isPaused]);

  if (!items || items.length === 0) return null;

  const current = items[currentIndex] || items[0];
  const backdrop = current.background || current.poster;
  const rating = current.imdbRating || current.popularity?.toFixed(1) || '8.5';
  const genres = current.genres || current.genre || [];

  const handlePrev = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  const handleNext = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };

  return (
    <div 
      className="hero-banner"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background Artwork */}
      {backdrop && (
        <img 
          src={backdrop} 
          alt={current.name} 
          className="hero-backdrop-img"
          key={current.id}
          onError={(e) => {
            e.target.style.display = 'none';
          }}
        />
      )}
      <div className="hero-gradient-overlay"></div>

      {/* Main Content Info */}
      <div className="hero-content" key={`content-${current.id}`}>
        <div className="hero-badge-group">
          <span className="hero-type-badge">
            {current.type === 'series' ? 'Serie Destacada' : 'Película Destacada'}
          </span>
          {rating && (
            <span className="hero-rating-badge">
              <Star size={14} fill="#fbbf24" />
              <span>{rating} IMDb</span>
            </span>
          )}
          <span className="hero-year-badge">
            {current.year || current.releaseInfo || '2024'}
          </span>
          {current.runtime && (
            <span className="hero-year-badge">• {current.runtime}</span>
          )}
        </div>

        <h1 className="hero-title">{current.name}</h1>

        {genres.length > 0 && (
          <div className="hero-genres">
            {genres.slice(0, 4).map((g, i) => (
              <span key={i} className="hero-genre-tag">{g}</span>
            ))}
          </div>
        )}

        <p className="hero-description">
          {current.description || 'Disfruta de la mejor calidad de streaming con enlaces optimizados y filtrados por AIOStreams en Stremix.'}
        </p>

        <div className="hero-btn-group">
          <button 
            className="btn-primary"
            onClick={() => onPlayMedia ? onPlayMedia(current) : onSelectMedia(current)}
          >
            <Play size={18} fill="#fff" />
            <span>Reproducir Ahora</span>
          </button>
          <button 
            className="btn-secondary"
            onClick={() => onSelectMedia(current)}
          >
            <Info size={18} />
            <span>Ver Ficha y Enlaces</span>
          </button>
        </div>
      </div>

      {/* Carousel Navigation Controls */}
      <div className="hero-controls">
        <button className="hero-nav-btn" onClick={handlePrev} title="Anterior">
          <ChevronLeft size={20} />
        </button>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)', padding: '0 4px' }}>
          {currentIndex + 1} / {items.length}
        </span>
        <button className="hero-nav-btn" onClick={handleNext} title="Siguiente">
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
};
