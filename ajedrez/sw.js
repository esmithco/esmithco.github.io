/* Offline + fast start. Pages (HTML) are network-first so new deploys show up right away;
   everything else (versioned with ?v=) is cache-first. Bump VER to drop old caches. */
var VER='taller-v6';
var CORE=['./','index.html','chess.js','stockfish.asm.js','manifest.webmanifest','icon-192.png','icon-180.png'];
self.addEventListener('install',function(e){e.waitUntil(caches.open(VER).then(function(c){return c.addAll(CORE)}).then(function(){return self.skipWaiting()}))});
self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return k!==VER}).map(function(k){return caches.delete(k)}))}).then(function(){return self.clients.claim()}))});
self.addEventListener('fetch',function(e){
  var r=e.request;if(r.method!=='GET')return;
  var u=new URL(r.url);if(u.origin!==location.origin)return; /* Chess.com API etc. go straight to the network */
  if(r.mode==='navigate'){
    e.respondWith(fetch(r.url,{cache:'no-store',credentials:'same-origin'}).then(function(res){var cp=res.clone();caches.open(VER).then(function(c){c.put('index.html',cp)});return res}).catch(function(){return caches.match('index.html')}));return}
  e.respondWith(caches.match(r).then(function(hit){return hit||fetch(r).then(function(res){if(res.ok){var cp=res.clone();caches.open(VER).then(function(c){c.put(r,cp)})}return res})}));
});
