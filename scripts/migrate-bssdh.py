#!/usr/bin/env python3
"""Extract complete BSSDH content from the preserved Mozello export."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse, unquote
import hashlib, html, json, re, shutil

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / 'digitalhumanities-preservation' / 'original-export' / 'bssdh'
REMOTE = ROOT.parent / 'digitalhumanities-preservation' / 'remote-assets'
ASSETS = ROOT / 'public' / 'assets' / 'bssdh' / 'legacy'
OUTPUT = ROOT / 'src' / 'data' / 'bssdh-legacy.json'
YEARS = ['2018','2019','2022','2023','2024','2025','2026']

class Node:
    def __init__(self, tag='root', attrs=None, parent=None):
        self.tag, self.attrs, self.parent, self.children = tag, dict(attrs or []), parent, []
    def text(self):
        return ''.join(c if isinstance(c,str) else c.text() for c in self.children)

class TreeParser(HTMLParser):
    void = {'img','br','hr','meta','link','input','source','area','base','embed','param','track','wbr'}
    def __init__(self):
        super().__init__(convert_charrefs=True); self.root=Node(); self.current=self.root
    def handle_starttag(self, tag, attrs):
        n=Node(tag,attrs,self.current); self.current.children.append(n)
        if tag not in self.void: self.current=n
    def handle_startendtag(self, tag, attrs): self.handle_starttag(tag,attrs); self.handle_endtag(tag)
    def handle_endtag(self, tag):
        n=self.current
        while n is not self.root:
            if n.tag==tag: self.current=n.parent; return
            n=n.parent
    def handle_data(self,data): self.current.children.append(data)

def walk(node):
    if not isinstance(node,str):
        yield node
        for child in node.children: yield from walk(child)

def has_class(node, name): return name in node.attrs.get('class','').split()

def local_asset(url):
    if not url or url.startswith('data:'): return url
    parsed=urlparse(url)
    if parsed.netloc not in {'site-512948.mozfiles.com','i.ibb.co'}: return url
    relative=unquote(parsed.path.lstrip('/'))
    candidate=REMOTE / parsed.netloc / relative
    if not candidate.exists() and '/medium/' in relative:
        candidate=REMOTE / parsed.netloc / relative.replace('/medium/','/')
    if not candidate.exists(): return url
    digest=hashlib.sha1(str(candidate).encode()).hexdigest()[:10]
    dest=ASSETS / f'{digest}-{candidate.name}'
    ASSETS.mkdir(parents=True,exist_ok=True)
    if not dest.exists(): shutil.copy2(candidate,dest)
    return f'/assets/bssdh/legacy/{dest.name}'

ALLOWED={'h1','h2','h3','h4','p','ul','ol','li','strong','b','em','i','a','img','br','blockquote','table','thead','tbody','tr','th','td','iframe','figure','figcaption','sup','sub','hr'}
DROP={'script','style','form','button','noscript'}
def serialize(node):
    if isinstance(node,str): return html.escape(node)
    if node.tag in DROP: return ''
    inner=''.join(serialize(c) for c in node.children)
    if node.tag not in ALLOWED: return inner
    attrs=[]
    if node.tag=='a':
        href=node.attrs.get('href','')
        if 'cdn-cgi/l/email-protection' in href:
            encoded=href.split('#',1)[1] if '#' in href else ''
            if encoded:
                key=int(encoded[:2],16)
                address=''.join(chr(int(encoded[i:i+2],16)^key) for i in range(2,len(encoded),2))
            else:
                address='dh@lnb.lv'
            return f'<a href="mailto:{html.escape(address,quote=True)}">{html.escape(address)}</a>'
        if href and not href.startswith(('javascript:','#')): attrs.append(('href',href))
        if href.startswith(('http://','https://')): attrs += [('target','_blank'),('rel','noopener')]
    elif node.tag=='img':
        src=local_asset(node.attrs.get('src',''))
        if not src and node.attrs.get('srcset'): src=local_asset(node.attrs['srcset'].split(',')[0].strip().split(' ')[0])
        if not src: return ''
        attrs=[('src',src),('alt',node.attrs.get('alt',''))]
    elif node.tag=='iframe':
        src=node.attrs.get('src','')
        if not src: return ''
        attrs=[('src',src),('title',node.attrs.get('title','BSSDH video')),('loading','lazy'),('allowfullscreen','')]
    attr=''.join(f' {k}="{html.escape(v,quote=True)}"' if v else f' {k}' for k,v in attrs)
    if node.tag in {'img','br','hr'}: return f'<{node.tag}{attr}>'
    return f'<{node.tag}{attr}>{inner}</{node.tag}>'

def editor_fragments(path):
    if not path.exists(): return []
    parser=TreeParser(); parser.feed(path.read_text(errors='ignore'))
    main=next((n for n in walk(parser.root) if n.tag=='main'),None)
    if not main: return []
    fragments=[]
    for n in walk(main):
        if not has_class(n,'moze-wysiwyg-editor'): continue
        text=' '.join(n.text().split())
        if len(text)<20: continue
        # Page-local button bars and global legacy footer are navigation, not content.
        if text.startswith('About Programme Lectures and Workshops') and len(text)<180: continue
        if text.startswith('digitalhumanities.lv supported by'): continue
        markup=''.join(serialize(c) for c in n.children)
        markup=re.sub(r'(<br>\s*){3,}','<br><br>',markup)
        if len(re.sub('<[^>]+>','',markup).strip())>10 or '<img' in markup: fragments.append(markup)
    return fragments

def gallery_images(path):
    if not path.exists(): return ''
    parser=TreeParser(); parser.feed(path.read_text(errors='ignore'))
    main=next((n for n in walk(parser.root) if n.tag=='main'),None)
    if not main: return ''
    images=[]; seen=set()
    for n in walk(main):
        if n.tag!='img': continue
        src=n.attrs.get('src','') or (n.attrs.get('srcset','').split(',')[0].strip().split(' ')[0] if n.attrs.get('srcset') else '')
        src=local_asset(src)
        if not src or src in seen: continue
        seen.add(src); images.append(f'<figure><img src="{html.escape(src,quote=True)}" alt=""></figure>')
    return '<div class="legacy-gallery">'+''.join(images)+'</div>' if images else ''

def page(year, candidates):
    for relative in candidates:
        path=SOURCE/year/relative
        if path.exists():
            parts=editor_fragments(path)
            if parts: return '\n'.join(parts)
    return ''

data={}
for year in YEARS:
    data[year]={
      'overview': page(year,['index.html','about/index.html','About/index.html']),
      'programme': page(year,['Programme/index.html','programme/index.html']),
      'lectures': page(year,['lectures-and-workshops/index.html']),
      'venue': page(year,['venue/index.html']),
      'registration': page(year,['registration/index.html','how-to-apply/index.html']),
      'gallery': gallery_images(SOURCE/year/'gallery/index.html') or page(year,['gallery/index.html'])
    }
OUTPUT.write_text(json.dumps(data,ensure_ascii=False,indent=2))
print(f'Wrote {OUTPUT}')
for year,sections in data.items(): print(year, {k:len(v) for k,v in sections.items()})
