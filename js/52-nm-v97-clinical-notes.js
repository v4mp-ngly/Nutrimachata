/* NutriMachata v97 - Historia inicial inmutable + bitácora clínica cronológica */
(function(){
 const esc97=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 const clinicalRole97=()=>['admin','doctor','doctora','nutricionista'].includes(String(DB?.currentRole||'').toLowerCase());
 const patientRole97=()=>String(DB?.currentRole||'').toLowerCase()==='patient';
 const fmtDate97=v=>{if(!v)return 'Sin fecha';try{return new Date(v).toLocaleString('es-DO',{dateStyle:'medium',timeStyle:'short'})}catch(_){return String(v)}};
 async function loadNotes97(patientId){
   if(patientRole97()) return [];
   return await supa(`notas_clinicas?paciente_id=eq.${encodeURIComponent(patientId)}&select=*&order=created_at.desc`,'GET');
 }
 window.renderClinicalNotesV97=async function(patientId){
   const root=document.getElementById('nm-bitacora-v97-'+patientId); if(!root)return;
   if(!clinicalRole97()){root.innerHTML='<div class="empty-state"><div class="empty-title">Contenido clínico interno</div><div class="empty-text">Las notas de evolución son de uso exclusivo del equipo médico.</div></div>';return;}
   root.innerHTML='<div class="card"><div class="card-body" style="padding:28px;text-align:center;color:var(--gray-500)">Cargando notas...</div></div>';
   try{
    const rows=await loadNotes97(patientId);
    root.innerHTML=`<div class="nm97-initial-lock"><b>Historia clínica inicial:</b> corresponde a la admisión original del paciente. Las consultas posteriores se documentan aquí como notas independientes y no reemplazan esa historia.</div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap"><div><h3 style="margin:0;color:var(--olive-dark)">Evolución clínica</h3><div class="text-muted text-sm">${rows.length} nota${rows.length===1?'':'s'} registrada${rows.length===1?'':'s'}</div></div><button class="btn btn-olive btn-sm" onclick="openClinicalNoteV97('${patientId}')">+ Nueva nota clínica</button></div>
      ${rows.length?rows.map(n=>`<div class="card nm97-note-card"><div class="card-body"><div class="nm97-note-head"><div><div class="nm97-note-date">${esc97(fmtDate97(n.created_at))}</div><div class="nm97-note-doctor">🩺 ${esc97(n.doctor_nombre||'Profesional de salud')}</div></div>${n.updated_at&&n.updated_at!==n.created_at?`<span class="badge badge-gray">Editada ${esc97(fmtDate97(n.updated_at))}</span>`:''}</div><div class="nm97-note-body" style="margin-top:12px">${esc97(n.nota||'')}</div>${(n.indicaciones||n.proximo_objetivo)?`<div class="nm97-note-grid">${n.indicaciones?`<div class="nm97-note-box"><small>Indicaciones</small><div>${esc97(n.indicaciones)}</div></div>`:''}${n.proximo_objetivo?`<div class="nm97-note-box"><small>Próximo objetivo</small><div>${esc97(n.proximo_objetivo)}</div></div>`:''}</div>`:''}</div></div>`).join(''):'<div class="empty-state" style="padding:34px"><div class="empty-icon">📝</div><div class="empty-title">Sin notas clínicas todavía</div><div class="empty-text">La primera consulta posterior a la admisión aparecerá aquí.</div></div>'}`;
   }catch(e){console.error('[Bitácora v97]',e);root.innerHTML=`<div class="alert alert-danger">No se pudo cargar la bitácora clínica: ${esc97(e.message||e)}</div>`;}
 };
 window.openClinicalNoteV97=function(patientId){
   if(!clinicalRole97())return notify('Solo el equipo médico puede crear notas clínicas.','danger');
   const p=(DB.patients||[]).find(x=>String(x.id)===String(patientId));
   document.getElementById('nm-v97-note-modal')?.remove();
   document.body.insertAdjacentHTML('beforeend',`<div class="modal-overlay open" id="nm-v97-note-modal" style="z-index:10030"><div class="modal modal-lg"><div class="modal-header"><div><div class="modal-title">Nueva nota clínica</div><div class="modal-subtitle">${esc97(p?.nombre||'Paciente')} · La fecha, hora y profesional se guardan automáticamente.</div></div><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button></div><div class="modal-body"><div class="form-group"><label>Nota de evolución *</label><textarea id="nm97-note" class="form-control" rows="8" placeholder="Evolución desde la consulta anterior, hallazgos, tolerancia, adherencia, síntomas, cambios relevantes..."></textarea></div><div class="form-row"><div class="form-group"><label>Indicaciones</label><textarea id="nm97-indications" class="form-control" rows="4" placeholder="Indicaciones médicas o nutricionales..."></textarea></div><div class="form-group"><label>Próximo objetivo</label><textarea id="nm97-goal" class="form-control" rows="4" placeholder="Objetivo para el próximo seguimiento..."></textarea></div></div></div><div class="modal-footer"><button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button><button class="btn btn-olive" id="nm97-save-note" onclick="saveClinicalNoteV97('${patientId}')">Guardar nota</button></div></div></div>`);
 };
 window.saveClinicalNoteV97=async function(patientId){
   const note=document.getElementById('nm97-note')?.value.trim()||''; if(!note)return notify('Escribe la nota de evolución antes de guardar.','warning');
   const btn=document.getElementById('nm97-save-note'); if(btn){btn.disabled=true;btn.textContent='Guardando...'}
   try{
    const session=await ensureSupaSession();
    const sessionEmail=String(session?.user?.email||'').trim().toLowerCase();
    const appEmail=String(DB?.currentUser?.email||'').trim().toLowerCase();
    const appRole=String(DB?.currentRole||DB?.currentUser?.role||DB?.currentUser?.rol||'').trim().toLowerCase();
    const emails=[];
    const addEmail=e=>{e=String(e||'').trim().toLowerCase();if(e&&/^\S+@\S+\.\S+$/.test(e)&&!emails.includes(e))emails.push(e)};
    // El administrador principal de NutriMachata debe firmar con su usuarios.id,
    // no con auth.users.id. Para doctores se resuelve por el correo autenticado.
    if(appRole==='admin' && typeof NUTRI_ADMIN_EMAIL!=='undefined') addEmail(NUTRI_ADMIN_EMAIL);
    addEmail(appEmail); addEmail(sessionEmail);
    let professional=null;
    for(const email of emails){
      const rows=await supa(`usuarios?email=eq.${encodeURIComponent(email)}&select=id,email,nombre,rol,activo&limit=1`,'GET').catch(()=>[]);
      const row=Array.isArray(rows)?rows[0]:null;
      if(row?.id){professional=row;break}
    }
    if(!professional?.id) throw new Error('No se encontró en usuarios el perfil profesional asociado a esta sesión. Revisa el correo del administrador/doctor.');
    const role=String(professional.rol||'').toLowerCase();
    if(!['admin','doctor','doctora','nutricionista'].includes(role)) throw new Error('El usuario autenticado no tiene un perfil profesional autorizado para firmar notas clínicas.');
    if(professional.activo===false) throw new Error('Este profesional está desactivado y no puede firmar notas clínicas.');
    const doctorName=professional.nombre||professional.email||'Profesional de salud';
    const payload={paciente_id:patientId,doctor_id:professional.id,doctor_nombre:doctorName,nota:note,indicaciones:document.getElementById('nm97-indications')?.value.trim()||null,proximo_objetivo:document.getElementById('nm97-goal')?.value.trim()||null};
    console.info('[Bitácora] Profesional resuelto:',{doctor_id:professional.id,doctor_nombre:doctorName,email:professional.email,rol:role});
    const r=await supa('notas_clinicas?select=*','POST',payload);
    if(!Array.isArray(r)||!r[0]?.id)throw new Error('Supabase no confirmó la nota clínica guardada.');
    document.getElementById('nm-v97-note-modal')?.remove(); notify('Nota clínica guardada con fecha y profesional.','success'); await renderClinicalNotesV97(patientId);
   }catch(e){console.error('[Guardar nota v102]',e);notify('No se pudo guardar la nota clínica: '+(e.message||e),'danger');if(btn){btn.disabled=false;btn.textContent='Guardar nota'}}
 };
 const oldSwitch97=window.switchHCTabPage;
 window.switchHCTabPage=function(tab,patientId){const r=oldSwitch97?.apply(this,arguments);if(tab==='bitacora')setTimeout(()=>renderClinicalNotesV97(patientId),20);return r};
 const oldOpen97=window.openHistoriaClinica;
 window.openHistoriaClinica=function(patientId,activeTab){const r=oldOpen97?.apply(this,arguments);if((activeTab||'resumen')==='bitacora')setTimeout(()=>renderClinicalNotesV97(patientId),50);return r};
 window.NMV97ClinicalNotes=true;
 window.NMV101ClinicalNotesFKFix=true;
 window.NMV102ClinicalNotesUserIdFix=true;
 window.NMV101CreditBalancesFix=true;
})();
