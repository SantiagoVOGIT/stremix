// Cinemeta API Service for Stremix
// Provides catalogs, search, genres, and metadata for Movies and Series

const CINEMETA_BASE = 'https://v3-cinemeta.strem.io';

export const GENRES = [
  'Todos',
  'Action',
  'Adventure',
  'Animation',
  'Comedy',
  'Crime',
  'Documentary',
  'Drama',
  'Family',
  'Fantasy',
  'Horror',
  'Mystery',
  'Romance',
  'Sci-Fi',
  'Thriller',
  'War',
  'Western'
];

export const GENRE_TRANSLATIONS = {
  'Todos': 'Todos',
  'Action': 'Acción',
  'Adventure': 'Aventura',
  'Animation': 'Animación',
  'Comedy': 'Comedia',
  'Crime': 'Crimen',
  'Documentary': 'Documental',
  'Drama': 'Drama',
  'Family': 'Familia',
  'Fantasy': 'Fantasía',
  'Horror': 'Terror',
  'Mystery': 'Misterio',
  'Romance': 'Romance',
  'Sci-Fi': 'Ciencia Ficción',
  'Thriller': 'Suspenso',
  'War': 'Bélica',
  'Western': 'Western'
};

const safeFetchJson = async (url) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) return await res.json();
  } catch (e) {
    // If direct fails or times out, fall back to proxy
  }
  const proxied = `/api/proxy?url=${encodeURIComponent(url)}`;
  const controller2 = new AbortController();
  const timeout2 = setTimeout(() => controller2.abort(), 10000);
  const res2 = await fetch(proxied, { signal: controller2.signal });
  clearTimeout(timeout2);
  if (!res2.ok) throw new Error(`HTTP error! status: ${res2.status}`);
  return await res2.json();
};

/**
 * Fetch catalog items from Cinemeta
 * @param {('movie'|'series')} type
 * @param {string|null} genre
 * @param {string|null} search
 * @param {number} skip
 */
export const fetchCatalog = async (type = 'movie', genre = null, search = null, skip = 0) => {
  try {
    let url = `${CINEMETA_BASE}/catalog/${type}/top`;

    if (search && search.trim()) {
      url += `/search=${encodeURIComponent(search.trim())}.json`;
    } else if (genre && genre !== 'Todos') {
      const skipParam = skip > 0 ? `&skip=${skip}` : '';
      url += `/genre=${encodeURIComponent(genre)}${skipParam}.json`;
    } else {
      url += skip > 0 ? `/skip=${skip}.json` : '.json';
    }

    const data = await safeFetchJson(url);
    return data.metas || [];
  } catch (err) {
    console.error(`Error fetching catalog for ${type}:`, err);
    return [];
  }
};

/**
 * Fetch full metadata for a specific movie or series
 * @param {('movie'|'series')} type
 * @param {string} id - IMDb ID (e.g. tt1375666)
 */
export const fetchMeta = async (type, id) => {
  if (!id) return null;
  try {
    const url = `${CINEMETA_BASE}/meta/${type}/${id}.json`;
    const data = await safeFetchJson(url);
    return data.meta || null;
  } catch (err) {
    console.error(`Error fetching metadata for ${type}/${id}:`, err);
    return null;
  }
};

/**
 * Helper to group episodes of a series by season
 * @param {Array} videos - Array of video/episode objects from meta
 */
export const groupEpisodesBySeason = (videos = []) => {
  if (!videos || !videos.length) return {};
  const seasons = {};
  
  videos.forEach((vid) => {
    const s = vid.season !== undefined ? vid.season : 1;
    if (!seasons[s]) seasons[s] = [];
    seasons[s].push(vid);
  });

  // Sort episodes in each season by number
  Object.keys(seasons).forEach((s) => {
    seasons[s].sort((a, b) => (a.number || a.episode || 0) - (b.number || b.episode || 0));
  });

  return seasons;
};
