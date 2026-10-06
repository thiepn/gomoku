"""Release invariants: preserve all rule, engine, lesson, and review modules."""
from pathlib import Path
import re,hashlib,json
ROOT=Path(__file__).resolve().parents[1];html=(ROOT/'index.html').read_text()
modules=dict(re.findall(r'<script id="([^"]+)"[^>]*>(.*?)</script>',html,re.S));expected=json.loads((ROOT/'ui/preserved-scripts.json').read_text())

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

for name,digest in expected.items():
    if name=='_game-app-excluding-material':
        content=normalize_ai2_hooks(modules['game-app']);a=content.index('function bake(){');b=content.index('function drawTri(',a);content=content[:a]+content[b:]
    else:content=modules[name]
    actual=hashlib.sha256(content.encode()).hexdigest()
    assert actual==digest,f'Unexpected change to {name}: expected {digest}, actual {actual}'
for tag,id,name in [('style','tournament-table-style','studio.css'),('script','tournament-table-script','studio.js')]:
    results=re.findall(fr'<{tag} id="{id}">(.*?)</{tag}>',html,re.S)
    assert len(results)==1 and results[0].strip()==(ROOT/'ui'/name).read_text().strip(),'Embedding differs from source: '+name
print('PASS release module hashes match the approved integrity manifest; reviewed AI 2.0 seams normalize to the prior game-app hash; both UI embeddings match their source.')
