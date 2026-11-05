/* NutriMachata v96 - Jerarquia Admin > Doctor > Paciente */
(function(){
  const isAdmin=()=>String(DB?.currentRole||'').toLowerCase()==='admin';
  const isDoctor=()=>['doctor','doctora','nutricionista'].includes(String(DB?.currentRole||'').toLowerCase());
  window.NMRoleV96={isAdmin,isDoctor};

  const doctorNavIds=['patients','historias','evaluations','consents','diets','agenda','analisis'];
  window.DOCTOR_NAV_V96=ADMIN_NAV.filter(x=>doctorNavIds.includes(x.id)).map((x,i)=>({...x,section:i===0?'Atención clínica':null}));
  PAGES.team={title:'Equipo médico',subtitle:'Doctores y asignación de pacientes',action:null};
  ADMIN_NAV.splice(ADMIN_NAV.findIndex(x=>x.id==='settings'),0,{id:'team',icon:'<span style="font-size:17px">🩺</span>',label:'Equipo médico',section:'Sistema'});

  window.initApp=function(){
    const initKey=`${DB.currentRole||''}:${DB.currentUser?.id||DB.currentUser?.email||''}`;
    if(!NMRuntime.shouldInit(initKey)){console.info('[NutriMachata] initApp duplicado ignorado:',initKey);return;}
    NMRuntime.bindDelegates();
    const nav=isAdmin()?ADMIN_NAV:(isDoctor()?DOCTOR_NAV_V96:PATIENT_NAV);
    const sidebar=document.getElementById('sidebar-nav'); let html='',lastSection=null;
    nav.forEach(item=>{if(item.section&&item.section!==lastSection){html+=`<div class="nav-section-label">${item.section}</div>`;lastSection=item.section;}html+=`<button class="nav-item" id="nav-${item.id}" onclick="navigate('${item.id}')"><span class="nav-icon">${item.icon}</span>${item.label}${item.badge?`<span class="nav-badge">${item.badge}</span>`:''}</button>`;});
    sidebar.innerHTML=html;
    document.getElementById('user-avatar-sidebar').textContent=DB.currentUser.initials;
    document.getElementById('user-name-sidebar').textContent=DB.currentUser.name;
    document.getElementById('user-role-sidebar').textContent=isAdmin()?'Administrador principal':(isDoctor()?'Doctor/a':'Paciente');
    navigate(isAdmin()?'dashboard':(isDoctor()?'patients':'portal'));
  };

  const oldNavigate=window.navigate;
  window.navigate=function(page){
    if(isDoctor() && !doctorNavIds.includes(page)){notify('Este módulo es exclusivo de la administración.','warning');page='patients';}
    if(!isAdmin()&&!isDoctor() && !['portal','my-diet','my-history','my-appointments','my-measures'].includes(page)){page='portal';}
    if(page==='team'){renderMedicalTeamV96();return;}
    return oldNavigate(page);
  };

  window.renderMedicalTeamV96=async function(){
    if(!isAdmin()){notify('Solo la administradora principal puede gestionar asignaciones.','danger');return navigate('patients');}
    currentPage='team';
    document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));document.getElementById('nav-team')?.classList.add('active');
    document.getElementById('page-title').textContent='Equipo médico';document.getElementById('page-subtitle').textContent='Doctores y asignación de pacientes';document.getElementById('topbar-action').style.display='none';
    const root=document.getElementById('page-content');root.innerHTML='<div class="card" style="padding:28px;text-align:center">Cargando equipo médico...</div>';
    try{
      const [users,assigns,pats]=await Promise.all([
        supa('usuarios?select=id,email,rol,nombre&order=nombre.asc','GET'),
        supa('asignaciones_pacientes?select=*&activo=eq.true&order=creado_en.desc','GET'),
        supa('pacientes?select=id,nombre,email,telefono&order=nombre.asc','GET')
      ]);
      const docs=(users||[]).filter(u=>['admin','doctor','doctora','nutricionista'].includes(String(u.rol||'').toLowerCase()));
      const byPatient=new Map((assigns||[]).map(a=>[String(a.paciente_id),a]));
      const countFor=id=>(assigns||[]).filter(a=>String(a.especialista_id)===String(id)).length;
      root.innerHTML=`
      <div class="grid grid-4 mb-4">
        <div class="kpi-card"><div class="kpi-label">Administración principal</div><div class="kpi-value" style="font-size:20px">Dra. Chalas</div></div>
        <div class="kpi-card"><div class="kpi-label">Doctores activos</div><div class="kpi-value">${docs.filter(d=>String(d.rol).toLowerCase()!=='admin').length}</div></div>
        <div class="kpi-card"><div class="kpi-label">Pacientes asignados</div><div class="kpi-value">${byPatient.size}</div></div>
        <div class="kpi-card"><div class="kpi-label">Sin asignar</div><div class="kpi-value">${Math.max(0,(pats||[]).length-byPatient.size)}</div></div>
      </div>
      <div class="card mb-4"><div class="card-header"><div><div class="card-title">Equipo médico</div><div class="card-subtitle">La administradora conserva acceso total. Cada doctor ve únicamente sus pacientes asignados.</div></div></div>
      <div class="table-container"><table><thead><tr><th>PROFESIONAL</th><th>ROL</th><th>EMAIL</th><th style="text-align:center">PACIENTES</th></tr></thead><tbody>${docs.map(d=>`<tr><td><b>${esc(d.nombre||d.email)}</b></td><td><span class="badge badge-olive">${String(d.rol).toLowerCase()==='admin'?'Administrador principal':'Doctor/a'}</span></td><td>${esc(d.email||'')}</td><td style="text-align:center"><b>${countFor(d.id)}</b></td></tr>`).join('')||'<tr><td colspan="4">No hay doctores registrados.</td></tr>'}</tbody></table></div></div>
      <div class="card"><div class="card-header"><div><div class="card-title">Asignación de pacientes</div><div class="card-subtitle">Solo la Dra. Chalas / administración puede cambiar estas asignaciones.</div></div></div>
      <div class="table-container"><table><thead><tr><th>PACIENTE</th><th>CONTACTO</th><th>DOCTOR RESPONSABLE</th><th>ACCIÓN</th></tr></thead><tbody>${(pats||[]).map(p=>{const a=byPatient.get(String(p.id));return `<tr><td><b>${esc(p.nombre||'Paciente')}</b></td><td>${esc(p.email||p.telefono||'—')}</td><td><select class="form-select" id="nm-doc-${p.id}"><option value="">Sin doctor asignado</option>${docs.map(d=>`<option value="${d.id}" ${a&&String(a.especialista_id)===String(d.id)?'selected':''}>${esc(d.nombre||d.email)}${String(d.rol).toLowerCase()==='admin'?' (Admin)':''}</option>`).join('')}</select></td><td><button class="btn btn-olive btn-sm" onclick="nmAssignDoctorV96('${p.id}')">Guardar asignación</button></td></tr>`}).join('')}</tbody></table></div></div>`;
    }catch(e){console.error('[Equipo médico v96]',e);root.innerHTML=`<div class="alert alert-danger">No se pudo cargar el equipo médico: ${esc(e.message||e)}</div>`;}
  };

  window.nmAssignDoctorV96=async function(patientId){
    if(!isAdmin()) return notify('Solo la administración puede asignar pacientes.','danger');
    const doctorId=document.getElementById('nm-doc-'+patientId)?.value||'';
    try{
      const existing=await supa(`asignaciones_pacientes?paciente_id=eq.${encodeURIComponent(patientId)}&activo=eq.true&select=id`,'GET');
      for(const row of (existing||[])) await supa(`asignaciones_pacientes?id=eq.${encodeURIComponent(row.id)}`,'PATCH',{activo:false});
      if(doctorId) await supa('asignaciones_pacientes','POST',{paciente_id:patientId,especialista_id:doctorId,activo:true,asignado_por:DB.currentUser?.id||null});
      notify(doctorId?'Paciente asignado correctamente.':'Paciente dejado sin doctor asignado.','success');
      await renderMedicalTeamV96();
    }catch(e){console.error('[Asignación v96]',e);notify('No se pudo guardar la asignación: '+(e.message||e),'danger');}
  };

  // El doctor no puede eliminar pacientes ni cambiar datos administrativos desde el directorio.
  const oldRenderPatientsTable=window.renderPatientsTable;
  window.renderPatientsTable=function(list){oldRenderPatientsTable(list);if(isDoctor()){document.querySelectorAll('#patients-table button[title="Eliminar"]').forEach(b=>b.remove());}};
})();
