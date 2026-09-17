"""Render the original three-stone mark with deterministic standard-library PNG output."""
from pathlib import Path
import math, struct, zlib
ROOT=Path(__file__).resolve().parents[1]
def png(size, maskable=False):
    scale=3; w=size*scale; bg=(25,36,32); grid=(86,105,90)
    rows=[bytearray(bg*w) for _ in range(w)]
    def rect(x0,y0,x1,y1,c):
        a,b=max(0,int(x0*w)),min(w,int(x1*w)); color=bytes(c)*(b-a)
        for y in range(max(0,int(y0*w)),min(w,int(y1*w))):rows[y][a*3:b*3]=color
    def circle(cx,cy,r,c):
        cx*=w;cy*=w;r*=w
        for y in range(max(0,int(cy-r)),min(w,int(cy+r+1))):
            d=math.sqrt(max(0,r*r-(y+.5-cy)**2));a=max(0,int(cx-d));b=min(w,int(cx+d));rows[y][a*3:b*3]=bytes(c)*(b-a)
    # Every important element lies inside the maskable safe circle.
    for t in [.32,.5,.68]:
        rect(t-.005,.235,t+.005,.765,grid);rect(.235,t-.005,.765,t+.005,grid)
    for x,y,c in [(.32,.68,(229,233,218)),(.5,.5,(229,233,218)),(.68,.32,(233,135,100))]:circle(x,y,.062,c)
    raw=bytearray()
    for y in range(size):
        raw.append(0)
        for x in range(size):
            for k in range(3):raw.append(sum(rows[y*scale+dy][(x*scale+dx)*3+k] for dy in range(scale) for dx in range(scale))//(scale*scale))
    def chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',size,size,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b'')
for name,size in [('icon-512.png',512),('maskable-icon-512.png',512),('icon-192.png',192),('apple-touch-icon.png',180),('favicon-32.png',32)]:
    (ROOT/'icons'/name).write_bytes(png(size))
print('Rendered five icon sizes from the original three-stone mark.')
