/* Persistent, interruptible analysis worker + transactional local mistake bank. */
if(typeof window!=='undefined') (()=>{
 'use strict';
 let worker=null,url=null,pending=null,serial=0,timer=null,created=0,completed=0,cacheHits=0;
 const cache=new Map(),clone=x=>JSON.parse(JSON.stringify(x));
 const runtime={version:'2.1.0',request,cancel,release,stats:()=>({workersCreated:created,completed,cacheHits,cachedPositions:cache.size,busy:!!pending})};
 function cancel(){
   if(!pending)return;
   const job=pending;pending=null;clearTimeout(timer);worker?.terminate();worker=null;if(url)URL.revokeObjectURL(url);url=null;
   job.reject(new DOMException('Analysis canceled','AbortError'));
 }
 function release(){cancel();worker?.terminate();worker=null;if(url)URL.revokeObjectURL(url);url=null;}
 function ensure(){
   if(worker)return;
   if(typeof Worker!=='function')throw Error('Background analysis is unavailable in this browser.');
   const source=v5WorkerPrelude()+`;const R=(${createGuidedReviewCore.toString()});const A=(${createAnalysis2.toString()})(createEngine,createStudioCore,R);onmessage=({data:d})=>{try{postMessage({id:d.id,stage:'Searching candidates and verifying threats'});const result=d.options.verifyOnly?{valid:A.verify(d.options.certificate)}:A.analyze(d.board,d.color,d.rule,d.played,d.options);postMessage({id:d.id,result});}catch(e){postMessage({id:d.id,error:e.message||String(e)});}};`;
   url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));worker=new Worker(url);created++;
   worker.onmessage=({data:d})=>{
     if(!pending||pending.id!==d.id)return;
     if(d.stage){pending.onProgress?.(d.stage);return;}
     const job=pending;pending=null;clearTimeout(timer);
     if(d.error){job.reject(Error(d.error));return;}
     completed++;cache.set(job.key,clone(d.result));while(cache.size>32)cache.delete(cache.keys().next().value);
     job.resolve({...d.result,cacheHit:false});
   };
   worker.onerror=e=>{
     e.preventDefault();const job=pending;pending=null;clearTimeout(timer);worker?.terminate();worker=null;if(url)URL.revokeObjectURL(url);url=null;
     job?.reject(Error(e.message||'Analysis worker could not start.'));
   };
 }
 function request(board,color,rule,played,options={}){
   cancel();const key=JSON.stringify([runtime.version,rule,color,played,board,options.preset,options.timeMs,options.context,options.backend,options.verifyOnly,options.certificate]);
   if(cache.has(key)&&!options.force){const value=cache.get(key);cache.delete(key);cache.set(key,value);cacheHits++;return Promise.resolve({...clone(value),cacheHit:true});}
   return new Promise((resolve,reject)=>{
     try{
       ensure();const id=++serial;pending={id,key,resolve,reject,onProgress:options.onProgress};
       const plain={...options};delete plain.onProgress;
       timer=setTimeout(()=>{if(pending?.id!==id)return;const job=pending;pending=null;worker?.terminate();worker=null;if(url)URL.revokeObjectURL(url);url=null;job.reject(Error('Analysis exceeded its safety limit. Completed work is kept; retry with a smaller budget.'));},Math.max(10000,(Number(options.timeMs)||10000)+17000));
       worker.postMessage({id,board:Array.from(board),color,rule,played,options:plain});
     }catch(error){const job=pending;pending=null;clearTimeout(timer);if(worker)worker.terminate();worker=null;if(url)URL.revokeObjectURL(url);url=null;reject(error);}
   });
 }
 window.GomokuAnalysisRuntime=Object.freeze(runtime);
 let dbPromise=null,backend='opening',lastError='',memory=new Map();
 const A=()=>createAnalysis2(createV5EngineFactory(createEngine,V5_WASM_BASE64),createStudioCore,createGuidedReviewCore);
 function database(){
   if(dbPromise)return dbPromise;
   dbPromise=new Promise(resolve=>{
     try{
       const req=indexedDB.open('gomoku.analysis2.learning',1);let settled=false;
       req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('positions'))req.result.createObjectStore('positions',{keyPath:'id'});};
       req.onsuccess=()=>{if(settled){req.result.close();return;}settled=true;backend='indexeddb';req.result.onversionchange=()=>{req.result.close();dbPromise=null;};resolve(req.result);};
       req.onerror=()=>{settled=true;backend='memory';lastError=req.error?.message||'Local database unavailable';resolve(null);};
       req.onblocked=()=>{settled=true;backend='memory';lastError='Close other old app tabs to unlock the local database.';resolve(null);};
     }catch(e){backend='memory';lastError=e.message;resolve(null);}
   });return dbPromise;
 }
 async function list(){
   const db=await database();if(!db)return Array.from(memory.values()).map(clone);
   return new Promise((resolve,reject)=>{const tx=db.transaction('positions','readonly'),r=tx.objectStore('positions').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 }
 async function transact(ids,mutate){
   const db=await database();
   if(!db){const all=Array.from(memory.values()).map(clone),next=mutate(all);if(next.length>150)throw Error('Mistake library limit: 150 positions. Export and remove some positions before adding more.');memory=new Map(next.map(x=>[x.id,clone(x)]));window.dispatchEvent(new Event('gomoku-mistakes-changed'));return;}
   return new Promise((resolve,reject)=>{
     const tx=db.transaction('positions','readwrite'),store=tx.objectStore('positions'),r=store.getAll();
     r.onsuccess=()=>{try{const next=mutate(r.result);if(next.length>150)throw Error('Mistake library limit: 150 positions. Export and remove some positions before adding more.');const keep=new Set(next.map(x=>x.id));for(const old of r.result)if(!keep.has(old.id))store.delete(old.id);for(const row of next)store.put(row);}catch(e){lastError=e.message;tx.abort();reject(e);}};
     tx.oncomplete=()=>{window.dispatchEvent(new Event('gomoku-mistakes-changed'));resolve();};tx.onerror=()=>{lastError=tx.error?.message||'Unable to save practice';reject(tx.error||Error(lastError));};tx.onabort=()=>reject(tx.error||Error(lastError||'Practice save aborted.'));
   });
 }
 async function add(cards){
   if(!Array.isArray(cards)||cards.length>150)throw Error('Too many mistake positions.');
   const engine=A();const valid=cards.map(c=>{engine.validateCard(c);return clone(c);});
   await transact(valid.map(x=>x.id),rows=>{const map=new Map(rows.map(x=>[x.id,x]));for(const card of valid){const old=map.get(card.id);if(!old)map.set(card.id,card);else if(card.reference.analysisVersion===engine.VERSION&&old.reference.analysisVersion!==engine.VERSION||(card.reference.analysisVersion===old.reference.analysisVersion&&(card.reference.budget||0)>=(old.reference.budget||0)))map.set(card.id,{...card,created:old.created,stats:old.stats,events:old.events});}return [...map.values()];});
 }
 async function record(id,verdict,eventId){
   if(verdict.status==='unresolved')return;
   await transact([id],rows=>rows.map(row=>{
     if(row.id!==id||row.events?.some(e=>e.id===eventId))return row;
     const at=Date.now(),stats=A().schedule(row.stats,verdict,at),events=[...(row.events||[]),{id:eventId,status:verdict.status,assisted:!!verdict.assisted,at}].slice(-40);
     return {...row,stats,events,updated:at};
   }));
 }
 async function remove(id){await transact([id],rows=>rows.filter(x=>x.id!==id));}
 async function importData(data){
   if(!data||data.format!=='GomokuMistakeLibrary'||data.version!==2||!Array.isArray(data.cards)||data.cards.length>150)throw Error('Unsupported mistake library.');
   if(JSON.stringify(data).length>14000000)throw Error('Mistake import exceeds 14 MB.');
   const engine=A(),cards=data.cards.map(c=>engine.validateCard(c));
   // Validate every card before opening a write transaction. Incoming statistics
   // never replace existing local recall history; new cards retain their history.
   await add(cards);return cards.length;
 }
 window.GomokuMistakes=Object.freeze({version:2,list,add,record,remove,importData,
   exportData:async()=>({format:'GomokuMistakeLibrary',version:2,exportedAt:new Date().toISOString(),cards:await list()}),
   status:()=>({backend,error:lastError,persistent:backend==='indexeddb'})});
})();
