"""Real local Chromium browser tests for OFFLINE A21 custody desk; not physical Android acceptance."""
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/a21-custody-desk.html'
count=0
def check(name,yes):
 global count
 assert yes,name
 count+=1
 print('PASS A21 Chromium '+name,flush=True)
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=['--no-sandbox'])
  for label,width,height in [('desktop',1280,720),('mobile-emulated',390,844)]:
   ctx=browser.new_context(viewport={'width':width,'height':height},
    is_mobile=width==390,has_touch=width==390,
    reduced_motion='reduce',accept_downloads=True)
   pg=ctx.new_page();requests=[];errors=[]
   pg.on('request',lambda r:requests.append(r.url))
   pg.on('pageerror',lambda e:errors.append(str(e)))
   pg.goto(url,wait_until='domcontentloaded')
   check(label+' default NO-GO',pg.locator('#status').inner_text()=='NO-GO · RELEASE BLOCKED')
   check(label+' physical counter 0/18',pg.locator('#accepted').inner_text()=='0 / 18')
   check(label+' no signer keys',pg.locator('#signers').inner_text()=='0 / 5')
   check(label+' nine original release gates',pg.locator('#gates .gate').count()==9)
   check(label+' original Chrome seven cases',pg.locator('#case-list li').count()==7)
   pg.locator('#platform').select_option('samsung-internet')
   check(label+' Samsung six cases',pg.locator('#case-list li').count()==6)
   pg.locator('#platform').select_option('installed-android-pwa')
   check(label+' real PWA five cases remain untested',pg.locator('#case-list li').count()==5)
   pg.locator('#platform').select_option('android-chrome')
   pg.locator('#review button').click()
   check(label+' missing original rejected','Rejected' in pg.locator('#feedback').inner_text())
   pg.locator('#device').fill('SYNTHETIC TEST DESKTOP · NOT ANDROID')
   pg.locator('#sha').fill('f'*64)
   pg.locator('#observation').fill('Synthetic browser fixture used for code QA; not a real handheld phone result.')
   pg.locator('#review button').click()
   check(label+' case entered pending only',pg.locator('#case-list li small').first.inner_text()=='PENDING REVIEW')
   check(label+' never increment physical counter',pg.locator('#accepted').inner_text()=='0 / 18')
   pg.locator('#review button').click()
   check(label+' duplicate case entry rejected','Rejected' in pg.locator('#feedback').inner_text())
   pg.locator('#nonce-form button').click()
   check(label+' missing nonce/operator is rejected', 'Rejected' in pg.locator('#nonce-feedback').inner_text())
   pg.locator('#nonce').fill('a'*32)
   pg.locator('#operator').fill('SYNTHETIC REVIEWER NOT A HUMAN SIGNER')
   pg.locator('#packet-sha').fill('b'*64)
   pg.locator('#nonce-form button').click()
   check(label+' nonce remains local unauthenticated note',
    'NOT globally consumed' in pg.locator('#nonce-feedback').inner_text())
   pg.locator('#nonce-form button').click()
   check(label+' duplicate challenge locally blocked',
    'BLOCKED' in pg.locator('#nonce-feedback').inner_text() and
    'CONFLICT' in pg.locator('#conflict-list').inner_text())
   pg.locator('#escrow-form button').click()
   check(label+' incomplete external original custody refused','Rejected' in pg.locator('#escrow-feedback').inner_text())
   pg.locator('#escrow-object').fill('ORIGINAL-OBJECT-A')
   pg.locator('#escrow-custodian').fill('SYNTHETIC INDEPENDENT PROVIDER TEST ONLY')
   pg.locator('#escrow-sha').fill('a'*64)
   pg.locator('#escrow-form button').click()
   check(label+' first external original remains unauthenticated',
    'provider not contacted' in pg.locator('#escrow-feedback').inner_text() and
    'PENDING' in pg.locator('#escrow-list').inner_text())
   pg.locator('#escrow-sha').fill('b'*64)
   pg.locator('#escrow-form button').click()
   check(label+' conflicting original byte digest triggers unresolved custody',
    'BLOCKED' in pg.locator('#escrow-feedback').inner_text() and
    'UNRESOLVED' in pg.locator('#escrow-list').inner_text())
   check(label+' escrow disputes never increase real physical acceptance',pg.locator('#accepted').inner_text()=='0 / 18')
   with pg.expect_download() as download:
    pg.locator('#export').click()
   file=ROOT/'a21-custody-temp-export.json'
   download.value.save_as(str(file));report=json.loads(file.read_text());file.unlink()
   check(label+' unsigned source-anchored draft has no authority',
    report['format']=='GomokuA21UnsignedEscrowDraft' and
    report['releaseState']=='NO_GO' and report['actualPhysicalCasesAccepted']==0 and
    report['realSignerRoots']==0 and report['ownerApproved'] is False and
    report['canDeploy'] is False and report['canCloseRelease'] is False and
    len(report['notes'])==1 and len(report['unverifiedLocalNonces'])==1 and
    len(report['unsignedOriginals'])==1 and len(report['unresolvedEscrowDisputes'])==1 and
    report['unresolvedEscrowDisputes'][0]['status']=='UNRESOLVED_MANUAL_REVIEW' and
    report['notes'][0]['status']=='pending-independent-human-original-review')
   check(label+' no overflowing horizontal content',pg.evaluate('document.documentElement.scrollWidth<=innerWidth+2'))
   check(label+' no external network or hosted source requests',all(x.startswith('http://127.0.0.1:') for x in requests))
   check(label+' no JavaScript errors',not errors)
   if label=='desktop':
    pg.locator('#platform').focus();pg.keyboard.press('Tab')
    check(label+' keyboard tab reaches case selector',pg.evaluate("document.activeElement?.id==='case'"))
    pg.evaluate("document.body.style.zoom='2'")
    check(label+' 200% zoom horizontally unclipped',pg.evaluate('document.documentElement.scrollWidth<=innerWidth+2'))
   ctx.close()
  browser.close()
finally:
 server.shutdown();server.server_close()
print(f'{count} A21 REAL local Chromium tests passed. ZERO real devices, human approvals or production operations.')
