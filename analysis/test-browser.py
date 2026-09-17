"""Analysis 2.0 interaction tests. Native IndexedDB checks run on an HTTP origin.
Offline set_content is only a local fallback and is reported as such, not persistence certification.
"""
from pathlib import Path
import os,json,time,traceback
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'analysis-test-output';OUT.mkdir(exist_ok=True)
HTML=(ROOT/'index.html').read_text();GAME=json.loads((ROOT/'review/fixture.json').read_text())
URL=os.environ.get('ANALYSIS_URL');checks=[];errors=[]
def check(name,ok=True):
 assert ok,name
 checks.append(name);print('PASS '+name,flush=True)
def ready(pg):pg.wait_for_function('window.GomokuReview?.version==="2.0.0" && window.GomokuTraining && window.GomokuMistakes',timeout=20000)
def load(ctx):
 pg=ctx.new_page();pg.on('pageerror',lambda e:errors.append(str(e)))
 if URL:pg.goto(URL,wait_until='domcontentloaded',timeout=45000)
 else:pg.set_content('<script>window.__reviewStore=new Map();Object.defineProperty(window,"localStorage",{configurable:true,value:{getItem:k=>window.__reviewStore.get(k)||null,setItem:(k,v)=>window.__reviewStore.set(k,String(v)),removeItem:k=>window.__reviewStore.delete(k),clear:()=>window.__reviewStore.clear()}});</script>'+HTML,wait_until='domcontentloaded')
 ready(pg);pg.wait_for_timeout(1200);pg.evaluate('document.querySelectorAll("dialog[open]").forEach(d=>d.close())');return pg
with sync_playwright() as p:
 exe=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium');browser=p.chromium.launch(executable_path=exe if Path(exe).exists() else None,headless=True,args=['--no-sandbox']);ctx=browser.new_context(viewport={'width':1440,'height':1000});pg=load(ctx)
 try:
  pg.evaluate('(g)=>GomokuStudio.importGame(g)',GAME);original=pg.evaluate('GomokuStudio.exportGame()');pg.evaluate('GomokuReview.open()')
  pg.wait_for_function('GomokuReview.state().results.every(Boolean)&&!GomokuReview.state().scanning',timeout=45000)
  s=pg.evaluate('GomokuReview.state()');stats=pg.evaluate('GomokuAnalysisRuntime.stats()')
  check('review exposes Analysis 2.0 instead of an unrelated new mode','Game review' in pg.locator('#grTitle').inner_text() and pg.evaluate('GomokuReview.workspaceVersion')=='2.1.0')
  check('one worker serves the initial whole-game analysis',stats['workersCreated']==1 and 10<=stats['completed']<=14)
  check('important human decisions receive an automatic second pass',s['results'][6]['budget']>=1000)
  check('both players retain move-by-move assessments',len(s['results'])==len(GAME['moves']))
  check('search metrics and per-candidate depths are retained',all('search' in r and 'analysisVersion' in r for r in s['results']))
  pg.evaluate('GomokuReview.select(7)');pg.locator('#rwOptions').click();pg.locator('#a2Preset').select_option('deep');pg.locator('#rwOptionsClose').click();pg.locator('#grDeeper').click();pg.wait_for_function('!GomokuReview.state().interacting',timeout=25000)
  s=pg.evaluate('GomokuReview.state()');r=s['results'][6]
  check('deep analysis uses the selected budget',r['budget']==2400)
  check('the actual losing continuation has a retained refutation',bool(r.get('refutation')))
  check('proof and provisional assessment remain distinct','alone does not establish' in r['explanation']['why'])
  pg.screenshot(path=str(OUT/'01-review-desktop.png'))
  pg.locator('#a2Refutation').click();pg.wait_for_function('GomokuReview.state().mode==="proof"',timeout=20000)
  check('proof is independently verified before the viewer opens','VERIFIED THREAT PROOF' in pg.locator('#grModeLabel').inner_text())
  check('proof starts from the after-move position',pg.evaluate('GomokuReview.state().proof.index')==-1 and pg.locator('[data-point="111"]').get_attribute('data-stone')=='1')
  pg.locator('#a2ProofNext').click();check('proof advances a real attacking move',pg.evaluate('GomokuReview.state().proof.index')==0)
  pg.screenshot(path=str(OUT/'02-verified-threat.png'))
  check('desktop proof controls leave the full board visible',pg.locator('#grBoard').bounding_box()['y']>=0 and pg.locator('#grBoard').bounding_box()['y']+pg.locator('#grBoard').bounding_box()['height']<=1000 and pg.locator('#a2ProofNext').is_visible())
  pg.set_viewport_size({'width':390,'height':900});pg.wait_for_timeout(150);pg.screenshot(path=str(OUT/'02-proof-mobile.png'))
  check('mobile proof keeps its board and next-step control in the viewport',pg.locator('#grBoard').bounding_box()['y']>=0 and pg.locator('#a2ProofNext').bounding_box()['y']+pg.locator('#a2ProofNext').bounding_box()['height']<=900)
  pg.set_viewport_size({'width':1440,'height':1000})
  pg.locator('#a2ProofNext').click();pg.locator('#a2ProofNext').click()
  check('proof stops after its terminal step',pg.locator('#a2ProofNext').is_disabled())
  pg.locator('#a2ProofPrev').click();check('proof can step backward',pg.evaluate('GomokuReview.state().proof.index')==1)
  pg.locator('#grReturn').click();check('return restores the exact original decision',pg.evaluate('GomokuReview.state().mode==="game"&&GomokuReview.state().index===6'))
  pg.locator('#rwOptions').click();pg.locator('#a2Overlays').uncheck();check('optional board markers turn off',pg.locator('#grBoard .gr-suggested').count()==0 and pg.locator('#grBoard .gr-threat').count()==0);pg.locator('#a2Overlays').check();pg.locator('#rwOptionsClose').click()
  pg.locator('#rwOptions').click();pg.locator('#a2Preset').select_option('quick');pg.locator('#rwOptionsClose').click();pg.locator('#grDeeper').click();check('lower budget cannot overwrite deeper saved evidence',pg.evaluate('GomokuReview.state().results[6].budget')==2400)
  pg.locator('#rwOptions').click();pg.locator('#a2Preset').select_option('maximum');pg.locator('#rwOptionsClose').click();pg.locator('#grDeeper').click();pg.wait_for_timeout(40);pg.locator('#grPause').click();check('Maximum search is interruptible',not pg.evaluate('GomokuAnalysisRuntime.stats().busy'))
  pg.locator('#rwOptions').click();pg.locator('#a2Preset').select_option('deep');pg.locator('#rwOptionsClose').click();pg.evaluate('GomokuReview.select(8)');pg.locator('#a2BestProof').click();pg.wait_for_function('GomokuReview.state().mode==="proof"',timeout=20000);check('winning alternative also has a proof entry',pg.locator('#a2ProofTitle').inner_text()=='Why the best move wins');pg.locator('#grReturn').click()
  # Same options twice: the second request uses the exact-position cache.
  reuse=pg.evaluate('''async()=>{GomokuReview.pause();const p=GomokuReview.state().positions[4],o={timeMs:450,preset:'quick',context:p.context};const a=await GomokuAnalysisRuntime.request(p.board,p.color,'freestyle',p.played,o),b=await GomokuAnalysisRuntime.request(p.board,p.color,'freestyle',p.played,o);return {a:a.cacheHit,b:b.cacheHit,key:a.positionId===b.positionId};}''')
  check('identical analysis options reuse cached evidence',reuse['b'] and reuse['key'])
  pg.evaluate('GomokuReview.select(7);GomokuReview.saveMistakes()');cards=pg.evaluate('GomokuMistakes.list()');card=next(c for c in cards if c['source']['ply']==7)
  check('review saves real actionable human positions only',len(cards)>0 and all(c['color']==1 and c['board'][c['played']]==0 for c in cards))
  check('already-lost moves are excluded from mistake practice',not any(c['source']['ply']==9 for c in cards))
  if URL:check('practice storage uses native IndexedDB',pg.evaluate('GomokuMistakes.status().persistent'))
  else:check('unavailable native storage is explicitly reported',not pg.evaluate('GomokuMistakes.status().persistent'))
  pg.evaluate('(id)=>GomokuTraining.open({ids:[id]})',card['id']);pg.wait_for_function('GomokuTraining.state()?.card&&!GomokuTraining.state().busy',timeout=20000)
  check('training opens on a separate board without importing a new match',pg.locator('#a2Trainer').is_visible() and pg.locator('#grDialog').is_visible())
  check('training initially conceals solutions and candidates',pg.locator('#a2TrainingVerdict').inner_text()=='Find your move' and pg.locator('#a2TrainingBoard .gr-suggested').count()==0 and 'No answer markers' in pg.locator('#a2TrainingWhy').inner_text())
  check('training rechecks the original position before the attempt',pg.locator('#a2TrainingFeedback').inner_text().startswith('Position checked'))
  pg.screenshot(path=str(OUT/'03-training-question.png'))
  pg.locator(f'[data-a2-point="{card["reference"]["best"]}"]').click();pg.wait_for_function('!!GomokuTraining.state().attempt?.verdict&&!GomokuTraining.state().busy',timeout=20000)
  tr=pg.evaluate('GomokuTraining.state()');check('a supported alternative is graded by fresh analysis',tr['attempt']['verdict']['status']=='correct' and tr['attempt']['result']['played']==card['reference']['best'])
  check('unassisted success is persisted with a future recall date',tr['card']['stats']['successes']==1 and tr['card']['stats']['attempts']==1 and tr['card']['stats']['due']>time.time()*1000)
  pg.screenshot(path=str(OUT/'04-training-feedback.png'))
  pg.locator('#a2TrainingReset').click();pg.locator(f'[data-a2-point="{card["reference"]["best"]}"]').click();pg.wait_for_function('!!GomokuTraining.state().attempt?.verdict&&!GomokuTraining.state().busy',timeout=20000)
  check('repeated attempts in one session do not inflate recall history',pg.evaluate('GomokuTraining.state().card.stats.attempts')==1)
  pg.locator('#a2TrainingClose').click();check('closing training restores review, not live-game corruption',pg.locator('#grDialog').is_visible() and pg.evaluate('GomokuTraining.state()===null'))
  pg.evaluate('(id)=>GomokuTraining.open({ids:[id]})',card['id']);pg.wait_for_function('!GomokuTraining.state().busy',timeout=20000);pg.locator('#a2TrainingHint').click();check('hints mark an attempt as assisted',pg.evaluate('GomokuTraining.state().assisted'))
  pg.locator('#a2TrainingSolution').click();pg.wait_for_function('!!GomokuTraining.state().attempt?.verdict&&!GomokuTraining.state().busy',timeout=20000)
  tr=pg.evaluate('GomokuTraining.state()');check('hinted correct answer does not count as an unassisted recall',tr['card']['stats']['assisted']==1 and tr['card']['stats']['successes']==1)
  pg.locator('#a2TrainingFilter').select_option('due');check('due filter does not label future positions as due',pg.locator('#a2TrainingList').get_by_text('Move 7',exact=False).count()==0);pg.locator('#a2TrainingFilter').select_option('all');check('future-due positions remain freely selectable',pg.locator('#a2TrainingList [data-a2-card]').count()>0)
  pg.locator('[data-a2-point="112"]').focus();pg.keyboard.press('ArrowRight');check('training board has coordinate keyboard navigation',pg.evaluate('document.activeElement.dataset.a2Point')=='113')
  for width in [390,360,768]:
   pg.set_viewport_size({'width':width,'height':900});pg.wait_for_timeout(160)
   check(f'training at {width}px has no document overflow',pg.evaluate('document.documentElement.scrollWidth<=innerWidth+2'))
   check(f'training at {width}px has an accessible exit',pg.locator('#a2TrainingClose').is_visible())
   pg.screenshot(path=str(OUT/f'05-training-{width}.png'))
  pg.set_viewport_size({'width':1440,'height':1000})
  export=pg.evaluate('GomokuMistakes.exportData()');(OUT/'practice-export.json').write_text(json.dumps(export,indent=2))
  check('library export includes position, evidence and recall history',export['version']==2 and any(c['stats']['successes']==1 for c in export['cards']))
  before=pg.evaluate('GomokuMistakes.list()');pg.evaluate('(x)=>GomokuMistakes.importData(x)',export);after=pg.evaluate('GomokuMistakes.list()');check('reimport preserves existing local history and deduplicates positions',len(before)==len(after) and [c['stats'] for c in before]==[c['stats'] for c in after])
  rejected=pg.evaluate('''async x=>{x.cards[0].board[0]=3;try{await GomokuMistakes.importData(x);return false;}catch{return true;}}''',export);check('malformed imports fail atomically',rejected and pg.evaluate('GomokuMistakes.list()')==after)
  pg.locator('#a2TrainingClose').click();pg.evaluate('GomokuReview.close();GomokuReview.open()');pg.wait_for_timeout(150)
  check('deep analysis survives review close and reopen',pg.evaluate('GomokuReview.state().results[6].budget')==2400)
  check('original recorded moves and study tree are unchanged',pg.evaluate('GomokuStudio.exportGame().moves')==original['moves'] and pg.evaluate('GomokuStudio.exportGame().studio.tree')==original['studio']['tree'])
  if URL:
   other=load(ctx);other_cards=other.evaluate('GomokuMistakes.list()');check('practice survives a fresh document on the real origin',len(other_cards)==len(after) and any(c['stats']['successes']==1 for c in other_cards))
   # Two overlapping read-modify-writes, serialized by IndexedDB transactions.
   pg.evaluate('(id)=>{window.a2Tx=GomokuMistakes.record(id,{status:"incorrect",assisted:false},"cross-tab-one")}',card['id'])
   other.evaluate('(id)=>GomokuMistakes.record(id,{status:"incorrect",assisted:false},"cross-tab-two")',card['id']);pg.evaluate('window.a2Tx')
   stored=other.evaluate('(id)=>GomokuMistakes.list().then(xs=>xs.find(x=>x.id===id))',card['id'])
   check('cross-tab writes preserve both independent recall events',stored['stats']['attempts']==4 and {e['id'] for e in stored['events']}.issuperset({'cross-tab-one','cross-tab-two'}));other.close()
  pg.evaluate('GomokuReview.close()');pg.evaluate('(id)=>GomokuTraining.open({ids:[id]})',card['id']);pg.wait_for_function('!GomokuTraining.state().busy',timeout=20000);pg.evaluate('GomokuTraining.close()')
  check('library can be opened and exited outside review safely',pg.evaluate('GomokuTraining.state()===null') and pg.evaluate('GomokuStudio.exportGame().moves')==original['moves'])
  check('no uncaught browser errors',not errors)
 except Exception:
  pg.screenshot(path=str(OUT/'FAILURE.png'),full_page=True)
  (OUT/'failure.txt').write_text(traceback.format_exc()+'\n'+str(errors)+'\n'+pg.locator('body').inner_text()[-15000:]);raise
 finally:
  (OUT/'browser-report.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'errors':errors,'origin':URL or 'set_content; localStorage emulated, native IndexedDB unavailable','nativePersistenceTested':bool(URL)},indent=2));browser.close()
print(str(len(checks))+' Analysis 2.0 browser checks passed',flush=True)
