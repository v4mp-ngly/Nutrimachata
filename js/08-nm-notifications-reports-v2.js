(function(){
  const ALERT_SEEN_KEY='nutrimachata_alertas_leidas_v2';
  const safeJsonParse=(v,f)=>{try{return JSON.parse(v)}catch(e){return f}};
  const getSeen=()=>safeJsonParse(sessionStorage.getItem(ALERT_SEEN_KEY)||'{}',{});
  const saveSeen=o=>sessionStorage.setItem(ALERT_SEEN_KEY,JSON.stringify(o));
  const alertKey=(a)=>String(a.key||[a.title,a.text,a.date].join('|')).normalize('NFD').replace(/[\u0300-\u036f]/g,'').slice(0,260);
  const fmtDate=(d)=>{if(!d)return '—';const dt=new Date(String(d).slice(0,10)+'T12:00:00');return Number.isNaN(dt.getTime())?String(d):dt.toLocaleDateString('es-DO')};
  const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const patientById=(id)=>(DB.patients||[]).find(p=>String(p.id)===String(id));
  const patientName=(p)=>p?.nombre||[p?.nombre,p?.apellido].filter(Boolean).join(' ')||'Paciente';
  // v131: estas utilidades vivían dentro del módulo 02 (no globales); aquí siempre eran "undefined"
  // y las alertas de evaluación atrasada, IMC, presión, cambio de peso y fin de plan nunca aparecían.
  const DAY=86400000;
  const isoToday=()=>{const d=new Date();d.setHours(0,0,0,0);return d};
  const validNumber=v=>v!==null&&v!==''&&v!==undefined&&Number.isFinite(Number(v));
  const parseDate=v=>{if(!v)return null;const d=new Date(String(v).slice(0,10)+'T00:00:00');return isNaN(d)?null:d};
  const daysFromToday=v=>{const d=parseDate(v);if(!d)return null;return Math.round((d-isoToday())/DAY)};
  const pressureHigh=v=>{if(!v)return false;const m=String(v).match(/(\d+)\D+(\d+)/);return !!m&&(Number(m[1])>=140||Number(m[2])>=90)};

  window.computeClinicAlerts=function(){
    const alerts=[];
    const push=(a)=>{a.key=alertKey(a);alerts.push(a)};
    const patients=(DB.patients||[]).filter(p=>p&&p.activo!==false);
    patients.forEach(p=>{
      const name=patientName(p);
      const evs=(p.evaluaciones||[]).filter(Boolean).slice().sort((a,b)=>String(a.fecha||'').localeCompare(String(b.fecha||'')));
      const last=evs[evs.length-1];
      if(!last){
        push({type:'warning',icon:'◷',title:'Paciente sin evaluación',text:`${name} no tiene evaluaciones registradas.`,date:'Seguimiento',key:`noeval:${p.id}`,action:()=>{navigate('evaluations');setTimeout(()=>openEvalModal(p.id),120)}});
      }else{
        const days=typeof daysFromToday==='function'?daysFromToday(last.fecha):null;
        if(days!==null&&days<-45)push({type:'warning',icon:'◷',title:'Evaluación atrasada',text:`${name}: última evaluación hace ${Math.abs(days)} días.`,date:fmtDate(last.fecha),key:`lateeval:${p.id}:${String(last.fecha).slice(0,10)}`,action:()=>{navigate('evaluations');setTimeout(()=>openEvalModal(p.id),120)}});
        const imc=(typeof validNumber==='function'&&validNumber(last.imc))?Number(last.imc):((typeof validNumber==='function'&&validNumber(p.imc))?Number(p.imc):null);
        if(imc!==null&&(imc<18.5||imc>=30))push({type:'info',icon:'⚕',title:'IMC fuera de rango',text:`${name}: IMC ${imc.toFixed(1)}.`,date:'Clínico',key:`imc:${p.id}:${imc.toFixed(1)}`,action:()=>{navigate('evaluations');setTimeout(()=>openEvalModal(p.id),120)}});
        const press=last.presion||p.presion;
        if(typeof pressureHigh==='function'&&pressureHigh(press))push({type:'danger',icon:'♥',title:'Presión arterial elevada',text:`${name}: ${press}.`,date:'Clínico',key:`bp:${p.id}:${press}`,action:()=>{navigate('evaluations');setTimeout(()=>openEvalModal(p.id),120)}});
        if(evs.length>1&&typeof validNumber==='function'&&validNumber(last.peso)&&validNumber(evs[evs.length-2].peso)){
          const prev=Number(evs[evs.length-2].peso),cur=Number(last.peso),pct=prev?Math.abs(cur-prev)/prev*100:0;
          if(pct>=5)push({type:'warning',icon:'↕',title:'Cambio de peso significativo',text:`${name}: ${cur>prev?'+':''}${(cur-prev).toFixed(1)} kg (${pct.toFixed(1)}%).`,date:'Evolución',key:`weight:${p.id}:${cur}:${prev}`,action:()=>{navigate('evaluations');setTimeout(()=>openEvalModal(p.id),120)}});
        }
      }
      (p.dietas||[]).filter(Boolean).forEach(d=>{
        const end=d.fechaFin||d.fecha_fin||d.fin||d.endDate; const days=typeof daysFromToday==='function'?daysFromToday(end):null;
        if(days!==null&&days>=0&&days<=7)push({type:'info',icon:'◫',title:'Plan por finalizar',text:`${name}: ${d.nombre||'Plan nutricional'} finaliza ${days===0?'hoy':'en '+days+' días'}.`,date:fmtDate(end),key:`diet:${p.id}:${d.id||d.nombre}:${end}`,action:()=>navigate('diets')});
      });
    });
    (DB.appointments||[]).filter(Boolean).forEach(a=>{
      if(['completada','cancelada'].includes(String(a.estado||'').toLowerCase())||!a.fecha)return;
      const dt=new Date(`${a.fecha}T${String(a.hora||'00:00').slice(0,5)}:00`);if(Number.isNaN(dt.getTime()))return;
      const hours=(dt-new Date())/3600000;if(hours>=0&&hours<=24){const p=patientById(a.patientId);push({type:'info',icon:'◷',title:'Cita cercana',text:`${patientName(p)||a.nombreManual||'Paciente'} · ${fmtDate(a.fecha)} ${a.hora||''}.`,date:hours<=2?'Muy pronto':'Próxima',key:`appt:${a.id||a.fecha+a.hora}`,action:()=>{navigate('agenda');setTimeout(()=>{if(typeof editAppointment==='function')editAppointment(a.id)},120)}})};
    });
    try{
      const b=typeof getBillingData==='function'?getBillingData():null;
      (b?.invoices||[]).filter(Boolean).forEach(x=>{const st=typeof billingInvoiceStatus==='function'?billingInvoiceStatus(x):x.status;if(String(st).toLowerCase()==='vencida'){const bal=Math.max(0,Number(x.total||0)-Number(x.paid||0));push({type:'danger',icon:'$',title:'Factura vencida',text:`${x.patient||'Paciente'} · ${x.number||'Factura'} · saldo ${typeof moneyRD==='function'?moneyRD(bal):bal}`,date:fmtDate(x.dueDate),key:`invoice:${x.id||x.number}:${x.dueDate}`,action:()=>navigate('billing')})}});
      (b?.products||[]).filter(p=>p&&p.type!=='Servicio'&&p.active!==false&&typeof validNumber==='function'&&validNumber(p.stock)&&validNumber(p.min)&&Number(p.stock)<=Number(p.min)).forEach(p=>push({type:'warning',icon:'▣',title:'Stock bajo',text:`${p.name}: ${p.stock} disponibles (mín. ${p.min}).`,date:'Inventario',key:`stock:${p.id||p.name}:${p.stock}`,action:()=>navigate('billing')}));
    }catch(e){console.warn('Alertas de facturación:',e)}
    const priority={danger:0,warning:1,info:2,success:3};
    const unique=new Map();alerts.forEach(a=>{if(!unique.has(a.key))unique.set(a.key,a)});
    return [...unique.values()].sort((a,b)=>(priority[a.type]??9)-(priority[b.type]??9));
  };

  window.refreshClinicAlertBadge=function(){
    const seen=getSeen(),all=computeClinicAlerts(),n=all.filter(a=>!seen[a.key]).length;
    const b=document.getElementById('clinic-alert-badge');if(!b)return;b.textContent=n>99?'99+':n;b.style.display=n?'block':'none';b.title=`${n} alerta${n===1?'':'s'} sin leer`;
  };
  window.markClinicAlertRead=function(key,rerender=true){const seen=getSeen();seen[key]=Date.now();saveSeen(seen);refreshClinicAlertBadge();if(rerender)renderClinicAlerts()};
  window.markAllClinicAlertsRead=function(){const seen=getSeen();computeClinicAlerts().forEach(a=>seen[a.key]=Date.now());saveSeen(seen);refreshClinicAlertBadge();renderClinicAlerts();};
  window.renderClinicAlerts=function(){
    const panel=document.getElementById('clinic-alert-panel');if(!panel)return;const alerts=computeClinicAlerts(),seen=getSeen();window.__clinicAlerts=alerts;
    const unread=alerts.filter(a=>!seen[a.key]).length;
    panel.innerHTML=`<div class="clinic-alert-head"><div><h3>Centro de alertas</h3><small>${unread} sin leer · ${alerts.length} activas</small></div><button class="modal-close" onclick="toggleClinicAlerts()">×</button></div><div class="clinic-alert-list">${alerts.length?alerts.map((a,i)=>`<div class="clinic-alert-item ${a.type} ${seen[a.key]?'is-read':''}" onclick="runClinicAlert(${i})"><div class="clinic-alert-icon">${a.icon}</div><div><div class="clinic-alert-title"><span class="clinic-alert-read-dot"></span>${typeof safeText==='function'?safeText(a.title):esc(a.title)}</div><div class="clinic-alert-text">${typeof safeText==='function'?safeText(a.text):esc(a.text)}</div></div><div class="clinic-alert-actions"><span class="clinic-alert-date">${typeof safeText==='function'?safeText(a.date||''):esc(a.date||'')}</span><button title="Marcar como leída" onclick="event.stopPropagation();markClinicAlertRead('${String(a.key).replace(/'/g,"\\'")}')">✓</button></div></div>`).join(''):'<div class="clinic-alert-empty">✓ No hay alertas pendientes en este momento.</div>'}</div><div class="clinic-alert-footer"><span>${alerts.length} alerta${alerts.length===1?'':'s'} activa${alerts.length===1?'':'s'}</span><div style="display:flex;gap:6px"><button class="btn btn-outline btn-sm" onclick="markAllClinicAlertsRead()">Marcar leídas</button><button class="btn btn-outline btn-sm" onclick="refreshClinicAlertBadge();renderClinicAlerts()">Actualizar</button></div></div>`;
  };
  window.runClinicAlert=function(i){const a=(window.__clinicAlerts||[])[i];if(!a)return;markClinicAlertRead(a.key,false);document.getElementById('clinic-alert-panel')?.classList.remove('open');if(a.action)a.action()};

  function reportPatients(){return (DB.patients||[]).filter(Boolean)}
  function latestEval(p){const e=(p.evaluaciones||[]).filter(Boolean).slice().sort((a,b)=>String(a.fecha||'').localeCompare(String(b.fecha||'')));return e[e.length-1]||null}
  function n(v){const x=Number(v);return Number.isFinite(x)?x:null}
  function reportToolbar(){return `<div class="nm-report-toolbar report-screen-only"><button class="btn btn-outline btn-sm" onclick="previewReportPDF()">Vista previa</button><button class="btn btn-outline btn-sm" onclick="printReportPDF()">Imprimir / PDF</button><button class="btn btn-olive btn-sm" onclick="downloadReportPDF()">Descargar PDF</button></div>`}
  window.generateAggregateReportHTML=function(type){
    const ps=reportPatients(),today=new Date(),month=today.getMonth(),year=today.getFullYear();
    const evals=ps.flatMap(p=>(p.evaluaciones||[]).map(e=>({...e,__p:p}))).filter(Boolean);
    const diets=ps.flatMap(p=>(p.dietas||[]).map(d=>({...d,__p:p}))).filter(Boolean);
    const appts=(DB.appointments||[]).filter(Boolean);
    const thisMonth=(x)=>{const d=new Date(String(x||'').slice(0,10)+'T12:00:00');return !Number.isNaN(d.getTime())&&d.getFullYear()===year&&d.getMonth()===month};
    const active=ps.filter(p=>p.activo!==false).length;
    const recentEvals=evals.filter(e=>thisMonth(e.fecha)).length;
    const completed=appts.filter(a=>String(a.estado||'').toLowerCase()==='completada').length;
    const validImcs=ps.map(p=>n(latestEval(p)?.imc??p.imc)).filter(v=>v!==null);
    const avgImc=validImcs.length?(validImcs.reduce((a,b)=>a+b,0)/validImcs.length).toFixed(1):'—';
    let section='';
    if(type==='Estadísticas'||type==='Resumen Clínico'){
      const groups=[['Bajo peso',validImcs.filter(v=>v<18.5).length],['Normal',validImcs.filter(v=>v>=18.5&&v<25).length],['Sobrepeso',validImcs.filter(v=>v>=25&&v<30).length],['Obesidad',validImcs.filter(v=>v>=30).length]];
      const max=Math.max(1,...groups.map(x=>x[1]));
      section=`<div class="nmr-section"><h3>Distribución por IMC</h3><div class="nmr-bars">${groups.map(g=>`<div class="nmr-bar"><span>${g[0]}</span><div class="nmr-track"><div class="nmr-fill" style="width:${g[1]/max*100}%"></div></div><b>${g[1]}</b></div>`).join('')}</div></div>`;
    }else if(type==='Planes Entregados'){
      section=`<div class="nmr-section"><h3>Planes nutricionales</h3><table class="nmr-table"><thead><tr><th>Paciente</th><th>Plan</th><th>Fecha</th><th>Estado</th></tr></thead><tbody>${diets.slice(-60).reverse().map(d=>`<tr><td>${esc(patientName(d.__p))}</td><td>${esc(d.nombre||d.tipo||'Plan nutricional')}</td><td>${esc(fmtDate(d.fecha||d.created_at||d.fechaInicio))}</td><td>${esc(d.estado||'Registrado')}</td></tr>`).join('')||'<tr><td colspan="4">No hay planes registrados.</td></tr>'}</tbody></table></div>`;
    }else if(type==='Consultas Realizadas'){
      section=`<div class="nmr-section"><h3>Consultas y evaluaciones recientes</h3><table class="nmr-table"><thead><tr><th>Fecha</th><th>Paciente</th><th>Tipo</th><th>Estado</th></tr></thead><tbody>${[...evals.map(e=>({fecha:e.fecha,p:patientName(e.__p),tipo:'Evaluación',estado:'Realizada'})),...appts.map(a=>({fecha:a.fecha,p:patientName(patientById(a.patientId))||a.nombreManual,tipo:'Cita',estado:a.estado||'Programada'}))].sort((a,b)=>String(b.fecha||'').localeCompare(String(a.fecha||''))).slice(0,70).map(r=>`<tr><td>${esc(fmtDate(r.fecha))}</td><td>${esc(r.p||'Paciente')}</td><td>${esc(r.tipo)}</td><td>${esc(r.estado)}</td></tr>`).join('')||'<tr><td colspan="4">No hay consultas registradas.</td></tr>'}</tbody></table></div>`;
    }else if(type==='Progreso General'){
      const rows=ps.map(p=>{const ev=(p.evaluaciones||[]).filter(Boolean).slice().sort((a,b)=>String(a.fecha||'').localeCompare(String(b.fecha||'')));if(ev.length<2)return null;const a=n(ev[0].peso),b=n(ev[ev.length-1].peso);if(a===null||b===null)return null;return {p,delta:b-a,last:ev[ev.length-1].fecha}}).filter(Boolean).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));
      section=`<div class="nmr-section"><h3>Cambios de peso con al menos 2 evaluaciones</h3><table class="nmr-table"><thead><tr><th>Paciente</th><th>Cambio</th><th>Última evaluación</th></tr></thead><tbody>${rows.slice(0,60).map(r=>`<tr><td>${esc(patientName(r.p))}</td><td>${r.delta>0?'+':''}${r.delta.toFixed(1)} kg</td><td>${esc(fmtDate(r.last))}</td></tr>`).join('')||'<tr><td colspan="3">Aún no hay suficientes evaluaciones comparables.</td></tr>'}</tbody></table></div>`;
    }
    const embeddedStyle='<style>'+String(document.getElementById('nm-notifications-reports-v2-style')?.textContent||'')+'</style>'; return `${embeddedStyle}${reportToolbar()}<div class="clinical-report nm-report-summary" data-patient="${esc(type)}"><div class="nmr-page"><div class="nmr-head"><div class="nmr-title"><b>${esc(type||'Reporte')}</b><span>NutriMachata · Generado ${esc(new Date().toLocaleString('es-DO'))}</span></div><div style="font-size:10px;text-align:right;color:#6f796a">Reporte operativo y clínico<br>Datos actuales del sistema</div></div><div class="nmr-grid"><div class="nmr-kpi"><small>Pacientes</small><b>${ps.length}</b></div><div class="nmr-kpi"><small>Activos</small><b>${active}</b></div><div class="nmr-kpi"><small>Evaluaciones del mes</small><b>${recentEvals}</b></div><div class="nmr-kpi"><small>IMC promedio</small><b>${avgImc}</b></div></div>${section}<div class="nmr-section"><h3>Lectura rápida</h3><div class="nmr-note">Evaluaciones registradas: <b>${evals.length}</b> · Planes: <b>${diets.length}</b> · Citas: <b>${appts.length}</b> · Citas completadas: <b>${completed}</b>. Los resultados dependen de los datos clínicos actualmente registrados en Supabase.</div></div></div></div>`;
  };

  window.openReportModal=function(patientId,type){
    const body=document.getElementById('report-modal-body');if(!body)return;
    let p=null;if(patientId!==null&&patientId!==undefined&&String(patientId).trim()!=='')p=(DB.patients||[]).find(x=>String(x.id)===String(patientId));
    const title=document.querySelector('#modal-report .modal-title');if(title)title.textContent=p?`Reporte Clínico · ${patientName(p)}`:(type||'Reporte Clínico');
    if(p){body.innerHTML=reportToolbar()+generateReportHTML(p)}else if(type){body.innerHTML=generateAggregateReportHTML(type)}else{body.innerHTML='<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-title">Seleccione un paciente</div><div class="empty-text">Elija un paciente para generar su reporte clínico completo.</div></div>'}
    openModal('modal-report');
  };
  window.generatePatientReport=function(){
    const sel=document.getElementById('report-patient-select');const pid=String(sel?.value||'').trim();if(!pid){notify('Seleccione un paciente','warning');return}const p=(DB.patients||[]).find(x=>String(x.id)===pid);if(!p){notify('El paciente seleccionado ya no existe o no está disponible','danger');return}openReportModal(pid,'Reporte Individual');
  };
  const oldRenderReports=window.renderReports||renderReports;
  window.renderReports=function(){oldRenderReports();const sel=document.getElementById('report-patient-select');if(sel){const current=sel.value;sel.innerHTML='<option value="">Seleccionar paciente...</option>'+reportPatients().slice().sort((a,b)=>patientName(a).localeCompare(patientName(b),'es',{sensitivity:'base'})).map(p=>`<option value="${esc(p.id)}">${esc(patientName(p))}</option>`).join('');if([...sel.options].some(o=>o.value===current))sel.value=current}}
  // Actualizar la referencia usada por navigateTo, que llama a la función global por nombre.
  try{renderReports=window.renderReports}catch(e){}
  setTimeout(()=>{refreshClinicAlertBadge();},400);
})();
