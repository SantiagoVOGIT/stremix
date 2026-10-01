import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'addon-cors-proxy',
      configureServer(server) {
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
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Stremix/1.0',
              'Accept': 'application/json, text/plain, */*'
            };

            if (req.headers['authorization']) {
              forwardHeaders['Authorization'] = req.headers['authorization'];
            }
            if (req.headers['x-aiostreams-user-data']) {
              forwardHeaders['x-aiostreams-user-data'] = req.headers['x-aiostreams-user-data'];
            }

            const response = await fetch(targetUrl, {
              headers: forwardHeaders
            });

            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', '*');
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
      }
    }
  ],
  server: {
    port: 5173,
    host: true
  }
})
