"""Real-browser acceptance for Gomoku v1.2 Course 2.0."""
from pathlib import Path
import json,os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'course2-test-output';OUT.mkdir(exist_ok=True)
URL=os.environ.get('COURSE2_URL');ERRORS=[];PASSED=[]
def check(name,ok=True): assert ok,name;PASSED.append(name);print('PASS '+name,flush=True)
def route(p,n): p.locator('#v92Primary button[data-v92-route="'+n+'"]').click();p.wait_for_timeout(120)
def close(p): p.evaluate('document.querySelectorAll("dialog[open]").forEach(d=>d.close())')
def load(browser,viewport,mobile=False,reduced='no-preference'):
    ctx=browser.new_context(viewport=viewport,is_mobile=mobile,has_touch=mobile,reduced_motion=reduced);page=ctx.new_page();page.set_default_timeout(18000)
    page.on('pageerror',lambda e:ERRORS.append(str(e)))
    if not URL: raise RuntimeError('COURSE2_URL is required.')
    page.goto(URL,wait_until='domcontentloaded');page.wait_for_function('document.body.dataset.uiReady==="true"&&GomokuCourse2&&GomokuLearningV11&&GomokuCourse2.model().chapters.length===14');page.wait_for_timeout(500);close(page);return ctx,page
with sync_playwright() as p:
    exe=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium');b=p.chromium.launch(executable_path=exe if Path(exe).exists() else None,args=['--no-sandbox'])
    ctx,pg=load(b,{'width':1360,'height':960});route(pg,'improve')
    pg.wait_for_function('document.querySelector("#c20Journey")?.offsetParent!==null && document.querySelectorAll("#uiCourseGrid .c20-tile-demo").length===14')
    check('Guided Journey visible',pg.locator('#c20Journey').is_visible());check('14 journey chapters',pg.locator('#c20Journey .c20-node').count()==14)
    check('14 Visual concept buttons',pg.locator('#uiCourseGrid .c20-tile-demo').count()==14)
    check('42 teaching scenes',pg.evaluate('Array.from({length:14},(_,i)=>GomokuCourse2Core.demo(i+1).length).reduce((a,b)=>a+b,0)')==42)
    pg.screenshot(path=str(OUT/'01-guided-journey.png'),full_page=True)
    pg.evaluate('GomokuCourse2.openDemo(4)');pg.locator('#c20ConceptDialog').wait_for(state='visible')
    check('81 concept intersections',pg.locator('#c20Board .c20-cell').count()==81);check('initial stones animate',pg.locator('#c20Board .c20-stone.is-new').count()>0)
    check('motion active',pg.locator('#c20Board .c20-stone.is-new').first.evaluate('(e)=>getComputedStyle(e).animationName!="none"'))
    pg.locator('#c20Next').click();pg.wait_for_timeout(80)
    check('persistent stones stable',pg.locator('#c20Board .c20-stone.is-static').count()>=2);check('new stones animate',pg.locator('#c20Board .c20-stone.is-new').count()>=1)
    check('threat lines draw',pg.locator('#c20Lines .c20-line').count()>=2);pg.screenshot(path=str(OUT/'02-animated-fork.png'))
    pg.locator('#c20Next').click();pg.locator('#c20Next').click();check('transfer appears',pg.locator('#c20Transfer').is_visible())
    ans=pg.evaluate('GomokuCourse2Core.transfer(4).answer');wrong=(ans+1)%3
    pg.locator('[data-c20-choice="'+str(wrong)+'"]').click();check('wrong answer permits retry',pg.locator('#c20Transfer [data-c20-choice]:not([disabled])').count()>=1)
    pg.locator('[data-c20-choice="'+str(ans)+'"]').click();check('success state',pg.locator('#c20Transfer.is-correct').count()==1);check('success burst',pg.locator('#c20Transfer .c20-burst i').count()==8)
    pg.wait_for_function('GomokuCourse2.attempts().length>=2');pg.wait_for_function('GomokuLearningV11.snapshot().skills.find(s=>s.id==="double-threat").sources.includes("course2-check")')
    skill=pg.evaluate('GomokuLearningV11.snapshot().skills.find(s=>s.id==="double-threat")')
    check('Course 2 evidence reaches v1.1',skill.get('evidence',0)>0 and 'course2-check' in skill.get('sources',[]));check('no fake game transfer',skill.get('transferEvidence')==0)
    pg.screenshot(path=str(OUT/'03-transfer-success.png'));pg.locator('#c20ConceptDialog .c20-close').click();pg.locator('[data-open-chapter="4"]').click();pg.locator('#ch4CourseDialog').wait_for(state='visible')
    check('mastery checkpoint in original chapter',pg.locator('#ch4CourseDialog .c20-checkpoint').is_visible());pg.keyboard.press('Escape');ctx.close()
    mctx,m=load(b,{'width':390,'height':844},True,'reduce');route(m,'improve')
    m.wait_for_function('document.querySelector("#c20Journey")?.offsetParent!==null')
    check('mobile journey fits',m.evaluate('document.documentElement.scrollWidth<=innerWidth+2'));check('mobile concept target >=44',m.locator('#c20Journey .c20-node-demo').first.evaluate('(e)=>e.getBoundingClientRect().height>=44'))
    m.evaluate('GomokuCourse2.openDemo(1)');m.locator('#c20ConceptDialog').wait_for(state='visible');check('mobile dialog fits',m.locator('#c20ConceptDialog').evaluate('(e)=>e.getBoundingClientRect().right<=innerWidth+1'))
    check('reduced motion honored',m.locator('#c20Board .c20-stone').first.evaluate('(e)=>getComputedStyle(e).animationName==="none"'));check('mobile next target >=44',m.locator('#c20Next').evaluate('(e)=>e.getBoundingClientRect().height>=44'))
    m.screenshot(path=str(OUT/'04-mobile-concept.png'),full_page=True);mctx.close();b.close()
check('no browser page errors',not ERRORS)
(OUT/'summary.json').write_text(json.dumps({'passed':PASSED,'errors':ERRORS},indent=2))
print('PASS Gomoku 1.2 browser acceptance: '+str(len(PASSED))+' checks.',flush=True)
