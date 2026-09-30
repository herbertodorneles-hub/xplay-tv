const C='xplay-v4',SHELL=['./','index.html','manifest.webmanifest','xplay-shim.js','xplay-input-guard.js','icons/icon-192.png','icons/icon-512.png','games/corrida-saudavel-3d/','games/tropa-vg-operacao-3d/'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>Promise.all(SHELL.map(u=>c.add(u).catch(()=>{})))))});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!=C).map(x=>caches.delete(x)))).then(()=>clients.claim())));
const put=(r,x)=>{if(x&&x.status==200&&x.type!='opaque'){const y=x.clone();caches.open(C).then(k=>k.put(r,y))}return x};
self.addEventListener('fetch',e=>{const r=e.request;
if(r.method!='GET'||!r.url.startsWith(self.location.origin)||r.headers.has('range'))return;
if(r.mode=='navigate'||r.destination=='iframe'||r.destination=='document'){
/* páginas: rede primeiro, mas cai no cache em 2,5s (TV com Wi-Fi lento não trava) */
e.respondWith(new Promise(ok=>{let done=0;const cached=()=>caches.match(r).then(m=>{if(!done&&m){done=1;ok(m)}});
const t=setTimeout(cached,2500);
fetch(r).then(x=>{clearTimeout(t);done=1;ok(put(r,x))}).catch(()=>{clearTimeout(t);caches.match(r).then(m=>{done=1;ok(m||Response.error())})})}));return}
/* scripts, imagens, ícones: cache na hora e atualiza em segundo plano */
e.respondWith(caches.match(r).then(m=>{const n=fetch(r).then(x=>put(r,x)).catch(()=>m);return m||n}))});
