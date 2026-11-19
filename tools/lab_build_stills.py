import sys; sys.path.insert(0,'/home/claude/hjaas/tools')
from stabilise_frames import key, register, shift
import numpy as np, os, json
from PIL import Image, ImageFilter
from scipy import ndimage as ndi
U='/mnt/user-data/uploads/hjaas/wren-inbox/'
A='/home/claude/hjaas/frames/017-lab-keyposes/approved/'
W,H=980,1380; OX,OY=680,210   # plate origin of the 2x canvas
up={'A1_mist_aim':'e0cf5be6-971e-47dc-889a-71e05d12a018','A2_mist_squeeze':'22183215-4f3c-4250-ad79-4583e0434c13',
'A3_mist_lift':'41c413d8-e633-439f-81ad-faef6d83ffba','B1_write':'ef9fcb71-5527-4b11-a836-18ac62f1af32',
'A1_blink_half':'066f53c7-98f1-4bca-810b-57e8e98bb029','K1_beam':'4c5f5d4e-38a6-48b7-abbd-bf5a6fa7f7d9','K2_thumbs':'0554caa4-4a64-479e-bc6a-d6dbdc5c8b5e'}
print('upscale size',Image.open(U+up['A1_mist_aim']+'.png').size)
def one_x(n):  # 1x approved, cropped to the canvas area, as float RGBA at 2x size
    im=Image.open(A+n+'.png').crop((OX,OY,OX+490,OY+690)).resize((W,H),Image.NEAREST)
    return np.asarray(im).astype(np.float32)
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
# ---- stills
S={}
base=key(Image.open(U+up['A1_mist_aim']+'.png').convert('RGB').resize((W,H),Image.LANCZOS)); S['A1_mist_aim']=base
b1=one_x('A1_mist_aim')
for n in up:
    if n=='A1_mist_aim': continue
    u=key(Image.open(U+up[n]+'.png').convert('RGB').resize((W,H),Image.LANCZOS))
    (dy,dx),e=register(base,u,(60,780,560,1300),search=8)
    u=shift(u,dy,dx) if (dy,dx)!=(0,0) else u
    m=clean(diffmask(one_x(n),b1),10)
    S[n]=blend(u,base,m)
    print(n,'shift',dy,dx,'changed %.1f%%'%(m.mean()*100))
os.makedirs('out/stills',exist_ok=True)
for n,v in S.items(): Image.fromarray(np.clip(v,0,255).astype(np.uint8),'RGBA').save(f'out/stills/{n}.png')
np.save('stills.npy',np.stack([S[k] for k in up]).astype(np.float32)); json.dump(list(up),open('stills_order.json','w'))
