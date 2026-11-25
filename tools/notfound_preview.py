# Build the 404 sketching loop: key poses, paste only moving zones onto the base, render a preview.
import sys, json, subprocess, numpy as np
from PIL import Image, ImageDraw, ImageFont
P=sys.argv[1]           # folder holding S1..S5.png and B.png
BASE='/mnt/user-data/uploads/quinn/jobs/044-404-table-fix/out/rachel_table_green.png'
OUT=sys.argv[2]
ARM=(590,345,805,478); EYE=(722,232,800,292)
def key(arr):
    a=arr.astype(float); r,g,b=a[...,0],a[...,1],a[...,2]
    dom=g-np.maximum(r,b); al=np.clip(1-(dom-20)/120,0,1); al[g<100]=1
    a[...,1]=np.minimum(g,np.maximum(r,b)+5)
    return np.dstack([a,al*255]).astype(np.uint8)
def load(p): return np.array(Image.open(p).convert('RGB'))
base=load(BASE)
def pose(arm=None, blink=False):
    im=base.copy()
    if arm:
        src=load(f'{P}/{arm}.png'); x0,y0,x1,y1=ARM; im[y0:y1,x0:x1]=src[y0:y1,x0:x1]
    if blink:
        src=load(f'{P}/B.png'); x0,y0,x1,y1=EYE; im[y0:y1,x0:x1]=src[y0:y1,x0:x1]
    return key(im)
# background with the 404 (layout from the approved still)
W,H=1672,941; dy=38
FP='/usr/share/fonts/truetype/google-fonts/ofl/anton/Anton-Regular.ttf'
size=600
for _ in range(30):
    f=ImageFont.truetype(FP,size); bb=f.getbbox('404'); s=0.72*W/(bb[2]-bb[0])
    if abs(s-1)<0.003: break
    size=int(size*s)
bb=f.getbbox('404'); w=bb[2]-bb[0]; h=bb[3]-bb[1]; top=(H-h)//2
BG=Image.new('RGBA',(W,H),(246,243,236,255)); ImageDraw.Draw(BG).text(((W-w)//2-bb[0],top-bb[1]),'404',font=f,fill=(0,0,0,255))
def frame(fg):
    im=BG.copy(); im.alpha_composite(Image.fromarray(fg),(0,dy)); return np.array(im.convert('RGB'))
# loop: (arm pose, ms). Strokes at ~10 fps, short holds between strokes.
seq=[('S1',400),('S2',90),('S3',90),('S4',110),('S1',260),
     ('S2',90),('S3',90),('S4',110),('S1',120),('S5',100),('S1',100),('S5',100),('S1',700),
     ('S2',90),('S3',90),('S4',110),('S1',900)]
blink_at={12:True}      # blink during the long pause
FPS=30; frames=[]; cache={}
for i,(p,ms) in enumerate(seq):
    k=(p,blink_at.get(i,False))
    if k not in cache: cache[k]=frame(pose(p,k[1]))
    n=max(1,round(ms*FPS/1000))
    for j in range(n):
        # blink lasts ~130 ms in the middle of its hold
        if k[1] and not (n//2-2<=j<n//2+2): kk=(p,False); cache.setdefault(kk,frame(pose(p))); frames.append(cache[kk])
        else: frames.append(cache[k])
loop_s=len(frames)/FPS
import os; os.makedirs(OUT,exist_ok=True)
pr=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-',
   '-vf','scale=1280:-2','-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p',f'{OUT}/sketch-loop-preview.mp4'],stdin=subprocess.PIPE)
for _ in range(3):
    for fr in frames: pr.stdin.write(fr.tobytes())
pr.stdin.close(); pr.wait()
json.dump({'loop_seconds':loop_s,'sequence':seq},open(f'{OUT}/routine.json','w'),indent=1)
print('loop',round(loop_s,2),'s, poses',len(cache))
