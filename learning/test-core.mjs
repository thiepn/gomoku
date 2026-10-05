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

const clean=Array.from({length:12},(_,i)=>({id:'finish-'+i,motif:0,correct:true,assisted:false,at:100000000-i*1000,session:'same-session'}));
snap=core.analyze({course:fullCourse,academy:{sessionAttempts:clean},mistakes:[],now:100000000});
let win=snap.skills.find(x=>x.id==='immediate-win');
assert.ok(win.score>=82,'clean retrieval should establish strong evidence');
assert.equal(win.state,'strong','one drill context must not be called mastery');
assert.equal(win.contexts,1);
assert.equal(win.needsTransfer,true);
assert.equal(win.recommendation.type,'review','strong drill evidence should request real-game transfer');

const decision=[{at:99999000,outcome:'correct',label:'Winning move',gameId:'game-1'}];
snap=core.analyze({course:fullCourse,academy:{sessionAttempts:clean,decisionAttempts:decision},mistakes:[],now:100000000});
win=snap.skills.find(x=>x.id==='immediate-win');
assert.equal(win.state,'mastered','clean evidence plus independent real-game transfer can establish mastery');
assert.ok(win.transferEvidence>=.75);
assert.ok(win.contexts>=2);

const misses=Array.from({length:8},(_,i)=>({id:'defense-'+i,motif:2,correct:false,assisted:false,at:100000000-i*1000,session:'defense-session'}));
snap=core.analyze({course:fullCourse,academy:{sessionAttempts:misses},mistakes:[],now:100000000});
assert.ok(snap.skills.find(x=>x.id==='forced-defense').score<50,'repeated misses must reduce defensive mastery');

const dueReviewAttempt={id:'academy-defense',motif:2,correct:true,assisted:false,at:99000000,session:'older-defense'};
snap=core.analyze({
  course:fullCourse,
  academy:{sessionAttempts:[dueReviewAttempt],reviews:{'academy-defense':{due:99999999,last:99000000}}},
  mistakes:[],now:100000000
});
assert.equal(snap.summary.duePractice,1);
assert.equal(snap.skills.find(x=>x.id==='forced-defense').duePractice,1);
assert.equal(snap.skills.find(x=>x.id==='forced-defense').recommendation.type,'practice');

const dueCard={
  id:'p1',created:99000000,updated:99500000,
  reference:{label:'Losing move',diagnosis:['Opponent forcing win verified']},
  stats:{attempts:2,successes:0,lapses:2,assisted:0,streak:0,due:99999999,last:99500000}
};
const secondCard={
  id:'p2',created:99000000,updated:99500000,
  reference:{label:'Missed win'},
  stats:{attempts:1,successes:0,lapses:1,assisted:0,streak:0,due:99999999,last:99500000}
};
snap=core.analyze({course:fullCourse,academy:{},mistakes:[dueCard,secondCard],now:100000000});
assert.equal(snap.summary.dueMistakes,2);
assert.ok(snap.dueMistakeIds.includes('p1')&&snap.dueMistakeIds.includes('p2'));
const remote=snap.skills.find(x=>x.id==='remote-defense');
assert.ok(remote.dueMistakes>0);
assert.deepEqual(remote.mistakeIds,['p1'],'skill-specific recommendation must not open unrelated due cards');
assert.deepEqual(remote.recommendation.mistakeIds,['p1']);

assert.deepEqual(core.signalSkills('Immediate win available'),['immediate-win','board-scan']);
assert.ok(core.signalSkills({diagnosis:['Four–three pressure']}).includes('four-three'));
assert.equal(core.practiceMotif('forced-defense'),2);
assert.equal(core.practiceMotif('whole-board'),null);

const focus=core.reviewFocus({critical:[
  {label:'Blunder'},{label:'Blunder'},{label:'Missed win'}
]});
assert.ok(focus.length>0);
assert.equal(focus[0].title,'Immediate threat detection');

const chapter=core.chapterSummary(snap,5);
assert.equal(chapter.chapter,5);
assert.ok(chapter.skills>=3);

console.log('PASS Gomoku 1.1 Learning Intelligence core contracts.');
