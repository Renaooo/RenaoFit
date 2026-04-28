// Cloudflare Worker прокси для Vercel приложения
// Не требует домена, работает как зеркало

export default {
  async fetch(request) {
    // Определяем целевой URL (твой Vercel сайт)
    const targetUrl = 'https://renao-fit.vercel.app';
    
    const url = new URL(request.url);
    const proxyUrl = targetUrl + url.pathname + url.search;
    
    // Копируем заголовки, но убираем лишние
    const headers = new Headers(request.headers);
    headers.delete('host'); // важно для Vercel
    
    // Создаём новый запрос
    const proxyRequest = new Request(proxyUrl, {
      method: request.method,
      headers: headers,
      body: request.body,
      // redirect: 'follow'
    });
    
    // Отправляем запрос к Vercel
    const response = await fetch(proxyRequest);
    
    // Создаём ответ с CORS заголовками
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, x-client-info');
    
    // Обрабатываем OPTIONS запросы (CORS preflight)
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: responseHeaders });
    }
    
    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  }
};
