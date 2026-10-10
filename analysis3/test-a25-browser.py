"""A25 REAL localhost Chromium desktop/mobile: source-compatible original-media handoff & NO_GO.
This is NOT a physical Android browser acceptance, authorized host or human rights attestation.
"""
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
from pathlib import Path
from playwright.sync_api import sync_playwright
import tempfile,json,hashlib,subprocess
ROOT=Path(__file__).resolve().parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/a25-field-kit.html'
count=0
MEDIA=b'SYNTHETIC A25 browser original media proof, NOT a physical device'
RIGHTS=b'SYNTHETIC unapproved operator rights document bytes'
BEFORE=b'FAKE A25 SW BEFORE';UPDATE=b'FAKE A25 SW CHANGED';PRIOR=b'FAKE A25 PREVIOUS STABLE'
def check(label,result):
 global count
 assert result,label
 count+=1
 print('PASS A25 Chromium '+label,flush=True)
def upload(page,selector,name,body):
 page.locator(selector).set_input_files({'name':name,'mimeType':'application/octet-stream','buffer':body})
def saved(page,button,tmp,name):
 with page.expect_download() as d:page.locator(button).click()
 p=tmp/name;d.value.save_as(str(p))
 return p
try:
 with tempfile.TemporaryDirectory(prefix='gomoku-a25-chromium-') as directory:
  tmp=Path(directory)
  with sync_playwright() as pw:
   browser=pw.chromium.launch(headless=True,args=['--no-sandbox'])
   for label,width,height in [('desktop',1280,720),('mobile-emulated',390,844)]:
    ctx=browser.new_context(viewport={'width':width,'height':height,},is_mobile=width==390,
     has_touch=width==390,reduced_motion='reduce',accept_downloads=True)
    page=ctx.new_page();errors=[];requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url))
    page.goto(url,wait_until='domcontentloaded')
    check(label+' explicit NO_GO',page.locator('#release-status').inner_text()=='NO-GO · HUMAN RELEASE BLOCKED')
    check(label+' physical genuinely accepted 0/18',page.locator('#physical-accepted').inner_text()=='0 / 18')
    check(label+' all 25 case definitions',page.locator('#case-select option').count()==25)
    check(label+' eight hosted original asset identities',page.locator('#host-assets li').count()==8)
    for category,expected in [('android-chrome',7),('samsung-internet',6),('installed-android-pwa',5),('accessibility',7)]:
     page.locator('#filter').select_option(category)
     check(label+' '+category+' source original case count',page.locator('#coverage li').count()==expected)
    page.locator('#filter').select_option('all')
    page.locator('#device-model').fill('FAKE PIXEL 9 - NOT ACTUAL HARDWARE')
    page.locator('#os-version').fill('SYNTHETIC ANDROID 15')
    page.locator('#browser-version').fill('SYNTHETIC CHROME 130')
    page.locator('#operator-id').fill('FAKE FIELD TEST OPERATOR')
    page.locator('#case-notes').fill('Synthetic localhost Chromium checked original bytes; no physical Android test was performed.')
    upload(page,'#source-file','original-media.png',MEDIA)
    page.locator('#evidence-form button').click()
    check(label+' missing rights original refuses ungrounded original', 'Rejected' in page.locator('#field-feedback').inner_text())
    upload(page,'#rights-original','unapproved-rights.pdf',RIGHTS)
    page.locator('#evidence-form button').click()
    page.wait_for_function("document.querySelector('#physical-pending').textContent==='1 / 18'")
    check(label+' WebCrypto hashes both original bytes into pending list',
     'pending independent' in page.locator('#field-feedback').inner_text().lower() and
     page.locator('#physical-pending').inner_text()=='1 / 18')
    check(label+' no media accepted by code',page.locator('#physical-accepted').inner_text()=='0 / 18')
    manifestPath=saved(page,'#export-cli',tmp,label+'-manifest.json')
    manifest=json.loads(manifestPath.read_text())
    check(label+' exported manifest EXACT compatible A24 original schema',
     manifest['format']=='GomokuA24FieldOriginalIntake' and
     manifest['sourceSha']=='fca45816ed7d3a95bae550b9aa644e29053875f6' and
     manifest['a23Head']=='d36610bc49aa0cee03f3a649108fda98e99094ee' and
     manifest['humanOwnerApproval']=='NOT_OBTAINED' and
     manifest['physicalCasesAccepted']==0 and
     len(manifest['cases'])==1 and not manifest['accessibility'] and
     manifest['cases'][0]['originalFile']=='media/android-chrome/fresh-launch.bin' and
     manifest['cases'][0]['sha256']==hashlib.sha256(MEDIA).hexdigest() and
     manifest['cases'][0]['ownerRightsIntakeSha256']==hashlib.sha256(RIGHTS).hexdigest())
    binaryPath=saved(page,'#save-original',tmp,label+'-physical.bin')
    check(label+' saved untouched original MEDIA bytes separately',binaryPath.read_bytes()==MEDIA)
    sourceRoot=tmp/(label+'-custody-root');(sourceRoot/'media/android-chrome').mkdir(parents=True)
    (sourceRoot/'media/android-chrome/fresh-launch.bin').write_bytes(binaryPath.read_bytes())
    target=tmp/(label+'-a24-verified.json')
    r=subprocess.run(['node',str(ROOT/'a24-field-intake.cjs'),'--mode','field',
     '--manifest',str(manifestPath),'--root',str(sourceRoot),'--out',str(target)],
     capture_output=True,text=True)
    check(label+' REAL browser-produced manifest accepted by A24 CLI against original file',
     r.returncode==0 and json.loads(target.read_text())['pendingCaseCount']==1 and
     json.loads(target.read_text())['physicallyAcceptedBySoftware']==0)
    page.locator('#host-check').click()
    check(label+' blank host rejected','Rejected' in page.locator('#host-feedback').inner_text())
    page.locator('#host-url').fill('https://gomoku.thiepn.dev/')
    page.locator('#host-check').click()
    check(label+' production host still rejected','Rejected' in page.locator('#host-feedback').inner_text())
    page.locator('#host-url').fill('https://isolated-operator-source.vercel.app/')
    page.locator('#host-check').click()
    hostPath=saved(page,'#export-host-template',tmp,label+'-host.json')
    host=json.loads(hostPath.read_text())
    check(label+' capture template eight missing responses and zero rights',
     len(host['responses'])==8 and
     all(row['status'] is None and row['capturedSha256'] is None for row in host['responses']) and
     host['ownerAuthorizationState']=='NOT_GRANTED' and
     page.locator('#host-accepted').inner_text()=='0')
    page.locator('#export-rollback').click()
    check(label+' incomplete recovery original rejected','Rejected' in page.locator('#sidecar-feedback').inner_text())
    upload(page,'#sw-before','previous-sw.js',BEFORE)
    upload(page,'#sw-updated','updated-sw.js',UPDATE)
    upload(page,'#sw-reverted','reverted-sw.js',BEFORE)
    upload(page,'#prior-stable','prior-original.bin',PRIOR)
    page.locator('#rollback-check').click()
    page.wait_for_function("document.querySelector('#rollback-feedback').textContent.includes('NO actual same-origin SW update')")
    rollbackPath=saved(page,'#export-rollback',tmp,label+'-rollback.json')
    rollback=json.loads(rollbackPath.read_text())
    check(label+' genuine original SW bytes hash and A24 rollback manifest compatible',
     rollback['format']=='GomokuA24OfflineRollbackReview' and
     rollback['ownerRestoreApproval']=='NOT_OBTAINED' and
     rollback['realPlayerDataRestored'] is False and
     rollback['beforeSwSha256']==rollback['revertedSwSha256'] and
     rollback['beforeSwSha256']!=rollback['updatedSwSha256'])
    (sourceRoot/'sw').mkdir();(sourceRoot/'prior').mkdir()
    for filename,content in [('before',BEFORE),('updated',UPDATE),('reverted',BEFORE)]:
     (sourceRoot/'sw'/f'{filename}.bin').write_bytes(content)
    (sourceRoot/'prior/previous-stable.bin').write_bytes(PRIOR)
    rollbackVerified=tmp/(label+'-verified-rollback.json')
    command=subprocess.run(['node',str(ROOT/'a24-field-intake.cjs'),'--mode','rollback',
      '--manifest',str(rollbackPath),'--root',str(sourceRoot),'--out',str(rollbackVerified)],
      capture_output=True,text=True)
    check(label+' browser-produced rollback manifest accepted by A24 CLI but NO_GO',
     command.returncode==0 and json.loads(rollbackVerified.read_text())['decision']=='NO_GO')
    page2=ctx.new_page();page2.goto(url,wait_until='domcontentloaded')
    upload(page2,'#import-cli','previous.json',manifestPath.read_bytes())
    page2.locator('#load-cli').click()
    check(label+' reimport original receipt requires reselect binaries',
     'RESELECT ORIGINAL' in page2.locator('#coverage').inner_text() and
     page2.locator('#physical-pending').inner_text()=='0 / 18')
    page2.locator('#device-model').fill('FAKE PIXEL 9 - NOT ACTUAL HARDWARE')
    page2.locator('#os-version').fill('SYNTHETIC ANDROID 15')
    page2.locator('#browser-version').fill('SYNTHETIC CHROME 130')
    page2.locator('#operator-id').fill('FAKE FIELD TEST OPERATOR')
    page2.locator('#case-notes').fill('A25 reselect original bytes; no genuine human or device was ever independently verified.')
    upload(page2,'#source-file','mutated.png',b'DIFFERENT ORIGINAL BYTES')
    upload(page2,'#rights-original','same-rights.pdf',RIGHTS)
    page2.locator('#evidence-form button').click()
    page2.wait_for_function("document.querySelector('#field-feedback').textContent.includes('BLOCKED: imported')")
    check(label+' conflicting reimport original media SHA triggers manual custody block',
     page2.locator('#physical-pending').inner_text()=='0 / 18')
    upload(page2,'#source-file','correct.png',MEDIA)
    page2.locator('#evidence-form button').click()
    page2.wait_for_function("document.querySelector('#physical-pending').textContent==='1 / 18'")
    check(label+' matching reselected media AND rights hash resumes pending state only',
     page2.locator('#physical-accepted').inner_text()=='0 / 18' and
     page2.locator('#physical-pending').inner_text()=='1 / 18')
    check(label+' no remote host requests',all(u.startswith('http://127.0.0.1:') for u in requests))
    check(label+' no JS errors',not errors)
    check(label+' 100% zoom has no horizontal overflow',
     page.evaluate('document.documentElement.scrollWidth<=innerWidth+3'))
    if label=='desktop':
     page.locator('#case-select').focus();page.keyboard.press('Tab')
     check(label+' keyboard to device',page.evaluate("document.activeElement.id==='device-model'"))
     page.evaluate("document.body.style.zoom='2'")
     check(label+' 200% zoom has no horizontal overflow',
      page.evaluate('document.documentElement.scrollWidth<=innerWidth+3'))
    ctx.close()
   browser.close()
finally:
 server.shutdown();server.server_close()
print(f'{count} A25 real Chromium original upload/import/CLI/rollback/rights tests passed. No real hosted/device/human authority.')
