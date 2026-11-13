(function(){
  'use strict';
  const SNAP_KEY='nutrimachata_critical_snapshot_v3';
  const ERROR_LOG_KEY='nutrimachata_error_log_v2';
  const MAX_ERRORS=40;
  const banner=document.getElementById('nm-connection-banner');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function showBanner(message,kind='error',ms=5200){
    if(!banner)return;
    banner.className=kind;
    banner.innerHTML=`<span>${kind==='ok'?'✓':kind==='offline'?'⚠':'✕'}</span><span>${esc(message)}</span>`;
    banner.style.display='flex';
    clearTimeout(showBanner._t);
    if(ms)showBanner._t=setTimeout(()=>{banner.style.display='none';banner.className=''},ms);
  }
  window.nmShowSystemMessage=showBanner;

  function logError(scope,error,extra){
    const item={time:new Date().toISOString(),scope,message:String(error?.message||error||'Error desconocido'),extra:extra||null};
    try{const arr=JSON.parse(sessionStorage.getItem(ERROR_LOG_KEY)||'[]');arr.unshift(item);sessionStorage.setItem(ERROR_LOG_KEY,JSON.stringify(arr.slice(0,MAX_ERRORS)))}catch(_e){}
    console.error('[NutriMachata]',scope,error,extra||'');
    return item;
  }

  window.addEventListener('error',ev=>{
    logError('JavaScript',ev.error||ev.message,{file:ev.filename,line:ev.lineno});
    showBanner('Ocurrió un error inesperado. La acción no se completó.','error');
    try{notify('Ocurrió un error inesperado. Revisa los datos e inténtalo otra vez.','danger')}catch(_e){}
  });
  window.addEventListener('unhandledrejection',ev=>{
    logError('Promesa',ev.reason);
    showBanner('No se pudo completar una operación. Revisa la conexión e inténtalo otra vez.','error');
    try{notify('No se pudo completar la operación. Inténtalo nuevamente.','danger')}catch(_e){}
  });

  window.addEventListener('offline',()=>showBanner('Sin conexión a internet. No cierres la página hasta recuperar la conexión.','offline',0));
  // v131: la resincronización tras reconectar la coordina NMConnectionV43 (una sola carga, sin promesas sin manejar).
  window.addEventListener('online',()=>{showBanner('Conexión recuperada.','ok',2800);});
  if(!navigator.onLine)showBanner('Sin conexión a internet. Los cambios del servidor no podrán guardarse.','offline',0);

  // Evita que Supabase falle en silencio en operaciones de escritura.
  if(typeof supa==='function'&&!window.__nmSupaGuarded){
    window.__nmSupaGuarded=true;
    const rawSupa=supa;
    supa=async function(path,method='GET',body=null){
      const beforeOnline=typeof SUPA_ONLINE!=='undefined'?SUPA_ONLINE:true;
      const result=await rawSupa(path,method,body);
      const write=String(method||'GET').toUpperCase()!=='GET';
      if(write&&!IS_LOCAL&&(result===null||SUPA_ONLINE===false)){
        const err=new Error(!navigator.onLine?'No hay conexión a internet.':'La base de datos no confirmó el guardado.');
        logError('Persistencia Supabase',err,{path,method,beforeOnline});
        throw err;
      }
      return result;
    };
  }

  // v131: la copia de seguridad de la pestaña pertenece al usuario autenticado que la generó.
  // Nunca se restaura para otra cuenta ni sobrescribe datos más recientes ya cargados en memoria.
  function snapshotOwner(){try{return typeof currentAuthUserId==='function'?currentAuthUserId():null}catch(_e){return null}}
  function criticalSnapshot(){
    return {
      version:3,
      owner:snapshotOwner(),
      savedAt:new Date().toISOString(),
      patients:Array.isArray(DB?.patients)?DB.patients:[],
      appointments:Array.isArray(DB?.appointments)?DB.appointments:[],
      settings:DB?.settings||{}
    };
  }
  function saveSnapshot(reason='auto'){
    try{
      if(!IS_LOCAL&&(!DB?.loaded||!snapshotOwner()))return false; // sin datos confirmados no hay nada que respaldar
      const snap=criticalSnapshot();
      sessionStorage.setItem(SNAP_KEY,JSON.stringify(snap));
      window.__nmLastSnapshot={time:snap.savedAt,reason};
      return true;
    }catch(e){logError('Copia local',e,{reason});showBanner('No se pudo crear la copia local de seguridad.','error');return false}
  }
  function restoreSnapshot(){
    try{
      const raw=sessionStorage.getItem(SNAP_KEY);if(!raw)return false;
      const snap=JSON.parse(raw);if(!snap||!Array.isArray(snap.patients))return false;
      if(!IS_LOCAL){
        if(DB?.loaded)return false; // los datos en memoria son más recientes que la copia
        const owner=snapshotOwner();
        if(!owner||snap.owner!==owner){sessionStorage.removeItem(SNAP_KEY);return false}
      }
      DB.patients=snap.patients;
      DB.appointments=Array.isArray(snap.appointments)?snap.appointments:[];
      if(snap.settings&&typeof snap.settings==='object')DB.settings={...(DB.settings||{}),...snap.settings};
      DB.loaded=true;
      window.__nmRestoredSnapshot=snap.savedAt||true;
      return true;
    }catch(e){logError('Restaurar copia local',e);return false}
  }
  window.nmSaveCriticalSnapshot=saveSnapshot;
  window.nmRestoreCriticalSnapshot=restoreSnapshot;

  // Si la BD no puede cargar, usa la última copia local en vez de dejar el sistema vacío.
  if(typeof loadFromSupabase==='function'&&!window.__nmLoadWrapped){
    window.__nmLoadWrapped=true;
    const rawLoad=loadFromSupabase;
    loadFromSupabase=async function(){
      try{
        const result=await rawLoad.apply(this,arguments);
        if(result===true && DB?.loaded){saveSnapshot('servidor-cargado');return result}
        if(DB?.loaded&&result!==true){
          showBanner('No se pudo actualizar desde Supabase. Se mantienen los datos ya cargados en pantalla.','offline',6500);
        }else if(restoreSnapshot()){
          showBanner('No se pudo conectar con Supabase. Se muestra la última copia de esta sesión; los cambios no se guardarán hasta recuperar la conexión.','offline',6500);
          try{notify('Mostrando la última copia local disponible','warning')}catch(_e){}
        }
        return result;
      }catch(e){
        logError('Carga de datos',e);
        if(DB?.loaded)showBanner('No se pudo actualizar desde Supabase. Se mantienen los datos ya cargados en pantalla.','offline',6500);
        else if(restoreSnapshot())showBanner('No se pudo conectar. Se recuperó la última copia local de esta sesión.','offline',6500);
        else showBanner('No se pudo cargar la información y no hay copia local disponible.','error',0);
        throw e;
      }
    };
  }

  // Verifica que Facturación realmente se escriba y pueda leerse desde sessionStorage.
  if(typeof saveBillingData==='function'&&!window.__nmBillingStorageGuarded){
    window.__nmBillingStorageGuarded=true;
    const rawSaveBilling=saveBillingData;
    saveBillingData=function(data){
      const ok=rawSaveBilling(data);
      if(!ok)throw new Error('No se pudo guardar la información de facturación.');
      try{
        const probe=sessionStorage.getItem(typeof BILLING_KEY!=='undefined'?BILLING_KEY:'nutrimachata_billing_v2');
        if(!probe)throw new Error('El navegador no confirmó el almacenamiento de facturación.');
        JSON.parse(probe);
      }catch(e){logError('Persistencia Facturación',e);throw e}
      saveSnapshot('facturacion');
      return true;
    };
  }

  function setBusyForActiveButton(active,label){
    const el=document.activeElement;
    if(!(el instanceof HTMLButtonElement))return ()=>{};
    if(!active)return ()=>{};
    const old=el.innerHTML;el.classList.add('nm-action-busy');el.disabled=true;
    el.dataset.nmOldHtml=old;if(label)el.textContent=label;
    return ()=>{el.classList.remove('nm-action-busy');el.disabled=false;if(el.dataset.nmOldHtml){el.innerHTML=el.dataset.nmOldHtml;delete el.dataset.nmOldHtml}}
  }

  function wrapMutation(name,label){
    const original=window[name];if(typeof original!=='function'||original.__nmReliable)return;
    const wrapped=function(){
      const restore=setBusyForActiveButton(true,'Guardando…');
      try{
        const result=original.apply(this,arguments);
        if(result&&typeof result.then==='function'){
          return result.then(v=>{saveSnapshot(name);restore();return v}).catch(e=>{restore();logError(label||name,e);showBanner(`${label||'La operación'} no pudo guardarse: ${e.message||'error desconocido'}`,'error',7000);try{notify(`${label||'La operación'} no pudo guardarse. ${e.message||''}`,'danger')}catch(_e){};throw e});
        }
        saveSnapshot(name);restore();return result;
      }catch(e){restore();logError(label||name,e);showBanner(`${label||'La operación'} no pudo guardarse: ${e.message||'error desconocido'}`,'error',7000);try{notify(`${label||'La operación'} no pudo guardarse. ${e.message||''}`,'danger')}catch(_e){};return false}
    };
    wrapped.__nmReliable=true;wrapped.__nmOriginal=original;window[name]=wrapped;
  }

  [
    ['saveEvaluation','La evaluación'],['saveAppointment','La cita'],['saveInvoice','La factura'],
    ['saveInvoicePayment','El pago'],['saveBillingProduct','El producto o servicio'],
    ['deleteInvoice','La eliminación de la factura'],['deleteBillingProduct','La eliminación del producto'],
    ['savePatient','El paciente'],['saveEditPatient','Los datos del paciente'],['saveLabNote','La nota clínica'],
    ['saveDietChanges','El plan nutricional']
  ].forEach(x=>wrapMutation(x[0],x[1]));

  // Copia local periódica y al abandonar la pestaña.
  NMRuntime.interval('global:snapshot',()=>saveSnapshot('periodica'),60000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveSnapshot('ocultar-pagina')});
  window.addEventListener('beforeunload',()=>saveSnapshot('cerrar-pagina'));
  if(IS_LOCAL)restoreSnapshot();

  // Auditoría automática: oculta botones con acciones inexistentes y duplicados exactos en el mismo bloque.
  const ignored=new Set(['if','this','event','document','window','confirm','return','location','history','setTimeout']);
  function directAction(code){
    const s=String(code||'').trim();const m=s.match(/^([A-Za-z_$][\w$]*)\s*\(/);if(!m)return null;
    return ignored.has(m[1])?null:m[1];
  }
  function auditButtons(root=document){
    let dead=0,dupes=0;
    const nodes=[];
    if(root instanceof Element&&root.matches('button,[role="button"],a[onclick]'))nodes.push(root);
    if(root.querySelectorAll)nodes.push(...root.querySelectorAll('button,[role="button"],a[onclick]'));
    nodes.forEach(btn=>{
      const code=btn.getAttribute('onclick');const fn=directAction(code);
      if(fn&&typeof window[fn]!=='function'){
        btn.dataset.nmDeadAction='1';btn.setAttribute('aria-hidden','true');btn.title=`Acción no disponible: ${fn}`;dead++;return;
      }
      if(btn.parentElement&&code){
        const signature=(btn.textContent||'').trim().replace(/\s+/g,' ')+'||'+code.trim();
        const siblings=[...btn.parentElement.querySelectorAll(':scope > button,:scope > a[onclick]')];
        const first=siblings.find(x=>((x.textContent||'').trim().replace(/\s+/g,' ')+'||'+String(x.getAttribute('onclick')||'').trim())===signature);
        if(first&&first!==btn){btn.dataset.nmDeadAction='1';btn.setAttribute('aria-hidden','true');dupes++}
      }
    });
    window.__nmButtonAudit={time:new Date().toISOString(),dead,duplicates:dupes};
    if(dead)console.warn(`[NutriMachata] ${dead} botón(es) con acción inexistente fueron ocultados.`);
    return window.__nmButtonAudit;
  }
  window.auditNutriMachataButtons=auditButtons;
  let auditTimer;
  const obs=new MutationObserver(muts=>{clearTimeout(auditTimer);auditTimer=setTimeout(()=>muts.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1)auditButtons(n)})),40)});
  obs.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('load',()=>setTimeout(()=>{auditButtons(document);saveSnapshot('inicio')},350));
})();
