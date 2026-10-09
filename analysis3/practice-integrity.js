/* A8 — read-only audit and import preview for the existing v2 practice library.
   No storage ownership, no migration, no network access, and no mutation. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root&&typeof root==='object')root.GomokuPracticeIntegrity8=api;
})(typeof globalThis==='object'?globalThis:null,function(){
 'use strict';
 const fmt=x=>typeof x==='string'&&x.length>0;
 function inspect(rows,{validateCard,backend='unknown',limit=150}={}){
   const issues=[],seen=new Set(),counts={positions:0,scored:0,assisted:0,successes:0,lapses:0,retainedEvents:0,due:0};
   const now=Date.now();
   if(!Array.isArray(rows))return {ok:false,backend,counts,issues:['Library did not return an array.'],recoverable:false};
   for(let i=0;i<rows.length;i++){
     const c=rows[i];counts.positions++;
     if(!c||!fmt(c.id)){issues.push('Card '+i+' has no identifier.');continue;}
     if(seen.has(c.id))issues.push('Duplicate card identifier '+i+'.');seen.add(c.id);
     if(c.version!==2||!Array.isArray(c.board)||c.board.length!==225)issues.push('Unsupported saved card '+i+'.');
     if(typeof validateCard==='function'){
       try{validateCard(c);}catch(e){issues.push('Card '+i+' requires attention: '+String(e?.message||e).slice(0,160));}
     }
     const stats=c.stats||{};
     for(const key of ['attempts','successes','lapses','assisted','streak','due']){
       if(!Number.isSafeInteger(stats[key])||stats[key]<0){issues.push('Card '+i+' has invalid '+key+'.');}
     }
     counts.scored+=Number.isSafeInteger(stats.attempts)?stats.attempts:0;
     counts.successes+=Number.isSafeInteger(stats.successes)?stats.successes:0;
     counts.lapses+=Number.isSafeInteger(stats.lapses)?stats.lapses:0;
     counts.assisted+=Number.isSafeInteger(stats.assisted)?stats.assisted:0;
     if(Number.isSafeInteger(stats.due)&&stats.due<=now)counts.due++;
     if(stats.successes>stats.attempts||stats.assisted>stats.attempts||
        stats.lapses>stats.attempts||stats.successes+stats.assisted+stats.lapses>stats.attempts)
       issues.push('Card '+i+' has inconsistent attempt counters.');
     const ev=Array.isArray(c.events)?c.events:[];
     if(!Array.isArray(c.events))issues.push('Card '+i+' is missing its recall events.');
     const ids=new Set();
     for(const event of ev){
       if(!event||!fmt(event.id)||ids.has(event.id)||!['correct','incorrect'].includes(event.status)||
          !Number.isFinite(event.at)){
         issues.push('Card '+i+' has an invalid or duplicate event.');break;
       }ids.add(event.id);
     }
     counts.retainedEvents+=ev.length;
     if(ev.length>40)issues.push('Card '+i+' exceeds the bounded recall-event history.');
   }
   if(rows.length>limit)issues.push('Library exceeds its configured position limit.');
   const nonpersistent=backend!=='indexeddb';
   return {ok:issues.length===0,backend,counts,issues,nonpersistent,
      backupRecommended:rows.length>0,requiresExport:nonpersistent&&rows.length>0,
      note:nonpersistent?'This browser session is not backed by IndexedDB. Export before closing.':
        'Read-only verification; no existing learning events or due dates were changed.'};
 }
 function previewImport(existing,incoming,{validateCard,limit=150}={}){
   if(!incoming||incoming.format!=='GomokuMistakeLibrary'||incoming.version!==2||
      !Array.isArray(incoming.cards)||incoming.cards.length>limit)
     throw Error('Unsupported or oversized training-library backup.');
   if(!Array.isArray(existing))throw Error('Current practice library is unavailable.');
   const present=new Set(existing.map(x=>x.id)),seen=new Set();
   let added=0,preserved=0;
   for(const c of incoming.cards){
     if(!c||!fmt(c.id)||seen.has(c.id))throw Error('Backup contains duplicate or invalid position IDs.');
     seen.add(c.id);
     if(typeof validateCard==='function')validateCard(c);
     if(present.has(c.id))preserved++;else added++;
   }
   if(present.size+added>limit)throw Error('Backup exceeds the combined library limit. No data was imported.');
   return Object.freeze({added,preserved,incoming:incoming.cards.length,
     existing:present.size,newTotal:present.size+added,
     statement:'Import adds new positions. For duplicates, the existing local recall history remains authoritative.'});
 }
 return Object.freeze({VERSION:'3.0.0-a8',inspect,previewImport});
});
