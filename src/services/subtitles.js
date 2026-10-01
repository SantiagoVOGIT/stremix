// Subtitle Service for Stremix
// Integrates with OpenSubtitles v3 Stremio addon and provides SRT->WebVTT conversion

const OPENSUBTITLES_BASE = 'https://opensubtitles-v3.strem.io';

export const LANG_NAMES = {
  spa: 'Español',
  es: 'Español',
  eng: 'Inglés',
  en: 'Inglés',
  fre: 'Francés',
  fr: 'Francés',
  ger: 'Alemán',
  de: 'Alemán',
  ita: 'Italiano',
  it: 'Italiano',
  por: 'Portugués',
  pt: 'Portugués',
  rus: 'Ruso',
  ru: 'Ruso',
  lat: 'Español Latino'
};

/**
 * Fetch available subtitles for a movie or series episode
 * @param {('movie'|'series')} type
 * @param {string} videoId - IMDb ID (e.g. tt1375666 or tt0944947:1:1)
 */
export const fetchSubtitles = async (type = 'movie', videoId) => {
  if (!videoId) return [];
  try {
    const url = `/api/proxy?url=${encodeURIComponent(`${OPENSUBTITLES_BASE}/subtitles/${type}/${videoId}.json`)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    
    if (!data.subtitles || !Array.isArray(data.subtitles)) return [];

    return data.subtitles.map((sub, i) => {
      const langCode = (sub.lang || 'und').toLowerCase();
      const langName = LANG_NAMES[langCode] || langCode.toUpperCase();
      return {
        id: sub.id || `sub-${i}`,
        url: sub.url,
        lang: langCode,
        langName,
        label: `${langName} (${sub.movieReleaseName || sub.subtitleFileName || `#${i+1}`})`,
        format: sub.format || 'srt'
      };
    });
  } catch (err) {
    console.warn('Error fetching subtitles from OpenSubtitles:', err);
    return [];
  }
};

/**
 * Convert SRT format string to WebVTT format string
 */
export const srtToVtt = (srtContent, delaySeconds = 0) => {
  if (!srtContent) return '';

  // If already WebVTT format
  if (srtContent.trim().startsWith('WEBVTT')) {
    if (delaySeconds === 0) return srtContent;
    return srtContent.replace(/(\d{2}:\d{2}:\d{2}[\.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[\.,]\d{3})/g, (match, p1, p2) => {
      const s1 = adjustTimestamp(p1.replace(',', '.'), delaySeconds);
      const s2 = adjustTimestamp(p2.replace(',', '.'), delaySeconds);
      return `${s1} --> ${s2}`;
    });
  }

  let vtt = 'WEBVTT\n\n';
  
  // Normalize line endings
  const normalized = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.trim().split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 2) continue;

    // Check if line 0 is a number index
    let timeLineIdx = 0;
    if (/^\d+$/.test(lines[0].trim())) {
      timeLineIdx = 1;
    }

    const timeLine = lines[timeLineIdx];
    if (!timeLine || !timeLine.includes('-->')) continue;

    const timeParts = timeLine.split('-->');
    if (timeParts.length !== 2) continue;

    let start = timeParts[0].trim().replace(',', '.');
    let end = timeParts[1].trim().replace(',', '.');

    // Apply delay adjustment if needed
    if (delaySeconds !== 0) {
      start = adjustTimestamp(start, delaySeconds);
      end = adjustTimestamp(end, delaySeconds);
    }

    const textLines = lines.slice(timeLineIdx + 1).join('\n');
    vtt += `${start} --> ${end}\n${textLines}\n\n`;
  }

  return vtt;
};

/**
 * Adjust timestamp string "00:01:23.456" by offset in seconds
 */
function adjustTimestamp(ts, offset) {
  const parts = ts.split(':');
  if (parts.length < 2) return ts;
  
  let hours = 0, mins = 0, secs = 0;
  if (parts.length === 3) {
    hours = parseInt(parts[0], 10);
    mins = parseInt(parts[1], 10);
    secs = parseFloat(parts[2]);
  } else {
    mins = parseInt(parts[0], 10);
    secs = parseFloat(parts[1]);
  }

  let totalSecs = hours * 3600 + mins * 60 + secs + offset;
  if (totalSecs < 0) totalSecs = 0;

  const h = Math.floor(totalSecs / 3600);
  totalSecs %= 3600;
  const m = Math.floor(totalSecs / 60);
  const s = (totalSecs % 60).toFixed(3);

  const pad = (n, len = 2) => String(n).padStart(len, '0');
  return `${pad(h)}:${pad(m)}:${pad(s.split('.')[0])}.${s.split('.')[1] || '000'}`;
}

/**
 * Safely decodes subtitle buffer supporting UTF-8 and Windows-1252 / ISO-8859-1
 */
const decodeSubtitleBuffer = (arrayBuffer) => {
  const bytes = new Uint8Array(arrayBuffer);
  try {
    // Strict UTF-8 decoder
    const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
    return utf8Decoder.decode(bytes);
  } catch (e) {
    try {
      // Common Spanish / European SRT charset fallback
      const win1252Decoder = new TextDecoder('windows-1252');
      return win1252Decoder.decode(bytes);
    } catch (e2) {
      return new TextDecoder('utf-8').decode(bytes);
    }
  }
};

/**
 * Load subtitle URL and return a Blob WebVTT URL
 */
export const loadSubtitleVttBlob = async (subUrl, delaySeconds = 0) => {
  try {
    const proxied = `/api/proxy?url=${encodeURIComponent(subUrl)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(proxied, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error('Failed to load subtitle file');
    const arrayBuf = await res.arrayBuffer();
    const text = decodeSubtitleBuffer(arrayBuf);
    const vtt = srtToVtt(text, delaySeconds);
    const blob = new Blob([vtt], { type: 'text/vtt' });
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error('Error loading subtitle blob:', err);
    return null;
  }
};

/**
 * Fetch raw subtitle content for dynamic delay shifting
 */
export const loadSubtitleText = async (subUrl) => {
  try {
    const proxied = `/api/proxy?url=${encodeURIComponent(subUrl)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(proxied, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error('Failed to load subtitle file');
    const arrayBuf = await res.arrayBuffer();
    return decodeSubtitleBuffer(arrayBuf);
  } catch (err) {
    console.error('Error loading subtitle text:', err);
    return null;
  }
};
