/* A6 — retained worker, exact-flight sharing, abortable subscribers and bounded evidence cache.
 * Legacy GomokuMistakes/IndexedDB schema below is preserved byte-for-byte. */
if(typeof window!=='undefined') (()=>{
 'use strict';
 const Policy=window.GomokuRuntimePolicy6;
 if(!Policy)throw Error('Analysis runtime performance policy missing from offline bundle.');
 const cache=new Policy.ResultCache({maxEntries:24,maxBytes:4*1024*1024,ttlMs:45*60*1000});
 let worker=null,url=null,pending=null,serial=0,watchdog=null;
 let created=0,completed=0,cacheHits=0,joined=0,cancellations=0,errors=0,adaptiveCaps=0;
 const clone=x=>JSON.parse(JSON.stringify(x));
 const abortError=()=>new DOMException('Analysis canceled','AbortError');
 function disposeWorker(){
   if(worker){worker.terminate();worker=null;}
   if(url){URL.revokeObjectURL(url);url=null;}
 }
 function stopTimer(){if(watchdog!==null){clearTimeout(watchdog);watchdog=null;}}
 function deliver(job,value,error){
   if(pending!==job)return;
   pending=null;stopTimer();
   for(const sub of job.subscribers){
     if(sub.signal&&sub.onAbort)sub.signal.removeEventListener('abort',sub.onAbort);
     try{if(error)sub.reject(error);else sub.resolve({...clone(value),cacheHit:false});}catch{}
   }
   job.subscribers.clear();
 }
 function cancel(){
   if(!pending)return;
   const job=pending;cancellations++;deliver(job,null,abortError());
   // Synchronous analysis cannot cooperatively yield inside a native search:
   // terminate only the canceled worker and build a replacement next time.
   disposeWorker();
 }
 function release(){cancel();disposeWorker();}
 function join(job,options){
   return new Promise((resolve,reject)=>{
     const signal=options.signal;
     if(signal?.aborted){reject(abortError());return;}
     const sub={resolve,reject,signal,onProgress:options.onProgress,onAbort:null};
     job.subscribers.add(sub);
     if(signal){
       sub.onAbort=()=>{
         if(!job.subscribers.delete(sub))return;
         signal.removeEventListener('abort',sub.onAbort);
         reject(abortError());
         if(pending===job&&!job.subscribers.size)cancel();
       };
       signal.addEventListener('abort',sub.onAbort,{once:true});
       if(signal.aborted)sub.onAbort();
     }
   });
 }
 function fail(job,error,{reset=true}={}){
   errors++;
   deliver(job,null,error instanceof Error?error:Error(String(error)));
   if(reset)disposeWorker();
 }
 function ensure(){
   if(worker)return;
   if(typeof Worker!=='function')throw Error('Background analysis is unavailable in this browser.');
   const source=v5WorkerPrelude()+`;const R=(${createGuidedReviewCore.toString()});const A=(${createAnalysis2.toString()})(createEngine,createStudioCore,R);onmessage=({data:d})=>{try{postMessage({id:d.id,stage:'Searching candidates and verifying threats'});const result=d.options.verifyOnly?{valid:A.verify(d.options.certificate)}:A.analyze(d.board,d.color,d.rule,d.played,d.options);postMessage({id:d.id,result});}catch(e){postMessage({id:d.id,error:e.message||String(e)});}};`;
   url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
   try{worker=new Worker(url);created++;}
   catch(e){URL.revokeObjectURL(url);url=null;throw e;}
   const owner=worker;
   worker.onmessage=({data:d})=>{
     if(worker!==owner)return; // old worker from a canceled generation
     const job=pending;
     if(!job||job.id!==d.id)return; // stale or canceled worker reply
     if(d.stage){for(const sub of job.subscribers){try{sub.onProgress?.(d.stage);}catch{}}return;}
     if(d.error){fail(job,Error(d.error),{reset:false});return;}
     completed++;
     if(job.cacheable)cache.put(job.key,d.result);
     deliver(job,d.result,null);
   };
   worker.onerror=e=>{
     e.preventDefault();
     if(worker!==owner)return;
     if(pending)fail(pending,Error(e.message||'Analysis worker failed.'));
     else disposeWorker();
   };
   worker.onmessageerror=()=>{
     if(worker!==owner)return;
     if(pending)fail(pending,Error('Analysis worker returned an unreadable message.'));
     else disposeWorker();
   };
 }
 function request(board,color,rule,played,options={}){
   if(options.signal?.aborted)return Promise.reject(abortError());
   let policy,key,effective;
   try{
     policy=Policy.admission(options,Policy.deviceSnapshot(window));
     effective={...options};
     delete effective.onProgress;delete effective.signal;
     if(options.adaptiveBudget===true){
       effective.timeMs=policy.appliedMs;
       if(policy.capped)adaptiveCaps++;
     }
     key=Policy.key(board,color,rule,played,effective,runtime.version);
   }catch(error){return Promise.reject(error);}
   if(pending&&pending.key===key&&!options.force){
     joined++;return join(pending,options);
   }
   // New analysis supersedes the old UI request. No stale result can win a race.
   cancel();
   if(!options.force){
     const hit=cache.get(key);
     if(hit!==null){cacheHits++;return Promise.resolve({...hit,cacheHit:true});}
   }
   try{ensure();}catch(error){return Promise.reject(error);}
   const job={id:++serial,key,subscribers:new Set(),cacheable:options.verifyOnly!==true};
   pending=job;
   const promise=join(job,options);
   if(pending!==job)return promise; // signal may have aborted immediately
   const budget=Number(effective.timeMs)||10000;
   watchdog=setTimeout(()=>{
     if(pending!==job)return;
     fail(job,Error('Analysis exceeded its bounded worker deadline. Retry with a smaller search budget.'));
   },Math.max(10000,budget+17000));
   try{
     worker.postMessage({id:job.id,board:Array.from(board),color,rule,played,options:effective});
   }catch(e){if(pending===job)fail(job,e);}
   return promise;
 }
 const runtime={version:'3.0.0-a2',runtimeVersion:Policy.VERSION,
   request,cancel,release,
   stats:()=>({workersCreated:created,completed,cacheHits,coalescedRequests:joined,
     cancelled:cancellations,errors,adaptiveCaps,cacheGeneration:Policy.VERSION,
     ...cache.stats(),busy:!!pending,subscribers:pending?.subscribers.size||0,
     deviceClass:Policy.deviceClass(Policy.deviceSnapshot(window))}),
   deviceInfo:()=>Policy.deviceClass(Policy.deviceSnapshot(window)),
   clearResults:()=>cache.clear()
 };
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
 async function audit(){
   const entries=await list(),I=window.GomokuPracticeIntegrity8;
   if(!I)throw Error('Practice integrity checker is unavailable.');
   const analysis=A();
   return I.inspect(entries,{validateCard:c=>analysis.validateCard(c),backend});
 }
 async function previewImport(data){
   const I=window.GomokuPracticeIntegrity8;
   if(!I)throw Error('Practice integrity checker is unavailable.');
   const analysis=A(),entries=await list();
   return I.previewImport(entries,data,{validateCard:c=>analysis.validateCard(c)});
 }
 async function importData(data){
   if(!data||data.format!=='GomokuMistakeLibrary'||data.version!==2||!Array.isArray(data.cards)||data.cards.length>150)throw Error('Unsupported mistake library.');
   if(JSON.stringify(data).length>14000000)throw Error('Mistake import exceeds 14 MB.');
   // Reject duplicate source IDs and oversized merges before the transaction.
   await previewImport(data);
   const engine=A(),cards=data.cards.map(c=>engine.validateCard(c));
   // Validate every card before opening a write transaction. Incoming statistics
   // never replace existing local recall history; new cards retain their history.
   await add(cards);return cards.length;
 }
 window.GomokuMistakes=Object.freeze({version:2,list,add,record,remove,audit,previewImport,importData,
   exportData:async()=>({format:'GomokuMistakeLibrary',version:2,exportedAt:new Date().toISOString(),cards:await list()}),
   status:()=>({backend,error:lastError,persistent:backend==='indexeddb'})});
})();
