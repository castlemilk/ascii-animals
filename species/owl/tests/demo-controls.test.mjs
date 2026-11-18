// Script/control-flow regression with a small bubbling DOM stub, not browser evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const html=readFileSync(new URL('../demo/index.html',import.meta.url),'utf8');
const script=readFileSync(new URL('../demo/demo.mjs',import.meta.url),'utf8').replace(/^import .*;\n/,'');
function fixture({paused=false}={}){
 const all=[],ids=new Map();
 const matches=(node,selector)=>selector.split(',').some(raw=>{
  const s=raw.trim(),tag=s.match(/^[a-z]+/i)?.[0],cls=s.match(/\.([\w-]+)/)?.[1],attr=s.match(/\[([\w-]+)(?:="([^"]*)")?\]/);
  return (!tag||node.tag===tag)&&(!cls||node.classes.has(cls))&&(!attr||(attr[1] in node.attrs&&(attr[2]===undefined||node.attrs[attr[1]]===attr[2])));
 });
 function element(tag,attrs={}){
  const listeners=new Map(),node={tag,attrs,dataset:{},children:[],parent:null,classes:new Set((attrs.class??'').split(' ')),value:attrs.value??'',checked:'checked'in attrs,hidden:'hidden'in attrs,
   addEventListener(type,fn){const list=listeners.get(type)??[];list.push(fn);listeners.set(type,list);},
   dispatch(type,detail={}){const event={target:node,preventDefault(){this.defaultPrevented=true;},...detail};for(let at=node;at;at=at.parent)for(const fn of at.listeners.get(type)??[])fn(event);return event;},
   setAttribute(k,v){node.attrs[k]=String(v);},removeAttribute(k){delete node.attrs[k];},
   querySelector(selector){return all.find(n=>{for(let p=n.parent;p;p=p.parent)if(p===node)return matches(n,selector);return false;});},
   appendChild(child){child.parent=node;node.children.push(child);},remove(){},click(){node.dispatch('click');},listeners};
  node.classList={toggle(key,force){if(force??!node.classes.has(key))node.classes.add(key);else node.classes.delete(key);}};
  for(const [key,value]of Object.entries(attrs))if(key.startsWith('data-'))node.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=value;
  all.push(node);if(attrs.id)ids.set(attrs.id,node);return node;
 }
 const root=element('document'),stack=[root],voids=new Set(['meta','link','br','input','img','hr']);
 for(const match of html.matchAll(/<(\/?)([a-z][\w-]*)([^>]*)>/gi)){
  const [,close,tag,raw]=match;if(close){while(stack.length>1){if(stack.pop().tag===tag)break;}continue;}
  const attrs={};for(const a of raw.matchAll(/([\w-]+)(?:="([^"]*)")?/g))attrs[a[1]]=a[2]??'';
  const node=element(tag,attrs);stack.at(-1).appendChild(node);if(!voids.has(tag))stack.push(node);
 }
 for(const node of all.filter(n=>n.tag==='select'))node.value=(node.children.find(n=>'selected'in n.attrs)??node.children[0])?.attrs.value??'';
 const document={body:all.find(n=>n.tag==='body'),getElementById:id=>ids.get(id),querySelector:s=>all.find(n=>matches(n,s)),querySelectorAll:s=>all.filter(n=>matches(n,s)),createElement:tag=>element(tag)};
 const calls=[],window={addEventListener(){}};let config,options,disposed=false,tick=20;
 const status=()=>({paused,running:!paused,disposed,blockedBy:paused?['paused']:[],cols:144,rows:60,tick,
  director:{config,phase:{kind:'survey'},actors:Array.from({length:config.count},(_,id)=>({id,motive:'Keeping watch'}))}});
 const notify=()=>options.onStatus(status());
 const controller={getStatus:status,getSnapshot:()=>({simulation:{config:{seed:7}}}),exportText:()=>'+ actual text +',
  updateDirector(patch){config={...config,...patch};calls.push(['updateDirector',patch]);notify();},
  reset(seed){calls.push(['reset',seed]);tick=0;notify();},
  setPaused(value){paused=value;calls.push(['pause',value]);notify();},
  guide(...args){calls.push(['guide',...args]);return{kind:paused?'poster':'queued'};},
  cue(value){calls.push(['cue',value]);return{kind:paused?'poster':'queued'};},
  leave(){calls.push(['leave']);},update(value){calls.push(['update',value]);},dispose(){disposed=true;}};
 runInNewContext(script,{document,window,Blob,URL,mountOwl(_host,value){options=value;config=value.director;notify();return controller;}});
 return{ids,all,calls,controller,get config(){return config;}};
}
test('control clicks bubble without silently resetting the authored scene or cast',()=>{
 const f=fixture(),solo=f.all.find(n=>n.dataset.count==='1');
 solo.dispatch('click');assert.equal(f.config.count,1);assert.equal(f.calls.filter(c=>c[0]==='reset').length,0);
 f.ids.get('pause').dispatch('click');assert.equal(f.controller.getStatus().paused,true);assert.equal(f.config.count,1);
 f.ids.get('stretch').dispatch('click');assert.equal(f.calls.at(-1)[0],'cue');assert.equal(f.config.count,1);
 assert.equal(f.calls.filter(c=>c[0]==='reset').length,0);
 const duet=f.all.find(n=>n.tag==='button'&&n.dataset.scene==='duet');duet.dispatch('click');
 assert.equal(f.config.scene,'duet');assert.equal(f.config.count,2);assert.equal(f.calls.filter(c=>c[0]==='reset').length,1);
 assert.equal(f.controller.getStatus().paused,true);
});
test('focused scene keyboard routes explicit targets and ignores repeats, modifiers and child controls',()=>{
 const f=fixture(),host=f.ids.get('owl-host');f.ids.get('target').value='1';
 host.dispatch('keydown',{key:'ArrowRight'});assert.deepEqual(Array.from(f.calls.at(-1)),['guide',.85,0,1]);
 host.dispatch('keydown',{key:'c'});assert.equal(f.calls.at(-1)[1].kind,'call');assert.equal(f.calls.at(-1)[1].target,1);
 const count=f.calls.length;
 host.dispatch('keydown',{key:'c',repeat:true});host.dispatch('keydown',{key:'s',ctrlKey:true});host.dispatch('keydown',{key:'s',target:f.ids.get('target')});
 assert.equal(f.calls.length,count);host.dispatch('keydown',{key:'Escape'});assert.equal(f.calls.at(-1)[0],'leave');
});
test('paused scene selection requests a deliberate still without starting playback',()=>{
 const f=fixture({paused:true});
 const roost=f.all.find(n=>n.tag==='button'&&n.dataset.scene==='roost');roost.dispatch('click');
 assert.equal(f.config.scene,'roost');assert.equal(f.calls.at(-1)[0],'leave');
 assert.equal(f.controller.getStatus().paused,true);assert.equal(f.controller.getStatus().tick,0);
 const duet=f.all.find(n=>n.tag==='button'&&n.dataset.scene==='duet');duet.dispatch('click');
 assert.equal(f.calls.at(-1)[0],'cue');assert.equal(f.calls.at(-1)[1].kind,'call');
 assert.equal(f.controller.getStatus().paused,true);
});
