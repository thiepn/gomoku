'use strict';
const assert=require('node:assert/strict'),G=require('./core.js');let n=0;
function test(name,fn){fn();n++;console.log('PASS '+name)}
test('version',()=>assert.equal(G.VERSION,'1.4.0'));
test('AI win is classified from the human side',()=>assert.equal(G.outcome({mode:'ai',humanColor:2},{winner:2}),'win'));
test('AI loss is classified from the human side',()=>assert.equal(G.outcome({mode:'ai',humanColor:2},{winner:1}),'loss'));
test('draw is neutral to color',()=>assert.equal(G.outcome({mode:'ai',humanColor:1},{winner:0}),'draw'));
test('local result does not pretend one side is the user',()=>assert.equal(G.outcome({mode:'local',humanColor:1},{winner:1}),'neutral'));
test('result copy keeps useful context',()=>{const x=G.resultCopy({mode:'ai',humanColor:1},{winner:1,reason:'five',moves:37,winLines:[[1,2,3,4,5]]},{black:'You',white:'Tactical'});assert.equal(x.title,'You win');assert.equal(x.reason,'5 in a row');assert.equal(x.side,'Black');assert.equal(x.moves,37)});
test('move plan suppresses visual impact for pass',()=>{const x=G.movePlan({i:-1,origin:'human'},false);assert.equal(x.impact,false);assert.equal(x.pass,true)});
test('reduced motion suppresses move impact',()=>assert.equal(G.movePlan({i:112,origin:'human'},true).impact,false));
test('celebration only occurs for a human win',()=>{assert.equal(G.resultPlan({mode:'ai',humanColor:1},{winner:1,moves:20,winLines:[[1,2,3,4,5]]},false).celebrate,true);assert.equal(G.resultPlan({mode:'ai',humanColor:1},{winner:2,moves:20,winLines:[[1,2,3,4,5]]},false).celebrate,false)});
test('particle plan is deterministic and bounded',()=>{const a=G.particles(7,14),b=G.particles(7,14);assert.deepEqual(a,b);assert.equal(a.length,14);for(const p of a){assert.ok(Math.abs(p.dx)<=100&&Math.abs(p.dy)<=100);assert.ok(p.size>=3.5&&p.size<=8)}});
console.log(n+' Game Feel 2.0 core checks passed');
