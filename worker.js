// Cloudflare Worker: прокси для Vercel + Supabase
// GitHub: Renaooo/RenaoFit

const VERIFICATION_TOKEN = 'renao-secret-token-2026';

// Настоящие адреса
const TARGET_URL = 'https://renao-fit.vercel.app';
const SUPABASE_URL = 'https://wviocztioezobgfktdrz.supabase.co';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // === 1. Проверка для обхода CORS (опционально) ===
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
    
    // === 2. Маршрутизация запросов ===
    let targetUrl;
    
    // Запросы к Supabase API
    if (path.startsWith('/rest/v1/') || 
        path.startsWith('/auth/v1/') || 
        path.startsWith('/realtime/v1/') ||
        path.includes('supabase.co')) {
      targetUrl = SUPABASE_URL + path + url.search;
    } 
    // Остальные запросы — к Vercel (фронтенд)
    else {
      targetUrl = TARGET_URL + path + url.search;
    }
    
    // Копируем заголовки
    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('origin');
    
    // Добавляем заголовок для проверки (опционально)
    headers.set('X-Proxy-By', 'Cloudflare-Worker');
    
    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.body,
    });
    
    try {
      const response = await fetch(proxyRequest);
      
      // Копируем заголовки ответа
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
