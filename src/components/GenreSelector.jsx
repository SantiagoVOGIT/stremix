import React from 'react';
import { GENRES, GENRE_TRANSLATIONS } from '../services/cinemeta';

export const GenreSelector = ({ selectedGenre, onSelectGenre }) => {
  return (
    <div className="genre-row-container">
      <div className="genre-scroll">
        {GENRES.map((g) => {
          const label = GENRE_TRANSLATIONS[g] || g;
          const isActive = (selectedGenre === g) || (!selectedGenre && g === 'Todos');
          return (
            <button
              key={g}
              className={`genre-pill ${isActive ? 'active' : ''}`}
              onClick={() => onSelectGenre(g === 'Todos' ? null : g)}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
