"""Intuitive review workspace regression suite; uses synthetic games only.
Set WORKSPACE_URL to exercise an HTTP origin. The set_content fallback explicitly
emulates localStorage and does not certify persistence, service workers, or devices.
"""
from pathlib import Path
import json, os, traceback
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'workspace-test-output'
OUT.mkdir(exist_ok=True)
HTML = (ROOT / 'index.html').read_text()
GAME = json.loads((ROOT / 'review/fixture.json').read_text())
URL = os.environ.get('WORKSPACE_URL')
CHECKS, ERRORS = [], []
MOCK = '''<script>const store=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k),clear:()=>store.clear()}});</script>'''

def check(name, condition=True):
    assert condition, name
    CHECKS.append(name)
    print('PASS ' + name, flush=True)

def state(pg):
    return pg.evaluate('GomokuReview.state()')

def settled(pg):
    pg.wait_for_function('GomokuReview.state() && !GomokuReview.state().interacting && !GomokuReview.state().scanning', timeout=35000)

def load(ctx, fixture=GAME):
    pg = ctx.new_page()
    pg.set_default_timeout(12000)
    pg.on('pageerror', lambda e: ERRORS.append(str(e)))
    if URL:
        pg.goto(URL, wait_until='domcontentloaded', timeout=45000)
    else:
        pg.set_content(MOCK + HTML, wait_until='domcontentloaded')
    pg.wait_for_function('window.GomokuReview?.workspaceVersion === "2.1.0"', timeout=20000)
    pg.wait_for_timeout(1000)
    pg.evaluate('(g)=>{document.querySelectorAll("dialog[open]").forEach(d=>d.close());GomokuStudio.importGame(g);GomokuReview.open();}', fixture)
    pg.wait_for_function('GomokuReview.state()?.results.every(Boolean) && !GomokuReview.state().scanning', timeout=45000)
    return pg

def hit(pg, selector):
    return pg.locator(selector).evaluate('''e=>{const r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,t=document.elementFromPoint(x,y);return x>=0&&y>=0&&x<=innerWidth&&y<=innerHeight&&(t===e||e.contains(t));}''')

def in_view(pg, selector):
    r = pg.locator(selector).bounding_box()
    return bool(r and r['x']>=-1 and r['y']>=-1 and r['x']+r['width']<=pg.viewport_size['width']+1 and r['y']+r['height']<=pg.viewport_size['height']+1)

with sync_playwright() as pw:
    exe = os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium')
    browser = pw.chromium.launch(executable_path=exe if Path(exe).exists() else None, headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width':1440,'height':1000})
    pg = load(context)
    try:
        original = pg.evaluate('GomokuStudio.exportGame()')
        s = state(pg)
        keys = [i for i,r in enumerate(s['results']) if r['label'] in ['Inaccuracy','Mistake','Blunder','Losing move','Missed win','Win available'] and s['positions'][i]['color']==GAME['humanColor']]
        check('one review workspace opens on the Overview tab',s['panel']=='overview' and pg.locator('dialog[open]').count()==1)
        check('Overview reports the actual outcome and player side','White won' in pg.locator('#rwOutcome').inner_text() and 'You played Black' in pg.locator('#rwOutcome').inner_text())
        check('Overview board shows all recorded moves, not the first mistake',pg.locator('#grBoard [data-stone="1"]').count()+pg.locator('#grBoard [data-stone="2"]').count()==10)
        check('advanced engine controls are hidden initially',not pg.locator('#a2Preset').is_visible() and not pg.locator('#a2SearchStats').is_visible())
        check('overview has a visible actionable review start',hit(pg,'#rwStart'))
        check('overview contains real key moments',pg.locator('#rwKeyList [data-review-ply]').count()==len(keys) and len(keys)>0)
        pg.screenshot(path=str(OUT/'01-overview.png'))
        pg.locator('#rwStart').click()
        check('start review goes to the earliest key moment',state(pg)['panel']=='review' and state(pg)['index']==keys[0])
        check('review distinguishes game and key-moment navigation','KEY MOMENT 1' in pg.locator('#rwDecisionContext').inner_text() and 'Move' in pg.locator('#grCounter').inner_text())
        if len(keys)>1:
            pg.locator('#grKey').click()
            check('next key moment moves forward rather than through every move',state(pg)['index']==keys[1])
        pg.evaluate('GomokuReview.select(7)');pg.wait_for_timeout(70)
        check('played classification is clear and tied to the current coordinate',pg.locator('#grVerdict').inner_text()=='Losing move' and pg.locator('#rwPlayedCoord').inner_text()=='G8')
        check('a concrete threat is visible without opening advanced evidence','G9' in pg.locator('#rwShortWhy').inner_text() and 'F9' in pg.locator('#rwShortWhy').inner_text())
        check('guided review does not reveal candidate markers on the board',pg.locator('#grBoard .gr-suggested').count()==0 and pg.locator('#grBoard .rw-candidate-point').count()==0)
        check('recorded move stays visible in the independently scrolling move list',hit(pg,'#grMoveList .gr-current'))
        check('desktop board and next-step action remain fully visible',in_view(pg,'#grBoard') and hit(pg,'#grKey'))
        pg.screenshot(path=str(OUT/'02-guided-review.png'))
        pg.locator('#rwExplanation summary').click()
        check('full engine explanation remains available behind the concise one','verified' in pg.locator('#grWhy').inner_text().lower())
        pg.locator('#rwExplanation summary').click()
        pg.locator('#grBefore').click()
        check('before-move view removes only the selected recorded stone',pg.locator('[data-point="111"]').get_attribute('data-stone')=='0' and state(pg)['view']=='before')
        pg.locator('#grPlayed').click()
        check('played comparison restores that stone',pg.locator('[data-point="111"]').get_attribute('data-stone')=='1')
        pg.locator('[data-point="96"]').click()
        check('a guided-board click does not silently start a variation',state(pg)['mode']=='game' and 'Free analysis' in pg.locator('#grFeedback').inner_text())
        pg.locator('#rwTabAnalysis').click();pg.wait_for_timeout(70)
        check('free analysis explicitly starts before the selected move',state(pg)['view']=='before' and 'REPLACE' in pg.locator('#grModeLabel').inner_text())
        check('free analysis prioritizes visible candidate choices',hit(pg,'#grCandidates .gr-candidate:first-child'))
        check('return-to-review is available before a test stone is placed',hit(pg,'#grReturn'))
        candidates=pg.locator('#grCandidates [data-alternative]').evaluate_all('(es)=>es.map(e=>Number(e.dataset.alternative))')
        markers=pg.locator('#grBoard .rw-candidate-point').evaluate_all('(es)=>es.map(e=>[Number(e.dataset.point),e.querySelector(".gr-point-mark").textContent])')
        check('numbered board markers match the ranked candidate list',all(candidates[int(rank)-1]==i for i,rank in markers))
        pg.locator('#grCandidates .gr-candidate').nth(1).hover()
        check('hovering a candidate previews its point without placing it',pg.locator('.rw-preview').count()==1 and state(pg)['mode']=='game')
        pg.screenshot(path=str(OUT/'03-free-analysis.png'))
        best=state(pg)['results'][6]['best'];pg.locator(f'[data-alternative="{best}"]').click();pg.wait_for_timeout(70)
        check('candidate selection creates a separate variation',state(pg)['mode']=='explore' and state(pg)['branch']['moves']==[best])
        check('test-move assessment no longer displays the original blunder',pg.locator('#grVerdict').inner_text()==next(c['label'] for c in state(pg)['results'][6]['candidates'] if c['i']==best) and 'test move 1' in pg.locator('#grDecisionTitle').inner_text())
        pg.locator('#grReply').click();settled(pg)
        check('engine reply is assessed from its own color and position',state(pg)['branch']['last']['color']==2 and 'White' in pg.locator('#grDecisionTitle').inner_text())
        moves=state(pg)['branch']['moves'][:]
        pg.locator('#grUndo').click()
        check('undo retains a redo path without changing the saved game',state(pg)['branch']['moves']==moves[:-1] and state(pg)['branch']['redo']==[moves[-1]])
        pg.locator('#rwRedo').click();settled(pg)
        check('redo replays and reassesses the same legal move',state(pg)['branch']['moves']==moves and state(pg)['branch']['last']['played']==moves[-1])
        recorded=json.dumps(state(pg)['results'],sort_keys=True)
        pg.locator('#grDeeper').click();settled(pg)
        check('deeper variation analysis cannot overwrite original-game judgments',json.dumps(state(pg)['results'],sort_keys=True)==recorded and state(pg)['branch']['last']['played']==moves[-1])
        pg.screenshot(path=str(OUT/'04-test-line.png'))
        pg.locator('#grReturn').click();pg.wait_for_timeout(70)
        check('return restores the selected played position and guided context',state(pg)['index']==6 and state(pg)['mode']=='game' and state(pg)['panel']=='review' and state(pg)['view']=='played')
        check('return resets the coach scroll to the visible verdict',hit(pg,'#rwGradeIcon') and pg.locator('#rwDecision').evaluate('e=>e.scrollTop')==0)
        pg.locator('#grRetry').click()
        check('retry hides alternatives and both comparison buttons',pg.locator('#grCandidates [data-alternative]').count()==0 and not pg.locator('#rwCompare').is_visible())
        check('retry also conceals board hints and numerical candidate evidence',pg.locator('#grBoard .gr-suggested,#grBoard .rw-candidate-point,#grBoard .gr-threat').count()==0 and pg.locator('#rwCandidateEvidence').inner_text()=='')
        pg.screenshot(path=str(OUT/'05-retry.png'))
        pg.locator(f'[data-point="{best}"]').click();settled(pg)
        check('retry assessment belongs to the attempted move',state(pg)['attempt']['result']['played']==best and state(pg)['attempt']['verdict'])
        pg.keyboard.press('Escape')
        check('Escape leaves retry before closing review',state(pg)['mode']=='game' and pg.locator('#grDialog').is_visible())
        pg.locator('#rwOptions').click()
        check('Options is a deliberate disclosure with focused strength control',pg.locator('#rwSettings').is_visible() and pg.evaluate('document.activeElement.id')=='a2Preset')
        pg.locator('#a2Preset').select_option('deep');pg.keyboard.press('Escape')
        check('Escape closes only Options and restores its trigger focus',not pg.locator('#rwSettings').is_visible() and pg.evaluate('document.activeElement.id')=='rwOptions' and state(pg) is not None)
        pg.locator('#rwTabReview').focus();pg.keyboard.press('ArrowRight')
        check('tab arrow navigation selects free analysis without moving the game',state(pg)['panel']=='analysis' and state(pg)['index']==6 and pg.evaluate('document.activeElement.id')=='rwTabAnalysis')
        pg.locator('#grReturn').click();pg.locator('#rwScrubber').focus();pg.keyboard.press('End')
        check('timeline keyboard scrub reaches the last recorded move',state(pg)['index']==9)
        pg.keyboard.press('Home')
        check('timeline keyboard scrub reaches the first recorded move',state(pg)['index']==0)
        pg.evaluate('GomokuReview.select(7)');pg.locator('#grFilter').select_option('mine')
        check('your-moves filter does not mix opponent decisions',pg.locator('#grMoveList .gr-record-move').count()==5)
        pg.locator('#grFilter').select_option('all')
        pg.locator('#grKey').click()
        check('last key moment finishes at a recap rather than silently wrapping',state(pg)['panel']=='overview' and state(pg)['guideDone'] and 'lesson' in pg.locator('#rwOverviewTitle').inner_text())
        pg.locator('#rwStart').click()
        check('review again explicitly restarts at the first key moment',state(pg)['index']==keys[0] and not state(pg)['guideDone'])
        pg.evaluate('GomokuReview.select(7)');pg.locator('#a2Refutation').click();pg.wait_for_function('GomokuReview.state().mode==="proof"',timeout=20000)
        check('verified threat walkthrough remains within Guided review',state(pg)['panel']=='review' and pg.locator('#rwTabReview').get_attribute('aria-selected')=='true')
        pg.locator('#a2ProofNext').click()
        check('visible proof controls advance the verified threat',state(pg)['proof']['index']==0)
        pg.screenshot(path=str(OUT/'06-threat-proof.png'))
        pg.keyboard.press('Escape')
        check('Escape exits a proof to its original recorded decision',state(pg)['mode']=='game' and state(pg)['index']==6)
        for width,height in [(1440,900),(1100,720),(768,1024),(390,844),(360,800),(667,375)]:
            pg.set_viewport_size({'width':width,'height':height});pg.evaluate('GomokuReview.select(7)');pg.wait_for_timeout(100)
            dims=pg.locator('#grDialog').evaluate('e=>[e.scrollWidth,e.clientWidth,document.documentElement.scrollWidth,innerWidth]')
            check(f'{width}x{height} has no horizontal overflow',dims[0]<=dims[1]+1 and dims[2]<=dims[3]+1)
            check(f'{width}x{height} keeps its exit and next action reachable',hit(pg,'#grClose') and hit(pg,'#grKey'))
            pg.screenshot(path=str(OUT/f'07-layout-{width}-{height}.png'))
        pg.set_viewport_size({'width':1440,'height':1000})
        for theme in ['night','slate','paper']:
            pg.evaluate('(t)=>{document.body.dataset.theme=t;}',theme);pg.wait_for_timeout(60)
            check(theme+' theme preserves visible coaching and board',pg.locator('#grVerdict').is_visible() and in_view(pg,'#grBoard'))
            pg.screenshot(path=str(OUT/f'08-theme-{theme}.png'))
        pg.evaluate('document.body.classList.add("large-text","high-contrast")');pg.wait_for_timeout(80)
        check('large text and high contrast retain reachable navigation',hit(pg,'#grClose') and hit(pg,'#grKey'))
        pg.screenshot(path=str(OUT/'09-accessibility-preferences.png'))
        pg.evaluate('document.body.classList.remove("large-text","high-contrast")')
        check('complete review flow does not mutate recorded moves or study trees',pg.evaluate('GomokuStudio.exportGame().moves')==original['moves'] and pg.evaluate('GomokuStudio.exportGame().studio.tree')==original['studio']['tree'])
        # Mobile input uses a genuine coarse-pointer context, not a desktop resize.
        mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        mp=load(mobile);mp.evaluate('GomokuReview.select(7)');mp.wait_for_timeout(80)
        check('mobile offers Try again without scrolling past the explanation',hit(mp,'#rwQuickAction') and mp.locator('#rwQuickAction').inner_text()=='Try again')
        y=mp.locator('#grBoard').bounding_box()['y'];mp.locator('.gr-inspector').evaluate('e=>e.scrollTop=500');mp.wait_for_timeout(60)
        check('scrolling the mobile explanation does not lose the board',abs(mp.locator('#grBoard').bounding_box()['y']-y)<1)
        mp.locator('#rwQuickAction').tap();mp.wait_for_timeout(60);best=state(mp)['results'][6]['best']
        mp.locator(f'[data-point="{best}"]').tap();mp.wait_for_timeout(60)
        check('touch selection previews rather than immediately placing',state(mp)['pending']==best and state(mp)['attempt'] is None and mp.locator(f'[data-point="{best}"]').get_attribute('data-stone')=='0')
        check('touch confirmation is visible and does not cover the next action',hit(mp,'#rwPlace') and hit(mp,'#grKey'))
        mp.locator('#rwCancelPlace').tap()
        check('cancelling a touch selection leaves the position unchanged',state(mp)['pending'] is None and state(mp)['attempt'] is None)
        mp.locator(f'[data-point="{best}"]').tap();mp.locator('#rwPlace').tap();settled(mp)
        check('confirmed touch attempt is independently evaluated',state(mp)['attempt']['result']['played']==best)
        mp.screenshot(path=str(OUT/'10-mobile-retry-feedback.png'))
        mp.locator('#grReturn').tap();mp.locator('#rwOptions').tap()
        check('mobile export and mistake library remain accessible in Options',hit(mp,'#rwExportOption') and hit(mp,'#rwLibraryOption'))
        mp.locator('#rwOptionsClose').tap();mp.locator('#rwTabAnalysis').tap();mp.locator('#rwQuickAction').tap()
        check('mobile best-move shortcut opens a clearly labeled test line',state(mp)['mode']=='explore' and 'TEST LINE' in mp.locator('#grModeLabel').inner_text())
        mp.locator('#grKey').tap();check('mobile footer returns from analysis to recorded review',state(mp)['mode']=='game' and state(mp)['panel']=='review')
        mobile.close()
        # An opening-only fixture has no established mistake; all-moves tour must work.
        tiny={**GAME,'moves':GAME['moves'][:2],'gameId':'workspace-opening-only','title':'Opening-only fixture'}
        noerrors=load(context,tiny);check('no-mistake overview explains the lack of established errors',noerrors.locator('#rwKeyList [data-review-ply]').count()==0)
        noerrors.locator('#rwStart').click();check('no-mistake tour starts at move one',state(noerrors)['index']==0)
        noerrors.locator('#grKey').click();check('no-mistake tour advances through every move',state(noerrors)['index']==1 and state(noerrors)['panel']=='review')
        noerrors.locator('#grKey').click();check('no-mistake tour ends cleanly without a zero-of-zero lesson count',state(noerrors)['panel']=='overview' and '0 of 0' not in noerrors.locator('#rwOverviewText').inner_text())
        noerrors.close()
        pg.locator('#grClose').click();check('explicit Close exits the entire workspace',state(pg) is None and not pg.locator('#grDialog').is_visible())
        check('no uncaught browser errors across review and practice entry flows',not ERRORS)
    except Exception:
        pg.screenshot(path=str(OUT/'failure.png'))
        (OUT/'failure.txt').write_text(traceback.format_exc())
        raise
    finally:
        (OUT/'workspace-report.json').write_text(json.dumps({'passed':len(CHECKS),'checks':CHECKS,'pageErrors':ERRORS,'origin':URL or 'set_content with explicit storage emulation','scope':'Synthetic fixtures, Chromium desktop and touch emulation; not comparative user testing, physical devices, all-browser or complete accessibility certification.'},indent=2))
        browser.close()
print(f'{len(CHECKS)} workspace checks passed',flush=True)
