// Cloudflare Worker: прозрачный прокси для всех запросов к Vercel и Supabase
const TARGET_URL = 'https://renao-fit.vercel.app';
const SUPABASE_URL = 'https://wviocztioezobgfktdrz.supabase.co';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
        },
      });
    }
    
    // Определяем целевой URL
    let targetUrl;
    if (path.startsWith('/rest/v1/') || 
        path.startsWith('/auth/v1/') || 
        path.startsWith('/realtime/v1/')) {
      targetUrl = SUPABASE_URL + path + url.search;
    } else {
      // ВСЕ остальные запросы (включая JS, CSS, HTML) идут на Vercel
      targetUrl = TARGET_URL + path + url.search;
    }
    
    // Копируем заголовки
    const headers = new Headers(request.headers);
    headers.delete('host');
    
    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.body,
    });
    
    try {
      const response = await fetch(proxyRequest);
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    } catch (err) {
      console.error('Proxy error:', err);
      return new Response(`Proxy error: ${err.message}`, { status: 502 });
    }
  }
};
