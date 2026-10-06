import assert from 'node:assert/strict';
import core from './core.js';

assert.equal(core.VERSION,'1.2.0');
assert.equal(core.CHAPTERS.length,14);
assert.equal(new Set(core.CHAPTERS.map(x=>x.chapter)).size,14);

for(const ch of core.CHAPTERS){
  assert.ok(ch.chapter>=1&&ch.chapter<=14);
  assert.ok(ch.title.length>2);
  assert.ok(ch.skill.length>2);
  assert.ok(ch.frames.length>=3,'chapter '+ch.chapter+' needs a real walkthrough');
  for(const frame of ch.frames){
    for(const coord of [...(frame.black||[]),...(frame.white||[]),...(frame.marks||[]),...(frame.line||[])])
      assert.ok(core.validCoord(coord),'invalid '+coord+' in chapter '+ch.chapter);
    const occupied=new Set([...(frame.black||[]),...(frame.white||[])]);
    assert.equal(occupied.size,(frame.black||[]).length+(frame.white||[]).length,'duplicate stone in chapter '+ch.chapter);
  }
  const t=ch.transfer;
  assert.ok([1,2].includes(t.side));
  assert.ok(t.answers.length>=1);
  const occupied=new Set([...t.black,...t.white]);
  for(const coord of [...t.black,...t.white,...t.answers])assert.ok(core.validCoord(coord),'bad transfer coord '+coord);
  for(const answer of t.answers)assert.ok(!occupied.has(answer),'answer is occupied in chapter '+ch.chapter);
}

let state=core.normalize(null);
assert.equal(core.summary(state).solved,0);
state=core.record(state,1,{correct:false,assisted:false,at:1000});
state=core.record(state,1,{correct:true,assisted:false,at:2000});
let row=core.summary(state).rows.find(x=>x.chapter===1);
assert.equal(row.solved,true);
assert.equal(row.clean,false,'retry after a miss is not clean transfer');

state=core.record(state,2,{correct:true,assisted:false,at:3000});
row=core.summary(state).rows.find(x=>x.chapter===2);
assert.equal(row.clean,true,'first-try unassisted solve should be clean');

state=core.record(state,3,{correct:true,assisted:true,at:4000});
row=core.summary(state).rows.find(x=>x.chapter===3);
assert.equal(row.solved,true);
assert.equal(row.clean,false);
assert.equal(row.assisted,true);

const evidence=core.evidence(state);
assert.equal(evidence.length,4);
assert.equal(evidence.at(-1).skillId,core.chapter(3).skill);
assert.equal(evidence.at(-1).assisted,true);

const capped={version:1,events:Array.from({length:450},(_,i)=>({chapter:1,correct:true,assisted:false,at:i+1}))};
assert.equal(core.normalize(capped).events.length,400);

console.log('PASS Gomoku 1.2 Course 2.0 core contracts.');
