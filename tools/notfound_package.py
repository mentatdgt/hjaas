# Package the 404 sketching loop for the site. Coordinates: the 1672x941 page canvas.
import json, io, os, numpy as np
from PIL import Image
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
P='/tmp/sk/final'; BASE='/mnt/user-data/uploads/quinn/jobs/044-404-table-fix/out/rachel_table_green.png'
OUT='/tmp/pk/404'; os.makedirs(OUT,exist_ok=True)
W,H,DY=1672,941,38
ARM=(590,345,805,478); EYE=(722,232,800,292); INSET=2
def key(arr):
    a=arr.astype(float); r,g,b=a[...,0],a[...,1],a[...,2]
    dom=g-np.maximum(r,b); al=np.clip(1-(dom-20)/120,0,1); al[g<100]=1
    a[...,1]=np.minimum(g,np.maximum(r,b)+5)
    rgba=np.dstack([a,al*255]).astype(np.uint8); rgba[al==0,:3]=0
    return rgba
L=lambda p: np.array(Image.open(p).convert('RGB'))
base=L(BASE); s1=base.copy(); s1[ARM[1]:ARM[3],ARM[0]:ARM[2]]=L(P+'/S1.png')[ARM[1]:ARM[3],ARM[0]:ARM[2]]
fig=key(s1)
# crop to the figure, padded
ys,xs=np.where(fig[...,3]>0); pad=4
cx0,cy0,cx1,cy1=int(xs.min())-pad,int(ys.min())-pad,int(xs.max())+pad+1,int(ys.max())+pad+1
assert cx0<=ARM[0] and cy0<=EYE[1] and cx1>=ARM[2] and cy1>=ARM[3]
still=fig.copy(); x0,y0,x1,y1=ARM; still[y0+INSET:y1-INSET,x0+INSET:x1-INSET]=0   # hole the arm patches fill
def save(name,rgba):
    im=Image.fromarray(rgba,'RGBA'); best=None
    for kw in ({'lossless':True,'method':6},{'quality':92,'alpha_quality':100,'method':6}):
        b=io.BytesIO(); im.save(b,'WEBP',**kw)
        if best is None or b.tell()<len(best): best=b.getvalue()
    open(f'{OUT}/{name}.webp','wb').write(best); return len(best)
sizes={}
sizes['figure']=save('figure',still[cy0:cy1,cx0:cx1])
for n in ['S1','S2','S3','S4','S5']:
    sizes['arm-'+n]=save('arm-'+n,key(L(f'{P}/{n}.png'))[ARM[1]:ARM[3],ARM[0]:ARM[2]])
sizes['blink']=save('blink',key(L(P+'/B.png'))[EYE[1]:EYE[3],EYE[0]:EYE[2]])
# 404 as a vector path (Anton), same layout as the approved still
f=TTFont('/usr/share/fonts/truetype/google-fonts/ofl/anton/Anton-Regular.ttf'); gs=f.getGlyphSet(); cmap=f.getBestCmap(); upm=f['head'].unitsPerEm
hmtx=f['hmtx']
def layout(scale):
    x=0; parts=[]
    for ch in '404':
        g=cmap[ord(ch)]; parts.append((g,x)); x+=hmtx[g][0]*scale
    return parts
bp=BoundsPen(gs)
def bounds(scale):
    xmin=ymin=1e9; xmax=ymax=-1e9
    for g,x in layout(scale):
        b=BoundsPen(gs); gs[g].draw(b)
        if b.bounds:
            a,c,d,e=b.bounds; xmin=min(xmin,x+a*scale); xmax=max(xmax,x+d*scale); ymin=min(ymin,c*scale); ymax=max(ymax,e*scale)
    return xmin,ymin,xmax,ymax
b1=bounds(1); scale=0.72*W/(b1[2]-b1[0])
xmin,ymin,xmax,ymax=bounds(scale); gw=xmax-xmin; gh=ymax-ymin
top=(H-gh)/2; offx=(W-gw)/2-xmin
d=[]
for g,x in layout(scale):
    sp=SVGPathPen(gs, ntos=lambda v: f'{v:.1f}')
    tp=TransformPen(sp,(scale,0,0,-scale,offx+x,top+ymax)); gs[g].draw(tp); d.append(sp.getCommands())
path=' '.join(d)
ground=top+gh
manifest={
 'note':'HJaaS 404 page: Rachel sketching. All coordinates are in the 1672x941 page canvas (use it as the SVG viewBox). Layers, back to front: the 404 path (solid #000 on #F6F3EC), figure.webp, ONE arm patch (always exactly one visible), the blink patch (only during a blink). figure.webp has a transparent hole where the arm patch goes; each arm patch fully fills it with a 2px overlap.',
 'canvas':{'w':W,'h':H,'background':'#F6F3EC'},
 'numeral':{'fill':'#000000','d':path,'bbox':[round(offx+xmin+0,1),round(top,1),round(offx+xmax,1),round(ground,1)]},
 'figure':{'src':'figure.webp','x':cx0,'y':cy0+DY,'w':cx1-cx0,'h':cy1-cy0},
 'arm':{'x':ARM[0],'y':ARM[1]+DY,'w':ARM[2]-ARM[0],'h':ARM[3]-ARM[1],'frames':{n:f'arm-{n}.webp' for n in ['S1','S2','S3','S4','S5']},'rest':'S1'},
 'blink':{'src':'blink.webp','x':EYE[0],'y':EYE[1]+DY,'w':EYE[2]-EYE[0],'h':EYE[3]-EYE[1]},
 'phone_viewbox':[round(offx+xmin-40),0,round(gw+80),H],
 'bytes':sizes}
routine={
 'note':'Loop order, holds in ms. "arm" names the arm patch shown. A blink shows blink.webp for 130 ms in the middle of the hold marked blink:true. Loop forever. prefers-reduced-motion: show the rest pose only, no loop.',
 'steps':[{'arm':'S1','ms':400},{'arm':'S2','ms':90},{'arm':'S3','ms':90},{'arm':'S4','ms':110},{'arm':'S1','ms':260},
          {'arm':'S2','ms':90},{'arm':'S3','ms':90},{'arm':'S4','ms':110},{'arm':'S1','ms':120},{'arm':'S5','ms':100},{'arm':'S1','ms':100},{'arm':'S5','ms':100},
          {'arm':'S1','ms':700,'blink':True},{'arm':'S2','ms':90},{'arm':'S3','ms':90},{'arm':'S4','ms':110},{'arm':'S1','ms':900}],
 'blink_ms':130}
json.dump(manifest,open(f'{OUT}/404.json','w'),indent=1)
json.dump(routine,open(f'{OUT}/routine.json','w'),indent=1)
print(json.dumps(sizes), 'total KB', round(sum(sizes.values())/1024,1)); print('figure',manifest['figure'],'ground',round(ground,1),'phone vb',manifest['phone_viewbox'])
