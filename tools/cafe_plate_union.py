import numpy as np, glob, sys
from PIL import Image
from scipy import ndimage as ndi
D=sys.argv[1]
def alpha(f):
    a=np.asarray(Image.open(f).convert('RGBA')).astype(float)
    r,g,b=a[...,0],a[...,1],a[...,2]
    gs=np.clip((g-np.maximum(r,b)-40)/120,0,1)
    return (1-gs)*(a[...,3]/255), a[...,:3]
scene=np.asarray(Image.open(f'{D}/018_scene.png').convert('RGB')).astype(float)
plate=np.asarray(Image.open(f'{D}/018_plate.png').convert('RGB')).astype(float)
files=[f for f in sorted(glob.glob(f'{D}/018_*.png')) if not any(k in f for k in ['scene','plate','contact','mum'])]
U=np.zeros(scene.shape[:2],bool)
for f in files:
    al,_=alpha(f); U|=al>0.08
U=ndi.binary_dilation(U,iterations=4)
w=ndi.gaussian_filter(U.astype(float),1.5)        # feathered seam
fixed=scene*(1-w[...,None])+plate*w[...,None]
Image.fromarray(np.clip(fixed,0,255).astype(np.uint8)).save(f'{D}/018_plate_fixed.png')
Image.fromarray((U*255).astype(np.uint8)).save(f'{D}/union_mask.png')
print('union px',U.sum(), 'files',len(files))
