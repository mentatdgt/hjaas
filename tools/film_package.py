"""Package scene 4 (Film) for Fable, in the café's format (frames.json + routine.json + RGBA stills).
Usage: python3 tools/film_package.py   (reads frames/020-film-scene/final + approved/020_plate.png)"""
import json, os, sys, numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__)); from softedge import soft_rgba
R='frames/020-film-scene/'; F=R+'final/'; O=R+'site/'
actors={
 'water':['W_1','W_2','W_3'],
 'presenter':['M_1','M_1_mid','M_1_closed','M_1_blink','M_12','M_2','M_2_closed','M_13','M_3','M_3_closed'],
 'rachel':['R_A1_film','R_K0_turn','R_K1_look'],
}
os.makedirs(O,exist_ok=True)
Image.open(R+'approved/020_plate.png').convert('RGB').save(O+'plate.png')
layers=[]; stills={}; stab={}
for actor,names in actors.items():
    os.makedirs(O+actor,exist_ok=True)
    rgba={}
    for n in names:
        col,al=soft_rgba(Image.open(F+'020_'+n+'.png').convert('RGB'))
        a=np.dstack([col,al*255]).clip(0,255).astype('uint8'); a[a[...,3]==0,:3]=0; rgba[n]=a
    union=np.zeros(rgba[names[0]].shape[:2],bool)
    for a in rgba.values(): union|=a[...,3]>0
    ys,xs=np.where(union); x0,y0,x1,y1=max(xs.min()-1,0),max(ys.min()-1,0),min(xs.max()+2,1672),min(ys.max()+2,941)
    layers.append({'actor':actor,'x':int(x0),'y':int(y0),'w':int(x1-x0),'h':int(y1-y0),'stills':names})
    base=rgba[names[0]]
    for n,a in rgba.items():
        Image.fromarray(a[y0:y1,x0:x1],'RGBA').save(O+f'{actor}/{n}.png',optimize=True)
        stills[n]=f'{actor}/{n}.png'
        if n!=names[0]:
            pa=a[...,:3].astype(int)*a[...,3:4]//255; pb=base[...,:3].astype(int)*base[...,3:4]//255
            d=(np.abs(pa-pb).sum(-1)>12)|(np.abs(a[...,3].astype(int)-base[...,3].astype(int))>12)
            stab[n]={'changed_px':int(d.sum()),'changed_pct_of_actor':round(100*d.sum()/max((base[...,3]>0).sum(),1),1)}
frames={'canvas':{'w':1672,'h':941,'note':'Scene 4 canvas 1672x941 (= plate space; this is the 1x set, there is no larger master, so do not upscale for phones). Draw layers in order over plate.png; each still at its layer x,y. Stills are RGBA with a soft 1 px edge. Within a layer every still is pixel-identical to the first outside the part that moves.'},
 'plate':'plate.png','layers':layers,'stills':stills,'clips':{},
 'camera_screen':{'note':"Rachel's DSLR screen, in canvas px. Draw a live, scaled copy of the canvas region 'source' into 'rect' (inset 2 px) every frame, then the REC dot (red #EB1E1E, 6 px circle, 2 px from the top-left of the rect, 500 ms on / 500 ms off). The rect depends on Rachel's current still.",
   'source':{'x':600,'y':250,'w':320,'h':290},
   'rect_by_still':{'R_A1_film':{'x':1072,'y':507,'w':44,'h':40},'R_K0_turn':{'x':1072,'y':507,'w':44,'h':40},'R_K1_look':{'x':1053,'y':550,'w':43,'h':39}}}}
json.dump(frames,open(O+'frames.json','w'),indent=1)
json.dump(stab,open(O+'stability.json','w'),indent=1)
def talk(still_open, still_closed, still_mid=None, rep=(3,6)):
    st=[{'still':still_open,'ms':[90,160]}]
    if still_mid: st.append({'still':still_mid,'ms':[70,120]})
    st+= [{'still':still_closed,'ms':[80,190]},{'still':still_open,'ms':[100,180]}]
    if still_mid: st.append({'still':still_mid,'ms':[60,110]})
    st.append({'still':still_closed,'ms':[220,480]})
    return {'loop':'talk_'+still_open,'repeat':list(rep),'steps':st}
routine={'note':"Scene 4 (Film) routines. Holds in ms; [a,b] = random in range. Actors run independently. Every change is an instant cut (no fade_ms anywhere in this scene). Within a layer every still is pixel-identical to the first outside the part that moves, so cuts never flicker.",
 'actors':{
  'water':{'routine':[{'loop':'flow','repeat':[1000,1000],'steps':[{'still':'W_1','ms':110},{'still':'W_2','ms':110},{'still':'W_3','ms':110}]}],
           'note':'The Merlion spout: a hand-drawn boil loop, forever. Part of the scenery: let the edge treat it like the plate.'},
  'presenter':{'routine':[talk('M_1','M_1_closed','M_1_mid',(4,8)),
     {'still':'M_12','ms':100},talk('M_2','M_2_closed',None,(3,5)),{'still':'M_12','ms':100},
     talk('M_1','M_1_closed','M_1_mid',(4,8)),
     {'still':'M_13','ms':100},talk('M_3','M_3_closed',None,(3,5)),{'still':'M_13','ms':100}],
   'blink':{'on':['M_1','M_1_mid','M_1_closed'],'frames':[{'still':'M_1_blink','ms':110}],'every_ms':[2500,6000]},
   'note':'Talks the whole time (lip-flap: open / mid / closed with pauses). Gestures go through a 100 ms in-between (M_12, M_13). He does not react to mushroom finds.'},
  'rachel':{'routine':[{'still':'R_A1_film','ms':[60000,60000]}],
   'reaction':{'note':'On a mushroom find: she turns to look back over her shoulder at the viewer and smiles, then goes back to filming. Two-step turn through a profile still.','steps':[{'still':'R_K0_turn','ms':90},{'still':'R_K1_look','ms':[1600,2000]},{'still':'R_K0_turn','ms':90},{'still':'R_A1_film','ms':500}]},
   'note':'Holds still, filming (the user dropped the head-tip glance: it looked choppy). Life comes from the live camera screen and the REC dot (frames.json camera_screen).'}}}
json.dump(routine,open(O+'routine.json','w'),indent=1)
print(json.dumps(layers)); print(json.dumps(stab))
