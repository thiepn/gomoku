"""U2 source-candidate acceptance: real Chromium on disposable localhost only."""
from pathlib import Path
import os, json
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'u2-test-output';OUT.mkdir(exist_ok=True)
URL=os.environ.get('U2_URL','http://127.0.0.1:8765/')
results=[];errors=[];network=[]
def ck(name,ok):
    if not ok: raise AssertionError(name)
    results.append(name);print('PASS '+name,flush=True)

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,args=['--no-sandbox'])
    for width,height,mobile in [(1440,900,False),(1280,800,False),(768,1024,False),(390,844,True),(360,800,True)]:
        context=browser.new_context(viewport={'width':width,'height':height},is_mobile=mobile,has_touch=mobile,reduced_motion='reduce')
        page=context.new_page();page.set_default_timeout(20000)
        page.on('pageerror',lambda err: errors.append(str(err)))
        page.on('request',lambda req: network.append(req.url) if not req.url.startswith(URL) else None)
        page.goto(URL,wait_until='domcontentloaded')
        page.wait_for_function('window.GomokuArena && document.body.dataset.uiReady === "true"',timeout=25000)
        page.wait_for_timeout(1450)
        page.evaluate('document.querySelectorAll("dialog[open]").forEach(x=>x.close())')
        ck(str(width)+'px Arena mounted',page.evaluate('document.body.classList.contains("ui-arena")'))
        ck(str(width)+'px four destinations',page.evaluate("JSON.stringify(GomokuArena.destinations)==='[\"play\",\"analyze\",\"learn\",\"library\"]'"))
        ck(str(width)+'px preserved 655 tasks',page.evaluate('GomokuAppearance.courseSummary().reduce((s,x)=>s+(x.total||0),0)===655'))
        ck(str(width)+'px no horizontal page overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+2'))
        ck(str(width)+'px original game begins unchanged',page.evaluate('GomokuStudio.diagnostics().moves===0'))
        nav=page.locator('#v92Primary .v92-nav-main > .v92-nav-btn')
        ck(str(width)+'px four actual nav buttons',nav.count()==4)
        ck(str(width)+'px navigation labels',page.evaluate("JSON.stringify(Array.from(document.querySelectorAll('#v92Primary .v92-nav-main > .v92-nav-btn'),x=>x.getAttribute('aria-label')))==='[\"Play\",\"Analyze\",\"Learn\",\"Library\"]'"))
        ck(str(width)+'px exactly one current nav',page.evaluate('document.querySelectorAll("#v92Primary .v92-nav-main > button[aria-current=page]").length===1'))
        ck(str(width)+'px design token applied',page.evaluate('getComputedStyle(document.body).getPropertyValue("--arena-accent").trim().length>0'))
        if width>=768:
            ck(str(width)+'px fixed desktop rail',page.evaluate('getComputedStyle(document.querySelector("header.top")).position==="fixed"'))
        else:
            ck(str(width)+'px fixed mobile nav',page.evaluate('getComputedStyle(document.getElementById("v92Primary")).position==="fixed"'))
        if width>=1280:
            ck(str(width)+'px Play label has no inherited red block',page.evaluate('getComputedStyle(document.querySelector("#v92Primary [data-v92-route=play]"),"::after").backgroundColor==="rgba(0, 0, 0, 0)"'))
            print('U2_LAYOUT '+str(width)+' '+str(page.evaluate("""() => ({viewport:innerHeight,board:document.querySelector('.board-shell')?.getBoundingClientRect().toJSON(),actions:document.getElementById('v92GameBar')?.getBoundingClientRect().toJSON(),place:document.querySelector('.placement')?.getBoundingClientRect().toJSON()})""")),flush=True)
            page.screenshot(path=str(OUT/('play-'+str(width)+'.png')),full_page=False)
            ck(str(width)+'px board actions remain inside viewport',page.evaluate('document.getElementById("v92GameBar").getBoundingClientRect().bottom<=innerHeight+3'))
        page.screenshot(path=str(OUT/('play-'+str(width)+'.png')),full_page=False)
        if width in (1440,390):
            page.locator('#arenaAnalyze').click()
            page.wait_for_timeout(200)
            ck(str(width)+'px Analyze navigates to real study',page.evaluate('document.body.dataset.v92Route==="improve"&&document.body.dataset.v92Sub==="study"'))
            ck(str(width)+'px Analyze current',page.evaluate('GomokuArena.current()==="analyze"'))
            page.screenshot(path=str(OUT/('analyze-'+str(width)+'.png')),full_page=False)
            page.locator('#v92Primary [data-v92-route="improve"]').click()
            page.wait_for_timeout(180)
            ck(str(width)+'px Learn maps to real Improve',page.evaluate('document.body.dataset.v92Route==="improve"'))
            page.screenshot(path=str(OUT/('learn-'+str(width)+'.png')),full_page=False)
            page.locator('#v92Primary [data-v92-route="library"]').click()
            page.wait_for_timeout(140)
            ck(str(width)+'px Library maps to preserved route',page.evaluate('document.body.dataset.v92Route==="library"'))
            page.screenshot(path=str(OUT/('library-'+str(width)+'.png')),full_page=False)
            page.locator('#v92Primary [data-v92-route="play"]').click()
            ck(str(width)+'px navigation never mutates game',page.evaluate('GomokuStudio.diagnostics().moves===0'))
        if width==390:
            page.locator('#point-112').tap()
            ck('touch move is pending before confirmation',page.evaluate('GomokuStudio.diagnostics().moves===0'))
            ck('touch confirmation remains reachable',page.locator('#placeBtn').is_visible() and page.locator('#placeBtn').is_enabled())
            page.locator('#placeBtn').tap()
            page.wait_for_function('GomokuStudio.diagnostics().moves>=1')
            ck('real move permitted after confirmation',page.evaluate('GomokuStudio.exportGame().moves[0].i===112'))
            page.screenshot(path=str(OUT/'mobile-confirmed.png'),full_page=False)
        context.close()
    browser.close()
ck('no uncaught JS errors',not errors)
# External origins remain outside the acceptance preview. Record rather than assume zero.
(OUT/'report.json').write_text(json.dumps({'checks':len(results),'passed':results,'pageErrors':errors,'externalRequests':network,'origin':URL,'physicalAndroid':'NOT_TESTED','ownerApproval':'UI A selected, release NO_GO'},indent=2))
print('U2_CHROMIUM_CHECKS='+str(len(results)),flush=True)
