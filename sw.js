const CACHE_NAME = 'gomoku-v12.1.0-review-1.0.0-table-1.0.2-audit';
const APP_SHELL = ['./','./index.html','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/maskable-icon-512.png','./icons/apple-touch-icon.png','./icons/favicon-32.png'];
const scopeURL=new URL('./',self.location.href);
const shellURL=new URL('index.html',scopeURL).href;
const assets=new Set(APP_SHELL.map(path=>new URL(path,scopeURL).pathname));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL))));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('gomoku-')&&key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==scopeURL.origin||!url.pathname.startsWith(scopeURL.pathname))return;
  const isShell=url.pathname===scopeURL.pathname||url.pathname===new URL(shellURL).pathname;
  // Only game navigation can refresh the game shell. Documentation must never replace it.
  if(request.mode==='navigate'){
    if(!isShell)return;
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE_NAME).catch(()=>null);let response;
      try{response=await fetch(request);if(response.ok){if(cache)event.waitUntil(cache.put(shellURL,response.clone()).catch(()=>{}));return response;}}catch{}
      return (cache&&await cache.match(shellURL).catch(()=>null))||response||Response.error();
    })());return;
  }
  // Do not cache room APIs, unrelated hub applications, or arbitrary requests.
  if(!assets.has(url.pathname))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME).catch(()=>null),cached=cache?await cache.match(request,{ignoreSearch:true}).catch(()=>null):null;
    const network=fetch(request).then(response=>{if(response.ok&&cache)event.waitUntil(cache.put(new URL(url.pathname,scopeURL.origin).href,response.clone()).catch(()=>{}));return response;}).catch(()=>cached||Response.error());
    event.waitUntil(network.then(()=>{},()=>{}));return cached||network;
  })());
});
