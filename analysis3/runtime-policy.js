/* A6 — deterministic search admission and bounded result-cache policy.
 * All routine functions are pure except the dedicated in-memory ResultCache.
 * No network, storage, search-provenance or game-state dependency. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root&&typeof root==='object')root.GomokuRuntimePolicy6=api;
})(typeof globalThis==='object'?globalThis:null,function(){
  'use strict';
  const VERSION='3.0.0-a6',MIN_MS=120,MAX_MS=15000;
  const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
  const integer=(value,fallback,min,max)=>{
    const x=Number(value);return Number.isFinite(x)?Math.max(min,Math.min(max,Math.floor(x))):fallback;
  };
  function deviceClass({memoryGb=null,cores=null,saveData=false,coarsePointer=false}={}){
    if(saveData||Number.isFinite(memoryGb)&&memoryGb<=2||Number.isFinite(cores)&&cores<=2)return 'constrained';
    if(Number.isFinite(memoryGb)&&memoryGb<=4||Number.isFinite(cores)&&cores<=4)return 'balanced';
    return coarsePointer?'balanced':'unrestricted';
  }
  function deviceSnapshot(env){
    const nav=env?.navigator||{};
    let coarse=false;try{coarse=env?.matchMedia?.('(pointer: coarse)')?.matches===true;}catch{}
    return {memoryGb:Number.isFinite(nav.deviceMemory)?nav.deviceMemory:null,
      cores:Number.isFinite(nav.hardwareConcurrency)?nav.hardwareConcurrency:null,
      saveData:nav.connection?.saveData===true,coarsePointer:coarse};
  }
  function admission(options={},device={}){
    const requested=integer(options.timeMs,700,MIN_MS,MAX_MS);
    const kind=deviceClass(device);
    // Explicit user-selected strength settings are honored by default.
    // Opt-in adaptive budgets narrow only the search time; they do not upgrade
    // or falsify the request's proof/evaluation strength.
    const caps={constrained:650,balanced:1600,unrestricted:MAX_MS};
    const applied=options.adaptiveBudget===true?Math.min(requested,caps[kind]):requested;
    return Object.freeze({requestedMs:requested,appliedMs:applied,deviceClass:kind,
      adaptive:options.adaptiveBudget===true,capped:applied<requested,reason:applied<requested?'Device-aware performance cap':'User-selected search budget'});
  }
  function stable(value){
    if(value===null||typeof value!=='object')return JSON.stringify(value);
    if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
    const keys=Object.keys(value).sort();
    return '{'+keys.map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
  }
  function key(board,color,rule,played,options={},generation='3.0.0-a2'){
    if(!Array.isArray(board)&&!ArrayBuffer.isView(board))throw Error('Invalid board');
    if(board.length!==225||!Array.from(board).every(v=>v===0||v===1||v===2))throw Error('Invalid 15×15 board');
    if(![1,2].includes(color)||typeof rule!=='string'||!Number.isInteger(played)||played < -1||played>=225)throw Error('Invalid search request');
    const opts={};
    // Only options that influence evidence, search state or engine backend.
    for(const k of ['preset','timeMs','multiPV','context','backend','verifyOnly','certificate','adaptiveBudget','maxDepth','width','randomSeed']){
      if(own(options,k))opts[k]=options[k];
    }
    return stable([VERSION,generation,rule,color,played,Array.from(board),opts]);
  }
  class ResultCache{
    constructor({maxEntries=24,maxBytes=4*1024*1024,ttlMs=45*60*1000,now=()=>Date.now()}={}){
      this.limit=integer(maxEntries,24,1,128);
      this.bytesLimit=integer(maxBytes,4*1024*1024,4096,16*1024*1024);
      this.ttl=integer(ttlMs,45*60*1000,1000,24*60*60*1000);
      this.now=now;this.map=new Map();this.bytes=0;this.evictions=0;
    }
    get size(){return this.map.size;}
    get(k){
      const hit=this.map.get(k);
      if(!hit)return null;
      if(this.now()-hit.at>this.ttl){this.delete(k);return null;}
      this.map.delete(k);this.map.set(k,hit);
      return JSON.parse(hit.serialized);
    }
    delete(k){
      const row=this.map.get(k);if(!row)return false;
      this.bytes-=row.bytes;this.map.delete(k);return true;
    }
    put(k,result){
      let serialized;try{serialized=JSON.stringify(result);}catch{return false;}
      const bytes=serialized.length*2+String(k).length*2;
      if(bytes>this.bytesLimit)return false;
      this.delete(k);
      this.map.set(k,{serialized,bytes,at:this.now()});this.bytes+=bytes;
      while(this.map.size>this.limit||this.bytes>this.bytesLimit){
        this.delete(this.map.keys().next().value);this.evictions++;
      }
      return true;
    }
    clear(){this.map.clear();this.bytes=0;}
    stats(){return {cachedPositions:this.size,cacheBytes:this.bytes,evictions:this.evictions,
      maxPositions:this.limit,maxCacheBytes:this.bytesLimit,ttlMs:this.ttl};}
  }
  return Object.freeze({VERSION,MIN_MS,MAX_MS,deviceClass,deviceSnapshot,admission,stable,key,ResultCache});
});
