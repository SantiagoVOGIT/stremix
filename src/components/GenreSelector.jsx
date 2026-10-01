import React from 'react';
import { GENRES, GENRE_TRANSLATIONS } from '../services/cinemeta';
import { Button } from './ui/button';

export const GenreSelector = ({ selectedGenre, onSelectGenre }) => {
  return (
    <div className="genre-row-container">
      <div className="genre-scroll">
        {GENRES.map((g) => {
          const label = GENRE_TRANSLATIONS[g] || g;
          const isActive = (selectedGenre === g) || (!selectedGenre && g === 'Todos');
          return (
            <Button
              key={g}
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              onClick={() => onSelectGenre(g === 'Todos' ? null : g)}
              style={{ borderRadius: '9999px', fontSize: '0.8125rem' }}
            >
              {label}
            </Button>
          );
        })}
      </div>
    </div>
  );
};
