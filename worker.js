// Cloudflare Worker прокси для Vercel приложения
// GitHub: Renaooo/RenaoFit

export default {
  async fetch(request) {
    // Целевой Vercel сайт
    const targetUrl = 'https://renao-fit.vercel.app';
    
    const url = new URL(request.url);
    const proxyUrl = targetUrl + url.pathname + url.search;
    
    // Копируем заголовки
    const headers = new Headers(request.headers);
    headers.delete('host');
    
    const proxyRequest = new Request(proxyUrl, {
      method: request.method,
      headers: headers,
      body: request.body,
    });
    
    const response = await fetch(proxyRequest);
    
    // Добавляем CORS заголовки
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, x-client-info');
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: responseHeaders });
    }
    
    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  }
};
