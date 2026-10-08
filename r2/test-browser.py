"""R2 observed cold-start and game-first functionality, desktop + mobile."""
from pathlib import Path
import json,os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'r2-test-output';OUT.mkdir(exist_ok=True)
URL=os.environ['R2_URL'];rows=[]
with sync_playwright() as p:
    browser=p.chromium.launch(args=['--no-sandbox'])
    for label,width,height,mobile in [('desktop',1360,960,False),('mobile',390,844,True)]:
        context=browser.new_context(viewport={'width':width,'height':height},is_mobile=mobile,has_touch=mobile,reduced_motion='reduce',service_workers='block')
        page=context.new_page();page.set_default_timeout(24000);errors=[]
        page.add_init_script("localStorage.setItem('gomoku.v112.onboarding.seen','1')")
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(URL,wait_until='domcontentloaded',timeout=45000)
        page.wait_for_function('document.body.dataset.uiReady==="true" && document.body.dataset.ready==="true" && !!window.GomokuPlayer2',timeout=24000)
        boot=page.evaluate('performance.now()')
        assert boot<16000,(label,'cold boot exceeded generous CI ceiling',boot)
        assert page.locator('#boardGrid').is_visible(),label+' must open the board'
        assert page.locator('#pj2Home').is_hidden(),label+' should not open a dashboard'
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2'),label+' has horizontal overflow'
        # Online is always entered via the real supported launcher.
        page.locator('#v111MenuBtn').click()
        page.wait_for_function('!!document.querySelector("#v12PrivateRoomMenu")')
        page.locator('#v12PrivateRoomMenu').click()
        page.locator('#oc2Home').wait_for(state='visible',timeout=20000)
        node=page.locator('#oc2Grid .oc2-destination').first
        node.focus()
        assert page.evaluate('''()=>{let b=document.querySelector('#oc2Grid .oc2-destination');
          GomokuOnline2.refresh();return b===document.querySelector('#oc2Grid .oc2-destination')&&document.activeElement===b;}'''),label+' online refresh replaced focused button'
        page.keyboard.press('Escape')
        page.locator('#v92Primary [data-v92-route="improve"]').click()
        page.wait_for_function('document.querySelectorAll("#uiCourseGrid .c20-tile-demo").length===14',timeout=20000)
        chapter=page.locator('#ch1CourseDialog .c20-checkpoint').first
        assert chapter.count()==1,label+' course checkpoint missing'
        baseline=page.evaluate('''()=>{const bar=document.querySelector('#ch1CourseDialog .c20-checkpoint');
          GomokuCourse2.refresh();return document.querySelector('#ch1CourseDialog .c20-checkpoint')===bar;}''')
        assert baseline,label+' course refresh recreated unchanged checkpoint'
        metrics=page.evaluate('''()=>({ready:performance.now(),domInteractive:performance.getEntriesByType('navigation')[0]?.domInteractive||0,
          htmlBytes:document.documentElement.outerHTML.length,studentSkills:GomokuLearningV11.snapshot()?.skills?.length||0})''')
        assert metrics['studentSkills']==35,label+' learning model incomplete'
        assert not errors,(label,errors)
        rows.append({'profile':label,'startupMs':round(boot,1),'domInteractiveMs':round(metrics['domInteractive'],1),'skills':metrics['studentSkills'],'errors':errors})
        context.close()
    browser.close()
(OUT/'startup.json').write_text(json.dumps({'version':'r2.runtime.v1','profiles':rows,'description':'Observed local Chromium cold launch, board-first interaction, online focus and Course 2.0 idempotent render; not a real phone or WAN benchmark.'},indent=2)+'\n')
print('PASS R2 runtime cold-start and scoped-refresh browser acceptance:',json.dumps(rows),flush=True)
