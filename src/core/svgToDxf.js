// ══════════════════════════════════════════════════════════════
// SVG → DXF CONVERTER — Pure JS module
// Extracted from SVG-TODXF-V1.html — logic untouched
// Only DOM/UI references removed
// ══════════════════════════════════════════════════════════════

// ── Matrix helpers ──────────────────────────────────────────
function identity() { return [[1,0,0],[0,1,0],[0,0,1]]; }

function matMul2(a,b){
  const r=[[0,0,0],[0,0,0],[0,0,0]];
  for(let i=0;i<3;i++) for(let j=0;j<3;j++) for(let k=0;k<3;k++) r[i][j]+=a[i][k]*b[k][j];
  return r;
}

function applyMatrix(mat,x,y){ return [mat[0][0]*x+mat[0][1]*y+mat[0][2], mat[1][0]*x+mat[1][1]*y+mat[1][2]]; }

function parseTransform(str){
  let m = identity();
  if(!str) return m;
  const re = /(\w+)\(([^)]*)\)/g; let match;
  while((match=re.exec(str))!==null){
    const name=match[1];
    const args=match[2].trim().split(/[\s,]+/).map(Number);
    if(name==='matrix'){ const [a,b,c,d,e,f]=args; m=matMul2(m,[[a,c,e],[b,d,f],[0,0,1]]); }
    else if(name==='translate'){ const [tx,ty=0]=args; m=matMul2(m,[[1,0,tx],[0,1,ty],[0,0,1]]); }
    else if(name==='scale'){ const [sx,sy=args[0]]=args; m=matMul2(m,[[sx,0,0],[0,sy,0],[0,0,1]]); }
    else if(name==='rotate'){
      const a=args[0]*Math.PI/180,cx=args[1]||0,cy=args[2]||0;
      const cos=Math.cos(a),sin=Math.sin(a);
      const t1=[[1,0,-cx],[0,1,-cy],[0,0,1]],rot=[[cos,-sin,0],[sin,cos,0],[0,0,1]],t2=[[1,0,cx],[0,1,cy],[0,0,1]];
      m=matMul2(m,matMul2(t2,matMul2(rot,t1)));
    }
    else if(name==='skewX'){ const a=Math.tan(args[0]*Math.PI/180); m=matMul2(m,[[1,a,0],[0,1,0],[0,0,1]]); }
    else if(name==='skewY'){ const a=Math.tan(args[0]*Math.PI/180); m=matMul2(m,[[1,0,0],[a,1,0],[0,0,1]]); }
  }
  return m;
}

// ── Curve flattening ────────────────────────────────────────
function flattenCubic(x0,y0,x1,y1,x2,y2,x3,y3,f){
  const ux=3*x1-2*x0-x3, uy=3*y1-2*y0-y3;
  const vx=3*x2-2*x3-x0, vy=3*y2-2*y3-y0;
  if(Math.max(ux*ux+uy*uy,vx*vx+vy*vy)<=16*f*f) return [[x0,y0],[x3,y3]];
  const x01=(x0+x1)/2,y01=(y0+y1)/2,x12=(x1+x2)/2,y12=(y1+y2)/2,x23=(x2+x3)/2,y23=(y2+y3)/2;
  const x012=(x01+x12)/2,y012=(y01+y12)/2,x123=(x12+x23)/2,y123=(y12+y23)/2;
  const xm=(x012+x123)/2,ym=(y012+y123)/2;
  return [...flattenCubic(x0,y0,x01,y01,x012,y012,xm,ym,f),...flattenCubic(xm,ym,x123,y123,x23,y23,x3,y3,f).slice(1)];
}

function flattenQuadratic(x0,y0,x1,y1,x2,y2,f){
  const ux=x0-2*x1+x2,uy=y0-2*y1+y2;
  if(ux*ux+uy*uy<=8*f*f) return [[x0,y0],[x2,y2]];
  const xm=(x0+2*x1+x2)/4,ym=(y0+2*y1+y2)/4;
  const x01=(x0+x1)/2,y01=(y0+y1)/2,x12=(x1+x2)/2,y12=(y1+y2)/2;
  return [...flattenQuadratic(x0,y0,x01,y01,xm,ym,f),...flattenQuadratic(xm,ym,x12,y12,x2,y2,f).slice(1)];
}

function flattenArc(x1,y1,rx,ry,phiDeg,fa,fs,x2,y2,f){
  if(Math.abs(x1-x2)<1e-10&&Math.abs(y1-y2)<1e-10) return [[x1,y1]];
  if(!rx||!ry) return [[x1,y1],[x2,y2]];
  const phi=phiDeg*Math.PI/180,cosPhi=Math.cos(phi),sinPhi=Math.sin(phi);
  rx=Math.abs(rx); ry=Math.abs(ry);
  const dx=(x1-x2)/2,dy=(y1-y2)/2;
  const x1p=cosPhi*dx+sinPhi*dy,y1p=-sinPhi*dx+cosPhi*dy;
  const x1p2=x1p*x1p,y1p2=y1p*y1p; let rx2=rx*rx,ry2=ry*ry;
  const lam=x1p2/rx2+y1p2/ry2;
  if(lam>1){ const s=Math.sqrt(lam); rx*=s;ry*=s;rx2=rx*rx;ry2=ry*ry; }
  const num=Math.max(0,rx2*ry2-rx2*y1p2-ry2*x1p2);
  const den=rx2*y1p2+ry2*x1p2;
  let sq=den?Math.sqrt(num/den):0;
  if(fa===fs) sq=-sq;
  const cxp=sq*rx*y1p/ry, cyp=-sq*ry*x1p/rx;
  const cx=cosPhi*cxp-sinPhi*cyp+(x1+x2)/2, cy=sinPhi*cxp+cosPhi*cyp+(y1+y2)/2;
  function angle(ux,uy,vx,vy){
    const d=Math.sqrt(ux*ux+uy*uy)*Math.sqrt(vx*vx+vy*vy);
    if(!d) return 0;
    let a=Math.acos(Math.max(-1,Math.min(1,(ux*vx+uy*vy)/d)));
    if(ux*vy-uy*vx<0) a=-a; return a;
  }
  let theta1=angle(1,0,(x1p-cxp)/rx,(y1p-cyp)/ry);
  let dtheta=angle((x1p-cxp)/rx,(y1p-cyp)/ry,(-x1p-cxp)/rx,(-y1p-cyp)/ry);
  if(fs===0&&dtheta>0) dtheta-=2*Math.PI;
  if(fs===1&&dtheta<0) dtheta+=2*Math.PI;
  const nSegs=Math.max(4,Math.ceil(Math.abs(dtheta)*Math.max(rx,ry)/f));
  const pts=[];
  for(let i=0;i<=nSegs;i++){
    const t=theta1+dtheta*i/nSegs;
    const xp=rx*Math.cos(t),yp=ry*Math.sin(t);
    pts.push([cosPhi*xp-sinPhi*yp+cx,sinPhi*xp+cosPhi*yp+cy]);
  }
  return pts;
}

// ── Path parser ─────────────────────────────────────────────
function parsePathToPolylines(d, flatness=0.5){
  const tokens=d.match(/[MmZzLlHhVvCcSsQqTtAa]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g)||[];
  let idx=0;
  const nextFloat=()=>{ while(idx<tokens.length){const t=tokens[idx++];const v=parseFloat(t);if(!isNaN(v))return v;idx--; return null;} return null; };
  const nextCoord=()=>[nextFloat(),nextFloat()];
  const polylines=[];
  let current=[],cx=0,cy=0,sx=0,sy=0,lastCtrl=null,cmd='M';
  while(idx<tokens.length){
    const t=tokens[idx];
    if(/[A-Za-z]/.test(t)){cmd=t;idx++;}
    if(cmd==='M'||cmd==='m'){
      let [x,y]=nextCoord(); if(x===null) break;
      if(cmd==='m'){x+=cx;y+=cy;}
      if(current.length) polylines.push(current);
      current=[[x,y]]; cx=x;cy=y;sx=x;sy=y; lastCtrl=null; cmd=cmd==='m'?'l':'L';
    } else if(cmd==='Z'||cmd==='z'){
      current.push([sx,sy]); polylines.push(current); current=[[sx,sy]]; cx=sx;cy=sy; lastCtrl=null;
    } else if(cmd==='L'||cmd==='l'){
      let [x,y]=nextCoord(); if(x===null) break;
      if(cmd==='l'){x+=cx;y+=cy;} current.push([x,y]); cx=x;cy=y; lastCtrl=null;
    } else if(cmd==='H'||cmd==='h'){
      let x=nextFloat(); if(x===null) break;
      if(cmd==='h') x+=cx; current.push([x,cy]); cx=x; lastCtrl=null;
    } else if(cmd==='V'||cmd==='v'){
      let y=nextFloat(); if(y===null) break;
      if(cmd==='v') y+=cy; current.push([cx,y]); cy=y; lastCtrl=null;
    } else if(cmd==='C'||cmd==='c'){
      let [x1,y1]=nextCoord(),[x2,y2]=nextCoord(),[x,y]=nextCoord(); if(x===null) break;
      if(cmd==='c'){x1+=cx;y1+=cy;x2+=cx;y2+=cy;x+=cx;y+=cy;}
      const pts=flattenCubic(cx,cy,x1,y1,x2,y2,x,y,flatness); current.push(...pts.slice(1));
      lastCtrl=[x2,y2]; cx=x;cy=y;
    } else if(cmd==='S'||cmd==='s'){
      let [x2,y2]=nextCoord(),[x,y]=nextCoord(); if(x===null) break;
      if(cmd==='s'){x2+=cx;y2+=cy;x+=cx;y+=cy;}
      const x1=lastCtrl?2*cx-lastCtrl[0]:cx, y1=lastCtrl?2*cy-lastCtrl[1]:cy;
      const pts=flattenCubic(cx,cy,x1,y1,x2,y2,x,y,flatness); current.push(...pts.slice(1));
      lastCtrl=[x2,y2]; cx=x;cy=y;
    } else if(cmd==='Q'||cmd==='q'){
      let [x1,y1]=nextCoord(),[x,y]=nextCoord(); if(x===null) break;
      if(cmd==='q'){x1+=cx;y1+=cy;x+=cx;y+=cy;}
      const pts=flattenQuadratic(cx,cy,x1,y1,x,y,flatness); current.push(...pts.slice(1));
      lastCtrl=[x1,y1]; cx=x;cy=y;
    } else if(cmd==='T'||cmd==='t'){
      let [x,y]=nextCoord(); if(x===null) break;
      if(cmd==='t'){x+=cx;y+=cy;}
      const x1=lastCtrl?2*cx-lastCtrl[0]:cx, y1=lastCtrl?2*cy-lastCtrl[1]:cy;
      const pts=flattenQuadratic(cx,cy,x1,y1,x,y,flatness); current.push(...pts.slice(1));
      lastCtrl=[x1,y1]; cx=x;cy=y;
    } else if(cmd==='A'||cmd==='a'){
      const arx=nextFloat(),ary=nextFloat(),xRot=nextFloat(),la=nextFloat(),sw=nextFloat();
      let [x,y]=nextCoord(); if(x===null) break;
      if(cmd==='a'){x+=cx;y+=cy;}
      const pts=flattenArc(cx,cy,arx,ary,xRot,la,sw,x,y,flatness); current.push(...pts.slice(1));
      cx=x;cy=y; lastCtrl=null;
    } else { idx++; }
  }
  if(current.length>1) polylines.push(current);
  return polylines;
}

// ── Length parsers ──────────────────────────────────────────
function parseLength(s){
  if(!s) return 0;
  const factor={px:1,mm:3.7795275591,cm:37.795275591,in:96,pt:1.3333333333,pc:16,em:16,'%':1};
  const m=String(s).match(/([\d.eE+\-]+)\s*([a-z%]*)/i);
  if(!m) return parseFloat(s)||0;
  return parseFloat(m[1])*(factor[m[2].toLowerCase()]||1);
}

function parseLengthCm(s){
  if(!s) return null;
  const str=String(s).trim();
  const m=str.match(/([\d.eE+\-]+)\s*([a-z%]*)/i);
  if(!m) return null;
  const val=parseFloat(m[1]);
  const unit=m[2].toLowerCase();
  if(!unit||unit==='px') return null;
  const toCm={mm:0.1,cm:1,in:2.54,pt:2.54/72,pc:2.54/6};
  return (toCm[unit]!==undefined) ? val*toCm[unit] : null;
}

// ── Text special-character encoder for AutoCAD txt.shx ──────
function encodeAcadText(str){
  return String(str)
    .replace(/Ø|ø|\u00D8|\u00F8/g,'%%c')
    .replace(/°|\u00B0/g,'%%d')
    .replace(/±|\u00B1/g,'%%p')
    .replace(/×|\u00D7/g,'x')
    .replace(/÷|\u00F7/g,'/')
    .replace(/²|\u00B2/g,'^2')
    .replace(/³|\u00B3/g,'^3')
    .replace(/µ|\u00B5/g,'u')
    .replace(/\u2205/g,'%%c')
    .replace(/\u2200/g,'%%c')
    .replace(/[\r\n\t]+/g,' ')
    .replace(/[^\x20-\x7E]/g,'?');
}

// ── DXF builder — AC1009 / R12 format ──────────────────────
class DXFWriter {
  constructor(){
    this.entities = [];
    this.handle   = 1;
    this.minX=Infinity;  this.minY=Infinity;
    this.maxX=-Infinity; this.maxY=-Infinity;
    this.extraLayers = [];
  }

  setLayers(layers){ this.extraLayers=layers; }
  _h(){ return (this.handle++).toString(16).toUpperCase(); }
  _f(n){ return Number(n).toFixed(6); }

  _track(x,y){
    if(x<this.minX)this.minX=x; if(x>this.maxX)this.maxX=x;
    if(y<this.minY)this.minY=y; if(y>this.maxY)this.maxY=y;
  }

  addLine(x1,y1,x2,y2,layer='0',aci=7){
    this._track(x1,y1); this._track(x2,y2);
    this.entities.push(
      `  0\nLINE\n  5\n${this._h()}\n  8\n${layer}\n 62\n${aci}\n`+
      ` 10\n${this._f(x1)}\n 20\n${this._f(y1)}\n 30\n0.0\n`+
      ` 11\n${this._f(x2)}\n 21\n${this._f(y2)}\n 31\n0.0\n`
    );
  }

  addCircle(cx,cy,r,layer='0',aci=7){
    this._track(cx-r,cy-r); this._track(cx+r,cy+r);
    this.entities.push(
      `  0\nCIRCLE\n  5\n${this._h()}\n  8\n${layer}\n 62\n${aci}\n`+
      ` 10\n${this._f(cx)}\n 20\n${this._f(cy)}\n 30\n0.0\n`+
      ` 40\n${this._f(r)}\n`
    );
  }

  addPolyline(points,closed=false,layer='0',aci=7){
    if(points.length<2) return;
    for(const [x,y] of points) this._track(x,y);
    const flag = closed ? 1 : 0;
    let s = `  0\nPOLYLINE\n  5\n${this._h()}\n  8\n${layer}\n 62\n${aci}\n 66\n1\n 70\n${flag}\n 10\n0.0\n 20\n0.0\n 30\n0.0\n`;
    for(const [x,y] of points){
      s += `  0\nVERTEX\n  5\n${this._h()}\n  8\n${layer}\n 10\n${this._f(x)}\n 20\n${this._f(y)}\n 30\n0.0\n 70\n0\n`;
    }
    s += `  0\nSEQEND\n  5\n${this._h()}\n  8\n${layer}\n`;
    this.entities.push(s);
  }

  addText(x,y,text,height=0.4,layer='0',aci=7,align=0){
    this._track(x,y);
    const safe = encodeAcadText(text);
    if(align===0){
      this.entities.push(
        `  0\nTEXT\n  5\n${this._h()}\n  8\n${layer}\n 62\n${aci}\n`+
        ` 10\n${this._f(x)}\n 20\n${this._f(y)}\n 30\n0.0\n`+
        ` 40\n${this._f(height)}\n  1\n${safe}\n 50\n0.0\n  7\nSTANDARD\n`
      );
    } else {
      this.entities.push(
        `  0\nTEXT\n  5\n${this._h()}\n  8\n${layer}\n 62\n${aci}\n`+
        ` 10\n0.0\n 20\n0.0\n 30\n0.0\n`+
        ` 40\n${this._f(height)}\n  1\n${safe}\n 50\n0.0\n  7\nSTANDARD\n`+
        ` 72\n${align}\n`+
        ` 11\n${this._f(x)}\n 21\n${this._f(y)}\n 31\n0.0\n`
      );
    }
  }

  build(){
    const pad=0.5;
    const x0=isFinite(this.minX)?this.minX-pad:0;
    const y0=isFinite(this.minY)?this.minY-pad:0;
    const x1=isFinite(this.maxX)?this.maxX+pad:30;
    const y1=isFinite(this.maxY)?this.maxY+pad:20;
    const f=n=>Number(n).toFixed(6);

    const header =
`  0\nSECTION\n  2\nHEADER\n`+
`  9\n$ACADVER\n  1\nAC1009\n`+
`  9\n$INSBASE\n 10\n0.0\n 20\n0.0\n 30\n0.0\n`+
`  9\n$EXTMIN\n 10\n${f(x0)}\n 20\n${f(y0)}\n 30\n0.0\n`+
`  9\n$EXTMAX\n 10\n${f(x1)}\n 20\n${f(y1)}\n 30\n0.0\n`+
`  9\n$LIMMIN\n 10\n${f(x0)}\n 20\n${f(y0)}\n`+
`  9\n$LIMMAX\n 10\n${f(x1)}\n 20\n${f(y1)}\n`+
`  9\n$LTSCALE\n 40\n1.0\n`+
`  9\n$LUNITS\n 70\n2\n`+
`  9\n$LUPREC\n 70\n4\n`+
`  9\n$AUNITS\n 70\n0\n`+
`  9\n$AUPREC\n 70\n4\n`+
`  9\n$INSUNITS\n 70\n5\n`+
`  9\n$MEASUREMENT\n 70\n1\n`+
`  9\n$TEXTSIZE\n 40\n0.35\n`+
`  9\n$TEXTSTYLE\n  7\nSTANDARD\n`+
`  9\n$CLAYER\n  8\n0\n`+
`  9\n$CELTYPE\n  6\nBYLAYER\n`+
`  9\n$CECOLOR\n 62\n256\n`+
`  9\n$ORTHOMODE\n 70\n0\n`+
`  9\n$WORLDVIEW\n 70\n1\n`+
`  0\nENDSEC\n`;

    const rawLayers = [{name:'0',aci:250}, ...this.extraLayers];
    const seenNames = new Set();
    const allLayers = rawLayers.filter(({name}) => {
      if(seenNames.has(name)) return false;
      seenNames.add(name); return true;
    });
    const layerEntries=allLayers.map(({name,aci})=>
      `  0\nLAYER\n  2\n${name}\n 70\n0\n 62\n${aci}\n  6\nCONTINUOUS\n`
    ).join('');

    const tables =
`  0\nSECTION\n  2\nTABLES\n`+
`  0\nTABLE\n  2\nVPORT\n 70\n1\n`+
`  0\nVPORT\n  2\n*ACTIVE\n 70\n0\n`+
` 10\n0.0\n 20\n0.0\n 11\n1.0\n 21\n1.0\n`+
` 12\n${f((x0+x1)/2)}\n 22\n${f((y0+y1)/2)}\n`+
` 13\n0.0\n 23\n0.0\n 14\n1.0\n 24\n1.0\n`+
` 15\n0.0\n 25\n0.0\n 16\n0.0\n 26\n0.0\n 36\n1.0\n`+
` 17\n0.0\n 27\n0.0\n 37\n0.0\n`+
` 40\n${f(Math.max(y1-y0,0.001))}\n 41\n1.0\n 42\n50.0\n 43\n0.0\n 44\n0.0\n`+
` 50\n0.0\n 51\n0.0\n 71\n0\n 72\n1000\n 73\n1\n 74\n3\n 75\n0\n 76\n0\n 77\n0\n 78\n0\n`+
`  0\nENDTAB\n`+
`  0\nTABLE\n  2\nLTYPE\n 70\n1\n`+
`  0\nLTYPE\n  2\nCONTINUOUS\n 70\n0\n  3\nSolid line\n 72\n65\n 73\n0\n 40\n0.0\n`+
`  0\nENDTAB\n`+
`  0\nTABLE\n  2\nLAYER\n 70\n${allLayers.length}\n`+
layerEntries+
`  0\nENDTAB\n`+
`  0\nTABLE\n  2\nSTYLE\n 70\n1\n`+
`  0\nSTYLE\n  2\nSTANDARD\n 70\n0\n 40\n0.0\n 41\n1.0\n 50\n0.0\n 71\n0\n 42\n0.35\n  3\ntxt\n  4\n\n`+
`  0\nENDTAB\n`+
`  0\nTABLE\n  2\nVIEW\n 70\n0\n  0\nENDTAB\n`+
`  0\nTABLE\n  2\nUCS\n 70\n0\n  0\nENDTAB\n`+
`  0\nTABLE\n  2\nAPPID\n 70\n1\n`+
`  0\nAPPID\n  2\nACAD\n 70\n0\n`+
`  0\nENDTAB\n`+
`  0\nENDSEC\n`;

    const blocks =
`  0\nSECTION\n  2\nBLOCKS\n`+
`  0\nBLOCK\n  8\n0\n  2\n$MODEL_SPACE\n 70\n0\n 10\n0.0\n 20\n0.0\n 30\n0.0\n  3\n$MODEL_SPACE\n  1\n\n`+
`  0\nENDBLK\n  8\n0\n`+
`  0\nENDSEC\n`;

    const entities =
`  0\nSECTION\n  2\nENTITIES\n`+
this.entities.join('')+
`  0\nENDSEC\n`;

    return header+tables+blocks+entities+`  0\nEOF\n`;
  }
}

// ── Color utilities ─────────────────────────────────────────
function parseCssColor(str){
  if(!str||str==='none'||str==='transparent') return null;
  str=str.trim().toLowerCase();
  const named={black:[0,0,0],white:[255,255,255],red:[255,0,0],green:[0,128,0],
    lime:[0,255,0],blue:[0,0,255],yellow:[255,255,0],cyan:[0,255,255],
    aqua:[0,255,255],magenta:[255,0,255],fuchsia:[255,0,255],orange:[255,165,0],
    gray:[128,128,128],grey:[128,128,128],darkgray:[169,169,169],lightgray:[211,211,211],
    brown:[165,42,42],purple:[128,0,128],navy:[0,0,128],teal:[0,128,128],
    maroon:[128,0,0],olive:[128,128,0],silver:[192,192,192],
    inherit:null,currentcolor:null};
  if(named[str]!==undefined) return named[str];
  let m=str.match(/^#([0-9a-f]{6})$/); if(m) return [parseInt(m[1].slice(0,2),16),parseInt(m[1].slice(2,4),16),parseInt(m[1].slice(4,6),16)];
  m=str.match(/^#([0-9a-f]{3})$/); if(m) return [parseInt(m[1][0]+m[1][0],16),parseInt(m[1][1]+m[1][1],16),parseInt(m[1][2]+m[1][2],16)];
  m=str.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/); if(m) return [+m[1],+m[2],+m[3]];
  m=str.match(/^rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*[\d.]+\s*\)$/); if(m) return [+m[1],+m[2],+m[3]];
  return null;
}

function parseSvgStyleSheet(doc){
  const rules=new Map();
  for(const styleEl of doc.querySelectorAll('style')){
    const css=styleEl.textContent||'';
    for(const [,sel,body] of css.matchAll(/([.#\w][^{]*?)\{([^}]*)\}/g)){
      const s=sel.trim();
      const props={};
      for(const [,p,v] of body.matchAll(/([\w-]+)\s*:\s*([^;]+)/g)){
        props[p.trim()]=v.trim();
      }
      rules.set(s, {...(rules.get(s)||{}), ...props});
    }
  }
  return rules;
}

let _cssRules=new Map();

const LAYER_CONFIG = {
  'ACERO_SUPERIOR': { name: 'ACERO_SUPERIOR', aci: 30  },
  'ACERO_INFERIOR': { name: 'ACERO_INFERIOR', aci: 72  },
  'ESTRIBOS':       { name: 'ESTRIBOS',        aci: 150 },
  'CONCRETO':       { name: 'CONCRETO',         aci: 11  },
  'COTAS':          { name: 'COTAS',            aci: 250 },
};

function rgbToIntent(r,g,b, tag=''){
  const rn=r/255, gn=g/255, bn=b/255;
  const max=Math.max(rn,gn,bn), min=Math.min(rn,gn,bn);
  const v=max, s=max===0?0:(max-min)/max;
  let h=0;
  if(s>0){
    const d=max-min;
    if(max===rn)      h=((gn-bn)/d+6)%6;
    else if(max===gn) h=(bn-rn)/d+2;
    else              h=(rn-gn)/d+4;
    h=h/6;
  }
  const hDeg=h*360;
  if(s<0.08 || v<0.12) return 'COTAS';
  if(hDeg<55 || hDeg>=330){
    if(tag==='rect'||tag==='path'||tag==='polygon'||tag==='polyline')
      return 'CONCRETO';
    return 'ACERO_SUPERIOR';
  }
  if(hDeg<150) return 'ACERO_INFERIOR';
  if(hDeg<200) return 'ESTRIBOS';
  if(hDeg<280) return 'ACERO_INFERIOR';
  return 'ACERO_SUPERIOR';
}

function getEffectiveColor(el){
  let node=el;
  while(node && node.tagName){
    const style=node.getAttribute('style')||'';
    const tag=(node.tagName||'').toLowerCase().replace(/.*:/,'');
    const getProp=(prop)=>{
      const m=style.match(new RegExp('(?:^|;)\\s*'+prop+'\\s*:\\s*([^;]+)','i'));
      if(m) return m[1].trim();
      const cls=(node.getAttribute('class')||'').trim().split(/\s+/);
      for(const c of cls){
        const rule=_cssRules.get('.'+c)||_cssRules.get(c);
        if(rule&&rule[prop]) return rule[prop].trim();
      }
      return (node.getAttribute(prop)||'').trim();
    };
    const stroke=getProp('stroke');
    const fill=getProp('fill');
    const isShape=['text','tspan','rect','circle','ellipse'].includes(tag);
    const isCircleOrEllipse = tag==='circle'||tag==='ellipse';
    const candidates = isShape ? [fill,stroke] : [stroke,fill];
    let bestRgb = null;
    for(const val of candidates){
      if(!val||val==='none'||val==='transparent'||val==='inherit'||val==='currentColor') continue;
      const rgb=parseCssColor(val);
      if(!rgb) continue;
      if(rgb[0]>240&&rgb[1]>240&&rgb[2]>240) continue;
      if(isCircleOrEllipse && !bestRgb){
        const rn2=rgb[0]/255,gn2=rgb[1]/255,bn2=rgb[2]/255;
        const mx=Math.max(rn2,gn2,bn2),mn=Math.min(rn2,gn2,bn2);
        const sat=mx===0?0:(mx-mn)/mx;
        if(sat<0.08){ bestRgb=null; continue; }
      }
      bestRgb=rgb; break;
    }
    if(bestRgb) return bestRgb;
    node=node.parentElement;
  }
  return null;
}

class LayerRegistry {
  constructor(){ this.seen=new Set(); }
  getLayer(rgb, tag=''){
    if(!rgb) return 'COTAS';
    const intent=rgbToIntent(...rgb, tag);
    this.seen.add(intent);
    return LAYER_CONFIG[intent].name;
  }
  getAci(rgb, tag=''){
    if(!rgb) return 250;
    return LAYER_CONFIG[rgbToIntent(...rgb, tag)].aci;
  }
  all(){
    return Object.values(LAYER_CONFIG).map(({name,aci})=>({name,aci}));
  }
}

// ── SVG → DXF converter ─────────────────────────────────────
const PX_TO_CM = 2.54 / 96;

class SVGConverter {
  constructor(flatness=0.5, flipY=true, realHeightCm=null, scaleFactor=1){
    this.dxf=new DXFWriter();
    this.flatness=flatness;
    this.flipY=flipY;
    this.svgH=0;
    this.log=[];
    this.layers=new LayerRegistry();
    this.unitScale=PX_TO_CM;
    this.realHeightCm = (realHeightCm && realHeightCm > 0) ? realHeightCm : null;
    this.scaleFactor = scaleFactor > 0 ? scaleFactor : 1;
  }

  flip(y){ return this.flipY ? this.svgH-y : y; }

  pt(x,y,mat){
    const [nx,ny]=applyMatrix(mat,x,y);
    return [nx*this.unitScale, this.flip(ny)*this.unitScale];
  }

  sc(v){ return v*this.unitScale; }
  addLog(msg,type='info'){ this.log.push({msg,type}); }

  _layer(el){
    const rgb=getEffectiveColor(el);
    const tag=el.tagName.replace(/.*:/,'').toLowerCase();
    return this.layers.getLayer(rgb, tag);
  }
  _aci(el){
    const rgb=getEffectiveColor(el);
    const tag=el.tagName.replace(/.*:/,'').toLowerCase();
    return this.layers.getAci(rgb, tag);
  }

  convert(svgText){
    const parser=new DOMParser();
    const doc=parser.parseFromString(svgText,'image/svg+xml');
    const errNode=doc.querySelector('parsererror');
    if(errNode) throw new Error('SVG inválido: '+errNode.textContent.slice(0,120));
    const root=doc.documentElement;

    _cssRules = parseSvgStyleSheet(doc);

    const vb=(root.getAttribute('viewBox')||'').trim().split(/[\s,]+/).map(Number);
    const wRaw=root.getAttribute('width')||'';
    const hRaw=root.getAttribute('height')||'';
    const wCm=parseLengthCm(wRaw);
    const hCm=parseLengthCm(hRaw);
    const wPx=parseLength(wRaw);
    const hPx=parseLength(hRaw);
    const hasVB=vb.length===4&&vb[2]>0&&vb[3]>0;

    this.svgH = hasVB ? vb[3] : (hPx||500);

    if(this.realHeightCm !== null && hasVB){
      this.unitScale = this.realHeightCm / vb[3];
    } else if(this.realHeightCm !== null && hPx>0){
      this.unitScale = this.realHeightCm / hPx;
    } else if(wCm!==null && hasVB){
      this.unitScale = wCm / vb[2];
    } else if(hCm!==null && hasVB){
      this.unitScale = hCm / vb[3];
    } else if(wCm!==null && wPx>0){
      this.unitScale = wCm / wPx;
    } else {
      this.unitScale = 2.54/96;
    }

    // Apply drawing scale factor (1:X → multiply coordinates by X)
    if(this.scaleFactor !== 1) this.unitScale *= this.scaleFactor;

    let mat = identity();
    if(hasVB && (vb[0] !== 0 || vb[1] !== 0)){
      mat = [[1,0,-vb[0]],[0,1,-vb[1]],[0,0,1]];
    }

    this._processElement(root,mat);
    this.dxf.setLayers(this.layers.all());
    return this.dxf;
  }

  _processElement(el, parentMat){
    const tag=el.tagName.replace(/.*:/,'').toLowerCase();
    if(['defs','style','script','filter','mask','clippath','symbol'].includes(tag)) return;

    const localMat=parseTransform(el.getAttribute('transform'));
    const mat=matMul2(parentMat,localMat);

    if(tag==='svg'||tag==='g'){
      for(const child of el.children) this._processElement(child,mat);
    } else if(tag==='line'){
      const layer=this._layer(el), aci=this._aci(el);
      const [ax,ay]=this.pt(+el.getAttribute('x1')||0,+el.getAttribute('y1')||0,mat);
      const [bx,by]=this.pt(+el.getAttribute('x2')||0,+el.getAttribute('y2')||0,mat);
      this.dxf.addLine(ax,ay,bx,by,layer,aci);
    } else if(tag==='rect'){
      const layer=this._layer(el), aci=this._aci(el);
      const x=+el.getAttribute('x')||0, y=+el.getAttribute('y')||0;
      const w=+el.getAttribute('width')||0, h=+el.getAttribute('height')||0;
      let rx=+el.getAttribute('rx')||0, ry=+el.getAttribute('ry')||0;
      if(!rx&&!ry){
        const corners=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
        this.dxf.addPolyline(corners.map(([px,py])=>this.pt(px,py,mat)),true,layer,aci);
      } else {
        rx=Math.min(rx||ry,w/2); ry=Math.min(ry||rx,h/2);
        const d=`M ${x+rx},${y} H ${x+w-rx} A ${rx},${ry} 0 0 1 ${x+w},${y+ry} V ${y+h-ry} A ${rx},${ry} 0 0 1 ${x+w-rx},${y+h} H ${x+rx} A ${rx},${ry} 0 0 1 ${x},${y+h-ry} V ${y+ry} A ${rx},${ry} 0 0 1 ${x+rx},${y} Z`;
        this._addPath(d,mat,layer,aci);
      }
    } else if(tag==='circle'){
      const layer=this._layer(el), aci=this._aci(el);
      const cx=+el.getAttribute('cx')||0, cy=+el.getAttribute('cy')||0, r=+el.getAttribute('r')||0;
      const [tcx,tcy]=this.pt(cx,cy,mat);
      const sx=Math.sqrt(mat[0][0]**2+mat[1][0]**2);
      this.dxf.addCircle(tcx,tcy,this.sc(r*sx),layer,aci);
    } else if(tag==='ellipse'){
      const layer=this._layer(el), aci=this._aci(el);
      const cx=+el.getAttribute('cx')||0, cy=+el.getAttribute('cy')||0;
      const rxv=+el.getAttribute('rx')||0, ryv=+el.getAttribute('ry')||0;
      const [tcx,tcy]=this.pt(cx,cy,mat);
      const sx=Math.sqrt(mat[0][0]**2+mat[1][0]**2), sy=Math.sqrt(mat[0][1]**2+mat[1][1]**2);
      const steps=Math.max(36,Math.ceil(2*Math.PI*Math.max(rxv*sx,ryv*sy)/2));
      const pts=[];
      for(let i=0;i<=steps;i++){
        const t=2*Math.PI*i/steps;
        pts.push(this.pt(cx+rxv*sx*Math.cos(t), cy+ryv*sy*Math.sin(t), mat));
      }
      this.dxf.addPolyline(pts,true,layer,aci);
    } else if(tag==='polyline'||tag==='polygon'){
      const layer=this._layer(el), aci=this._aci(el);
      const raw=(el.getAttribute('points')||'').trim().split(/[\s,]+/).map(Number).filter(v=>!isNaN(v));
      const pairs=[];
      for(let i=0;i<raw.length-1;i+=2) pairs.push([raw[i],raw[i+1]]);
      this.dxf.addPolyline(pairs.map(([px,py])=>this.pt(px,py,mat)),tag==='polygon',layer,aci);
    } else if(tag==='path'){
      const layer=this._layer(el), aci=this._aci(el);
      const d=el.getAttribute('d')||'';
      if(d) this._addPath(d,mat,layer,aci);
    } else if(tag==='text'){
      this._processText(el,mat);
    } else if(tag==='use'){
      for(const child of el.children) this._processElement(child,mat);
    }
  }

  _processText(el, mat){
    const baseX=+el.getAttribute('x')||0, baseY=+el.getAttribute('y')||0;
    const getFs=e=>{
      const style=e.getAttribute('style')||'';
      const m=style.match(/font-size\s*:\s*([^;]+)/);
      const raw=(m?m[1]:e.getAttribute('font-size')||'').trim();
      return raw?parseLength(raw):null;
    };
    const getAlign=(e, fallback=0)=>{
      const style=e.getAttribute('style')||'';
      const m=style.match(/text-anchor\s*:\s*([^;]+)/);
      const val=(m?m[1]:e.getAttribute('text-anchor')||'').trim().toLowerCase();
      if(val==='middle'||val==='center') return 1;
      if(val==='end'||val==='right') return 2;
      return fallback;
    };
    const isDimText=(t)=> /\d+\s*[x×xX]\s*\d+/.test(t);
    const layerAci=(e, textContent)=>{
      if(isDimText(textContent)){
        return { layer:'COTAS', aci: LAYER_CONFIG['COTAS'].aci };
      }
      return { layer:this._layer(e), aci:this._aci(e) };
    };
    const baseAlign = getAlign(el);
    const spans=[...el.querySelectorAll('tspan')];
    if(spans.length===0){
      const text=(el.textContent||'').trim();
      if(!text) return;
      const fs=getFs(el)||12;
      const align=baseAlign;
      const {layer,aci}=layerAci(el,text);
      const [tx,ty]=this.pt(baseX,baseY,mat);
      this.dxf.addText(tx,ty,text,this.sc(fs),layer,aci,align);
    } else {
      for(const span of spans){
        const text=(span.textContent||'').trim();
        if(!text) continue;
        const x=+span.getAttribute('x')||baseX;
        const y=+span.getAttribute('y')||baseY;
        const fs=getFs(span)||getFs(el)||12;
        const align=getAlign(span, baseAlign);
        const {layer,aci}=layerAci(span,text);
        const [tx,ty]=this.pt(x,y,mat);
        this.dxf.addText(tx,ty,text,this.sc(fs),layer,aci,align);
      }
    }
  }

  _addPath(d,mat,layer='0',aci=7){
    const polylines=parsePathToPolylines(d,this.flatness);
    for(const pl of polylines){
      if(pl.length<2) continue;
      this.dxf.addPolyline(pl.map(([x,y])=>this.pt(x,y,mat)),false,layer,aci);
    }
  }
}

// ── Public API ──────────────────────────────────────────────
export { SVGConverter, DXFWriter }

/**
 * Convert an SVG string to a DXF string.
 * @param {string} svgText - SVG markup
 * @param {object} opts - { flatness, flipY, realHeightCm }
 * @returns {string} DXF file content
 */
export function svgToDxf(svgText, opts = {}) {
  const { flatness = 0.5, flipY = true, realHeightCm = null, scaleFactor = 1 } = opts
  const conv = new SVGConverter(flatness, flipY, realHeightCm, scaleFactor)
  const dxf = conv.convert(svgText)
  return dxf.build()
}
