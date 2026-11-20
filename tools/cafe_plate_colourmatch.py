import numpy as np, sys
from PIL import Image
from scipy import ndimage as ndi
D=sys.argv[1]
scene=np.asarray(Image.open(f'{D}/018_scene.png').convert('RGB')).astype(float)
plate=np.asarray(Image.open(f'{D}/018_plate.png').convert('RGB')).astype(float)
U=np.asarray(Image.open(f'{D}/union_mask.png'))>127
# colour-match the generated fill to the real scene around it: diffuse the difference measured on a ring outside the union inward
ring=ndi.binary_dilation(U,iterations=10)&~ndi.binary_dilation(U,iterations=3)
diff=(scene-plate)*ring[...,None]
sig=45
num=np.stack([ndi.gaussian_filter(diff[...,c],sig) for c in range(3)],-1)
den=ndi.gaussian_filter(ring.astype(float),sig)[...,None]
corr=num/np.maximum(den,1e-3)
corr*=np.clip(den/0.02,0,1)        # only where a ring is nearby
fill=np.clip(plate+corr,0,255)
w=ndi.gaussian_filter(U.astype(float),1.5)[...,None]
fixed=scene*(1-w)+fill*w
Image.fromarray(np.clip(fixed,0,255).astype(np.uint8)).save(f'{D}/018_plate_fixed.png')
