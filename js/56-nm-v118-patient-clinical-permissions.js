(function(){
  'use strict';
  const role118=()=>String(window.DB?.currentRole||window.DB?.currentUser?.role||window.DB?.currentUser?.rol||'').trim().toLowerCase();
  const isPatient118=()=>role118()==='patient';
  const ownPatient118=()=>{
    const u=window.DB?.currentUser||{};
    return (window.DB?.patients||[]).find(p=>String(p.id)===String(u.patientId)||String(p.email||'').toLowerCase()===String(u.email||'').toLowerCase())||null;
  };
  const deny118=(msg='Esta acción está disponible únicamente para el equipo clínico.')=>{
    document.getElementById('modal-evaluation')?.classList.remove('open');
    document.getElementById('modal-evaluation')?.setAttribute('aria-hidden','true');
    if(typeof window.notify==='function') window.notify(msg,'warning');
    return false;
  };

  // La evaluación nutricional es una acción clínica: paciente solo consulta sus resultados.
  const openEval118=window.openEvalModal;
  if(typeof openEval118==='function'){
    window.openEvalModal=function(){
      if(isPatient118()) return deny118('Las evaluaciones nutricionales son registradas por tu profesional de salud.');
      return openEval118.apply(this,arguments);
    };
    try{openEvalModal=window.openEvalModal}catch(_){ }
  }
  const saveEval118=window.saveEvaluation;
  if(typeof saveEval118==='function'){
    window.saveEvaluation=function(){
      if(isPatient118()) return deny118();
      return saveEval118.apply(this,arguments);
    };
    try{saveEvaluation=window.saveEvaluation}catch(_){ }
  }
  const startEval118=window.startEvaluationFromAppointment;
  if(typeof startEval118==='function'){
    window.startEvaluationFromAppointment=function(){
      if(isPatient118()) return deny118();
      return startEval118.apply(this,arguments);
    };
  }

  // El centro de alertas del paciente nunca debe exponer alertas internas de otros pacientes
  // ni convertir una alerta clínica en una acción para crear/editar evaluaciones.
  const staffAlerts118=window.computeClinicAlerts;
  window.computeClinicAlerts=function(){
    if(!isPatient118()) return typeof staffAlerts118==='function'?staffAlerts118.apply(this,arguments):[];
    const p=ownPatient118();
    if(!p) return [];
    const alerts=[];
    const today=new Date(); today.setHours(0,0,0,0);
    const fmt=d=>{try{return new Date(String(d).slice(0,10)+'T12:00:00').toLocaleDateString('es-DO')}catch(_){return String(d||'')}};
    const appts=(window.DB?.appointments||[]).filter(a=>String(a.patientId)===String(p.id)&&!['completada','cancelada'].includes(String(a.estado||'').toLowerCase()));
    appts.forEach(a=>{
      if(!a.fecha)return;
      const dt=new Date(`${a.fecha}T${String(a.hora||'00:00').slice(0,5)}:00`);
      const hours=(dt-new Date())/3600000;
      if(hours>=0&&hours<=48) alerts.push({type:'info',icon:'◷',title:'Próxima cita',text:`Tienes una cita programada para ${fmt(a.fecha)}${a.hora?' a las '+a.hora:''}.`,date:hours<=24?'Próxima':'Agenda',key:`patient-appt:${a.id||a.fecha+a.hora}`,action:()=>window.navigate?.('appointments')});
    });
    const diets=(p.dietas||[]).filter(Boolean);
    diets.forEach(d=>{
      const end=d.fechaFin||d.fecha_fin||d.fin||d.endDate;if(!end)return;
      const ed=new Date(String(end).slice(0,10)+'T00:00:00');if(Number.isNaN(ed.getTime()))return;
      const days=Math.round((ed-today)/86400000);
      if(days>=0&&days<=7) alerts.push({type:'info',icon:'◫',title:'Tu plan está por finalizar',text:`${d.nombre||'Tu plan nutricional'} ${days===0?'finaliza hoy':`finaliza en ${days} día${days===1?'':'s'}`}.`,date:fmt(end),key:`patient-diet:${d.id||d.nombre}:${end}`,action:()=>window.navigate?.('patient-diet')});
    });
    return alerts;
  };

  function enforcePatientUI118(){
    if(!isPatient118()) return;
    // Cierra cualquier modal clínico que haya quedado abierto por un render previo.
    const modal=document.getElementById('modal-evaluation');
    if(modal?.classList.contains('open')) modal.classList.remove('open');
    // Oculta acciones clínicas heredadas si alguna aparece accidentalmente en el portal.
    document.querySelectorAll('[onclick*="openEvalModal"],[onclick*="startEvaluationFromAppointment"]').forEach(el=>{
      if(el.closest('#page-content')||el.closest('#clinic-alert-panel')) el.style.display='none';
    });
    if(typeof window.refreshClinicAlertBadge==='function') window.refreshClinicAlertBadge();
  }
  document.addEventListener('click',()=>setTimeout(enforcePatientUI118,0),true);
  document.addEventListener('DOMContentLoaded',()=>setTimeout(enforcePatientUI118,120));
  setTimeout(enforcePatientUI118,250);
  window.NMV118PatientClinicalPermissions=true;
})();
