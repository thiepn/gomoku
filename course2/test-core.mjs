import assert from 'node:assert/strict';
import core from './core.js';
import learning from '../learning/core.js';

assert.equal(core.VERSION,'1.2.0');
assert.equal(core.CHAPTERS.length,14);
assert.equal(new Set(core.CHAPTERS.map(x=>x.id)).size,14);
for(let n=1;n<=14;n++){
  const scenes=core.demo(n);assert.equal(scenes.length,3,'chapter '+n+' needs three teaching scenes');
  const t=core.transfer(n);assert.ok(t&&t.choices.length>=3,'chapter '+n+' transfer question missing');
  assert.ok(Number.isInteger(t.answer)&&t.answer>=0&&t.answer<t.choices.length,'chapter '+n+' transfer answer invalid');
  const ids=core.chapterSkills(n);assert.ok(ids.length>=1,'chapter '+n+' needs mapped skills');
  ids.forEach(id=>assert.ok(learning.skill(id),'chapter '+n+' references unknown skill '+id));
  for(const scene of scenes){
    assert.ok(scene.title&&scene.text,'scene copy missing');
    for(const stone of scene.stones||[]){assert.ok(stone.x>=0&&stone.x<9&&stone.y>=0&&stone.y<9,'stone outside board');assert.ok([1,2].includes(stone.c),'bad stone');}
    for(const mark of scene.marks||[])assert.ok(mark.x>=0&&mark.x<9&&mark.y>=0&&mark.y<9,'mark outside board');
    for(const path of scene.lines||[])for(const p of [path.a,path.b])assert.ok(p[0]>=0&&p[0]<9&&p[1]>=0&&p[1]<9,'line outside board');
  }
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
