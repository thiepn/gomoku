"""Independent release invariant: the prior Renju-fixed game's logic is unchanged outside reviewed AI 2.0 seams."""
from pathlib import Path
import json,re,hashlib
root=Path(__file__).resolve().parents[1];html=(root/'index.html').read_text();modules=dict(re.findall(r'<script id="([^"]+)"[^>]*>(.*?)</script>',html,re.S));baseline=json.loads((root/'analysis/baseline-integrity.json').read_text())

def normalize_ai2_hooks(content):
    """Remove only the reviewed v1.3 live-opponent seams before legacy hashing.

    The preserved hash still verifies the complete pre-v1.3 game app. Any other
    gameplay change remains visible to this test.
    """
    content=content.replace("""const selectedLevel=S.mode==='arena'&&color===2?S.opponentLevel:S.level;/* AI2_SEARCH_HOOK */
  const level=purpose==='move'&&window.GomokuAI2?.effectiveLevel?window.GomokuAI2.effectiveLevel({selected:selectedLevel,mode:S.mode,rule:S.variant,moveCount:S.records.length,gameId:S.gameId}):selectedLevel;""",
        """const level=S.mode==='arena'&&color===2?S.opponentLevel:S.level;""")
    content=content.replace("""const baseConfig=purpose==='move'?{...CFG[level],style:S.style,seed:S.seed^S.records.length,multiPV:5,randomPool:1}:
    {...CFG.advanced,timeMs:1000,maxDepth:4,width:14,style:'balanced',seed:S.seed};/* AI2_CONFIG_HOOK */
  const config=purpose==='move'&&window.GomokuAI2?.searchConfig?window.GomokuAI2.searchConfig(level,baseConfig,{mode:S.mode,rule:S.variant,moveCount:S.records.length,gameId:S.gameId}):baseConfig;""",
        """const config=purpose==='move'?{...CFG[level],style:S.style,seed:S.seed^S.records.length,multiPV:5,randomPool:1}:
    {...CFG.advanced,timeMs:1000,maxDepth:4,width:14,style:'balanced',seed:S.seed};""")
    content=content.replace("""if(purpose==='move'&&!compat)result=v113Humanize(result,board,color,count,level,S.style,S.seed^S.records.length);
    if(purpose==='move'&&!compat)try{window.dispatchEvent(new CustomEvent('gomoku-ai2-search',{detail:{gameId:S.gameId,selectedLevel,effectiveLevel:level,reason:result?.reason||'',depth:result?.depth||0,nodes:result?.nodes||0,elapsedMs:result?.elapsedMs||0,backend:result?.backend||'',confidence:result?.confidence?.band||'',humanized:result?.humanization?.deliberate===true}}));}catch{}/* AI2_TELEMETRY_HOOK */""",
        """if(purpose==='move'&&!compat)result=v113Humanize(result,board,color,count,level,S.style,S.seed^S.records.length);""")
    assert 'AI2_SEARCH_HOOK' not in content and 'AI2_CONFIG_HOOK' not in content and 'AI2_TELEMETRY_HOOK' not in content, 'Unrecognized AI 2.0 game-app hook'
    return content

for name,digest in baseline['preserved'].items():
    content=modules['game-app'] if name=='_game-app-excluding-material' else modules[name]
    if name=='_game-app-excluding-material':
        content=normalize_ai2_hooks(content);a=content.index('function bake(){');b=content.index('function drawTri(',a);content=content[:a]+content[b:]
    assert hashlib.sha256(content.encode()).hexdigest()==digest,'Baseline logic changed: '+name
for tag,name,file in [('script','analysis2-core','core.js'),('script','analysis2-runtime','runtime.js'),('script','analysis2-training','training.js'),('style','analysis2-style','analysis.css'),('script','analysis5-practice-core','../analysis3/practice-core.js'),('style','analysis5-practice-style','../analysis3/practice.css')]:
    matches=re.findall(fr'<{tag} id="{name}">(.*?)</{tag}>',html,re.S)
    assert len(matches)==1 and matches[0].strip()==(root/'analysis'/file).read_text().strip(),'Embedding/source mismatch: '+file
assert html.index('id="analysis2-core"')<html.index('id="analysis2-runtime"')<html.index('id="guided-review-script"')<html.index('id="analysis5-practice-core"')<html.index('id="analysis2-training"')
print('PASS',len(baseline['preserved']),'prior-release module/logic hashes preserved after normalizing reviewed AI 2.0 seams; four Analysis 2.0 embeddings verified.')
