/* Gomoku 1.2 — Course 2.0 core.
 * Pure course orchestration: no DOM, storage, engine, or network dependency.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GomokuCourse2Core=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='1.2.0';
  const CHAPTERS=Object.freeze([
    {id:1,title:'Seeing the Board',band:'Foundations',tagline:'Scan before you calculate.'},
    {id:2,title:'Fours',band:'Foundations',tagline:'Recognize forcing finishes and endpoints.'},
    {id:3,title:'Threes',band:'Foundations',tagline:'See which threes can really grow.'},
    {id:4,title:'Forks & Double Threats',band:'Tactics',tagline:'Make one move create two obligations.'},
    {id:5,title:'Defense',band:'Tactics',tagline:'Find the urgent threat before your plan.'},
    {id:6,title:'Reading Sequences',band:'Tactics',tagline:'Calculate forcing replies in the right order.'},
    {id:7,title:'Shape & Positional Play',band:'Strategy',tagline:'Prefer stones that keep several futures alive.'},
    {id:8,title:'Initiative & Move Priority',band:'Strategy',tagline:'Force useful replies instead of drifting.'},
    {id:9,title:'Attack Construction',band:'Strategy',tagline:'Build threats that reinforce each other.'},
    {id:10,title:'Whole-Board Planning',band:'Strategy',tagline:'Compare local gain with global danger.'},
    {id:11,title:'Openings & Early Play',band:'Advanced',tagline:'Develop flexible central structures.'},
    {id:12,title:'Advanced Renju',band:'Advanced',tagline:'Win without violating Black restrictions.'},
    {id:13,title:'Expert Calculation',band:'Advanced',tagline:'Generate candidates and test the best defense.'},
    {id:14,title:'Full-Game Mastery',band:'Advanced',tagline:'Transfer every skill into complete games.'}
  ]);
  const q=(prompt,choices,answer,why)=>Object.freeze({prompt,choices:Object.freeze(choices),answer,why});
  const TRANSFER=Object.freeze({
    1:q('You see an attractive attacking move. What should happen first?',['Calculate it immediately','Scan both sides for immediate wins','Count only your longest line'],1,'Urgent wins and losses dominate every slower plan.'),
    2:q('An open four has two legal winning endpoints. What makes it forcing?',['The defender can cover only one endpoint','It always creates an overline','It must be diagonal'],0,'Two distinct next-move wins cannot both be answered by one ordinary move.'),
    3:q('What makes a three strategically meaningful?',['It contains exactly three adjacent stones','It can legally grow into a useful four','It is near the center'],1,'A three matters because of its legal continuations, not because of stone count alone.'),
    4:q('A true fork is strongest when…',['one defense answers both threats','the threats are independent','both threats use the same endpoint'],1,'The point of a fork is to create separate defensive obligations.'),
    5:q('You cannot win immediately and the opponent can. Your priority is…',['build your own shape','answer the immediate threat','move toward the center'],1,'Defense comes before development when the opponent has a direct win.'),
    6:q('In a forcing sequence, what should you calculate first?',['quiet positional moves','the strongest forced reply','every empty point equally'],1,'Forcing calculation is efficient because you test the opponent’s strongest constrained reply first.'),
    7:q('Two safe moves are similar. Which shape is usually preferable?',['the move with more useful future directions','the move closest to the edge','the move that makes the longest single line only'],0,'Flexible stones participate in several viable continuations.'),
    8:q('What best describes initiative?',['having more stones near the center','making threats that constrain the reply','always playing first'],1,'Initiative is about controlling the opponent’s reply, not merely occupying space.'),
    9:q('A good attacking move should ideally…',['create one isolated threat','connect future threats across lines','ignore defensive resources'],1,'Attacks become durable when threats cooperate instead of appearing one at a time.'),
    10:q('Before committing to a local plan, you should…',['scan the whole board for stronger threats','ignore distant stones','prefer the nearest move'],0,'Whole-board planning prevents local tunnel vision.'),
    11:q('What is the safest early-game principle?',['memorize one line regardless of reply','preserve flexible central continuations','rush to the edge'],1,'Early positions reward flexibility because many branches remain unresolved.'),
    12:q('For Black in Renju, a visually strong move still fails if…',['it is not central','it is forbidden by the rule set','it creates a diagonal'],1,'Legality is part of tactical calculation for Black.'),
    13:q('Expert calculation begins by…',['searching one favorite move deeply','generating credible candidates, then testing best defense','counting stones only'],1,'Candidate generation prevents deep calculation of the wrong move.'),
    14:q('What proves a lesson has transferred?',['finishing its chapter once','using the idea correctly in unfamiliar play','reading the explanation twice'],1,'Transfer means the skill survives outside the lesson context.')
  });
  const s=(x,y,c)=>({x,y,c});
  const m=(x,y,kind='focus')=>({x,y,kind});
  const line=(a,b,kind='threat')=>({a,b,kind});
  const DEMOS=Object.freeze({
    1:[
      {title:'Start with a scan',text:'Do not choose a plan yet. Sweep the important stone through horizontal, vertical and both diagonals.',stones:[s(4,4,1),s(2,4,2),s(6,3,2)],marks:[m(4,4,'focus')],lines:[line([1,4],[7,4],'scan'),line([4,1],[4,7],'scan'),line([2,2],[6,6],'scan'),line([2,6],[6,2],'scan')]},
      {title:'Wins come first',text:'If one point completes five, every slower idea becomes irrelevant.',stones:[s(2,4,1),s(3,4,1),s(4,4,1),s(5,4,1),s(1,4,2)],marks:[m(6,4,'answer')],lines:[line([2,4],[6,4],'threat')]},
      {title:'Then scan the opponent',text:'When you cannot win immediately, repeat the same scan for the other color.',stones:[s(2,5,2),s(3,5,2),s(4,5,2),s(5,5,2),s(3,3,1)],marks:[m(6,5,'danger')],lines:[line([2,5],[6,5],'danger')]}
    ],
    2:[
      {title:'Closed four',text:'One endpoint remains. The defender has exactly one urgent square.',stones:[s(2,4,2),s(3,4,1),s(4,4,1),s(5,4,1),s(6,4,1)],marks:[m(7,4,'answer')],lines:[line([3,4],[7,4],'threat')]},
      {title:'Open four',text:'Two legal endpoints mean one ordinary defense cannot cover both.',stones:[s(3,4,1),s(4,4,1),s(5,4,1),s(6,4,1)],marks:[m(2,4,'answer'),m(7,4,'answer')],lines:[line([2,4],[7,4],'threat')]},
      {title:'Broken four',text:'A gap inside the line can be just as forcing as an endpoint.',stones:[s(2,4,1),s(3,4,1),s(5,4,1),s(6,4,1)],marks:[m(4,4,'answer')],lines:[line([2,4],[6,4],'threat')]}
    ],
    3:[
      {title:'A three is potential',text:'Three stones matter only when a legal extension can create a forcing four.',stones:[s(3,4,1),s(4,4,1),s(5,4,1)],marks:[m(2,4,'option'),m(6,4,'option')]},
      {title:'Check the growth points',text:'Visual length is not enough. Test where the shape can actually extend.',stones:[s(3,4,1),s(4,4,1),s(5,4,1),s(6,4,2)],marks:[m(2,4,'answer')]},
      {title:'Broken threes hide inside gaps',text:'Internal empty points can create the four-making continuation.',stones:[s(2,4,1),s(4,4,1),s(5,4,1)],marks:[m(3,4,'answer'),m(6,4,'option')]}
    ],
    4:[
      {title:'One threat is answerable',text:'A single line usually gives the defender one job.',stones:[s(3,4,1),s(4,4,1),s(5,4,1)],marks:[m(6,4,'option')]},
      {title:'The crossing point changes everything',text:'One move can strengthen two independent directions at once.',stones:[s(2,4,1),s(3,4,1),s(5,4,1),s(4,2,1),s(4,3,1),s(4,5,1)],marks:[m(4,4,'answer')],lines:[line([2,4],[6,4],'threat'),line([4,2],[4,6],'threat')]},
      {title:'Independence is the test',text:'If one reply can solve both threats, it was not a real fork.',stones:[s(3,4,1),s(5,4,1),s(4,3,1),s(4,5,1)],marks:[m(4,4,'focus')]}
    ],
    5:[
      {title:'Read their threat first',text:'Defense starts by identifying what the opponent threatens on the very next move.',stones:[s(2,4,2),s(3,4,2),s(4,4,2),s(5,4,2),s(3,2,1)],marks:[m(6,4,'danger')]},
      {title:'Block the win, not the shape',text:'The urgent point is determined by the actual winning continuation.',stones:[s(2,4,2),s(3,4,2),s(4,4,2),s(5,4,2),s(1,4,1)],marks:[m(6,4,'answer')]},
      {title:'Counter-win beats passive defense',text:'If you can win immediately elsewhere, the game ends before their threat matters.',stones:[s(2,4,2),s(3,4,2),s(4,4,2),s(5,4,2),s(2,2,1),s(3,2,1),s(4,2,1),s(5,2,1)],marks:[m(6,2,'answer'),m(6,4,'danger')]}
    ],
    6:[
      {title:'Forcing moves narrow the tree',text:'A four usually demands a constrained reply, so calculate those moves before quiet alternatives.',stones:[s(2,4,1),s(3,4,1),s(4,4,1)],marks:[m(5,4,'answer')]},
      {title:'Assume the strongest defense',text:'Do not calculate the reply you hope for. Test the defender’s best legal resource.',stones:[s(2,4,1),s(3,4,1),s(4,4,1),s(5,4,1)],marks:[m(1,4,'danger'),m(6,4,'danger')]},
      {title:'Continue only while forcing',text:'A sequence is reliable when each move preserves a real obligation.',stones:[s(3,4,1),s(4,4,1),s(5,4,1),s(5,3,2),s(6,3,1)],marks:[m(6,4,'answer')],lines:[line([3,4],[6,4],'threat')]}
    ],
    7:[
      {title:'Length is not enough',text:'A long line can still be rigid if it has only one useful future.',stones:[s(2,4,1),s(3,4,1),s(4,4,1),s(1,4,2)],marks:[m(5,4,'option')]},
      {title:'Prefer flexible intersections',text:'A stone that participates in several live directions creates more future candidates.',stones:[s(3,4,1),s(4,3,1),s(5,5,1)],marks:[m(4,4,'answer')],lines:[line([2,4],[6,4],'scan'),line([2,2],[6,6],'scan')]},
      {title:'Keep space around the shape',text:'Edges and blockers reduce future growth even when the stone count looks similar.',stones:[s(1,4,1),s(2,4,1),s(3,4,1),s(0,4,2)],marks:[m(4,4,'option')]}
    ],
    8:[
      {title:'A quiet move asks nothing',text:'If the opponent is free to play anywhere, you probably did not keep the initiative.',stones:[s(3,4,1),s(4,4,1)],marks:[m(5,5,'option')]},
      {title:'A forcing move controls the reply',text:'Create a concrete threat that makes the next defensive decision predictable.',stones:[s(2,4,1),s(3,4,1),s(4,4,1)],marks:[m(5,4,'answer'),m(6,4,'danger')]},
      {title:'Priority beats aesthetics',text:'Choose the move with the strongest tactical obligation before a prettier shape.',stones:[s(3,4,1),s(4,4,1),s(3,3,2)],marks:[m(5,4,'answer'),m(5,5,'option')]}
    ],
    9:[
      {title:'Build threats that cooperate',text:'An attack becomes stronger when one move prepares several later threats.',stones:[s(3,4,1),s(4,4,1),s(4,3,1)],marks:[m(5,4,'option'),m(4,5,'option')]},
      {title:'Connect the branches',text:'The best construction points often sit where two future lines overlap.',stones:[s(3,4,1),s(5,4,1),s(4,3,1),s(4,5,1)],marks:[m(4,4,'answer')]},
      {title:'Preserve the next forcing move',text:'Do not spend your attack on a threat that leaves no continuation.',stones:[s(2,4,1),s(3,4,1),s(4,3,1),s(5,2,1)],marks:[m(4,4,'answer')],lines:[line([2,4],[6,4],'scan'),line([3,5],[6,2],'scan')]}
    ],
    10:[
      {title:'Local gain can be a trap',text:'Before committing, scan distant lines for immediate danger.',stones:[s(2,2,1),s(3,2,1),s(6,6,2),s(6,5,2),s(6,4,2),s(6,3,2)],marks:[m(4,2,'option'),m(6,2,'danger')]},
      {title:'Compare candidates globally',text:'A move is good only after it survives the opponent’s strongest reply elsewhere.',stones:[s(2,2,1),s(3,2,1),s(5,5,2),s(6,5,2),s(7,5,2)],marks:[m(4,2,'option'),m(4,5,'danger')]},
      {title:'Choose the plan with fewer liabilities',text:'Whole-board planning balances attack, defense and future flexibility.',stones:[s(3,3,1),s(4,4,1),s(5,5,1),s(6,3,2),s(6,4,2)],marks:[m(5,3,'answer')]}
    ],
    11:[
      {title:'Start near the center',text:'Central stones preserve more viable directions and make color decisions meaningful.',stones:[s(4,4,1)],marks:[m(4,4,'focus')]},
      {title:'Keep several structures available',text:'Early moves should not commit to one brittle line before the opening decision is resolved.',stones:[s(4,4,1),s(4,5,2),s(5,4,1)],marks:[m(3,4,'option'),m(5,5,'option')]},
      {title:'Opening rules are part of the position',text:'Swap and fifth-move decisions change who owns each color; study the procedure, not just the stones.',stones:[s(4,4,1),s(4,5,2),s(5,4,1)],marks:[m(3,3,'focus')]}
    ],
    12:[
      {title:'Black must calculate legality',text:'A move can look tactically winning and still be forbidden under Renju.',stones:[s(3,4,1),s(5,4,1),s(4,3,1),s(4,5,1)],marks:[m(4,4,'danger')]},
      {title:'Exact five is special',text:'For Black, exact five wins; an overline is not simply a stronger five.',stones:[s(1,4,1),s(2,4,1),s(3,4,1),s(4,4,1),s(5,4,1)],marks:[m(6,4,'danger')]},
      {title:'Legality belongs inside calculation',text:'Filter forbidden candidates before comparing their tactical value.',stones:[s(3,4,1),s(5,4,1),s(4,3,1),s(4,5,1),s(2,2,2)],marks:[m(4,4,'danger'),m(6,4,'option')]}
    ],
    13:[
      {title:'Generate more than one candidate',text:'Deep search is wasted if you never considered the right move.',stones:[s(3,4,1),s(4,4,1),s(5,3,2)],marks:[m(5,4,'option'),m(4,5,'option'),m(2,4,'option')]},
      {title:'Test best defense',text:'For each candidate, ask for the strongest reply—not the most obvious reply.',stones:[s(2,4,1),s(3,4,1),s(4,4,1),s(6,4,2)],marks:[m(5,4,'answer'),m(1,4,'danger')]},
      {title:'Compare resulting positions',text:'The best candidate is the one that survives the strongest defensive branch.',stones:[s(3,3,1),s(4,4,1),s(5,5,1),s(5,3,2)],marks:[m(6,6,'answer')]}
    ],
    14:[
      {title:'Transfer starts without labels',text:'Real games do not tell you which chapter is being tested.',stones:[s(3,4,1),s(4,4,1),s(5,3,2)],marks:[m(2,4,'option'),m(5,4,'option'),m(4,5,'option')]},
      {title:'Run the complete decision loop',text:'Scan wins, scan threats, generate candidates, test defense, then choose.',stones:[s(2,4,1),s(3,4,1),s(6,5,2),s(6,4,2)],marks:[m(4,4,'focus')],lines:[line([1,4],[7,4],'scan'),line([6,2],[6,7],'scan')]},
      {title:'Review closes the loop',text:'A mistake becomes useful when it changes what you notice in the next unfamiliar game.',stones:[s(3,4,1),s(4,4,1),s(5,4,2),s(4,3,2)],marks:[m(4,5,'answer')]}
    ]
  });
  const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number(n)||0));
  function reportMap(reports=[]){
    const out={};
    for(const r of Array.isArray(reports)?reports:[]){
      const id=Number(r&&r.chapter);if(!Number.isInteger(id)||id<1||id>14)continue;
      const total=Math.max(0,Number(r.total)||0),done=Math.max(0,Math.min(total,Number(r.done)||0));
      out[id]={done,total,completion:total?done/total:0};
    }
    return out;
  }
  function chapterState(chapter,snapshot,reports=[]){
    const id=Number(chapter),meta=CHAPTERS.find(x=>x.id===id);
    if(!meta)throw Error('Unknown chapter.');
    const map=reportMap(reports),course=map[id]||{done:0,total:0,completion:0};
    const skills=(snapshot&&Array.isArray(snapshot.skills)?snapshot.skills:[]).filter(x=>Array.isArray(x.chapters)&&x.chapters.includes(id));
    const skillScore=skills.length?Math.round(skills.reduce((a,x)=>a+(Number(x.score)||0),0)/skills.length):0;
    const clean=skills.length?skills.reduce((a,x)=>a+(Number(x.cleanEvidence)||0),0)/skills.length:0;
    const transfer=skills.length?skills.reduce((a,x)=>a+(Number(x.transferEvidence)||0),0)/skills.length:0;
    const confidence=skills.length?Math.round(skills.reduce((a,x)=>a+(Number(x.confidence)||0),0)/skills.length):0;
    const mastered=course.completion>=.8&&skillScore>=82&&clean>=2.5&&transfer>=.75&&skills.some(x=>x.state==='mastered');
    let state='learn',reason='Build course exposure first.';
    if(mastered){state='mastered';reason='Course work, clean retrieval and game transfer all have supporting evidence.';}
    else if(course.completion>=.65&&skillScore>=68&&transfer<.75){state='verify';reason='The concept is strong in study, but still needs real-game transfer.';}
    else if(course.completion>=.65){state='practice';reason='Course exposure is established; strengthen clean retrieval in mixed positions.';}
    else if(course.completion>0){state='learn';reason='Continue the chapter before increasing difficulty.';}
    const due=skills.reduce((a,x)=>a+(Number(x.due)||0),0);
    return {
      id,title:meta.title,band:meta.band,tagline:meta.tagline,state,reason,
      done:course.done,total:course.total,completion:Math.round(course.completion*100),
      skillScore,confidence,cleanEvidence:Number(clean.toFixed(2)),transferEvidence:Number(transfer.toFixed(2)),
      due,skills:skills.map(x=>({id:x.id,title:x.title,score:x.score,state:x.state,due:x.due||0}))
    };
  }
  function journey(snapshot,reports=[]){
    const rows=CHAPTERS.map(c=>chapterState(c.id,snapshot,reports));
    const focusChapter=Number(snapshot&&snapshot.focus&&snapshot.focus.chapters&&snapshot.focus.chapters[0])||0;
    let next=rows.find(x=>x.id===focusChapter&&x.state!=='mastered')||rows.find(x=>x.due>0&&x.state!=='mastered')||rows.find(x=>x.state!=='mastered')||rows[rows.length-1];
    return {version:VERSION,chapters:rows,next,mastered:rows.filter(x=>x.state==='mastered').length,completed:rows.filter(x=>x.completion===100).length};
  }
  function demo(chapter){return (DEMOS[Number(chapter)]||[]).map(x=>JSON.parse(JSON.stringify(x)));}
  function transfer(chapter){const x=TRANSFER[Number(chapter)];return x?JSON.parse(JSON.stringify(x)):null;}
  function metadata(chapter){const x=CHAPTERS.find(c=>c.id===Number(chapter));return x?{...x}:null;}
  return Object.freeze({VERSION,CHAPTERS,metadata,chapterState,journey,demo,transfer});
});
