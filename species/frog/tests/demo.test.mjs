/** Static host contract checks only; these do not stand in for browser tests. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const file=new URL('../demo/index.html',import.meta.url),html=readFileSync(file,'utf8');
test('demo offers every declared native control/pose and valid closing tags',()=>{
  assert.doesNotMatch(html, /<\/[a-zA-Z][\w:-]*\s+[^>]+>/, 'closing tags cannot carry option attributes');
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(new Set(ids).size,ids.length);
  for(const id of ['frog','leap','pause','reset','target','pose','status','fallback','instructions'])assert(ids.includes(id));
  const select=id=>html.match(new RegExp(`<select id="${id}"[^>]*>([\\s\\S]*?)<\\/select>`))[1];
  const values=id=>[...select(id).matchAll(/<option\s+value="([^"]*)"/g)].map(x=>x[1]);
  assert.deepEqual(values('pose'),['','rest','crouch','airborne','landed']);
  assert.deepEqual(values('target'),['','right','left','center','far']);
  assert.deepEqual(values('view'),['front','left','right','profile']);
  for(const [,id]of html.matchAll(/<label\s+for="([^"]+)"/g))assert(ids.includes(id));
});
test('buildless demo script/style/fallback references resolve to scoped real files',()=>{
  for(const [,relative]of html.matchAll(/(?:src|href)="([^"]+)"/g)){
    if(relative.startsWith('#'))continue;
    assert(!/^https?:/.test(relative),'demo must not depend on remote assets');
    assert(existsSync(new URL(relative,file)),relative);
  }
  assert.match(html,/aria-describedby="instructions"/);assert.match(html,/aria-live="polite"/);
  assert.match(html,/<noscript>/);assert.match(html,/<img[^>]+alt="Static glyph-rendered frog/);
});
