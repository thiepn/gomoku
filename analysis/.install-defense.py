from pathlib import Path
import hashlib, json, re, subprocess
root=Path(__file__).resolve().parents[1]
def change(path, edits):
    p=root/path;s=p.read_text()
    for old,new in edits:
        assert old in s, f'Missing expected integration anchor in {path}: {old[:90]}'
        s=s.replace(old,new)
    p.write_text(s)
helpers=(root/'analysis/.install-defense-service.js').read_text()+(root/'analysis/.install-defense-ranking.js').read_text()
change('analysis/core.js',[
    ('/* Analysis 2.0:', '/* Analysis 2.1:'),
    ("const VERSION = '2.0.0', C", "const VERSION = '2.1.0', POSITION_VERSION = '2.0.0', C"),
    ('`${VERSION}|${rule}|','`${POSITION_VERSION}|${rule}|'),
    ('  function analyze(board,color,rule,played,options={}) {',helpers+'  function analyze(board,color,rule,played,options={}) {'),
    ('    let raw;\n    if(centerOnly)',"    const screen=defenseScreen(board,color,rule,ctx,played,{timeMs:centerOnly?0:Math.min(420,budget*.28),depth:Math.min(preset.threatDepth,budget<700?7:19)});\n    let raw;\n    if(centerOnly)"),
    ("raw=C.analyze(board,color,rule,{timeMs:Math.max(80,budget*(budget>=700?.72:.90)),depth:preset.depth,width:preset.width,\n        multiPV:5,includeMoves:point(played)?[played]:[],threatDepth:preset.threatDepth,", "raw=C.analyze(board,color,rule,{timeMs:Math.max(50,budget-(now()-started)-Math.min(500,budget*.26)),depth:preset.depth,width:preset.width,\n        multiPV:5,includeMoves:[...new Set([...(point(played)?[played]:[]),...screen.defenses()])],threatDepth:preset.threatDepth,"),
    ('    const out=R.pack(raw,board,color,played);',"    if(!centerOnly){\n      screen.refine([raw.move,played,...screen.defenses(),...raw.candidates.slice(0,5).map(c=>c.i)],Math.max(0,budget-(now()-started)-15));\n      applyDefense(raw,screen,played);\n    }\n    const out=R.pack(raw,board,color,played);"),
    ('    out.pv=R.line(board,color,rule,out.pv,ctx).moves;\n    return out;', '    out.pv=R.line(board,color,rule,out.pv,ctx).moves;\n    if(!centerOnly)explainDefense(out,raw,screen,board,color,rule,ctx);\n    out.timeMs=Math.round(now()-started);\n    return out;'),
    ("['Blunder','Mistake'", "['Losing move','Blunder','Mistake'"),
    ("message:'A stronger continuation is available. Compare its threat and then try this position again.'", "message:r.refutation?'This move permits a verified opponent win. Inspect the forcing line before trying another defense.':'A stronger continuation is available. Compare its threat and then try this position again.'"),
    ("if(!trainable(card.reference)||card.reference.played", "if(!trainable(card.reference?.analysisVersion==='2.0.0'?{...card.reference,analysisVersion:VERSION}:card.reference)||card.reference.played"),
    ('clean.reference.imported=true;return clean;', 'clean.reference.imported=true;clean.reference.stale=clean.reference.analysisVersion!==VERSION;return clean;'),
    ('return {VERSION,PRESETS,positionKey', 'return {VERSION,PRESETS,defenseScreen,positionKey')
])
p=root/'analysis/core.js';s=p.read_text();a=s.index('    // An opponent proof after a move');b=s.index('    out.analysisVersion=VERSION;',a)
s=s[:a]+"    out.refutation=screen.evidence(played);\n    out.opponentThreat=screen.rootThreat?certificate(board,3-color,rule,screen.rootThreat,ctx):null;\n"+s[b:];p.write_text(s)
change('analysis/runtime.js',[
    ("version:'2.0.0'","version:'2.1.0'"),
    ("else if((card.reference.budget||0)>=(old.reference.budget||0))", "else if(card.reference.analysisVersion===engine.VERSION&&old.reference.analysisVersion!==engine.VERSION||(card.reference.analysisVersion===old.reference.analysisVersion&&(card.reference.budget||0)>=(old.reference.budget||0)))")
])
change('review/review.js',[
    ("{'Blunder':5,'Missed win':4", "{'Losing move':5,'Blunder':5,'Missed win':4"),
    ("const VERSION='2.0.0'", "const VERSION='2.1.0'"),
    ("if(data.version!==VERSION||!Array.isArray(data.items))return;", "if(!['2.0.0',VERSION].includes(data.version)||!Array.isArray(data.items))return;"),
    ("const saved=data.items.find(x=>x.fingerprint===s.fingerprint);", "const legacyFingerprint=JSON.stringify(['2.0.0',s.game.variant,s.game.renjuCenterRule,s.game.initial,s.game.startColor,s.game.moves]);\n      const saved=data.items.find(x=>x.fingerprint===s.fingerprint)||data.items.find(x=>x.fingerprint===legacyFingerprint);"),
    ("label==='Good'?'good'", "['Good','Defensive move'].includes(label)?'good'"),
    ("if(r.refutation&&core.severity(r.label))return `${side(3-(r.color??p.color))} has a verified forcing win after ${core.coord(r.played)}. The search prefers ${core.coord(r.best)}; use the threat viewer to see the danger.`;", "if(r.refutation&&core.severity(r.label))return `${side(3-(r.color??p.color))} can force a win after ${core.coord(r.played)}, starting at ${core.coord(r.refutation.proof.move)}. Forcing line: ${(r.tactical?.line||[r.refutation.proof.move]).slice(0,5).map(core.coord).join(' → ')}.${core.point(r.best)?` The current defensive candidate is ${core.coord(r.best)}.`:' No unrefuted alternative has been established.'} Open the threat proof to follow the forced replies.`;"),
    ("const icon={'Blunder':'??'", "const icon={'Losing move':'??','Defensive move':'✓','Blunder':'??'"),
    ("r?.basis==='verified-proof'?'Verified continuation':'Test this alternative'", "r?.bestProof?'Verified winning plan':r?.defense?.defenses?.includes(r?.best)?'Stops the known attack':!core.point(r?.best)?'No unrefuted candidate':'Test this alternative'"),
    ("r?`Show best found ${core.coord(r.best)}`:'Best move not yet available'", "r&&core.point(r.best)?`Show best found ${core.coord(r.best)}`:'Best move not yet available'"),
    ('<b>Already lost:</b> this was not a new avoidable mistake.', '<b>Losing move:</b> a verified opponent forcing win follows; this does not by itself prove the loss was avoidable. <b>Defensive move:</b> interrupts a verified attack, not a proof of a draw or win. <b>Already lost:</b> this was not a new avoidable mistake.'),
    ('<span>Best found</span><b id="rwBestCoord">', '<span id="rwBestHeading">Best found</span><b id="rwBestCoord">'),
    ("$('rwBestCoord').textContent=", "$('rwBestHeading').textContent=r?.defense?.defenses?.includes(r?.best)&&!r?.bestProof?'Defensive candidate':'Best found';\n    $('rwBestCoord').textContent="),
    ("'Good','Winning move','Winning threat','Winning plan'].includes(x.r.label)", "'Good','Defensive move','Winning move','Winning threat','Winning plan'].includes(x.r.label)"),
    ("feedback('No legal reply found.')", "feedback('No unrefuted reply established. You can still explore a legal move.')")
])
for name in ['analysis/build.py','review/build.py','ui/build.py']:
    change(name,[('analysis-2.0.0-review-ux','analysis-2.1.0-review-ux')])
change('analysis/build.py',[('Embedded Analysis 2.0 worker','Embedded Analysis 2.1 worker')])
change('review/build.py',[('Embedded Guided Review 2.0.0','Embedded Guided Review / Analysis 2.1.0')])
change('analysis/test-browser.py',[('version==="2.0.0"','version==="2.1.0"')])
change('analysis/test-core.cjs',[("assert.equal(results[6].label,'Blunder');", "assert.equal(results[6].label,'Losing move');assert.equal(results[6].basis,'verified-proof');")])
change('review/test-browser.py',[("s['results'][6]['label']=='Blunder'", "s['results'][6]['label']=='Losing move' and s['results'][6]['basis']=='verified-proof'")])
change('review/ux/test-workspace.py',[
    ("['Inaccuracy','Mistake','Blunder','Missed win','Win available']", "['Inaccuracy','Mistake','Blunder','Losing move','Missed win','Win available']"),
    ("inner_text()=='Blunder'", "inner_text()=='Losing move'"),
    ("'selective' in pg.locator('#grWhy').inner_text().lower()", "'verified' in pg.locator('#grWhy').inner_text().lower()")
])
core=(root/'review/review.js').read_text().split("if(typeof window !== 'undefined')")[0]
change('review/ux/test-integrity.py',[
    ('Check the UI-only boundary, exact single embedding, and cache preservation.', 'Check the approved review core, exact single embedding, and safe cache migration.'),
    ('fa919888664eef4ea474956465cef569771fd038333285833ccad25601f95df8',hashlib.sha256(core.encode()).hexdigest()),
    ("VERSION='2.0.0'", "VERSION='2.1.0'"),
    ("'Existing review cache version changed'", "'Review and analysis versions differ'"),
    ("assert \"STORE='gomoku.guided-review.v1'\"", "assert \"['2.0.0',VERSION].includes(data.version)\" in js,'Historical variations cannot migrate'\nassert \"r?.analysisVersion===VERSION\" in js,'Stale analysis can be reused'\nassert \"STORE='gomoku.guided-review.v1'\""),
    ('pure review core unchanged; review and workspace embedded once; analysis cache format preserved.', 'approved review core; single embeddings; old analyses rejected, variations preserved.')
])
black='D13 C12 E12 C11 D11 E11 G11 C10 E10 F10 B9 E9 F9 G9 H9 D8 F8 H8 F7 H7'.split()
white='B13 C13 E13 F13 D12 H12 F11 D10 H10 D9 J9 A8 E8 G8 C7 G7 J7 F6 H6'.split()
board=[0]*225
for color,stones in [(1,black),(2,white)]:
    for s in stones:board[(15-int(s[1:]))*15+'ABCDEFGHJKLMNOP'.index(s[0])]=color
fixture={'id':'renju-move40-b11-four-three','source':'User screenshot, 2026-09-18; reconstructed before White E14 (move 40).','rule':'renju-practice','color':2,'board':board,'black':black,'white':white,'played':'E14','badRecommendation':'J6','attack':'B11','localDefenses':['A11','B11','A10','E14','F15'],'note':'These moves interrupt the B11 combination; not a proof each survives all other threats.'}
(root/'analysis/fixtures').mkdir(exist_ok=True)
(root/'analysis/fixtures/renju-move40.json').write_text(json.dumps(fixture,indent=2)+'\n')
for script in ['review/build.py','ui/build.py','analysis/build.py']:
    subprocess.run(['python',str(root/script)],cwd=root,check=True)
p=root/'ui/preserved-scripts.json';manifest=json.loads(p.read_text())
embedded=re.search('<script id="guided-review-script">(.*?)</script>',(root/'index.html').read_text(),re.S)[1]
manifest['guided-review-script']=hashlib.sha256(embedded.encode()).hexdigest()
p.write_text(json.dumps(manifest,indent=2)+'\n')
print('Integrated Analysis 2.1; original game, rules and native-engine integrity manifest remains unchanged.')
