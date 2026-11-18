/* NutriMachata v98 - Equipo medico dentro de Configuracion */
(function(){
 const esc98=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 const isAdmin98=()=>String(DB?.currentRole||'').toLowerCase()==='admin';
 const oldRenderSettings98=window.renderSettings||renderSettings;
 function teamIcon98(){return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/></svg>'}
 function injectTeam98(){
   if(!isAdmin98())return;
   document.getElementById('nav-team')?.remove();
   const side=document.querySelector('.settings-sidebar'); if(!side||side.querySelector('[data-nm98-team]'))return;
   const item=document.createElement('div'); item.className='settings-nav-item'; item.dataset.nm98Team='1'; item.innerHTML=teamIcon98()+' Equipo médico'; item.onclick=()=>switchSettingsTab('equipo',item); side.appendChild(item);
   const holder=document.querySelector('#settings-perfil')?.parentElement; if(!holder)return;
   const sec=document.createElement('div'); sec.id='settings-equipo'; sec.className='settings-section'; sec.innerHTML='<div class="settings-header"><h2>Equipo médico</h2><p>Doctores, accesos y asignación de pacientes</p></div><div id="nm98-team-root"><div class="card"><div class="card-body" style="text-align:center;padding:28px">Cargando equipo médico...</div></div></div>'; holder.appendChild(sec);
 }
 window.renderSettings=function(){
   if(!isAdmin98()){notify('Configuración es exclusiva de la administración.','warning');return navigate('patients')}
   oldRenderSettings98(); injectTeam98();
 };
 const oldSwitch98=window.switchSettingsTab||switchSettingsTab;
 window.switchSettingsTab=function(id,el){oldSwitch98(id,el);if(id==='equipo')setTimeout(renderTeamSettings98,0)};
 window.renderTeamSettings98=async function(){
   const root=document.getElementById('nm98-team-root');if(!root||!isAdmin98())return;
   root.innerHTML='<div class="card"><div class="card-body" style="text-align:center;padding:28px">Cargando equipo médico...</div></div>';
   try{
     const [users,assigns,pats]=await Promise.all([supa('usuarios?select=id,email,rol,nombre,telefono,especialidad,activo&order=nombre.asc','GET'),supa('asignaciones_pacientes?select=*&activo=eq.true&order=creado_en.desc','GET'),supa('pacientes?select=id,nombre,email,telefono&order=nombre.asc','GET')]);
     const docs=(users||[]).filter(u=>['admin','doctor','doctora','nutricionista'].includes(String(u.rol||'').toLowerCase()));
     const activeDocs=docs.filter(d=>d.activo!==false); const byPatient=new Map((assigns||[]).map(a=>[String(a.paciente_id),a])); const count=id=>(assigns||[]).filter(a=>String(a.especialista_id)===String(id)).length;
     root.innerHTML=`<div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><div><h3 style="margin:0;color:var(--olive-dark)">Profesionales</h3><div class="text-sm text-muted">La Dra. Chalas administra el equipo y las asignaciones.</div></div><button class="btn btn-olive" onclick="openDoctor98()">+ Nuevo doctor</button></div>
     <div class="nm98-team-kpis"><div class="nm98-team-kpi"><small>Administradores</small><b>${docs.filter(d=>String(d.rol).toLowerCase()==='admin'&&d.activo!==false).length}</b></div><div class="nm98-team-kpi"><small>Doctores activos</small><b>${activeDocs.filter(d=>String(d.rol).toLowerCase()!=='admin').length}</b></div><div class="nm98-team-kpi"><small>Pacientes asignados</small><b>${byPatient.size}</b></div><div class="nm98-team-kpi"><small>Sin asignar</small><b>${Math.max(0,(pats||[]).length-byPatient.size)}</b></div></div>
     <div class="card mb-4"><div class="card-header"><div><div class="card-title">Equipo médico</div><div class="card-subtitle">Crear, editar y activar/desactivar profesionales.</div></div></div><div class="card-body">${docs.map(d=>`<div class="nm98-doctor-card"><div class="nm98-doctor-top"><div><div class="nm98-doctor-name">${esc98(d.nombre||d.email)} ${String(d.rol).toLowerCase()==='admin'?'<span class="badge badge-olive">Administración principal</span>':''}</div><div class="nm98-doctor-meta">${esc98(d.especialidad||'Nutrición / Medicina')} · ${esc98(d.email||'')} ${d.telefono?'· '+esc98(d.telefono):''}</div><div class="nm98-doctor-meta"><b>${count(d.id)}</b> paciente(s) asignado(s) · ${d.activo===false?'Inactivo':'Activo'}</div></div><div class="nm98-team-actions"><button class="btn btn-outline btn-sm" onclick="openDoctor98('${d.id}')">Editar</button>${String(d.rol).toLowerCase()!=='admin'?`<button class="btn btn-outline btn-sm" onclick="toggleDoctor98('${d.id}',${d.activo===false?'true':'false'})">${d.activo===false?'Activar':'Desactivar'}</button>`:''}</div></div></div>`).join('')||'<div class="empty-state">No hay profesionales registrados.</div>'}</div></div>
     <div class="card"><div class="card-header"><div><div class="card-title">Asignación de pacientes</div><div class="card-subtitle">Los pacientes nuevos quedan sin doctor hasta que la administración los asigne.</div></div></div><div class="card-body">${(pats||[]).map(p=>{const a=byPatient.get(String(p.id));return `<div class="nm98-assign-grid"><div><b>${esc98(p.nombre||'Paciente')}</b><div class="text-xs text-muted">${esc98(p.email||p.telefono||'')}</div></div><div><label class="text-xs">Doctor responsable</label><select class="form-select" id="nm98-doc-${p.id}"><option value="">Sin doctor asignado</option>${activeDocs.map(d=>`<option value="${d.id}" ${a&&String(a.especialista_id)===String(d.id)?'selected':''}>${esc98(d.nombre||d.email)}${String(d.rol).toLowerCase()==='admin'?' (Admin)':''}</option>`).join('')}</select></div><button class="btn btn-olive btn-sm" onclick="assignDoctor98('${p.id}')">Guardar</button></div>`}).join('')||'<div class="empty-state">No hay pacientes.</div>'}</div></div>`;
     window.NM98TeamCache={docs,assigns,pats};
   }catch(e){console.error('[Equipo medico v98]',e);root.innerHTML=`<div class="alert alert-danger">No se pudo cargar Equipo médico. Ejecuta el SQL v98 en Supabase. ${esc98(e.message||e)}</div>`}
 };
 window.openDoctor98=function(id=''){
   if(!isAdmin98())return; const d=id?(window.NM98TeamCache?.docs||[]).find(x=>String(x.id)===String(id)):null;
   document.getElementById('nm98-doctor-modal')?.remove(); document.body.insertAdjacentHTML('beforeend',`<div class="modal-overlay open" id="nm98-doctor-modal" style="z-index:10060"><div class="modal" style="max-width:760px"><div class="modal-header"><div><div class="modal-title">${d?'Editar profesional':'Nuevo doctor'}</div><div class="modal-subtitle">${d?'Actualiza los datos del profesional.':'Crea la cuenta de acceso y el perfil médico.'}</div></div><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button></div><div class="modal-body"><input id="nm98-doctor-id" type="hidden" value="${esc98(d?.id||'')}"><div class="form-row"><div class="form-group"><label>Nombre completo *</label><input id="nm98-doctor-name" class="form-control" value="${esc98(d?.nombre||'')}"></div><div class="form-group"><label>Especialidad</label><input id="nm98-doctor-specialty" class="form-control" value="${esc98(d?.especialidad||'')}"></div></div><div class="form-row"><div class="form-group"><label>Correo *</label><input id="nm98-doctor-email" type="email" class="form-control" value="${esc98(d?.email||'')}" ${d?'readonly':''}></div><div class="form-group"><label>Teléfono</label><input id="nm98-doctor-phone" class="form-control" value="${esc98(d?.telefono||'')}"></div></div>${d?'':`<div class="form-group"><label>Contraseña inicial *</label><input id="nm98-doctor-password" type="password" class="form-control" minlength="6" placeholder="Mínimo 6 caracteres"><div class="text-xs text-muted mt-2">El doctor podrá iniciar sesión con este correo y contraseña. Si Supabase exige confirmación de correo, deberá confirmar el mensaje recibido.</div></div>`}</div><div class="modal-footer"><button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button><button class="btn btn-olive" id="nm98-save-doctor" onclick="saveDoctor98()">${d?'Guardar cambios':'Crear doctor'}</button></div></div></div>`)
 };
 window.saveDoctor98=async function(){
   if(!isAdmin98())return;
   const id=document.getElementById('nm98-doctor-id')?.value||'',
         name=document.getElementById('nm98-doctor-name')?.value.trim()||'',
         emailRaw=document.getElementById('nm98-doctor-email')?.value||'',
         email=emailRaw.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/\s+/g,'').trim().toLowerCase(),
         specialty=document.getElementById('nm98-doctor-specialty')?.value.trim()||'',
         phone=document.getElementById('nm98-doctor-phone')?.value.trim()||'',
         btn=document.getElementById('nm98-save-doctor');
   if(!name||!email)return notify('Completa nombre y correo.','warning');
   const emailInput=document.getElementById('nm98-doctor-email');
   if(emailInput)emailInput.value=email;
   const emailOk=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
   if(!emailOk)return notify('El correo no tiene un formato válido. Ejemplo: doctor@correo.com','warning');
   if(btn){btn.disabled=true;btn.textContent='Guardando...'}
   try{
     await ensureSupaSession();
     if(id){await supa(`usuarios?id=eq.${encodeURIComponent(id)}`,'PATCH',{nombre:name,telefono:phone||null,especialidad:specialty||null});}
     else{const password=document.getElementById('nm98-doctor-password')?.value||'';if(password.length<6)throw new Error('La contraseña inicial debe tener al menos 6 caracteres.');const auth=await supaAuthSignUp(email,password,{name,role:'doctor'});const uid=auth?.user?.id;if(!uid)throw new Error('Supabase Auth no devolvió el ID del nuevo doctor.');await supa('usuarios?select=*','POST',{id:uid,email,rol:'doctor',nombre:name,telefono:phone||null,especialidad:specialty||null,activo:true});}
     document.getElementById('nm98-doctor-modal')?.remove();notify(id?'Profesional actualizado.':'Doctor creado correctamente.','success');await renderTeamSettings98();
   }catch(e){console.error('[Guardar doctor v98]',e);notify('No se pudo guardar el doctor: '+(e.message||e),'danger');if(btn){btn.disabled=false;btn.textContent=id?'Guardar cambios':'Crear doctor'}}
 };
 window.toggleDoctor98=async function(id,active){try{await supa(`usuarios?id=eq.${encodeURIComponent(id)}`,'PATCH',{activo:!!active});notify(active?'Doctor activado.':'Doctor desactivado.','success');await renderTeamSettings98()}catch(e){notify('No se pudo cambiar el estado: '+(e.message||e),'danger')}};
 window.assignDoctor98=async function(patientId){
   if(!isAdmin98())return;const doctorId=document.getElementById('nm98-doc-'+patientId)?.value||'';
   try{const existing=await supa(`asignaciones_pacientes?paciente_id=eq.${encodeURIComponent(patientId)}&activo=eq.true&select=id`,'GET');for(const row of(existing||[]))await supa(`asignaciones_pacientes?id=eq.${encodeURIComponent(row.id)}`,'PATCH',{activo:false});if(doctorId)await supa('asignaciones_pacientes','POST',{paciente_id:patientId,especialista_id:doctorId,activo:true,asignado_por:DB.currentUser?.supabaseId||DB.currentUser?.id||null});notify(doctorId?'Paciente asignado correctamente.':'Paciente dejado sin doctor asignado.','success');await renderTeamSettings98()}catch(e){console.error('[Asignar v98]',e);notify('No se pudo guardar la asignación: '+(e.message||e),'danger')}
 };
 // Equipo médico deja de ser una página independiente: se administra desde Configuración.
 const idx=ADMIN_NAV.findIndex(x=>x.id==='team');if(idx>=0)ADMIN_NAV.splice(idx,1);
 delete PAGES.team;
 setTimeout(()=>document.getElementById('nav-team')?.remove(),0);
 window.NMV98TeamSettings=true;
})();
