# 🎬 Stremix — Streaming Hub basado en la API de AIOStreams & Cinemeta

**Stremix** es una aplicación web moderna de streaming inspirada en **Stremio**, construida desde cero con arquitectura modular, diseño obsidian glassmorphism ultra-pulido y alimentada por el ecosistema de **AIOStreams**, **Cinemeta** y **OpenSubtitles v3**.

---

## 🌟 Características Principales

### 1. ⚡ Motor Integrado de AIOStreams
- **Soporte Híbrido**:
  - **Stremio Addon Protocol**: Conexión a manifests personalizados (`/stremio/{configToken}/manifest.json` y `/stream/{type}/{id}.json`).
  - **AIOStreams REST API**: Compatible con `/api/v1/search?type={movie|series}&id={id}&format=true` con autenticación por `x-aiostreams-user-data` (Base64) y `Authorization: Basic`.
- **Selector de Instancias**:
  - Viren070 Official (`https://aiostreams.viren070.me`)
  - ElfHosted Community (`https://aiostreams.elfhosted.com`)
  - FTWeebs Community (`https://aiostreamsfortheweebsstable.midnightignite.me`)
  - Self-Hosted / Docker (`http://localhost:3000`) o URL personalizada.
- **Herramienta de Diagnóstico en Tiempo Real**: Botón *Probar Conexión* con medición de latencia (ping en ms), versión del addon y capacidades detectadas.
- **Filtros Inteligentes**:
  - Filtrado por resolución: **4K UHD**, **1080p Full HD**, **720p HD**.
  - Ordenación por Calidad, Semillas (Seeds) o Tamaño de archivo.
  - Detección de Debrid Instantáneo (`[RD+]`, `[TB+]`, `[AD+]`, `[PM+]`), códecs (`HEVC/x265`, `x264`, `AV1`, `Remux`, `BluRay`) y pistas de audio (`Dolby Atmos`, `5.1`, `7.1`).
- **Motor de Respaldo Inmediato**: Disfruta de reproducción fluida desde el primer segundo gracias al generador de streams directos HLS y trailers oficiales.

### 2. 🍿 Catálogo Completo & Cinemeta Metadata
- **Descubrir / Películas / Series**:
  - Miles de títulos sincronizados en tiempo real mediante la API oficial de Cinemeta.
  - Filtro por géneros cinematográficos con carrusel horizontal interactivo (Acción, Aventura, Animación, Comedia, Crimen, Documental, Drama, Terror, Ciencia Ficción, etc.).
  - Búsqueda instantánea con *autocomplete* (debounced) mostrando póster, año, tipo y calificación IMDb.
  - Carrusel Hero dinámico con arte en alta definición, sinopsis, tiempo de duración y botón de reproducción directa.
  - Ficha técnica completa con reparto, directores, etiquetas de género y selector de temporadas y episodios para series de televisión.

### 3. 🎥 Reproductor de Video Avanzado (HLS & HTML5)
- Compatible con flujos adaptativos `.m3u8` (HLS.js) y contenedores MP4/WebM.
- Controles modernos con auto-ocultamiento tras 3 segundos de inactividad.
- Barra de progreso (scrub bar) con indicador de búfer en memoria y tiempo restante.
- **Selector de Streams en Vivo**: Cambia de enlace AIOStreams directamente sin cerrar el reproductor.
- **Subtítulos Integrados (OpenSubtitles v3)**:
  - Detección automática de pistas en Español e Inglés con conversión transparente SRT a WebVTT.
  - Selector de desfase de subtítulos (+/- 0.5 segundos) para sincronización precisa de audio.
  - Carga manual de archivos `.srt` y `.vtt` locales.
- **Modo Binge-Watching para Series**: Aviso de cuenta atrás automático con botón *"Ver Ya"* para el siguiente episodio al alcanzar el 95% de reproducción.
- Atajos de teclado:
  - `Espacio`: Reproducir / Pausar
  - `Flechas Izquierda / Derecha`: Retroceder / Avanzar 10 segundos
  - `Flechas Arriba / Abajo`: Subir / Bajar volumen
  - `F`: Pantalla completa
  - `M`: Silenciar (Mute)
  - `Esc`: Cerrar reproductor
- Soporte para abrir streams en reproductores externos (**VLC**, **MPV**, **PotPlayer**) y botón para copiar enlace directo.

### 4. 📚 Biblioteca Personal (LocalStorage)
- **Continuar Viendo**: Guarda automáticamente el punto exacto de reproducción, barra porcentual y último episodio visto con opción de reanudar en un clic.
- **Favoritos / Guardados**: Marcador rápido para tus películas y series preferidas.
- **Historial**: Registro de títulos y streams reproducidos recientemente.
- **Copia de Seguridad**: Exportación e importación de tu biblioteca en formato JSON.

---

## 🚀 Instalación y Puesta en Marcha

### Prerrequisitos
- Node.js 18+ (recomendado Node.js 20 o 22)
- npm o pnpm

### Pasos
```bash
# 1. Clonar o acceder a la carpeta del proyecto
cd stremix

# 2. Instalar dependencias
npm install

# 3. Iniciar el servidor de desarrollo
npm run dev
```

La aplicación estará disponible inmediatamente en `http://localhost:5173/`.

---

## 🛠️ Configuración con tus Propios Addons y Real-Debrid

1. Abre la aplicación en tu navegador.
2. Haz clic en el indicador superior **"AIOStreams Demo"** o en el icono de **Ajustes** (⚙️).
3. Si dispones de una cuenta en Real-Debrid, Torbox o AllDebrid:
   - Haz clic en el enlace *"Abrir portal de configuración de AIOStreams"*.
   - Configura tus servicios y addons en el configurador web de AIOStreams.
   - Copia tu enlace de manifiesto generado (o tu token de configuración).
   - Pégalo en el campo **"Token de Configuración o Enlace Manifest"** en Stremix.
4. Presiona **"Probar Conexión"** para verificar la comunicación y luego **"Guardar Ajustes"**.
5. ¡Listo! A partir de ese momento todos los enlaces de tus scrapers y debrid se mostrarán priorizados e instantáneos.

---

## 📂 Estructura del Código

```
stremix/
├── src/
│   ├── components/
│   │   ├── Navbar.jsx           # Navegación, buscador con autocompletado y estado AIO
│   │   ├── HeroBanner.jsx       # Carrusel principal de estrenos y películas destacadas
│   │   ├── GenreSelector.jsx    # Selector de píldoras de géneros
│   │   ├── MediaCard.jsx        # Tarjeta con zoom, favoritos y reproducción rápida
│   │   ├── MediaModal.jsx       # Vista modal con ficha, episodios y sección AIOStreams
│   │   ├── StreamCard.jsx       # Tarjeta de stream con resolución, debrid, seeds y tamaño
│   │   ├── VideoPlayer.jsx      # Reproductor HLS con scrub bar, subtítulos y binge
│   │   ├── LibraryView.jsx      # Continuar viendo, favoritos, historial y backups
│   │   └── AioSettingsModal.jsx # Panel de configuración y diagnóstico de AIOStreams
│   ├── services/
│   │   ├── aiostream.js         # Cliente API AIOStreams, parser y generador de respaldo
│   │   ├── cinemeta.js          # Cliente de catálogo y metadatos Cinemeta
│   │   ├── subtitles.js         # Integración OpenSubtitles v3 y conversor SRT->VTT
│   │   └── storage.js           # Persistencia de biblioteca, ajustes y progreso
│   ├── App.jsx                  # Orquestador principal de estado y vistas
│   ├── index.css                # Sistema de diseño, temas obsidian y glassmorphism
│   └── main.jsx                 # Entrada de React
├── vite.config.js               # Configuración de Vite con Proxy CORS integrado
├── package.json
└── README.md
```

---

*Desarrollado con ❤️ para los amantes del cine y las series.*
