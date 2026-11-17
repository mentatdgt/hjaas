import sys; sys.path.insert(0,'/home/claude/hjaas/tools')
from stabilise_frames import key, register, shift
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi
W2,H2=1146,916; OX,OY=242,1
BOX=(560,600,1100,880)
L=lambda n: np.asarray(Image.open(f'approved/{n}.png')).astype(np.float32)
F1,K1,K2=L('frame_01'),L('K1'),L('K2')
def vid(v,i):
    im=Image.open(f'/home/claude/work/rx/{v}/f{i:03d}.png').convert('RGB').resize((1632,918),Image.LANCZOS)
    a=key(im)[OY:OY+H2,OX:OX+W2]
    return a
def diffmask(a,b,thr=30):
    d=np.abs(a-b); return (d[...,:3].mean(2)*np.maximum(a[...,3],b[...,3])/255>thr)|(np.abs(a[...,3]-b[...,3])>100)
def clean(m,grow):
    m=ndi.binary_opening(m,iterations=2)
    lab,n=ndi.label(m)
    if n:
        sz=ndi.sum(m,lab,range(1,n+1)); m=np.isin(lab,[i+1 for i,s in enumerate(sz) if s>200])
    m=ndi.binary_closing(m,iterations=grow); m=ndi.binary_fill_holes(m); return ndi.binary_dilation(m,iterations=grow)
def colorfit(src,ref,mask):
    # per-channel linear fit src->ref on mask
    out=[]
    for c in range(3):
        x=src[...,c][mask]; y=ref[...,c][mask]
        A=np.vstack([x,np.ones_like(x)]).T; k,b=np.linalg.lstsq(A,y,rcond=None)[0]; out.append((k,b))
    return out
def applyfit(a,fit):
    a=a.copy()
    for c,(k,b) in enumerate(fit): a[...,c]=np.clip(a[...,c]*k+b,0,255)
    return a
def comp(fg,bg,m):
    m=(np.asarray(Image.fromarray((m*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(5)))/255.0)[...,None]
    pa=fg[...,:3]*(fg[...,3:4]/255); pb=bg[...,:3]*(bg[...,3:4]/255)
    ao=fg[...,3:4]*m+bg[...,3:4]*(1-m)
    return np.dstack([(pa*m+pb*(1-m))/np.maximum(ao/255,1e-6),ao[...,0]])
