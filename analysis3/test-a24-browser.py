"""A24 real Chromium desktop and emulated mobile browser checks (NOT real physical Android)."""
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
from pathlib import Path
import json,hashlib
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args): pass
srv=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=srv.serve_forever,daemon=True).start()
URL=f'http://127.0.0.1:{srv.server_port}/a24-field-kit.html'
passed=0
def check(name,value):
 global passed
 assert value,name
 passed+=1
 print('PASS A24 Chromium '+name,flush=True)
def upload(page,selector,label,data):
 page.locator(selector).set_input_files({'name':label,'mimeType':'application/octet-stream','buffer':data})
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=['--no-sandbox'])
  for label,w,h in [('desktop',1280,720),('mobile-emulated',390,844)]:
   ctx=browser.new_context(viewport={'width':w,'height':h},is_mobile=w==390,
    has_touch=w==390,accept_downloads=True,reduced_motion='reduce')
   page=ctx.new_page();errors=[];requests=[]
   page.on('pageerror',lambda e: errors.append(str(e)))
   page.on('request',lambda r: requests.append(r.url))
   page.goto(URL,wait_until='domcontentloaded')
   check(label+' default permanent NO_GO',page.locator('#release-status').inner_text()=='NO-GO · HUMAN RELEASE BLOCKED')
   check(label+' original real accepted 0/18',page.locator('#physical-accepted').inner_text()=='0 / 18')
   check(label+' 25 required source-original case entries',page.locator('#case-select option').count()==25)
   check(label+' original 8 hosted asset evidence checklist',page.locator('#host-assets li').count()==8)
   page.locator('#filter').select_option('android-chrome')
   check(label+' seven Chrome original case cards',page.locator('#coverage li').count()==7)
   page.locator('#filter').select_option('samsung-internet')
   check(label+' six Samsung Internet original case cards',page.locator('#coverage li').count()==6)
   page.locator('#filter').select_option('installed-android-pwa')
   check(label+' five installed PWA original case cards',page.locator('#coverage li').count()==5)
   page.locator('#filter').select_option('accessibility')
   check(label+' seven assisted original case cards',page.locator('#coverage li').count()==7)
   page.locator('#filter').select_option('all')
   page.locator('#evidence-form button').click()
   check(label+' missing original file and operator rejected','Rejected' in page.locator('#field-feedback').inner_text())
   page.locator('#device-model').fill('FAKE PIXEL - NOT A REAL DEVICE')
   page.locator('#os-version').fill('SYNTHETIC Android 15')
   page.locator('#browser-version').fill('SYNTHETIC Chrome 130')
   page.locator('#operator-id').fill('SYNTHETIC TEST OPERATOR')
   page.locator('#case-notes').fill('This is real localhost Chromium code QA, NOT physical Android evidence or human authorization.')
   upload(page,'#source-file','synthetic-original.bin',b'A24 synthetic source original bytes only')
   page.locator('#evidence-form button').click()
   check(label+' original file hashed and pending only',
    'pending independent' in page.locator('#field-feedback').inner_text().lower() and
    page.locator('#physical-pending').inner_text()=='1 / 18')
   check(label+' never upgrades physical acceptance',page.locator('#physical-accepted').inner_text()=='0 / 18')
   page.locator('#evidence-form button').click()
   check(label+' duplicate original case blocked','Rejected' in page.locator('#field-feedback').inner_text())
   page.locator('#host-url').fill('https://gomoku.thiepn.dev/')
   page.locator('#host-check').click()
   check(label+' production hosted aliases denied','Rejected' in page.locator('#host-feedback').inner_text())
   page.locator('#host-url').fill('https://fictional-field-proof.vercel.app/')
   page.locator('#host-check').click()
   check(label+' isolated host scope recorded without GET',
    'NO network request' in page.locator('#host-feedback').inner_text() and
    page.locator('#host-accepted').inner_text()=='0')
   page.locator('#rollback-check').click()
   check(label+' no SW/prior archive original rejected','Rejected' in page.locator('#rollback-feedback').inner_text())
   upload(page,'#sw-before','before.js',b'synthetic service worker version one')
   upload(page,'#sw-updated','updated.js',b'synthetic service worker version TWO')
   upload(page,'#sw-reverted','revert.js',b'synthetic service worker version one')
   upload(page,'#prior-stable','prior.zip',b'synthetic prior stable original not deployed')
   page.locator('#rollback-check').click()
   check(label+' byte SHA reviewed but no actual rollback',
    'NO actual same-origin SW update' in page.locator('#rollback-feedback').inner_text())
   with page.expect_download() as download:
    page.locator('#export-packet').click()
   out=ROOT/'a24-pending-browser-export.tmp'
   download.value.save_as(str(out))
   packet=json.loads(out.read_text());out.unlink()
   check(label+' unsigned export source and exact SHA256, authority denied',
    packet['format']=='GomokuA24UnsignedFieldKitPacket' and
    packet['a23Head']=='d36610bc49aa0cee03f3a649108fda98e99094ee' and
    packet['actualPhysicalAccepted']==0 and packet['ownerHostApproval'] is False and
    packet['independentHumanWitnessApproved'] is False and
    packet['canDeploy'] is False and packet['canCertifyPhysical'] is False and
    packet['originalMediaIncluded'] is False and
    len(packet['pendingCaseOriginals'])==1 and
    packet['pendingCaseOriginals'][0]['sha256']==hashlib.sha256(b'A24 synthetic source original bytes only').hexdigest() and
    packet['pendingRollback']['realRestorePerformed'] is False)
   check(label+' zero requests outside localhost',all(x.startswith('http://127.0.0.1:') for x in requests))
   check(label+' no JavaScript exceptions',not errors)
   check(label+' 1x viewport layout has no horizontal overflow',
    page.evaluate('document.documentElement.scrollWidth<=innerWidth+3'))
   if label=='desktop':
    page.locator('#case-select').focus()
    page.keyboard.press('Tab')
    check(label+' keyboard tab reaches device field',page.evaluate("document.activeElement?.id==='device-model'"))
    page.evaluate("document.body.style.zoom='2'")
    check(label+' 200-percent zoom readable without horizontal scroll',
      page.evaluate('document.documentElement.scrollWidth<=innerWidth+3'))
   ctx.close()
  browser.close()
finally:
 srv.shutdown();srv.server_close()
print(f'{passed} A24 REAL local Chromium tests passed. No real Android, hosted GET, human approval, or production access.')
