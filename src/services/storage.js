// Local storage service for Stremix application state
// Provides resilient in-memory fallback when localStorage is blocked or unavailable

const SETTINGS_KEY = 'stremix_settings';
const FAVORITES_KEY = 'stremix_favorites';
const PROGRESS_KEY = 'stremix_progress';
const HISTORY_KEY = 'stremix_history';

const DEFAULT_SETTINGS = {
  aiostreamUrl: 'https://aiostreams.viren070.me',
  aiostreamConfigToken: '',
  aiostreamUserData: '',
  aiostreamPassword: '',
  aiostreamUuid: '',
  preferredResolution: 'all', // 'all', '4k', '1080p', '720p'
  sortBy: 'quality', // 'quality', 'spanish', 'seeders', 'size'
  autoPlayNext: true,
  subtitlesLanguage: 'spa', // 'spa', 'eng', 'all'
  subtitlesFontSize: 'medium', // 'small', 'medium', 'large'
  externalPlayer: 'vlc', // 'vlc', 'mpv', 'potplayer'
  useProxy: true, // Use dev proxy to bypass CORS
};

// In-memory fallback map for environments where localStorage is not available or blocked
const memoryStore = new Map();

const safeStorage = {
  getItem: (key) => {
    try {
      if (typeof localStorage !== 'undefined') {
        const val = localStorage.getItem(key);
        if (val !== null) return val;
      }
    } catch (e) {
      // LocalStorage access restricted (e.g. private mode)
    }
    return memoryStore.get(key) || null;
  },
  setItem: (key, val) => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, val);
      }
    } catch (e) {}
    memoryStore.set(key, val);
  },
  removeItem: (key) => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch (e) {}
    memoryStore.delete(key);
  }
};

export const getSettings = () => {
  try {
    const saved = safeStorage.getItem(SETTINGS_KEY);
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  } catch (e) {
    console.warn('Error reading settings:', e);
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = (newSettings) => {
  try {
    const current = getSettings();
    const merged = { ...current, ...newSettings };
    safeStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
    return merged;
  } catch (e) {
    console.error('Error saving settings:', e);
    return DEFAULT_SETTINGS;
  }
};

// Favorites / Watchlist
export const getFavorites = () => {
  try {
    const saved = safeStorage.getItem(FAVORITES_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
};

export const isFavorite = (id) => {
  const favs = getFavorites();
  return favs.some((item) => item.id === id);
};

export const toggleFavorite = (mediaItem) => {
  try {
    let favs = getFavorites();
    const exists = favs.some((item) => item.id === mediaItem.id);
    if (exists) {
      favs = favs.filter((item) => item.id !== mediaItem.id);
    } else {
      favs.unshift({
        id: mediaItem.id,
        imdb_id: mediaItem.imdb_id || mediaItem.id,
        name: mediaItem.name || mediaItem.title,
        type: mediaItem.type || 'movie',
        poster: mediaItem.poster,
        background: mediaItem.background,
        year: mediaItem.year || mediaItem.releaseInfo,
        imdbRating: mediaItem.imdbRating,
        genres: mediaItem.genres || mediaItem.genre || [],
        addedAt: Date.now()
      });
    }
    safeStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
    return !exists;
  } catch (e) {
    console.error('Error updating favorites:', e);
    return false;
  }
};

// Continue Watching Progress
export const getContinueWatching = () => {
  try {
    const saved = safeStorage.getItem(PROGRESS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
};

export const saveProgress = (progressData) => {
  try {
    let list = getContinueWatching();
    // Unique key: for movies it's the movie id, for series it's `${seriesId}:${season}:${episode}`
    const key = progressData.videoId || progressData.id;
    list = list.filter((item) => (item.videoId || item.id) !== key);

    list.unshift({
      ...progressData,
      updatedAt: Date.now(),
    });

    // Limit to 30 items
    if (list.length > 30) list = list.slice(0, 30);
    safeStorage.setItem(PROGRESS_KEY, JSON.stringify(list));
    return list;
  } catch (e) {
    console.error('Error saving progress:', e);
    return [];
  }
};

export const removeProgress = (videoId) => {
  try {
    let list = getContinueWatching();
    list = list.filter((item) => (item.videoId || item.id) !== videoId);
    safeStorage.setItem(PROGRESS_KEY, JSON.stringify(list));
    return list;
  } catch (e) {
    return [];
  }
};

export const getProgress = (videoId) => {
  try {
    const list = getContinueWatching();
    return list.find((item) => (item.videoId || item.id) === videoId) || null;
  } catch (e) {
    return null;
  }
};

// Playback History
export const getHistory = () => {
  try {
    const saved = safeStorage.getItem(HISTORY_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
};

export const addToHistory = (item) => {
  try {
    let list = getHistory();
    list = list.filter((h) => h.id !== item.id);
    list.unshift({
      id: item.id,
      name: item.name,
      type: item.type,
      poster: item.poster,
      streamName: item.streamName,
      watchedAt: Date.now()
    });
    if (list.length > 50) list = list.slice(0, 50);
    safeStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Error adding to history:', e);
  }
};

// Export & Import
export const exportBackup = () => {
  const data = {
    version: 1,
    exportDate: new Date().toISOString(),
    settings: getSettings(),
    favorites: getFavorites(),
    progress: getContinueWatching(),
    history: getHistory()
  };
  return JSON.stringify(data, null, 2);
};

export const importBackup = (jsonString) => {
  try {
    const data = JSON.parse(jsonString);
    if (data.settings) safeStorage.setItem(SETTINGS_KEY, JSON.stringify(data.settings));
    if (data.favorites) safeStorage.setItem(FAVORITES_KEY, JSON.stringify(data.favorites));
    if (data.progress) safeStorage.setItem(PROGRESS_KEY, JSON.stringify(data.progress));
    if (data.history) safeStorage.setItem(HISTORY_KEY, JSON.stringify(data.history));
    return true;
  } catch (e) {
    console.error('Failed to import backup:', e);
    return false;
  }
};
