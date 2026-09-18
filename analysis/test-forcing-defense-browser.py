"""Actual Worker/UI regression for the reported Renju position and cache upgrade.
Use ANALYSIS_URL for real-origin persistence. set_content is an explicit local
fallback: it does not certify native IndexedDB, service workers, or real phones.
"""
from pathlib import Path
import json, os, traceback
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'analysis-test-output';OUT.mkdir(exist_ok=True)
F=json.loads((ROOT/'analysis/fixtures/renju-move40.json').read_text())
ix=lambda s:(15-int(s[1:]))*15+'ABCDEFGHJKLMNOP'.index(s[0])
DEF=[ix(s) for s in F['localDefenses']];BAD=ix('J6');PLAYED=ix('E14')
GAME=json.loads((ROOT/'review/fixture.json').read_text())
GAME.update(mode='study',variant=F['rule'],initial=[{'i':i,'color':v} for i,v in enumerate(F['board']) if v],startColor=2,humanColor=2,renjuCenterRule=True,moves=[{'i':PLAYED,'color':2}],gameId='renju-move40-regression',title='Renju move 40 forcing defense')
URL=os.environ.get('ANALYSIS_URL');checks=[];errors=[]
MOCK="""<script>const store=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k),clear:()=>store.clear()}});</script>"""
def check(name,ok=True):
 assert ok,name
 checks.append(name);print('PASS '+name,flush=True)
with sync_playwright() as pw:
 exe=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium')
 browser=pw.chromium.launch(executable_path=exe if Path(exe).exists() else None,headless=True,args=['--no-sandbox'])
 ctx=browser.new_context(viewport={'width':1440,'height':1000});pg=ctx.new_page();pg.on('pageerror',lambda e:errors.append(str(e)))
 try:
  if URL:pg.goto(URL,wait_until='domcontentloaded',timeout=45000)
  else:pg.set_content(MOCK+(ROOT/'index.html').read_text(),wait_until='domcontentloaded')
  pg.wait_for_function('window.GomokuReview?.version === "2.1.0" && window.GomokuMistakes',timeout=20000)
  pg.wait_for_timeout(1000)
  pg.evaluate('(g)=>{document.querySelectorAll("dialog[open]").forEach(d=>d.close());GomokuStudio.importGame(g);GomokuReview.open({ply:1});}',GAME)
  pg.wait_for_function('GomokuReview.state()?.results.every(Boolean)&&!GomokuReview.state().scanning',timeout=30000)
  pg.evaluate('GomokuReview.pause()')
  r=pg.evaluate('GomokuReview.state().results[0]');original=pg.evaluate('GomokuStudio.exportGame()')
  check('real analysis Worker returns 2.1 evidence',r['analysisVersion']=='2.1.0' and pg.evaluate('GomokuAnalysisRuntime.version')=='2.1.0')
  check('the recorded E14 is defensive, not a positional inaccuracy',r['label'] in ['Defensive move','Best found'] and r['basis']=='verified-defense' and 'four–three' in r['explanation']['why'])
  check('all five local defenses survive full Worker serialization',all(i in [c['i'] for c in r['candidates']] for i in DEF) and r['best'] in DEF)
  check('best card distinguishes a defensive candidate from a proven win',pg.locator('#rwBestHeading').inner_text()=='Defensive candidate' and pg.locator('#rwBestGrade').inner_text() in ['Stops the known attack','You found it'])
  check('J6 is not offered as the best move',pg.locator('#rwBestCoord').inner_text()!='J6')
  pg.locator('#rwTabAnalysis').click();pg.locator(f'[data-point="{BAD}"]').click()
  pg.wait_for_function('GomokuReview.state().branch?.last && !GomokuReview.state().interacting',timeout=25000)
  last=pg.evaluate('GomokuReview.state().branch.last')
  check('testing J6 obtains an actual-position losing certificate',last['label']=='Losing move' and last['refutation']['proof']['move']==ix('B11') and last['refutation']['position'][BAD]==2)
  check('a losing variation cannot masquerade as a verified best-move win',last['bestProof'] is None and not pg.locator('#a2BestProof').is_visible() and pg.locator('#a2Refutation').is_visible())
  pg.locator('#a2Refutation').click();pg.wait_for_function('GomokuReview.state().mode==="proof" && !GomokuReview.state().interacting',timeout=20000)
  proof=pg.evaluate('GomokuReview.state().proof')
  check('proof viewer re-verifies the complete B11/A11/E14 combination',[s['i'] for s in proof['steps'][:3]]==[ix('B11'),ix('A11'),ix('E14')] and len(proof['steps'])==5)
  check('proof begins after J6, not after the recorded E14',proof['cert']['position'][BAD]==2 and proof['cert']['position'][PLAYED]==0)
  pg.set_viewport_size({'width':390,'height':844});pg.wait_for_timeout(150)
  pg.screenshot(path=str(OUT/'renju-forcing-proof-mobile.png'))
  check('mobile proof keeps an accessible exit without horizontal overflow',pg.locator('#grClose').is_visible() and pg.evaluate('document.documentElement.scrollWidth<=innerWidth+2'))
  pg.locator('#grReturn').click();pg.set_viewport_size({'width':1440,'height':1000})
  pg.evaluate('GomokuReview.showBest();GomokuReview.close()')
  migrated=pg.evaluate('''()=>{const k='gomoku.guided-review.v1',d=JSON.parse(localStorage.getItem(k)),item=d.items[0],fp=JSON.parse(item.fingerprint);fp[0]='2.0.0';item.fingerprint=JSON.stringify(fp);d.version='2.0.0';item.results[0].analysisVersion='2.0.0';item.results[0].best=143;item.results[0].label='Inaccuracy';item.results[0].budget=10000;localStorage.setItem(k,JSON.stringify(d));GomokuReview.open({ply:1});GomokuReview.pause();return {result:GomokuReview.state().results[0],variations:document.getElementById('grVariations').options.length};}''')
  check('old high-budget J6 analysis is rejected immediately',migrated['result'] is None)
  check('upgrade retains the saved variation',migrated['variations']>=1)
  pg.evaluate('GomokuReview.deeper()');pg.wait_for_function('!GomokuReview.state().interacting && GomokuReview.state().results[0]',timeout=25000)
  check('reanalyzed historical review rejects the old recommendation',pg.evaluate('GomokuReview.state().results[0].best') in DEF)
  responsiveness=pg.evaluate('''async()=>{GomokuReview.pause();const p=GomokuReview.state().positions[0];let frames=0,active=true;const tick=()=>{if(active){frames++;requestAnimationFrame(tick);}};requestAnimationFrame(tick);const job=GomokuAnalysisRuntime.request(p.board,p.color,'renju-practice',p.played,{preset:'maximum',timeMs:10000,context:p.context,force:true}).then(()=> 'finished',e=>e.name);await new Promise(r=>setTimeout(r,200));GomokuAnalysisRuntime.cancel();active=false;return {frames,status:await job,busy:GomokuAnalysisRuntime.stats().busy};}''')
  check('long analysis stays off the UI thread and is cancelable',responsiveness['frames']>=2 and responsiveness['status']=='AbortError' and not responsiveness['busy'])
  migration=pg.evaluate('''async ({board,rule,bad})=>{const A=createAnalysis2(createV5EngineFactory(createEngine,V5_WASM_BASE64),createStudioCore,createGuidedReviewCore),context={moveCount:39,passes:0};const r=await GomokuAnalysisRuntime.request(board,2,rule,bad,{preset:'standard',timeMs:1000,context});const card=A.makeCard(r,{board,color:2,played:bad,ply:40,context},{variant:rule,gameId:'legacy-upgrade'}),old=JSON.parse(JSON.stringify(card));old.reference.analysisVersion='2.0.0';old.reference.label='Blunder';old.reference.budget=10000;old.stats={attempts:3,successes:2,lapses:1,assisted:0,streak:1,due:1900000000000,last:1700000000000};old.events=[{id:'kept-event',status:'correct',assisted:false,at:1700000000000}];await GomokuMistakes.importData({format:'GomokuMistakeLibrary',version:2,cards:[old]});await GomokuMistakes.add([card]);const stored=(await GomokuMistakes.list()).find(c=>c.id===card.id);return {id:stored.id,sameID:stored.id===old.id,version:stored.reference.analysisVersion,stats:stored.stats,events:stored.events,persistent:GomokuMistakes.status().persistent};}''',{'board':F['board'],'rule':F['rule'],'bad':BAD})
  check('legacy card is upgraded without losing identity or recall history',migration['sameID'] and migration['version']=='2.1.0' and migration['stats']['attempts']==3 and migration['events'][0]['id']=='kept-event')
  if URL:check('migration uses native IndexedDB on the real origin',migration['persistent'])
  check('analysis and proof exploration never edit the recorded game',pg.evaluate('GomokuStudio.exportGame().moves')==original['moves'] and pg.evaluate('GomokuStudio.exportGame().initial')==original['initial'])
  check('no uncaught browser errors',not errors)
 except Exception:
  pg.screenshot(path=str(OUT/'forcing-defense-browser-failure.png'),full_page=True)
  (OUT/'forcing-defense-browser-failure.txt').write_text(traceback.format_exc()+'\n'+str(errors)+'\n'+pg.locator('body').inner_text()[-12000:]);raise
 finally:
  (OUT/'forcing-defense-browser-report.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'errors':errors,'origin':URL or 'set_content; native persistence not certified'},indent=2));browser.close()
print(str(len(checks))+' forcing-defense browser checks passed')
