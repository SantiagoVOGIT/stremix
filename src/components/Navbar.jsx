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
  Star,
  Command
} from 'lucide-react';
import { fetchCatalog } from '../services/cinemeta';
import { getSettings } from '../services/storage';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

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
  const searchInputRef = useRef(null);

  // Global Ctrl+K / Cmd+K listener to focus search
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

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
        const combined = [...(movies || []), ...(series || [])].slice(0, 8);
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

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (searchResults.length > 0) {
        e.preventDefault();
        handleSelectResult(searchResults[0]);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      searchInputRef.current?.blur();
    }
  };

  const settings = getSettings();
  const hasCustomConfig = Boolean(settings.aiostreamConfigToken || settings.aiostreamUserData);

  return (
    <header className="header-nav">
      {/* Brand */}
      <div className="brand-logo" onClick={() => onSelectTab('discover')}>
        <div className="brand-icon">
          <Play size={16} fill="currentColor" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="brand-text">Stremix</span>
          <Badge variant="outline" style={{ fontSize: '0.65rem', textTransform: 'uppercase', padding: '1px 6px' }}>
            AIO
          </Badge>
        </div>
      </div>

      {/* Navigation Tabs (shadcn style) */}
      <div className="ui-tabs-list" style={{ height: '2.4rem' }}>
        <button 
          className={`ui-tabs-trigger ${currentTab === 'discover' ? 'active' : ''}`}
          onClick={() => onSelectTab('discover')}
        >
          <Compass size={15} />
          <span>Descubrir</span>
        </button>
        <button 
          className={`ui-tabs-trigger ${currentTab === 'movies' ? 'active' : ''}`}
          onClick={() => onSelectTab('movies')}
        >
          <Film size={15} />
          <span>Películas</span>
        </button>
        <button 
          className={`ui-tabs-trigger ${currentTab === 'series' ? 'active' : ''}`}
          onClick={() => onSelectTab('series')}
        >
          <Tv size={15} />
          <span>Series</span>
        </button>
        <button 
          className={`ui-tabs-trigger ${currentTab === 'library' ? 'active' : ''}`}
          onClick={() => onSelectTab('library')}
        >
          <Bookmark size={15} />
          <span>Mi Biblioteca</span>
        </button>
      </div>

      {/* Search Input with Autocomplete */}
      <div className="search-wrapper" ref={dropdownRef}>
        <div className="search-input-container">
          <Search size={15} color="hsl(var(--muted-foreground))" />
          <input
            ref={searchInputRef}
            type="text"
            className="search-input"
            placeholder="Buscar títulos en AIOStreams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => {
              if (searchResults.length > 0) setShowDropdown(true);
            }}
          />
          {searchQuery ? (
            <button 
              className="ui-btn ui-btn-ghost ui-btn-icon search-clear-btn" 
              style={{ width: '1.5rem', height: '1.5rem', padding: 0 }}
              onClick={() => setSearchQuery('')}
            >
              <X size={14} />
            </button>
          ) : (
            <kbd style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px',
              fontSize: '0.7rem',
              color: 'hsl(var(--muted-foreground))',
              background: 'hsl(var(--muted))',
              padding: '2px 5px',
              borderRadius: '4px',
              border: '1px solid hsl(var(--border))'
            }}>
              <Command size={10} /> K
            </kbd>
          )}
        </div>

        {/* Dropdown Results */}
        {showDropdown && (
          <div className="search-dropdown">
            {isSearching ? (
              <div style={{ padding: '12px', textAlign: 'center', color: 'hsl(var(--muted-foreground))', fontSize: '0.8125rem' }}>
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
                            <Star size={11} fill="#fbbf24" /> {item.imdbRating}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '12px', textAlign: 'center', color: 'hsl(var(--muted-foreground))', fontSize: '0.8125rem' }}>
                No se encontraron resultados
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions & Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button 
          className="status-pill"
          onClick={onOpenSettings}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <Badge 
            variant={hasCustomConfig ? 'success' : 'secondary'} 
            style={{ cursor: 'pointer', padding: '0.25rem 0.65rem' }}
          >
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: hasCustomConfig ? '#10b981' : '#f59e0b',
              marginRight: '4px'
            }}></span>
            {hasCustomConfig ? 'AIOStreams Activo' : 'AIOStreams Demo'}
          </Badge>
        </button>

        <Button 
          variant="outline" 
          size="icon" 
          className="settings-btn"
          onClick={onOpenSettings}
          title="Configuración de AIOStreams y Addons"
        >
          <Settings size={16} />
        </Button>
      </div>
    </header>
  );
};
