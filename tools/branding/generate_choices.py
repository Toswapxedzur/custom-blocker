"""Compose review choices on the approved 110% Mac-derived base.

Run on mini1: python3 tools/branding/generate_choices.py
No active icon or manifest is changed. All symbols use the same blue gradient.
"""
from pathlib import Path
import json
import math

ROOT = Path(__file__).parent
BASE = (ROOT / 'vault-shield-base.svg').read_text()
OUT = ROOT / 'choices'

# size, optical center y, stroke, central inset, loop radius, corner radius
MAC = [
 ('Classic',24,30.5,3.7,10.5,4.1,0.5),
 ('Soft loops',24,30.5,3.5,10.9,4.2,1.3),
 ('Open center',25,30.5,3.5,9.7,3.7,1.4),
 ('Broad loops',25,30.5,3.5,11.2,4.5,1.2),
 ('Rounded cross',24.5,30.5,3.7,10.4,4.0,2.7),
 ('Bold',24,30.5,4.6,10.8,4.0,1.8),
 ('Airy',25,30.5,3.0,10.3,4.1,1.5),
 ('Compact loops',25.5,30.5,3.8,10.0,3.7,1.7),
 ('Large',26,30.0,3.8,10.7,4.2,1.4),
 ('Smooth',25,30.5,4.0,10.8,4.15,2.2),
]
# size, center y, gap, corner radius; square orientation remains upright
WINDOWS = [
 ('Classic',23,30.0,3.2,1.0), ('Soft corners',23.5,30.0,3.2,2.0),
 ('Rounded',24,30.0,3.4,3.0), ('Wide spacing',24.5,30.0,5.0,2.1),
 ('Close spacing',23,30.0,2.2,2.0), ('Full squares',25,30.0,2.6,1.6),
 ('Airy',24,30.0,5.6,2.8), ('Soft tiles',24,30.0,3.8,4.0),
 ('Large',26,30.0,3.4,2.2), ('Balanced',24.5,30.0,4.2,2.8),
]
# size, center y, ring inner radius, center radius, half-gap angle, rounded corner
CHROME = [
 ('Classic',24,30.5,7.8,5.7,4.0,.5), ('Soft joins',24,30.5,7.8,5.7,4.5,1.1),
 ('Open ring',25,30.5,8.2,5.3,7.0,.9), ('Broad ring',24.5,30.5,7.0,5.0,5.0,.8),
 ('Large center',24.5,30.5,8.4,6.4,5.0,1.0), ('Narrow breaks',24,30.5,7.8,5.7,2.5,.6),
 ('Airy',25,30.5,8.6,5.6,8.0,1.2), ('Round ends',24,30.5,8.0,5.8,6.5,1.8),
 ('Large',26,30.0,7.8,5.8,5.0,1.0), ('Flowing edges',25,30.5,7.6,5.6,6.0,1.4),
]
# size, center y, tip coordinate, width, center gap, edge curvature
SAFARI = [
 ('Classic',25,30.5,28.5,4.0,.6,1.0), ('Soft edges',25,30.5,28.5,4.0,.7,2.3),
 ('Broad needles',25,30.5,28.0,5.5,.7,1.4), ('Slender',26,30.5,29.0,3.0,.6,1.0),
 ('Open center',25,30.5,28.5,4.2,1.2,1.6), ('Full needles',25.5,30.5,28.5,5.0,.4,1.8),
 ('Swept edges',25,30.5,29.0,4.0,.7,3.0), ('Soft tips',25,30.5,27.5,4.3,.7,2.0),
 ('Large',27,30.0,29.0,4.2,.7,1.5), ('Curved diamond',25.5,30.5,28.5,5.0,.8,2.6),
]

def f(v): return f'{v:.4f}'.rstrip('0').rstrip('.')

def mac(row):
    _,_,_,stroke,a,r,corner=row
    b=32-a
    loops=[
        f'M{f(a)} {f(a)} H{f(a-r)} A{f(r)} {f(r)} 0 1 1 {f(a)} {f(a-r)} V{f(a)}',
        f'M{f(b)} {f(a)} H{f(b+r)} A{f(r)} {f(r)} 0 1 0 {f(b)} {f(a-r)} V{f(a)}',
        f'M{f(a)} {f(b)} H{f(a-r)} A{f(r)} {f(r)} 0 1 0 {f(a)} {f(b+r)} V{f(b)}',
        f'M{f(b)} {f(b)} H{f(b+r)} A{f(r)} {f(r)} 0 1 1 {f(b)} {f(b+r)} V{f(b)}',
    ]
    return f'<g fill="none" stroke="url(#symbol-blue)" stroke-width="{stroke}" stroke-linecap="round" stroke-linejoin="round"><rect x="{f(a)}" y="{f(a)}" width="{f(b-a)}" height="{f(b-a)}" rx="{corner}"/><path d="{" ".join(loops)}"/></g>'

def windows(row):
    _,_,_,gap,corner=row
    side=(30-gap)/2
    return '<g fill="url(#symbol-blue)">'+''.join(f'<rect x="{f(x)}" y="{f(y)}" width="{f(side)}" height="{f(side)}" rx="{corner}"/>' for x in (1,1+side+gap) for y in (1,1+side+gap))+'</g>'

def polar(r,t): return f'{f(16+r*math.cos(t))} {f(16+r*math.sin(t))}'

def chrome(row):
    _,_,_,inner,center,gap,rounding=row
    outer=15.0
    pieces=[]
    for angle in (-90,30,150):
        a,b=map(math.radians,(angle+gap,angle+120-gap))
        # Circular inner/outer edges with quadratic rounded radial joins.
        da=rounding/outer; di=rounding/inner
        d=(f'M{polar(outer,a+da)} A{outer} {outer} 0 0 1 {polar(outer,b-da)} '
           f'Q{polar(outer,b)} {polar(outer-rounding,b)} L{polar(inner+rounding,b)} '
           f'Q{polar(inner,b)} {polar(inner,b-di)} A{inner} {inner} 0 0 0 {polar(inner,a+di)} '
           f'Q{polar(inner,a)} {polar(inner+rounding,a)} L{polar(outer-rounding,a)} '
           f'Q{polar(outer,a)} {polar(outer,a+da)} Z')
        pieces.append(f'<path d="{d}"/>')
    return '<g fill="url(#symbol-blue)">'+''.join(pieces)+f'<circle cx="16" cy="16" r="{center}"/></g>'

def safari(row):
    _,_,_,tip,width,gap,bend=row
    a,b=16-width,16+width
    low=32-tip
    def needle(mirror):
        def point(x,y):
            if mirror: x,y=32-x,32-y
            return f'{f(x)} {f(y)}'
        # Both outer edges are curved. Rounded tips and center corners keep
        # the long opposing triangles readable without dial markings.
        d=(f'M{point(tip-.55,low+.30)} '
           f'Q{point(tip+.25,low-.25)} {point(tip-.20,low+.65)} '
           f'Q{point(tip-bend,low+(b-low)*.62)} {point(b+gap,b-gap)} '
           f'Q{point(b+gap-.25,b-gap+.25)} {point(b+gap-.70,b-gap-.20)} '
           f'L{point(a+gap+.70,a-gap+.20)} '
           f'Q{point(a+gap-.25,a-gap+.25)} {point(a+gap,a-gap)} '
           f'Q{point(tip-(tip-a)*.55,low+bend)} {point(tip-.55,low+.30)} Z')
        return f'<path d="{d}"/>'
    return '<g fill="url(#symbol-blue)">'+needle(False)+needle(True)+'</g>'

PRODUCTS=[('mac','Mac Vault',MAC,mac),('windows','Windows Vault',WINDOWS,windows),('chrome','Vault extension',CHROME,chrome),('safari','Safari Vault',SAFARI,safari)]

def compose(product,row,draw):
    label,size,cy,*_=row
    gradient='<linearGradient id="symbol-blue" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="32"><stop offset="0" stop-color="#56a8f2"/><stop offset="1" stop-color="#1c5ca8"/></linearGradient>'
    output=BASE.replace('</defs>',gradient+'\n  </defs>')
    output=output.replace('aria-label="Vault shared shield base"',f'aria-label="{product}: {label}"')
    layer=f'<g id="platform-symbol" transform="translate({f(32-size/2)} {f(cy-size/2)}) scale({f(size/32)})">{draw(row)}</g>'
    return output.replace('</svg>',layer+'\n</svg>')

def main():
    OUT.mkdir(exist_ok=True)
    manifest=[]
    for product,title,rows,draw in PRODUCTS:
        for i,row in enumerate(rows,1):
            filename=f'{product}-{i:02d}.svg'
            (OUT/filename).write_text(compose(product,row,draw))
            manifest.append({'product':product,'title':title,'choice':i,'label':row[0],'file':filename})
    (OUT/'index.json').write_text(json.dumps(manifest,indent=2)+'\n')
    (OUT/'package-info.md').write_text('# Platform symbol choices\n\nForty generated SVGs: 01–10 for mac, windows, chrome and safari. index.json maps choice numbers and descriptions. Every file uses the approved 110% shared base and the same blue gradient. Regenerate with ../generate_choices.py. These are review choices, not active installed icons.\n')
    print('Generated',len(manifest),'choices on the fixed shared base')

if __name__=='__main__': main()
