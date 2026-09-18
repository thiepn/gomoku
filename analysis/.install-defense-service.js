  function defenseScreen(board,color,rule,ctx,played,{timeMs=90,depth=9}={}) {
    const e=engineFactory(rule),attacker=3-color,start=now(),until=start+Math.max(0,timeMs);
    const rows=new Map(),proofs=[],moveCount=ctx.moveCount??board.filter(Boolean).length;
    let rootThreat=null,enumerated=false,probes=0,proofReuses=0,nodes=0,probeTimedOut=false,workMs=0;
    const after=i=>{const b=Array.from(board);if(point(i))b[i]=color;return b;};
    const nextContext=i=>({...ctx,passes:i<0?ctx.passes+1:0,moveCount:moveCount+1});
    const rootLegal=i=>e.legalMove(Int8Array.from(board),i,color,moveCount,{allowOffCenterOpening:ctx.allowLegacyOffCenterOpening});
    function inspect(i) {
      const old=rows.get(i);
      if(old&&(old.status==='proven-loss'||old.terminal||old.generation===proofs.length))return old;
      const a=old?.legality||rootLegal(i);
      if(!a.legal){const row={i,status:'illegal',legality:a,generation:proofs.length};rows.set(i,row);return row;}
      const b=after(i),terminalMove=a.win||(i===-1&&ctx.passes===1)||b.every(Boolean);
      const row={...old,i,legality:a,terminal:!!terminalMove,generation:proofs.length,
        status:a.win?'winning-move':terminalMove?'draw':proofs.length?'neutralizes-known-threat':'unresolved'};
      if(!terminalMove)for(let k=0;k<proofs.length;k++) {
        // Verify the entire actual after-position, including remote counter-wins.
        if(C.verifyProof(b,attacker,rule,proofs[k].proof)) {
          row.status='proven-loss';row.proofIndex=k;proofReuses++;break;
        }
      }
      rows.set(i,row);return row;
    }
    function searchAt(i,budget) {
      const row=inspect(i);if(row.status==='illegal'||row.status==='proven-loss'||row.terminal||budget<10)return row;
      const t=now(),solved=C.solve(after(i),attacker,rule,{kind:'vcf',timeMs:budget,depth,nodeLimit:60000,orderWithSearch:false});
      probes++;nodes+=solved.nodes||0;probeTimedOut=probeTimedOut||solved.timedOut;
      row.probe={status:solved.status,timedOut:!!solved.timedOut,depth:solved.maxDepth,nodes:solved.nodes};
      if(solved.verified&&solved.status==='proven') {
        proofs.push(solved);row.generation=-1;
      }
      const result=inspect(i);workMs+=now()-t;return result;
    }
    // Opponent-to-move is hypothetical: this does not prove the current side lost.
    if(timeMs>=10&&board.some(Boolean)&&terminal(board,rule)===null) {
      const solved=C.solve(board,attacker,rule,{kind:'vcf',timeMs:Math.max(10,Math.min(100,timeMs*.70)),depth,nodeLimit:40000,orderWithSearch:false});
      probes++;nodes+=solved.nodes||0;probeTimedOut=!!solved.timedOut;
      if(solved.verified&&solved.status==='proven'){rootThreat=solved;proofs.push(solved);}
    }
    if(rootThreat) {
      // Include distant endpoints and pass; prioritize proof squares under a deadline.
      const all=[...new Set([played,...C.proofLine(rootThreat.proof),...Array.from({length:225},(_,i)=>i).filter(i=>!board[i]),-1])].filter(i=>point(i)||i===-1);
      enumerated=true;
      for(const i of all){if(now()>=until){enumerated=false;break;}inspect(i);}
    }
    workMs+=now()-start;
    function refine(order,budget) {
      const end=now()+Math.max(0,budget),visited=new Set();
      for(const i of order) {
        if(visited.has(i)||!point(i)&&i!==-1)continue;visited.add(i);
        const left=end-now();if(left<12)break;
        searchAt(i,Math.min(70,Math.max(10,left/Math.min(3,Math.max(1,order.length-visited.size+1)))));
      }
      // A newly established proof may refute earlier candidates too.
      for(const i of rows.keys())inspect(i);
    }
    function defenses(){return [...rows.values()].filter(r=>point(r.i)&&r.status!=='illegal'&&r.status!=='proven-loss'&&r.generation===proofs.length).map(r=>r.i);}
    function evidence(i) {
      const row=inspect(i);if(row.status!=='proven-loss')return null;
      return certificate(after(i),attacker,rule,proofs[row.proofIndex],nextContext(i));
    }
    function report() {
      const legalRows=[...rows.values()].filter(r=>r.status!=='illegal');
      return {kind:'vcf',depthLimit:depth,rootThreat:rootThreat?.move??null,
        rootThreatLine:rootThreat?C.proofLine(rootThreat.proof):[],
        checked:legalRows.length,refuted:legalRows.filter(r=>r.status==='proven-loss').length,
        defenses:rootThreat?defenses():[],enumerationComplete:enumerated,
        allRefuted:enumerated&&legalRows.length>0&&legalRows.every(r=>r.status==='proven-loss'),
        proofCount:proofs.length,proofReuses,probes,nodes,timedOut:probeTimedOut,
        elapsedMs:Math.round(workMs),scope:'Verified losing continuations; unrefuted moves are not proven draws or wins.'};
    }
    return {inspect,refine,defenses,evidence,report,after,nextContext,get rootThreat(){return rootThreat;},get proofs(){return proofs;}};
  }
