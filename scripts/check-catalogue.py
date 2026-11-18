#!/usr/bin/env python3
"""Static catalogue release gates. No network or third-party dependencies."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
root = Path(__file__).resolve().parents[1]
class Page(HTMLParser):
    def __init__(self, path):
        super().__init__(); self.ids=[]; self.links=[]; self.animals=[]
        self.feed(path.read_text())
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if 'id' in a: self.ids.append(a['id'])
        for key in ('href','src'):
            if key in a: self.links.append(a[key])
        if tag=='article' and 'animal' in a.get('class','').split(): self.animals.append(a)
p=Page(root/'dist/index.html')
assert len(p.ids)==len(set(p.ids)), 'Duplicate HTML IDs'
assert len(p.animals)==13
assert [a['id'] for a in p.animals if a['data-status']=='available']==['cuttlefish', 'manta-ray', 'octopus', 'seahorse', 'crab', 'sea-turtle', 'pufferfish', 'frog', 'butterfly', 'dragonfly', 'gecko', 'owl', 'fox']
assert len([a for a in p.animals if a['data-status']=='planned'])==0
for link in p.links:
    u=urlsplit(link)
    if u.scheme or u.netloc: continue
    if u.path in ('','./'):
        if u.fragment: assert u.fragment in p.ids, link
    else: assert (root/'dist'/u.path).is_file(), link
assert 'artwork.js' not in p.links, 'Catalogue must not initialize a species renderer'
assert 'cuttlefish-demo.html' in (root/'scripts/build-demo.mjs').read_text()
assert 'id="school-director"' in (root/'dist/cuttlefish-demo.html').read_text()
assert 'data-standalone="true"' in (root/'dist/cuttlefish.html').read_text()
assert '<script src=' not in (root/'dist/cuttlefish.html').read_text()
print('Catalogue passed: 13 unique species, honest status, local links, anchors, study and standalone preserved.')

# Every shipped HTML entry must retain working local navigation/assets.
base=(root/'dist').resolve()
for html in base.rglob('*.html'):
    for link in Page(html).links:
        u=urlsplit(link)
        if u.scheme or u.netloc or not u.path: continue
        target=(html.parent/u.path).resolve()
        assert target.is_relative_to(base), (html, link, 'outside published demo')
        assert target.exists(), (html, link, 'missing published asset')
        if target.is_dir(): assert (target/'index.html').is_file(), (html, link)
print('All published HTML local links/assets passed.')
