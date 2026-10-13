/* Bot Elo E1: deterministic hypothetical calculations ONLY; never an authority for match settlement. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.GomokuBotEloE1=api;})(typeof globalThis==='object'?globalThis:null,function(){
'use strict';
const VERSION='bot-elo-e1/1.0.0',RULE='renju-practice',INITIAL=1200,MIN=400,SCALE=400,GAP=400;
const PLACEMENT=10,PROVISIONAL=20,ESTABLISHED=100;
const K=Object.freeze({provisional:40,regular:24,established:16});
// IDs, labels, search budgets mirror createStudioData().levels in index.html.
// Rating targets are hypothetical design anchors; NONE has been measured or approved.
const rows=[
 ['first','Beginner',120,2,10,500],['beg','Casual',200,3,10,800],
 ['club','Club',330,4,11,1100],['mid','Tactical',540,5,12,1400],
 ['advanced','Advanced',850,6,14,1700],['high','Challenging',1350,7,16,2000],
 ['expert','Expert',2150,8,18,2300],['maximum','Master',3400,10,22,2600]
];
const BOTS=Object.freeze(rows.map(([id,label,timeMs,maxDepth,width,ratingTarget],index)=>Object.freeze({
 id,label,order:index+1,nativeLevel:id,ruleset:RULE,
 nativeBudget:Object.freeze({timeMs,maxDepth,width}),aiPolicy:'human-v11.3',
 configurationVersion:'studio-12.1.0',ratingTarget,ratingStatus:'uncalibrated',
 calibrationGames:0,ratingUncertainty:null,ratedEnabled:false
})));
const BY_ID=Object.freeze(Object.fromEntries(BOTS.map(x=>[x.id,x])));
const CONFIG=Object.freeze({version:VERSION,ruleset:RULE,initialRating:INITIAL,minimumRating:MIN,
 scale:SCALE,farmingGap:GAP,placementGames:PLACEMENT,provisionalGames:PROVISIONAL,
 establishedGames:ESTABLISHED,kFactors:K,colorAdjustment:0,ratedBackendAvailable:false});
function normalizeProfile(raw={}){
 if(!raw||typeof raw!=='object')throw new TypeError('Invalid profile');
 const rating=raw.rating===undefined?INITIAL:Number(raw.rating),games=raw.games===undefined?0:Number(raw.games);
 if(!Number.isFinite(rating)||rating<MIN||rating>10000||!Number.isInteger(games)||games<0||games>10000000)throw new RangeError('Invalid simulated rating or games');
 const wins=raw.wins===undefined?0:Number(raw.wins),draws=raw.draws===undefined?0:Number(raw.draws),losses=raw.losses===undefined?0:Number(raw.losses);
 if(![wins,draws,losses].every(n=>Number.isInteger(n)&&n>=0)||wins+draws+losses>games)throw new RangeError('Invalid simulated results');
 return Object.freeze({rating:Math.round(rating*1000)/1000,games,wins,draws,losses,
  placementRemaining:Math.max(0,PLACEMENT-games),provisional:games<PROVISIONAL});
}
function phase(raw){const p=normalizeProfile(raw);return p.games<PLACEMENT?'placement':p.games<PROVISIONAL?'provisional':p.games<ESTABLISHED?'regular':'established';}
function kFactor(raw){const p=normalizeProfile(raw);return p.games<PROVISIONAL?40:p.games<ESTABLISHED?24:16;}
function getBot(id){return BY_ID[String(id)]||null;}
function expectedScore(player,bot,adjustment=0){
 if(![player,bot,adjustment].every(Number.isFinite))throw new RangeError('Ratings must be finite');
 return 1/(1+10**((bot-player-adjustment)/SCALE));
}
function delta(k,e,s){if(![0,0.5,1].includes(s))throw new RangeError('Invalid score');return Math.round(k*(s-e)*1000)/1000;}
function inspect(input={}){
 const profile=normalizeProfile(input.profile||{}),bot=getBot(input.level),k=kFactor(profile);
 const expected=bot?expectedScore(profile.rating,bot.ratingTarget):null;
 const points=bot?Object.freeze({win:delta(k,expected,1),draw:delta(k,expected,.5),loss:delta(k,expected,0)}):null;
 const reasons=[];
 if(!bot)reasons.push('Unknown engine difficulty');
 if((input.mode||'ai')!=='ai')reasons.push('Only computer matches qualify');
 if((input.ruleset||RULE)!==RULE)reasons.push('Unrated ruleset');
 if((input.opening||'empty')!=='empty')reasons.push('Teaching starts are practice only');
 if((input.style||'balanced')!=='balanced')reasons.push('Fixed balanced personality required');
 if(input.assisted===true)reasons.push('Assisted games are practice only');
 if(bot&&profile.rating-bot.ratingTarget>=GAP)reasons.push('Player is 400+ above this bot');
 // Decide eligibility before play: do not truncate wins but retain full losses.
 if(bot&&profile.rating+points.win>bot.ratingTarget+GAP+0.0000001)reasons.push('A win would exceed this bot rating ceiling');
 return Object.freeze({version:VERSION,bot,profile,phase:phase(profile),k,expected,points,
  hypotheticalEligible:!reasons.length,ratedEligible:false,ratedAvailable:false,
  ceiling:bot?bot.ratingTarget+GAP:null,reasons:Object.freeze(reasons),
  notice:'E1 simulation only. No calibrated ratings, trusted matches or account rating writes.'});
}
function project(input={},outcome='win'){
 if(!['win','draw','loss'].includes(outcome))throw new RangeError('Invalid outcome');
 const p=inspect(input);if(!p.hypotheticalEligible)return Object.freeze({eligible:false,delta:0,rating:p.profile.rating,reason:p.reasons.join('; ')});
 const next=Math.max(MIN,Math.round((p.profile.rating+p.points[outcome])*1000)/1000);
 return Object.freeze({eligible:true,simulated:true,authoritative:false,rating:next,
  delta:Math.round((next-p.profile.rating)*1000)/1000,outcome});
}
function suggest(raw){const p=normalizeProfile(raw);return BOTS.slice().sort((a,b)=>Math.abs(a.ratingTarget-p.rating-100)-Math.abs(b.ratingTarget-p.rating-100))[0];}
function checkRegistry(nativeLevels){const keys=nativeLevels&&typeof nativeLevels==='object'?Object.keys(nativeLevels):[];
 const missing=BOTS.filter(b=>!keys.includes(b.id)).map(b=>b.id),extra=keys.filter(x=>!BY_ID[x]);
 return Object.freeze({ok:!missing.length&&!extra.length,missing,extra});}
return Object.freeze({VERSION,CONFIG,BOTS,getBot,normalizeProfile,phase,kFactor,expectedScore,delta,inspect,project,suggest,checkRegistry});
});
