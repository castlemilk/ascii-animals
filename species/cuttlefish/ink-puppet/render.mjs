/** Original cuttlefish character geometry, sampled into printable ASCII cells.
 * No raster assets, gradients, particles drawn as disks, or font-dependent logic.
 * Viewpoint: stylised lateral / three-quarter puppet; frontal turn is an authored
 * squash with the eyes staying within the head, never on external spheres.
 */
export const PUPPET_PALETTE = Object.freeze([
  '#0b2028', '#34535b', '#5d8e89', '#97c9b3', '#c17a4b', '#e6ad70', '#f5dfaa', '#fff0c7', '#273e48'
]);
export const PUPPET_GLYPHS = ' .,:;-=+*#~_/\\()vwo>';
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const mix = (a,b,t) => a+(b-a)*t;
const smooth = t => {t=clamp(t,0,1);return t*t*(3-2*t);};
const TAU = Math.PI * 2;

function hash(n) {
  n = Math.imul((n ^ n >>> 16) >>> 0, 0x21f0aaad);
  n = Math.imul(n ^ n >>> 15, 0x735a2d97);
  return ((n ^ n >>> 15) >>> 0) / 4294967296;
}
function ellipse(x,y,cx,cy,rx,ry) {
  return (Math.hypot((x-cx)/rx,(y-cy)/ry)-1)*Math.min(rx,ry);
}
function bezier(a,b,c,d,t) {
  const q=1-t;return [q*q*q*a[0]+3*q*q*t*b[0]+3*q*t*t*c[0]+t*t*t*d[0],q*q*q*a[1]+3*q*q*t*b[1]+3*q*t*t*c[1]+t*t*t*d[1]];
}
function strokeDistance(x,y,a,b) {
  const dx=b[0]-a[0],dy=b[1]-a[1],q=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1),0,1);
  return Math.hypot(x-a[0]-q*dx,y-a[1]-q*dy);
}
function arcGlyph(nx,ny) {
  if(Math.abs(ny)>Math.abs(nx)*1.8)return ny<0?'_':'~';
  if(Math.abs(nx)>Math.abs(ny)*1.8)return nx<0?'(':')';
  return nx*ny>0?'\\':'/';
}

/** Original connected crown. Eight primary arm paths; two feeding tentacles
 * are a separate, normally concealed pair. Every root overlaps head tissue.
 */
function armPaths(pose) {
  const specs=[
    [-.20,1.93,-.35,.13],[-.05,2.03,.21,-.17],[.18,1.75,.72,-.16],[.31,1.35,.85,-.19],
    [-.17,1.85,-.25,.17],[.03,1.96,.32,-.21],[.23,1.65,.80,-.23],[.35,1.25,.91,-.20]
  ];
  return specs.map((s,i)=>{
    const gather=pose.gather, lift=pose.reach*(i===0||i===4?1:0);
    const wave=Math.sin(pose.tick/60*1.6+i*.87)*.045;
    const end=[mix(s[1],1.38,gather)+lift*.16, mix(s[2],s[0]*.7,gather)-lift*.16+wave];
    const start=[.79+(i%2)*.04,s[0]];
    const a=[1.11,s[0]+(s[2]-s[0])*.12];
    const b=[end[0]+.09,end[1]-s[3]*1.8];
    const pts=[];
    for(let j=0;j<=18;j++)pts.push(bezier(start,a,b,end,j/18));
    // A short rolled tip, smaller than the head and clearly part of this arm.
    const curl=s[3]*(1-.72*gather);
    for(let j=1;j<=6;j++){
      const u=j/6;pts.push([end[0]-Math.sin(u*Math.PI*.72)*Math.abs(curl),end[1]+curl*(1-Math.cos(u*Math.PI*.72))]);
    }
    return {pts,index:i,far:i<4,minX:Math.min(...pts.map(p=>p[0])),maxX:Math.max(...pts.map(p=>p[0])),
      minY:Math.min(...pts.map(p=>p[1])),maxY:Math.max(...pts.map(p=>p[1]))};
  });
}

function armAt(x,y,paths,far,cell) {
  let best=null;
  for(const path of paths){
    if(path.far!==far)continue;
    const padding=Math.max(.16,cell*.58);
    if(x<path.minX-padding||x>path.maxX+padding||y<path.minY-padding||y>path.maxY+padding)continue;
    for(let j=1;j<path.pts.length;j++){
      const u=j/(path.pts.length-1),r=Math.max(.125*(1-u)+.035,cell*.57);
      const d=strokeDistance(x,y,path.pts[j-1],path.pts[j])-r;
      if(d<=0 && (!best||d<best.d)){
        const dx=path.pts[j][0]-path.pts[j-1][0],dy=path.pts[j][1]-path.pts[j-1][1];
        best={d,char:Math.abs(dy)>Math.abs(dx)*1.5?'(':dx*dy>0?'\\':'/',color:far?2:6,owner:4};
        if(d<-cell*.27){best.char=far?':':'~';best.color=far?1:5;}
      }
    }
  }
  return best;
}

function characterCell(x,y,pose,paths,cell) {
  const time=pose.tick/60;
  const squash=1-.16*pose.squeeze;
  const bodyY=y/squash;
  const bodyX=x/(1+.065*pose.squeeze);
  const theta=Math.atan2(bodyY/.82,(bodyX+.77)/1.31);
  const finWave=.033*Math.sin(theta*7-time*2.1)+.017*Math.sin(theta*11+time*1.4);
  const fin=ellipse(bodyX,bodyY,-.79,.035,1.43,.88+finWave);
  const mantle=ellipse(bodyX,bodyY,-.81,-.035,1.32,.70);
  let out=armAt(x,y,paths,true,cell);
  if(fin<=0){
    const edge=fin>-.065;
    out={char:edge?arcGlyph((bodyX+.79)/1.43,(bodyY-.035)/.88):'~',color:edge?3:2,owner:2};
    if(!edge&&Math.sin(theta*7-time*2.1)>.4)out.char='=';
  }
  if(mantle<=0){
    const edge=mantle>-.05;
    const band=Math.sin(bodyX*5.6+bodyY*2.6+pose.stripe*2.7+.55*Math.sin(bodyY*3.6));
    // Broad chromatophore bars; fixed in anatomy, animated only by the cue.
    const patch=band>.42;
    out={char:edge?arcGlyph((bodyX+.81)/1.32,(bodyY+.035)/.70):patch?'=':':',color:patch?6:4,owner:1};
    if(bodyY<-.25 && !patch)out={char:'-',color:5,owner:1};
    if(bodyY>.26&&!patch)out={char:':',color:4,owner:1};
  }
  const shoulder=ellipse(x,y,.84,.06,.42,.415);
  const head=ellipse(x,y,.46,-.015,.57,.56);
  if(head<=0||shoulder<=0){
    const edge=Math.min(head,shoulder)>-.052 && !(x<.46&&mantle<=0);
    out={char:edge?arcGlyph((x-.46)/.57,(y+.015)/.52):':',color:y>.22?5:6,owner:3};
    // One forehead band, not eyebrows or a human mouth.
    if(y<-.30+.045*Math.sin(x*5)&&x<.63)out={char:'=',color:4,owner:3};
  }
  const near=armAt(x,y,paths,false,cell);
  if(near)out=near;
  // Repaint the shared shoulder above the roots; no detached face/arm seam.
  if(ellipse(x,y,.83,.035,.22,.34)<0)out={char:':',color:y>.2?5:6,owner:3};
  // Inset eye within the lateral skin surface. The W is a negative-space slit
  // through a small pale iris, never an external eyeball or outlined circle.
  const eyeX=.48,eyeY=-.105;
  const eyeH=.26*(1-.42*pose.eye),u=(x-eyeX)/.39,v=(y-eyeY)/eyeH;
  const socket=Math.abs(u)<1.13 && Math.abs(v)<(.93-.31*Math.abs(u));
  if(socket&&(head<=0||shoulder<=0)){
    out={char:'=',color:6,owner:5};
    // One wide slit: the cell-level W is stamped below after projection so
    // the pupil survives subcell shifts at phone size without glittering.
    if(Math.abs(v)<.50-.20*Math.abs(u))out={char:' ',color:0,owner:5};
    if(v<-.51+.24*Math.abs(u))out={char:'_',color:4,owner:5};
  }
  if((head<=0||shoulder<=0)&&Math.abs(u)<1.2&&v>-.98&&v<-.70+.12*Math.abs(u))out={char:'_',color:5,owner:5};
  return out;
}

function finitePose(pose){
  for(const key of ['tick','x','y','angle','facing','squeeze','reach','gather','stripe','ink','eye']){
    if(!Number.isFinite(pose?.[key]))throw new TypeError(`Non-finite puppet pose: ${key}`);
  }
}

/** Pure logical grid, bounded at 180 x 100. Width/height are CSS pixels.
 * Glyph metrics choose a grid; they never feed back into the species model.
 */
export function rasterizePuppet(pose,{width=1100,height=580,size=1,habitat=true,seed=7}={}) {
  finitePose(pose);
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||width>16384||height>16384)throw new RangeError('Positive finite viewport up to 16384px required.');
  if(!Number.isFinite(size)||size<.35||size>1.4)throw new RangeError('Puppet size must be .35..1.4.');
  if(typeof habitat!=='boolean'||!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new TypeError('Invalid habitat or seed.');
  let cellW=Math.max(width<520?5.8:8.6,width/180,height/100/1.48);
  const cellH=cellW*1.48,cols=Math.ceil(width/cellW),rows=Math.ceil(height/cellH);
  const glyphs=new Uint16Array(cols*rows),colors=new Uint8Array(cols*rows),owners=new Uint8Array(cols*rows);
  const put=(col,row,char,color,owner=0)=>{
    if(col<0||row<0||col>=cols||row>=rows)return;
    const i=row*cols+col;glyphs[i]=char===' '?0:char.charCodeAt(0);colors[i]=color;owners[i]=owner;
  };
  const place=(x,y,char,color,owner=0)=>put(Math.round(x/cellW-.5),Math.round(y/cellH-.5),char,color,owner);
  if(habitat){
    for(let side=0;side<2;side++){
      for(let blade=0;blade<3;blade++)for(let j=0;j<7+blade*2;j++){
        const x=width*(side?.94:.04)+(blade-1)*cellW*1.3+Math.sin(j*.12+blade+pose.tick/210)*j*.3;
        const y=height*.86-j*cellH*.8;
        place(x,y,j<3?'(':blade%2?'/':'\\',j%3===0?2:1);
      }
      for(let j=0;j<12;j++)place(width*(side?.79:.04)+j*cellW,height*(.88+.008*Math.sin(j*.6)),j%4?'_':'~',1);
    }
    for(let i=0;i<10;i++){
      const x=width*(.12+hash(seed+i*29)*.76),y=height*(.13+hash(seed+i*73+19)*.11);
      place(x,y,i%3?'-':'.',1);
    }
  }
  // Fixed observation volume, set only by viewport and selected size. Reserve
  // the complete maximum arm/turn envelope; constrain travel, never recenter or
  // zoom to the current pose. Large scale trades travel room for footprint.
  const unit=Math.min(width*.148*size,height*.235*size,width*.188,height*.32);
  const travelX=Math.max(.015,.47-2.42*unit/width);
  const travelY=Math.max(.02,.43-1.45*unit/height);
  const centerX=width*(.5+travelX*Math.tanh(pose.x/travelX)),centerY=height*(.47+travelY*Math.tanh(pose.y/travelY));
  const ca=Math.cos(pose.angle),sa=Math.sin(pose.angle),facing=clamp(pose.facing,-1,1);
  const side=Math.abs(facing),front=Math.sqrt(Math.max(0,1-side*side));
  const squeezeX=Math.abs(facing)>.025?facing:(facing<0?-.025:.025);
  const toWorld=(x,y)=>[centerX+(x*squeezeX*ca-y*sa)*unit,centerY+(x*squeezeX*sa+y*ca)*unit];
  const paths=armPaths(pose),localCell=cellW/unit;
  const minCol=Math.max(0,Math.floor((centerX-unit*2.7)/cellW));
  const maxCol=Math.min(cols-1,Math.ceil((centerX+unit*2.7)/cellW));
  const minRow=Math.max(0,Math.floor((centerY-unit*1.5)/cellH));
  const maxRow=Math.min(rows-1,Math.ceil((centerY+unit*1.5)/cellH));
  for(let row=minRow;row<=maxRow;row++)for(let col=minCol;col<=maxCol;col++){
    const wx=((col+.5)*cellW-centerX)/unit,wy=((row+.5)*cellH-centerY)/unit;
    const y=-wx*sa+wy*ca,x=(wx*ca+wy*sa)/squeezeX;
    const cell=characterCell(x,y,pose,paths,localCell);
    if(cell)put(col,row,cell.char,cell.color,cell.owner);
    if(front>.02){
      // Facing the viewer: a softly flattened mantle/head with lateral recessed
      // slits, no projecting eyeballs. Grows continuously through the yaw turn.
      const rx=1.12*front,ry=.90;
      const fd=ellipse(wx,wy,0,0,Math.max(.015,rx),ry);
      if(fd<0){
        let ch=wy<-.29?'=':':',color=wy<-.29?4:6;
        if(Math.abs(wx)>.30*front&&Math.abs(wx)<.53*front&&Math.abs(wy+.05)<.055){ch='w';color=7;}
        put(col,row,ch,color,3);
      }
      for(let arm=0;arm<4;arm++){
        const ax=(arm-1.5)*.23*front,ay=.45+Math.sin((arm+1)*.8+pose.tick/90)*.04;
        if(strokeDistance(wx,wy,[ax,ay],[ax*1.38,.85-(arm%2)*.06])<.055*front)put(col,row,arm%2?'/':'\\',6,4);
      }
    }
  }
  if(side>.55){
    const eye=toWorld(.48,-.105),ec=Math.round(eye[0]/cellW-.5),er=Math.round(eye[1]/cellH-.5);
    // Printable punctuation makes a single lateral W within the recessed slit.
    // At low footprint use a single w rather than four disconnected glints.
    if(unit*.70>cellW*7){
      const pupil='\\/\\/';
      for(let i=0;i<4;i++)put(ec+i-2,er,pupil[i],3,5);
    }else put(ec,er,'w',3,5);
  }
  // The two feeding tentacles emerge only during the stalk/reach sequence.
  if(pose.reach>.015&&pose.target){
    const target=[width*(.5+clamp(pose.target.x,-.42,.42)),height*(.5+clamp(pose.target.y,-.34,.34))];
    const root=toWorld(1.06,.12);
    for(let pair=0;pair<2;pair++){
      const end=[mix(root[0],target[0],pose.reach),mix(root[1],target[1],pose.reach)+(pair?1:-1)*cellH*.55];
      const mid=[mix(root[0],end[0],.55),mix(root[1],end[1],.55)+(pair?1:-1)*unit*.10];
      for(let j=0;j<=36;j++){
        const u=j/36,q=1-u,x=q*q*root[0]+2*q*u*mid[0]+u*u*end[0],y=q*q*root[1]+2*q*u*mid[1]+u*u*end[1];
        place(x,y,j>33?'o':Math.abs(end[1]-root[1])>Math.abs(end[0]-root[0])?'/':'-',j>33?7:5,6);
      }
    }
  }
  if(pose.targetVisible&&pose.target){
    const tx=width*(.5+clamp(pose.target.x,-.42,.42)),ty=height*(.5+clamp(pose.target.y,-.34,.34));
    // A tiny authored shrimp / water disturbance. Printable ASCII only.
    const marker=pose.action==='retreat'?'(+)':'>-o';
    for(let i=0;i<marker.length;i++)place(tx+(i-1)*cellW,ty,marker[i],pose.action==='retreat'?5:3,7);
    if(pose.action!=='retreat'){place(tx-cellW,ty+cellH,'/',2,7);place(tx,ty+cellH,'/',2,7);}
  }
  if(pose.ink>.01){
    const origin=pose.origin||{x:-.06,y:-.03},target=pose.target||{x:.3,y:0};
    const dx=target.x-origin.x,dy=target.y-origin.y,mag=Math.hypot(dx,dy)||1;
    const age=Math.max(0,(pose.age||1.1)-1.05);
    const ix=width*(.5+origin.x)+dx/mag*unit*.60,iy=height*(.47+origin.y)+dy/mag*unit*.60;
    for(let i=0;i<34;i++){
      const a=hash(seed+i*101)*TAU,r=(.20+hash(seed+i*7)*.8)*(16+age*12);
      const x=ix+Math.cos(a)*r+dx/mag*age*13,y=iy+Math.sin(a)*r*.66+dy/mag*age*13;
      if(hash(i+seed*17)<pose.ink)place(x,y,':;.*'[i%4],i%4===0?2:8,8);
    }
  }
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity,glyphCount=0,animalCells=0;
  for(let i=0;i<glyphs.length;i++)if(glyphs[i]){
    glyphCount++;
    if(owners[i]&&owners[i]<7){animalCells++;const x=i%cols,y=Math.floor(i/cols);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  }
  return {width,height,cols,rows,cellW,cellH,glyphs,colors,owners,glyphCount,animalCells,
    bounds:animalCells?{left:left*cellW,top:top*cellH,right:(right+1)*cellW,bottom:(bottom+1)*cellH}:null};
}

/** Canvas paints only a flat field and glyphs. No creature raster underlay. */
export function drawPuppetGrid(ctx,grid,{dpr=1}={}) {
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  ctx.fillStyle=PUPPET_PALETTE[0];ctx.fillRect(0,0,grid.width,grid.height);
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font=`600 ${grid.cellH*.98}px "SFMono-Regular", Consolas, "Liberation Mono", monospace`;
  let color=-1;
  for(let i=0;i<grid.glyphs.length;i++){
    if(!grid.glyphs[i])continue;
    if(color!==grid.colors[i]){color=grid.colors[i];ctx.fillStyle=PUPPET_PALETTE[color];}
    ctx.fillText(String.fromCharCode(grid.glyphs[i]),(i%grid.cols+.5)*grid.cellW,(Math.floor(i/grid.cols)+.5)*grid.cellH);
  }
}

export function gridToText(grid) {
  const rows=[];for(let y=0;y<grid.rows;y++){let row='';for(let x=0;x<grid.cols;x++)row+=String.fromCharCode(grid.glyphs[y*grid.cols+x]||32);rows.push(row);}return rows.join('\n');
}
