/* 识陷 · 静态资源缓存。脚本与题库全部随站点发布，可断网继续学习。 */
'use strict';
const CACHE = 'shixian-v3';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './icon.svg',
  './data/questions.js',
  './data/questions-extra.js',
  './data/questions-mix.js',
  './data/recite.js',
  './data/traps.js',
  './data/timeline.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  event.respondWith(
    caches.match(request).then(cached => {
      const update = fetch(request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          caches.open(CACHE).then(cache => cache.put(request, response.clone()));
        }
        return response;
      }).catch(() => cached);
      return cached || update;
    })
  );
});
