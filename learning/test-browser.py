"""Browser acceptance for Gomoku 1.1 Learning Intelligence."""
from pathlib import Path
import json,os
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'learning-test-output';OUT.mkdir(exist_ok=True)
URL=os.environ.get('LEARNING_URL')
ERRORS=[];PASSED=[]

def check(name,ok=True):
    assert ok,name
    PASSED.append(name);print('PASS '+name,flush=True)

def route(page,name):
    page.locator('#v92Primary button[data-v92-route="'+name+'"]').click()
    page.wait_for_timeout(120)

def close_dialogs(page):
    page.evaluate('document.querySelectorAll("dialog[open]").forEach(d=>d.close())')

def load(browser,viewport,mobile=False):
    ctx=browser.new_context(viewport=viewport,is_mobile=mobile,has_touch=mobile,reduced_motion='reduce')
    page=ctx.new_page();page.set_default_timeout(16000)
    page.on('pageerror',lambda e: ERRORS.append(str(e)))
    if not URL:
        raise RuntimeError('LEARNING_URL is required for native localStorage/IndexedDB acceptance.')
    page.goto(URL,wait_until='domcontentloaded')
    page.wait_for_function('document.body.dataset.uiReady==="true" && window.GomokuLearningV11 && window.GomokuLearningV11.snapshot()')
    page.wait_for_timeout(500);close_dialogs(page)
    return ctx,page

with sync_playwright() as p:
    exe=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium')
    browser=p.chromium.launch(executable_path=exe if Path(exe).exists() else None,args=['--no-sandbox'])

    ctx,pg=load(browser,{'width':1360,'height':960})
    route(pg,'improve')
    check('Learning Intelligence mounts in Learn',pg.locator('#v11LearningIntelligence').is_visible())
    check('skill graph exposes exactly 35 skills',pg.evaluate('GomokuLearningV11.snapshot().skills.length')==35)
    check('fresh learner is not falsely mastered',pg.evaluate('GomokuLearningV11.snapshot().summary.mastered')==0)
    check('existing 14 chapter catalog remains intact',pg.locator('#uiCourseGrid .ui-course-tile').count()==14)
    pg.locator('#li11OpenMap').click()
    check('skill map opens',pg.locator('#li11SkillDialog').is_visible())
    check('all 35 skills are inspectable',pg.locator('#li11SkillDialog .li11-skill').count()==35)
    check('all skills have a direct next action',pg.locator('#li11SkillDialog [data-li11-skill]').count()==35)
    check('six learning groups remain visible',pg.locator('#li11SkillDialog .li11-group').count()==6)
    pg.screenshot(path=str(OUT/'01-skill-map.png'),full_page=True)
    pg.keyboard.press('Escape');pg.wait_for_timeout(80)

    # A first-time learner should be routed to course coverage rather than a fake rating.
    first=pg.evaluate('GomokuLearningV11.prescription()[0]')
    check('first recommendation is inspectable',isinstance(first,dict) and first.get('skillId'))
    pg.locator('#li11DoNext').click();pg.wait_for_timeout(120)
    check('recommended course action opens a real chapter',pg.locator('dialog.ui-course-dialog:visible').count()==1)
    pg.keyboard.press('Escape');pg.wait_for_timeout(80);route(pg,'improve')

    # Seed one genuine due Academy review and verify the live model changes without a reload.
    now=pg.evaluate('Date.now()')
    seeded={
      'sessionAttempts':[{'id':'li11-due-defense','motif':2,'correct':False,'assisted':False,'at':now-3600000,'session':'li11-browser'}],
      'reviews':{'li11-due-defense':{'due':now-1000,'last':now-3600000}}
    }
    pg.evaluate('(raw)=>localStorage.setItem("gomoku.studio.academy.v4",raw)',json.dumps(seeded))
    pg.evaluate('()=>GomokuLearningV11.refresh()')
    pg.wait_for_function('GomokuLearningV11.snapshot().summary.duePractice===1')
    check('due Academy review enters the learning summary',pg.evaluate('GomokuLearningV11.snapshot().summary.duePractice')==1)
    rec=pg.evaluate('GomokuLearningV11.prescription()[0]')
    check('due Academy review routes to targeted practice',rec.get('type')=='practice' and rec.get('practiceMotif')==2)
    route(pg,'improve');pg.locator('#li11DoNext').click()
    pg.wait_for_function('GomokuStudio.practiceState()!==null')
    state=pg.evaluate('GomokuStudio.practiceState()')
    check('learning action starts Weakness Review',state.get('mode')=='weakness')
    check('learning action targets the defensive motif',state.get('motifFilter')==2)
    pg.evaluate('GomokuStudio.endPractice(false)');pg.wait_for_timeout(100)
    ctx.close()

    mctx,mob=load(browser,{'width':390,'height':844},True)
    route(mob,'improve')
    check('mobile learning surface fits viewport',mob.evaluate('document.documentElement.scrollWidth<=innerWidth+2'))
    check('mobile primary learning action meets target size',mob.locator('#li11DoNext').evaluate('(e)=>e.getBoundingClientRect().height>=44'))
    mob.locator('#li11OpenMap').click()
    check('mobile skill map fits viewport',mob.locator('#li11SkillDialog').evaluate('(e)=>e.getBoundingClientRect().right<=innerWidth+1'))
    mob.screenshot(path=str(OUT/'02-mobile-skill-map.png'),full_page=True)
    mctx.close();browser.close()

check('no browser page errors',not ERRORS)
(OUT/'summary.json').write_text(json.dumps({'passed':PASSED,'errors':ERRORS},indent=2))
print('PASS Gomoku 1.1 browser acceptance: '+str(len(PASSED))+' checks.',flush=True)
