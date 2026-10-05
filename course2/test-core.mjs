import assert from 'node:assert/strict';
import core from './core.js';

assert.equal(core.VERSION,'1.2.0');
assert.equal(core.CHAPTERS.length,14);
assert.equal(new Set(core.CHAPTERS.map(x=>x.id)).size,14);
for(let n=1;n<=14;n++){
  assert.equal(core.demo(n).length,3,'chapter '+n+' needs three teaching scenes');
  const t=core.transfer(n);
  assert.ok(t&&t.choices.length>=3,'chapter '+n+' transfer question missing');
  assert.ok(Number.isInteger(t.answer)&&t.answer>=0&&t.answer<t.choices.length,'chapter '+n+' transfer answer invalid');
}
const skills=[
  {id:'board-scan',title:'Board scanning',chapters:[1],score:35,state:'building',cleanEvidence:0,transferEvidence:0,confidence:20,due:0},
  {id:'immediate-win',title:'Immediate wins',chapters:[1],score:35,state:'building',cleanEvidence:0,transferEvidence:0,confidence:20,due:0}
];
let j=core.journey({skills,focus:{chapters:[1]}},[{chapter:1,done:5,total:10}]);
assert.equal(j.next.id,1);
assert.equal(j.chapters[0].state,'learn');
skills.forEach(x=>Object.assign(x,{score:72,state:'strong',cleanEvidence:3,transferEvidence:.1,confidence:70}));
j=core.journey({skills,focus:{chapters:[1]}},[{chapter:1,done:8,total:10}]);
assert.equal(j.chapters[0].state,'verify');
skills.forEach(x=>Object.assign(x,{score:88,state:'mastered',cleanEvidence:4,transferEvidence:1,confidence:90}));
j=core.journey({skills,focus:{chapters:[1]}},[{chapter:1,done:9,total:10}]);
assert.equal(j.chapters[0].state,'mastered');
assert.equal(j.mastered,1);
const copy=core.demo(2);copy[0].title='mutated';assert.notEqual(core.demo(2)[0].title,'mutated');
console.log('PASS Gomoku 1.2 Course 2.0 core contracts.');
