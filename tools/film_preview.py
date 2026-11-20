import numpy as np, random, subprocess
from PIL import Image, ImageDraw
A='/home/claude/hjaas/frames/020-film-scene/approved/'
def load(n):
    a=np.asarray(Image.open(A+n+'.png').convert('RGB')).astype(np.float32)
    m=~((a[...,1]>200)&(a[...,0]<90)&(a[...,2]<90))
    return a,m
plate=np.asarray(Image.open(A+'020_plate.png').convert('RGB')).astype(np.float32)
P={n:load('020_'+n) for n in ['W_1','W_2','W_3','M_1','M_1_mid','M_1_closed','M_1_blink','M_12','M_13','M_2','M_2_closed','M_3','M_3_closed','R_A1_film','R_B1_glance','R_K0_turn','R_K1_look']}
FPS=24; T=16; N=FPS*T; random.seed(4)
# presenter base pose timeline
def mpose(t):
    seq=[(0,3.0,'M_1'),(3.0,3.125,'M_12'),(3.125,5.6,'M_2'),(5.6,5.725,'M_12'),(5.725,8.7,'M_1'),(8.7,8.825,'M_13'),(8.825,11.2,'M_3'),(11.2,11.325,'M_13'),(11.325,99,'M_1')]
    for a,b,p in seq:
        if a<=t<b: return p
# mouth: talking with pauses
mouth=[]; i=0
while i<N:
    if random.random()<0.08:
        k=random.randint(6,12); mouth+=['closed']*k; i+=k; continue
    s=random.choice(['open','mid','closed','open','mid']); k=random.randint(2,4); mouth+=[s]*k; i+=k
blinks=set()
for bt in [2.2,7.4,13.1]:
    for j in range(3): blinks.add(int(bt*FPS)+j)
def rach(t):
    # returns list of (pose,weight)
    if 4.0<=t<4.17: w=(t-4.0)/0.17; return [('R_A1_film',1-w),('R_B1_glance',w)]
    if 4.17<=t<5.3: return [('R_B1_glance',1)]
    if 5.3<=t<5.47: w=(t-5.3)/0.17; return [('R_B1_glance',1-w),('R_A1_film',w)]
    if 10.0<=t<10.09: return [('R_K0_turn',1)]
    if 10.09<=t<11.9: return [('R_K1_look',1)]
    if 11.9<=t<11.99: return [('R_K0_turn',1)]
    return [('R_A1_film',1)]
scr=(1072,507,1116,547)
proc=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s','1280x720','-r',str(FPS),'-i','-','-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','/home/claude/prev/film_preview.mp4'],stdin=subprocess.PIPE)
for f in range(N):
    t=f/FPS; c=plate.copy()
    w=P[['W_1','W_2','W_3'][(f//3)%3]]; c[w[1]]=w[0][w[1]]
    mp=mpose(t)
    if mp in ('M_12','M_13'): name=mp
    elif f in blinks and mp=='M_1': name='M_1_blink'
    else:
        mo=mouth[f]
        if mp=='M_1': name={'open':'M_1','mid':'M_1_mid','closed':'M_1_closed'}[mo]
        else: name=mp if mo!='closed' else mp+'_closed'
    a,m=P[name]; c[m]=a[m]
    layers=rach(t)
    if len(layers)==1:
        a,m=P[layers[0][0]]; c[m]=a[m]
    else:
        (n1,w1),(n2,w2)=layers; a1,m1=P[n1]; a2,m2=P[n2]
        base=c.copy(); l1=base.copy(); l1[m1]=a1[m1]; l2=base.copy(); l2[m2]=a2[m2]; c=l1*w1+l2*w2
    if layers[0][0] in ('R_A1_film','R_B1_glance','R_K0_turn') and layers[-1][0]!='R_K1_look':
        # live screen: presenter mirror + REC dot
        mini=Image.fromarray(c[250:540,600:920].astype('uint8')).resize((scr[2]-scr[0]-4,scr[3]-scr[1]-4))
        img=Image.fromarray(c.astype('uint8')); img.paste(mini,(scr[0]+2,scr[1]+2))
        if (f//12)%2==0:
            d=ImageDraw.Draw(img); d.ellipse((scr[0]+4,scr[1]+4,scr[0]+10,scr[1]+10),fill=(235,30,30))
        c=np.asarray(img).astype(np.float32)
    out=Image.fromarray(np.clip(c,0,255).astype('uint8')).resize((1280,720),Image.LANCZOS)
    proc.stdin.write(out.tobytes())
proc.stdin.close(); proc.wait(); print('ok')
