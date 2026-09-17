function bake(){
  off=document.createElement('canvas');off.width=canvas.width;off.height=canvas.height;
  const g=off.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);
  const ash=S.theme==='slate';
  const base=g.createLinearGradient(0,0,size,size);
  base.addColorStop(0,ash?'#e2e6df':'#eddbbc');
  base.addColorStop(.55,ash?'#d7ddd4':'#e4cfa9');
  base.addColorStop(1,ash?'#cbd3ca':'#d9bf93');
  g.fillStyle=base;g.fillRect(0,0,size,size);
  const rnd=mulberry32(20260917);
  for(let i=0;i<90;i++){
    const y0=rnd()*size,phase=rnd()*6.28;
    g.strokeStyle=ash?'rgba(45,62,43,.024)':'rgba(115,78,32,.032)';g.lineWidth=.45+rnd()*.65;g.beginPath();
    for(let x=0;x<=size;x+=10){const y=y0+Math.sin(x*.006+phase)*1.1; x===0?g.moveTo(x,y):g.lineTo(x,y);}g.stroke();
  }
  g.strokeStyle=ash?'rgba(38,53,41,.54)':'rgba(68,51,28,.58)';g.lineWidth=Math.max(.7,cell*.02);g.beginPath();
  for(let i=0;i<N;i++){const p=pad+i*cell;g.moveTo(pad,p);g.lineTo(size-pad,p);g.moveTo(p,pad);g.lineTo(p,size-pad);}g.stroke();
  g.lineWidth=Math.max(1,cell*.035);g.strokeRect(pad,pad,size-2*pad,size-2*pad);
  g.fillStyle=ash?'#3c4b40':'#655035';
  for(const[hx,hy]of[[3,3],[11,3],[7,7],[3,11],[11,11]]){g.beginPath();g.arc(pad+hx*cell,pad+hy*cell,Math.max(2,cell*.074),0,7);g.fill();}
  g.font=`500 ${Math.max(9,cell*.27)}px ui-sans-serif,system-ui,sans-serif`;g.textAlign='center';g.textBaseline='middle';
  for(let i=0;i<N;i++){g.fillText(COLS[S.flip?14-i:i],pad+i*cell,size-pad*.32);g.fillText(String(S.flip?i+1:15-i),pad*.32,pad+i*cell);}
  g.strokeStyle='rgba(255,255,255,.40)';g.lineWidth=2;g.strokeRect(1,1,size-2,size-2);
}
/* ---- stones ---- */
function backOut(p){const c=2.04;return 1+(c+1)*Math.pow(p-1,3)+c*Math.pow(p-1,2);}
function drawStone(g,cx,cy,rr0,color,scale=1,alpha=1,yLift=0,shadow=1){
  const rr=rr0*scale,y=cy+yLift;g.save();g.globalAlpha=alpha;
  const sx=cx+rr*.10,sy=cy+rr*.18+yLift*.35;
  const shade=g.createRadialGradient(sx,sy,rr*.4,sx,sy,rr*1.25);shade.addColorStop(0,`rgba(35,28,21,${.34*shadow})`);shade.addColorStop(1,'rgba(35,28,21,0)');
  g.fillStyle=shade;g.beginPath();g.arc(sx,sy,rr*1.25,0,7);g.fill();
  const material=g.createRadialGradient(cx-rr*.34,y-rr*.42,rr*.05,cx,y,rr*1.15);
  if(color===BLACK){material.addColorStop(0,'#535856');material.addColorStop(.48,'#272c2a');material.addColorStop(1,'#111513');}
  else{material.addColorStop(0,'#ffffff');material.addColorStop(.55,'#f4f4ef');material.addColorStop(1,'#c9cbc2');}
  g.fillStyle=material;g.beginPath();g.arc(cx,y,rr,0,7);g.fill();
  g.strokeStyle=color===BLACK?'rgba(0,0,0,.60)':'rgba(108,110,101,.60)';g.lineWidth=Math.max(.6,rr*.04);g.stroke();
  g.beginPath();g.arc(cx-rr*.03,y-rr*.03,rr*.82,Math.PI*1.10,Math.PI*1.63);g.strokeStyle=color===BLACK?'rgba(255,255,255,.16)':'rgba(255,255,255,.8)';g.lineWidth=Math.max(.6,rr*.035);g.stroke();g.restore();
}
