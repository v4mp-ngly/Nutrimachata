(function(){
  const DAY=86400000;
  const isoToday=()=>{const d=new Date();d.setHours(0,0,0,0);return d};
  const validNumber=v=>v!==null&&v!==''&&v!==undefined&&Number.isFinite(Number(v));
  const parseDate=v=>{if(!v)return null;const d=new Date(String(v).slice(0,10)+'T00:00:00');return isNaN(d)?null:d};
  const daysFromToday=v=>{const d=parseDate(v);if(!d)return null;return Math.round((d-isoToday())/DAY)};
  const safeText=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  window.refreshAppointmentPatientContext=function(patientId){
    const box=document.getElementById('apt-patient-context'); if(!box)return;
    const p=(DB.patients||[]).find(x=>String(x.id)===String(patientId));
    if(!p){box.style.display='none';box.innerHTML='';return}
    const evs=(p.evaluaciones||[]).slice().sort((a,b)=>String(a.fecha||'').localeCompare(String(b.fecha||'')));
    const last=evs[evs.length-1]||null;
    const lastDate=last?.fecha?new Date(last.fecha+'T00:00:00').toLocaleDateString('es-DO'):'Sin evaluación';
    const weight=validNumber(last?.peso)?`${Number(last.peso).toFixed(1)} kg`:validNumber(p.peso)?`${Number(p.peso).toFixed(1)} kg`:'—';
    const imc=validNumber(last?.imc)?Number(last.imc).toFixed(1):validNumber(p.imc)?Number(p.imc).toFixed(1):'—';
    const pressure=last?.presion||p.presion||'—';
    box.innerHTML=`<div class="apt-context-head"><div class="apt-context-avatar" style="background:${p.color||'#5E8C2A'}">${safeText(p.initials||p.nombre?.split(/\s+/).map(x=>x[0]).slice(0,2).join('')||'P')}</div><div><div class="apt-context-name">${safeText(p.nombre)}</div><div class="apt-context-goal">Objetivo: ${safeText(p.objetivo||last?.proximoObjetivo||'No registrado')}</div></div></div><div class="apt-context-grid"><div class="apt-context-metric"><span>Última evaluación</span><b>${safeText(lastDate)}</b></div><div class="apt-context-metric"><span>Peso</span><b>${safeText(weight)}</b></div><div class="apt-context-metric"><span>IMC</span><b>${safeText(imc)}</b></div><div class="apt-context-metric"><span>Presión</span><b>${safeText(pressure)}</b></div></div><div class="apt-context-actions"><button type="button" class="btn btn-olive btn-sm" onclick="startEvaluationFromAppointment('${p.id}')">＋ Iniciar evaluación</button><button type="button" class="btn btn-outline btn-sm" onclick="closeModal('modal-appointment');navigate('patients');setTimeout(()=>openPatientDetail?.('${p.id}'),120)">Ver paciente</button></div>`;
    box.style.display='block';
  };
  window.startEvaluationFromAppointment=function(patientId){closeModal('modal-appointment');setTimeout(()=>openEvalModal(patientId),120)};

  // Compatibilidad con alertas/markup antiguo: toda navegacion usa navigate().
window.navigateTo = function(page){ return navigate(page); };

function pressureHigh(v){if(!v)return false;const m=String(v).match(/(\d+)\D+(\d+)/);return !!m&&(Number(m[1])>=140||Number(m[2])>=90)}
  window.computeClinicAlerts=function(){
    const alerts=[]; const now=isoToday();
    (DB.patients||[]).filter(p=>p.activo!==false).forEach(p=>{
      const evs=(p.evaluaciones||[]).slice().sort((a,b)=>String(a.fecha||'').localeCompare(String(b.fecha||'')));
      const last=evs[evs.length-1];
      if(!last){alerts.push({type:'warning',icon:'◷',title:'Paciente sin evaluación',text:`${p.nombre} no tiene evaluaciones registradas.`,date:'Seguimiento',action:()=>{navigate('evaluations');setTimeout(()=>openEvalModal(p.id),100)}})}
      else{
        const days=daysFromToday(last.fecha); if(days!==null&&days<-45) alerts.push({type:'warning',icon:'◷',title:'Evaluación atrasada',text:`${p.nombre}: última evaluación hace ${Math.abs(days)} días.`,date:'Evaluación',action:()=>{navigate('evaluations');setTimeout(()=>openEvalModal(p.id),100)}});
        const imc=validNumber(last.imc)?Number(last.imc):(validNumber(p.imc)?Number(p.imc):null); if(imc!==null&&(imc<18.5||imc>=30)) alerts.push({type:'info',icon:'⚕',title:'IMC fuera de rango',text:`${p.nombre}: IMC ${imc.toFixed(1)}.`,date:'Clínico',action:()=>navigate('evaluations')});
        const press=last.presion||p.presion;if(pressureHigh(press)) alerts.push({type:'danger',icon:'♥',title:'Presión arterial elevada',text:`${p.nombre}: ${press}.`,date:'Clínico',action:()=>navigate('evaluations')});
        if(evs.length>1&&validNumber(last.peso)&&validNumber(evs[evs.length-2].peso)){const prev=Number(evs[evs.length-2].peso),cur=Number(last.peso),pct=prev?Math.abs(cur-prev)/prev*100:0;if(pct>=5) alerts.push({type:'warning',icon:'↕',title:'Cambio de peso significativo',text:`${p.nombre}: ${cur>prev?'+':''}${(cur-prev).toFixed(1)} kg (${pct.toFixed(1)}%).`,date:'Evolución',action:()=>navigate('evaluations')})}
      }
      (p.dietas||[]).forEach(d=>{const end=d.fechaFin||d.fecha_fin||d.fin||d.endDate;const days=daysFromToday(end);if(days!==null&&days>=0&&days<=7)alerts.push({type:'info',icon:'◫',title:'Plan por finalizar',text:`${p.nombre}: ${d.nombre||'Plan nutricional'} finaliza en ${days===0?'hoy':days+' días'}.`,date:'Plan',action:()=>navigate('diets')})})
    });
    (DB.appointments||[]).forEach(a=>{if(['completada','cancelada'].includes(String(a.estado||'').toLowerCase()))return;const dt=new Date(`${a.fecha}T${(a.hora||'00:00').slice(0,5)}:00`);const hours=(dt-new Date())/3600000;if(hours>=0&&hours<=24){const p=(DB.patients||[]).find(x=>x.id==a.patientId);alerts.push({type:'info',icon:'◷',title:'Cita cercana',text:`${p?.nombre||a.nombreManual||'Paciente'} · ${a.fecha} ${a.hora||''}.`,date:hours<=2?'Muy pronto':'Próxima',action:()=>{navigate('agenda');setTimeout(()=>editAppointment(a.id),100)}})}});
    try{const b=typeof getBillingData==='function'?getBillingData():null;(b?.invoices||[]).forEach(x=>{const st=typeof billingInvoiceStatus==='function'?billingInvoiceStatus(x):x.status;if(st==='Vencida')alerts.push({type:'danger',icon:'$',title:'Factura vencida',text:`${x.patient||'Paciente'} · ${x.number||'Factura'} · saldo ${typeof moneyRD==='function'?moneyRD((x.total||0)-(x.paid||0)):''}`,date:x.dueDate||'Vencida',action:()=>navigate('billing')})});(b?.products||[]).filter(p=>p.type!=='Servicio'&&p.active!==false&&validNumber(p.stock)&&validNumber(p.min)&&Number(p.stock)<=Number(p.min)).forEach(p=>alerts.push({type:'warning',icon:'▣',title:'Stock bajo',text:`${p.name}: ${p.stock} disponibles (mín. ${p.min}).`,date:'Inventario',action:()=>navigate('billing')}))}catch(e){console.warn('Alertas de facturación:',e)}
    const priority={danger:0,warning:1,info:2,success:3};alerts.sort((a,b)=>(priority[a.type]??9)-(priority[b.type]??9));return alerts;
  };
  window.refreshClinicAlertBadge=function(){const n=computeClinicAlerts().length;const b=document.getElementById('clinic-alert-badge');if(!b)return;b.textContent=n>99?'99+':n;b.style.display=n?'block':'none'};
  window.renderClinicAlerts=function(){const panel=document.getElementById('clinic-alert-panel');if(!panel)return;const alerts=computeClinicAlerts();panel.innerHTML=`<div class="clinic-alert-head"><div><h3>Centro de alertas</h3><small>Seguimiento clínico y operativo</small></div><button class="modal-close" onclick="toggleClinicAlerts()">×</button></div><div class="clinic-alert-list">${alerts.length?alerts.map((a,i)=>`<div class="clinic-alert-item ${a.type}" onclick="runClinicAlert(${i})"><div class="clinic-alert-icon">${a.icon}</div><div><div class="clinic-alert-title">${safeText(a.title)}</div><div class="clinic-alert-text">${safeText(a.text)}</div></div><div class="clinic-alert-date">${safeText(a.date||'')}</div></div>`).join(''):'<div class="clinic-alert-empty">✓ No hay alertas pendientes en este momento.</div>'}</div><div class="clinic-alert-footer"><span>${alerts.length} alerta${alerts.length===1?'':'s'} activa${alerts.length===1?'':'s'}</span><button class="btn btn-outline btn-sm" onclick="refreshClinicAlertBadge();renderClinicAlerts()">Actualizar</button></div>`;window.__clinicAlerts=alerts};
  window.runClinicAlert=function(i){const a=(window.__clinicAlerts||[])[i];document.getElementById('clinic-alert-panel')?.classList.remove('open');if(a?.action)a.action()};
  window.toggleClinicAlerts=function(ev){ev?.stopPropagation?.();const p=document.getElementById('clinic-alert-panel');if(!p)return;const opening=!p.classList.contains('open');if(opening)renderClinicAlerts();p.classList.toggle('open',opening)};
  document.addEventListener('click',e=>{const p=document.getElementById('clinic-alert-panel');if(p?.classList.contains('open')&&!p.contains(e.target)&&!e.target.closest('#notif-btn'))p.classList.remove('open')});
  NMRuntime.timeout('global:clinic-alert-first',refreshClinicAlertBadge,1000);NMRuntime.interval('global:clinic-alert',refreshClinicAlertBadge,60000);
  const _notify=window.notify;if(typeof _notify==='function'){window.notify=function(){const r=_notify.apply(this,arguments);setTimeout(refreshClinicAlertBadge,200);return r}}
})();
