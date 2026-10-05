/* Gomoku 1.1 — Learning Intelligence core.
 * Pure deterministic aggregation. No DOM, storage, engine, or network dependency.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GomokuLearningCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='1.1.0';
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
  const GROUPS=[
    {id:'foundations',title:'Foundations'},
    {id:'tactics',title:'Tactics & Defense'},
    {id:'strategy',title:'Strategy'},
    {id:'renju',title:'Renju'},
    {id:'calculation',title:'Calculation'},
    {id:'opening',title:'Opening Play'}
  ];
  const S=(id,title,group,chapters,prerequisites=[])=>Object.freeze({id,title,group,chapters:Object.freeze(chapters),prerequisites:Object.freeze(prerequisites)});
  const SKILLS=Object.freeze([
    S('board-scan','Board scanning','foundations',[1]),
    S('immediate-win','Immediate wins','foundations',[1],['board-scan']),
    S('threat-scan','Immediate threat detection','foundations',[1,5],['board-scan']),
    S('closed-four','Closed fours','tactics',[2],['immediate-win']),
    S('open-four','Open fours','tactics',[2],['closed-four']),
    S('broken-four','Broken fours','tactics',[2],['closed-four']),
    S('legal-three','Legal threes','tactics',[3],['board-scan']),
    S('straight-three','Straight threes','tactics',[3],['legal-three']),
    S('broken-three','Broken threes','tactics',[3],['legal-three']),
    S('double-threat','Double threats','tactics',[4],['open-four','legal-three']),
    S('four-three','Four–three attacks','tactics',[4,12],['closed-four','legal-three']),
    S('forced-defense','Forced defense','tactics',[5],['threat-scan']),
    S('counter-win','Counter-wins','tactics',[5],['immediate-win','threat-scan']),
    S('remote-defense','Remote defense','tactics',[5,6],['forced-defense']),
    S('forcing-order','Forcing move order','calculation',[6,13],['forced-defense','closed-four']),
    S('vcf-reading','VCF calculation','calculation',[6,13],['forcing-order']),
    S('vct-reading','VCT calculation','calculation',[6,13],['vcf-reading','legal-three']),
    S('shape-efficiency','Shape efficiency','strategy',[7],['board-scan']),
    S('connection','Connection & line quality','strategy',[7],['shape-efficiency']),
    S('flexibility','Multi-directional flexibility','strategy',[7,9],['connection']),
    S('initiative','Initiative','strategy',[8],['threat-scan']),
    S('move-priority','Move priority','strategy',[8],['initiative']),
    S('attack-construction','Attack construction','strategy',[9],['move-priority','flexibility']),
    S('candidate-generation','Candidate generation','calculation',[10,13],['board-scan','move-priority']),
    S('whole-board','Whole-board planning','strategy',[10],['candidate-generation','shape-efficiency']),
    S('plan-comparison','Plan comparison','strategy',[10,13],['candidate-generation']),
    S('opening-shape','Opening shape','opening',[11],['shape-efficiency']),
    S('opening-flexibility','Opening flexibility','opening',[11],['opening-shape','flexibility']),
    S('exact-five','Exact-five judgment','renju',[12],['immediate-win']),
    S('overline','Overline awareness','renju',[12],['exact-five']),
    S('double-three-rule','Double-three legality','renju',[12],['legal-three']),
    S('double-four-rule','Double-four legality','renju',[12],['closed-four']),
    S('calculation-depth','Calculation depth','calculation',[13],['forcing-order','candidate-generation']),
    S('best-defense','Strongest-reply calculation','calculation',[13],['forced-defense','calculation-depth']),
    S('full-game-transfer','Full-game transfer','strategy',[14],['whole-board','best-defense'])
  ]);
  const BY_ID=Object.freeze(Object.fromEntries(SKILLS.map(s=>[s.id,s])));
  const CHAPTER_TITLES=Object.freeze({
    1:'Seeing the Board',2:'Fours',3:'Threes',4:'Forks & Double Threats',5:'Defense',
    6:'Reading Sequences',7:'Shape & Positional Play',8:'Initiative & Move Priority',
    9:'Attack Construction',10:'Whole-Board Planning',11:'Openings & Early Play',
    12:'Advanced Renju',13:'Expert Calculation',14:'Full-Game Mastery'
  });
  const MOTIFS=Object.freeze({
    0:['immediate-win','board-scan'],
    1:['broken-four','closed-four'],
    2:['forced-defense','threat-scan'],
    3:['open-four','closed-four'],
    4:['double-threat','four-three'],
    5:['exact-five','overline']
  });
  const PRACTICE_MOTIFS=Object.freeze(Object.fromEntries(
    Object.entries(MOTIFS).flatMap(([motif,ids])=>ids.map(id=>[id,Number(motif)]))
  ));
  const TAGS=Object.freeze({
    'Finishes five':['immediate-win'],
    'Immediate win available':['immediate-win','board-scan'],
    'Allows immediate win':['threat-scan','forced-defense'],
    'Forced block':['forced-defense'],
    'Two winning endpoints':['open-four','double-threat'],
    'Forcing four':['closed-four','forcing-order'],
    'Four–three pressure':['four-three','attack-construction'],
    'Three with legal extensions':['legal-three'],
    'Opponent forcing win verified':['remote-defense','vcf-reading','best-defense'],
    'Winning strategy verified':['forcing-order','vcf-reading'],
    'Prevents a forcing attack':['forced-defense','remote-defense'],
    'Positional decision':['candidate-generation','plan-comparison']
  });
  function idsForLabel(label=''){
    const x=String(label).toLowerCase();
    if(x.includes('missed win')||x.includes('win available'))return ['immediate-win','board-scan'];
    if(x.includes('losing move'))return ['forced-defense','remote-defense','best-defense'];
    if(x.includes('blunder'))return ['threat-scan','candidate-generation','best-defense'];
    if(x.includes('mistake')||x.includes('inaccuracy'))return ['candidate-generation','plan-comparison'];
    if(x.includes('defensive move'))return ['forced-defense','remote-defense'];
    if(x.includes('winning plan')||x.includes('winning threat'))return ['forcing-order','attack-construction'];
    if(x.includes('winning move'))return ['immediate-win'];
    return ['candidate-generation'];
  }
  function signalSkills(signal){
    if(!signal)return [];
    if(typeof signal==='string')return TAGS[signal]||idsForLabel(signal);
    const ids=[];
    for(const tag of Array.isArray(signal.diagnosis)?signal.diagnosis:[])ids.push(...(TAGS[tag]||[]));
    if(signal.label)ids.push(...idsForLabel(signal.label));
    return [...new Set(ids)].filter(id=>BY_ID[id]);
  }
  const fresh=skill=>({
    skill,positive:0,negative:0,events:0,cleanPositive:0,transferPositive:0,lastAt:0,
    dueMistakes:0,duePractice:0,course:0,courseSeen:false,sources:new Set(),contexts:new Set(),mistakeIds:new Set()
  });
  function recency(at,now){
    if(!Number.isFinite(Number(at))||Number(at)<=0)return .82;
    const days=Math.max(0,(now-Number(at))/86400000);
    return .62+.38*Math.exp(-days/90);
  }
  function dayBucket(at){
    const n=Number(at);return Number.isFinite(n)&&n>0?Math.floor(n/86400000):0;
  }
  function add(row,{positive=0,negative=0,events=1,clean=0,transfer=0,at=0,dueMistake=0,duePractice=0,source='unknown',context='',mistakeId=''}={}){
    row.positive+=Math.max(0,positive);row.negative+=Math.max(0,negative);row.events+=Math.max(0,events);
    row.cleanPositive+=Math.max(0,clean);row.transferPositive+=Math.max(0,transfer);
    row.dueMistakes+=Math.max(0,dueMistake);row.duePractice+=Math.max(0,duePractice);
    row.lastAt=Math.max(row.lastAt,Number(at)||0);row.sources.add(source);
    if(context)row.contexts.add(String(context));if(mistakeId)row.mistakeIds.add(String(mistakeId));
  }
  function courseMap(course=[]){
    const rows={};
    for(const r of Array.isArray(course)?course:[]){
      const chapter=Number(r?.chapter);if(!Number.isInteger(chapter)||chapter<1||chapter>14)continue;
      const total=Math.max(0,Number(r.total)||0),done=Math.max(0,Math.min(total,Number(r.done)||0));
      rows[chapter]=total?done/total:0;
    }
    return rows;
  }
  function analyze(input={}){
    const now=Number(input.now)||Date.now(),course=courseMap(input.course);
    const rows=Object.fromEntries(SKILLS.map(s=>[s.id,fresh(s)]));
    for(const s of SKILLS){
      const values=s.chapters.filter(n=>Object.hasOwn(course,n)).map(n=>course[n]);
      if(values.length){rows[s.id].course=values.reduce((a,b)=>a+b,0)/values.length;rows[s.id].courseSeen=true;rows[s.id].sources.add('course');}
    }
    const academy=input.academy&&typeof input.academy==='object'?input.academy:{};
    const academyAttempts=Array.isArray(academy.sessionAttempts)?academy.sessionAttempts:[],itemMotifs=new Map();
    for(const a of academyAttempts){
      const motif=Number(a?.motif),ids=MOTIFS[motif]||[];if(!ids.length||typeof a?.correct!=='boolean')continue;
      if(typeof a.id==='string'&&a.id)itemMotifs.set(a.id,motif);
      const w=recency(a.at,now),context='practice:'+(a.session||a.id||dayBucket(a.at));
      for(const id of ids)add(rows[id],a.correct
        ?{positive:(a.assisted?.62:1.2)*w,clean:a.assisted?0:1.2*w,events:w,at:a.at,source:'academy',context}
        :{negative:1.28*w,events:w,at:a.at,source:'academy',context});
    }
    const duePracticeIds=[];
    for(const [itemId,review] of Object.entries(academy.reviews&&typeof academy.reviews==='object'?academy.reviews:{})){
      const motif=itemMotifs.get(itemId),ids=MOTIFS[motif]||[];
      if(!ids.length||!(Number(review?.due)>0&&Number(review.due)<=now))continue;
      duePracticeIds.push(itemId);
      for(const id of ids)add(rows[id],{events:0,duePractice:1,at:review.last,source:'academy-review',context:'practice:'+itemId});
    }
    for(const a of Array.isArray(academy.decisionAttempts)?academy.decisionAttempts:[]){
      const ids=signalSkills({label:a?.label||''});if(!ids.length)continue;
      const w=recency(a.at,now),out=String(a?.outcome||''),context='game:'+(a.gameId||a.key||dayBucket(a.at));
      for(const id of ids){
        if(['preferred','win','compared','correct'].includes(out))add(rows[id],{positive:1.05*w,clean:1.05*w,transfer:.9*w,events:w,at:a.at,source:'decision',context});
        else if(['danger','incorrect'].includes(out))add(rows[id],{negative:1.22*w,events:w,at:a.at,source:'decision',context});
        else if(out==='revealed')add(rows[id],{negative:.35*w,events:.45*w,at:a.at,source:'decision',context});
      }
    }
    const dueMistakeIds=[];
    for(const card of Array.isArray(input.mistakes)?input.mistakes:[]){
      const ids=signalSkills(card?.reference||{});if(!ids.length)continue;
      const stats=card.stats||{},created=Number(card.updated||card.created||card.source?.date)||0,cardId=String(card.id||'');
      const due=Number(stats.due)>0&&Number(stats.due)<=now;
      if(due&&cardId)dueMistakeIds.push(cardId);
      const successes=Math.max(0,Number(stats.successes)||0),lapses=Math.max(0,Number(stats.lapses)||0),assisted=Math.max(0,Number(stats.assisted)||0);
      const cleanSuccesses=Math.max(0,successes-assisted),base=recency(stats.last||created,now),context='mistake:'+(cardId||dayBucket(created));
      for(const id of ids){
        add(rows[id],{negative:.72*base,events:.72*base,at:created,dueMistake:due?1:0,source:'review',context,mistakeId:due?cardId:''});
        if(successes)add(rows[id],{positive:Math.min(8,successes)*.88*base,clean:Math.min(8,cleanSuccesses)*.72*base,transfer:Math.min(8,cleanSuccesses)*.58*base,events:Math.min(8,successes)*.7*base,at:stats.last,source:'recall',context});
        if(lapses)add(rows[id],{negative:Math.min(6,lapses)*1.05*base,events:Math.min(6,lapses)*.8*base,at:stats.last,source:'recall',context});
        if(assisted)add(rows[id],{negative:Math.min(6,assisted)*.18*base,events:Math.min(6,assisted)*.25*base,at:stats.last,source:'recall',context});
      }
    }
    const skills=SKILLS.map(s=>{
      const r=rows[s.id],den=r.positive+r.negative,accuracy=den?r.positive/den:0;
      const confidence=1-Math.exp(-Math.max(0,r.events)/4.5);
      const score=Math.round(clamp(r.course*35+accuracy*65*confidence,0,100)),contexts=r.contexts.size;
      const masteryReady=score>=82&&r.events>=5&&r.course>=.5&&r.cleanPositive>=2.5&&r.transferPositive>=.75&&contexts>=2;
      const state=masteryReady?'mastered':score>=68?'strong':score>=45?'developing':score>=15?'building':'new';
      const negativeRate=den?r.negative/den:0,due=r.dueMistakes+r.duePractice;
      return {
        id:s.id,title:s.title,group:s.group,chapters:[...s.chapters],prerequisites:[...s.prerequisites],
        score,state,course:Math.round(r.course*100),confidence:Math.round(confidence*100),
        evidence:Number(r.events.toFixed(2)),positive:Number(r.positive.toFixed(2)),negative:Number(r.negative.toFixed(2)),
        cleanEvidence:Number(r.cleanPositive.toFixed(2)),transferEvidence:Number(r.transferPositive.toFixed(2)),contexts,
        needsTransfer:score>=68&&r.transferPositive<.75,negativeRate:Number(negativeRate.toFixed(3)),
        due,dueMistakes:r.dueMistakes,duePractice:r.duePractice,mistakeIds:[...r.mistakeIds],lastAt:r.lastAt,sources:[...r.sources].sort(),
        practiceMotif:Object.hasOwn(PRACTICE_MOTIFS,s.id)?PRACTICE_MOTIFS[s.id]:null
      };
    });
    const skillMap=Object.fromEntries(skills.map(s=>[s.id,s]));
    const nextChapter=Array.from({length:14},(_,i)=>i+1).find(n=>(course[n]??0)<1)||14;
    function prescriptionFor(s){
      const chapter=s.chapters.slice().sort((a,b)=>(course[a]??0)-(course[b]??0)||a-b)[0],coverage=course[chapter]??0;
      let type;
      if(s.dueMistakes>0)type='mistakes';
      else if(s.duePractice>0&&s.practiceMotif!==null)type='practice';
      else if(coverage<.65)type='course';
      else if(s.needsTransfer)type='review';
      else if(s.practiceMotif!==null)type='practice';
      else type='course';
      const reason=s.dueMistakes>0
        ?s.dueMistakes+' due mistake position'+(s.dueMistakes===1?'':'s')
        :s.duePractice>0
          ?s.duePractice+' Academy review'+(s.duePractice===1?' is':'s are')+' due'
          :s.negativeRate>.45
            ?'Recent evidence shows repeated errors'
            :coverage<.65
              ?'Course coverage is still incomplete'
              :s.needsTransfer
                ?'Strong drill evidence still needs transfer from real-game decisions'
                :s.practiceMotif!==null
                  ?'Needs more clean unassisted retrieval'
                  :'Revisit this chapter in mixed positions';
      return {
        skillId:s.id,title:s.title,score:s.score,state:s.state,type,chapter,chapterTitle:CHAPTER_TITLES[chapter]||'Course',
        practiceMotif:s.practiceMotif,mistakeIds:[...s.mistakeIds],reason
      };
    }
    for(const s of skills){
      const prereqGap=s.prerequisites.reduce((sum,id)=>sum+Math.max(0,50-(skillMap[id]?.score||0)),0);
      const reachable=s.due>0||s.course>0||s.chapters.some(n=>n<=nextChapter+1)||s.prerequisites.every(id=>(skillMap[id]?.score||0)>=38);
      s.priority=reachable?Number((100-s.score+s.dueMistakes*9+s.duePractice*5+s.negativeRate*18+prereqGap*.14).toFixed(2)):-1;
      s.recommendation=prescriptionFor(s);
    }
    const ranked=skills.filter(s=>s.priority>=0&&s.state!=='mastered').sort((a,b)=>b.priority-a.priority||b.due-a.due||a.score-b.score||a.title.localeCompare(b.title));
    const focus=ranked[0]||skills.slice().sort((a,b)=>a.score-b.score)[0]||null;
    const prescriptions=ranked.slice(0,3).map(s=>({...s.recommendation}));
    const counts={mastered:0,strong:0,developing:0,building:0,new:0};
    for(const s of skills)counts[s.state]=(counts[s.state]||0)+1;
    const evidenced=skills.filter(s=>s.evidence>0||s.course>0);
    const average=evidenced.length?Math.round(evidenced.reduce((a,s)=>a+s.score,0)/evidenced.length):0;
    const uniqueMistakes=[...new Set(dueMistakeIds.filter(Boolean))],uniquePractice=[...new Set(duePracticeIds.filter(Boolean))];
    return {
      version:VERSION,generatedAt:now,skills,groups:GROUPS.map(g=>({...g})),focus,prescriptions,
      dueMistakeIds:uniqueMistakes,duePracticeIds:uniquePractice,
      summary:{...counts,total:skills.length,average,evidenced:evidenced.length,dueMistakes:uniqueMistakes.length,duePractice:uniquePractice.length,dueReviews:uniqueMistakes.length+uniquePractice.length,nextChapter,nextChapterTitle:CHAPTER_TITLES[nextChapter]}
    };
  }
  function chapterSummary(snapshot,chapter){
    const rows=(snapshot?.skills||[]).filter(s=>s.chapters.includes(Number(chapter)));
    if(!rows.length)return {chapter:Number(chapter),score:0,state:'new',skills:0};
    const score=Math.round(rows.reduce((a,s)=>a+s.score,0)/rows.length);
    const state=score>=82&&rows.some(s=>s.state==='mastered')?'mastered':score>=68?'strong':score>=45?'developing':score>=15?'building':'new';
    return {chapter:Number(chapter),score,state,skills:rows.length};
  }
  function reviewFocus(report){
    const tally={};
    for(const e of Array.isArray(report?.critical)?report.critical:[]){
      const ids=signalSkills(e);const severity=/losing move|blunder/i.test(e?.label||'')?3:/mistake|missed win/i.test(e?.label||'')?2:1;
      for(const id of ids)tally[id]=(tally[id]||0)+severity;
    }
    return Object.entries(tally).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([id,count])=>({id,title:BY_ID[id]?.title||id,count}));
  }
  return Object.freeze({VERSION,GROUPS,SKILLS,CHAPTER_TITLES,practiceMotif:id=>Object.hasOwn(PRACTICE_MOTIFS,id)?PRACTICE_MOTIFS[id]:null,skill:id=>BY_ID[id]||null,signalSkills,analyze,chapterSummary,reviewFocus});
});
