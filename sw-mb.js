const CACHE = 'ipowork-mb-v1';
const PRECACHE = ['./', './mb.html', './manifest-mb.json'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k!==CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if(e.request.url.includes('workers.dev')||e.request.url.includes('anthropic')||e.request.url.includes('fonts.g')){
    e.respondWith(fetch(e.request).catch(()=>new Response('Offline',{status:503}))); return;
  }
  e.respondWith(fetch(e.request).then(r=>{ if(r&&r.status===200){var c=r.clone();caches.open(CACHE).then(ca=>ca.put(e.request,c));} return r; }).catch(()=>caches.match(e.request)));
});
