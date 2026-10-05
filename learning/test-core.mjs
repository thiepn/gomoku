import assert from 'node:assert/strict';
import core from './core.js';

assert.equal(core.VERSION,'1.1.0');
assert.equal(core.SKILLS.length,35);
assert.equal(new Set(core.SKILLS.map(x=>x.id)).size,core.SKILLS.length);
for(const skill of core.SKILLS){
  assert.ok(core.GROUPS.some(g=>g.id===skill.group),'unknown group '+skill.group);
  for(const p of skill.prerequisites)assert.ok(core.skill(p),'unknown prerequisite '+p);
  for(const ch of skill.chapters)assert.ok(ch>=1&&ch<=14,'bad chapter');
}

const fullCourse=Array.from({length:14},(_,i)=>({chapter:i+1,done:10,total:10}));
let snap=core.analyze({course:fullCourse,academy:{},mistakes:[],now:100000000});
assert.equal(snap.summary.total,35);
assert.equal(snap.summary.mastered,0,'course completion alone must not equal mastery');
assert.equal(snap.skills.find(x=>x.id==='immediate-win').score,35);

const clean=Array.from({length:12},(_,i)=>({motif:0,correct:true,assisted:false,at:100000000-i*1000}));
snap=core.analyze({course:fullCourse,academy:{sessionAttempts:clean},mistakes:[],now:100000000});
const win=snap.skills.find(x=>x.id==='immediate-win');
assert.ok(win.score>=82,'clean retrieval should be able to establish mastery');
assert.equal(win.state,'mastered');

const misses=Array.from({length:8},(_,i)=>({motif:2,correct:false,assisted:false,at:100000000-i*1000}));
snap=core.analyze({course:fullCourse,academy:{sessionAttempts:misses},mistakes:[],now:100000000});
assert.ok(snap.skills.find(x=>x.id==='forced-defense').score<50,'repeated misses must reduce defensive mastery');

const dueCard={
  id:'p1',created:99000000,updated:99500000,
  reference:{label:'Losing move',diagnosis:['Opponent forcing win verified']},
  stats:{attempts:2,successes:0,lapses:2,assisted:0,streak:0,due:99999999,last:99500000}
};
snap=core.analyze({course:fullCourse,academy:{},mistakes:[dueCard],now:100000000});
assert.equal(snap.summary.dueMistakes,1);
assert.ok(snap.dueMistakeIds.includes('p1'));
assert.ok(snap.skills.find(x=>x.id==='remote-defense').due>0);
assert.equal(snap.prescriptions[0].type,'mistakes','due mistakes should win recommendation priority');

assert.deepEqual(core.signalSkills('Immediate win available'),['immediate-win','board-scan']);
assert.ok(core.signalSkills({diagnosis:['Four–three pressure']}).includes('four-three'));

const focus=core.reviewFocus({critical:[
  {label:'Blunder'},{label:'Blunder'},{label:'Missed win'}
]});
assert.ok(focus.length>0);
assert.equal(focus[0].title,'Immediate threat detection');

const chapter=core.chapterSummary(snap,5);
assert.equal(chapter.chapter,5);
assert.ok(chapter.skills>=3);

console.log('PASS Gomoku 1.1 Learning Intelligence core contracts.');
