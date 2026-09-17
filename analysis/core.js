/* Analysis 2.0: evidence-preserving search orchestration, not a claim of solved play.
 * Pure services shared by the UI, isolated worker, exports, and regression tests. */
function createAnalysis2(engineFactory, studioFactory, reviewFactory) {
  'use strict';
  const VERSION = '2.0.0', C = studioFactory(engineFactory);
  const PRESETS = Object.freeze({
    quick: {label:'Quick', timeMs:350, depth:9, width:20, threatDepth:9},
    standard: {label:'Standard', timeMs:1000, depth:12, width:26, threatDepth:11},
    deep: {label:'Deep', timeMs:2400, depth:16, width:30, threatDepth:15},
    maximum: {label:'Maximum', timeMs:10000, depth:20, width:36, threatDepth:19}
  });
  const now = () => typeof performance === 'object' ? performance.now() : Date.now();
  const point = i => Number.isInteger(i) && i >= 0 && i < 225;
  const coord=i=>i<0?'Pass':'ABCDEFGHJKLMNOP'[i%15]+(15-Math.floor(i/15));
  const clone = x => JSON.parse(JSON.stringify(x));
  const validRule = r => ['freestyle','exact-five','renju-practice'].includes(r);
  function validate(board,color,rule) {
    if (!validRule(rule) || ![1,2].includes(color) || !board || board.length !== 225 ||
        !Array.from(board).every(x => x === 0 || x === 1 || x === 2)) throw Error('Invalid analysis position.');
  }
  function context(input={}) {
    return {allowLegacyOffCenterOpening:input.allowLegacyOffCenterOpening === true,
      passes:input.passes === 1 ? 1 : input.passes === 2 ? 2 : 0,
      moveCount:Number.isInteger(input.moveCount) && input.moveCount >= 0 ? input.moveCount : null};
  }
  function positionKey(board,color,rule,ctx={}) {
    const c=context(ctx);
    return `${VERSION}|${rule}|${color}|${c.allowLegacyOffCenterOpening?'legacy':'center'}|${c.passes}|${c.moveCount??board.filter(Boolean).length}|${Array.from(board).join('')}`;
  }
  function terminal(board,rule) {
    for(let i=0;i<225;i++) {
      const c=board[i];if(!c)continue;
      for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1]]) {
        const x=i%15,y=(i/15)|0,px=x-dx,py=y-dy;
        if(px>=0&&px<15&&py>=0&&py<15&&board[py*15+px]===c)continue;
        let n=0,a=x,b=y;while(a>=0&&a<15&&b>=0&&b<15&&board[b*15+a]===c){n++;a+=dx;b+=dy;}
        if(rule==='exact-five'||(rule==='renju-practice'&&c===1)?n===5:n>=5)return c;
      }
    }
    return board.every(Boolean)?0:null;
  }
  function legal(board,color,rule,i,ctx={}) {
    const c=context(ctx);
    if(c.passes>=2||terminal(board,rule)!==null)return {legal:false,reason:'The position has already ended.'};
    return engineFactory(rule).legalMove(Int8Array.from(board),i,color,c.moveCount??board.filter(Boolean).length,{allowOffCenterOpening:c.allowLegacyOffCenterOpening});
  }
  function certificate(board,color,rule,solved,ctx={}) {
    if(!solved?.verified||solved.status!=='proven'||!solved.proof)return null;
    // The solver already did a separate verifier walk. Large trees are not
    // silently truncated: omit the certificate and state that limitation.
    const json=JSON.stringify(solved.proof);if(json.length>160000)return null;
    return {format:'GomokuStudioProof',version:1,rule,attacker:color,position:Array.from(board),kind:solved.kind,
      upperBoundPlies:solved.proof.plies,proof:clone(solved.proof),context:context(ctx),verifierVersion:'5.0'};
  }
  function verify(cert) {
    try { return !!cert && legal(cert.position,cert.attacker,cert.rule,cert.proof?.move,cert.context).legal && C.verifyCertificate(cert); } catch { return false; }
  }
  function shape(board,color,rule,i,ctx={}) {
    const a=legal(board,color,rule,i,ctx);if(!a.legal)return {legal:false,reason:a.reason,fours:[],threes:[],windows:[],neighbors:[]};
    const b=Array.from(board);if(i>=0)b[i]=color;
    const windows=[],neighbors=[];
    if(i>=0)for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1]])for(let start=-4;start<=0;start++) {
      const cells=[];for(let k=0;k<5;k++){const x=i%15+(start+k)*dx,y=((i/15)|0)+(start+k)*dy;if(x<0||x>=15||y<0||y>=15)break;cells.push(y*15+x);}
      if(cells.length===5&&!cells.some(j=>b[j]===3-color)&&cells.filter(j=>b[j]===color).length>=2)windows.push(cells);
    }
    if(i>=0)for(let j=0;j<225;j++)if(board[j]===color&&Math.max(Math.abs(j%15-i%15),Math.abs(((j/15)|0)-((i/15)|0)))<=2)neighbors.push(j);
    return {legal:true,win:!!a.win,fours:(a.fours||[]).map(f=>({stones:f.stones,ends:f.ends,straight:!!f.straight})),
      threes:(a.threes||[]).map(t=>({stones:t.stones,extensions:t.extensions})),windows,neighbors};
  }
  function diagnosis(result,playedShape,bestShape) {
    const f=result.facts, tags=[];
    if(result.label==='Draw by passes')tags.push('Draw by two passes');
    else if(f.win)tags.push('Finishes five');
    else if(f.alreadyLost)tags.push('Loss already unavoidable');
    else if(f.ownWins?.length)tags.push('Immediate win available');
    if(!f.alreadyLost&&f.replies?.length)tags.push('Allows immediate win');
    else if(f.threats?.includes(result.played))tags.push('Forced block');
    if(!f.win&&f.finishes?.length>=2&&!f.replies?.length)tags.push('Two winning endpoints');
    else if(!f.win&&f.finishes?.length===1)tags.push('Forcing four');
    if(playedShape.threes?.length)tags.push(playedShape.fours?.length?'Four–three pressure':'Three with legal extensions');
    if(result.refutation)tags.push('Opponent forcing win verified');
    if(result.bestProof)tags.push('Winning strategy verified');
    if(!tags.length)tags.push('Positional decision');
    return tags;
  }
  function analyze(board,color,rule,played,options={}) {
    validate(board,color,rule);const ctx=context(options.context),started=now();
    if(ctx.passes>=2||terminal(board,rule)!==null)throw Error('This position is terminal; there is no next move to analyze.');
    const preset=PRESETS[options.preset]||PRESETS.deep;
    const budget=Math.max(100,Math.min(15000,Number(options.timeMs)||preset.timeMs));
    // Only historical replay inherits a legacy opening policy; the live engine
    // and new Renju games retain their center-first rule.
    const scopedFactory=r=>{const e=engineFactory(r);return {...e,legalMove:(b,i,c,n,opt={})=>e.legalMove(b,i,c,n,{...opt,allowOffCenterOpening:ctx.allowLegacyOffCenterOpening})};};
    const R=reviewFactory(scopedFactory,studioFactory),e=engineFactory(rule);
    const centerOnly=rule==='renju-practice'&&color===1&&!board.some(Boolean)&&!ctx.allowLegacyOffCenterOpening;
    let raw;
    if(centerOnly) {
      raw={rule,color,move:112,pv:[112],candidates:[{i:112,score:0,bound:'rule-forced',pv:[112]}],depth:0,nodes:0,elapsedMs:0,
        tactical:{status:'skipped'},parameters:{budget,engine:'6.0-hybrid'},analysisQuality:'opening-rule',confidence:{band:'rule-forced'}};
    } else {
      raw=C.analyze(board,color,rule,{timeMs:Math.max(80,budget*(budget>=700?.72:.90)),depth:preset.depth,width:preset.width,
        multiPV:5,includeMoves:point(played)?[played]:[],threatDepth:preset.threatDepth,
        threatNodeLimit:options.preset==='maximum'?180000:60000,backend:options.backend||'auto',seed:17});
      raw.parameters.budget=budget;
      raw.candidates=raw.candidates.filter(c=>legal(board,color,rule,c.i,ctx).legal);
    }
    const out=R.pack(raw,board,color,played);
    if(centerOnly&&played===112){out.label='Best found';out.basis='rules';out.loss=0;out.explanation={why:'H8 is the required first move for Black in this Renju game. This is an opening rule, not an engine evaluation.',lesson:'After the required center move, compare threats and legal extensions.',highlights:[112]};}
    if(played===-1&&ctx.passes===1){out.label=out.facts.ownWins.length?'Win available':'Draw by passes';out.basis='rules';out.loss=null;out.score=0;out.facts={...out.facts,replies:[],finishes:[],alreadyLost:false};out.explanation={why:'This second consecutive pass ends the game as a draw.'+(out.facts.ownWins.length?' You could instead have completed five immediately.':''),lesson:'Evaluate the actual terminal result: no further reply is played after two passes.',highlights:out.facts.ownWins};}
    out.bestProof=certificate(board,color,rule,raw.tactical,ctx);out.proofOmitted=raw.tactical?.verified&&!out.bestProof;out.refutation=null;out.refutationOmitted=false;
    const after=Array.from(board),a=legal(board,color,rule,played,ctx);if(point(played)&&a.legal)after[played]=color;
    // An opponent proof after a move is evidence of a losing POSITION, not
    // evidence that the move caused it. Probe before as well when forcing.
    if(budget>=700&&a.legal&&!a.win&&!out.facts.alreadyLost&&terminal(after,rule)===null&&!(played===-1&&ctx.passes===1)) {
      const left=()=>budget-(now()-started);
      if(left()>65) {
        const probe=C.solve(after,3-color,rule,{kind:'vcf',timeMs:Math.max(30,left()*.68),depth:preset.threatDepth,nodeLimit:40000,orderWithSearch:false});
        out.refutation=certificate(after,3-color,rule,probe,{...ctx,passes:played<0?ctx.passes+1:0,moveCount:(ctx.moveCount??board.filter(Boolean).length)+1});out.refutationOmitted=probe.verified&&!out.refutation;
        if(out.refutation&&left()>45) {
          const prior=C.solve(board,3-color,rule,{kind:'vcf',timeMs:Math.max(25,left()*.8),depth:preset.threatDepth,nodeLimit:16000,orderWithSearch:false});
          // The opponent is NOT to move before our decision. Its attack proof
          // is merely a threat warning and cannot prove our position lost.
          out.opponentThreat=certificate(board,3-color,rule,prior,ctx);
        }
      }
    }
    out.analysisVersion=VERSION;out.context=ctx;out.positionId=positionKey(board,color,rule,ctx);out.preset=options.preset||'custom';
    out.timeMs=Math.round(now()-started);out.budget=budget;
    out.search={backend:raw.backend||'rules',engine:raw.parameters.engine,completedDepth:raw.depth||0,selectiveDepth:raw.selDepth||raw.depth||0,
      nodes:raw.nodes||0,ttHits:raw.ttHits||0,stableDepth:raw.stableDepth||0,rootChanges:raw.rootChanges||0,
      confidence:raw.confidence?.band||'low',timedOut:!!raw.timedOut,selective:true,
      compared:out.candidates.filter(c=>c.bound==='exact').length,returned:out.candidates.length,requestedLines:5,
      proofStatus:raw.tactical?.status||'skipped',proofNodes:raw.tactical?.nodes||0};
    out.playedShape=shape(board,color,rule,played,ctx);out.bestShape=point(out.best)?shape(board,color,rule,out.best,ctx):null;
    out.diagnosis=diagnosis(out,out.playedShape,out.bestShape);
    if(out.refutation&&!out.facts.alreadyLost&&!out.facts.replies.length) {
      out.explanation.why+=` A separate rule-verified search shows ${color===1?'White':'Black'} can force a win after this move within ${out.refutation.upperBoundPlies} plies (an upper bound). Open the threat proof to inspect every required defense. This alone does not establish that a different move saves the game.`;
    }
    for(const c of out.candidates) {
      c.depth=raw.candidates.find(x=>x.i===c.i)?.depth??raw.depth??0;
      c.shape=shape(board,color,rule,c.i,ctx);
      c.pv=R.line(board,color,rule,c.pv,{...ctx}).moves;
      c.delta=c.bound==='exact'&&raw.depth>=2?c.loss:null;
    }
    // Explain preventative defense using a checked counterfactual, not a
    // generic strategic label inferred from a score. Only the displayed lines
    // need this extra tactical work.
    const teach=(i,why)=>{
      if(!point(i)||!legal(board,3-color,rule,i,ctx).legal)return why;
      const b=Array.from(board);b[i]=3-color;const ends=Array.from(e.winningMoves(Int8Array.from(b),3-color));
      if(ends.length>=2&&!e.winningMoves(Int8Array.from(board),3-color).length&&!legal(board,color,rule,i,ctx).win)
        return why+` By occupying ${R.coord(i)}, you deny ${color===1?'White':'Black'} a move that would create finishing points at ${ends.map(R.coord).join(' and ')}. This cuts a concrete attacking route; it is not a claim that every threat is stopped.`;
      return why;
    };
    if(!out.facts.win&&!out.facts.alreadyLost&&out.basis!=='insufficient-search')out.explanation.why=teach(played,out.explanation.why);
    for(const c of out.candidates.filter((c,k)=>k<5||c.i===out.best||c.i===played)){if(!['Winning move','Already lost'].includes(c.label))c.explanation.why=teach(c.i,c.explanation.why);}
    out.pv=R.line(board,color,rule,out.pv,ctx).moves;
    return out;
  }
  function proofSteps(cert,choices=[]) {
    if(!cert?.proof)return [];
    let node=cert.proof,b=cert.position.slice(),c=cert.attacker,choiceIndex=0;const steps=[];
    while(node&&steps.length<50) {
      const a=legal(b,c,cert.rule,node.move,{allowLegacyOffCenterOpening:true});if(!a.legal)break;
      b[node.move]=c;
      steps.push({i:node.move,color:c,board:b.slice(),kind:node.type,highlights:a.win?[]:Array.from(engineFactory(cert.rule).winningMoves(Int8Array.from(b),c)),text:a.win?'Completes five.':node.type==='two-winning-points'?`Winning endpoints at ${node.ends.map(coord).join(' and ')}. The defender can occupy only one, and has no immediate counter-win.`:node.type==='forbidden-defense'?'The only blocking intersection is forbidden to the defender.':node.type==='all-defenses'?`All ${node.replies.length} legal replies are covered by this proof.`:'Threatens five; the defender must block or win immediately.'});
      if(a.win)break;
      if(node.replies?.length) {
        const choice=choices[choiceIndex++],chosen=node.replies.find(r=>r.move===choice)||[...node.replies].sort((a,b)=>b.proof.plies-a.proof.plies)[0];
        if(chosen.move>=0)b[chosen.move]=3-c;
        steps.push({i:chosen.move,color:3-c,board:b.slice(),kind:'defense',text:node.type==='forced-block'?'The only non-losing block against the immediate five threat.':'One legal defense. Change the defense selector to inspect another branch.',choices:node.replies.map(r=>r.move),choiceIndex:choiceIndex-1});
        node=chosen.proof;
      } else if(node.ends?.length>=2) {
        const block=node.ends.find(i=>legal(b,3-c,cert.rule,i,{allowLegacyOffCenterOpening:true}).legal)??-1,win=node.ends.find(i=>i!==block);if(block>=0)b[block]=3-c;steps.push({i:block,color:3-c,board:b.slice(),kind:'defense',highlights:[win],text:block>=0?`Block ${coord(block)}; ${coord(win)} is still open.`:'Both endpoint blocks are forbidden. A legal pass illustrates that either finish remains.'});
        b[win]=c;steps.push({i:win,color:c,board:b.slice(),kind:'five',text:'The other endpoint completes five.'});break;
      } else if(node.ends?.length===1) {
        steps.push({i:-1,color:3-c,board:b.slice(),kind:'defense',text:'Illustrative pass: the only block is forbidden. Any other non-winning move also leaves the finish.'});
        b[node.ends[0]]=c;steps.push({i:node.ends[0],color:c,board:b.slice(),kind:'five',text:'Completes five at the unblocked endpoint.'});break;
      } else break;
    }
    return steps;
  }
  function trainable(r) {
    return !!r&&r.analysisVersion===VERSION&&point(r.played)&&point(r.best)&&r.best!==r.played&&
      !['Unscored','Already lost','Illegal'].includes(r.label)&&
      (['Blunder','Mistake','Inaccuracy','Missed win','Win available'].includes(r.label))&&
      (r.basis==='rules'||r.basis==='verified-proof'||(r.basis==='selective-estimate'&&r.depth>=3&&r.search?.compared>=2));
  }
  function attemptVerdict(r,reference=null,assisted=false) {
    if(!r||r.label==='Unscored'||r.basis==='insufficient-search')return {status:'unresolved',advance:false,assisted,message:'No reliable verdict yet. Deepen the search; this attempt does not change your recall schedule.'};
    // A winning certificate at the original position raises the objective:
    // merely being heuristically "good" cannot replace a verified win.
    if(reference?.analysisVersion===VERSION&&!trainable(reference)&&!reference.facts?.ownWins?.length)return {status:'unresolved',advance:false,assisted,message:'Reanalysis no longer confirms the saved mistake. Explore this position, or deepen the reference search; recall history is unchanged.'};
    const referenceWins=reference?.bestProof||reference?.facts?.ownWins?.length;
    const win=['Winning move','Winning threat','Winning plan'].includes(r.label);
    if(referenceWins&&!win)return {status:r.refutation?'incorrect':'unresolved',advance:false,assisted,message:r.refutation?'This move permits a verified opponent win.':'The target is a winning continuation. This search has not verified your alternative yet.'};
    if(win)return {status:'correct',advance:!assisted,assisted,message:assisted?'Correct after a hint; recorded as assisted.':'Winning solution verified. Equivalent winning alternatives count.'};
    if(['Best found','Good'].includes(r.label)&&r.depth>=3&&r.search?.compared>=2&&!r.refutation)return {status:'correct',advance:!assisted,assisted,message:assisted?'Good alternative after a hint; recorded as assisted.':'Good alternative in the completed search. This remains an engine judgment, not a proof of perfect play.'};
    if(['Blunder','Mistake','Inaccuracy','Missed win','Win available','Illegal'].includes(r.label)||r.refutation)return {status:'incorrect',advance:false,assisted,message:'A stronger continuation is available. Compare its threat and then try this position again.'};
    return {status:'unresolved',advance:false,assisted,message:'Insufficient evidence to mark this attempt correct or incorrect.'};
  }
  function schedule(previous={},verdict,at=Date.now()) {
    const stats={attempts:previous.attempts||0,successes:previous.successes||0,lapses:previous.lapses||0,assisted:previous.assisted||0,streak:previous.streak||0,due:previous.due||at,last:previous.last||null};
    if(verdict.status==='unresolved')return stats;
    stats.attempts++;stats.last=at;
    if(verdict.assisted){stats.assisted++;stats.streak=0;stats.due=at+86400000;}
    else if(verdict.status==='correct'){stats.successes++;stats.streak++;stats.due=at+[1,3,7,14,30,60][Math.min(5,stats.streak-1)]*86400000;}
    else{stats.lapses++;stats.streak=0;stats.due=at+600000;}
    return stats;
  }
  function makeCard(r,p,game) {
    if(!trainable(r))return null;
    // Store compact historical evidence, not duplicate large proof trees. Every
    // exercise is searched afresh before it can affect recall history.
    const reference=clone(r);for(const k of ['bestProof','refutation','opponentThreat','playedShape','bestShape'])delete reference[k];
    reference.candidates=reference.candidates.slice(0,8).map(c=>{const q={...c};delete q.shape;return q;});
    return {id:positionKey(p.board,p.color,game.variant,p.context),version:2,board:p.board.slice(),color:p.color,rule:game.variant,context:context(p.context),played:p.played,
      source:{gameId:String(game.gameId||''),title:String(game.title||'Reviewed game').slice(0,120),ply:p.ply,date:Date.now()},
      reference,created:Date.now(),updated:Date.now(),stats:schedule({}, {status:'unresolved'}),events:[]};
  }
  function validateCard(card) {
    if(!card||card.version!==2)throw Error('Unsupported mistake card.');validate(card.board,card.color,card.rule);
    if(!point(card.played)||!legal(card.board,card.color,card.rule,card.played,card.context).legal)throw Error('Invalid saved decision.');
    if(card.id!==positionKey(card.board,card.color,card.rule,card.context)||JSON.stringify(card).length>240000)throw Error('Invalid or oversized mistake card.');
    if(!trainable(card.reference)||card.reference.played!==card.played||card.reference.color!==card.color||card.reference.rule!==card.rule||card.reference.key!==`${card.rule}:${card.color}:${card.board.join('')}`)throw Error('Mistake evidence does not match this position.');
    const clean=clone(card);clean.context=context(card.context);clean.source={gameId:String(card.source?.gameId||'').slice(0,100),title:String(card.source?.title||'Reviewed game').slice(0,120),ply:Math.max(1,Math.min(450,Number(card.source?.ply)||1)),date:Math.max(0,Number(card.source?.date)||0)};
    const stats=card.stats||{};clean.stats={};for(const k of ['attempts','successes','lapses','assisted','streak','due','last']){const v=stats[k];if(v!==null&&v!==undefined&&(!Number.isSafeInteger(v)||v<0||v>8640000000000000))throw Error('Invalid practice statistics.');clean.stats[k]=v??0;}
    clean.events=Array.isArray(card.events)?card.events.slice(-40).filter(e=>e&&typeof e.id==='string'&&['correct','incorrect'].includes(e.status)&&Number.isFinite(e.at)):[];
    // Imported analysis is historical, not a newly verified engine result.
    clean.reference.imported=true;return clean;
  }
  return {VERSION,PRESETS,positionKey,validate,context,terminal,legal,analyze,verify,proofSteps,shape,trainable,attemptVerdict,schedule,makeCard,validateCard};
}
if(typeof module!=='undefined'&&module.exports)module.exports={createAnalysis2};
