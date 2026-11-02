(function(){
  'use strict';
  // Form accessibility: one observer only, never injected inside generated reports/templates.
  let fieldSeq=0;
  function fixForms(root){
    root=root||document;
    root.querySelectorAll?.('input,select,textarea').forEach(el=>{
      if(!el.id) el.id='nm-field-'+(++fieldSeq);
      if(!el.name) el.name=el.id;
    });
    root.querySelectorAll?.('label:not([for])').forEach(label=>{
      if(label.querySelector('input,select,textarea')) return;
      const box=label.closest('.form-group')||label.parentElement;
      const field=box?.querySelector?.('input:not([type="hidden"]),select,textarea');
      if(field?.id) label.setAttribute('for',field.id);
    });
    root.querySelectorAll?.('label[for]').forEach(label=>{
      const id=label.getAttribute('for');
      if(id && !document.getElementById(id)) label.removeAttribute('for');
    });
  }
  function installFormObserver(){
    if(window.__nmFormObserverInstalled) return;
    window.__nmFormObserverInstalled=true;
    fixForms(document);
    const obs=new MutationObserver(muts=>{
      for(const m of muts) for(const n of m.addedNodes) if(n.nodeType===1) fixForms(n);
    });
    obs.observe(document.body,{childList:true,subtree:true});
    window.__nmFormObserver=obs;
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',installFormObserver,{once:true});
  else installFormObserver();

  // New global actions start without the last patient. Explicit patient actions keep their patient.
  function clearNewActionPatientState(){
    window.NMNewActionPatientId=null;
    ['selectedPatientId','currentPatientId','lastPatientId','pacienteSeleccionado','pacienteActual'].forEach(k=>{try{sessionStorage.removeItem(k)}catch(_){}});
  }
  function wrapNewAction(name, patientArgIndex){
    const original=window[name];
    if(typeof original!=='function'||original.__nmCleanNewAction) return;
    const wrapped=function(){
      const args=[...arguments], pid=args[patientArgIndex];
      const explicit=pid!==null&&pid!==undefined&&String(pid).trim()!=='';
      if(!explicit) clearNewActionPatientState();
      return original.apply(this,args);
    };
    wrapped.__nmCleanNewAction=true;
    window[name]=wrapped;
  }
  wrapNewAction('openEvalModal',0);
  wrapNewAction('openAppointmentModal',1); // existing appointment is arg 1; new global appointment has none
  wrapNewAction('openDietModal',0);
  wrapNewAction('openInvoiceModal',0);

  // Do not allow alert refresh to crash startup before DB is ready.
  if(typeof window.computeClinicAlerts==='function'&&!window.computeClinicAlerts.__nmDbGuard){
    const base=window.computeClinicAlerts;
    const guarded=function(){ try{return (typeof DB!=='undefined'&&DB)?(base()||[]):[]}catch(e){console.warn('[NutriMachata] Alertas pospuestas:',e);return []} };
    guarded.__nmDbGuard=true; window.computeClinicAlerts=guarded;
  }
})();
