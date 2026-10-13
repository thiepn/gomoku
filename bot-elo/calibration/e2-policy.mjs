/* E3 shared policy adapter for E2 and offline calibration.
 * This is configuration only: native-bot-engine.js remains the ONLY search engine.
 * Do not change e2.1 without a new policy ID and new calibration data.
 */
export const POLICY_ID='studio-native-search/e2.1';
export const POLICY_VERSION='e2.1';
export const RULE='renju-practice';
export const ENGINE_MODULE='supabase/functions/gomoku-room/native-bot-engine.js';
export const LEVELS=Object.freeze(['first','beg','club','mid','advanced','high','expert','maximum']);

export function snapshotForLevel(level) {
  if (!level || !LEVELS.includes(level.id) || level.nativeLevel!==level.id ||
      level.ratingStatus!=='uncalibrated' || level.ratedEnabled!==false)
    throw new Error('Only an existing, unrated native E2 bot may be calibrated.');
  const b=level.nativeBudget;
  if (!b || ![b.timeMs,b.maxDepth,b.width].every(Number.isFinite))
    throw new Error('Incomplete native E2 bot budget.');
  return Object.freeze({
    id:level.id, configurationVersion:level.configurationVersion,
    nativeLevel:level.nativeLevel, nativeBudget:Object.freeze({
      timeMs:b.timeMs,maxDepth:b.maxDepth,width:b.width}),
    engine:'original-studio-rules-engine', policy:POLICY_ID,
    ratingStatus:'uncalibrated',rated:false,verifiedServerMoves:true,
    searchBudgetMs:Math.min(1000,b.timeMs),
    policyVersion:POLICY_VERSION,colorPolicy:'selected',opening:'center-first'
  });
}

export function nativeSearchConfig(snapshot, serverSeed, ply) {
  if (!snapshot || snapshot.policy!==POLICY_ID || snapshot.policyVersion!==POLICY_VERSION ||
      !LEVELS.includes(snapshot.id) || !Number.isInteger(ply) || ply<0 || ply>226 ||
      !Number.isInteger(serverSeed) || serverSeed<0 || serverSeed>0xffffffff)
    throw new Error('Invalid pinned E2 bot search parameters.');
  const budget=snapshot.nativeBudget;
  if (!budget || !Number.isFinite(budget.maxDepth)||!Number.isFinite(budget.width))
    throw new Error('Invalid pinned E2 budget.');
  return {
    timeMs:Math.max(20,Math.min(1000,Number(snapshot.searchBudgetMs)||120)),
    maxDepth:Number(budget.maxDepth)||2,
    width:Number(budget.width)||10,
    randomPool:1,
    seed:((serverSeed^(ply*2654435761))>>>0)||17,
    style:'balanced'
  };
}
export function choosePinnedMove(engine,board,color,snapshot,serverSeed,ply) {
  if (!engine || typeof engine.chooseMove!=='function' ||
      !(board instanceof Int8Array) || board.length!==225 || ![1,2].includes(color))
    throw new Error('Missing canonical native search engine or valid position.');
  const config=nativeSearchConfig(snapshot,serverSeed,ply);
  const decision=engine.chooseMove(board,color,config);
  if (!Number.isInteger(decision?.move) || decision.move< -1 || decision.move>=225)
    throw new Error('Original engine returned an invalid candidate.');
  return {decision,config};
}
