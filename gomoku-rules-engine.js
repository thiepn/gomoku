/* A dependency-free rules kernel, shared verbatim by the UI, Worker and tests.
   Practice variant: center-first, free continuation, rejected Black fouls,
   passes after the first three moves. No tournament opening/swap protocol.
   Definitions and exact-five precedence: renju.net/rifrules/ §§3, 9.1–9.3. */
function createEngine(variant='renju-practice') {
  if(!['renju-practice','exact-five','freestyle'].includes(variant))throw new Error('Unknown ruleset.');
  const renju=variant==='renju-practice';
  const exact=color=>variant==='exact-five'||(renju&&color===1);
  'use strict';
  const N = 15, CELLS = 225, BLACK = 1, WHITE = 2, WIN = 100000000;
  const DIRS = [[1,0],[0,1],[1,1],[1,-1]], COLS = 'ABCDEFGHJKLMNOP';
  const xy = i => [i % N, Math.floor(i / N)];
  const inside = (x,y) => x >= 0 && y >= 0 && x < N && y < N;
  const coord = i => i === -1 ? 'Pass' : COLS[i % N] + (N - Math.floor(i/N));
  const lines = [], axes = Array.from({length:CELLS}, () => []);
  for (let d = 0; d < DIRS.length; d++) {
    const [dx,dy] = DIRS[d];
    for (let y=0;y<N;y++) for(let x=0;x<N;x++) {
      if (inside(x-dx,y-dy)) continue;
      const cells=[];
      for(let xx=x,yy=y;inside(xx,yy);xx+=dx,yy+=dy) cells.push(yy*N+xx);
      if(cells.length>=5) lines.push(cells);
      cells.forEach((i,p) => { axes[i][d] = {cells,p,d}; });
    }
  }
  const neighbors = Array.from({length:CELLS}, (_,i) => {
    const [x,y]=xy(i), a=[];
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)
      if((dx||dy)&&inside(x+dx,y+dy)) a.push((y+dy)*N+x+dx);
    return a;
  });
  const invalid = reason => ({legal:false,win:false,foul:false,reason,fours:[],threes:[],winLines:[]});
  function runs(board,i,color) {
    return axes[i].map(({cells,p}) => {
      let l=p,r=p;
      while(l>0&&board[cells[l-1]]===color) l--;
      while(r+1<cells.length&&board[cells[r+1]]===color) r++;
      return cells.slice(l,r+1);
    });
  }
  function fourGroups(board,i,color) {
    const groups = new Map();
    for(const {cells,p,d} of axes[i]) {
      for(let s=Math.max(0,p-4);s<=Math.min(p,cells.length-5);s++) {
        const stones=[]; let empty=-1, blocked=false;
        for(let k=s;k<s+5;k++) {
          const j=cells[k], v=board[j];
          if(v===color) stones.push(j);
          else if(v!==0||empty!==-1) {blocked=true;break;}
          else empty=j;
        }
        if(blocked||stones.length!==4||empty<0) continue;
        // A completion which is six in this axis is not a Black four.
        if(exact(color)&&((s>0&&board[cells[s-1]]===color)||
          (s+5<cells.length&&board[cells[s+5]]===color))) continue;
        const key=d+':'+stones.join(',');
        if(!groups.has(key)) groups.set(key,{stones,ends:[],d});
        const g=groups.get(key); if(!g.ends.includes(empty)) g.ends.push(empty);
      }
    }
    return [...groups.values()].map(g=>({...g,straight:g.ends.length===2}));
  }
  function possibleThrees(board,i,color) {
    const groups=new Map();
    for(const {cells,p,d} of axes[i]) {
      // A real three must extend to a contiguous four with two exact-five ends.
      for(let s=Math.max(1,p-3);s<=Math.min(p,cells.length-5);s++) {
        if(board[cells[s-1]]!==0||board[cells[s+4]]!==0) continue;
        if(exact(color)&&((s>1&&board[cells[s-2]]===color)||
          (s+5<cells.length&&board[cells[s+5]]===color))) continue;
        const stones=[];let extension=-1,blocked=false;
        for(let k=s;k<s+4;k++) {
          const j=cells[k],v=board[j];
          if(v===color) stones.push(j);
          else if(v!==0||extension!==-1){blocked=true;break;}
          else extension=j;
        }
        if(blocked||stones.length!==3||extension<0) continue;
        const key=d+':'+stones.join(',');
        if(!groups.has(key))groups.set(key,{stones,extensions:[],d});
        groups.get(key).extensions.push(extension);
      }
    }
    return [...groups.values()];
  }
  function inspect(board,i,color,memo,check) {
    if(check) check();
    const rr=runs(board,i,color);
    const winLines=rr.filter(a=>exact(color) ? a.length===5 : a.length>=5);
    // RIF 9.2: an exact five takes precedence even over a simultaneous overline.
    if(winLines.length) return {legal:true,win:true,foul:false,reason:'five',fours:[],threes:[],winLines};
    if(renju&&color===BLACK&&rr.some(a=>a.length>5))
      return {legal:false,win:false,foul:true,reason:'overline',fours:[],threes:[],winLines:[]};
    const fours=fourGroups(board,i,color);
    if(renju&&color===BLACK&&fours.length>=2)
      return {legal:false,win:false,foul:true,reason:'double-four',fours,threes:[],winLines:[]};
    const threes=[];
    for(const group of possibleThrees(board,i,color)) {
      const legalExtensions=[];
      for(const e of group.extensions) {
        if(check) check();
        let a;
        if(renju&&color===BLACK) {
          const key=board.join('')+':'+e;
          a=memo.get(key);
          if(!a) {
            board[e]=color;
            try { a=inspect(board,e,color,memo,check); }
            finally { board[e]=0; }
            memo.set(key,a);
          }
        } else {
          board[e]=color;
          try { a={legal:true,win:runs(board,e,color).some(r=>exact(color)?r.length===5:r.length>=5)}; }
          finally { board[e]=0; }
        }
        // A winning extension is excluded by the definition of a three.
        if(a.legal&&!a.win) legalExtensions.push(e);
      }
      if(legalExtensions.length) threes.push({...group,extensions:legalExtensions});
    }
    const foul=renju&&color===BLACK&&threes.length>=2;
    return {legal:!foul,win:false,foul,reason:foul?'double-three':'legal',fours,threes,winLines:[]};
  }
  function classify(board,i,color,check) {
    if(!board||board.length!==CELLS||!Number.isInteger(i)||i<0||i>=CELLS||
      (color!==BLACK&&color!==WHITE)) return invalid('invalid');
    if(board[i]!==0) return invalid('occupied');
    board[i]=color;
    try { return inspect(board,i,color,new Map(),check); }
    finally { board[i]=0; }
  }
  function legalMove(board,i,color,moveCount) {
    if(i===-1) return moveCount>=3 ? {legal:true,win:false,foul:false,reason:'pass',fours:[],threes:[],winLines:[]} : invalid('opening-pass');
    return classify(board,i,color);
  }
  function winningMoves(board,color,check) {
    const result=[];
    for(let i=0;i<CELLS;i++) if(board[i]===0) {
      if(check) check();
      board[i]=color;
      try {if(runs(board,i,color).some(r=>exact(color)?r.length===5:r.length>=5)) result.push(i);}
      finally {board[i]=0;}
    }
    return result;
  }
  function candidates(board) {
    const set=new Set();
    for(let i=0;i<CELLS;i++) if(board[i]) for(const j of neighbors[i]) if(board[j]===0) set.add(j);
    if(!set.size) for(let i=0;i<CELLS;i++) if(!board[i])set.add(i);
    return [...set];
  }
  function shapeScore(a) {
    if(!a.legal) return 0;
    if(a.win) return WIN;
    const open=a.fours.filter(f=>f.straight).length;
    return open*120000 + a.fours.length*20000 + a.threes.length*2500 +
      (a.fours.length&&a.threes.length?50000:0)+(a.threes.length>1?12000:0);
  }
  function positional(board,color) {
    const weights=[0,2,16,210,14000,500000], other=3-color;
    let value=0;
    for(const line of lines)for(let s=0;s<=line.length-5;s++) {
      let us=0,them=0;
      for(let k=s;k<s+5;k++){if(board[line[k]]===color)us++;else if(board[line[k]]===other)them++;}
      if(!them)value+=weights[us];
      if(!us)value-=weights[them];
    }
    return Math.max(-WIN/4,Math.min(WIN/4,value));
  }
  function ordered(board,color,check) {
    const ownWins=winningMoves(board,color,check);
    if(ownWins.length) return {wins:ownWins,threats:[],moves:ownWins.map(i=>({i,s:WIN}))};
    const threats=winningMoves(board,3-color,check), near=candidates(board), list=[];
    for(const i of near) {
      if(check)check();
      const a=classify(board,i,color,check);if(!a.legal)continue;
      const b=classify(board,i,3-color,check), [x,y]=xy(i);
      let support=0;
      for(const j of neighbors[i])if(board[j])support+=board[j]===color?2:1;
      list.push({i,s:shapeScore(a)+shapeScore(b)*1.04+support*3+28-Math.abs(x-7)*2-Math.abs(y-7)*2});
    }
    // Never assume that the center, a local point, or the first empty is legal.
    if(!list.length)for(let i=0;i<CELLS;i++)if(!board[i]&&!near.includes(i)) {
      if(check)check();
      if(classify(board,i,color,check).legal)list.push({i,s:0});
    }
    list.sort((a,b)=>b.s-a.s||a.i-b.i);
    return {wins:[],threats,moves:list};
  }

  /* V8.6 tactical intelligence: a bounded exact-legality scan used to decide
     when forcing search is worth its budget and which root points must not be
     pruned by the compiled engine. Scores remain ordering hints, not proofs. */
  function strategicCandidates(board,color,limit=10,check){
    limit=Math.max(1,Math.min(24,Math.floor(Number(limit)||10)));const other=3-color;
    const ownWins=winningMoves(board,color,check),oppWins=winningMoves(board,other,check),forced=new Set([...ownWins,...oppWins]),rows=[];
    for(const i of candidates(board)){
      if(check)check();const a=classify(board,i,color,check);if(!a.legal)continue;const d=classify(board,i,other,check),[x,y]=xy(i);
      let support=0;for(const j of neighbors[i])if(board[j])support+=board[j]===color?3:2;
      const attack=shapeScore(a),defend=d.legal?shapeScore(d):0;
      const attackLevel=a.win?6:a.fours.length>1?5:a.fours.length?4:a.threes.length>1?3:a.threes.length?2:0;
      const defendLevel=d.legal?(d.win?6:d.fours.length>1?5:d.fours.length?4:d.threes.length>1?3:d.threes.length?2:0):0;
      const priority=(forced.has(i)?5e8:0)+Math.max(attackLevel,defendLevel)*2e6+attack*1.08+defend*1.14+support*5+42-Math.abs(x-7)*2-Math.abs(y-7)*2;
      rows.push({i,score:priority,attackLevel,defendLevel,attackFours:a.fours.length,attackThrees:a.threes.length,defendFours:d.legal?d.fours.length:0,defendThrees:d.legal?d.threes.length:0,forced:forced.has(i)});
    }
    rows.sort((a,b)=>Number(b.forced)-Number(a.forced)||b.score-a.score||a.i-b.i);return rows.slice(0,limit);
  }
  function tacticalProfile(board,color,limit=12,check){
    if(!board||board.length!==CELLS||![BLACK,WHITE].includes(color))throw Error('Invalid tactical profile position.');
    const ownWins=winningMoves(board,color,check),opponentWins=winningMoves(board,3-color,check),rows=strategicCandidates(board,color,limit,check);
    const attackFours=rows.filter(r=>r.attackFours).length,attackThrees=rows.filter(r=>r.attackThrees).length,defenseFours=rows.filter(r=>r.defendFours).length,defenseThrees=rows.filter(r=>r.defendThrees).length;
    const urgency=ownWins.length?'winning-now':opponentWins.length>1?'multiple-immediate-threats':opponentWins.length===1?'must-defend':attackFours?'forcing-four':attackThrees?'forcing-threat':defenseFours?'defensive-alert':'quiet';
    const priorityMoves=[...new Set([...ownWins,...opponentWins,...rows.filter(r=>r.attackLevel>=2||r.defendLevel>=3).map(r=>r.i),...rows.map(r=>r.i)])].slice(0,10);
    return {urgency,ownWins,opponentWins,attackFours,attackThrees,defenseFours,defenseThrees,probeVCF:attackFours>0,probeVCT:attackFours>0||attackThrees>0,priorityMoves,rows};
  }
  /* Budgeted, selective alpha-beta. Exact legality at every searched move;
     approximate shapes are used for ordering only. No claimed Elo rating. */
  function chooseMove(input,color,config={}) {
    if(!input||input.length!==CELLS||(color!==BLACK&&color!==WHITE)||
      Array.from(input).some(v=>v!==0&&v!==BLACK&&v!==WHITE)) throw new Error('Invalid search position');
    const board=Int8Array.from(input),finite=(v,d,min,max)=>Number.isFinite(v)?Math.max(min,Math.min(max,v)):d;
    const cfg={timeMs:finite(config.timeMs,650,20,15000),maxDepth:Math.trunc(finite(config.maxDepth,4,1,12)),
      width:Math.trunc(finite(config.width,10,2,28)),randomPool:Math.trunc(finite(config.randomPool,config.casual?3:1,1,10)),
      seed:(Number(config.seed)||17)>>>0,style:['balanced','attacking','defensive','architect','tactician','human','chaos','perfect'].includes(config.style)?config.style:'balanced'};
    const now=()=>typeof performance!=='undefined'?performance.now():Date.now();
    const started=now(),stop=started+cfg.timeMs,TIMEOUT={},table=new Map();
    let nodes=0,completedDepth=0,bestScore=0,hits=0,cutoffs=0,pv=[],ranked=[];
    const check=()=>{if(now()>=stop)throw TIMEOUT;};
    const finish=(move,reason)=>({move,reason,nodes,depth:completedDepth,score:bestScore,
      elapsedMs:Math.round(now()-started),ttHits:hits,cutoffs,pv:pv.length?pv:move>=0?[move]:[],candidates:ranked.slice(0,config.multiPV?32:3)});
    if(!board.some(Boolean))return finish(112,'opening');
    // Wins and mandatory blocks precede randomization at every difficulty.
    const wins=winningMoves(board,color);
    if(wins.length){bestScore=WIN;ranked=wins.map(i=>({i,score:WIN}));return finish(wins[0],'win');}
    const threats=winningMoves(board,3-color);
    if(threats.length===1){
      const blocks=threats.filter(i=>classify(board,i,color).legal);
      if(blocks.length){ranked=blocks.map(i=>({i,score:0}));return finish(blocks[0],'block');}
    }
    let fallback=-1;
    for(const i of candidates(board))if(classify(board,i,color).legal){fallback=i;break;}
    if(fallback<0)for(let i=0;i<CELLS;i++)if(!board[i]&&classify(board,i,color).legal){fallback=i;break;}
    if(fallback<0)return finish(-1,'pass');
    const attack=cfg.style==='attacking'?1.3:cfg.style==='defensive'?.88:1;
    const defense=cfg.style==='defensive'?1.35:cfg.style==='attacking'?.84:1.05;
    function quickScore(i,side){
      board[i]=side;
      try {
        const fours=fourGroups(board,i,side),threes=possibleThrees(board,i,side);
        let value=fours.reduce((n,f)=>n+(f.straight?140000:24000),0)+threes.length*3300;
        if(fours.length&&threes.length)value+=cfg.style==='tactician'?85000:48000;
        if(threes.length>1)value+=cfg.style==='architect'?42000:14000;
        if(cfg.style==='architect')value+=new Set(fours.concat(threes).map(t=>t.d)).size*1800;
        if(cfg.style==='chaos')value+=((Math.imul(i+1,cfg.seed|1)>>>0)%401);
        for(const {cells,p} of axes[i])for(let s=Math.max(0,p-4);s<=Math.min(p,cells.length-5);s++){
          let n=0,blocked=false;
          for(let k=s;k<s+5;k++){const v=board[cells[k]];if(v&&v!==side){blocked=true;break;}if(v===side)n++;}
          if(!blocked)value+=[0,1,14,95,300,500000][n];
        }
        return value;
      }finally{board[i]=0;}
    }
    function orderedFast(side,width,preferred=-1){
      const list=[];
      for(const i of candidates(board)){
        check();const [x,y]=xy(i);
        list.push({i,s:quickScore(i,side)*attack+quickScore(i,3-side)*defense+28-Math.abs(x-7)*2-Math.abs(y-7)*2});
      }
      list.sort((a,b)=>(a.i===preferred?-1:b.i===preferred?1:b.s-a.s)||a.i-b.i);
      const legal=[];
      for(const o of list){check();if(classify(board,o.i,side,check).legal)legal.push(o);if(legal.length>=width)break;}
      if(!legal.length)for(let i=0;i<CELLS;i++)if(!board[i]&&classify(board,i,side,check).legal){legal.push({i,s:0});break;}
      return legal;
    }
    function forcingFast(side,limit=5){
      const out=[];for(const i of candidates(board)){check();const a=classify(board,i,side,check);if(!a.legal)continue;const d=classify(board,i,3-side,check);
        const level=a.win?7:a.fours.length>1?6:a.fours.length?5:a.threes.length>1?4:a.threes.length?3:d.legal&&d.win?6:d.legal&&d.fours.length?4:0;if(!level)continue;
        out.push({i,s:level*1000000+shapeScore(a)+(d.legal?shapeScore(d):0)*1.08});}
      out.sort((a,b)=>b.s-a.s||a.i-b.i);return out.slice(0,Math.max(1,Math.min(8,limit)));
    }
    let root;
    try{root=orderedFast(color,Math.max(cfg.width,cfg.randomPool));for(const i of (Array.isArray(config.includeMoves)?config.includeMoves:[]).slice(0,10))if(Number.isInteger(i)&&i>=0&&i<CELLS&&!board[i]&&!root.some(o=>o.i===i)&&classify(board,i,color).legal)root.push({i,s:quickScore(i,color)});}
    catch(err){if(err!==TIMEOUT)throw err;return finish(fallback,'time-limit');}
    if(!root.length)return finish(-1,'pass');
    let bestMove=root[0].i;completedDepth=1;bestScore=root[0].s;
    ranked=root.map(o=>({i:o.i,score:o.s}));
    if(cfg.maxDepth===1){
      const pool=root.slice(0,cfg.randomPool);let seed=cfg.seed;
      for(let i=0;i<CELLS;i++)seed=(Math.imul(seed^board[i],1664525)+i+1013904223)>>>0;
      // First steps explores a broader candidate pool; Casual varies near the best shape.
      const safe=cfg.randomPool>=6?pool:pool.filter(o=>o.s>=pool[0].s*.65);
      const chosen=safe[seed%safe.length];bestMove=chosen.i;bestScore=chosen.s;
      return finish(bestMove,'tactical');
    }
    const windows=[],through=Array.from({length:CELLS},()=>[]),weights=[0,2,16,210,14000,500000];
    for(const line of lines)for(let s=0;s<=line.length-5;s++){const w=line.slice(s,s+5),id=windows.length;windows.push(w);for(const i of w)through[i].push(id);}
    const scores=new Float64Array(windows.length);let incremental=0;
    function windowValue(w){let black=0,white=0;for(const i of w){if(board[i]===1)black++;else if(board[i]===2)white++;}return white===0?weights[black]:black===0?-weights[white]:0;}
    windows.forEach((w,id)=>{scores[id]=windowValue(w);incremental+=scores[id];});
    let zr=0x6d2b79f5;const rand=()=>{zr^=zr<<13;zr^=zr>>>17;zr^=zr<<5;return zr>>>0;};
    const zh=Array.from({length:CELLS},()=>[0,rand(),rand()]),zl=Array.from({length:CELLS},()=>[0,rand(),rand()]);let hashHi=0,hashLo=0;
    for(let i=0;i<CELLS;i++)if(board[i]){hashHi^=zh[i][board[i]];hashLo^=zl[i][board[i]];}
    function put(i,c){const old=board[i];hashHi^=zh[i][old]^zh[i][c];hashLo^=zl[i][old]^zl[i][c];board[i]=c;for(const id of through[i]){incremental-=scores[id];scores[id]=windowValue(windows[id]);incremental+=scores[id];}}
    const fastEval=side=>Math.max(-WIN/4,Math.min(WIN/4,incremental))*(side===1?1:-1);
    function key(side,extension){return (hashHi>>>0).toString(36)+'.'+(hashLo>>>0).toString(36)+':'+side+':'+extension;}
    function negamax(depth,alpha,beta,side,ply,extension=0,previousPass=false){
      check();nodes++;
      if(!board.includes(0))return 0;
      const ttKey=key(side,extension)+(previousPass?'p':''),entry=table.get(ttKey),originalAlpha=alpha,originalBeta=beta;
      if(entry&&entry.depth>=depth&&Math.abs(entry.score)<WIN-1000){
        hits++;
        if(entry.flag===0)return entry.score;
        if(entry.flag===1)alpha=Math.max(alpha,entry.score);else beta=Math.min(beta,entry.score);
        if(alpha>=beta)return entry.score;
      }
      const own=winningMoves(board,side,check);
      if(own.length)return WIN-ply;
      const danger=winningMoves(board,3-side,check);
      if(danger.length>1)return -WIN+ply+1;
      let forced=[];
      if(danger.length){forced=danger.filter(i=>classify(board,i,side,check).legal).map(i=>({i,s:0}));if(!forced.length)return -WIN+ply+1;}
      let quiet=null;
      if(depth<=0&&!forced.length){if(extension>=2)return fastEval(side);quiet=forcingFast(side,Math.min(5,cfg.width));if(!quiet.length)return fastEval(side);}
      const nodeWidth=Math.max(4,cfg.width-Math.max(0,ply-1)*2);
      const moves=forced.length?forced:quiet||orderedFast(side,nodeWidth,entry?entry.move:-1);
      if(!moves.length){
        if(previousPass)return 0;
        if(depth<=0)return fastEval(side);
        return -negamax(depth-1,-beta,-alpha,3-side,ply+1,extension,true);
      }
      let best=-WIN,bestAt=moves[0].i;
      for(const {i} of moves){
        check();put(i,side);let value;
        try{value=-negamax(depth-1,-beta,-alpha,3-side,ply+1,extension+(depth<=0?1:0),false);}finally{put(i,0);}
        if(value>best){best=value;bestAt=i;}
        alpha=Math.max(alpha,value);if(alpha>=beta){cutoffs++;break;}
      }
      if(table.size>24000)table.clear();
      table.set(ttKey,{depth,score:best,move:bestAt,flag:best<=originalAlpha?2:best>=originalBeta?1:0});
      return best;
    }
    for(let depth=2;depth<=cfg.maxDepth;depth++){
      let move=bestMove,score=-WIN,alpha=-WIN,finished=true;const scores=[];
      root.sort((a,b)=>(a.i===bestMove?-1:b.i===bestMove?1:b.s-a.s)||a.i-b.i);
      try{
        for(const o of root){
          check();put(o.i,color);let value;
          try{value=-negamax(depth-1,-WIN,config.multiPV?WIN:-alpha,3-color,1);}finally{put(o.i,0);}
          // Non-best root values can be alpha-beta bounds, not exact evaluations.
          scores.push({i:o.i,score:value,bound:config.multiPV?'exact':value<=alpha?'upper':'exact'});
          if(value>score){score=value;move=o.i;}alpha=Math.max(alpha,value);
        }
      }catch(err){if(err!==TIMEOUT)throw err;finished=false;}
      if(!finished)break;
      bestMove=move;bestScore=score;completedDepth=depth;
      ranked=scores.sort((a,b)=>b.score-a.score||a.i-b.i);
      pv=[bestMove];const applied=[bestMove];put(bestMove,color);let side=3-color;
      try{
        for(let n=1;n<depth;n++){
          const e=table.get(key(side,0));if(!e||!Number.isInteger(e.move)||board[e.move])break;
          const a=classify(board,e.move,side);if(!a.legal)break;
          pv.push(e.move);applied.push(e.move);put(e.move,side);if(a.win)break;side=3-side;
        }
      }finally{for(const i of applied)put(i,0);}
      if(Math.abs(score)>WIN-1000)break;
    }
    if(['human','chaos'].includes(cfg.style)&&ranked.length>1&&completedDepth>=2&&Math.abs(bestScore)<WIN/2){
      const maxLoss=cfg.style==='human'?180:800,pool=ranked.filter(o=>o.bound==='exact'&&bestScore-o.score<=maxLoss);
      if(pool.length){const selected=pool[(cfg.seed+board.filter(Boolean).length)%pool.length];bestMove=selected.i;bestScore=selected.score;pv=[bestMove];}
    }
    return finish(bestMove,'search');
  }

  function validateSetup(initial=[],startColor=1){
    if(!Array.isArray(initial)||initial.length>200||![1,2].includes(startColor))throw new Error('Invalid study setup.');
    const board=new Int8Array(CELLS);
    for(const m of initial){
      if(!m||!Number.isInteger(m.i)||m.i<0||m.i>=CELLS||![1,2].includes(m.color)||board[m.i])throw new Error('Invalid or duplicate setup stone.');
      board[m.i]=m.color;
    }
    for(const m of initial)if(runs(board,m.i,m.color).some(r=>exact(m.color)?r.length===5:r.length>=5))throw new Error('Setup already contains a winning line.');
    if(renju)for(const m of initial)if(m.color===BLACK&&runs(board,m.i,BLACK).some(r=>r.length>5))throw new Error('Setup contains a Black overline.');
    return board;
  }
  function replay(moves,options={}) {
    if(!Array.isArray(moves)||moves.length>450)throw new Error('Move record must contain at most 450 moves.');
    const initial=options.initial||[],startColor=options.startColor||1;
    const board=validateSetup(initial,startColor),records=[];
    let result=null,passes=0,stones=initial.length;
    for(let k=0;k<moves.length;k++){
      const move=moves[k],color=(startColor-1+k)%2+1;
      if(result)throw new Error('Move '+(k+1)+' occurs after the game ended.');
      if(!move||!Number.isInteger(move.i)||move.i< -1||move.i>=CELLS||move.color!==color)throw new Error('Invalid coordinate or turn at move '+(k+1)+'.');
      const a=legalMove(board,move.i,color,k+initial.length);
      if(!a.legal)throw new Error('Illegal move '+(k+1)+': '+a.reason+'.');
      const defense=move.i>=0?classify(board,move.i,3-color):null;
      records.push({i:move.i,color,analysis:a,defense});
      if(move.i>=0){board[move.i]=color;stones++;passes=0;}else passes++;
      if(a.win)result={winner:color,reason:'five',winLines:a.winLines};
      else if(stones===CELLS)result={winner:0,reason:'full',winLines:[]};
      else if(passes===2)result={winner:0,reason:'passes',winLines:[]};
    }
    return {board,records,result,passes,stones};
  }
  function validateSave(data){
    if(!data||typeof data!=='object'||![2,3].includes(data.version))throw new Error('Unsupported Gomoku save version.');
    const old=data.version===2;
    if(old&&data.variant!=='renju-practice')throw new Error('Invalid version 2 ruleset.');
    if(!['renju-practice','exact-five','freestyle'].includes(data.variant))throw new Error('Invalid ruleset.');
    if(data.variant!==variant)return createEngine(data.variant).validateSave(data);
    if(![1,2].includes(data.humanColor))throw new Error('Invalid player color.');
    const levels=['first','beg','club','mid','advanced','high','expert','maximum'];
    if(!(old?['beg','mid','high']:levels).includes(data.level))throw new Error('Invalid engine level.');
    const mode=old?'ai':data.mode;
    if(!['ai','local','arena','study','puzzle'].includes(mode))throw new Error('Invalid play mode.');
    const initial=old?[]:(data.initial||[]),startColor=old?1:(data.startColor??1);
    if(initial.length&&mode!=='study'&&mode!=='puzzle')throw new Error('Custom setups are study or puzzle positions, not matches.');
    if(!initial.length&&startColor!==1)throw new Error('An empty game must begin with Black.');
    const state=replay(data.moves,{initial,startColor});
    if(!old&&data.terminal){
      const t=data.terminal,c=(startColor-1+state.records.length)%2+1;
      if(state.result||!['ai','local','arena'].includes(mode)||(t.reason==='resign'&&mode==='arena')||!['resign','timeout','agreement'].includes(t.reason)||(t.reason==='agreement'?t.winner!==0:t.winner!==3-c))throw new Error(t.reason==='resign'?'Invalid resignation result.':'Invalid terminal result.');
      state.result={reason:t.reason,winner:t.winner,winLines:[]};
    }
    const annotations={};
    if(data.annotations&&typeof data.annotations==='object')for(const [key,text]of Object.entries(data.annotations)){
      const n=Number(key);if(Number.isInteger(n)&&n>=0&&n<=data.moves.length&&typeof text==='string')annotations[n]=text.slice(0,1200);
    }
    if(JSON.stringify(annotations).length>50000)throw new Error('Annotations exceed 50 KB.');
    return {...state,variant:data.variant,mode,humanColor:data.humanColor,level:data.level,
      opponentLevel:levels.includes(data.opponentLevel)?data.opponentLevel:'mid',
      initial:initial.map(m=>({i:m.i,color:m.color})),startColor,
      style:['balanced','attacking','defensive','architect','tactician','human','chaos','perfect'].includes(data.style)?data.style:'balanced',
      gameId:typeof data.gameId==='string'?data.gameId.slice(0,80):'',
      title:typeof data.title==='string'?data.title.slice(0,80):'',annotations,
      seed:Number.isInteger(data.seed)?data.seed>>>0:17,
      assisted:data.assisted===true,puzzleId:typeof data.puzzleId==='string'?data.puzzleId.slice(0,40):'',
      soundOn:typeof data.soundOn==='boolean'?data.soundOn:true,
      heatOn:typeof data.heatOn==='boolean'?data.heatOn:false,
      numbersOn:typeof data.numbersOn==='boolean'?data.numbersOn:false,
      touchConfirm:typeof data.touchConfirm==='boolean'?data.touchConfirm:true,
      threatsOn:data.threatsOn===true,flip:data.flip===true,
      theme:['paper','night','slate'].includes(data.theme)?data.theme:'paper'};
  }
  return {N,CELLS,BLACK,WHITE,DIRS,COLS,coord,classify,legalMove,winningMoves,
    chooseMove,replay,validateSave,validateSetup,candidates,shapeScore,positional,strategicCandidates,tacticalProfile,variant};
}
