// Service Worker:快取 App 外殼,離線也能開(AI 功能需要網路)。
const VER = 'slim-v15';
const ASSETS = [
  './',
  './index.html',
  './style.css?v=15',
  './app.js?v=15',
  './store.js',
  './ai.js',
  './nutrition.js',
  './preset-schedule.js',
  './manifest.webmanifest?v=15',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VER).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VER).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      // 舊版採快取優先；新版接管後主動重新導覽一次，讓已開啟的手機頁面立即執行新程式。
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clients) => {
        // 只啟動重新導覽，不在 activate 裡等待導覽完成，避免瀏覽器在接管時互相等待。
        clients.forEach((client) => client.navigate(client.url).catch(() => {}));
      })
  );
});

// 同源資源:網路優先，離線時才回快取；避免手機長期執行舊版程式。API 呼叫不在本站同源範圍內。
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    caches.open(VER).then(async (cache) => {
      try {
        const res = await fetch(e.request);
        if (res.ok) cache.put(e.request, res.clone());
        return res;
      } catch {
        const cached = await cache.match(e.request);
        if (cached) return cached;
        if (e.request.mode === 'navigate') return cache.match('./index.html');
        return Response.error();
      }
    })
  );
});
