import sys
sys.path.insert(0,'/home/claude/hjaas/tools')
from stabilise_frames import key, register, shift
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi
R='/home/claude/work/rx/'
H='/home/claude/hjaas/'
W2,H2=1146,916
orig={'frame_01':H+'frames/001-hammer-loop/approved/frame_01.png','frame_02':H+'frames/001-hammer-loop/approved/frame_02.png',
'frame_03':H+'frames/001-hammer-loop/approved/frame_03.png','frame_04':H+'frames/001-hammer-loop/approved/frame_04.png',
'blink_half':H+'frames/002-blink/approved/blink_half.png','blink_closed':H+'frames/002-blink/approved/blink_closed.png',
'K1':H+'frames/004-reaction-keyposes/approved/frame_01.png','K2':H+'frames/004-reaction-keyposes/approved/frame_02.png'}
up={'frame_01':'up_loop_01','frame_02':'up_loop_02','frame_03':'up_loop_03','frame_04':'up_loop_04','blink_half':'up_blink_half','blink_closed':'up_blink_closed','K1':'up_K1','K2':'up_K2'}
def load_up(k):
    im=Image.open(R+up[k]+'.png').convert('RGB').resize((W2,H2),Image.LANCZOS)
    return key(im)
def o1(k): return np.asarray(Image.open(orig[k]).convert('RGBA')).astype(np.float32)
base=load_up('frame_01'); b1=o1('frame_01')
out={'frame_01':base}
rep=[]
for k in orig:
    if k=='frame_01': continue
    u=load_up(k)
    (dy,dx),err=register(base,u,(880,640,1360,910) if False else (2*440,2*320,2*560,2*455),search=8)
    # change mask from the 1x originals (already registered to frame 1)
    a=o1(k); d=np.abs(a-b1)
    ch=(d[...,:3].mean(2)*np.maximum(a[...,3],b1[...,3])/255>20)|(np.abs(a[...,3]-b1[...,3])>100)
    ch=ndi.binary_opening(ch,iterations=1)
    lab,n=ndi.label(ch)
    if n:
        sz=ndi.sum(ch,lab,range(1,n+1)); ch=np.isin(lab,[i+1 for i,s in enumerate(sz) if s>12])
    ch=ndi.binary_closing(ch,iterations=6); ch=ndi.binary_fill_holes(ch); ch=ndi.binary_dilation(ch,iterations=6)
    m=Image.fromarray((ch*255).astype(np.uint8)).resize((W2,H2),Image.BILINEAR).filter(ImageFilter.GaussianBlur(4))
    m=(np.asarray(m)/255.0)[...,None]
    al=shift(u,dy,dx) if (dy,dx)!=(0,0) else u
    pa=al[...,:3]*(al[...,3:4]/255); pb=base[...,:3]*(base[...,3:4]/255)
    ao=al[...,3:4]*m+base[...,3:4]*(1-m)
    rgb=(pa*m+pb*(1-m))/np.maximum(ao/255,1e-6)
    out[k]=np.dstack([rgb,ao[...,0]])
    rep.append(f'{k}: shift {dy},{dx} err {err:.1f} changed {ch.mean()*100:.1f}%')
import os
os.makedirs('approved',exist_ok=True)
for k,v in out.items():
    Image.fromarray(np.clip(v,0,255).astype(np.uint8),'RGBA').save(f'approved/{k}.png')
print('\n'.join(rep))
