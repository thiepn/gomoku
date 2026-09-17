"""Cross-feature regression audit. AUDIT_URL uses native HTTP-origin storage.
Local runs use an explicit storage shim and do not establish installed-PWA behavior.
"""
import os,json,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_support import ROOT,load,click,state,fixture
OUT=ROOT/'audit-test-output';OUT.mkdir(exist_ok=True)
PASS=[];FAIL=[]
def check(name,condition=True):
    assert condition,name
    PASS.append(name);print('PASS '+name,flush=True)
def dialogs(page):page.evaluate('document.querySelectorAll("dialog[open]").forEach(d=>d.close())')
def import_game(page,g):page.evaluate('(g)=>GomokuStudio.importGame(g)',g);dialogs(page)
def raw(page,key):return page.evaluate('(k)=>localStorage.getItem(k)',key)
def fault(page,key):
    page.evaluate('''key=>{window.__quotaKey=key;if(!window.__auditStore&&!window.__originalSetItem){window.__originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===window.__quotaKey)throw new DOMException('Test storage full','QuotaExceededError');return __originalSetItem.call(this,k,v)}}}''',key)
def conflict(page,g):
    page.evaluate('''g=>{const key='gomoku.studio.v3',old=localStorage.getItem(key),value=JSON.stringify(g);localStorage.setItem(key,value);dispatchEvent(new StorageEvent('storage',{key,oldValue:old,newValue:value}));}''',g)
def upload(page,data,accept=True):
    page.locator('#backupFile').set_input_files({'name':'audit-backup.json','mimeType':'application/json','buffer':json.dumps(data).encode()})
    if accept:
        page.locator('#confirmDialog[open]').wait_for();click(page,'confirmAccept');page.wait_for_timeout(500)
    else:page.wait_for_timeout(200)
def scan(page):page.wait_for_function('GomokuReview.state()?.results.every(Boolean)&&!GomokuReview.state().scanning',timeout=30000)
def group(name,fn,seed=None,mobile=False):
    ctx=None
    try:
        ctx,pg,errors=load(browser,seed,mobile);fn(pg)
        check(name+' has no uncaught browser errors',not errors)
    except Exception as e:
        FAIL.append({'group':name,'error':str(e),'trace':traceback.format_exc()});print('FAIL '+name+': '+str(e),flush=True)
        if ctx:
            try:pg.screenshot(path=str(OUT/('FAILED-'+name+'.png')),full_page=True)
            except:pass
    finally:
        if ctx:ctx.close()

def markup(pg):
    check('page metadata belongs to the document head, not an implicitly opened body',pg.evaluate('!!document.head.querySelector("title")&&!!document.head.querySelector("meta[name=viewport]")&&!!document.head.querySelector("link[rel=manifest]")'))
    check('app starts without duplicate element IDs',pg.evaluate('(()=>{const ids=[...document.querySelectorAll("[id]")].map(x=>x.id);return new Set(ids).size===ids.length})()'))

def offline(pg):
    from urllib.parse import urljoin
    root=urljoin(os.environ['AUDIT_URL'],'./')
    pg.evaluate('navigator.serviceWorker.ready.then(()=>true)')
    pg.wait_for_function('!!navigator.serviceWorker.controller',timeout=20000)
    check('hosted app is controlled by its service worker',True)
    pg.goto(urljoin(root,'ui/'),wait_until='domcontentloaded')
    check('documentation navigation is not the game page',not pg.locator('#boardGrid').count())
    pg.context.set_offline(True)
    try:
        pg.goto(root,wait_until='domcontentloaded');pg.wait_for_function('document.body.dataset.uiReady==="true"',timeout=20000)
        check('offline return after documentation still loads the game, not cached documentation',pg.locator('#boardGrid').count()==1)
        pg.reload(wait_until='domcontentloaded');pg.wait_for_function('document.body.dataset.uiReady==="true"',timeout=20000)
        check('offline reload retains the app shell',pg.locator('#boardGrid').count()==1)
    finally:pg.context.set_offline(False)

def legacy(pg):
    g={**fixture('renju-practice'),'moves':[{'i':0,'color':1},{'i':1,'color':2},{'i':16,'color':1},{'i':17,'color':2}]}
    import_game(pg,g);check('legacy off-center Renju game imports through the full app',state(pg)['moves']==g['moves'])
    check('imported game preserves its legacy marker',state(pg)['renjuCenterRule'] is False)
    code=pg.evaluate('GomokuStudio.encode()');decoded=pg.evaluate('(s)=>GomokuStudio.decode(s)',code)
    check('shared legacy study decodes without changing moves',decoded['moves']==g['moves'] and decoded['renjuCenterRule'] is False)
    sgf=pg.evaluate('GomokuStudio.exportSGF()');pg.evaluate('(s)=>GomokuStudio.importSGF(s)',sgf)
    check('full-app legacy SGF round-trip succeeds',state(pg)['moves']==g['moves'])
    check('Guided Review opens for a legacy game',pg.evaluate('GomokuReview.open({ply:1})'))
    scan(pg);check('legacy opening is not falsely graded illegal',pg.evaluate('GomokuReview.state().results[0].label')!='Illegal')
    pg.screenshot(path=str(OUT/'legacy-review.png'));pg.evaluate('GomokuReview.close()')
    check('closing review preserves legacy game',state(pg)['moves']==g['moves'])

def conflicts(pg):
    pg.evaluate('window.__realNow=Date.now;Date.now=()=>1789657200000')
    import_game(pg,fixture());g=state(pg);other={**g,'title':'OTHER TAB'};conflict(pg,other)
    check('other-tab changes pause the current board',pg.evaluate('GomokuStudio.diagnostics().storage.conflict'))
    click(pg,'keepLocalBtn');stored=json.loads(raw(pg,'gomoku.studio.v3'))
    check('Keep this board actually writes even an identical local snapshot',stored['title']==g['title'] and not pg.evaluate('GomokuStudio.diagnostics().storage.conflict'))
    invalid=json.loads(json.dumps(g));invalid['studio']['tree']['nodes']=[];conflict(pg,invalid);click(pg,'loadLatestBtn')
    check('invalid remote study extension leaves conflict unresolved',pg.evaluate('GomokuStudio.diagnostics().storage.conflict'))
    check('rejected remote extension leaves recorded moves unchanged',state(pg)['moves']==g['moves'])
    fault(pg,'gomoku.studio.v3');click(pg,'keepLocalBtn')
    check('failed Keep does not falsely claim the board was autosaved',pg.evaluate('GomokuStudio.diagnostics().storage.conflict') and 'Could not keep' in pg.locator('#toastMsg').inner_text())
    fault(pg,None);click(pg,'keepLocalBtn');check('Keep can be retried after storage becomes writable',not pg.evaluate('GomokuStudio.diagnostics().storage.conflict'))

def backups(pg):
    import_game(pg,fixture());pg.evaluate('GomokuCourseChapter1.open()');pg.locator('#ch1Board button[data-i="42"]').click();dialogs(pg)
    pg.evaluate('GomokuCourseChapter9.openSection(3,2)');dialogs(pg)
    b=pg.evaluate('GomokuStudio.backup()');key='gomoku.course.chapter1.v1'
    check('full backup includes actual completed chapter progress',key in b['courses'] and json.loads(b['courses'][key])['tasks'])
    check('full backup includes later chapter resume position','gomoku.course.chapter9.v1' in b['courses'])
    # Clear the records and add an unrelated, newer chapter; full restore must be a real replacement.
    pg.evaluate('''()=>{for(const key of GomokuCourseStorage.keys)localStorage.removeItem(key);localStorage.setItem('gomoku.course.chapter14.v1',JSON.stringify({version:1,tasks:{x:{correct:true}}}));GomokuCourseStorage.reloaded(GomokuCourseStorage.keys)}''')
    upload(pg,b)
    check('full restore restores completed chapter records exactly',raw(pg,key)==b['courses'][key])
    check('restored course progress refreshes in memory without a reload',pg.evaluate('GomokuCourseChapter1.report().lessons[0].done')==1)
    if 'gomoku.course.chapter14.v1' not in b['courses']:check('full course restore removes newer records absent from the backup',raw(pg,'gomoku.course.chapter14.v1') is None)
    check('full restore preserves the active game',state(pg)['moves']==b['active']['moves'])
    # The chapter-9 original resume handler uses persisted lesson/task locations.
    pg.locator('#v92Primary button[data-v92-route="improve"]').click();pg.locator('[data-open-chapter="9"]').click()
    check('later chapter resumes the restored section',pg.locator('#ch9CourseDialog .ch9-score').inner_text().startswith('Lesson 4'));dialogs(pg)
    old={k:v for k,v in b.items() if k!='courses'};upload(pg,old)
    check('old backups without course data do not erase chapter progress',raw(pg,key)==b['courses'][key])
    tampered=json.loads(json.dumps(b));tampered['courses']['unrelated.private.key']='{}';before=state(pg)['moves'];upload(pg,tampered,False)
    check('unexpected course backup keys are rejected before confirmation',not pg.locator('#confirmDialog').is_visible() and state(pg)['moves']==before and raw(pg,'unrelated.private.key') is None)
    fault(pg,'gomoku.course.chapter9.v1');replacement=json.loads(json.dumps(b));replacement['courses'][key]=json.dumps({'version':1,'tasks':{}});original=raw(pg,key);upload(pg,replacement)
    check('failed multi-chapter restore rolls earlier writes back',raw(pg,key)==original and state(pg)['moves']==before);fault(pg,None)
    recovery={'format':'GomokuCourseProgress','version':1,'courses':{key:json.dumps({'version':1,'tasks':{}})}};upload(pg,recovery)
    check('course-only recovery files can be imported without replacing a game',pg.evaluate('GomokuCourseChapter1.report().lessons[0].done')==0 and state(pg)['moves']==before)
    if os.getenv('AUDIT_URL'):
        # Native origin reload is deliberately excluded from the local storage-emulation run.
        pg.reload(wait_until='domcontentloaded');pg.wait_for_function('document.body.dataset.uiReady==="true"');pg.wait_for_timeout(1000);dialogs(pg)
        check('native-origin reload preserves restored games and chapter records',state(pg)['moves']==before and raw(pg,key)==recovery['courses'][key])

def corruption(pg):
    check('corrupt course data does not prevent the whole app from starting',pg.evaluate('GomokuAppearance.courseSummary().length')==14)
    key='gomoku.course.chapter6.v1';before=raw(pg,key)
    pg.evaluate('GomokuCourseChapter6.openSection(0,0)');check('damaged chapter still opens',pg.locator('#ch6CourseDialog').is_visible());dialogs(pg)
    check('damaged original record is retained, not silently overwritten',raw(pg,key)==before)
    check('damaged course storage shows an explicit recovery notice',pg.locator('#courseStorageNotice').is_visible())
    pg.screenshot(path=str(OUT/'storage-recovery.png'))
    restored={key:json.dumps({'version':1,'tasks':{}})};pg.evaluate('(data)=>GomokuCourseStorage.restore(data)',restored)
    check('valid recovered course record clears the damaged status',key not in pg.evaluate('GomokuCourseStorage.status().damaged'))

def quota(pg):
    key='gomoku.course.chapter2.v1';fault(pg,key);pg.evaluate('GomokuCourseChapter2.open()')
    check('course quota failure does not prevent opening a lesson',pg.locator('#ch2CourseDialog').is_visible());dialogs(pg)
    check('quota failure is reported rather than shown as a durable save',pg.locator('#courseStorageNotice').is_visible())
    record=json.dumps({'version':1,'tasks':{'audit':{'correct':True}}});pg.evaluate('([k,v])=>GomokuCourseStorage.setItem(k,v)',[key,record])
    check('unsaved chapter progress remains readable within the tab',pg.evaluate('(k)=>GomokuCourseStorage.getItem(k)',key)==record)
    check('full backup includes in-memory progress after quota failure',pg.evaluate('GomokuStudio.backup().courses')[key]==record)
    fault(pg,None);pg.evaluate('([k,v])=>GomokuCourseStorage.setItem(k,v)',[key,record])
    check('course writes recover without losing progress after quota is freed',raw(pg,key)==record)
    check('storage warning clears after successful persistence',not pg.locator('#courseStorageNotice').count())

def pass_review(pg):
    g={**fixture(),'moves':[{'i':112,'color':1},{'i':97,'color':2},{'i':113,'color':1},{'i':-1,'color':2},{'i':-1,'color':1}]}
    import_game(pg,g);check('full game recognizes two consecutive passes as a draw',pg.evaluate('createEngine("freestyle").validateSave(GomokuStudio.exportGame()).result.reason')=='passes')
    pg.evaluate('GomokuReview.open({ply:5})');scan(pg)
    check('post-game review labels the second pass as a draw',pg.evaluate('GomokuReview.state().results[4].label')=='Draw by passes')
    pg.evaluate('GomokuReview.showBest()')
    check('a draw branch disables the engine-reply button',pg.locator('#grReply').is_disabled())
    before=state(pg)['moves'];pg.evaluate('GomokuReview.close()');check('pass review never adds a phantom continuation to the match',state(pg)['moves']==before)

def invalid_imports(pg):
    import_game(pg,fixture());before=state(pg)['moves']
    for label,change in [('wrong color',{'moves':[{'i':112,'color':2}]}),('duplicate point',{'moves':[{'i':112,'color':1},{'i':112,'color':2}]}),('unknown rule',{'variant':'not-a-rule'}),('bad study',{'studio':{'tree':{'version':1,'nodes':[]}}})]:
        g={**fixture(),**change};answer=pg.evaluate('(g)=>{try{GomokuStudio.importGame(g);return "accepted"}catch(e){return "rejected"}}',g)
        check('invalid import rejected atomically: '+label,answer=='rejected' and state(pg)['moves']==before)
    pg.evaluate('window.__xss=0');g={**fixture(),'title':'<img src=x onerror="__xss=1">'};import_game(pg,g)
    click(pg,'saveGameBtn') if pg.locator('#saveGameBtn').count() else None
    check('supplied game title does not execute HTML',pg.evaluate('window.__xss')==0)

def game_controls(pg):
    import_game(pg,fixture());click(pg,'undoBtn');check('local Undo removes exactly one move',len(state(pg)['moves'])==3);click(pg,'redoBtn');check('Redo restores the undone move',len(state(pg)['moves'])==4)
    click(pg,'passBtn');check('pass button preserves board while recording the turn',state(pg)['moves'][-1]['i']==-1)
    click(pg,'passBtn');check('two UI pass actions end in a draw',pg.evaluate('createEngine("freestyle").validateSave(GomokuStudio.exportGame()).result.winner')==0);dialogs(pg)
    import_game(pg,fixture());click(pg,'resignBtn');click(pg,'confirmAccept');check('resignation records a terminal result without adding stones',state(pg)['terminal']['reason']=='resign' and len(state(pg)['moves'])==4);dialogs(pg)
    # Strict Renju opening via original interactive controls.
    g={**fixture('renju-practice'),'moves':[],'renjuCenterRule':True};import_game(pg,g)
    pg.locator('#boardGrid [data-i="0"]').click();check('interactive Renju rejects an off-center opening',len(state(pg)['moves'])==0)
    pg.locator('#boardGrid [data-i="112"]').click();check('interactive Renju accepts the center opening',state(pg)['moves']==[{'i':112,'color':1}])

def failed_new_game(pg):
    g={**fixture(),'mode':'ai','humanColor':1,'level':'first','moves':[{'i':112,'color':1}]};import_game(pg,g);original_id=state(pg)['gameId']
    # Inject a quota failure on the Library backend actually used by this browser.
    fault(pg,'gomoku.studio.library.v1')
    pg.evaluate("""()=>{window.__libraryBlocked=true;const original=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(stores,mode,...rest){if(__libraryBlocked&&this.name==='gomoku.studio.library.v51'&&mode==='readwrite')throw new DOMException('Test Library quota','QuotaExceededError');return original.call(this,stores,mode,...rest)}}""")
    click(pg,'newBtn');pg.evaluate('document.getElementById("preserveBeforeNew").checked=true');pg.locator('#newForm').evaluate('(f)=>f.requestSubmit()')
    pg.wait_for_function('GomokuStudio.exportGame().moves.length===2',timeout=15000)
    check('failed new-game preservation resumes the interrupted opponent turn',state(pg)['moves'][0]==g['moves'][0] and len(state(pg)['moves'])==2)
    check('failed preservation never replaces the original game identity',state(pg)['gameId']==original_id)
    pg.evaluate('window.__libraryBlocked=false');fault(pg,None);dialogs(pg)

def tools(pg):
    import_game(pg,fixture());before=state(pg)['moves']
    for name,query in [('statistics','Statistics'),('opening lab','Opening laboratory'),('opening database','Opening database'),('repertoire','Rehearse current study')]:
        click(pg,'commandBtn');pg.locator('#commandInput').fill(query);pg.locator('#commandResults button').first.click();pg.wait_for_timeout(150)
        check(name+' opens without modifying the recorded game',bool(pg.locator('dialog[open]').count()) and state(pg)['moves']==before);dialogs(pg)
    check('specialist tools leave ordinary play usable',pg.locator('#boardGrid').is_visible())

def ai(pg):
    g={**fixture(),'mode':'ai','humanColor':2,'level':'first','moves':[]};import_game(pg,g)
    # Import intentionally pauses engine queuing; use real new-game submission to start play.
    click(pg,'newBtn');pg.locator('#newDialog').get_by_role('button',name='Vs computer',exact=False).click();pg.locator('#ruleSelect').select_option('renju-practice');pg.locator('#colorSelect').select_option('2');pg.locator('#levelSelect').select_option('first')
    pg.locator('#newForm').evaluate('(f)=>f.requestSubmit()');pg.wait_for_function('GomokuStudio.exportGame().moves.length===1',timeout=15000);dialogs(pg)
    check('AI playing Black starts Renju at the center via the live engine',state(pg)['moves'][0]['i']==112)
    # Play White and then replace the game while the old AI task may still be in flight.
    pg.evaluate('''()=>{const n=document.querySelector('#boardGrid [data-i="97"]');n.click();const c=document.getElementById('placeBtn');if(c&&!c.disabled)c.click();}''')
    replacement=fixture();replacement['title']='Replacement';import_game(pg,replacement);pg.wait_for_timeout(1800)
    check('late AI results cannot mutate a replacement game',state(pg)['moves']==replacement['moves'] and state(pg)['title']=='Replacement')

with sync_playwright() as p:
    exe=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium');engine=os.getenv('BROWSER_ENGINE','chromium');browser=getattr(p,engine).launch(**({'executable_path':exe if Path(exe).exists() else None,'args':['--no-sandbox']} if engine=='chromium' else {}))
    for name,fn in [('markup',markup),('legacy',legacy),('conflicts',conflicts),('backups',backups),('quota',quota),('pass-review',pass_review),('invalid-imports',invalid_imports),('game-controls',game_controls),('specialist-tools',tools),('ai',ai),('failed-new-game',failed_new_game)]:group(name,fn)
    if os.getenv('AUDIT_URL') and os.getenv('BROWSER_ENGINE','chromium')=='chromium':group('offline-navigation',offline)
    group('corrupt-chapter',corruption,{'gomoku.course.chapter6.v1':'{"version":1,"tasks":null}'})
    browser.close()
(OUT/'browser.json').write_text(json.dumps({'origin':os.getenv('AUDIT_URL') or 'set_content with explicit localStorage shim','passed':len(PASS),'failedGroups':len(FAIL),'checks':PASS,'failures':FAIL},indent=2))
print(f'{len(PASS)} cross-feature browser assertions passed; {len(FAIL)} failed groups',flush=True)
if FAIL:raise SystemExit(1)
