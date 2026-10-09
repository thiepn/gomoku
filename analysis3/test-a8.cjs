'use strict';
const assert=require('node:assert/strict'),A=require('./practice-integrity.js');
const board=Array(225).fill(0);
const card=(id,overrides={})=>({version:2,id,board:board.slice(),color:1,rule:'freestyle',played:112,
 context:{passes:0,moveCount:0},reference:{analysisVersion:'3.0.0-a2'},
 stats:{attempts:3,successes:1,lapses:1,assisted:1,streak:0,due:0,last:1000},
 events:[{id:id+'-1',status:'correct',assisted:false,at:1000},
         {id:id+'-2',status:'incorrect',assisted:false,at:2000},
         {id:id+'-3',status:'correct',assisted:true,at:3000}],...overrides});
const validate=c=>{if(c.version!==2||c.board.length!==225)throw Error('Invalid card schema');return c;};
const data=(cards)=>({format:'GomokuMistakeLibrary',version:2,cards});
let count=0;function test(n,f){f();count++;console.log('PASS '+n)}
test('valid saved positions and actual recall history audit cleanly',()=>{
 const a=A.inspect([card('x')],{validateCard:validate,backend:'indexeddb'});
 assert.equal(a.ok,true);assert.equal(a.counts.scored,3);assert.equal(a.counts.retainedEvents,3);
});
test('audit is read only for cards, events and due dates',()=>{
 const cards=[card('x')],before=JSON.stringify(cards);A.inspect(cards,{validateCard:validate});
 assert.equal(JSON.stringify(cards),before);
});
test('nonpersistent fallback must tell the user to export',()=>{
 const a=A.inspect([card('x')],{backend:'memory'});
 assert.equal(a.requiresExport,true);assert.equal(a.nonpersistent,true);
});
test('empty nonpersistent library needs no false backup alarm',()=>{
 assert.equal(A.inspect([],{backend:'memory'}).requiresExport,false);
});
test('invalid card ID cannot silently pass',()=>{
 const a=A.inspect([card('x',{id:''})],{validateCard:validate});
 assert.equal(a.ok,false);
});
test('historical invalid card is reported without being deleted',()=>{
 const c=card('x');c.board=[1,2];const a=A.inspect([c],{validateCard:validate});
 assert.equal(a.ok,false);assert.equal(c.board.length,2);
});
test('duplicate card IDs are disclosed',()=>{
 const x=A.inspect([card('x'),card('x')]);assert.equal(x.ok,false);
});
test('invalid recall event and duplicate token are detected',()=>{
 const c=card('x');c.events[1].id=c.events[0].id;
 assert.equal(A.inspect([c]).ok,false);
});
test('recall counters inconsistent with history are reported',()=>{
 const c=card('x');c.stats.attempts=1;
 assert.equal(A.inspect([c]).ok,false);
});
test('non-array library fails closed',()=>{
 const a=A.inspect(null);assert.equal(a.ok,false);
});
test('preview backup import counts added and existing without touching stats',()=>{
 const old=[card('x')],incoming=data([card('x',{stats:{...card('x').stats,attempts:50}}),card('y')]);
 const before=JSON.stringify(old),view=A.previewImport(old,incoming,{validateCard:validate});
 assert.equal(view.added,1);assert.equal(view.preserved,1);assert.equal(JSON.stringify(old),before);
});
test('duplicate backup IDs are rejected before any mutation',()=>{
 assert.throws(()=>A.previewImport([] ,data([card('x'),card('x')]),{validateCard:validate}),/duplicate/);
});
test('oversized merged import is rejected atomically',()=>{
 assert.throws(()=>A.previewImport([card('x')],data([card('y')]),{limit:1}),/limit/);
});
test('unknown backup version is rejected',()=>{
 assert.throws(()=>A.previewImport([],{format:'GomokuMistakeLibrary',version:3,cards:[]}),/Unsupported/);
});
test('backup preview requires every position to validate',()=>{
 assert.throws(()=>A.previewImport([],data([card('broken',{board:[1]})]),{validateCard:validate}),/Invalid/);
});
test('backup preview never writes to the current library',()=>{
 const old=[card('x')],serialized=JSON.stringify(old);
 A.previewImport(old,data([card('y')]),{validateCard:validate});
 assert.equal(JSON.stringify(old),serialized);
});
test('full 150-position library reports size limit without deleting',()=>{
 const c=Array.from({length:151},(_,i)=>card('x'+i));
 const a=A.inspect(c);assert.equal(a.ok,false);assert.equal(c.length,151);
});
test('due counter uses only numeric saved due dates',()=>{
 const c=card('x');c.stats.due=Number.MAX_SAFE_INTEGER;
 assert.equal(A.inspect([c]).counts.due,0);
});
console.log(count+' A8 persistence and recovery contracts passed');
