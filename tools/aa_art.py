import numpy as np
from PIL import Image, ImageFilter
def smooth_flat(img, box, k=4):
    """Anti-alias stair-stepped flat-colour art inside box (x0,y0,x1,y1): 4x nearest upscale, median 7, box-downscale."""
    im=img.convert('RGB'); x0,y0,x1,y1=box
    r=im.crop(box); W,H=r.size
    up=r.resize((W*k,H*k),Image.NEAREST).filter(ImageFilter.MedianFilter(7))
    dn=up.resize((W,H),Image.BOX)
    out=im.copy(); out.paste(dn,(x0,y0)); return out
