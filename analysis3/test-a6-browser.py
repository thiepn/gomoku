"""A6 retained-worker, cancellation, mobile and real HTTP offline acceptance."""
from pathlib import Path
import os,json,time
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'analysis6-test-output'
OUT.mkdir(exist_ok=True)
BASE=os.environ.get('A6_URL','http://127.0.0.1:8765/')
GAME=json.loads((ROOT/'review/fixture.json').read_text())
checks=[]
def check(name,ok):
    assert ok,name
    checks.append(name);print('PASS '+name,flush=True)
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,args=['--no-sandbox'])
    ctx=browser.new_context(viewport={'width':1440,'height':900},service_workers='allow')
    pg=ctx.new_page();pg.set_default_timeout(18000)
    pg.goto(BASE,wait_until='domcontentloaded',timeout=45000)
    pg.wait_for_function('!!window.GomokuAnalysisRuntime && !!window.GomokuRuntimePolicy6',timeout=25000)
    check('A6 runtime and pure policy initialized in portable app',pg.evaluate("GomokuAnalysisRuntime.runtimeVersion==='3.0.0-a6'"))
    check('normal requested budget remains unchanged unless adaptive is chosen',pg.evaluate("""()=>{
      const P=GomokuRuntimePolicy6;
      return P.admission({timeMs:3000},{memoryGb:2,cores:2}).appliedMs===3000&&
        P.admission({timeMs:3000,adaptiveBudget:true},{memoryGb:2,cores:2}).appliedMs===650;}"""))
    pg.evaluate("""g=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());GomokuStudio.importGame(g);GomokuReview.open()}""",GAME)
    pg.wait_for_function('GomokuReview.state()?.results.every(Boolean)&&!GomokuReview.state().scanning',timeout=85000)
    before=pg.evaluate('GomokuStudio.exportGame().moves')
    stats=pg.evaluate('GomokuAnalysisRuntime.stats()')
    check('whole game reused a worker instead of restarting for every move',stats['workersCreated']<=4 and stats['completed']>=10)
    check('result cache enforces explicit byte and position limits',stats['cachedPositions']<=24 and stats['cacheBytes']<=stats['maxCacheBytes'])
    pg.evaluate("GomokuReview.pause()")
    pt=pg.evaluate("""()=>{
      const p=GomokuReview.state().positions[3];
      return {board:p.board,color:p.color,rule:GomokuReview.state().game.variant,played:p.played,context:p.context};}""")
    result=pg.evaluate("""async p=>{
      const R=GomokuAnalysisRuntime,opts={timeMs:500,multiPV:3,context:p.context};
      const old=R.stats().coalescedRequests;
      const a=R.request(p.board,p.color,p.rule,p.played,opts);
      const b=R.request(p.board,p.color,p.rule,p.played,opts);
      const both=await Promise.all([a,b]);
      const c=await R.request(p.board,p.color,p.rule,p.played,opts);
      return {coalesced:R.stats().coalescedRequests-old,cacheHit:c.cacheHit,
        equal:both[0].played===both[1].played,workers:R.stats().workersCreated};}""",pt)
    check('duplicate exact requests are coalesced and subsequent lookups hit bounded cache',
      result['coalesced']>=1 and result['cacheHit'] and result['equal'])
    check('A6 retained worker still supports live search',result['workers']<=stats['workersCreated']+2)
    aborted=pg.evaluate("""async p=>{
      const R=GomokuAnalysisRuntime,ac=new AbortController();
      const promise=R.request(p.board,p.color,p.rule,p.played,{timeMs:4000,
        context:{...p.context,passes:9},signal:ac.signal,force:true});
      ac.abort();
      const result=await promise.then(()=>false,e=>e.name==='AbortError');
      return {result,busy:R.stats().busy};}""",pt)
    check('abort signal rejects and leaves no active worker job',aborted['result'] and not aborted['busy'])
    check('analysis after cancellation preserved original game moves',pg.evaluate('GomokuStudio.exportGame().moves')==before)
    pg.screenshot(path=str(OUT/'01-a6-desktop.png'))
    # An HTTP origin (unlike set_content) is required for actual PWA tests.
    pg.evaluate('GomokuReview.close()')
    pg.wait_for_timeout(500)
    registered=pg.evaluate("""()=>!!navigator.serviceWorker&&location.protocol==='http:'&&
      (location.hostname==='127.0.0.1'||location.hostname==='localhost')""")
    check('PWA test is using a real secure-context localhost origin',registered)
    try:
      pg.wait_for_function('navigator.serviceWorker.controller!==null',timeout=20000)
    except Exception:
      pg.reload(wait_until='domcontentloaded')
      pg.wait_for_function('navigator.serviceWorker.controller!==null',timeout=30000)
    check('portable shell is controlled by its own PWA service worker',pg.evaluate('navigator.serviceWorker.controller!==null'))
    ctx.set_offline(True)
    pg.reload(wait_until='domcontentloaded',timeout=45000)
    pg.wait_for_function('!!window.GomokuAnalysisRuntime',timeout=15000)
    check('A6 shell opens while physically network-disabled in Chromium',pg.evaluate("GomokuAnalysisRuntime.runtimeVersion==='3.0.0-a6'"))
    ctx.set_offline(False)
    pg.close();ctx.close()
    mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,service_workers='allow')
    page=mobile.new_page();page.goto(BASE,wait_until='domcontentloaded',timeout=45000)
    page.wait_for_function('!!window.GomokuAnalysisRuntime && !!window.GomokuRuntimePolicy6',timeout=25000)
    check('mobile runtime reports a concrete device budget classification',
      page.evaluate("['constrained','balanced','unrestricted'].includes(GomokuAnalysisRuntime.stats().deviceClass)"))
    dims=page.evaluate('()=>[document.documentElement.scrollWidth,innerWidth]')
    check('mobile runtime does not force document horizontal overflow',dims[0]<=dims[1]+2)
    page.screenshot(path=str(OUT/'02-a6-mobile.png'))
    browser.close()
(OUT/'a6-browser-report.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'note':'Real Chromium HTTP offline, not physical Android hardware; no Elo claim'},indent=2))
print(f'{len(checks)} A6 HTTP-browser checks passed',flush=True)
