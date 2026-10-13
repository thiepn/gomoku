/* E4 Bot Elo authority boundary. Reuses the existing verifiedAccount function
 * and service-role REST helper in gomoku-room. No user-supplied owner identifiers,
 * no alternative account/profile store, no client-authoritative settlement.
 *
 * Rating activation stays OFF until independently reviewed E3 calibration
 * is explicitly approved in a separate authorized release action.
 */
import '../../../bot-elo/rating.js';

type Services={
  rest:(path:string,init?:{method?:string,body?:unknown,prefer?:string})=>Promise<any>,
  verifiedAccount:(req:Request,required?:boolean)=>Promise<any>,
  enforceRequestLimit:(req:Request,scope:string,limit:number,window:number)=>Promise<any>,
  json:(data:unknown,status?:number)=>Response,
  fail:(reason:string,status?:number)=>Response,
  q:(raw:string)=>string
};
const RULE='renju-practice',POLICY='studio-native-search/e2.1';
const ADMISSION_SCHEMA='bot-elo-admission/v1';
const SCORE_GAMES=10,PROVISIONAL_GAMES=20,ESTABLISHED_GAMES=100;
const millipoints=(x:unknown)=>Number.isSafeInteger(Number(x))?Number(x)/1000:null;
function safeProfile(row:any){
  if(!row)return {
    state:'not-initialized',rating:null,peakRating:null,ratedGames:0,
    wins:0,draws:0,losses:0,placementRemaining:SCORE_GAMES,
    provisional:true,phase:'not-started',lastPlayedAt:null
  };
  const games=Math.max(0,Number(row.rated_games)||0);
  return {
    state:'initialized',rating:millipoints(row.rating_milli),
    peakRating:millipoints(row.peak_rating_milli),
    ratedGames:games,wins:Number(row.wins)||0,draws:Number(row.draws)||0,
    losses:Number(row.losses)||0,placementRemaining:Math.max(0,SCORE_GAMES-games),
    provisional:games<PROVISIONAL_GAMES,
    phase:games<SCORE_GAMES?'placement':games<PROVISIONAL_GAMES?'provisional':
      games<ESTABLISHED_GAMES?'regular':'established',
    lastReleaseId:row.last_release_id||null,lastPlayedAt:row.last_played_at||null
  };
}
function safeEvent(row:any){
  return {id:row.event_id,matchId:row.match_id,botId:row.bot_id,
    releaseId:row.release_id,policy:row.policy_id,score:Number(row.score),
    ratingBefore:millipoints(row.rating_before_milli),
    botRating:millipoints(row.bot_rating_milli),
    expectedScore:Number(row.expected_score),kFactor:Number(row.k_factor),
    delta:millipoints(row.delta_milli),
    ratingAfter:millipoints(row.rating_after_milli),
    gameNumber:Number(row.game_number),completedAt:row.completed_at,
    appliedAt:row.applied_at};
}
function admissionView(admission:any,status:string,settledAt:unknown){
  const a=admission&&typeof admission==='object'?admission:{};
  const rated=a.schema===ADMISSION_SCHEMA&&a.rated===true;
  return {
    admitted:rated,eligible:rated,
    state:rated?(settledAt?'settled':status==='active'?'awaiting-result':'pending-settlement'):'practice-only',
    reason:String(a.reason||'not-activated'),
    releaseId:rated?String(a.releaseId||''):null,
    ratingBefore:rated?millipoints(a.ratingBeforeMilli):null,
    botRating:rated?millipoints(a.botRatingMilli):null,
    kFactor:rated?Number(a.kFactor):null,
    previewOnly:!rated // E1 previews and E2 practice cannot issue actual Elo.
  };
}
export function publicMatchRating(row:any){
  return admissionView(row?.rating_admission,row?.status,row?.rating_settled_at);
}
export async function prepareBotRatingAdmission(rest:Services['rest'],owner:string,botId:string){
  const result=await rest('rpc/gomoku_bot_e4_prepare_admission',{
    method:'POST',body:{p_owner:owner,p_bot_id:botId,p_ruleset:RULE,p_policy:POLICY}});
  if(!result||result.schema!==ADMISSION_SCHEMA||typeof result.rated!=='boolean')
    throw new Error('Bot rating authority returned an invalid admission.');
  if(result.rated===true&&(!result.releaseId||!Number.isSafeInteger(Number(result.ratingBeforeMilli))))
    throw new Error('Bot rating authority returned an unapproved rated admission.');
  return result;
}
export async function settleBotRatingMatch(rest:Services['rest'],owner:string,matchId:string){
  const result=await rest('rpc/gomoku_bot_e4_settle',{
    method:'POST',body:{p_owner:owner,p_match:matchId}});
  if(!result||typeof result.status!=='string'||typeof result.settled!=='boolean')
    throw new Error('Bot Elo settlement authority did not return a valid status.');
  return result;
}
async function recoverOwner(rest:Services['rest'],q:Services['q'],owner:string,limit:number){
  // Owner-filter first. The DB RPC rechecks ownership, admission, result and release;
  // only completed sessions with a pending settlement can be retried.
  const rows=await rest('gomoku_bot_matches?owner_user_id=eq.'+q(owner)+
    '&status=in.(completed,resigned)&rating_settled_at=is.null'+
    '&select=id,rating_admission&order=completed_at.asc&limit=50');
  const outstanding=(Array.isArray(rows)?rows:[]).filter((r:any)=>
    r.rating_admission?.schema===ADMISSION_SCHEMA&&r.rating_admission?.rated===true
  ).slice(0,limit);
  let settled=0,pending=0;
  const errors:any[]=[];
  for(const row of outstanding){
    try{const result=await settleBotRatingMatch(rest,owner,row.id);
      if(result.settled)settled++;else pending++;
    }catch(e){pending++;errors.push({matchId:row.id,status:'retry-required'});}
  }
  return {retried:outstanding.length,settled,pending,errors,
    note:'Only server-verified, pre-admitted matches can settle. This does not authorize provisional E3 candidates.'};
}
/* E5: owner-scoped, READ-ONLY opponent previews. Real rating is determined by
 * E4 pre-match admission and PostgreSQL settlement, NEVER this presentation.
 * Both UI and backend use E1's canonical Elo expectation/delta functions.
 */
async function opponentChoices(rest:Services['rest'],q:Services['q'],owner:string){
  const E=(globalThis as any).GomokuBotEloE1;
  if(!E?.BOTS||!E?.expectedScore||!E?.delta)
    throw new Error('Canonical Bot Elo scoring module unavailable.');
  const [controls,profiles]=await Promise.all([
    rest('gomoku_bot_rating_controls?singleton=eq.true&select=enabled,active_release_id'),
    rest('gomoku_bot_rating_profiles?owner_user_id=eq.'+q(owner)+
      '&ruleset=eq.'+RULE+'&select=*')
  ]);
  const ctl=Array.isArray(controls)?controls[0]:null;
  const profile=Array.isArray(profiles)?profiles[0]:null;
  const active=ctl?.enabled===true&&typeof ctl.active_release_id==='string'&&!!ctl.active_release_id;
  let release:any=null,releaseValid=false,pending=false;
  if(active){
    const rows=await rest('gomoku_bot_rating_releases?release_id=eq.'+q(ctl.active_release_id)+
      '&select=release_id,policy_id,ruleset,calibration_complete,bot_ratings_milli,approved_manifest_sha256,reviewer,review_rationale');
    release=Array.isArray(rows)?rows[0]:null;
    releaseValid=!!release&&release.policy_id===POLICY&&release.ruleset===RULE&&
      release.calibration_complete===true&&
      /^[0-9a-f]{64}$/.test(String(release.approved_manifest_sha256||''))&&
      String(release.reviewer||'').trim().length>=3&&
      String(release.review_rationale||'').trim().length>=80&&
      E.BOTS.every((b:any)=>{
        const raw=release.bot_ratings_milli?.[b.id];
        return typeof raw==='number'&&Number.isSafeInteger(raw)&&raw>=400000&&raw<=6000000;
      });
    if(releaseValid){
      const unfinished=await rest('gomoku_bot_matches?owner_user_id=eq.'+q(owner)+
        '&status=in.(completed,resigned)&rating_settled_at=is.null&select=id,rating_admission&limit=50');
      pending=Array.isArray(unfinished)&&unfinished.some((r:any)=>
        r.rating_admission?.schema===ADMISSION_SCHEMA&&r.rating_admission?.rated===true);
    }
  }
  const games=Math.max(0,Number(profile?.rated_games)||0);
  const playerMilli=profile?Number(profile.rating_milli):1200000;
  if(!Number.isSafeInteger(playerMilli)||playerMilli<400000||playerMilli>10000000)
    throw new Error('Invalid owner rating from authoritative profile.');
  const playerRating=playerMilli/1000;
  const k=games<20?40:games<100?24:16;
  const opponents=E.BOTS.map((bot:any)=>{
    let reason='calibration-not-activated';
    if(active&&!releaseValid)reason='calibration-release-not-verified';
    const ratingMilli=releaseValid?Number(release.bot_ratings_milli[bot.id]):null;
    const official=ratingMilli!==null?ratingMilli/1000:null;
    let expected=null,changes=null,eligible=false,ceiling=null;
    if(releaseValid){
      expected=E.expectedScore(playerRating,official);
      changes={win:E.delta(k,expected,1),draw:E.delta(k,expected,0.5),
        loss:E.delta(k,expected,0)};
      ceiling=official+400;
      if(pending)reason='earlier-rated-game-awaits-settlement';
      else if(playerMilli-ratingMilli>=400000)reason='opponent-below-eligibility';
      else if(playerMilli+Math.round(1000*changes.win)>ratingMilli+400000)
        reason='win-would-exceed-ceiling';
      else {eligible=true;reason='potentially-eligible';}
    }
    return {id:bot.id,label:bot.label,nativeOrder:bot.order,policy:POLICY,
      measuredRating:official,ratingStatus:releaseValid?'reviewed-calibrated':'uncalibrated',
      ratedEligible:eligible,expectedScore:expected,changes,kFactor:releaseValid?k:null,
      ceiling,reason,eligibilityBinding:false,
      note:'Indicative only: the E4 database admission locks eligibility at match creation.'};
  });
  return {version:'bot-elo-opponents/e5.1',ruleset:RULE,source:'gomoku-room-account-authority',
    verifiedForOwner:true,player:{
      initialized:!!profile,rating:profile?playerRating:null,
      games,phase:games<10?'placement':games<20?'provisional':games<100?'regular':'established',
      placementRemaining:Math.max(0,10-games)},
    availability:{ratedEnabled:releaseValid&&active,releaseId:releaseValid?release.release_id:null,
      reason:releaseValid?'reviewed-calibration-active':active?
        'calibration-release-not-verified':'calibration-not-activated'},
    opponents,notice:'No rating is awarded by a preview; only a completed, verified, pre-admitted match may settle.'};
}

export async function handleBotRatingRequest(req:Request,parts:string[],s:Services):Promise<Response>{
  const {rest,verifiedAccount,enforceRequestLimit,json,fail,q}=s;
  await enforceRequestLimit(req,'bot-rating',50,300);
  const account=await verifiedAccount(req,true),owner=account.userId;
  if(parts[1]!=='bot-rating')return fail('Unknown bot rating endpoint.',404);
  if(parts[2]==='opponents'&&req.method==='GET'&&parts.length===3)
    return json(await opponentChoices(rest,q,owner));
  if(parts[2]==='me'&&req.method==='GET'&&parts.length===3){
    const [profiles,controls]=await Promise.all([
      rest('gomoku_bot_rating_profiles?owner_user_id=eq.'+q(owner)+
        '&ruleset=eq.'+RULE+'&select=*'),
      rest('gomoku_bot_rating_controls?singleton=eq.true&select=enabled,active_release_id')
    ]);
    const ctl=Array.isArray(controls)?controls[0]:null,active=ctl?.enabled===true&&
      typeof ctl.active_release_id==='string'&&!!ctl.active_release_id;
    return json({mode:'bot-elo',ruleset:RULE,profile:safeProfile(
      Array.isArray(profiles)?profiles[0]:null),
      availability:{newRatedMatches:active,calibrationRelease:active?ctl.active_release_id:null,
        reason:active?'verified-release-active':'calibration-not-activated'},
      ratingAuthority:'server-only',separateFromPvP:true,
      caveat:'Uncalibrated E1 bot targets and E3 calibration candidates do not create Elo.'});
  }
  if(parts[2]==='history'&&req.method==='GET'&&parts.length===3){
    const rows=await rest('gomoku_bot_rating_events?owner_user_id=eq.'+q(owner)+
      '&select=*&order=applied_at.desc&limit=50');
    return json({events:(Array.isArray(rows)?rows:[]).map(safeEvent),separateFromPvP:true,
      note:'Immutable authenticated Bot Elo events, separate from human PvP.'});
  }
  if(parts[2]==='recover'&&req.method==='POST'&&parts.length===3)
    return json(await recoverOwner(rest,q,owner,10));
  return fail('Bot rating route not found.',404);
}
