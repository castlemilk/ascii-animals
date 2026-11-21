import type { ButterflyCell, ButterflyConfig, ButterflyFrame, ButterflyPhase, ButterflyState } from '../../../../src/public/butterfly.js';
import type { ButterflyActivity, ButterflyGardenMember, ButterflyGardenState } from '../../../../src/public/butterfly/director.js';

const TAU = Math.PI * 2;
const clamp = (n:number, lo:number, hi:number):number => Math.max(lo, Math.min(hi, n));
type Point = readonly [number, number];
type Curve = readonly [Point, Point, Point, Point];
interface Stroke { points:readonly Point[]; lengths:readonly number[]; length:number }
function outline(curves:readonly Curve[]):Stroke {
  const points:Point[]=[];
  for(const [a,b,c,d] of curves) for(let k=0;k<10;k++) {
    const t=k/10,u=1-t;
    points.push([u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],
      u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]]);
  }
  points.push(points[0]!);
  let length=0;const lengths=[0];
  for(let i=1;i<points.length;i++){length+=Math.hypot(points[i]![0]-points[i-1]![0],points[i]![1]-points[i-1]![1]);lengths.push(length);}
  return {points,lengths,length};
}
// Sunpatch: original rounded forewings and smaller teardrop hindwings.
// The paired cream commas are a deliberately stylized character mark.
const FORE=outline([
  [[.12,-.18],[.30,-.84],[.78,-1.52],[1.36,-1.32]],
  [[1.36,-1.32],[1.97,-1.15],[1.91,-.29],[1.43,.07]],
  [[1.43,.07],[1.00,.37],[.39,.28],[.12,-.18]],
]);
const HIND=outline([
  [[.13,.10],[.56,.06],[1.25,.20],[1.25,.55]],
  [[1.25,.55],[1.28,.98],[.74,1.19],[.45,.98]],
  [[.45,.98],[.21,.78],[.13,.38],[.13,.10]],
]);
function contains(path:Stroke,x:number,y:number):boolean {
  let inside=false;
  for(let i=1;i<path.points.length;i++){
    const a=path.points[i-1]!,b=path.points[i]!;
    if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
function segment(x:number,y:number,a:Point,b:Point){
  const dx=b[0]-a[0],dy=b[1]-a[1];
  const t=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1),0,1);
  return {distance:Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy),t,dx,dy};
}
function edge(path:Stroke,x:number,y:number){
  let distance=Infinity,along=0;
  for(let i=1;i<path.points.length;i++){
    const s=segment(x,y,path.points[i-1]!,path.points[i]!);
    if(s.distance<distance){distance=s.distance;along=(path.lengths[i-1]!+s.t*(path.lengths[i]!-path.lengths[i-1]!))/path.length;}
  }
  return {distance,along};
}
interface WingSample {glyph:string;tone:number;material:'pigment'|'vein'|'ivory'}
function wingSample(x:number,y:number,resolution:number):WingSample|null {
  const upper=contains(FORE,x,y),path=upper?FORE:HIND;
  if(!upper&&!contains(HIND,x,y))return null;
  const rim=edge(path,x,y);
  if(rim.distance<Math.max(.055,.48/resolution))return {glyph:'#',tone:8,material:'vein'};
  const oval=upper?((x-.99)/.37)**2+((y+.65)/.46)**2:((x-.73)/.22)**2+((y-.61)/.27)**2;
  // The off-centre cutout turns each upper oval into one readable comma.
  const notch=((x-1.19)/.31)**2+((y+.46)/.34)**2;
  if(oval<1&&(!upper||notch>1))return {glyph:'o',tone:9,material:'ivory'};
  if(upper&&y<-1.05&&x>.88&&x<1.38&&rim.distance<.20)return {glyph:'o',tone:9,material:'ivory'};
  // Broad negative space replaces full-surface texture; the rim and paired mark do the work.
  if(rim.distance>.15)return null;
  return {glyph:'#',tone:9,material:'pigment'};
}
interface Field {
  columns:number;rows:number;worldW:number;worldH:number;
  put(c:number,r:number,glyph:string,tone:number,ink:number,depth:number):void;
  mark(x:number,y:number,glyph:string,tone:number,ink:number,depth:number):void;
  line(x:number,y:number,xx:number,yy:number,tone:number,ink:number,depth:number,glyph?:string):void;
  frame(phase:ButterflyPhase):ButterflyFrame;
}
function field(o:ButterflyConfig):Field {
  const columns=o.columns,rows=o.rows,length=columns*rows;
  const glyphs=new Array<string>(length).fill(' '),tones=new Uint8Array(length),inks=new Uint8Array(length),depths=new Uint8Array(length);
  const worldW=Math.max(6,3.7*columns*.56/rows),worldH=worldW*rows/(columns*.56);
  function put(c:number,r:number,glyph:string,tone:number,ink:number,depth:number){
    if(c<0||c>=columns||r<0||r>=rows)return;const i=r*columns+c;if(depth<depths[i]!)return;
    glyphs[i]=glyph;tones[i]=clamp(Math.round(tone),1,9);inks[i]=ink;depths[i]=depth;
  }
  function mark(x:number,y:number,glyph:string,tone:number,ink:number,depth:number){put(Math.round((x*.5+.5)*(columns-1)),Math.round((y*.5+.5)*(rows-1)),glyph,tone,ink,depth);}
  function line(x:number,y:number,xx:number,yy:number,tone:number,ink:number,depth:number,glyph?:string){
    const dc=(xx-x)*columns*.5,dr=(yy-y)*rows*.5,n=Math.max(1,Math.ceil(Math.max(Math.abs(dc),Math.abs(dr))));
    const stroke=glyph??(Math.abs(dc)<.45*Math.abs(dr)?'|':Math.abs(dr)<.4*Math.abs(dc)?'-':dc*dr>0?'\\':'/');
    for(let k=0;k<=n;k++){const p=k/n;mark(x+(xx-x)*p,y+(yy-y)*p,stroke,tone,ink,depth);}
  }
  return {columns,rows,worldW,worldH,put,mark,line,frame(phase){
    const cells:readonly ButterflyCell[]=Object.freeze(glyphs.map((glyph,i)=>Object.freeze({glyph,tone:tones[i]!,ink:inks[i]!})));
    const textRows=new Array<string>(rows);for(let r=0;r<rows;r++)textRows[r]=glyphs.slice(r*columns,(r+1)*columns).join('');
    return Object.freeze({columns,rows,cells,text:textRows.join('\n'),phase});
  }};
}
interface Pose {x:number;y:number;scale:number;heading:number;opening:number;phase:number;ink:number;activity:ButterflyGardenMember['activity'];clock:number;blur:boolean;expression?:'curious'|'happy'|'startled'|'sleepy';look?:number;contact?:number}
function drawAnimal(f:Field,o:ButterflyConfig,m:Pose,depth:number){
  const {columns,rows,worldW,worldH}=f,scale=m.scale,co=Math.cos(m.heading),si=Math.sin(m.heading),mirror=o.facing==='left'?1:-1;
  const flying=['flutter','inspect','recover'].includes(m.activity.kind),resolution=scale*(columns-1)/worldW;
  const lag=flying?Math.sin(m.clock*5.1+m.phase)*.055:.018;
  const opening=clamp(m.opening,.25,1),halfWing=Math.max(.41,1.90*clamp(opening+Math.abs(lag),.25,1));
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const x of [-halfWing,halfWing])for(const y of [-1.42,1.18]){
    const xx=(x*co-y*si)*scale,yy=(x*si+y*co)*scale;minX=Math.min(minX,xx);maxX=Math.max(maxX,xx);minY=Math.min(minY,yy);maxY=Math.max(maxY,yy);
  }
  const gutterX=worldW/(columns-1)*1.5,gutterY=worldH/(rows-1)*1.5;
  const rootX=clamp(m.x*worldW*.5,-worldW*.5+gutterX-minX,worldW*.5-gutterX-maxX);
  const rootY=clamp(m.y*worldH*.5,-worldH*.5+gutterY-minY,worldH*.5-gutterY-maxY);
  function point(x:number,y:number,tone:number,glyph:string,ink=m.ink,extraDepth=1){
    x*=mirror;f.mark((rootX+(x*co-y*si)*scale)*2/worldW,(rootY+(x*si+y*co)*scale)*2/worldH,glyph,tone,ink,depth+extraDepth);
  }
  function limb(x:number,y:number,xx:number,yy:number,tone:number,ink=m.ink,glyph?:string,extraDepth=1){
    const dx=xx-x,dy=yy-y,n=Math.max(1,Math.ceil(Math.hypot(dx,dy)*resolution*1.4));
    const gx=dx*co-dy*si,gy=dx*si+dy*co;
    const stroke=glyph??(Math.abs(gx)<.45*Math.abs(gy)?'|':Math.abs(gy)<.4*Math.abs(gx)?'-':gx*gy>0?'\\':'/');
    for(let k=0;k<=n;k++){const p=k/n;point(x+dx*p,y+dy*p,tone,stroke,ink,extraDepth);}
  }
  const radius=2.12*scale,left=clamp(Math.floor((rootX-radius)/worldW*(columns-1)+(columns-1)*.5),0,columns-1),right=clamp(Math.ceil((rootX+radius)/worldW*(columns-1)+(columns-1)*.5),0,columns-1);
  const top=clamp(Math.floor((rootY-radius)/worldH*(rows-1)+(rows-1)*.5),0,rows-1),bottom=clamp(Math.ceil((rootY+radius)/worldH*(rows-1)+(rows-1)*.5),0,rows-1);
  // One faint edge echo during the fastest part of a powered stroke. No frame
  // history or body trail, and an explicit still render contains no ink 12.
  const echo=m.blur&&flying&&resolution>=6&&Math.abs(Math.sin(m.clock*8.5+m.phase))>.78;
  for(let r=top;r<=bottom;r++)for(let c=left;c<=right;c++){
    const wx=(c/(columns-1)-.5)*worldW-rootX,wy=(r/(rows-1)-.5)*worldH-rootY;
    const lx=(wx*co+wy*si)/scale*mirror,y=(-wx*si+wy*co)/scale,side=lx<0?-1:1;
    const spread=clamp(opening+side*lag,.25,1),x=Math.abs(lx)/spread;
    const contactWeight=m.contact??(m.activity.kind==='perch'?1:0);
    const wingY=y>0?y/(1-.32*contactWeight):y;
    const sample=wingSample(x,wingY,resolution*spread);
    if(sample)f.put(c,r,sample.glyph,sample.tone,sample.material==='pigment'?m.ink:sample.material==='ivory'?11:10,depth);
    else if(echo){
      const ex=Math.abs(lx)/clamp(spread+.13,.25,1.12);
      const path=contains(FORE,ex,y)?FORE:contains(HIND,ex,y)?HIND:null;
      if(path&&edge(path,ex,y).distance<.065)f.put(c,r,'.',3,12,depth-1);
    }
  }
  // Six small thoracic attachments remain behind the expressive head.
  const contact=m.activity.kind==='nectar'||m.activity.kind==='perch';
  for(const side of [-1,1]){
    for(let k=0;k<3;k++){
      const y=-.10+k*.18,len=k===0?.18:.27;
      const foot=contact?.22:.09;
      limb(side*.07,y,side*len,y+foot,7,10);
      if(contact&&k===2)limb(side*len,y+foot,side*.13,.78,8,10);
    }
  }
  limb(0,-.20,0,.72,9,10,'#');
  if(resolution>8){limb(-.07,-.12,-.045,.50,9,10,'#');limb(.07,-.12,.045,.50,9,10,'#');}
  for(let k=0;k<4;k++)point(0,.05+k*.17,9,'=',11);
  // A broad little face; the physical feeding landmark remains y=-.53.
  const expression=m.expression??(contact?'happy':m.activity.kind==='shelter'?'startled':m.activity.kind==='bask'?'sleepy':'curious');
  const look=clamp(m.look??0,-1,1),hx=look*.035;
  if(resolution>=9){
    // Clear the face: dark pupils on a dense cream fill vanished at phone size.
    // A sparse positive-eye stencil makes the expression readable in ASCII.
    for(let r=top;r<=bottom;r++)for(let c=left;c<=right;c++){
      const wx=(c/(columns-1)-.5)*worldW-rootX,wy=(r/(rows-1)-.5)*worldH-rootY;
      const x=(wx*co+wy*si)/scale*mirror-hx,y=(-wx*si+wy*co)/scale;
      if((x/.37)**2+((y+.49)/.29)**2<1)f.put(c,r,' ',0,0,depth+2);
    }
    const eyes=expression==='sleepy'||expression==='happy'?'^':expression==='startled'?'O':'o';
    const mouth=expression==='startled'?'o':expression==='happy'?'w':'v';
    limb(hx-.20,-.70,hx+.20,-.70,9,11,'_',3);
    point(hx-.32,-.50,9,'(',11,3);point(hx+.32,-.50,9,')',11,3);
    point(hx-.16,-.49,9,eyes,11,3);point(hx+.16,-.49,9,eyes,11,3);
    point(hx,-.35,9,mouth,11,3);
    point(hx-.25,-.32,9,'\\',11,3);point(hx+.25,-.32,9,'/',11,3);
    limb(hx-.17,-.27,hx+.17,-.27,9,11,'_',3);
  }else{
    // Tiny garden visitors keep two bright eyes and one mouth, no face texture.
    point(-.14,-.53,9,expression==='happy'?'^':'o',11,3);
    point(.14,-.53,9,expression==='happy'?'^':'o',11,3);
    point(0,-.36,9,'v',11,3);
  }
  for(const side of [-1,1]){
    const alert=expression==='startled'?.12:0;
    const tipX=side*(.34+alert)+look*.07,tipY=-1.03-alert;
    limb(side*.12,-.66,side*.22+look*.04,-.86,9,11);
    limb(side*.22+look*.04,-.86,tipX,tipY,9,11);
    point(tipX,tipY,9,'o',11,3);
  }
  return {rootX,rootY,scale,co,si,minX,maxX,minY,maxY};
}

/** Internal visual cue; the existing public model/options/state remain stable. */
export interface ButterflyCharacterPose {
  readonly x:number;readonly y:number;readonly heading:number;readonly opening:number;
  readonly expression:'curious'|'happy'|'startled'|'sleepy';readonly activity:ButterflyActivity;readonly look:number;readonly contact:number;
}
export interface ButterflyCharacterCue {
  readonly kind:'gather'|'breeze'|'rest'|'recover';readonly age:number;readonly x:number;readonly y:number;
  readonly origin?:ButterflyCharacterPose;
}
const smooth=(value:number)=>{const x=clamp(value,0,1);return x*x*(3-2*x);};
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
function flowerAccent(f:Field,x:number,y:number,selected=false){
  const sx=2/f.worldW,sy=2/f.worldH;
  f.line(x,.96,x,y+.05,7,7,2,'|');
  f.line(x,.86,x-.14,.78,7,7,2,'/');
  f.line(x-.14,.78,x-.06,.86,6,7,2,'\\');
  f.line(x,.92,x+.11,.85,7,7,2,'\\');
  for(let k=0;k<6;k++){
    const a=k*TAU/6,px=x+Math.cos(a)*.22*sx,py=y+Math.sin(a)*.22*sy;
    f.line(x,y,px,py,selected?9:8,8,4,'o');
  }
  f.mark(x,y,'@',9,11,5);
  if(selected){f.mark(x-.34*sx,y-.18*sy,"'",9,11,4);f.mark(x+.34*sx,y-.18*sy,"'",9,11,4);}
}

/** Pure visual sampling also captures interruption origins without rendering. */
export function sampleButterflyCharacterPose(o:ButterflyConfig,s:ButterflyState,character:ButterflyCharacterCue|null):ButterflyCharacterPose {
  const worldW=Math.max(6,3.7*o.columns*.56/o.rows),worldH=worldW*o.rows/(o.columns*.56);
  const t=s.tick/60*o.speed,seedPhase=(o.seed%997)/997*TAU;
  const idle=(clock:number)=>({
    x:o.behavior==='perch'?0:Math.sin(clock*.72+seedPhase)*o.sway*.34,
    y:-.08+(o.behavior==='perch'?0:Math.sin(clock*1.18+seedPhase)*.025),
    heading:Math.sin(clock*.79+seedPhase)*.11,
    opening:o.behavior==='perch'?.78:((clock+seedPhase)%4.4<1.25?.36+.63*(.5+.5*Math.cos(clock*10.2+seedPhase)):.90+.06*Math.sin(clock*1.1))
  });
  const base=idle(t);let x=base.x,y=base.y,heading=base.heading,opening=base.opening;
  let expression:ButterflyCharacterPose['expression']=o.behavior==='perch'?'sleepy':'curious',activity:ButterflyActivity={kind:(t+seedPhase)%4.4<1.25?'flutter':'glide'},look=s.targetX,contact=0;
  const scale=o.scale*1.12;
  if(character){
    const {age,kind}=character,start=character.origin??idle((s.tick-age)/60*o.speed),side=character.x<0?-1:1;
    if(kind==='recover'){
      const e=smooth(age/90);x=mix(start.x,base.x,e);y=mix(start.y,base.y,e);
      heading=mix(start.heading,base.heading,e);opening=mix(start.opening,base.opening,e);
      expression=age<45?character.origin?.expression??'curious':'curious';activity={kind:'recover'};contact=(character.origin?.contact??0)*(1-e);
    }else if(kind==='gather'||kind==='rest'){
      const arrival=smooth((age-24)/80),departure=kind==='rest'?smooth((age-340)/80):smooth((age-220)/80);
      const landY=.66-.78*scale*2/worldH;
      x=mix(start.x,side*.64,arrival);y=mix(start.y,landY,arrival)-Math.sin(arrival*Math.PI)*.10;
      heading=mix(start.heading,side*.04,arrival);
      const fold=smooth((age-55)/50);
      contact=mix(character.origin?.contact??0,smooth((age-85)/25),arrival)*(1-departure);
      opening=mix(.84+.13*Math.sin(age*.19),.29+.04*Math.sin(age*.05),fold);
      if(age<24){x=start.x;y=start.y+.018*smooth(age/24);opening=mix(start.opening,.43,smooth(age/24));heading=start.heading+side*.09*smooth(age/24);}
      expression=age>=104?(kind==='rest'?'sleepy':'happy'):'curious';look=side;
      activity=age>=104?{kind:'perch',flower:side<0?0:1}:{kind:'inspect',target:'invitation'};
      x=mix(x,base.x,departure);y=mix(y,base.y,departure)-Math.sin(departure*Math.PI)*.09;
      heading=mix(heading,base.heading,departure);opening=mix(opening,base.opening,departure);
      if(departure>0){activity={kind:'recover'};expression='curious';}
    }else{
      const away=Math.abs(character.x-start.x)>.05?Math.sign(start.x-character.x):(o.director.breeze<0?-1:1);
      const launch=smooth((age-24)/66),recover=smooth((age-180)/120);
      contact=(character.origin?.contact??0)*(1-smooth(age/24));
      const escapeX=clamp(start.x+away*.42,-.46,.46),escapeY=-.37;
      x=mix(start.x,escapeX,launch);y=mix(start.y,escapeY,launch);
      heading=mix(start.heading,away*.40,launch);
      opening=age<24?mix(start.opening,.27,smooth(age/24)):age<100?.30+.66*(.5+.5*Math.cos((age-24)*.26)):.88;
      if(age<24)y+=.045*smooth(age/24);
      x=mix(x,base.x,recover);y=mix(y,base.y,recover)+Math.sin(recover*Math.PI)*.06;
      heading=mix(heading,base.heading,recover);opening=mix(opening,base.opening,recover);
      expression=age<100?'startled':recover>.5?'happy':'curious';look=away;
      activity={kind:age<24?'shelter':age<100?'flutter':recover>0?'recover':'glide'};
    }
  }else if(o.behavior==='curious'){look=s.targetX;x+=s.targetX*.055;y+=s.targetY*.15*2/worldH;heading+=s.targetX*.10;}
  return {x,y,heading,opening,expression,activity,look,contact};
}

/** A single character shares exactly the garden's editable ASCII geometry. */
export function renderButterflySpecimen(o:ButterflyConfig,s:ButterflyState,phase:ButterflyPhase,still=false,character:ButterflyCharacterCue|null=null):ButterflyFrame {
  const f=field(o),pose=sampleButterflyCharacterPose(o,s,character),t=s.tick/60*o.speed,seedPhase=(o.seed%997)/997*TAU;
  const selected=character&&(character.kind==='gather'||character.kind==='rest')?Math.sign(character.x):0;
  flowerAccent(f,-.64,.66,selected===-1);flowerAccent(f,.64,.66,selected===1);
  for(const side of [-1,1]){f.line(side*.91,.95,side*.86,.87,5,7,2,'/');f.mark(side*.86,.84,"'",6,7,2);}
  if(character?.kind==='breeze'&&character.age>24&&character.age<104&&!still){
    const away=pose.x>0?1:-1;for(let k=0;k<3;k++)f.mark(pose.x-away*(.17+k*.045),pose.y+.20+k*.04,k===1?'~':"'",6,12,3);
  }
  drawAnimal(f,o,{...pose,scale:o.scale*1.12,phase:seedPhase,ink:1,clock:t,blur:!still},10);
  return f.frame(phase);
}

/** Bounded layered meadow; all marks remain printable ASCII logical cells. */
export function renderButterflyGarden(o:ButterflyConfig,g:ButterflyGardenState,phase:ButterflyPhase,still=false):ButterflyFrame {
  const f=field(o),{columns,rows,worldW,worldH}=f;
  for(let k=0;k<6;k++){
    const n=(k*37+o.seed%107)%113,x=-.93+1.86*n/113+Math.sin(g.clock*.16+k*2.1)*.012,y=-.78+((k*.127+g.clock*.004)%1.33);
    f.mark(x,y,k%5===0?':':'.',k%5===0?3:2,9,1);
  }
  // Two distant seed-head stems establish depth, behind the focal flower row.
  for(let k=0;k<2;k++){
    const x=-.82+k*1.64,y=.18+(k%2)*.12,bend=Math.sin(g.clock*.32+k)*.025;
    f.line(x,.87,x+bend,y,2,7,1);f.line(x+bend,y,x+bend-.045,y-.08,2,7,1);
    for(let j=0;j<5;j++)f.mark(x+bend+(j%2?-.018:.018),y-.07+j*.025,':',2,7,1);
  }
  const weather=g.cue==='breeze'||(g.scene==='breeze'&&g.actIndex===1)||(g.pointer.active&&o.director.pointerMode==='breeze');
  if(weather&&!still){const direction=o.director.breeze<0?-1:1;for(let ribbon=0;ribbon<3;ribbon++)for(let k=0;k<23;k++){
    const x=-.87+k*.077,y=-.53+ribbon*.27+Math.sin(x*4-direction*g.clock*.7+ribbon)*.055;f.mark(x,y,k%4===0?'~':'.',3,9,2);
  }}
  // A low sparse ground plane, with two broad foreground leaf silhouettes.
  for(let k=0;k<17;k++){
    const x=-.98+k*.122,top=.96-.020*(1+(k*7+o.seed)%4);
    f.line(x,.99,x-.018,top,3,7,2,'/');if(k%3===0)f.line(x,.99,x+.025,top+.025,3,7,2,'\\');
  }
  for(const side of [-1,1])for(let k=0;k<3;k++){
    const x=side*(.92-k*.055),y=.96-k*.025,tipX=x-side*(.14+k*.025),tipY=y-.15-k*.03;
    f.line(x,y,tipX,tipY,5,7,4);f.line(x,y,tipX+side*.07,tipY+.015,3,7,4);
    f.line(tipX,tipY,tipX+side*.07,tipY+.015,4,7,4);
  }
  for(const flower of g.flowers){
    const fx=flower.x,fy=flower.y,bend=Math.sin(g.clock*.46+flower.id*1.4)*.012+o.director.breeze*.018,root=fx-bend*1.2;
    const occupied=g.members.some(m=>(m.activity.kind==='nectar'||m.activity.kind==='perch')&&m.activity.flower===flower.id);
    let px=fx,py=fy;const steps=Math.max(1,Math.ceil((.96-fy)*rows*.5));
    for(let k=1;k<=steps;k++){
      const p=k/steps,x=fx+(root-fx)*p+Math.sin(p*Math.PI)*bend,y=fy+(.96-fy)*p;
      f.line(px,py,x,y,4,7,3);px=x;py=y;
    }
    for(const [at,side] of [[.43,-1],[.70,1]] as const){
      const y=fy+(.96-fy)*at,x=fx+(root-fx)*at+Math.sin(at*Math.PI)*bend,tx=x+side*.085;
      f.line(x,y,tx,y-.065,5,7,3);f.line(tx,y-.065,x+side*.048,y+.005,3,7,3);
    }
    // A modest coneflower-like head: fluted petals below a compact raised disk.
    for(let petal=0;petal<9;petal++){
      const a=petal*TAU/9,rx=Math.cos(a)*.19,ry=Math.sin(a)*.095+.055;
      f.line(fx+rx*.45*2/worldW,fy+ry*.35*2/worldH,fx+rx*2/worldW,fy+ry*2/worldH,occupied?8:6,8,4,petal%2===0?'o':':');
    }
    f.mark(fx-.04*2/worldW,fy,'o',8,8,5);f.mark(fx+.04*2/worldW,fy,'o',8,8,5);f.mark(fx,fy-.04*2/worldH,'@',occupied?9:8,11,5);
  }
  if(g.pointer.active&&o.director.pointerMode!=='off'){
    for(let k=0;k<8;k++){const a=k*TAU/8;f.mark(g.pointer.x+Math.cos(a)*.16*2/worldW,g.pointer.y+Math.sin(a)*.16*2/worldH,'.',4,9,6);}
    f.mark(g.pointer.x,g.pointer.y,o.director.pointerMode==='breeze'?'~':'+',7,9,6);
  }
  const members=[...g.members].sort((a,b)=>a.y-b.y||a.id-b.id);
  for(let order=0;order<members.length;order++){
    const m=members[order]!,scale=Math.max(m.scale*o.scale,worldW/(columns-1)*5.4),depth=10+order*3;
    const root=drawAnimal(f,o,{...m,scale,ink:m.id+1,clock:g.clock,blur:!still},depth);
    if(m.activity.kind==='nectar'){
      const flowerId=m.activity.flower;
      const flower=g.flowers.find(item=>item.id===flowerId);
      if(flower){
        const hx=root.rootX+.53*root.si*scale,hy=root.rootY-.53*root.co*scale,fx=flower.x*worldW*.5,fy=flower.y*worldH*.5;
        // Physical reach gate also protects extreme scale/edge-fitting cases.
        // Never stretch a feeding tube across empty air while still arriving.
        if(Math.hypot(fx-hx,fy-hy)<scale*.69){
          const mx=(hx+fx)*.5+.045*scale,my=(hy+fy)*.5;
          f.line(hx*2/worldW,hy*2/worldH,mx*2/worldW,my*2/worldH,7,11,depth+1,'.');
          f.line(mx*2/worldW,my*2/worldH,flower.x,flower.y,7,11,depth+1,'.');
        }
      }
    }
    if(o.director.showLabels){
      const c=clamp(Math.round(((root.rootX+root.maxX)/worldW+.5)*(columns-1))+2,1,columns-2);
      const r=clamp(Math.round(((root.rootY+root.minY)/worldH+.5)*(rows-1))-1,1,rows-2);f.put(c,r,String(m.id+1),7,m.id+1,depth+2);
    }
  }
  return f.frame(phase);
}
