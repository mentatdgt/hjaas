import numpy as np, json, os, glob, subprocess, tempfile
from PIL import Image
OUT='pkg'; os.makedirs(OUT+'/stills',exist_ok=True)
stills=['A1_mist_aim','A2_mist_squeeze','A3_mist_lift','B1_write','A1_blink_half','K1_beam','K2_thumbs']
for n in stills: Image.open(f'out/stills/{n}.png').save(f'{OUT}/stills/{n}.png')
L=lambda p: np.asarray(Image.open(p)).astype(np.int16)
clips={
 'mist_to_write':('A1_mist_aim',[1,3,10,12,14,18]+[i for i in range(19,74,2) if i not in (55,57,59)]+[56]),
 'write_loop':('B1_write',list(range(1,74,3))+[34,61]),
 'look_up':('A1_mist_aim',[28,30,32,34,36,37,38]+[42,44,46,48,50,52,56,60,66,73]),
 'thumbs_up':('K1_beam',[1,7,13,16,20,22,24,28,40,73]),
}
man={'canvas':{'w':980,'h':1380,'plate_x':680,'plate_y':210,'plate_w':490,'plate_h':690,
  'note':'Rachel canvas is 2x. Draw it at plate (680,210) sized 490x690 plate px. Each clip frame = its base still + a patch drawn at (x,y) on the canvas.'},
  'stills':{n:f'stills/{n}.png' for n in stills},'clips':{}}
for c,(base,frames) in clips.items():
    frames=sorted(set(frames)); B=L(f'{OUT}/stills/{base}.png')
    U=np.zeros(B.shape[:2],bool)
    from scipy import ndimage as ndi
    for i in frames:
        F=L(f'out/{c}/{c}_{i:03d}.png'); pf=F[...,:3]*F[...,3:4]//255; pb=B[...,:3]*B[...,3:4]//255; d=(np.abs(pf-pb).max(2)>14)|(np.abs(F[...,3]-B[...,3])>14); d=ndi.binary_opening(d,iterations=2); U|=d
    ys,xs=np.where(U); x0,y0,x1,y1=max(xs.min()-24,0),max(ys.min()-24,0),min(xs.max()+25,980),min(ys.max()+25,1380)
    os.makedirs(f'{OUT}/{c}',exist_ok=True); fl=[]
    for i in frames:
        Image.open(f'out/{c}/{c}_{i:03d}.png').crop((x0,y0,x1,y1)).save(f'{OUT}/{c}/{c}_{i:03d}.png'); fl.append(f'{c}/{c}_{i:03d}.png')
    man['clips'][c]={'base':base,'x':int(x0),'y':int(y0),'frames':fl}
    print(c,'patch',x1-x0,'x',y1-y0,len(frames),'frames')
json.dump(man,open(f'{OUT}/frames.json','w'),indent=1)
