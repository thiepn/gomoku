/* E4 Bot Elo authority boundary. Reuses the existing verifiedAccount function
 * and service-role REST helper in gomoku-room. No user-supplied owner identifiers,
 * no alternative account/profile store, no client-authoritative settlement.
 *
 * Rating activation stays OFF until independently reviewed E3 calibration
 * is explicitly approved in a separate authorized release action.
 */
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
export async function handleBotRatingRequest(req:Request,parts:string[],s:Services):Promise<Response>{
  const {rest,verifiedAccount,enforceRequestLimit,json,fail,q}=s;
  await enforceRequestLimit(req,'bot-rating',50,300);
  const account=await verifiedAccount(req,true),owner=account.userId;
  if(parts[1]!=='bot-rating')return fail('Unknown bot rating endpoint.',404);
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
