import sys; sys.path.insert(0,'/home/claude/hjaas/tools'); sys.path.insert(0,'.')
from stabilise_frames import key, register, shift
from build_lib import *
import json, os
order=json.load(open('stills_order.json')); arr=np.load('stills.npy'); S={k:arr[i] for i,k in enumerate(order)}
def vframe(v,i):
    im=Image.open(f'{v}/f{i:03d}.png').convert('RGB').resize((1440,1440),Image.LANCZOS)
    c=Image.new('RGB',(W,H),(0,255,0)); c.paste(im,((562-OX)*2,(195-OY)*2)); return key(c)
def fit(src,ref,mask):
    out=src.copy()
    for c in range(3):
        x=src[...,c][mask]; y=ref[...,c][mask]
        k,b=np.linalg.lstsq(np.vstack([x,np.ones_like(x)]).T,y,rcond=None)[0]; out[...,c]=np.clip(src[...,c]*k+b,0,255)
    return out
TROLLEY=(60,780,560,1300)
yy0,xx0=np.mgrid[0:H,0:W]; upper=yy0<870
def build(v,frames,base,zone,name):
    os.makedirs(f'out/{name}',exist_ok=True); res=[]
    first=vframe(v,frames[0]); (dy,dx),e=register(base,first,TROLLEY,search=20); print(name,'reg',dy,dx,round(e,1))
    f0=shift(first,dy,dx) if (dy,dx)!=(0,0) else first
    close=np.abs(f0[...,:3]-base[...,:3]).mean(2)<25
    good=(base[...,3]>250)&(f0[...,3]>250)&upper&close
    coef=[]
    for c in range(3):
        x=f0[...,c][good]; y=base[...,c][good]
        coef.append(np.linalg.lstsq(np.vstack([x,np.ones_like(x)]).T,y,rcond=None)[0])
    print('  colour fit',[(round(k,3),round(b,1)) for k,b in coef],'px',good.sum())
    for i in frames:
        a=vframe(v,i); a=shift(a,dy,dx) if (dy,dx)!=(0,0) else a
        for c,(k,b) in enumerate(coef): a[...,c]=np.clip(a[...,c]*k+b,0,255)
        m=clean(diffmask(a,base,28)&zone,8)
        o=blend(a,base,m,4)
        Image.fromarray(np.clip(o,0,255).astype(np.uint8),'RGBA').save(f'out/{name}/{name}_{i:03d}.png'); res.append(i)
    return res
yy,xx=np.mgrid[0:H,0:W]
upper=yy<870          # above the trolley's top shelf edge (plate y ~645): legs, wheels, lower trolley never change
headzone=clean(diffmask(S['K1_beam'],S['A1_mist_aim']),30)&upper
armzone=(clean(diffmask(S['K2_thumbs'],S['K1_beam']),40)|((xx>620)&(yy>250)&(yy<820)))&upper
# V0 misting -> writing (skip spray burst, squints and the clipboard smear)
f0=[i for i in range(19,74) if i not in (54,55,57,58,59)]
build('v0',f0,S['A1_mist_aim'],upper,'mist_to_write')
# V1 writing loop (B1 -> B1), all frames
build('v1',list(range(1,74)),S['B1_write'],upper,'write_loop')
# V2 look up (blink through the head lift; skip the eye smear and the frames where glasses appear)
f2=[28,30,32,34,36,37,38]+list(range(42,74))
build('v2',f2,S['A1_mist_aim'],headzone,'look_up')
# V3 thumbs-up (skip smeared hand frames)
f3=[1,4,7,10,13,16]+list(range(20,74))
build('v3',f3,S['K1_beam'],armzone,'thumbs_up')
