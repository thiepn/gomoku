/* Gomoku 1.2 — Course 2.0 core.
 * Curated animated walkthroughs and transfer checks shared by all 14 chapters.
 * Pure data/state logic: no DOM, storage, engine, or network dependency.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GomokuCourse2Core=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='1.2.0';
  const SIZE=9;
  const COLS='ABCDEFGHI';
  const c=(chapter,title,skill,summary,frames,transfer)=>Object.freeze({
    chapter,title,skill,summary,
    frames:Object.freeze(frames.map(x=>Object.freeze({...x}))),
    transfer:Object.freeze({...transfer,answers:Object.freeze(transfer.answers)})
  });
  const F=(copy,black=[],white=[],marks=[],line=[])=>({copy,black,white,marks,line});
  const CHAPTERS=Object.freeze([
    c(1,'Seeing the Board','board-scan','Run the same four-direction scan before every move.',[
      F('Start from the last move. Do not stare at one line—scan through the intersection.',['E5'],[],['E5']),
      F('First read the horizontal and vertical axes.',['E5'],[],['A5','I5','E1','E9'],['A5','I5']),
      F('Then read both diagonals. One intersection participates in four lines.',['E5'],[],['A1','I9','A9','I1'],['A1','I9']),
      F('Only after the tactical scan should you compare quieter plans.',['E5'],[],['E5'])
    ],{prompt:'Black to move. Finish the immediate five before considering anything else.',black:['C5','D5','E5','F5'],white:['C4','D4'],side:1,answers:['G5'],explain:'G5 completes five immediately. The board scan should find a direct win before any strategic move.'}),
    c(2,'Fours','open-four','A four is powerful because it creates an immediate winning endpoint.',[
      F('Three connected stones are pressure, not yet a forced win.',['D5','E5','F5']),
      F('Add G5 and the line becomes an open four.',['D5','E5','F5','G5'],[],['C5','H5'],['C5','H5']),
      F('Both endpoints win. One defender cannot cover both.',['D5','E5','F5','G5'],['C5'],['H5']),
      F('The remaining endpoint finishes the five.',['D5','E5','F5','G5','H5'],['C5'],['D5','E5','F5','G5','H5'],['D5','H5'])
    ],{prompt:'Black to move. Create an open four with two winning endpoints.',black:['D5','E5','F5'],white:['D4','F4'],side:1,answers:['G5'],explain:'G5 creates D5–G5 with C5 and H5 both available as winning endpoints.'}),
    c(3,'Threes','legal-three','A useful three matters because it can grow into a forcing four.',[
      F('Two stones are only potential.',['D5','E5']),
      F('F5 creates a straight three with room on both sides.',['D5','E5','F5'],[],['C5','G5'],['C5','G5']),
      F('A legal extension can turn the three into a four.',['D5','E5','F5','G5'],[],['C5','H5'],['D5','G5']),
      F('When judging a three, always ask whether its continuation is actually legal.',['D5','E5','F5'],[],['C5','G5'])
    ],{prompt:'Black to move. Build the clean straight three.',black:['D5','E5'],white:['D4','F4'],side:1,answers:['F5'],explain:'F5 makes three connected stones with space to extend on both sides.'}),
    c(4,'Forks & Double Threats','double-threat','The strongest forks make one move matter in more than one direction.',[
      F('White already has useful stones on two axes.',[],['D5','F5','E4','E6']),
      F('E5 connects both axes at once.',[],['D5','E4','E5','E6','F5'],['E5']),
      F('Now horizontal and vertical threats must both be considered.',[],['D5','E4','E5','E6','F5'],['C5','G5','E3','E7'],['D5','F5']),
      F('This is the essence of a fork: one move creates multiple urgent continuations.',[],['D5','E4','E5','E6','F5'],['E5'])
    ],{prompt:'White to move. Which intersection creates pressure on both axes at once?',black:['C3','G7'],white:['D5','F5','E4','E6'],side:2,answers:['E5'],explain:'E5 connects the horizontal and vertical stones simultaneously, creating a multi-directional fork.'}),
    c(5,'Defense','forced-defense','Defense starts by locating what the opponent can do immediately.',[
      F('White has a four with only one open winning endpoint because B5 is occupied.',['B5'],['C5','D5','E5','F5']),
      F('G5 is not optional. It is the only point that stops the immediate win.',['B5'],['C5','D5','E5','F5'],['G5'],['C5','G5']),
      F('Urgent defense comes before building your own quiet plan.',['B5','G5'],['C5','D5','E5','F5'],['G5']),
      F('After surviving, scan again for counter-threats and initiative.',['B5','G5'],['C5','D5','E5','F5'])
    ],{prompt:'Black to move. White wins next move unless you defend the only endpoint.',black:['B5','E3'],white:['C5','D5','E5','F5'],side:1,answers:['G5'],explain:'G5 is the only immediate defense because B5 already closes the other end.'}),
    c(6,'Reading Sequences','forcing-order','Calculate forcing moves first because they sharply restrict the reply tree.',[
      F('Begin with moves that demand a response, not with every legal move.',['D5','E5','F5'],['C5']),
      F('G5 creates a forcing four.',['D5','E5','F5','G5'],['C5'],['H5'],['D5','G5']),
      F('The defender has to answer H5 before pursuing another plan.',['D5','E5','F5','G5'],['C5','H5'],['H5']),
      F('This forcing-first ordering is what makes deeper VCF/VCT calculation manageable.',['D5','E5','F5','G5'],['C5','H5'])
    ],{prompt:'Black to move. Which candidate should be calculated first because it forces an immediate reply?',black:['D5','E5','F5'],white:['C5','D3'],side:1,answers:['G5'],explain:'G5 creates a four with only H5 remaining, so the defender is forced to answer before anything else.'}),
    c(7,'Shape & Positional Play','shape-efficiency','Efficient stones stay connected to several future plans.',[
      F('In sparse positions, flexibility is more valuable than density.',['D5'],['G6']),
      F('E5 connects naturally to D5 and remains central.',['D5','E5'],['G6'],['E5']),
      F('The stone can contribute horizontally, vertically, and diagonally.',['D5','E5'],['G6'],['E4','E6','D4','F6']),
      F('Good shape means future utility without unnecessary commitment.',['D5','E5'],['G6'])
    ],{prompt:'Black to move. Choose the most efficient central continuation.',black:['D5'],white:['G6'],side:1,answers:['E5'],explain:'E5 stays central, connects immediately, and preserves several future directions.'}),
    c(8,'Initiative & Move Priority','initiative','Initiative belongs to the player whose threats force the other side to answer.',[
      F('A quiet move gives the opponent freedom. A forcing move takes it away.',['C5','D5','E5'],['C4']),
      F('F5 creates a four and demands attention.',['C5','D5','E5','F5'],['C4'],['B5','G5'],['C5','F5']),
      F('When the opponent must answer your threat, you keep the initiative.',['C5','D5','E5','F5'],['B5','C4'],['G5']),
      F('Priority is tactical first: win, survive, force—then improve shape.',['C5','D5','E5','F5'],['B5','C4'])
    ],{prompt:'Black to move. Keep the initiative with the move that creates the most urgent threat.',black:['C5','D5','E5'],white:['C4','G6'],side:1,answers:['F5'],explain:'F5 creates an immediate four, forcing White to react instead of starting a plan elsewhere.'}),
    c(9,'Attack Construction','attack-construction','Build attacks by making stones cooperate across more than one future line.',[
      F('One line of pressure is easy to read and often easy to stop.',['D5','E5','E4'],['G6']),
      F('F5 extends the horizontal structure while keeping E5 connected vertically.',['D5','E4','E5','F5'],['G6'],['F5']),
      F('The goal is not just more stones—it is overlapping future threats.',['D5','E4','E5','F5'],['G6'],['C5','G5','E3','E6']),
      F('Strong attacks accumulate useful connections before the forcing sequence begins.',['D5','E4','E5','F5'],['G6'])
    ],{prompt:'Black to move. Extend the attack while preserving the central connection.',black:['D5','E5','E4'],white:['G6','C3'],side:1,answers:['F5'],explain:'F5 strengthens the horizontal line while E5 still links the attack to the vertical structure.'}),
    c(10,'Whole-Board Planning','whole-board','The correct move can be far from the area you were planning to attack.',[
      F('Black has activity near the center, but White has a remote four on row 3.',['E5','F5'],['C3','D3','E3','F3']),
      F('B3 already closes one endpoint. The danger is G3.',['B3','E5','F5'],['C3','D3','E3','F3'],['G3'],['C3','G3']),
      F('Whole-board scanning prevents attractive local plans from missing a remote loss.',['B3','E5','F5','G3'],['C3','D3','E3','F3'],['G3']),
      F('Only after every urgent area is safe should you compare long-term plans.',['B3','E5','F5','G3'],['C3','D3','E3','F3'])
    ],{prompt:'Black to move. Ignore the local attack for one move and find the remote defensive necessity.',black:['B3','E5','F5'],white:['C3','D3','E3','F3'],side:1,answers:['G3'],explain:'G3 is mandatory. Whole-board planning begins by finding urgent threats outside your current local plan.'}),
    c(11,'Openings & Early Play','opening-flexibility','Opening moves should preserve options instead of committing too early.',[
      F('Early stones have the most value when they can join several future lines.',['E5'],['F5']),
      F('D5 develops centrally and connects without crowding the position.',['D5','E5'],['F5'],['D5']),
      F('The position still has horizontal, diagonal, and vertical possibilities.',['D5','E5'],['F5'],['D4','E4','C5','D6']),
      F('Opening principles are priorities, not rigid scripts. Urgent tactics always override them.',['D5','E5'],['F5'])
    ],{prompt:'Black to move early. Choose the flexible central development.',black:['E5'],white:['F5'],side:1,answers:['D5'],explain:'D5 develops toward the center, connects with E5, and keeps several future plans available.'}),
    c(12,'Advanced Renju','exact-five','For Black, exact-five and forbidden overline must be distinguished precisely.',[
      F('Black wins by making exactly five in a row.',['C5','D5','E5','F5'],['C4']),
      F('G5 completes an exact five from C5 through G5.',['C5','D5','E5','F5','G5'],['C4'],['C5','G5'],['C5','G5']),
      F('Renju legality is not visual guesswork: count the resulting line exactly.',['C5','D5','E5','F5','G5'],['C4'],['G5']),
      F('When studying advanced Renju, test every candidate for exact-five, overline, double-four, and double-three consequences.',['C5','D5','E5','F5'],['C4'])
    ],{prompt:'Black to move in Renju. Complete the exact five.',black:['C5','D5','E5','F5'],white:['C4','H6'],side:1,answers:['G5'],explain:'G5 produces exactly five Black stones from C5 to G5, so it is a legal winning move.'}),
    c(13,'Expert Calculation','best-defense','Expert calculation asks what the opponent will do best, not what you hope they do.',[
      F('Start from a small candidate set after checking immediate tactics.',['D5','E5','F5'],['C5']),
      F('G5 is forcing, so it deserves calculation before quiet candidates.',['D5','E5','F5','G5'],['C5'],['H5']),
      F('Assume the strongest reply: White blocks H5.',['D5','E5','F5','G5'],['C5','H5'],['H5']),
      F('Only call a continuation good after it survives the opponent’s best defense.',['D5','E5','F5','G5'],['C5','H5'])
    ],{prompt:'Black to move. Which candidate deserves first calculation because it forces White’s strongest reply?',black:['D5','E5','F5'],white:['C5','E3'],side:1,answers:['G5'],explain:'G5 creates a forcing four. Expert calculation begins with forcing candidates and then tests the strongest defense.'}),
    c(14,'Full-Game Mastery','full-game-transfer','Transfer means applying the same scan under realistic whole-game distraction.',[
      F('A full game contains strategy, history, and tempting plans at once.',['B3','E5','F5'],['C3','D3','E3','F3']),
      F('The pre-move routine stays simple: win? threat? forcing move? then plan.',['B3','E5','F5'],['C3','D3','E3','F3'],['G3']),
      F('G3 is urgent even if the center looks more interesting.',['B3','E5','F5','G3'],['C3','D3','E3','F3'],['G3']),
      F('Mastery is the ability to retrieve the right principle when the position no longer looks like the lesson.',['B3','E5','F5','G3'],['C3','D3','E3','F3'])
    ],{prompt:'Black to move in a messy position. Apply the full pre-move scan and stop the immediate loss.',black:['B3','E5','F5'],white:['C3','D3','E3','F3'],side:1,answers:['G3'],explain:'G3 is the urgent defense. Full-game transfer means retrieving the correct priority despite unrelated activity elsewhere.'})
  ]);
  const BY_CHAPTER=Object.freeze(Object.fromEntries(CHAPTERS.map(x=>[x.chapter,x])));
  function point(coord){
    const m=/^([A-I])([1-9])$/.exec(String(coord||'').toUpperCase());
    if(!m)return null;
    return {x:COLS.indexOf(m[1]),y:Number(m[2])-1};
  }
  function validCoord(coord){return !!point(coord);}
  function fresh(){return {version:1,events:[],chapters:{}};}
  function normalize(raw){
    const base=fresh();
    if(!raw||raw.version!==1||!Array.isArray(raw.events))return base;
    base.events=raw.events.filter(e=>e&&Number.isInteger(e.chapter)&&BY_CHAPTER[e.chapter]&&typeof e.correct==='boolean'&&Number.isFinite(Number(e.at))).slice(-400);
    for(const e of base.events){
      const row=base.chapters[e.chapter]||={attempts:0,solved:false,clean:false,assisted:false,lastAt:0};
      row.attempts++;
      if(e.correct){row.solved=true;if(!e.assisted&&row.attempts===1)row.clean=true;}
      if(e.assisted)row.assisted=true;
      row.lastAt=Math.max(row.lastAt,Number(e.at)||0);
    }
    return base;
  }
  function record(raw,chapter,{correct,assisted=false,at=Date.now()}={}){
    if(!BY_CHAPTER[chapter]||typeof correct!=='boolean')throw Error('Invalid transfer attempt.');
    const s=normalize(raw);
    s.events.push({chapter,skillId:BY_CHAPTER[chapter].skill,correct,assisted:!!assisted,at:Number(at)||Date.now()});
    return normalize(s);
  }
  function evidence(raw){
    const s=normalize(raw);
    return s.events.map(e=>({...e,skillId:BY_CHAPTER[e.chapter].skill}));
  }
  function summary(raw){
    const s=normalize(raw),rows=CHAPTERS.map(ch=>({chapter:ch.chapter,...(s.chapters[ch.chapter]||{attempts:0,solved:false,clean:false,assisted:false,lastAt:0})}));
    return {
      total:CHAPTERS.length,
      solved:rows.filter(x=>x.solved).length,
      clean:rows.filter(x=>x.clean).length,
      attempted:rows.filter(x=>x.attempts>0).length,
      rows
    };
  }
  return Object.freeze({VERSION,SIZE,COLS,CHAPTERS,chapter:n=>BY_CHAPTER[Number(n)]||null,point,validCoord,normalize,record,evidence,summary});
});
