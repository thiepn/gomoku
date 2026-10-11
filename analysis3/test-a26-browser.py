"""A26 isolated real Chromium desktop/mobile-emulated original witness intake tests.
Not physical Android, authorized host, authenticated human or consent evidence.
"""
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from functools import partial
from threading import Thread
from playwright.sync_api import sync_playwright
import json,hashlib,subprocess,tempfile
ROOT=Path(__file__).resolve().parent
MEDIA=b'SYNTHETIC A26 browser original, NOT observed physical Chrome'
RIGHTS=b'SYNTHETIC A26 rights media NOT legal owner consent'
WITNESS=b'SYNTHETIC A26 witness file NOT an authenticated signer'
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/a26-acceptance-desk.html'
n=0
def check(label,yes):
 global n
 assert yes,label
 n+=1;print('PASS A26 Chromium '+label,flush=True)
def upload(page,selector,name,b):
 page.locator(selector).set_input_files({'name':name,'mimeType':'application/octet-stream','buffer':b})
def save(page,selector,to):
 with page.expect_download() as d:page.locator(selector).click()
 d.value.save_as(str(to))
def root_setup(tmp):
 (tmp/'media/android-chrome').mkdir(parents=True)
 (tmp/'rights/android-chrome').mkdir(parents=True)
 (tmp/'witness/android-chrome').mkdir(parents=True)
 (tmp/'media/android-chrome/fresh-launch.bin').write_bytes(MEDIA)
 (tmp/'rights/android-chrome/fresh-launch.bin').write_bytes(RIGHTS)
 (tmp/'witness/android-chrome/fresh-launch.bin').write_bytes(WITNESS)
 field={'format':'GomokuA24FieldOriginalIntake','version':24,
  'sourceSha':'fca45816ed7d3a95bae550b9aa644e29053875f6',
  'a23Head':'d36610bc49aa0cee03f3a649108fda98e99094ee',
  'humanOwnerApproval':'NOT_OBTAINED','releaseState':'NO_GO',
  'physicalCasesAccepted':0,'productionDataTouched':False,
  'cases':[{'platform':'android-chrome','caseId':'fresh-launch',
   'status':'OBSERVED_PENDING_INDEPENDENT_REVIEW',
   'originalFile':'media/android-chrome/fresh-launch.bin',
   'sha256':hashlib.sha256(MEDIA).hexdigest(),
   'ownerRightsIntakeSha256':hashlib.sha256(RIGHTS).hexdigest(),
   'hardwareModel':'FAKE PIXEL','androidVersion':'FAKE 15',
   'browserVersion':'FAKE CHROME','operatorId':'TEST',
   'observedAt':'2026-10-10T18:00:00.000Z',
   'observation':'Synthetic browser original is not a physical observed phone case.'}],
  'accessibility':[]}
 (tmp/'field.json').write_text(json.dumps(field))
 script="const fs=require('fs'),A=require('./analysis3/a25-handoff.cjs');const x=A.review({fieldManifest:JSON.parse(fs.readFileSync(process.argv[1])),fieldRoot:process.argv[2],rightsRoot:process.argv[2]});fs.writeFileSync(process.argv[3],JSON.stringify(x));"
 proc=subprocess.run(['node','-e',script,str(tmp/'field.json'),str(tmp),str(tmp/'a25.json')],
  cwd=ROOT.parent,capture_output=True,text=True)
 check('real A25 original byte importer generated source input',proc.returncode==0)
try:
 with tempfile.TemporaryDirectory(prefix='gomoku-a26-real-chromium-') as folder:
  tmp=Path(folder);root_setup(tmp)
  with sync_playwright() as pw:
   browser=pw.chromium.launch(headless=True,args=['--no-sandbox'])
   for profile,w,h in [('desktop',1280,720),('mobile-emulated',390,844)]:
    ctx=browser.new_context(viewport={'width':w,'height':h},is_mobile=w==390,has_touch=w==390,
     reduced_motion='reduce',accept_downloads=True)
    page=ctx.new_page();errors=[];calls=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:calls.append(r.url))
    page.goto(url,wait_until='domcontentloaded')
    check(profile+' NO_GO banner',page.locator('#release-status').inner_text()=='NO-GO · HUMAN APPROVAL NOT OBTAINED')
    check(profile+' no imported originals at startup',page.locator('#case-id option').count()==0)
    upload(page,'#handoff-file','a25.json',(tmp/'a25.json').read_bytes())
    page.locator('#read-source').click()
    page.wait_for_function("document.querySelector('#case-id').options.length===1")
    check(profile+' A25 imported but not human-authenticated',
      'not authenticate A25 provenance' in page.locator('#source-feedback').inner_text())
    page.locator('#witness-name').fill('FAKE REVIEWER')
    page.locator('#observation').fill('This is a synthetic browser exercise with no physical human signed observation.')
    upload(page,'#media-file','altered-media.bin',b'MUTATED FAKE original media bytes')
    upload(page,'#rights-file','rights.bin',RIGHTS)
    upload(page,'#witness-file','witness.bin',WITNESS)
    page.locator('#acknowledge').check()
    page.locator('#record').click()
    page.wait_for_function("document.querySelector('#review-feedback').textContent.includes('BLOCKED')")
    check(profile+' SHA mismatch prohibits candidate',page.locator('#export').is_disabled())
    upload(page,'#media-file','media.bin',MEDIA)
    page.locator('#record').click()
    page.wait_for_function("document.querySelector('#count').textContent.startsWith('1 witness')")
    check(profile+' 3 local original file hashes matched', 'Three original file hashes matched' in page.locator('#review-feedback').inner_text())
    saved=tmp/(profile+'-witness.bin')
    save(page,'#save-original',saved)
    check(profile+' exact witness original binary download unchanged',saved.read_bytes()==WITNESS)
    out=tmp/(profile+'-candidate.json')
    save(page,'#export',out)
    obj=json.loads(out.read_text())
    check(profile+' manifest never grants authority',
      obj['releaseState']=='NO_GO' and obj['humanVerifiedCount']==0 and
      obj['ownerApproval']=='NOT_OBTAINED' and obj['entries'][0]['witnessOriginalSha256']==hashlib.sha256(WITNESS).hexdigest())
    cliout=tmp/(profile+'-pending-review.json')
    proc=subprocess.run(['node',str(ROOT/'a26-witness-intake.cjs'),
      '--a25',str(tmp/'a25.json'),'--field-manifest',str(tmp/'field.json'),
      '--field-root',str(tmp),'--rights-root',str(tmp),
      '--witness-manifest',str(out),'--witness-root',str(tmp),'--out',str(cliout)],
     cwd=ROOT.parent,capture_output=True,text=True)
    check(profile+' actual A25->browser->A26 CLI byte-verified pending-only handoff',
      proc.returncode==0 and json.loads(cliout.read_text())['decision']=='NO_GO' and
      json.loads(cliout.read_text())['actualPhysicalAccepted']==0)
    check(profile+' browser uses no remote origin',all('127.0.0.1' in x for x in calls))
    check(profile+' no browser runtime errors',not errors)
    if profile=='desktop':
     page.set_viewport_size({'width':640,'height':720})
     page.evaluate("document.documentElement.style.zoom='2'")
     check(profile+' 200% zoom avoids horizontal overflow',
       page.evaluate('document.documentElement.scrollWidth<=innerWidth+4'))
    ctx.close()
   browser.close()
finally:
 server.shutdown();server.server_close()
print(f'{n} A26 original-byte Chromium checks passed; real human, hosted and physical acceptance all NOT TESTED.')
