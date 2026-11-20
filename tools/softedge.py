import numpy as np
from PIL import Image
from scipy import ndimage
def soft_rgba(rgb, sigma=0.7):
    """rgb: HxWx3 uint8/float with flat #00FF00 bg -> (color float HxWx3, alpha float HxW)"""
    a=np.asarray(rgb).astype(np.float32)
    m=~((a[...,1]>200)&(a[...,0]<90)&(a[...,2]<90))
    al=ndimage.gaussian_filter(m.astype(np.float32),sigma)
    al=np.clip((al-0.1)/0.8,0,1)   # keep interior solid, soft 1px rim
    # colour for rim pixels outside the mask: nearest inside pixel
    _,(iy,ix)=ndimage.distance_transform_edt(~m,return_indices=True)
    col=a[iy,ix]
    return col,al
