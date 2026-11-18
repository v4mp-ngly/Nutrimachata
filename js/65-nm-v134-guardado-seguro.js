/* NutriMachata v134 · Guardado a prueba de fallos
   1. Indicador global de guardado (Guardando… / Guardado ✓ / No se guardó) para TODA escritura a Supabase,
      sin importar el módulo que la haga (supa, Facturación, Consentimientos, Historia clínica).
   2. Aviso del navegador si se intenta cerrar/recargar con un guardado en curso o un formulario con cambios.
   3. Reintento automático SOLO de escrituras idempotentes (PATCH, DELETE, upsert on_conflict) cuando la
      conexión se corta. Los INSERT y RPC nunca se repiten a ciegas (lo controla nmGuardedWrite).
   4. Borradores temporales de formularios abiertos (sessionStorage de la pestaña, NO es base de datos):
      si el guardado falla, la sesión vence o el modal se cierra por accidente, los datos se pueden recuperar.
   No cambia estilos existentes: solo agrega el indicador y un aviso dentro del modal. */
(function(){
'use strict';
const REST='/rest/v1/';
const isSupa=u=>typeof SUPA_URL==='string'&&String(u).indexOf(SUPA_URL.replace(/\/$/,''))===0;
const isWrite=(u,m)=>{m=String(m||'GET').toUpperCase();if(m==='GET'||m==='HEAD'||m==='OPTIONS')return false;const s=String(u);return s.includes(REST)||/\/auth\/v1\/(signup|user)\b/.test(s)};

/* ---------- 1. Indicador ---------- */
const state={pending:0,lastOk:0,lastErr:null,hideT:null};
let pill=null;
function ensurePill(){
  if(pill&&document.body.contains(pill))return pill;
  pill=document.createElement('div');pill.id='nm134-save-status';pill.setAttribute('role','status');pill.setAttribute('aria-live','polite');
  pill.innerHTML='<span class="nm134-dot"></span><span class="nm134-txt"></span>';
  document.body.appendChild(pill);return pill;
}
function hhmm(t){const d=new Date(t);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}
function paint(){
  if(!document.body)return;const p=ensurePill();clearTimeout(state.hideT);
  p.classList.remove('is-saving','is-ok','is-err','show');
  if(state.pending>0){p.classList.add('show','is-saving');p.querySelector('.nm134-txt').textContent=state.pending>1?`Guardando ${state.pending} cambios…`:'Guardando…';return}
  if(state.lastErr){p.classList.add('show','is-err');p.querySelector('.nm134-txt').textContent='No se guardó · '+state.lastErr;state.hideT=setTimeout(()=>{state.lastErr=null;p.classList.remove('show')},9000);return}
  if(state.lastOk){p.classList.add('show','is-ok');p.querySelector('.nm134-txt').textContent='Guardado en Supabase ✓ '+hhmm(state.lastOk);state.hideT=setTimeout(()=>p.classList.remove('show'),2600)}
}
function errText(status,body){
  if(status===0)return navigator.onLine===false?'sin conexión a Internet':'conexión interrumpida';
  if(status===401)return 'sesión vencida';
  if(status===403)return 'sin permiso';
  if(status===409)return 'registro duplicado';
  if(status>=500)return 'el servidor no respondió';
  const m=body&&typeof body==='object'?(body.message||body.msg||''):'';
  return m?String(m).slice(0,80):'revisa los datos';
}
const NM134={pending:()=>state.pending,writes:[]};
window.NM134Guardado=NM134;
const origFetch=window.fetch.bind(window);
window.fetch=async function(input,init){
  const url=typeof input==='string'?input:(input&&input.url)||'';
  const method=(init&&init.method)||(input&&input.method)||'GET';
  if(!isSupa(url)||!isWrite(url,method))return origFetch(input,init);
  state.pending++;paint();const rec={method:String(method).toUpperCase(),path:String(url).split(REST)[1]?.split('?')[0]||String(url).split('/').slice(-1)[0],t:Date.now(),status:null};NM134.writes.push(rec);if(NM134.writes.length>60)NM134.writes.shift();
  try{
    const res=await origFetch(input,init);
    rec.status=res.status;
    // 401 se renueva y repite automáticamente; no es un fallo definitivo.
    if(res.ok){state.lastOk=Date.now();state.lastErr=null;markSaved()}
    else if(res.status!==401){let body=null;try{body=await res.clone().json()}catch(_){}state.lastErr=errText(res.status,body)}
    return res;
  }catch(e){rec.status=0;state.lastErr=errText(0);throw e}
  finally{state.pending=Math.max(0,state.pending-1);paint()}
};

/* ---------- 3. Reintento seguro de escrituras idempotentes ---------- */
if(typeof window.nmGuardedWrite==='function'&&!window.nmGuardedWrite.__nm134){
  const base=window.nmGuardedWrite;
  const wrapped=async function(args){
    const idem=['PATCH','DELETE'].includes(args.method)||/[?&]on_conflict=/.test(String(args.path||''));
    for(let attempt=0;;attempt++){
      try{return await base(args)}
      catch(e){
        const transient=e&&(e.code==='WRITE_UNCERTAIN'||e.code==='NETWORK_TIMEOUT'||e.kind==='network')&&e.code!=='NETWORK_OFFLINE';
        if(!idem||!transient||attempt>=2||navigator.onLine===false)throw e;
        console.info('[NutriMachata v134] Reintentando escritura idempotente',args.method,String(args.path).split('?')[0],'intento',attempt+2);
        await new Promise(r=>setTimeout(r,1200*(attempt+1)));
      }
    }
  };
  wrapped.__nm134=true;
  window.nmGuardedWrite=wrapped;
  try{nmGuardedWrite=wrapped}catch(_){}
}

/* ---------- 4. Borradores de formularios ---------- */
const DKEY='nm134_draft_';
const TTL=12*60*60*1000;
const SKIP_MODALS=new Set(['modal-wizard','login-modal','modal-confirm','confirm-modal']); // el asistente de HC ya tiene borrador propio
const fieldsOf=m=>[...m.querySelectorAll('input[id],textarea[id],select[id]')].filter(el=>{const t=String(el.type||'').toLowerCase();return !['password','file','hidden','submit','button'].includes(t)&&!/search/i.test(el.id)});
const owner=()=>{try{return String(DB?.currentUser?.email||DB?.currentUser?.id||'')}catch(_){return ''}};
const modalKey=m=>m&&m.id&&!SKIP_MODALS.has(m.id)?DKEY+m.id:null;
const openModals=()=>[...document.querySelectorAll('.modal-overlay.open,.modal-overlay[style*="flex"]')].filter(m=>m.id&&!SKIP_MODALS.has(m.id));
const baseline=new WeakMap();
function snapshot(m){const o={};fieldsOf(m).forEach(el=>{o[el.id]=el.type==='checkbox'||el.type==='radio'?(el.checked?'1':''):el.value});return o}
function isDirty(m){const b=baseline.get(m);if(!b)return false;const s=snapshot(m);return Object.keys(s).some(k=>k in b&&s[k]!==b[k])}
function saveDraft(m){
  const k=modalKey(m);if(!k||!isDirty(m))return;
  try{sessionStorage.setItem(k,JSON.stringify({t:Date.now(),owner:owner(),title:(m.querySelector('.modal-title')?.textContent||'').trim().slice(0,80),values:snapshot(m)}))}catch(_){}
}
function readDraft(m){const k=modalKey(m);if(!k)return null;try{const d=JSON.parse(sessionStorage.getItem(k)||'null');if(!d||Date.now()-d.t>TTL||d.owner!==owner()){sessionStorage.removeItem(k);return null}return d}catch(_){return null}}
function clearDraft(m){const k=modalKey(m);if(k)try{sessionStorage.removeItem(k)}catch(_){}}
function restore(m,d){
  let n=0;Object.entries(d.values||{}).forEach(([id,v])=>{const el=m.querySelector('#'+CSS.escape(id));if(!el)return;
    if(el.type==='checkbox'||el.type==='radio'){if(el.checked!==(v==='1')){el.checked=v==='1';n++}}
    else if(el.value!==v){if(el.tagName==='SELECT'&&![...el.options].some(o=>o.value===v))return;el.value=v;n++}
    el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
  return n;
}
function offerRestore(m){
  const d=readDraft(m);if(!d||m.querySelector('.nm134-draft'))return;
  // Solo se ofrece si los campos actuales difieren del borrador (p. ej. formulario nuevo vacío).
  const cur=snapshot(m);if(!Object.entries(d.values).some(([k,v])=>k in cur&&cur[k]!==v&&v!==''))return;
  const box=document.createElement('div');box.className='nm134-draft';
  box.innerHTML=`<div><b>Hay datos sin guardar de las ${hhmm(d.t)}</b><small>Se conservaron en esta pestaña porque el formulario se cerró o el guardado no se completó.</small></div><div class="nm134-draft-actions"><button type="button" class="btn btn-olive btn-sm" data-a="r">Recuperar</button><button type="button" class="btn btn-outline btn-sm" data-a="d">Descartar</button></div>`;
  const body=m.querySelector('.modal-body')||m.querySelector('.modal')||m;body.insertBefore(box,body.firstChild);
  box.addEventListener('click',e=>{const a=e.target.closest('[data-a]')?.dataset.a;if(!a)return;
    if(a==='r'){const n=restore(m,d);notify?.(n?'Datos recuperados. Revísalos y guarda.':'No había campos para recuperar.',n?'success':'info')}
    else clearDraft(m);
    box.remove();});
}
/* Un guardado confirmado mientras el modal estaba abierto marca el borrador para limpieza al cerrarse. */
const savedWhileOpen=new WeakSet();
function markSaved(){openModals().forEach(m=>savedWhileOpen.add(m))}
function onOpen(m){if(!modalKey(m))return;savedWhileOpen.delete(m);setTimeout(()=>{if(!m.isConnected)return;baseline.set(m,snapshot(m));offerRestore(m)},350)}
function onClose(m){if(!modalKey(m))return;if(savedWhileOpen.has(m)){clearDraft(m);savedWhileOpen.delete(m)}else saveDraft(m);baseline.delete(m)}
let inputT=null;
document.addEventListener('input',e=>{const m=e.target.closest?.('.modal-overlay');if(!m||!modalKey(m))return;clearTimeout(inputT);inputT=setTimeout(()=>saveDraft(m),400)},true);
document.addEventListener('change',e=>{const m=e.target.closest?.('.modal-overlay');if(m&&modalKey(m))saveDraft(m)},true);
const isOpen=m=>m.classList.contains('open')||m.style.display==='flex';
const seen=new WeakMap();
function scan(){document.querySelectorAll('.modal-overlay').forEach(m=>{const o=isOpen(m);const was=seen.get(m)||false;if(o&&!was)onOpen(m);if(!o&&was)onClose(m);seen.set(m,o)})}
function boot(){
  ensurePill();
  new MutationObserver(muts=>{let relevant=false;for(const mu of muts){
      if(mu.type==='attributes'&&mu.target.classList?.contains('modal-overlay')){relevant=true;break}
      if(mu.type==='childList'){mu.removedNodes.forEach(n=>{if(n.nodeType===1&&n.classList?.contains('modal-overlay')&&seen.get(n)){onClose(n);seen.set(n,false)}});if(mu.addedNodes.length)relevant=true}}
    if(relevant)scan()}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
  scan();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();

/* ---------- 2. Aviso al cerrar o recargar ---------- */
window.addEventListener('beforeunload',e=>{
  openModals().forEach(saveDraft);
  const dirty=openModals().some(m=>isDirty(m)&&!savedWhileOpen.has(m));
  if(state.pending>0||dirty){e.preventDefault();e.returnValue='Hay cambios que todavía no se guardaron en NutriMachata.';return e.returnValue}
});

/* Al cerrar sesión no quedan borradores del usuario anterior. */
const prevClear=window.nmClearClinicalMemory;
if(typeof prevClear==='function'){
  const w=function(){try{Object.keys(sessionStorage).filter(k=>k.startsWith(DKEY)).forEach(k=>sessionStorage.removeItem(k))}catch(_){}return prevClear.apply(this,arguments)};
  window.nmClearClinicalMemory=w;try{nmClearClinicalMemory=w}catch(_){}
}
NM134.saveDraftsNow=()=>openModals().forEach(saveDraft);
NM134.scan=scan;
window.NMV134Guardado=true;
})();
