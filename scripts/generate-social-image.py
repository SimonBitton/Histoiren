"""Regenerate the branded OG asset (requires Pillow on the author's machine)."""
from math import cos, pi, sin
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

S = 2
im = Image.new('RGB', (1200*S, 630*S), '#203d33')
d = ImageDraw.Draw(im)
def font(name, size):
    return ImageFont.truetype(name, size*S)
def text(x, y, value, face, color):
    d.text((x*S, y*S), value, font=face, fill=color)
def line(points, color, width=1):
    d.line([(round(x*S), round(y*S)) for x, y in points], fill=color, width=width*S)
def ellipse(x1, y1, x2, y2, **kwargs):
    d.ellipse((x1*S, y1*S, x2*S, y2*S), **kwargs)

avenir = '/System/Library/Fonts/Avenir Next.ttc'
georgia = '/System/Library/Fonts/Supplemental/Georgia Bold.ttf'
d.rounded_rectangle((40*S,40*S,1160*S,590*S),radius=31*S,outline='#456759',width=2*S)
line([(88,172),(600,172)],'#667d69')
line([(88,493),(586,493)],'#667d69')
logo = Image.open('favicon-histoiren.png').convert('RGBA').resize((90*S,90*S),Image.Resampling.LANCZOS)
im.paste(logo,(86*S,70*S),logo)
d = ImageDraw.Draw(im)
text(192,89,'HISTOIREN',font(avenir,30),'#f5f0e6')
text(88,204,'Les repères',font(georgia,78),'#f7f5ed')
text(88,297,'du monde.',font(georgia,78),'#f7f5ed')
text(90,407,'L’histoire mondiale, par événement,',font(avenir,25),'#dce4d6')
text(90,446,'par époque et par pays.',font(avenir,25),'#dce4d6')
text(90,524,'UN ATLAS HISTORIQUE À EXPLORER',font(avenir,19),'#d6bd8e')
cx, cy, r = 875, 309, 199
for rr, color, width in [(250,'#365649',1),(224,'#4a6b58',1),(199,'#c8d3b8',2)]:
    ellipse(cx-rr,cy-rr,cx+rr,cy+rr,outline=color,width=width*S)
ellipse(cx-r+3,cy-r+3,cx+r-3,cy+r-3,fill='#294c3e')
for rx in (62,126,170):
    ellipse(cx-rx,cy-r,cx+rx,cy+r,outline='#799482',width=2*S)
for ry in (62,126,170):
    ellipse(cx-r,cy-ry,cx+r,cy+ry,outline='#799482',width=2*S)
line([(cx-r,cy),(cx+r,cy)],'#799482',2)
line([(cx,cy-r),(cx,cy+r)],'#799482',2)
angle=-23*pi/180
orbit=[]
for i in range(401):
    t=2*pi*i/400
    x,y=247*cos(t),88*sin(t)
    orbit.append((cx+x*cos(angle)-y*sin(angle),cy+x*sin(angle)+y*cos(angle)))
line(orbit,'#bd9c65',2)
for x,y in [(710,183),(1071,398),(875,309)]:
    ellipse(x-4,y-4,x+4,y+4,fill='#d9bd84')
text(855,62,'N',font(avenir,19),'#b7c8ac')
text(860,538,'S',font(avenir,19),'#b7c8ac')
im.resize((1200,630),Image.Resampling.LANCZOS).save('assets/histoiren-social.png',optimize=True)
print(Path('assets/histoiren-social.png').stat().st_size)
