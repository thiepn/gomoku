const C=require('./core.js');
const ok=(v,m)=>{if(!v)throw new Error(m)};
ok(C.VERSION==='1.8.0','version');
let s=C.summary({variant:'renju-practice',moves:[]},{skills:[]});
ok(s.primary.id==='concepts','new learner starts with concepts');
s=C.summary({variant:'renju-practice',moves:[{i:112,color:1}]},{skills:[
  {id:'opening-shape',title:'Opening shape',score:80,course:90,evidence:4,due:0},
  {id:'opening-flexibility',title:'Opening flexibility',score:76,course:90,evidence:4,due:0}
]});
ok(s.primary.id==='explorer','early position prioritizes current evidence');
ok(s.position==='Renju · move 1','position context');
s=C.summary({variant:'freestyle',moves:Array.from({length:25},(_,i)=>({i,color:i%2+1}))},{skills:[
  {id:'opening-shape',title:'Opening shape',score:82,course:100,evidence:5,due:0},
  {id:'opening-flexibility',title:'Opening flexibility',score:74,course:100,evidence:5,due:1}
]});
ok(s.primary.id==='repertoire','established learner rehearses repertoire');
ok(s.skills.average===78&&s.skills.due===1,'opening skill summary');
ok(s.destinations.length===4,'four existing opening destinations');
console.log('PASS Gomoku 1.8 Opening Study & Repertoire 2.0 core contracts.');
