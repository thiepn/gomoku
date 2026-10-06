const C=require('./core.js');
const ok=(v,m)=>{if(!v)throw new Error(m)};
ok(C.VERSION==='2.0.0','version');
let m=C.model({
  journey:{next:{id:'continue-game',label:'Continue the game',detail:'12 moves played',priority:85},plan:{tasks:[{id:'continue-game',label:'Continue',minutes:30,detail:'Return'}]},context:{game:{moves:12,inProgress:true,mode:'ai'}}},
  learning:{summary:{mastered:4,strong:7,developing:8,dueReviews:3},skills:Array.from({length:35},(_,i)=>({id:String(i)})),prescriptions:[{type:'course',title:'Forced defense',reason:'Continue chapter'}]},
  course:{mastered:2,completed:4,chapters:Array.from({length:14},(_,i)=>({id:i+1})),next:{id:5,title:'Threats',state:'learn',completion:41,skillScore:52}},
  library:{counts:{total:18,studies:5,needsReview:2,flagged:1},primary:{id:'review-center',label:'Review saved games',detail:'2 need review'}},
  opening:{position:'Renju · move 12',skills:{average:61,evidenced:2,due:1},primary:{id:'concepts',label:'Strengthen opening concepts'}},
  competitive:{phase:{active:false},next:{}},
  online:{identity:'Local player',room:'No active online room'}
});
ok(m.primary.id==='continue-game'&&m.plan.length===1,'journey authority');
ok(m.learning.mastered===4&&m.learning.total===35&&m.learning.due===3,'learning composition');
ok(m.course.next.id===5&&m.course.mastered===2,'course composition');
ok(m.library.total===18&&m.library.needsReview===2,'archive composition');
ok(m.opening.average===61&&m.status.game.includes('12 moves'),'opening/game context');
m=C.model({});
ok(m.primary.id==='new-game'&&m.plan.length===0,'safe empty state');
console.log('PASS Gomoku 2.0 Unified Player Journey core contracts.');
