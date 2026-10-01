import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Film, 
  Tv, 
  Compass, 
  Bookmark, 
  Search, 
  X, 
  Settings, 
  Radio,
  Star
} from 'lucide-react';
import { fetchCatalog } from '../services/cinemeta';
import { getSettings } from '../services/storage';

export const Navbar = ({ 
  currentTab, 
  onSelectTab, 
  onSelectMedia, 
  onOpenSettings,
  aioStatus = 'online'
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeoutRef = useRef(null);
  const dropdownRef = useRef(null);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const [movies, series] = await Promise.all([
          fetchCatalog('movie', null, searchQuery),
          fetchCatalog('series', null, searchQuery)
        ]);
        const combined = [...(movies || []), ...(series || [])].slice(0, 10);
        setSearchResults(combined);
        setShowDropdown(true);
      } catch (e) {
        console.error('Search error:', e);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectResult = (item) => {
    setShowDropdown(false);
    setSearchQuery('');
    onSelectMedia(item);
  };

  const settings = getSettings();
  const hasCustomConfig = Boolean(settings.aiostreamConfigToken || settings.aiostreamUserData);

  return (
    <header className="header-nav">
      {/* Brand */}
      <div className="brand-logo" onClick={() => onSelectTab('discover')}>
        <div className="brand-icon">
          <Play size={20} fill="#fff" />
        </div>
        <div>
          <span className="brand-text">STREMIX</span>
          <span className="brand-tag" style={{ marginLeft: '8px' }}>AIO</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="nav-tabs">
        <button 
          className={`nav-tab-btn ${currentTab === 'discover' ? 'active' : ''}`}
          onClick={() => onSelectTab('discover')}
        >
          <Compass size={17} />
          <span>Descubrir</span>
        </button>
        <button 
          className={`nav-tab-btn ${currentTab === 'movies' ? 'active' : ''}`}
          onClick={() => onSelectTab('movies')}
        >
          <Film size={17} />
          <span>Películas</span>
        </button>
        <button 
          className={`nav-tab-btn ${currentTab === 'series' ? 'active' : ''}`}
          onClick={() => onSelectTab('series')}
        >
          <Tv size={17} />
          <span>Series</span>
        </button>
        <button 
          className={`nav-tab-btn ${currentTab === 'library' ? 'active' : ''}`}
          onClick={() => onSelectTab('library')}
        >
          <Bookmark size={17} />
          <span>Mi Biblioteca</span>
        </button>
      </nav>

      {/* Search Input with Autocomplete */}
      <div className="search-wrapper" ref={dropdownRef}>
        <div className="search-input-container">
          <Search size={18} color="var(--text-dim)" />
          <input
            type="text"
            className="search-input"
            placeholder="Buscar películas, series o anime..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (searchResults.length > 0) setShowDropdown(true);
            }}
          />
          {searchQuery && (
            <button className="search-clear-btn" onClick={() => setSearchQuery('')}>
              <X size={16} />
            </button>
          )}
        </div>

        {/* Dropdown Results */}
        {showDropdown && (
          <div className="search-dropdown">
            {isSearching ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.9rem' }}>
                Buscando títulos...
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map((item) => (
                <div 
                  key={item.id} 
                  className="search-result-item"
                  onClick={() => handleSelectResult(item)}
                >
                  <img 
                    src={item.poster || 'https://images.metahub.space/poster/small/default.png'} 
                    alt={item.name} 
                    className="search-result-thumb"
                    onError={(e) => {
                      e.target.src = 'https://images.metahub.space/poster/small/default.png';
                    }}
                  />
                  <div className="search-result-info">
                    <div className="search-result-title">{item.name}</div>
                    <div className="search-result-meta">
                      <span>{item.year || item.releaseInfo || 'N/A'}</span>
                      <span>•</span>
                      <span style={{ textTransform: 'capitalize' }}>
                        {item.type === 'series' ? 'Serie' : 'Película'}
                      </span>
                      {item.imdbRating && (
                        <>
                          <span>•</span>
                          <span style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Star size={12} fill="#fbbf24" /> {item.imdbRating}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.9rem' }}>
                No se encontraron resultados
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions & AIOStatus */}
      <div className="header-actions">
        <div 
          className="status-pill"
          onClick={onOpenSettings}
          title="Haz clic para configurar tu instancia de AIOStreams"
        >
          <span className={`status-dot ${hasCustomConfig ? 'online' : 'demo'}`}></span>
          <span>{hasCustomConfig ? 'AIOStreams Conectado' : 'AIOStreams Demo'}</span>
        </div>

        <button 
          className="icon-btn" 
          onClick={onOpenSettings}
          title="Ajustes y Addons"
        >
          <Settings size={19} />
        </button>
      </div>
    </header>
  );
};
