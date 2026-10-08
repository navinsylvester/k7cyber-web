import sys,subprocess,os
from PIL import Image
SCR=__import__('os').environ.get('K7_SCRATCH','.')
html,w,out,step=sys.argv[1],int(sys.argv[2]),sys.argv[3],int(sys.argv[4])
subprocess.run(['google-chrome','--headless=new','--disable-gpu','--hide-scrollbars','--window-size=%d,14000'%w,'--screenshot=%s/%s.png'%(SCR,out),'file://%s/%s'%(SCR,html)],stderr=subprocess.DEVNULL)
im=Image.open('%s/%s.png'%(SCR,out)).convert('RGB'); px=im.load(); H=im.size[1]; last=0
for y in range(H-1,0,-1):
    if px[w//2,y]!=(10,10,9): last=y; break
print(out,'content height',last+1)
n=0
for y in range(0,last+1,step):
    im.crop((0,y,w,min(y+step,last+1))).save('%s/%s-%02d.png'%(SCR,out,n)); n+=1
print('parts',n)
