import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { Readable } from 'node:stream'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'stremix-proxy-middleware',
      configureServer(server) {
        // 1. JSON & API metadata proxy (for Cinemeta, manifests, subtitles)
        server.middlewares.use('/api/proxy', async (req, res) => {
          if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', '*');
            res.statusCode = 200;
            return res.end();
          }

          const parsed = new URL(req.url, 'http://localhost');
          const targetUrl = parsed.searchParams.get('url');
          if (!targetUrl) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'Missing target url parameter' }));
          }

          try {
            const forwardHeaders = {
              'Accept': 'application/json, text/plain, */*'
            };

            if (req.headers['user-agent']) {
              forwardHeaders['User-Agent'] = req.headers['user-agent'];
            }
            if (req.headers['authorization']) {
              forwardHeaders['Authorization'] = req.headers['authorization'];
            }
            if (req.headers['x-aiostreams-user-data']) {
              forwardHeaders['x-aiostreams-user-data'] = req.headers['x-aiostreams-user-data'];
            }

            // Custom headers passed as JSON in query
            const customHeadersParam = parsed.searchParams.get('headers');
            if (customHeadersParam) {
              try {
                const parsedHeaders = JSON.parse(customHeadersParam);
                Object.assign(forwardHeaders, parsedHeaders);
              } catch {
                // ignore invalid json headers
              }
            }

            const response = await fetch(targetUrl, {
              headers: forwardHeaders
            });

            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', '*');
            res.setHeader('Access-Control-Expose-Headers', '*');
            res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
            
            const arrayBuf = await response.arrayBuffer();
            res.statusCode = response.status;
            res.end(Buffer.from(arrayBuf));
          } catch (err) {
            res.statusCode = 502;
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Proxy failed: ' + err.message }));
          }
        });

        // 2. High-performance Chunked Video Streaming Proxy with Range Support (HTTP 206)
        server.middlewares.use('/api/stream-proxy', async (req, res) => {
          if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', '*');
            res.statusCode = 200;
            return res.end();
          }

          const parsed = new URL(req.url, 'http://localhost');
          const targetUrl = parsed.searchParams.get('url');
          if (!targetUrl) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'Missing target video url' }));
          }

          try {
            const forwardHeaders = {};

            // Forward incoming Range header for seeking and partial streaming
            if (req.headers['range']) {
              forwardHeaders['Range'] = req.headers['range'];
            }

            // Pass incoming client User-Agent if provided
            if (req.headers['user-agent']) {
              forwardHeaders['User-Agent'] = req.headers['user-agent'];
            }

            if (req.headers['authorization']) {
              forwardHeaders['Authorization'] = req.headers['authorization'];
            }

            // Custom headers forwarded from Stremio behaviorHints (e.g. Referer, Cookie)
            const customHeadersParam = parsed.searchParams.get('headers');
            if (customHeadersParam) {
              try {
                const parsedHeaders = JSON.parse(customHeadersParam);
                Object.assign(forwardHeaders, parsedHeaders);
              } catch {
                // ignore
              }
            }

            const controller = new AbortController();
            req.on('close', () => {
              if (!res.writableEnded) {
                controller.abort();
              }
            });

            let upstreamResponse;
            try {
              upstreamResponse = await fetch(targetUrl, {
                method: req.method || 'GET',
                headers: forwardHeaders,
                redirect: 'follow',
                signal: controller.signal
              });
            } catch (fetchErr) {
              // If HEAD failed with network / method not allowed, try fallback to GET with first byte
              if (req.method === 'HEAD') {
                forwardHeaders['Range'] = 'bytes=0-0';
                upstreamResponse = await fetch(targetUrl, {
                  method: 'GET',
                  headers: forwardHeaders,
                  redirect: 'follow',
                  signal: controller.signal
                });
              } else {
                throw fetchErr;
              }
            }

            // Set CORS & Range response headers
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', '*');
            res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges, Content-Type');
            res.setHeader('Accept-Ranges', 'bytes');

            const contentType = upstreamResponse.headers.get('content-type') || 'video/mp4';
            res.setHeader('Content-Type', contentType);

            const contentRange = upstreamResponse.headers.get('content-range');
            if (contentRange) {
              res.setHeader('Content-Range', contentRange);
            }

            const contentLength = upstreamResponse.headers.get('content-length');
            if (contentLength) {
              res.setHeader('Content-Length', contentLength);
            }

            res.statusCode = upstreamResponse.status;

            if (req.method === 'HEAD' || !upstreamResponse.body) {
              return res.end();
            }

            // Stream response chunk by chunk using pipe without buffering into memory
            const nodeStream = Readable.fromWeb(upstreamResponse.body);
            nodeStream.on('error', (err) => {
              // Ignore cancellation when seeking or client disconnects
              if (err.name === 'AbortError' || err.code === 'ERR_STREAM_PREMATURE_CLOSE') {
                return;
              }
              console.warn('Stream notice:', err.message);
            });

            res.on('error', () => {
              try { controller.abort(); } catch {}
            });

            nodeStream.pipe(res);
          } catch (err) {
            if (err.name === 'AbortError') return;
            console.error('Stream proxy error:', err.message);
            if (!res.headersSent) {
              res.statusCode = 502;
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Stream proxy failed: ' + err.message }));
            }
          }
        });
      }
    }
  ],
  server: {
    port: 5173,
    host: true
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/hls.js')) return 'hls-vendor';
          if (id.includes('node_modules/lucide-react')) return 'lucide-icons';
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'react-vendor';
        }
      }
    }
  }
})
