/* NutriMachata v132 · Motor PDF unificado
   ---------------------------------------------------------------------------
   Todos los PDF del sistema (facturas, recibos, cotizaciones, estados de cuenta,
   reportes contables y de caja, cierres, saldos, historia clínica, evaluaciones,
   reportes clínicos y dietas) usan html2pdf().set().from().save()/toPdf()/get('pdf').
   Este módulo reemplaza ese motor por uno compatible que:
     1. Renderiza el documento en un iframe aislado con el ancho exacto del área
        imprimible de A4 (sin barra lateral, sin desplazamiento, sin recortes).
     2. Si una tabla es más ancha que la página, reduce el documento para que quepa
        completo (antes se cortaba el lado izquierdo o derecho).
     3. Corta las páginas en lugares seguros: nunca parte una línea de texto, una
        fila de tabla, una tarjeta o un bloque marcado como "no dividir"; los títulos
        no quedan solos al final de una página.
     4. Conserva gráficas (canvas) y valores de formularios.
     5. Mantiene la API de html2pdf: los módulos que agregan su propio pie de página
        con get('pdf') siguen funcionando igual. En .save() directo agrega numeración
        "Página X de Y" solo a documentos de varias páginas.
   Si algo falla, usa automáticamente el html2pdf original (nunca deja al usuario sin PDF).
   Librerías: js/vendor/html2canvas.min.js (1.4.1) y js/vendor/jspdf.umd.min.js (2.5.1),
   locales y cargadas solo la primera vez que se genera un PDF. */
(function(){
'use strict';
const ORIGINAL=window.html2pdf;
if(typeof ORIGINAL!=='function'||ORIGINAL.__nmEngine)return;
const MM=96/25.4;              // px CSS por milímetro
const SCALE=2.4;               // resolución de captura (~230 ppp): texto nítido
const MAX_CANVAS_H=28000;      // límite seguro de altura de canvas en navegadores
const MAX_CANVAS_AREA=1.6e7;   // límite de Safari/iOS (16,7 M px): si se supera, se captura página por página
const DEFAULT_AVOID=['tr','img','svg','canvas','figure','table thead','.card','.kpi','.metric-card','.measure-box','.obs-box',
 '.nm-pdf-card','.nm-pdf-kpi','.nm92-pdf-card','.nm92-pdf-kpi','.nm92-pdf-alert','.nm92-exec-head','.nm92-patient-band',
 '.invoice-party','.invoice-print-summary','.invoice-print-note','.v39-head','.v39-party','.v39-summary','.v39-bottom',
 '[class*="-card"]','[class*="-kpi"]','[class*="summary"]','[class*="signature"]','[class*="firma"]','.avoid-break','.no-break','[data-pdf-keep]'];

/* ---------- carga perezosa de librerías locales ---------- */
const libBase=(()=>{try{const s=[...document.scripts].find(x=>/app\.bundle\.js/.test(x.src));return s?s.src.replace(/app\.bundle\.js.*$/,'vendor/'):'js/vendor/'}catch(_){return 'js/vendor/'}})();
const loaded={};
function loadScript(name){
 if(loaded[name])return loaded[name];
 loaded[name]=new Promise((res,rej)=>{const s=document.createElement('script');s.src=libBase+name+'?v=132';s.onload=()=>res();s.onerror=()=>{delete loaded[name];rej(new Error('No se pudo cargar '+name))};document.head.appendChild(s)});
 return loaded[name];
}
async function libs(){
 if(!window.html2canvas)await loadScript('html2canvas.min.js');
 if(!window.jspdf?.jsPDF)await loadScript('jspdf.umd.min.js');
 return {h2c:window.html2canvas,JsPDF:window.jspdf.jsPDF};
}

/* ---------- opciones (semántica html2pdf) ---------- */
function opts(o){
 o=o||{};let m=o.margin??10;if(!Array.isArray(m))m=[m,m,m,m];else if(m.length===2)m=[m[0],m[1],m[0],m[1]];
 const [top,left,bottom,right]=m.map(Number);
 const jp=o.jsPDF||{};const orientation=String(jp.orientation||'portrait').toLowerCase().startsWith('l')?'landscape':'portrait';
 const land=orientation==='landscape',pageW=land?297:210,pageH=land?210:297;
 const avoid=[...DEFAULT_AVOID,...((o.pagebreak&&[].concat(o.pagebreak.avoid||[]))||[])];
 const before=[].concat(o.pagebreak?.before||[]),after=[].concat(o.pagebreak?.after||[]);
 return {top,left,bottom,right,orientation,pageW,pageH,cw:pageW-left-right,ch:pageH-top-bottom,filename:o.filename||'NutriMachata.pdf',
  windowWidth:Number(o.html2canvas?.windowWidth)||1280,quality:Math.min(.98,Math.max(.9,Number(o.image?.quality)||.95)),avoid,before,after};
}

/* ---------- documento aislado ---------- */
function headAssets(source){
 // Todas las hojas de estilo activas (también las <style> que los módulos insertan en el cuerpo,
 // p. ej. el reporte clínico, cuyo estilo vive junto al reporte y no dentro de él).
 const parts=[];
 document.querySelectorAll('link[rel="stylesheet"]').forEach(l=>{if(l.href)parts.push(`<link rel="stylesheet" href="${l.href}">`)});
 document.querySelectorAll('style').forEach(s=>{if(source&&source.nodeType===1&&source.contains(s))return;if(s.closest('#nm-pdf-root'))return;parts.push(`<style>${s.textContent}</style>`)});
 return parts.join('');
}
const RESET=`html,body{margin:0!important;padding:0!important;background:#fff!important;display:block!important;overflow:visible!important;height:auto!important;min-height:0!important;width:auto!important;transform:none!important}
body{-webkit-print-color-adjust:exact;print-color-adjust:exact;color:#1f2a1c}
#nm-pdf-root{position:relative;display:block;background:#fff;box-sizing:border-box;overflow:visible}
#nm-pdf-root>*:first-child{margin-top:0!important}
#nm-pdf-root *{animation:none!important;transition:none!important}
#nm-pdf-root .no-pdf,#nm-pdf-root [data-pdf-private="true"],#nm-pdf-root .report-screen-only,#nm-pdf-root .html2pdf__ignore{display:none!important}
#nm-pdf-root img{max-width:100%}
#nm-pdf-root table{border-collapse:collapse}`;

function copyLiveState(src,clone){
 const sc=src.querySelectorAll?[...src.querySelectorAll('canvas')]:[],cc=clone.querySelectorAll?[...clone.querySelectorAll('canvas')]:[];
 if(src.tagName==='CANVAS'){sc.unshift(src);cc.unshift(clone)}
 cc.forEach((c,i)=>{const o=sc[i];if(!o)return;try{const img=document.createElement('img');img.src=o.toDataURL('image/png');const r=o.getBoundingClientRect();img.style.cssText=(o.getAttribute('style')||'')+`;width:${r.width||o.width}px;height:${r.height||o.height}px;max-width:100%`;img.className=o.className;c.replaceWith(img)}catch(_){}});
 const fs=src.querySelectorAll?[...src.querySelectorAll('input,textarea,select')]:[],fc=clone.querySelectorAll?[...clone.querySelectorAll('input,textarea,select')]:[];
 fc.forEach((f,i)=>{const o=fs[i];if(!o)return;if(f.tagName==='TEXTAREA')f.textContent=o.value;else if(f.tagName==='SELECT'){[...f.options].forEach((op,j)=>{if(o.options[j]?.selected)op.setAttribute('selected','selected')})}else if(o.type==='checkbox'||o.type==='radio'){if(o.checked)f.setAttribute('checked','checked')}else f.setAttribute('value',o.value)});
}
async function waitAssets(doc){
 const links=[...doc.querySelectorAll('link[rel="stylesheet"]')];
 await Promise.all(links.map(l=>l.sheet?null:new Promise(r=>{l.onload=l.onerror=r;setTimeout(r,4000)})));
 const imgs=[...doc.images];
 await Promise.all(imgs.map(img=>img.complete&&img.naturalWidth?null:new Promise(r=>{img.onload=img.onerror=r;setTimeout(r,4000)})));
 await Promise.all(imgs.map(img=>img.decode?img.decode().catch(()=>{}):null));
 try{await Promise.race([doc.fonts?.ready,new Promise(r=>setTimeout(r,3000))])}catch(_){}
 await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
}
// Imágenes con mucho margen transparente (el logo es 2000×2000 con el dibujo en ~45 % del alto):
// se recortan para que el logo se vea con su tamaño real y nítido, sin deformarse.
const trimCache=new Map();
function trimKey(src){return src.length+':'+src.slice(0,64)+src.slice(-64)}
async function trimmedSrc(img){
 const src=img.currentSrc||img.src;if(!src||img.naturalWidth<160||img.naturalHeight<160)return null;
 const key=trimKey(src);if(trimCache.has(key))return trimCache.get(key);
 let out=null;
 try{
  const W=img.naturalWidth,H=img.naturalHeight,k=Math.min(1,320/Math.max(W,H)),w=Math.max(1,Math.round(W*k)),h=Math.max(1,Math.round(H*k));
  const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.drawImage(img,0,0,w,h);
  const d=x.getImageData(0,0,w,h).data;let x0=w,y0=h,x1=-1,y1=-1;
  for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){if(d[(yy*w+xx)*4+3]>12){if(xx<x0)x0=xx;if(xx>x1)x1=xx;if(yy<y0)y0=yy;if(yy>y1)y1=yy}}
  if(x1>=0&&((x1-x0+1)<w*0.85||(y1-y0+1)<h*0.85)){
   const pad=Math.round(Math.max(x1-x0,y1-y0)*0.04/k);
   const sx=Math.max(0,Math.floor(x0/k)-pad),sy=Math.max(0,Math.floor(y0/k)-pad),sw=Math.min(W-sx,Math.ceil((x1-x0+1)/k)+2*pad),sh=Math.min(H-sy,Math.ceil((y1-y0+1)/k)+2*pad);
   const r=Math.min(1,1400/sw),cc=document.createElement('canvas');cc.width=Math.round(sw*r);cc.height=Math.round(sh*r);cc.getContext('2d').drawImage(img,sx,sy,sw,sh,0,0,cc.width,cc.height);
   out={data:cc.toDataURL('image/png'),ratio:sw/sh};
  }
 }catch(_){out=null}
 trimCache.set(key,out);return out;
}
async function trimImages(doc){
 for(const img of [...doc.images]){
  const t=await trimmedSrc(img);if(!t)continue;
  img.style.objectFit='contain';img.src=t.data;
  try{await img.decode()}catch(_){}
 }
}
// Encabezados de tabla alineados con su columna (montos a la derecha, cantidades al centro).
function alignHeaders(doc){
 const win=doc.defaultView;
 doc.querySelectorAll('#nm-pdf-root table').forEach(t=>{
  const head=t.tHead?.rows?.[0]||([...t.rows].find(r=>r.querySelector('th')&&!r.querySelector('td')));if(!head)return;
  const body=[...t.rows].filter(r=>r!==head&&r.cells.length===head.cells.length&&!r.querySelector('th'));if(!body.length)return;
  [...head.cells].forEach((th,i)=>{if(th.colSpan>1)return;const al=new Set(body.map(r=>win.getComputedStyle(r.cells[i]).textAlign).map(a=>a==='end'?'right':a==='start'?'left':a));
   if(al.size===1){const a=[...al][0];if((a==='right'||a==='center')&&win.getComputedStyle(th).textAlign!==a)th.style.setProperty('text-align',a,'important')}});
 });
}
async function trimmedLogo(){
 const src=typeof NUTRIMACHATA_REPORT_LOGO!=='undefined'?NUTRIMACHATA_REPORT_LOGO:'';if(!src)return null;
 const img=new Image();img.src=src;try{await img.decode()}catch(_){return null}
 return (await trimmedSrc(img))||{data:src,ratio:img.naturalWidth/img.naturalHeight};
}
async function stage(source,o){
 const frame=document.createElement('iframe');
 frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;
 const winW=Math.max(o.windowWidth,Math.round(o.cw*MM)+40);
 frame.style.cssText=`position:fixed;left:-30000px;top:0;width:${winW}px;height:1200px;border:0;opacity:0;pointer-events:none;z-index:-1`;
 document.body.appendChild(frame);
 const doc=frame.contentDocument;
 doc.open();doc.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><base href="${location.href.replace(/[#?].*$/,'')}">${headAssets(source)}<style>${RESET}</style></head><body><div id="nm-pdf-root" style="width:${(o.cw*MM).toFixed(2)}px"></div></body></html>`);doc.close();
 const root=doc.getElementById('nm-pdf-root');
 let node;
 if(typeof source==='string'){root.innerHTML=source;node=root}
 else{const clone=source.cloneNode(true);copyLiveState(source,clone);node=doc.importNode(clone,true);root.appendChild(node)}
 // El documento debe ocupar el área imprimible: anula centrados y anchos que lo desplazaban fuera de la página.
 if(node!==root&&node.style){node.style.setProperty('margin-left','0','important');node.style.setProperty('margin-right','0','important');node.style.setProperty('max-width','100%','important');node.style.setProperty('box-sizing','border-box','important');
  const w=parseFloat(doc.defaultView.getComputedStyle(node).width);if(w>o.cw*MM+1||/mm$/.test(node.style.width||''))node.style.setProperty('width','100%','important');}
 await waitAssets(doc);
 await trimImages(doc);
 alignHeaders(doc);
 await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
 return {frame,doc,root,winW};
}

/* ---------- cortes de página seguros ---------- */
function collectLayout(doc,root,pageH,o){
 const rt=root.getBoundingClientRect().top;
 const atoms=[],lines=[],forced=new Set(),keep=[],tables=[];
 const rel=r=>[r.top-rt,r.bottom-rt];
 const win=doc.defaultView;
 const sel=o.avoid.filter(Boolean).join(',');
 try{root.querySelectorAll(sel).forEach(el=>{const r=el.getBoundingClientRect();if(r.height>2&&r.height<pageH*0.92)atoms.push(rel(r))})}catch(_){}
 // Líneas de texto: nunca se corta por la mitad de una línea.
 const tw=doc.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.nodeValue.trim()?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT});
 const range=doc.createRange();let n;
 while((n=tw.nextNode())){range.selectNodeContents(n);for(const r of range.getClientRects()){if(r.height>0)lines.push(rel(r))}}
 // Títulos: se mantienen con el contenido siguiente.
 root.querySelectorAll('h1,h2,h3,h4,h5,h6,thead,[class*="title"],[class*="section-head"],[class*="-head"],header,legend,caption').forEach(el=>{const r=el.getBoundingClientRect();if(r.height>2&&r.height<160)keep.push([r.top-rt,r.bottom-rt+Math.min(70,pageH*0.08)])});
 // Tablas: su encabezado se repite en cada página donde continúan.
 root.querySelectorAll('table').forEach(t=>{const tr=t.getBoundingClientRect();if(tr.height<pageH*0.25)return;let h=t.tHead;if(!h){const first=t.rows[0];if(first&&first.querySelector('th')&&!first.querySelector('td'))h=first}if(!h)return;const hr=h.getBoundingClientRect();if(hr.height>2&&hr.height<pageH*0.2)tables.push({top:tr.top-rt,bottom:tr.bottom-rt,hTop:hr.top-rt,hBottom:hr.bottom-rt})});
 // Saltos forzados (CSS break/page-break, clase html2pdf__page-break y opciones before/after).
 root.querySelectorAll('*').forEach(el=>{const cs=win.getComputedStyle(el);if(cs.display==='none')return;const r=el.getBoundingClientRect();
  if(el.classList.contains('html2pdf__page-break')||/page|always/.test(cs.breakBefore+' '+cs.pageBreakBefore)||o.before.some(x=>{try{return el.matches(x)}catch(_){return false}}))forced.add(Math.round(r.top-rt));
  if(/page|always/.test(cs.breakAfter+' '+cs.pageBreakAfter)||o.after.some(x=>{try{return el.matches(x)}catch(_){return false}}))forced.add(Math.round(r.bottom-rt));});
 return {atoms,lines,keep,tables,forced:[...forced].sort((x,y)=>x-y)};
}
function computeBreaks(L,totalH,pageH){
 const forcedList=L.forced.filter(y=>y>2&&y<totalH-2);
 const settle=(y,start,sets)=>{for(let k=0;k<200;k++){let moved=false;for(const set of sets)for(const [a,b] of set){if(a<y-0.5&&b>y+0.5&&a>start+2){y=a;moved=true}}if(!moved)break}return y};
 const pages=[];let start=0,guard=0;
 while(start<totalH-1&&guard++<800){
  const t=start>0?L.tables.find(t=>start>=t.hBottom-1&&start<t.bottom-4):null;
  const head=t?[t.hTop,t.hBottom]:null,cap=pageH-(head?head[1]-head[0]:0);
  let end=start+cap;
  const f=forcedList.find(y=>y>start+20&&y<=end);
  if(f){pages.push({a:start,b:f,head});start=f;continue}
  if(end>=totalH){pages.push({a:start,b:totalH,head});break}
  let y=settle(end,start,[L.atoms,L.keep,L.lines]);
  if(y-start<cap*0.35)y=settle(end,start,[L.lines]);   // bloque más alto que la página: al menos respetar líneas
  if(y-start<cap*0.2)y=end;
  pages.push({a:start,b:y,head});start=y;
 }
 // Espacio en blanco al inicio de una página: se omite.
 return pages;
}

/* ---------- render principal ---------- */
async function render(source,options){
 const o=opts(options);
 const {h2c,JsPDF}=await libs();
 const st=await stage(source,o);
 try{
  const {doc,root,winW}=st;
  const capW=Math.max(Math.ceil(o.cw*MM),Math.ceil(root.scrollWidth));
  if(capW>o.cw*MM+1){root.style.width=capW+'px';await new Promise(r=>requestAnimationFrame(r))}
  const totalH=Math.ceil(Math.max(root.scrollHeight,root.getBoundingClientRect().height));
  const pxPerMm=capW/o.cw;
  // Ajuste fino: si la última página quedaría casi vacía, se reduce el contenido hasta un 6 %.
  let fit=1,pageHpx=o.ch*pxPerMm,L=collectLayout(doc,root,pageHpx,o),pages=computeBreaks(L,totalH,pageHpx);
  const tail=p=>p.length>1&&(p[p.length-1].b-p[p.length-1].a)<pageHpx*0.15;
  if(tail(pages)){for(const f of [0.97,0.94]){const ph=o.ch*pxPerMm/f,Lf=collectLayout(doc,root,ph,o),pf=computeBreaks(Lf,totalH,ph);if(pf.length<pages.length){fit=f;pageHpx=ph;pages=pf;break}}}
  const pdf=new JsPDF({unit:'mm',format:'a4',orientation:o.orientation,compress:true});
  const base={scale:SCALE,backgroundColor:'#ffffff',useCORS:true,allowTaint:true,logging:false,windowWidth:winW,windowHeight:Math.max(1200,totalH+40),scrollX:0,scrollY:0,width:capW};
  const rt=root.getBoundingClientRect(),ox=rt.left+doc.defaultView.scrollX,oy=rt.top+doc.defaultView.scrollY;
  let full=null;
  if(totalH*SCALE<=MAX_CANVAS_H&&capW*SCALE*totalH*SCALE<=MAX_CANVAS_AREA)full=await h2c(root,{...base,height:totalH,x:ox,y:oy});
  const headCache=new Map();
  const grab=async(a,h)=>{if(full){const c=document.createElement('canvas');c.width=full.width;c.height=Math.max(1,Math.round(h*SCALE));const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(full,0,Math.round(a*SCALE),full.width,c.height,0,0,full.width,c.height);return c}
   return h2c(root,{...base,height:h,x:ox,y:oy+a})};
  const drawW=o.cw*fit,dx=o.left+(o.cw-drawW)/2,mmPerPx=drawW/capW;
  for(let i=0;i<pages.length;i++){
   const {a,b,head}=pages[i],h=Math.max(1,b-a);
   if(i>0)pdf.addPage('a4',o.orientation);
   let y=o.top;
   if(head){const k=head.join(':');if(!headCache.has(k))headCache.set(k,await grab(head[0],head[1]-head[0]));const hc=headCache.get(k);const hh=(head[1]-head[0])*mmPerPx;pdf.addImage(hc.toDataURL('image/jpeg',o.quality),'JPEG',dx,y,drawW,hh,'h'+k,'FAST');y+=hh}
   const slice=await grab(a,h);
   pdf.addImage(slice.toDataURL('image/jpeg',o.quality),'JPEG',dx,y,drawW,h*mmPerPx,undefined,'FAST');
  }
  return pdf;
 }finally{st.frame.remove()}
}
function stampPages(pdf,o){
 const n=pdf.internal.getNumberOfPages();if(n<2)return;
 const id=typeof nmDocumentIdentity==='function'?nmDocumentIdentity():{};
 const y=o.pageH-Math.max(3.2,Math.min(6,o.bottom/2)),right=o.pageW-o.right;
 for(let p=1;p<=n;p++){pdf.setPage(p);pdf.setFont('helvetica','normal');pdf.setFontSize(7);pdf.setTextColor(120);pdf.text(`${id.clinic||'NutriMachata'} · ${id.doctor||'Dra. María Alejandra Chalas'}`,o.left,y);pdf.text(`Página ${p} de ${n}`,right,y,{align:'right'})}
}

/* ---------- API compatible con html2pdf ---------- */
function Worker(){this._opt={};this._src=null;this._pdf=null;this._p=Promise.resolve();this._fallback=null}
Worker.prototype._chain=function(fn){this._p=this._p.then(()=>fn.call(this));return this};
Worker.prototype.set=function(opt){return this._chain(()=>{this._opt={...this._opt,...(opt||{})}})};
Worker.prototype.from=function(src){return this._chain(()=>{this._src=src})};
Worker.prototype._build=async function(){
 if(this._pdf||this._fallback)return;
 try{this._pdf=await render(this._src,this._opt)}
 catch(e){console.warn('[PDF v132] Se usa el motor anterior:',e?.message||e);this._fallback=ORIGINAL().set(this._opt).from(this._src)}
};
Worker.prototype.toPdf=function(){return this._chain(()=>this._build())};
Worker.prototype.get=function(key,cb){
 const p=this._p.then(async()=>{await this._build();let v;if(this._fallback)v=await this._fallback.toPdf().get(key);else v=key==='pdf'?this._pdf:undefined;return cb?cb(v):v});
 return p;
};
Worker.prototype.save=function(filename){
 return this._chain(async()=>{
  await this._build();const name=filename||this._opt.filename||'NutriMachata.pdf';
  if(this._fallback){await this._fallback.save(name);return}
  stampPages(this._pdf,opts(this._opt));this._pdf.save(name);
 });
};
Worker.prototype.outputPdf=function(type,o){return this._p.then(async()=>{await this._build();if(this._fallback)return this._fallback.outputPdf(type,o);return this._pdf.output(type,o)})};
Worker.prototype.output=Worker.prototype.outputPdf;
Worker.prototype.then=function(a,b){return this._p.then(a,b)};
Worker.prototype.catch=function(b){return this._p.catch(b)};
Worker.prototype.finally=function(f){return this._p.finally(f)};

function nmHtml2pdf(src,opt){const w=new Worker();if(opt)w.set(opt);if(src)return w.from(src).save();return w}
nmHtml2pdf.__nmEngine=true;nmHtml2pdf.original=ORIGINAL;nmHtml2pdf.Worker=ORIGINAL.Worker;
window.html2pdf=nmHtml2pdf;
window.NMPdfEngine132={render,opts,computeBreaks,collectLayout,libs,trimmedLogo};
})();
