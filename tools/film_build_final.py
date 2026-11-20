import sys, numpy as np
sys.path.insert(0,'tools'); from aa_art import smooth_flat
from PIL import Image
A='/home/claude/hjaas/frames/020-film-scene/approved/'; O='/home/claude/final020/'
src={n:A+'020_'+n+'.png' for n in ['M_1','M_1_mid','M_1_closed','M_1_blink','M_12','M_13','M_2','M_2_closed','M_3','M_3_closed','R_A1_film','R_K0_turn','R_K1_look','R_B1_glance','W_1','W_2','W_3']}
for n in ['M_1','M_1_mid','M_1_closed','M_1_blink']: src[n]='tools/fix_020_'+n+'.png'
for a in sys.argv[1:]:
    k,v=a.split('='); src[k]=v
for n,p in src.items():
    im=Image.open(p).convert('RGB')
    if n.startswith('M_'): box=(580,240,950,880)
    elif n.startswith('R_'): box=(980,250,1400,941)
    else: im.save(O+'020_'+n+'.png'); continue
    o=np.asarray(im).astype(int); m0=~((o[...,1]>200)&(o[...,0]<90)&(o[...,2]<90))
    sm=smooth_flat(im,box); a=np.asarray(sm).astype(int)
    a[~m0]=[0,255,0]                      # silhouette = original cut-out
    r,g,b=a[...,0],a[...,1],a[...,2]
    sp=m0&(g>np.maximum(r,b)+5)&(g>r+5)   # green bleed inside the edge -> neutral
    edge=m0&~__import__('scipy.ndimage',fromlist=['x']).binary_erosion(m0,iterations=3)
    fixm=sp&edge
    a[...,1]=np.where(fixm,np.maximum(r,b),g)
    Image.fromarray(a.astype('uint8')).save(O+'020_'+n+'.png')
print('built',len(src))
