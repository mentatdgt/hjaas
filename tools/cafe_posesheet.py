import numpy as np, sys
from PIL import Image, ImageDraw
D=sys.argv[1]
def key(f):
    a=np.asarray(Image.open(f'{D}/{f}.png').convert('RGBA')).astype(float)
    r,g,b=a[...,0],a[...,1],a[...,2]
    gs=np.clip((g-np.maximum(r,b)-40)/120,0,1)
    al=(1-gs)*(a[...,3]/255)
    # despill green on edges
    rgb=a[...,:3].copy(); rgb[...,1]=np.minimum(rgb[...,1],np.maximum(rgb[...,0],rgb[...,2])*1.05+10)
    return rgb,al
plate=np.asarray(Image.open(f'{D}/018_plate_fixed.png').convert('RGB')).astype(float)
groups={'R':['018_R_A1_sketch','018_R_A2_stroke','018_R_A1_blink','018_R_B1_sip','018_R_K1_look'],
        'B':['018_B_1','018_B_2','018_B_3','018_B_4'],
        'C':['018_C_1','018_C_2','018_C_3'],
        'O':['018_O_1','018_O_2','018_O_3'],
        'cat':['018_cat_1','018_cat_2','018_cat_3'],
        'M':['018_mum_green','018_M_blink_half','018_M_blink_closed']}
base={'R':'018_R_A1_sketch','B':'018_B_1','C':'018_C_1','O':'018_O_1','cat':'018_cat_1'}
cache={k:key(v) for k,v in base.items()}
rows=[]
for g,fs in groups.items():
    layers=[];bb=None
    for f in fs:
        rgb,al=key(f)
        ys,xs=np.where(al>0.5); b=(xs.min(),ys.min(),xs.max(),ys.max())
        bb=b if bb is None else (min(bb[0],b[0]),min(bb[1],b[1]),max(bb[2],b[2]),max(bb[3],b[3]))
    m=30; bb=(max(0,bb[0]-m),max(0,bb[1]-m),min(2580,bb[2]+m),min(1432,bb[3]+m))
    if g=='M': bb=(bb[0],bb[1],bb[2],bb[1]+int((bb[3]-bb[1])*0.45))
    ims=[]
    for f in fs:
        comp=plate.copy()
        for k,(rgb,al) in cache.items():
            if k==g: continue
            comp=comp*(1-al[...,None])+rgb*al[...,None]
        if g!='M':
            rgb,al=key(f); comp=comp*(1-al[...,None])+rgb*al[...,None]
        else:
            rgb,al=key(f); comp=comp*(1-al[...,None])+rgb*al[...,None]
        im=Image.fromarray(np.clip(comp,0,255).astype(np.uint8)).crop(bb)
        h=360; im=im.resize((int(im.width*h/im.height),h))
        d=ImageDraw.Draw(im); d.text((6,4),f.replace('018_',''),fill=(255,0,0))
        ims.append(im)
    W=sum(i.width for i in ims)+10*len(ims); row=Image.new('RGB',(W,360),'white'); x=0
    for i in ims: row.paste(i,(x,0)); x+=i.width+10
    rows.append(row)
W=max(r.width for r in rows); S=Image.new('RGB',(W,sum(r.height+12 for r in rows)),'white'); y=0
for r in rows: S.paste(r,(0,y)); y+=r.height+12
S.save('/tmp/q018_poses.jpg',quality=88); print(S.size)
