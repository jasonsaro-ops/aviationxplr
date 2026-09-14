/**
 * AviationXplr CORS Proxy — Cloudflare Worker
 * Deploy: https://workers.cloudflare.com (free) → Create Worker → paste this → Deploy
 * Then set CONFIG.corsWorker in js/config.js to your workers.dev URL
 *
 * Usage: GET https://YOUR_WORKER.workers.dev/?url=https%3A%2F%2Fopendata.adsb.fi%2Fapi%2F...
 */
const ALLOWED_HOSTS = [
  'opendata.adsb.fi',
  'api.adsb.lol',
  'api.adsb.one',
  'opensky-network.org',
  'aviationweather.gov',
  'www.1800wxbrief.com',
  '1800wxbrief.com',
  'api.planes.fyi',
  'planes.fyi',
  'server.arcgisonline.com',
];

export default {
  async fetch(request) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    };
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    const u = new URL(request.url);
    const target = u.searchParams.get('url');
    if (!target) {
      return new Response(JSON.stringify({ error: 'Missing ?url=' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid url' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
    if (!ALLOWED_HOSTS.some((h) => parsed.hostname === h || parsed.hostname.endsWith('.' + h))) {
      return new Response(JSON.stringify({ error: 'Host not allowed', host: parsed.hostname }), {
        status: 403,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
    try {
      const upstream = await fetch(target, {
        headers: {
          Accept: 'application/json, text/plain, */*',
          'User-Agent': 'AviationXplr/1.0 (mission-display)',
        },
        cf: { cacheTtl: 15, cacheEverything: false },
      });
      const body = await upstream.arrayBuffer();
      const headers = new Headers(cors);
      headers.set('Content-Type', upstream.headers.get('Content-Type') || 'application/json');
      headers.set('Cache-Control', 'public, max-age=15');
      return new Response(body, { status: upstream.status, headers });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }), {
        status: 502,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
  },
};
