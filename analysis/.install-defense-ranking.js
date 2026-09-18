  function applyDefense(raw,screen,played) {
    const wanted=[...new Set([played,...screen.defenses()])].filter(point);
    for(const i of wanted)if(!raw.candidates.some(c=>c.i===i)&&screen.inspect(i).status!=='illegal')
      raw.candidates.push({i,score:null,bound:'unsearched',pv:[i],depth:0});
    for(const c of raw.candidates) {
      const row=screen.inspect(c.i);c.defenseStatus=row.status;
      if(row.status==='proven-loss') {
        const proof=screen.proofs[row.proofIndex];
        c.estimate=c.score;c.score=null;c.bound='verified-loss';c.pv=[c.i,...C.proofLine(proof.proof)];
      }
    }
    const tier=c=>c.defenseStatus==='winning-move'?0:c.i===raw.tactical?.move&&raw.tactical?.verified?0:c.defenseStatus==='proven-loss'?3:c.defenseStatus==='neutralizes-known-threat'?1:2;
    raw.candidates.sort((a,b)=>tier(a)-tier(b)||(b.score??-Infinity)-(a.score??-Infinity)||a.i-b.i);
    // A selective positional score cannot override a verified opponent win.
    const previous=raw.move,picked=raw.candidates.find(c=>c.defenseStatus!=='proven-loss'&&c.defenseStatus!=='illegal');
    const proven=raw.tactical?.verified&&raw.candidates.find(c=>c.i===raw.tactical.move&&c.defenseStatus!=='proven-loss');
    const best=proven||picked;
    raw.move=best?.i??null;raw.pv=proven?raw.tactical.pv.slice():best?.pv?.slice()||[];
    if(previous!==raw.move)raw.defenseOverride={from:previous,to:raw.move,reason:'forcing-defense-proof'};
    if(raw.candidates.length>40){const keep=new Set([played,raw.move]);raw.candidates=[...raw.candidates.filter(c=>keep.has(c.i)),...raw.candidates.filter(c=>!keep.has(c.i)).slice(0,40-keep.size)];}
  }
  function explainDefense(out,raw,screen,board,color,rule,ctx) {
    const them=color===1?'White':'Black',summary=screen.report(),root=screen.rootThreat;
    const rootShape=root?engineFactory(rule).classify(Int8Array.from(board),root.move,3-color):null;
    const attackName=rootShape?.fours?.length&&rootShape?.threes?.length?'four–three attack':'forcing attack';
    function decorate(target,i) {
      const row=screen.inspect(i);target.defenseStatus=row.status;
      if(row.status==='proven-loss'&&!['Winning move','Already lost','Draw by passes'].includes(target.label)) {
        const solved=screen.proofs[row.proofIndex],pv=C.proofLine(solved.proof),at=coord(i);
        const a=engineFactory(rule).classify(Int8Array.from(screen.after(i)),solved.move,3-color);
        const name=a.fours?.length&&a.threes?.length?'four–three attack':'forcing attack';
        // This proves the after-position loses, not that the loss was avoidable.
        if(target.basis!=='rules')target.label='Losing move';
        target.basis='verified-proof';target.loss=null;target.score=null;
        target.explanation={why:`${at} allows a verified ${them} ${name} beginning at ${coord(solved.move)}. One forcing line is ${pv.map(coord).join(' → ')}. Every required defense in this proof is checked, including counter-wins and forbidden moves. This alone does not establish that a different move saves the game.`,lesson:'Stop the forcing combination before its first four. An attractive positional move cannot compensate for a verified forced loss.',highlights:[solved.move,...(solved.proof.ends||[])]};
        target.tactical={status:'proven-loss',reply:solved.move,upperBoundPlies:solved.proof.plies,line:pv};
      } else if(root&&row.status==='neutralizes-known-threat'&&!['Winning move','Winning threat','Winning plan','Already lost','Draw by passes','Illegal','Blunder'].includes(target.label)) {
        const counterfactual=target.explanation?.why?.match(/ By occupying [\s\S]*/)?.[0]||'';
        target.estimatedLabel=target.label;target.estimatedLoss=target.loss;
        target.label=i===out.best?'Best found':'Defensive move';target.basis='verified-defense';target.loss=null;
        target.explanation={why:`${coord(i)} interrupts the verified ${them} ${attackName} starting at ${coord(root.move)}. It is a tactical defensive move: the checked forcing line no longer works after this placement.${counterfactual} Other continuations remain unresolved; stopping this attack is not a proof of a draw or win.`,lesson:'Defend against the whole combination, including its later endpoints, rather than waiting for the first four.',highlights:[i,root.move]};
        target.tactical={status:'neutralizes-known-threat',reply:root.move};
      }
    }
    for(const c of out.candidates)decorate(c,c.i);
    decorate(out,out.played);
    if(summary.allRefuted&&!out.facts?.win&&out.label!=='Draw by passes') {
      out.label='Already lost';out.basis='verified-proof';out.loss=null;out.best=null;
      out.explanation={why:'Every legal move in this position has a verified opponent forcing win. This decision is not a new avoidable mistake.',lesson:'Go back to the earlier decision before these forcing attacks became unavoidable.',highlights:[]};
    }
    if(!point(raw.move)&&!raw.tactical?.verified){out.best=null;out.pv=[];}
    out.refutation=screen.evidence(out.played)||out.refutation;
    out.defense=summary;out.defenseOverride=raw.defenseOverride||null;
    out.diagnosis=diagnosis(out,out.playedShape,out.bestShape);
    if(out.basis==='verified-defense')out.diagnosis.unshift('Prevents a forcing attack');
  }
