import numpy as np
from PIL import Image, ImageFilter, ImageDraw, ImageFont
from scipy import ndimage as ndi
PAPER=np.array([246,243,236],float)
W,H=1672,941
rng_cache={}
def lattice(seed, gw, gh):
    r=np.random.default_rng(seed); return r.random((gh+2,gw+2))
def vnoise(cell, seed):
    gw,gh=int(W/cell)+1,int(H/cell)+1
    L=lattice(seed,gw,gh)
    ys,xs=np.mgrid[0:H,0:W].astype(float)
    fx,fy=xs/cell,ys/cell; ix,iy=fx.astype(int),fy.astype(int); tx,ty=fx-ix,fy-iy
    sx,sy=tx*tx*(3-2*tx),ty*ty*(3-2*ty)
    a=L[iy,ix];b=L[iy,ix+1];c=L[iy+1,ix];d=L[iy+1,ix+1]
    top=a+(b-a)*sx; bot=c+(d-c)*sx; return top+(bot-top)*sy
def fbm(cells,weights,seed):
    s=sum((2*vnoise(c,seed+i)-1)*w for i,(c,w) in enumerate(zip(cells,weights))); return s/sum(weights)
ys,xs=np.mgrid[0:H,0:W].astype(float)
R=0.06*W
dx=np.minimum(xs,W-xs); dy=np.minimum(ys,H-ys)
corner=(dx<R)&(dy<R)
din=np.where(corner,R-np.hypot(R-dx,R-dy),np.minimum(dx,dy))
bottom=np.clip((ys/H-0.8)/0.2,0,1)
def sstep(t): t=np.clip(t,0,1); return t*t*(3-2*t)
def fields(seed):
    wn=fbm([110,45,18,7],[1,.55,.3,.15],seed)
    ww=fbm([140,60],[1,.55],seed+100)
    width=np.maximum(6,60*(1+0.75*ww)*(1-0.55*bottom))
    wander=60*wn*(1-0.6*bottom)
    return width,wander
def alpha_current(seed):
    width,wander=fields(seed); return np.where(din<=0,0,sstep((din+wander)/width))
def alpha_fixed(seed, inset=0):
    width,wander=fields(seed)
    a=sstep((din-inset*(1-0.75*bottom)+wander)/width)
    return a*sstep(din/28.0)   # the plate's rim is always paper: no straight cut
def lines_of(img):
    g=np.asarray(img.convert('L'),float)
    blur=ndi.gaussian_filter(g,2.2)
    dog=np.clip((blur-g-6)/16,0,1)
    dark=np.clip((95-g)/55,0,1)
    l=np.maximum(dog,dark*0.8)
    # drop texture specks: keep only connected strokes
    m=l>0.35
    lab,n=ndi.label(m)
    sizes=ndi.sum(m,lab,range(1,n+1))
    keep=np.zeros(n+1,bool); keep[1:]=sizes>=60
    l=l*ndi.binary_dilation(keep[lab],iterations=1)
    return ndi.gaussian_filter(l,0.7)
def compose(img, a_paint, a_pencil, lines, seed):
    rgb=np.asarray(img.convert('RGB'),float)
    grain=0.7+0.3*vnoise(1.6,seed+7)
    brk=vnoise(9,seed+9)
    pen=np.clip(lines*grain*1.15,0,1)
    # strokes break up as they go outward
    keep=sstep((brk-(1-a_pencil)*0.9+0.25)/0.35)
    pen=pen*a_pencil*keep
    out=PAPER*(1-a_paint[...,None])+rgb*a_paint[...,None]
    graphite=np.array([78,74,70],float)
    pa=(pen*(1-a_paint))[...,None]
    out=out*(1-pa*0.85)+graphite*pa*0.85
    return Image.fromarray(np.clip(out,0,255).astype(np.uint8))
def options(img, seed):
    lines=lines_of(img)
    width,wander=fields(seed)
    A=compose(img, alpha_fixed(seed,0), np.zeros((H,W)), lines, seed)
    # B: colour pulls in ~45 px; pencil carries on to where colour used to end
    aB=alpha_fixed(seed,45); pB=alpha_fixed(seed,-10)
    B=compose(img,aB,pB,lines,seed)
    # C: colour pulls in ~110 px; a wide sketched border
    aC=alpha_fixed(seed,120); pC=sstep((din+0.6*wander-8)/(90*(1-0.6*bottom)))*sstep(din/20)
    C=compose(img,aC,pC,lines,seed)
    cur=compose(img, alpha_current(seed), np.zeros((H,W)), lines, seed)
    return cur,A,B,C
def sheet(rows, names, out):
    pad=40; tw=820; th=int(tw*H/W)
    font=ImageFont.load_default(size=26) if hasattr(ImageFont,'load_default') else None
    S=Image.new('RGB',(pad+len(names)*(tw+pad), pad+len(rows)*(th+pad+40)),tuple(PAPER.astype(int)))
    d=ImageDraw.Draw(S)
    for r,ims in enumerate(rows):
        for c,im in enumerate(ims):
            x=pad+c*(tw+pad); y=pad+r*(th+pad+40)
            if r==0: d.text((x,y-34+30),names[c],fill=(60,55,50),font=font)
            S.paste(im.resize((tw,th),Image.LANCZOS),(x,y+30))
    S.save(out,quality=90)
import sys
srcs=[('reference/scene-keyframe-hammering.png',11),('scene/mushroom-lab.png',23),('frames/018-cafe-scene/approved/018_scene.png',37)]
rows=[];full=[]
for p,seed in srcs:
    im=Image.open('/home/claude/hjaas/'+p).convert('RGB')
    if im.size!=(W,H):
        w2=int(im.height*W/H); x0=(im.width-w2)//2; im=im.crop((x0,0,x0+w2,im.height)).resize((W,H),Image.LANCZOS)
    o=options(im,seed); rows.append(o); full.append(o)
names=['Now (hard straight cuts)','A: fixed, soft all round','B: colour fades, pencil trails','C: wide pencil sketch border']
sheet(rows,names,'/home/claude/work/edge-options.jpg')
for i,n in enumerate(['A','B','C']):
    full[0][i+1].save(f'/home/claude/work/build-{n}.jpg',quality=92)
    full[2][i+1].save(f'/home/claude/work/cafe-{n}.jpg',quality=92)
full[0][0].save('/home/claude/work/build-now.jpg',quality=92)
print('ok')
