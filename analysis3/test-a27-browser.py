"""A27 real localhost Chromium, synthetic test fixtures ONLY.
No physical phone, genuine hosted request, human consent, legal rights or release approval.
"""
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import tempfile,hashlib,json,subprocess
ROOT=Path(__file__).resolve().parent
MEDIA=b'A27 SYNTHETIC media, NOT a real device observation'
RIGHTS=b'A27 SYNTHETIC rights, NOT real original consent'
WITNESS=b'A27 SYNTHETIC witness, NOT real signer authentication'
def h(b):return hashlib.sha256(b).hexdigest()
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
URL=f'http://127.0.0.1:{server.server_port}/a27-one-case-desk.html'
count=0
def check(name,ok):
 global count
 assert ok,name
 count+=1;print('PASS A27 Chromium '+name,flush=True)
def upload(page,selector,name,b):
 page.locator(selector).set_input_files({'name':name,'mimeType':'application/octet-stream','buffer':b})
def download(page,selector,dest):
 with page.expect_download() as event:page.locator(selector).click()
 event.value.save_as(str(dest))
def candidate():
 return {
  'format':'GomokuA26UnverifiedOriginalWitnessHandoff','version':26,
  'sourceHead':'407bfb88430539932ab6bf07df1b33ae7b86829c',
  'a25HandoffDigest':'a'*64,'originalA9SourceSha':'fca45816ed7d3a95bae550b9aa644e29053875f6',
  'sourceFileIntegrityOnly':True,'originalMediaIncluded':False,'personalObservationsExported':False,
  'candidateRecords':[{'id':'android-chrome:fresh-launch','sourceMediaSha256':h(MEDIA),
    'sourceRightsSha256':h(RIGHTS),'originalWitnessSha256':h(WITNESS),
    'originalWitnessBytes':len(WITNESS),'claimedWitnessAliasSha256':h(b'FAKE'),
    'status':'BYTES_MATCHED_PENDING_EXTERNAL_IDENTITY_RIGHTS_AND_OBSERVATION_REVIEW'}],
  'pendingWitnessOriginalCount':1,'missingPhysicalCases':[],'missingAccessibility':[],
  'actualPhysicalAccepted':0,'actualAccessibilityAccepted':0,
  'genuineHostedOriginAuthenticated':False,'independentHumanIdentityVerified':False,
  'consentAndSourceRightsApproved':False,'realSignerRoots':0,'globalReplayAccepted':False,
  'realServiceWorkerUpdate':False,'realPlayerStateRecovery':False,'ownerApproved':False,
  'realCutoverPerformed':False,'realA13Hours':0,
  'canMerge':False,'canTag':False,'canDeploy':False,'canModifyProductionData':False,
  'canCertifyPhysical':False,'canCloseRelease':False,'canGrantOwnerAuthority':False,
  'releaseGates':[],'decision':'NO_GO',
  'status':'PENDING_INDEPENDENT_HUMAN_AND_ORIGINAL_SOURCE_AUTHENTICATION'
 }
try:
 with tempfile.TemporaryDirectory(prefix='gomoku-a27-chromium-') as d:
  tmp=Path(d)
  for rel,content in [('media/android-chrome/fresh-launch.bin',MEDIA),
    ('rights/android-chrome/fresh-launch.bin',RIGHTS),
    ('witness/android-chrome/fresh-launch.bin',WITNESS)]:
   p=tmp/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(content)
  receipt=tmp/'synthetic-a26-pending.json';receipt.write_text(json.dumps(candidate()))
  with sync_playwright() as pw:
   browser=pw.chromium.launch(headless=True,args=['--no-sandbox'])
   for profile,width,height in [('desktop',1280,750),('mobile-emulated',390,844)]:
    ctx=browser.new_context(viewport={'width':width,'height':height},
     is_mobile=width==390,has_touch=width==390,accept_downloads=True,reduced_motion='reduce')
    page=ctx.new_page();errors=[];requests=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.on('request',lambda req:requests.append(req.url))
    page.goto(URL,wait_until='domcontentloaded')
    check(profile+' release remains NO_GO','NO-GO' in page.locator('#release-status').inner_text())
    check(profile+' initial PASS=0 FAIL=0 NOT_TESTED=25',
      page.locator('#pass-count').inner_text()=='0' and
      page.locator('#fail-count').inner_text()=='0' and
      page.locator('#untested-count').inner_text()=='25')
    check(profile+' case 1 is Android Chrome fresh-launch',
      'Android Chrome' in page.locator('#case-name').inner_text() and
      'Fresh Launch' in page.locator('#case-name').inner_text())
    original=tmp/(profile+'-empty.json')
    download(page,'#export',original)
    check(profile+' empty file uses NOT_TESTED-only data',
      json.loads(original.read_text())['observations']==[])
    page.locator('#status').select_option('PASS')
    page.locator('#record').click()
    check(profile+' PASS refused without actual observation consent',
      'BLOCKED' in page.locator('#case-feedback').inner_text())
    page.locator('#actual').check()
    page.locator('#tested-origin').fill('https://gomoku.thiepn.dev/')
    page.locator('#hardware').fill('NOT A REAL PHYSICAL PHONE')
    page.locator('#os').fill('SYNTHETIC ANDROID 15')
    page.locator('#browser').fill('SYNTHETIC CHROME')
    page.locator('#operator').fill('SYNTHETIC TEST OPERATOR')
    page.locator('#observation').fill('Synthetic CI demonstration only; this did not happen on physical hardware.')
    page.locator('#record').click()
    check(profile+' production origin rejected without web request',
      'BLOCKED' in page.locator('#case-feedback').inner_text())
    page.locator('#tested-origin').fill('https://isolated-a27-example.vercel.app/')
    page.locator('#record').click()
    check(profile+' PASS refuses absence of source original files',
      'requires A26' in page.locator('#case-feedback').inner_text())
    upload(page,'#a26-receipt','a26.json',receipt.read_bytes())
    upload(page,'#media-file','media.bin',MEDIA)
    upload(page,'#rights-file','rights.bin',RIGHTS)
    upload(page,'#witness-file','witness.bin',b'TAMPERED')
    page.locator('#record').click()
    check(profile+' A26 original witness byte mismatch blocks PASS',
      'BLOCKED' in page.locator('#case-feedback').inner_text())
    upload(page,'#witness-file','witness.bin',WITNESS)
    page.locator('#record').click()
    expect(page.locator('#case-feedback')).to_contain_text('Recorded PASS')
    check(profile+' locally reported PASS never human certified',
      page.locator('#pass-count').inner_text()=='1' and
      'NO-GO' in page.locator('#release-status').inner_text())
    page.locator('#next').click()
    check(profile+' one-case navigation leaves next NOT_TESTED',
      page.locator('#status').input_value()=='NOT_TESTED' and
      'Rules Renju' in page.locator('#case-name').inner_text())
    page.locator('#status').select_option('FAIL')
    page.locator('#record').click()
    check(profile+' second case FAIL not accepted without observation',
      'BLOCKED' in page.locator('#case-feedback').inner_text())
    page.locator('#actual').check()
    page.locator('#tested-origin').fill('https://isolated-a27-example.vercel.app/')
    page.locator('#hardware').fill('NOT A REAL PHYSICAL PHONE')
    page.locator('#os').fill('SYNTHETIC ANDROID 15')
    page.locator('#browser').fill('SYNTHETIC CHROME')
    page.locator('#operator').fill('SYNTHETIC TEST OPERATOR')
    page.locator('#observation').fill('Synthetic CI demonstration of a recorded failure, NOT an actual defect.')
    page.locator('#record').click()
    expect(page.locator('#case-feedback')).to_contain_text('Recorded FAIL')
    check(profile+' reported observations correctly scoped',
      page.locator('#pass-count').inner_text()=='1' and
      page.locator('#fail-count').inner_text()=='1' and
      page.locator('#untested-count').inner_text()=='23')
    exported=tmp/(profile+'-private-observations.json')
    download(page,'#export',exported)
    packet=json.loads(exported.read_text())
    check(profile+' no certification, only two explicit operator claims',
      packet['releaseState']=='NO_GO' and packet['humanOwnerApproval']=='NOT_OBTAINED' and
      len(packet['observations'])==2 and
      [v['reportedStatus'] for v in packet['observations']]==['PASS','FAIL'])
    output=tmp/(profile+'-no-go.json')
    proc=subprocess.run(['node',str(ROOT/'a27-field-intake.cjs'),'--observations',str(exported),
      '--a26',str(receipt),'--media-root',str(tmp),'--rights-root',str(tmp),
      '--witness-root',str(tmp),'--out',str(output)],capture_output=True,text=True)
    check(profile+' exported real browser JSON accepted by isolated Node original-byte verifier',
      proc.returncode==0 and json.loads(output.read_text())['reportedPass']==1 and
      json.loads(output.read_text())['reportedFail']==1 and
      json.loads(output.read_text())['physicalHumanAccepted']==0 and
      json.loads(output.read_text())['decision']=='NO_GO')
    check(profile+' no remote requests at all',all('127.0.0.1' in r for r in requests))
    check(profile+' zero browser script errors',not errors)
    page.locator('#reset').click()
    check(profile+' explicit discard resets to 25 NOT_TESTED',
      page.locator('#pass-count').inner_text()=='0' and
      page.locator('#untested-count').inner_text()=='25')
    if profile=='desktop':
     page.set_viewport_size({'width':680,'height':700})
     page.evaluate("document.documentElement.style.zoom='2'")
     check(profile+' 200% zoom no horizontal overflow',
      page.evaluate("document.documentElement.scrollWidth<=innerWidth+4"))
    ctx.close()
   browser.close()
finally:
 server.shutdown();server.server_close()
print(f'{count} A27 synthetic Chromium tests passed. 0 actual devices/hosted requests/human approvals.')
