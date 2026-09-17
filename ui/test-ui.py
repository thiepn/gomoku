"""Full-app appearance regression. UI_URL runs on an actual HTTP origin in CI.
Local set_content runs explicitly emulate localStorage; no native-origin claim.
"""
from pathlib import Path
import os,json,time
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'ui-test-output';OUT.mkdir(exist_ok=True)
PASSED=[];ERRORS=[];URL=os.environ.get('UI_URL');FIXTURE=json.loads((ROOT/'review/fixture.json').read_text())
MOCK='<script>window.__uiStore=new Map();Object.defineProperty(window,"localStorage",{configurable:true,value:{getItem:k=>window.__uiStore.get(k)||null,setItem:(k,v)=>window.__uiStore.set(k,String(v)),removeItem:k=>window.__uiStore.delete(k),clear:()=>window.__uiStore.clear()}});</script>'
def check(name,ok=True):
    assert ok,name
    PASSED.append(name);print('PASS '+name,flush=True)
def route(page,name):
    page.locator('#v92Primary button[data-v92-route="'+name+'"]').click();page.wait_for_timeout(90)
def close(page):page.evaluate('document.querySelectorAll("dialog[open]").forEach(d=>d.close())')
def overflow(page):return page.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
def shot(page,name,full=False):page.screenshot(path=str(OUT/(name+'.png')),full_page=full)
def load(browser,viewport,mobile=False):
    ctx=browser.new_context(viewport=viewport,is_mobile=mobile,has_touch=mobile,reduced_motion='reduce');page=ctx.new_page();page.set_default_timeout(14000)
    page.on('pageerror',lambda e:ERRORS.append(str(e)))
    if URL:page.goto(URL,wait_until='domcontentloaded')
    else:page.set_content(MOCK+(ROOT/'index.html').read_text(),wait_until='domcontentloaded')
    page.wait_for_function('document.body.dataset.uiReady==="true"&&GomokuAppearance.courseSummary().length===14');page.wait_for_timeout(1300);close(page);return ctx,page
def theme(page,value):page.evaluate('(v)=>{const s=document.getElementById("themeSelect");s.value=v;s.dispatchEvent(new Event("change",{bubbles:true}))}',value);page.wait_for_timeout(80)
def hit(page,selector):
    loc=page.locator(selector);loc.scroll_into_view_if_needed()
    return loc.evaluate('(b)=>{const r=b.getBoundingClientRect(),e=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return e===b||b.contains(e)}')
with sync_playwright() as p:
    exe=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium');b=p.chromium.launch(executable_path=exe if Path(exe).exists() else None,args=['--no-sandbox'])
    ctx,pg=load(b,{'width':1440,'height':1000})
    check('one desktop navigation with exactly three destinations',pg.locator('#v92Primary button[data-v92-route]').count()==3)
    check('navigation does not place stones',pg.evaluate('GomokuStudio.diagnostics().moves')==0)
    route(pg,'play');check('Play remains empty after selection',pg.evaluate('GomokuStudio.diagnostics().moves')==0)
    check('both match modes fit their inspector',pg.evaluate('document.querySelector(".v92-mode-switch").scrollWidth<=document.querySelector(".v92-mode-switch").clientWidth+1'))
    check('14 backing course cards are confined to Learn',pg.evaluate('Array.from({length:14},(_,i)=>document.getElementById(`ch${i+1}CourseCard`)).every(c=>c?.parentElement?.id==="v92ImproveHome")'))
    check('course content not visible on Play',not pg.locator('#uiLearning').is_visible())
    shot(pg,'01-play-daylight')
    pg.locator('#focusBtn').click();check('focus mode truly removes inspector column',pg.evaluate('document.body.classList.contains("focus-mode")&&getComputedStyle(document.querySelector("aside.panel")).display==="none"&&getComputedStyle(document.querySelector("#mainContent")).gridTemplateColumns.split(" ").length===1'))
    pg.locator('#focusBtn').click();check('focus can exit without losing controls',pg.locator('#panel-play').is_visible())
    route(pg,'improve');check('all 655 original tasks remain',pg.evaluate('GomokuAppearance.courseSummary().reduce((a,r)=>a+r.total,0)')==655)
    check('one unified catalog with 14 visible chapters',pg.locator('.ui-course-tile:visible').count()==14)
    shot(pg,'02-learn-daylight',True)
    for key,count in [('foundation',3),('tactics',6),('advanced',5),('all',14)]:
        pg.locator('[data-course-filter="'+key+'"]').click();check('chapter filter '+key,pg.locator('.ui-course-tile:visible').count()==count)
    records=pg.evaluate('GomokuStudio.exportGame().moves')
    for n in range(1,15):
        pg.locator('[data-open-chapter="'+str(n)+'"]').click();d=pg.locator('#ch'+str(n)+'CourseDialog');d.wait_for(state='visible')
        check('chapter '+str(n)+' opens in themed dialog',d.evaluate('(d)=>d.classList.contains("ui-course-dialog")'))
        if n in [1,5,9,12,14]:shot(pg,'03-chapter-'+str(n)+'-daylight')
        pg.keyboard.press('Escape');pg.wait_for_timeout(50)
        check('chapter '+str(n)+' returns to catalog',not d.is_visible() and pg.locator('#uiLearning').is_visible())
    check('opening every chapter does not modify the match',pg.evaluate('GomokuStudio.exportGame().moves')==records)
    # Complete one real task, verify progress flows through the original storage/report.
    pg.locator('[data-open-chapter="1"]').click()
    pg.locator('#ch1Board button[data-i="42"]').click();pg.wait_for_timeout(80)
    check('original chapter answer interaction still completes a task',pg.evaluate('GomokuCourseChapter1.report().lessons[0].done')==1)
    check('lesson Next is not covered by the board',hit(pg,'#ch1NextTask'));pg.locator('#ch1NextTask').click();pg.keyboard.press('Escape');pg.wait_for_timeout(80)
    check('catalog shows real saved progress',pg.locator('#uiCourseProgress').inner_text().startswith('1 / 655'))
    # Source resume handler retains exact later-course lesson/task location.
    pg.evaluate('GomokuCourseChapter9.openSection(3,2)');pg.keyboard.press('Escape');pg.locator('[data-open-chapter="9"]').click()
    check('later course resumes its real last section',pg.locator('#ch9CourseDialog .ch9-score').inner_text().startswith('Lesson 4'))
    pg.keyboard.press('Escape')
    pg.locator('[data-ui-proxy="v92PracticeChoice"]').click();check('Practice opens a choice, not an automatic task',pg.locator('#v92TrainPanel').is_visible());shot(pg,'04-practice');route(pg,'improve')
    pg.locator('[data-ui-proxy="v92StudyChoice"]').click();check('Study position retains its route',pg.evaluate('document.body.dataset.v92Sub')=='study');shot(pg,'05-study');route(pg,'library')
    check('Library excludes course cards',not pg.locator('#uiLearning').is_visible());shot(pg,'06-library')
    route(pg,'play');pg.locator('#v111MenuBtn').click();shot(pg,'07-menu');pg.locator('[data-v111-action="settings"]').click();pg.locator('#settingsDialog').wait_for(state='visible');shot(pg,'08-settings');close(pg)
    pg.locator('#v92New').click();pg.locator('#newDialog').wait_for(state='visible');shot(pg,'09-new-game');close(pg)
    pg.locator('#v92LocalMode').click();check('local multiplayer setup remains available',pg.locator('dialog[open]').count()==1);shot(pg,'10-local-setup');close(pg)
    # Verify actual moves in preserved engine and no theme-induced data mutation.
    pg.evaluate('(g)=>GomokuStudio.importGame(g)',FIXTURE);close(pg);route(pg,'play');original=pg.evaluate('GomokuStudio.exportGame().moves')
    for v in ['night','slate','paper']:
        theme(pg,v);check(v+' theme preserves all moves',pg.evaluate('GomokuStudio.exportGame().moves')==original);shot(pg,'11-play-'+v)
        if v=='night':
            route(pg,'improve');shot(pg,'12-learn-night');pg.locator('[data-open-chapter="9"]').click();shot(pg,'13-chapter9-night');pg.keyboard.press('Escape');route(pg,'play')
    pg.locator('#uiThemeToggle').click();check('header theme control uses actual settings',pg.evaluate('document.body.dataset.theme')=='night');pg.locator('#uiThemeToggle').click()
    pg.locator('#uiReviewCurrent').click();pg.locator('#grDialog').wait_for(state='visible');pg.wait_for_function('GomokuReview.state().results.every(Boolean)&&!GomokuReview.state().scanning',timeout=45000);shot(pg,'14-guided-review');pg.keyboard.press('Escape')
    check('new review entry keeps the recorded game intact',pg.evaluate('GomokuStudio.exportGame().moves')==original)
    route(pg,'improve');pg.evaluate('document.body.classList.add("large-text","high-contrast")');check('large-text catalog applies the text setting',pg.locator('.ui-course-copy h3').first.evaluate('(e)=>parseFloat(getComputedStyle(e).fontSize)')>=23);check('high contrast setting is not overridden',pg.evaluate('getComputedStyle(document.body).getPropertyValue("--ink").trim()')=='#000');shot(pg,'15-accessibility');pg.evaluate('document.body.classList.remove("large-text","high-contrast")')
    check('no desktop horizontal overflow',overflow(pg));ctx.close()
    # Fresh touch profile, through real controls. Each width includes actual route layout.
    ctx,pg=load(b,{'width':390,'height':844},True)
    for width in [390,360,768]:
        pg.set_viewport_size({'width':width,'height':844 if width<600 else 1024})
        for r in ['play','improve','library']:
            route(pg,r);check(str(width)+'px '+r+' no page overflow',overflow(pg));shot(pg,f'16-{width}-{r}')
        if width<600:
            check(str(width)+'px navigation stays at bottom',pg.locator('#v92Primary').evaluate('(e)=>Math.abs(e.getBoundingClientRect().bottom-innerHeight)<=2'))
            route(pg,'improve');pg.locator('[data-course-filter="all"]').click();pg.locator('[data-open-chapter="1"]').click();check(str(width)+'px chapter fits screen',pg.locator('#ch1CourseDialog').evaluate('(d)=>d.getBoundingClientRect().right<=innerWidth+1'))
            shot(pg,f'17-{width}-chapter1');pg.keyboard.press('Escape')
            pg.locator('[data-open-chapter="14"]').click();check(str(width)+'px final chapter has reachable next',hit(pg,'#ch14NextTask'));shot(pg,f'18-{width}-chapter14');pg.keyboard.press('Escape')
    pg.set_viewport_size({'width':390,'height':844});route(pg,'play')
    pg.locator('#point-0').tap();check('Renju off-center first move is rejected before commit',pg.evaluate('GomokuStudio.diagnostics().moves')==0 and pg.locator('#placeBtn').is_disabled())
    check('Renju opening guidance identifies the center', 'H8' in pg.locator('#selectionHint').inner_text())
    pg.locator('#point-112').tap();check('touch selects center before committing',pg.evaluate('GomokuStudio.diagnostics().moves')==0)
    check('touch confirmation remains reachable',pg.locator('#placeBtn').is_visible() and not pg.locator('#placeBtn').is_disabled());pg.locator('#placeBtn').tap();pg.wait_for_function('GomokuStudio.diagnostics().moves>=1');check('touch confirmation places the intended stone',pg.evaluate('GomokuStudio.exportGame().moves[0].i')==112)
    shot(pg,'19-mobile-touch-play')
    check('no uncaught browser errors',len(ERRORS)==0)
    ctx.close();b.close()
(OUT/'ui-report.json').write_text(json.dumps({'passed':len(PASSED),'checks':PASSED,'errors':ERRORS,'origin':URL or 'set_content with explicit localStorage mock','scope':'Chromium, desktop and emulated touch viewports; not full screen-reader or physical-device certification.'},indent=2))
print(str(len(PASSED))+' UI checks passed',flush=True)
