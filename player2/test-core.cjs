const C=require('./core.js');
const ok=(v,m)=>{if(!v)throw new Error(m)};
ok(C.VERSION==='2.0.0','version');
let s=C.summary({
  journey:{context:{game:{inProgress:false,result:false},review:{pending:0,critical:0},training:{due:0,customDue:0},opening:{due:0},library:{count:0}},next:{id:'new-game',label:'Play a game'}},
  learning:{skills:[],prescriptions:[]},
  library:{counts:{total:0,needsReview:0,studies:0}},
  opening:{skills:{due:0,average:0,evidenced:false}}
});
ok(s.primary.id==='journey:new-game','new player falls through to journey play action');
ok(s.stages.length===4&&s.threads.length===4,'root architecture');
s=C.summary({
  online:{context:{activeRoom:true},primary:{label:'Return to ranked match',detail:'Active'}},
  journey:{context:{}},library:{counts:{}}
});
ok(s.primary.id==='online','active online room priority');
s=C.summary({
  competitive:{phase:{active:true,state:'in-game'},next:{label:'Continue game',detail:'Game 2 of 3'},progress:{label:'Game 2'}},
  journey:{context:{}},library:{counts:{}}
});
ok(s.primary.id==='competitive','competitive series priority');
s=C.summary({
  journey:{context:{review:{pending:0,critical:0},training:{due:0,customDue:0},opening:{due:0}},next:{id:'new-game'}},
  library:{counts:{total:8,needsReview:3,studies:2}},
  learning:{skills:[{id:'a',score:70,evidence:2}],prescriptions:[{title:'Defense',reason:'weakest'}]}
});
ok(s.primary.id==='review-center'&&s.metrics.reviews===3,'saved review before new learning');
s=C.summary({
  journey:{context:{review:{pending:0,critical:0},training:{due:0,customDue:0},opening:{due:0}},next:{id:'new-game'}},
  library:{counts:{total:4,needsReview:0,studies:1}},
  learning:{skills:[{id:'a',score:80,evidence:3},{id:'b',score:60,evidence:1}],prescriptions:[{title:'Forced Defense',reason:'Current weakness'}]}
});
ok(s.primary.id==='learning-next'&&s.metrics.learning===70,'learning prescription and evidence average');
console.log('PASS Gomoku 2.0 Player Journey & Home core contracts.');

s=C.summary({
  journey:{context:{online:{connected:true}}},
  online:null,library:{counts:{}}
});
ok(s.primary.id==='online','Journey network fallback keeps active online play visible');
s=C.summary({
  journey:{context:{training:{due:2,customDue:1},review:{}},next:{id:'new-game'}},
  library:{counts:{}},
  learning:{summary:{total:35,evidenced:4,average:61,dueReviews:3},skills:[{score:99,evidence:99,due:99}],prescriptions:[]}
});
ok(s.metrics.learning===61&&s.metrics.evidencedSkills===4&&s.metrics.practice===3,'authoritative learning summary without duplicate due counting');
