'use strict';
const assert=require('node:assert/strict');
const A=require('./workspace-core.js');
const board=Array(225).fill(0);board[112]=1;board[113]=2;
const position={board,color:1,context:{passes:0,moveCount:2}};
const result={best:126,candidates:[
 {i:126,label:'Best found',bound:'exact',score:10,depth:6,pv:[126,127,128],
   comparison:{scoreComparable:true}},
 {i:127,label:'Good',bound:'exact',score:8,depth:6,pv:[127,128],
   comparison:{scoreComparable:true}},
 {i:128,label:'Losing move',bound:'verified-loss',depth:6,pv:[128,129],
   comparison:{scoreComparable:false}}
 ],defense:{rootThreats:[{kind:'vct',move:90}]},
 explanation:{highlights:[90,91]}};
const core={line:(original,color,rule,moves,context)=>{
 const states=[{board:original.slice(),color,context,result:null}],valid=[];
 for(const i of moves){const b=states.at(-1).board.slice();if(!Number.isInteger(i)||i<0||i>=225||b[i])break;
 b[i]=states.at(-1).color;valid.push(i);states.push({board:b,color:3-states.at(-1).color,context,result:null});
 }
 return {states,moves:valid};
}};
let n=0;const test=(name,fn)=>{fn();n++;console.log('PASS '+name)};
test('board coordinate system aligns with 15x15 grid intersections',()=>{
 assert.deepEqual(A.xy(0),{x:5,y:5});assert.deepEqual(A.xy(224),{x:145,y:145});
 assert.equal(A.coord(112),'H8');
});
test('preview cannot exist without a real evaluated candidate',()=>{
 assert.equal(A.previewState(core,position,'freestyle',result,{move:120,step:1}),null);
});
test('preview at step zero leaves recorded position immutable',()=>{
 const before=board.slice(),p=A.previewState(core,position,'freestyle',result,{move:126,step:0});
 assert.ok(p);assert.deepEqual(p.state.board,board);assert.deepEqual(board,before);
});
test('forward PV steps use real legal moves from before the recorded turn',()=>{
 const p=A.previewState(core,position,'freestyle',result,{move:126,step:2});
 assert.equal(p.step,2);assert.equal(p.state.board[126],1);assert.equal(p.state.board[127],2);
 assert.equal(board[126],0);
});
test('preview clamps out-of-range steps and ends without rewriting game',()=>{
 const p=A.previewState(core,position,'freestyle',result,{move:126,step:999});
 assert.equal(p.step,3);assert.deepEqual(p.moves,[126,127,128]);
});
test('illegal or occupied continuations cannot become board previews',()=>{
 const a=structuredClone(result);a.candidates[0].pv=[126,113,128];
 const p=A.previewState(core,position,'freestyle',a,{move:126,step:9});
 assert.equal(p.total,1);assert.equal(p.state.board[128],0);
});
test('candidate overlay covers measured candidate positions, not every square',()=>{
 const m=A.overlays(position,result,board,{mode:'candidates'});
 assert.equal(m.dots.length,2);assert.equal(m.arrows.length,0);
 assert.ok(m.dots.every(d=>d.i!==128)); // verified-loss excluded from green candidate presentation
});
test('threat overlay uses reported positions and no heuristic fabricated heatmap',()=>{
 const m=A.overlays(position,result,board,{mode:'threats'});
 assert.deepEqual(m.dots.map(d=>d.i).sort((a,b)=>a-b),[90,91]);
 assert.ok(m.legend.includes('unknown attacks'));
});
test('line overlay generates real consecutive PV arrows',()=>{
 const m=A.overlays(position,result,board,{mode:'line',preview:{move:126,step:0},validMoves:A.legalVariation(core,position,'freestyle',result.candidates[0])});
 assert.equal(m.arrows.length,2);assert.equal(m.arrows[0].from,126);assert.equal(m.arrows[0].to,127);
});
test('pin compares two distinct candidates but never invents score confidence',()=>{
 const good=A.compare(result,126,127);assert.equal(good.numericComparison,true);
 assert.equal(A.compare(result,126,126),null);
 const uncertain=A.compare(result,126,128);assert.equal(uncertain.numericComparison,false);
});
test('pending analysis displays no fake markers',()=>{
 const m=A.overlays(position,null,board,{mode:'candidates'});assert.equal(m.dots.length,0);
});
console.log(n+' A3 workspace model checks passed');
