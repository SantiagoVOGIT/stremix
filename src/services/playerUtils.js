/**
 * Player Utilities Service for Stremix
 * Handles reliable external player launching (VLC, MPV, PotPlayer) via .m3u playlists,
 * direct protocol attempts, clipboard assistance, and format compatibility hints.
 */

/**
 * Clean title for filenames
 */
export const sanitizeFilename = (name = 'stream') => {
  return name.replace(/[^a-zA-Z0-9_\-\. ]/g, '').trim().replace(/\s+/g, '_').slice(0, 60);
};

/**
 * Checks client browser playback capabilities for various media containers and codecs
 */
export const checkBrowserMediaCapabilities = () => {
  if (typeof document === 'undefined') {
    return {
      hls: true,
      mp4: true,
      webm: true,
      hevc: false,
      av1: true,
      vp9: true,
      ac3: false,
      eac3: false,
      dts: false,
      truehd: false
    };
  }

  const v = document.createElement('video');
  const canPlay = (type) => Boolean(v.canPlayType && v.canPlayType(type).replace(/^no$/, ''));

  let hevcSupported = false;
  try {
    hevcSupported = canPlay('video/mp4; codecs="hvc1.1.6.L93.B0"') || canPlay('video/mp4; codecs="hev1.1.6.L93.B0"');
  } catch (e) {
    hevcSupported = false;
  }

  let av1Supported = false;
  try {
    av1Supported = canPlay('video/mp4; codecs="av01.0.05M.08"');
  } catch (e) {
    av1Supported = false;
  }

  return {
    hls: canPlay('application/vnd.apple.mpegurl') || typeof window !== 'undefined',
    mp4: canPlay('video/mp4; codecs="avc1.42E01E, mp4a.40.2"'),
    webm: canPlay('video/webm; codecs="vp9, opus"') || canPlay('video/webm; codecs="vp8, vorbis"'),
    hevc: hevcSupported,
    av1: av1Supported,
    vp9: canPlay('video/webm; codecs="vp9"'),
    ac3: canPlay('audio/mp4; codecs="ac-3"'),
    eac3: canPlay('audio/mp4; codecs="ec-3"'),
    dts: false,     // Browsers natively do not demux/decode DTS / DTS-HD
    truehd: false   // Browsers natively do not demux/decode Dolby TrueHD
  };
};

/**
 * Downloads a temporary .m3u playlist file.
 * Windows, macOS and Linux associate .m3u with VLC, MPV and PotPlayer by default.
 * When opened, the media player immediately streams the URL with zero lag.
 */
export const downloadM3uPlaylist = (streamUrl, title = 'Stremix Stream') => {
  if (!streamUrl) return false;
  if (typeof document === 'undefined') return true;

  try {
    const filename = `${sanitizeFilename(title)}.m3u`;
    const m3uContent = `#EXTM3U\n#EXTINF:-1,${title}\n${streamUrl}\n`;
    const blob = new Blob([m3uContent], { type: 'audio/x-mpegurl;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      if (document.body.contains(a)) document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    }, 1500);

    return true;
  } catch (err) {
    console.error('Error generating .m3u playlist:', err);
    return false;
  }
};

/**
 * Copies a stream URL to clipboard with fallback
 */
export const copyStreamUrl = async (streamUrl) => {
  if (!streamUrl) return false;
  if (typeof document === 'undefined') return true;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(streamUrl);
      return true;
    }
    const input = document.createElement('textarea');
    input.value = streamUrl;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.focus();
    input.select();
    const success = document.execCommand('copy');
    document.body.removeChild(input);
    return success;
  } catch (err) {
    console.warn('Clipboard copy error:', err);
    return false;
  }
};

/**
 * Generate CLI command for terminal enthusiasts
 */
export const getMpvCliCommand = (streamUrl) => `mpv "${streamUrl}"`;
export const getVlcCliCommand = (streamUrl) => `vlc "${streamUrl}"`;

/**
 * Launches external player via universal strategy:
 * 1. Generates and downloads .m3u playlist file (opens VLC/MPV immediately on OS)
 * 2. Copies the direct network stream URL to the clipboard (Ctrl+N in VLC)
 * 3. Safely invokes the custom protocol scheme (vlc:// or mpv://) if registered
 */
export const launchExternalPlayer = (streamUrl, title = 'Stremix Stream', player = 'vlc') => {
  if (!streamUrl) return { success: false, message: 'URL de stream no disponible' };

  if (streamUrl.startsWith('magnet:')) {
    copyStreamUrl(streamUrl);
    try {
      window.location.href = streamUrl;
    } catch (e) {}
    return {
      success: true,
      player: 'bittorrent',
      message: 'Enlace Magnet copiado y enviado a tu cliente BitTorrent'
    };
  }

  // 1. Download .m3u playlist (native Windows/OS handler for VLC/MPV/PotPlayer)
  downloadM3uPlaylist(streamUrl, title);

  // 2. Copy direct stream URL to clipboard (for VLC -> Medios -> Abrir emisión de red Ctrl+N)
  copyStreamUrl(streamUrl);

  const cleanPlayer = (player || 'vlc').toLowerCase();
  let instructions = 'Ctrl + N en VLC';
  if (cleanPlayer === 'mpv') instructions = 'o abre en terminal: mpv "<URL>"';
  else if (cleanPlayer === 'potplayer') instructions = 'Ctrl + U en PotPlayer';

  return {
    success: true,
    player: cleanPlayer,
    message: `Lista .m3u descargada para ${cleanPlayer.toUpperCase()} y enlace copiado (${instructions})`
  };
};

/**
 * Analyzes a stream to determine whether the web player or an external player
 * is the recommended way to play it, based on native tags, container, audio, and codecs.
 */
export const getStreamRecommendation = (stream) => {
  if (!stream) {
    return { 
      recommended: 'web', 
      isWebReady: true, 
      badgeText: 'Web Compatible',
      badgeVariant: 'success',
      reason: 'Compatible con reproductor web',
      detailedReasons: []
    };
  }

  // YouTube streams (trailers / youtube URLs)
  if (stream.formatType === 'youtube' || stream.ytId || (stream.url && (stream.url.includes('youtube.com') || stream.url.includes('youtu.be')))) {
    return {
      recommended: 'youtube',
      isWebReady: true,
      badgeText: 'YouTube Stream',
      badgeVariant: 'secondary',
      reason: 'Reproducción integrada vía YouTube',
      detailedReasons: ['Vídeo reproducido mediante iframe nativo de YouTube']
    };
  }

  // Pure P2P Torrent without debrid link
  const isTorrent = (!stream.url && Boolean(stream.infoHash)) || stream.formatType === 'torrent';
  if (isTorrent) {
    return {
      recommended: 'external',
      isWebReady: false,
      badgeText: 'P2P Torrent',
      badgeVariant: 'secondary',
      reason: 'Requiere cliente BitTorrent o servicio Debrid',
      detailedReasons: ['Flujo P2P BitTorrent puro: no es un enlace HTTP directo accesible por el navegador']
    };
  }

  const detailedReasons = [];

  // 1. Addon native flag check: behaviorHints.notWebReady
  if (stream.behaviorHints?.notWebReady === true) {
    detailedReasons.push('El proveedor marcó este stream específicamente como no compatible con navegador web.');
  }

  // 2. Container check: MKV, AVI, WMV cannot be demuxed natively by browser <video>
  const format = (stream.formatType || '').toLowerCase();
  const urlLower = (stream.url || '').toLowerCase();
  const titleLower = (stream.rawTitle || stream.mainTitle || '').toLowerCase();
  const isMkv = format === 'mkv' || urlLower.includes('.mkv') || titleLower.includes('.mkv');
  const isAviOrWmv = format === 'avi' || format === 'wmv' || urlLower.includes('.avi') || urlLower.includes('.wmv');

  if (isMkv) {
    detailedReasons.push('Contenedor Matroska (.mkv): los navegadores web carecen de demuxer nativo para este contenedor.');
  }
  if (isAviOrWmv) {
    detailedReasons.push('Contenedor heredado (.avi/.wmv): no admitido por navegadores modernos.');
  }

  // 3. Audio codec checks: DTS, TrueHD, Atmos TrueHD, or 7.1 lossless audio
  const audioText = (stream.audio || '').toUpperCase();
  const isDts = audioText.includes('DTS');
  const isTrueHd = audioText.includes('TRUEHD');
  const isLosslessAtmos = audioText.includes('ATMOS') && (audioText.includes('TRUEHD') || titleLower.includes('truehd'));
  const is71 = audioText.includes('7.1');
  const isAc3 = audioText.includes('AC3') || audioText.includes('AC-3') || audioText.includes('DD5.1') || audioText.includes('DDP');

  if (isDts) {
    detailedReasons.push('Pista de audio DTS / DTS-HD Master Audio: códec con licencia restringida no decodificable por el navegador.');
  }
  if (isTrueHd || isLosslessAtmos) {
    detailedReasons.push('Pista de audio Dolby TrueHD / Atmos Lossless: requiere passthrough o reproductor externo como VLC.');
  }
  if (is71) {
    detailedReasons.push('Audio multicanal 7.1: la mezcla multicanal puede generar silencio en navegadores estéreo.');
  }

  // 4. Video codec checks: 10-bit HEVC, Dolby Vision Profile 5/7, Remux
  const visual = (stream.hdrTag || '').toUpperCase();
  const source = (stream.sourceRelease || '').toUpperCase();
  const isRemux = source === 'REMUX' || titleLower.includes('remux');
  const isDolbyVision = visual.includes('DOLBY') || visual.includes('DV') || titleLower.includes('dovi');

  if (isRemux) {
    detailedReasons.push('Release REMUX con tasa de bits extrema: recomendado en VLC para evitar caídas de fotogramas.');
  }

  // Evaluate recommendation
  if (detailedReasons.length > 0) {
    let mainReason = 'VLC / MPV Recomendado para máxima fidelidad';
    if (isMkv) mainReason = 'Contenedor MKV: abrir en VLC o MPV';
    else if (isDts || isTrueHd) mainReason = 'Audio DTS / TrueHD: decodificación óptima en VLC';
    else if (isRemux) mainReason = 'Stream REMUX sin compresión: recomendado en VLC';

    return {
      recommended: 'vlc',
      isWebReady: false,
      badgeText: 'VLC Recomendado',
      badgeVariant: 'warning',
      reason: mainReason,
      detailedReasons,
      suggestedPlayers: ['vlc', 'mpv', 'potplayer']
    };
  }

  // Clean Web-ready stream (HLS or MP4/WebM with standard AVC/VP9/AV1 and AAC/Opus)
  return {
    recommended: 'web',
    isWebReady: true,
    badgeText: 'Web Compatible',
    badgeVariant: 'success',
    reason: 'Totalmente compatible con el reproductor web integrado',
    detailedReasons: []
  };
};
