import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi
W,H=980,1380; OX,OY=680,210
def blend(fg,bg,m,blur=4):
    m=(np.asarray(Image.fromarray((np.clip(m,0,1)*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(blur)))/255.0)[...,None]
    pa=fg[...,:3]*(fg[...,3:4]/255); pb=bg[...,:3]*(bg[...,3:4]/255); ao=fg[...,3:4]*m+bg[...,3:4]*(1-m)
    return np.dstack([(pa*m+pb*(1-m))/np.maximum(ao/255,1e-6),ao[...,0]])
def diffmask(a,b,thr=20):
    d=np.abs(a-b); return (d[...,:3].mean(2)*np.maximum(a[...,3],b[...,3])/255>thr)|(np.abs(a[...,3]-b[...,3])>100)
def clean(m,grow,minsz=60):
    m=ndi.binary_opening(m,iterations=1); lab,n=ndi.label(m)
    if n:
        sz=ndi.sum(m,lab,range(1,n+1)); m=np.isin(lab,[i+1 for i,s in enumerate(sz) if s>minsz])
    m=ndi.binary_closing(m,iterations=grow); m=ndi.binary_fill_holes(m); return ndi.binary_dilation(m,iterations=grow)
