/* 识陷 · 离线缓存 Service Worker（在线访问一次后，断网也能继续练习） */
'use strict';
const CACHE = 'shixian-v2';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './questions.js',
  './app.js',
  './manifest.webmanifest',
  './icon.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()).catch(() => {})
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // 缓存优先，后台同步新版本（stale-while-revalidate）
  e.respondWith(
    caches.match(req, { ignoreSearch: false }).then(hit => {
      const net = fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
