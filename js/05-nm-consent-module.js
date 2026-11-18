(function(){
 const CFG='nutrimachata_consent_config_v1';
 const consentCache={}; const consentLoaded=new Set(); const consentLoading=new Map();
 const defaults=[
  {id:'consent_informado',name:'Consentimiento informado',url:'https://forms.gle/DGacRNAi2ZY4yfve9',active:true,required:true,version:'v1'},
  {id:'tratamiento_datos',name:'Consentimiento / tratamiento de datos',url:'https://forms.gle/BsaegXduM4KsPEA27',active:true,required:true,version:'v1'}
 ];
 function read(k,f){try{const v=JSON.parse(sessionStorage.getItem(k)||'null');return v||f}catch(e){return f}}
 function write(k,v){try{sessionStorage.setItem(k,JSON.stringify(v));return true}catch(e){notify?.('No se pudo guardar la configuración de consentimientos','danger');return false}}
 window.getConsentConfig=()=>read(CFG,defaults.map(x=>({...x})));
 window.getConsentRecords=()=>consentCache;
 function token(){try{return typeof supaAccessToken==='function'?supaAccessToken():''}catch(e){return ''}}
 function authUid(){try{return typeof currentAuthUserId==='function'?currentAuthUserId():null}catch(e){return null}}
 async function consentFetch(path,method='GET',body=null,prefer=''){
  const t=token(); if(!t)throw new Error('No hay una sesión activa de Supabase.');
  const headers={apikey:SUPA_ANON,Authorization:'Bearer '+t,'Content-Type':'application/json'}; if(prefer)headers.Prefer=prefer;
  const res=await (typeof nmFetchTimeout==='function'?nmFetchTimeout:fetch)(SUPA_URL.replace(/\/$/,'')+'/rest/v1/'+path,{method,headers,body:body==null?undefined:JSON.stringify(body),mode:'cors',credentials:'omit'}); // v131: con tiempo límite
  const raw=await res.text(); let data=null; try{data=raw?JSON.parse(raw):null}catch(_){data=raw}
  if(!res.ok){const msg=(data&&typeof data==='object'&&(data.message||data.details||data.hint))||raw||('HTTP '+res.status);throw new Error(msg)} return data;
 }
 async function loadPatientConsents(pid,force=false){
  const key=pkey(pid); if(!key)return {}; if(consentLoaded.has(key)&&!force)return consentCache[key]||{}; if(consentLoading.has(key))return consentLoading.get(key);
  const job=(async()=>{const rows=await consentFetch('consentimientos_pacientes?paciente_id=eq.'+encodeURIComponent(key)+'&select=*'); const map={}; (rows||[]).forEach(r=>{map[r.tipo_consentimiento]={completed:!!r.completado,verifiedAt:r.fecha_recepcion,verifiedBy:r.verificado_por?'Usuario '+r.verificado_por.slice(0,8):'Profesional de salud',version:r.version||'v1',name:r.nombre_consentimiento,observaciones:r.observaciones||'',dbId:r.id}}); consentCache[key]=map; consentLoaded.add(key); return map})().finally(()=>consentLoading.delete(key)); consentLoading.set(key,job); return job;
 }
 window.loadPatientConsents=loadPatientConsents;
 function pkey(id){return String(id)}
 function doctorName(){return DB?.currentUser?.name||'Profesional de salud'}
 window.getPatientConsentSummary=function(pid){
  const forms=getConsentConfig().filter(x=>x.active);const rec=getConsentRecords()[pkey(pid)]||{};
  const required=forms.filter(x=>x.required); const done=required.filter(f=>rec[f.id]?.completed).length;
  return {forms,rec,required,done,total:required.length,complete:required.length===0||done===required.length};
 };
 window.markConsentReceived=async function(pid,fid,checked=true){
  const key=pkey(pid), form=getConsentConfig().find(x=>x.id===fid); if(!form||!key)return;
  try{
   const now=new Date().toISOString();
   const payload={paciente_id:key,tipo_consentimiento:fid,nombre_consentimiento:form.name,completado:!!checked,fecha_recepcion:checked?now:null,verificado_por:checked?authUid():null,version:form.version||'v1'};
   await consentFetch('consentimientos_pacientes?on_conflict=paciente_id%2Ctipo_consentimiento','POST',payload,'resolution=merge-duplicates,return=representation');
   consentCache[key]=consentCache[key]||{};
   if(checked)consentCache[key][fid]={completed:true,verifiedAt:now,verifiedBy:doctorName(),version:form.version||'v1',url:form.url,name:form.name};
   else consentCache[key][fid]={completed:false,verifiedAt:null,verifiedBy:'',version:form.version||'v1',url:form.url,name:form.name};
   consentLoaded.add(key); notify?.(checked?'Consentimiento guardado en Supabase':'Consentimiento marcado como pendiente','success');
   if(currentPage==='consents')await renderConsents(); refreshEvalConsentBox?.(key);
  }catch(e){console.error('[Consentimientos Supabase]',e);notify?.('No se pudo guardar el consentimiento: '+e.message,'danger')}
 };
 window.openConsentForm=function(fid){const f=getConsentConfig().find(x=>x.id===fid);if(f?.url)window.open(f.url,'_blank','noopener,noreferrer')};
 let consentTab='patients';
 window.setConsentTab=function(t){consentTab=t;renderConsents()};
 function esc(v){return String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
 window.renderConsents=async function(){
  const root=document.getElementById('page-content'); if(!root)return;
  const pats=(DB?.patients||[]).filter(p=>p.activo!==false), forms=getConsentConfig().filter(f=>f.active), required=forms.filter(f=>f.required);
  try{await Promise.all(pats.map(p=>loadPatientConsents(p.id)))}catch(e){console.error('[Consentimientos carga]',e);notify?.('No se pudieron cargar algunos consentimientos desde Supabase','warning')}
  let complete=0, partial=0, pending=0; pats.forEach(p=>{const x=getPatientConsentSummary(p.id);if(x.complete)complete++;else if(x.done)partial++;else pending++});
  root.innerHTML=`<div class="consent-kpis"><div class="consent-kpi"><b>${pats.length}</b><span>Pacientes activos</span></div><div class="consent-kpi"><b>${complete}</b><span>Consentimientos completos</span></div><div class="consent-kpi"><b>${partial}</b><span>Parcialmente completados</span></div><div class="consent-kpi"><b>${pending}</b><span>Pendientes</span></div></div>
  <div class="consent-tabs"><button class="consent-tab ${consentTab==='patients'?'active':''}" onclick="setConsentTab('patients')">Pacientes</button><button class="consent-tab ${consentTab==='forms'?'active':''}" onclick="setConsentTab('forms')">Formularios</button><button class="consent-tab ${consentTab==='settings'?'active':''}" onclick="setConsentTab('settings')">Configuración</button></div>
  <div id="consent-tab-content"></div>`;
  if(consentTab==='patients')renderConsentPatients();else renderConsentForms(consentTab==='settings');
 };
 function renderConsentPatients(){
  const el=document.getElementById('consent-tab-content');const forms=getConsentConfig().filter(f=>f.active), pats=(DB?.patients||[]).filter(p=>p.activo!==false);
  el.innerHTML=`<div class="card"><div class="card-header"><div><div class="card-title">Estado por paciente</div><div class="card-subtitle">El profesional puede verificar manualmente cada consentimiento recibido</div></div></div><div class="table-container"><table><thead><tr><th>Paciente</th>${forms.map(f=>`<th>${esc(f.name)}</th>`).join('')}<th>Estado</th></tr></thead><tbody>${pats.map(p=>{const s=getPatientConsentSummary(p.id);return `<tr><td><b>${esc(p.nombre)}</b><div class="text-xs text-muted">${esc(p.email||p.telefono||'')}</div></td>${forms.map(f=>{const r=s.rec[f.id];return `<td><div class="consent-table-actions"><span class="consent-status ${r?.completed?'consent-ok':'consent-pending'}">${r?.completed?'✓ Recibido':'● Pendiente'}</span><button class="btn btn-outline btn-sm" onclick="openConsentForm('${f.id}')">Abrir</button><button class="btn ${r?.completed?'btn-outline':'btn-olive'} btn-sm" onclick="markConsentReceived('${p.id}','${f.id}',${r?.completed?'false':'true'})">${r?.completed?'Desmarcar':'Marcar recibido'}</button></div>${r?.completed?`<div class="consent-note">${new Date(r.verifiedAt).toLocaleString('es-DO')} · ${esc(r.verifiedBy||'')}</div>`:''}</td>`}).join('')}<td><b>${s.done}/${s.total}</b><div class="consent-meter"><i style="width:${s.total?Math.round(s.done/s.total*100):100}%"></i></div></td></tr>`}).join('')||'<tr><td colspan="8">No hay pacientes activos.</td></tr>'}</tbody></table></div></div>`;
 }
 function renderConsentForms(settings){
  const el=document.getElementById('consent-tab-content'); const forms=getConsentConfig();
  el.innerHTML=`<div class="consent-card"><div class="card-title">${settings?'Configuración de consentimientos':'Formularios activos'}</div><div class="card-subtitle">Puedes cambiar los enlaces sin editar el código. Los cambios se guardan en este navegador.</div></div>${forms.map((f,i)=>`<div class="consent-card"><div class="consent-form-grid"><div><label>Nombre</label><input class="form-control" id="cf-name-${i}" value="${esc(f.name)}"></div><div class="wide"><label>Enlace del formulario</label><input class="form-control" id="cf-url-${i}" value="${esc(f.url)}"></div><div><label>Versión</label><input class="form-control" id="cf-ver-${i}" value="${esc(f.version||'v1')}"></div><div><label>Opciones</label><label class="consent-switch"><input type="checkbox" id="cf-req-${i}" ${f.required?'checked':''}> Obligatorio</label><label class="consent-switch"><input type="checkbox" id="cf-act-${i}" ${f.active?'checked':''}> Activo</label></div></div><div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn btn-outline btn-sm" onclick="openConsentForm('${f.id}')">Abrir formulario</button><button class="btn btn-olive btn-sm" onclick="saveConsentForm(${i})">Guardar cambios</button></div></div>`).join('')}`;
 }
 window.saveConsentForm=function(i){const cfg=getConsentConfig();if(!cfg[i])return;const url=document.getElementById('cf-url-'+i).value.trim();if(!/^https?:\/\//i.test(url)){notify?.('Escribe un enlace válido que comience con http:// o https://','warning');return}Object.assign(cfg[i],{name:document.getElementById('cf-name-'+i).value.trim()||cfg[i].name,url,version:document.getElementById('cf-ver-'+i).value.trim()||'v1',required:document.getElementById('cf-req-'+i).checked,active:document.getElementById('cf-act-'+i).checked});if(write(CFG,cfg)){notify?.('Consentimiento actualizado','success');renderConsents()}};
 window.renderConsentInline=function(pid){const key=pkey(pid);if(!consentLoaded.has(key)){loadPatientConsents(key).then(()=>refreshEvalConsentBox?.(key)).catch(e=>console.error('[Consentimientos carga]',e))}const s=getPatientConsentSummary(pid);return `<div class="consent-inline-box"><div class="consent-inline-head"><div><b>Consentimientos</b><div class="consent-note">Verificación rápida antes de continuar</div></div><span class="consent-status ${s.complete?'consent-ok':'consent-pending'}">${s.complete?'✓ Completo':`${s.done}/${s.total} completados`}</span></div><div class="consent-meter"><i style="width:${s.total?Math.round(s.done/s.total*100):100}%"></i></div>${s.forms.map(f=>{const r=s.rec[f.id];return `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding-top:9px;flex-wrap:wrap"><span style="font-size:11px">${esc(f.name)}</span><div class="consent-table-actions"><button type="button" class="btn btn-outline btn-sm" onclick="openConsentForm('${f.id}')">Abrir</button><button type="button" class="btn ${r?.completed?'btn-outline':'btn-olive'} btn-sm" onclick="markConsentReceived('${pid}','${f.id}',${r?.completed?'false':'true'})">${r?.completed?'✓ Recibido':'Marcar recibido'}</button></div></div>`}).join('')}</div>`};
 window.refreshEvalConsentBox=function(pid){const box=document.getElementById('eval-consent-box');if(box)box.innerHTML=renderConsentInline(pid)};
 const oldResolve=window.resolveEvalPatientSearch;
 if(typeof oldResolve==='function')window.resolveEvalPatientSearch=function(){const r=oldResolve.apply(this,arguments);setTimeout(()=>{const pid=document.getElementById('eval-patient-select')?.value;const body=document.getElementById('eval-modal-body');let box=document.getElementById('eval-consent-box');if(pid&&body){if(!box){box=document.createElement('div');box.id='eval-consent-box';const firstForm=body.querySelector('.form-group');if(firstForm)firstForm.insertAdjacentElement('afterend',box);else body.insertBefore(box,body.firstChild)}box.innerHTML=renderConsentInline(pid)}else if(box){box.remove()}},20);return r};
 // Inserta control de consentimiento dentro del modal de nueva evaluacion sin alterar la logica clinica existente.
 const oldOpen=window.openEvalModal;
 if(typeof oldOpen==='function')window.openEvalModal=function(pid){const r=oldOpen.apply(this,arguments);setTimeout(()=>{const patientId=pid||document.getElementById('eval-patient-id')?.value||document.querySelector('[data-selected-patient-id]')?.dataset?.selectedPatientId;const body=document.getElementById('eval-modal-body');if(body&&patientId&&!document.getElementById('eval-consent-box')){const wrap=document.createElement('div');wrap.id='eval-consent-box';wrap.innerHTML=renderConsentInline(patientId);body.insertBefore(wrap,body.firstChild)}},100);return r};
})();
