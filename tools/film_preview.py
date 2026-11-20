import numpy as np, random, subprocess, sys
from PIL import Image, ImageDraw
sys.path.insert(0,'tools'); from softedge import soft_rgba
A='/home/claude/hjaas/frames/020-film-scene/approved/'
OV={k:v for k,v in [a.split('=') for a in sys.argv[2:]]}  # name=path overrides
def load(n):
    p=OV.get(n, A+'020_'+n+'.png')
    return soft_rgba(Image.open(p).convert('RGB'))
plate=np.asarray(Image.open(A+'020_plate.png').convert('RGB')).astype(np.float32)
names=['W_1','W_2','W_3','M_1','M_1_mid','M_1_closed','M_1_blink','M_12','M_13','M_2','M_2_closed','M_3','M_3_closed','R_A1_film','R_K0_turn','R_K1_look']
P={n:load(n) for n in names}
FPS=24; T=16; N=FPS*T; random.seed(4)
def mpose(t):
    seq=[(0,3.0,'M_1'),(3.0,3.125,'M_12'),(3.125,5.6,'M_2'),(5.6,5.725,'M_12'),(5.725,8.7,'M_1'),(8.7,8.825,'M_13'),(8.825,11.2,'M_3'),(11.2,11.325,'M_13'),(11.325,99,'M_1')]
    for a,b,p in seq:
        if a<=t<b: return p
mouth=[]; i=0
while i<N:
    if random.random()<0.08:
        k=random.randint(6,12); mouth+=['closed']*k; i+=k; continue
    s=random.choice(['open','mid','closed','open','mid']); k=random.randint(2,4); mouth+=[s]*k; i+=k
blinks={int(bt*FPS)+j for bt in [2.2,7.4,13.1] for j in range(3)}
def rach(t):
    if 9.0<=t<9.09: return 'R_K0_turn'
    if 9.09<=t<10.9: return 'R_K1_look'
    if 10.9<=t<10.99: return 'R_K0_turn'
    return 'R_A1_film'
SCR={'R_A1_film':(1072,507,1116,547),'R_K0_turn':(1072,507,1116,547),'R_K1_look':(1053,550,1096,589)}
def over(c,layer):
    col,al=layer; a=al[...,None]; return c*(1-a)+col*a
out=sys.argv[1]
proc=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s','1672x940','-r',str(FPS),'-i','-','-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p',out],stdin=subprocess.PIPE)
for f in range(N):
    t=f/FPS; c=plate.copy()
    c=over(c,P[['W_1','W_2','W_3'][(f//3)%3]])
    mp=mpose(t)
    if mp in ('M_12','M_13'): name=mp
    elif f in blinks and mp=='M_1': name='M_1_blink'
    else:
        mo=mouth[f]
        name={'open':'M_1','mid':'M_1_mid','closed':'M_1_closed'}[mo] if mp=='M_1' else (mp if mo!='closed' else mp+'_closed')
    c=over(c,P[name])
    r=rach(t); c=over(c,P[r])
    s=SCR[r]
    img=Image.fromarray(np.clip(c,0,255).astype('uint8'))
    mini=img.crop((600,250,920,540)).resize((s[2]-s[0]-4,s[3]-s[1]-4),Image.LANCZOS)
    img.paste(mini,(s[0]+2,s[1]+2))
    if (f//12)%2==0:
        d=ImageDraw.Draw(img); d.ellipse((s[0]+4,s[1]+4,s[0]+10,s[1]+10),fill=(235,30,30))
    proc.stdin.write(img.crop((0,0,1672,940)).tobytes())
proc.stdin.close(); proc.wait(); print('ok')
