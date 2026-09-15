/**
 * AviationXplr CORS Proxy — Cloudflare Worker (ES module)
 * Deploy via Cloudflare → Workers → Connect GitHub, or: npx wrangler deploy
 *
 * Usage: GET https://YOUR_WORKER.workers.dev/?url=<encoded upstream URL>
 */
const ALLOWED_HOSTS = [
  'opendata.adsb.fi',
  'api.adsb.lol',
  'api.adsb.one',
  'opensky-network.org',
  'aviationweather.gov',
  'www.aviationweather.gov',
  'www.1800wxbrief.com',
  '1800wxbrief.com',
  'api.planes.fyi',
  'planes.fyi',
  'tfr.faa.gov',
  'www.faa.gov',
  'server.arcgisonline.com',
  'mesonet.agron.iastate.edu',
  'api.rainviewer.com',
  'tilecache.rainviewer.com',
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

    // Health check
    if (u.pathname === '/' && !u.searchParams.get('url')) {
      return new Response(
        JSON.stringify({
          ok: true,
          service: 'aviationxplr-cors-proxy',
          usage: '/?url=' + encodeURIComponent('https://aviationweather.gov/api/data/metar?ids=KPHL&format=json'),
        }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

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

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return new Response(JSON.stringify({ error: 'Only http/https allowed' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const hostOk = ALLOWED_HOSTS.some(
      (h) => parsed.hostname === h || parsed.hostname.endsWith('.' + h)
    );
    if (!hostOk) {
      return new Response(JSON.stringify({ error: 'Host not allowed', host: parsed.hostname }), {
        status: 403,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    try {
      const upstream = await fetch(target, {
        headers: {
          Accept: 'application/json, text/plain, */*',
          'User-Agent': 'AviationXplr/1.0 (cloudflare-worker)',
        },
        cf: { cacheTtl: 20, cacheEverything: false },
      });
      const body = await upstream.arrayBuffer();
      const headers = new Headers(cors);
      headers.set(
        'Content-Type',
        upstream.headers.get('Content-Type') || 'application/json'
      );
      headers.set('Cache-Control', 'public, max-age=20');
      return new Response(body, { status: upstream.status, headers });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }), {
        status: 502,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
  },
};
