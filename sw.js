// Офлайн-режим для Act Master: страница, шрифты и библиотеки сохраняются в телефоне.
var CACHE_PREFIX = 'akt-master:' + self.registration.scope;
var CACHE = CACHE_PREFIX + ':v11';
var CORE = ['./', './index.html', './welcome.js', './vault.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
var PDF_PATH = new URL('./pdf-download/', self.registration.scope).pathname;
var pendingPdfs = new Map();

self.addEventListener('message', function (event) {
  var data = event.data;
  var channel = event.ports[0];
  if (!channel || !data || data.type !== 'prepare-pdf-download') return;
  var id = data.id, file = data.file;
  if (!event.source || typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id) || pendingPdfs.has(id) ||
      !(file instanceof File) || file.type !== 'application/pdf' || !file.size) {
    channel.postMessage(false);
    channel.close();
    return;
  }
  var finish;
  var lifetime = new Promise(function (resolve) { finish = resolve; });
  var expiry = setTimeout(remove, 12000);
  function remove() {
    clearTimeout(expiry);
    pendingPdfs.delete(id);
    finish();
  }
  pendingPdfs.set(id, {file: file, client: event.source.id, remove: remove});
  event.waitUntil(lifetime);
  channel.postMessage(true);
  channel.close();
});

function pdfAttachment(event, url) {
  var id = url.pathname.slice(PDF_PATH.length);
  var entry = pendingPdfs.get(id);
  if (!entry || (event.clientId && event.clientId !== entry.client)) {
    return new Response('Подготовьте PDF заново в Act Master.', {
      status: 410, headers: {'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store'}
    });
  }
  var filename = encodeURIComponent(entry.file.name).replace(/['()*]/g, function (char) {
    return '%' + char.charCodeAt(0).toString(16).toUpperCase();
  });
  var download = event.request.method === 'GET';
  if (download) entry.remove();
  return new Response(download ? entry.file : null, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="act.pdf"; filename*=UTF-8\'\'' + filename,
      'Content-Length': String(entry.file.size),
      'Cache-Control': 'no-store'
    }
  });
}

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(CORE.map(function (url) { return new Request(url, { cache: 'reload' }); }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf(CACHE_PREFIX) === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  var url = new URL(req.url);
  var same = url.origin === self.location.origin;
  if (same && url.pathname.indexOf(PDF_PATH) === 0 && (req.method === 'GET' || req.method === 'HEAD')) {
    e.respondWith(pdfAttachment(e, url));
    return;
  }
  if (req.method !== 'GET') return;
  var cdn = /(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com)$/.test(url.hostname);
  if (!same && !cdn) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(function (res) {
      if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put('./index.html', copy); }); }
      return res;
    }).catch(function () { return caches.match('./index.html'); }));
    return;
  }
  e.respondWith(caches.match(req).then(function (hit) {
    var net = fetch(req).then(function (res) {
      if (res && (res.ok || res.type === 'opaque')) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () { return hit; });
    return hit || net;
  }));
});
