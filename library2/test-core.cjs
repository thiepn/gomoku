const C=require('./core.js');
const ok=(v,m)=>{if(!v)throw new Error(m)};
ok(C.VERSION==='1.9.0','version');
let s=C.summary({backend:'indexeddb',revision:1,limit:2000,items:[]},[],{moves:[]});
ok(s.primary.id==='play'&&s.counts.total===0,'empty library');
s=C.summary({backend:'indexeddb',revision:2,limit:2000,items:[
  {id:'study',title:'Opening notes',date:'2026-10-05T10:00:00Z',data:{mode:'study',moves:[{i:1}]}},
  {id:'game',title:'Game A',date:'2026-10-06T10:00:00Z',data:{mode:'ai',moves:[{i:1},{i:2}]}}
]},[
  {id:'study',digest:{valid:true,total:1,needsAnalysis:false,current:true,flagged:0}},
  {id:'game',digest:{valid:true,total:2,needsAnalysis:true,current:false,flagged:1,worst:{ply:2}}}
],{moves:[]});
ok(s.counts.total===2&&s.counts.studies===1,'archive counts');
ok(s.counts.needsReview===1&&s.primary.id==='review-center','stale review priority');
s=C.summary({items:[
  {id:'a',title:'Older',date:'2026-10-04',data:{mode:'ai',moves:[{i:1}]}},
  {id:'b',title:'Flagged',date:'2026-10-06',data:{mode:'ai',moves:[{i:1}]}}
]},[
  {id:'a',digest:{valid:true,total:1,needsAnalysis:false,current:true,flagged:0}},
  {id:'b',digest:{valid:true,total:1,needsAnalysis:false,current:true,flagged:3,worst:{ply:1}}}
],{});
ok(s.primary.id==='flagged'&&s.primary.entryId==='b'&&s.counts.flagged===1,'current key moment priority');
s=C.summary({items:[{id:'x',title:'Latest',date:'2026-10-06',data:{mode:'study',moves:[]}}]},[{id:'x',digest:{valid:true,total:0,needsAnalysis:false,current:false,flagged:0}}],{});
ok(s.primary.id==='latest','latest fallback');
console.log('PASS Gomoku 1.9 Library & Archive 2.0 core contracts.');
