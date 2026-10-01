import React, { useState, useEffect } from 'react';
import { Play, Info, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

export const HeroBanner = ({ items = [], onSelectMedia, onPlayMedia }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

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
  const rating = current.imdbRating || current.popularity?.toFixed(1) || '8.2';
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
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      )}
      <div className="hero-gradient-overlay"></div>

      {/* Main Content Info */}
      <div className="hero-content" key={`content-${current.id}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Badge variant="default" style={{ fontSize: '0.7rem' }}>
            {current.type === 'series' ? 'Serie Destacada' : 'Película Destacada'}
          </Badge>
          {rating && (
            <Badge variant="secondary" style={{ color: '#fbbf24', borderColor: 'hsl(var(--border))' }}>
              <Star size={12} fill="#fbbf24" />
              <span>{rating} IMDb</span>
            </Badge>
          )}
          <span style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>
            {current.year || current.releaseInfo || '2024'}
          </span>
          {current.runtime && (
            <span style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>
              • {current.runtime}
            </span>
          )}
        </div>

        <h1 className="hero-title">{current.name}</h1>

        {genres.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {genres.slice(0, 4).map((g, i) => (
              <Badge key={i} variant="outline" style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                {g}
              </Badge>
            ))}
          </div>
        )}

        <p className="hero-description">
          {current.description || 'Explora y disfruta de la mejor calidad de streaming con enlaces optimizados por AIOStreams en Stremix.'}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '0.5rem' }}>
          <Button 
            variant="default"
            size="lg"
            onClick={() => onPlayMedia ? onPlayMedia(current) : onSelectMedia(current)}
          >
            <Play size={16} fill="currentColor" />
            <span>Reproducir</span>
          </Button>

          <Button 
            variant="secondary"
            size="lg"
            onClick={() => onSelectMedia(current)}
          >
            <Info size={16} />
            <span>Ficha & Enlaces</span>
          </Button>
        </div>
      </div>

      {/* Carousel Controls */}
      <div style={{
        position: 'absolute',
        bottom: '2rem',
        right: '3.5rem',
        zIndex: 5,
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <Button variant="outline" size="icon" onClick={handlePrev} title="Anterior">
          <ChevronLeft size={16} />
        </Button>
        <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', padding: '0 4px', fontFamily: 'var(--font-mono)' }}>
          {currentIndex + 1} / {items.length}
        </span>
        <Button variant="outline" size="icon" onClick={handleNext} title="Siguiente">
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
};
