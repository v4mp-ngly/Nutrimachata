// Pruebas v134: guardado a prueba de fallos + doctores con localidades (Supabase simulado, sin tocar producción).
// Uso: node run-v134.js <carpeta-del-proyecto> [filtro]
const {chromium}=require('playwright');
const {openApp,login}=require('./harness');
const fs=require('fs');
const dir=process.argv[2];const filter=process.argv[3]||'';
const results=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitFor(page,fn,timeout=8000,arg){const t=Date.now();while(Date.now()-t<timeout){try{if(await page.evaluate(fn,arg))return true}catch(_){}await sleep(150)}return false}
async function boot(browser,user='admin',opts={}){
  const a=await openApp(dir,{browser,...opts});
  if(opts.before)await opts.before(a);
  await sleep(400);
  const u=a.mock.U[user];await login(a.page,u.email,u.password);
  await waitFor(a.page,()=>window.DB&&DB.loaded===true,9000);
  await sleep(1200);
  return a;
}
async function test(id,name,fn){
  if(filter&&!filter.split(',').some(f=>id===f))return;
  const browser=await chromium.launch();
  const t0=Date.now();let status='PASS',detail='';
  try{const r=await Promise.race([fn(browser),new Promise((_,rej)=>setTimeout(()=>rej(new Error('TIMEOUT de la prueba (120 s)')),120000))]);detail=r||'';}
  catch(e){status='FAIL';detail=String(e&&e.message||e).slice(0,500);}
  finally{await browser.close().catch(()=>{});}
  results.push({id,name,status,detail,ms:Date.now()-t0});
  console.log(`${status==='PASS'?'✔':'✘'} ${id} ${name} ${detail?'— '+detail:''}`);
}
function assert(c,msg){if(!c)throw new Error(msg)}
async function noErrors(a,ctx){const rej=await a.page.evaluate(()=>window.__rej||[]);const errs=a.errors.concat(rej.map(r=>'unhandledrejection: '+r));assert(!errs.length,`${ctx}: errores JS: ${errs.slice(0,3).join(' | ')}`)}
const notif=a=>a.page.evaluate(()=>document.getElementById('notif-inner')?.innerText||'');
const pill=a=>a.page.evaluate(()=>{const p=document.getElementById('nm134-save-status');return p?{cls:p.className,txt:p.innerText}:null});
async function openTeam(a){await a.page.evaluate(()=>navigate('settings'));await sleep(500);await a.page.evaluate(()=>{const it=document.querySelector('[data-nm98-team]');switchSettingsTab('equipo',it)});await waitFor(a.page,()=>document.querySelectorAll('[data-nm134-doc]').length>0,8000);await sleep(400)}

(async()=>{
await test('G01','Indicador: muestra Guardado ✓ al confirmar y "No se guardó" si el servidor falla',async b=>{
  const a=await boot(b);const {P2}=a.mock.ids;
  await a.page.evaluate(id=>SB.updatePaciente(id,{telefono:'8090000001'}),P2);await sleep(150);
  const ok=await pill(a);assert(ok&&/is-ok/.test(ok.cls)&&/Guardado/.test(ok.txt),'sin indicador de éxito: '+JSON.stringify(ok));
  a.mock.ctl.failOnce.push({table:'pacientes',method:'PATCH',status:500});
  const err=await a.page.evaluate(id=>SB.updatePaciente(id,{telefono:'8090000002'}).then(()=>'ok',e=>'err'),P2);await sleep(150);
  const bad=await pill(a);assert(err==='err'&&/is-err/.test(bad.cls)&&/No se guardó/.test(bad.txt),'sin indicador de error: '+JSON.stringify(bad));
  await noErrors(a,'indicador');return `${ok.txt} | ${bad.txt}`;
});
await test('G02','Corte de red al ACTUALIZAR: se reintenta solo (PATCH idempotente) y queda guardado',async b=>{
  const a=await boot(b);const {P2}=a.mock.ids;
  a.mock.ctl.abortOnce.push({table:'pacientes',method:'PATCH'});
  const r=await a.page.evaluate(id=>SB.updatePaciente(id,{telefono:'8091112222'}).then(()=>'ok',e=>'err:'+e.message),P2);
  const v=a.mock.db.pacientes.find(p=>p.id===P2).telefono;
  assert(r==='ok'&&v==='8091112222',`resultado ${r}, teléfono ${v}`);
  const n=a.mock.ctl.log.filter(l=>l.method==='PATCH'&&l.path.startsWith('/rest/v1/pacientes')).length;
  await noErrors(a,'reintento');return `guardado tras ${n} envíos`;
});
await test('G03','Corte de red DESPUÉS de guardar (respuesta perdida) en una actualización: sin error para el usuario',async b=>{
  const a=await boot(b);const {P2}=a.mock.ids;
  a.mock.ctl.abortOnce.push({table:'pacientes',method:'PATCH',after:true});
  const r=await a.page.evaluate(id=>SB.updatePaciente(id,{telefono:'8093334444'}).then(()=>'ok',e=>'err:'+e.message),P2);
  assert(r==='ok'&&a.mock.db.pacientes.find(p=>p.id===P2).telefono==='8093334444','resultado '+r);return 'ok';
});
await test('G04','Historia clínica: corte de red se reintenta sin duplicar (antes podía quedarse colgada sin tiempo límite)',async b=>{
  const a=await boot(b);const {P2}=a.mock.ids;
  a.mock.ctl.abortOnce.push({table:'historias_clinicas',method:'POST'});
  const r=await a.page.evaluate(id=>SB.upsertHistoria(id,{motivo:'Corte de red'}).then(x=>'ok:'+!!x?.id,e=>'err:'+e.message),P2);
  const hs=a.mock.db.historias_clinicas.filter(h=>h.paciente_id===P2);
  assert(r==='ok:true'&&hs.length===1&&hs[0].motivo==='Corte de red',`resultado ${r}, historias ${hs.length}`);return 'una sola historia';
});
await test('G05','Borrador: cerrar un formulario por accidente permite recuperar lo escrito',async b=>{
  const a=await boot(b);
  await a.page.evaluate(()=>openAppointmentModal());await sleep(500);
  await a.page.fill('#apt-desc','Control mensual con resultados');await a.page.fill('#apt-notas','Traer analítica');await sleep(600);
  await a.page.evaluate(()=>closeModal('modal-appointment'));await sleep(300);
  await a.page.evaluate(()=>openAppointmentModal());await sleep(900);
  const has=await a.page.evaluate(()=>!!document.querySelector('#modal-appointment .nm134-draft'));assert(has,'no se ofreció recuperar el borrador');
  await a.page.click('#modal-appointment .nm134-draft [data-a="r"]');await sleep(200);
  const v=await a.page.evaluate(()=>[document.getElementById('apt-desc').value,document.getElementById('apt-notas').value]);
  assert(v[0]==='Control mensual con resultados'&&v[1]==='Traer analítica','valores: '+v.join(' / '));
  const pre=await a.page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented});
  assert(pre===true,'no se avisa al cerrar la pestaña con cambios sin guardar');
  await noErrors(a,'borrador');return 'recuperado + aviso al cerrar';
});
await test('G06','Borrador: tras guardar con éxito no queda borrador ni aviso',async b=>{
  const a=await boot(b);
  await a.page.evaluate(()=>openAppointmentModal());await sleep(500);
  await a.page.fill('#apt-desc','Se guardará');await sleep(500);
  await a.page.evaluate(()=>supa('citas','POST',{paciente_id:null,fecha:'2026-12-01',hora:'08:00',descripcion:'x',estado:'pendiente'}));
  await a.page.evaluate(()=>closeModal('modal-appointment'));await sleep(300);
  const k=await a.page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('nm134_draft_')));
  const pre=await a.page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented});
  assert(!k.length&&pre===false,'quedó borrador '+k.join(',')+' aviso '+pre);return 'limpio';
});
await test('G07','Perfil de la clínica se guarda en Supabase y aparece al volver a entrar (antes se perdía)',async b=>{
  const a=await boot(b);
  await a.page.evaluate(()=>navigate('settings'));await sleep(600);
  await a.page.fill('#s-clinic','Clínica Machata Centro');await a.page.fill('#s-phone','809-555-7788');
  await a.page.evaluate(()=>saveSettings());await sleep(800);
  const row=a.mock.db.nm_ajustes_clinica.find(r=>r.clave==='perfil_clinica');
  assert(row&&row.valor.clinicName==='Clínica Machata Centro'&&!('apiKey' in row.valor),'no se guardó: '+JSON.stringify(row));
  // segunda sesión, mismo "Supabase"
  const b2=await chromium.launch();try{
    const a2=await openApp(dir,{browser:b2,mock:a.mock});await sleep(400);await login(a2.page,a.mock.U.admin.email,a.mock.U.admin.password);
    await waitFor(a2.page,()=>DB.settings?.clinicName==='Clínica Machata Centro',10000);
    const v=await a2.page.evaluate(()=>DB.settings.clinicName);assert(v==='Clínica Machata Centro','al volver a entrar: '+v);
  }finally{await b2.close()}
  await noErrors(a,'ajustes');return 'persistido y recargado';
});
await test('G08','Sin la tabla del SQL 04: avisa claramente y no rompe nada',async b=>{
  const a=await boot(b,'admin',{before:a=>{a.mock.ctl.noV134=true}});
  await a.page.evaluate(()=>navigate('settings'));await sleep(600);await a.page.fill('#s-clinic','Otra');
  await a.page.evaluate(()=>saveSettings());await sleep(700);
  const n=await notif(a);assert(/SQL 04_v134/.test(n),'aviso: '+n);
  await openTeam(a);const t=await a.page.evaluate(()=>document.getElementById('nm98-team-root').innerText);
  assert(/04_v134/.test(t)&&/Dra\. Prueba/.test(t),'equipo: '+t.slice(0,160));
  await noErrors(a,'sin tabla');return 'aviso correcto';
});
await test('G09','Plantilla de dieta se guarda en Supabase',async b=>{
  const a=await boot(b);const {P1}=a.mock.ids;
  const did=await a.page.evaluate(id=>DB.patients.find(p=>p.id===id).dietas[0]?.id,P1);assert(did,'sin dieta');
  await a.page.evaluate(([p,d])=>saveDietTemplate(p,d),[P1,did]);await sleep(1200);
  const row=a.mock.db.nm_ajustes_clinica.find(r=>r.clave==='plantillas_dietas');
  assert(row&&row.valor.length===1,'no se guardó la plantilla: '+JSON.stringify(row&&row.valor));return 'plantilla en Supabase';
});
await test('D01','Equipo: ficha completa (especialidad, teléfono, estado, Activar/Desactivar)',async b=>{
  const a=await boot(b);await openTeam(a);
  const t=await a.page.evaluate(()=>document.querySelector('[data-nm134-doc]')?.closest('.card-body').innerText||'');
  assert(/Nutrición deportiva/.test(t)&&/8095551234/.test(t)&&/Desactivar/.test(t),'ficha: '+t.slice(0,200));
  await noErrors(a,'equipo');return 'ok';
});
await test('D02','Crear doctor con localidades: perfil + localidad guardados y visibles',async b=>{
  const a=await boot(b);await openTeam(a);
  await a.page.evaluate(()=>openDoctor98());await waitFor(a.page,()=>!!document.getElementById('nm134-doc-locs'));
  await a.page.fill('#nm98-doctor-name','Dr. Nuevo Pérez');await a.page.fill('#nm98-doctor-email','nuevo@nutrimachata.com');await a.page.fill('#nm98-doctor-specialty','Medicina interna');await a.page.fill('#nm98-doctor-password','Clave#2026');
  await a.page.check(`#nm134-loc-${a.mock.ids.LOC}`);
  await a.page.evaluate(()=>saveDoctor98());await sleep(1500);
  const u=a.mock.db.usuarios.find(x=>x.email==='nuevo@nutrimachata.com');assert(u&&u.rol==='doctor','usuario no creado');
  const l=a.mock.db.doctor_localidades.filter(x=>x.usuario_id===u.id&&x.activo);assert(l.length===1&&l[0].localidad_id===a.mock.ids.LOC,'localidad no guardada');
  const card=await a.page.evaluate(id=>document.querySelector(`[data-nm134-doc="${id}"]`)?.innerText||'',u.id);
  assert(/Sede Central/.test(card),'la ficha no muestra la localidad: '+card);
  await noErrors(a,'crear doctor');return 'Dr. Nuevo Pérez · Sede Central';
});
await test('D03','Crear doctor: si falla el perfil tras crear el acceso, el reintento NO duplica ni da "correo registrado"',async b=>{
  const a=await boot(b);await openTeam(a);
  a.mock.ctl.failOnce.push({table:'usuarios',method:'POST',status:500});
  await a.page.evaluate(()=>openDoctor98());await sleep(400);
  await a.page.fill('#nm98-doctor-name','Dra. Reintento');await a.page.fill('#nm98-doctor-email','reintento@nutrimachata.com');await a.page.fill('#nm98-doctor-password','Clave#2026');
  await a.page.evaluate(()=>saveDoctor98());await sleep(1200);
  const open1=await a.page.evaluate(()=>!!document.getElementById('nm98-doctor-modal'));assert(open1,'el formulario se cerró tras el fallo');
  await a.page.evaluate(()=>saveDoctor98());await sleep(1500);
  const rows=a.mock.db.usuarios.filter(x=>x.email==='reintento@nutrimachata.com');
  const open2=await a.page.evaluate(()=>!!document.getElementById('nm98-doctor-modal'));
  assert(rows.length===1&&!open2,`perfiles ${rows.length}, modal abierto ${open2}, aviso: ${await notif(a)}`);
  await noErrors(a,'reintento doctor');return `1 perfil; registros de acceso: ${a.mock.ctl.signups}`;
});
await test('D04','Editar doctor conserva teléfono y especialidad',async b=>{
  const a=await boot(b);await openTeam(a);const id=a.mock.U.doctor.id;
  await a.page.evaluate(id=>openDoctor98(id),id);await sleep(600);
  const v=await a.page.evaluate(()=>[document.getElementById('nm98-doctor-phone').value,document.getElementById('nm98-doctor-specialty').value]);
  assert(v[0]==='8095551234'&&v[1]==='Nutrición deportiva','el formulario abrió con: '+v.join(' / '));
  await a.page.fill('#nm98-doctor-name','Dra. Prueba Editada');await a.page.evaluate(()=>saveDoctor98());await sleep(1200);
  const u=a.mock.db.usuarios.find(x=>x.id===id);assert(u.nombre==='Dra. Prueba Editada'&&u.telefono==='8095551234'&&u.especialidad==='Nutrición deportiva','datos: '+JSON.stringify(u));
  return 'conservados';
});
await test('D05','Desactivar y volver a activar un doctor (antes desaparecía de la lista)',async b=>{
  const a=await boot(b);await openTeam(a);const id=a.mock.U.doctor.id;
  await a.page.evaluate(id=>toggleDoctor98(id,false),id);await sleep(1500);
  const t=await a.page.evaluate(id=>document.querySelector(`[data-nm134-doc="${id}"]`)?.innerText||'',id);assert(/Inactivo/.test(t)&&/Activar/.test(t),'tras desactivar: '+t);
  await a.page.evaluate(id=>toggleDoctor98(id,true),id);await sleep(1500);
  assert(a.mock.db.usuarios.find(x=>x.id===id).activo===true,'no se reactivó');return 'ok';
});
await test('D06','Cambiar doctor de un paciente: si falla, el paciente conserva su doctor anterior',async b=>{
  const a=await boot(b,'admin',{before:a=>{a.mock.db.asignaciones_pacientes.push({id:'00000000-0000-4000-8000-0000000000a1',paciente_id:a.mock.ids.P1,especialista_id:a.mock.U.admin.id,activo:true,creado_en:'2026-01-01T00:00:00Z'})}});
  a.mock.ctl.failOnce.push({table:'asignaciones_pacientes',method:'POST',status:500});
  const r1=await a.page.evaluate(([p,d])=>NM134AssignDoctor(p,d).then(()=>'ok',e=>'err'),[a.mock.ids.P1,a.mock.U.doctor.id]);
  const act1=a.mock.db.asignaciones_pacientes.filter(x=>x.paciente_id===a.mock.ids.P1&&x.activo);
  assert(r1==='err'&&act1.length===1&&act1[0].especialista_id===a.mock.U.admin.id,'tras fallo: '+JSON.stringify(act1));
  const r2=await a.page.evaluate(([p,d])=>NM134AssignDoctor(p,d).then(()=>'ok',e=>'err'),[a.mock.ids.P1,a.mock.U.doctor.id]);
  const act2=a.mock.db.asignaciones_pacientes.filter(x=>x.paciente_id===a.mock.ids.P1&&x.activo);
  assert(r2==='ok'&&act2.length===1&&act2[0].especialista_id===a.mock.U.doctor.id,'tras éxito: '+JSON.stringify(act2));
  return 'nunca sin doctor ni con dos';
});
await test('D07','Con la función SQL instalada, la asignación es una sola transacción',async b=>{
  const a=await boot(b,'admin',{before:a=>{a.mock.ctl.v134Rpc=true}});
  await a.page.evaluate(([p,d])=>NM134AssignDoctor(p,d),[a.mock.ids.P2,a.mock.U.doctor.id]);
  const act=a.mock.db.asignaciones_pacientes.filter(x=>x.paciente_id===a.mock.ids.P2&&x.activo);
  assert(a.mock.ctl.v134RpcCalls===1&&act.length===1,'llamadas '+a.mock.ctl.v134RpcCalls);return 'rpc';
});
await test('D08','Al asignar, se sugiere el doctor que atiende en la localidad del paciente',async b=>{
  const a=await boot(b,'admin',{before:a=>{a.mock.db.doctor_localidades.push({id:'00000000-0000-4000-8000-0000000000b1',usuario_id:a.mock.U.doctor.id,localidad_id:a.mock.ids.LOC,activo:true})}});
  await openTeam(a);
  await a.page.evaluate(id=>selectPatient121('doctor',id),a.mock.ids.P1);await waitFor(a.page,()=>!!document.querySelector('.nm134-suggest'));
  const t=await a.page.evaluate(()=>document.querySelector('.nm134-suggest')?.innerText||'');assert(/Sede Central/.test(t)&&/Dra\. Prueba/.test(t),'sugerencia: '+t);
  await a.page.click('.nm134-suggest button');await sleep(200);
  const sel=await a.page.evaluate(()=>NM121.selectedDoctor?.id);assert(sel===a.mock.U.doctor.id,'no se seleccionó');
  await a.page.evaluate(()=>saveDoctorAssignment121());await sleep(1200);
  const act=a.mock.db.asignaciones_pacientes.filter(x=>x.paciente_id===a.mock.ids.P1&&x.activo);assert(act.length===1&&act[0].especialista_id===a.mock.U.doctor.id,'asignación');
  // Localidades muestra los doctores
  await a.page.evaluate(()=>{const it=document.querySelector('[data-nm121-localidades]');switchSettingsTab('localidades',it)});await waitFor(a.page,()=>!!document.getElementById('nm134-loc-doctors'),8000);
  const lt=await a.page.evaluate(()=>document.getElementById('nm134-loc-doctors')?.innerText||'');assert(/Dra\. Prueba/.test(lt),'localidades: '+lt);
  await noErrors(a,'sugerencia');return t.replace(/\s+/g,' ');
});
await test('D09','Doctor: no ve Configuración ni puede asignar localidades',async b=>{
  const a=await boot(b,'doctor');
  const r=await a.page.evaluate(()=>NM134AssignDoctor?NM134AssignDoctor('x','y').then(()=>'ok',e=>'err'):'n/a');
  await a.page.evaluate(()=>navigate('settings'));await sleep(500);const title=await a.page.evaluate(()=>document.getElementById('page-title').textContent);
  assert(title!=='Configuración','el doctor abrió Configuración');return 'bloqueado ('+r+')';
});
await test('W01','Registro clínico: si falla la historia, NO se duplica el paciente al reintentar y la pantalla no queda en "Guardando…"',async b=>{
  const a=await boot(b);
  const before=a.mock.db.pacientes.length;
  a.mock.ctl.failTables.add('historias_clinicas');
  await a.page.evaluate(()=>{openWizard({nombre:'Paciente Wizard',telefono:'8095550101',peso:70,talla:1.68,motivo:'Control'});wizStep=WIZ_STEPS.length-1;renderWizard()});
  await a.page.evaluate(()=>finishWizard());await sleep(1000);
  const stuck=await a.page.evaluate(()=>/Guardando en la base de datos/.test(document.getElementById('page-content').innerText));
  const btn=await a.page.evaluate(()=>document.getElementById('wiz-next').textContent);
  assert(!stuck,'la pantalla quedó en Guardando…');
  a.mock.ctl.failTables.delete('historias_clinicas');
  await a.page.evaluate(()=>finishWizard());await sleep(1500);
  const news=a.mock.db.pacientes.filter(p=>p.nombre==='Paciente Wizard');
  assert(news.length===1&&a.mock.db.pacientes.length===before+1,'pacientes creados: '+news.length);
  assert(a.mock.db.historias_clinicas.some(h=>h.paciente_id===news[0].id),'historia no creada');
  assert(a.mock.db.evaluaciones.filter(e=>e.paciente_id===news[0].id).length===1,'evaluación inicial duplicada o ausente');
  await noErrors(a,'wizard');return `botón tras fallo: "${btn}"; 1 paciente, 1 historia, 1 evaluación`;
});
await test('V01','Navegación completa (admin, doctor) sin errores JS con los módulos v134',async b=>{
  for(const role of ['admin','doctor']){
    const a=await boot(b,role);
    for(const p of ['dashboard','patients','historias','evaluations','consents','diets','agenda','reports','settings','glp1','billing'])
      {await a.page.evaluate(p=>navigate(p),p);await sleep(500)}
    if(role==='admin'){await openTeam(a);await a.page.evaluate(()=>{const it=document.querySelector('[data-nm121-localidades]');switchSettingsTab('localidades',it)});await sleep(1500)}
    await noErrors(a,role);await a.context.close();
  }
  return 'sin errores';
});
fs.writeFileSync(require('path').join(__dirname,'resultados-v134.json'),JSON.stringify(results,null,2));
const pass=results.filter(r=>r.status==='PASS').length;console.log(`\n${pass}/${results.length} pruebas v134 superadas`);process.exit(results.every(r=>r.status==='PASS')?0:1);
})();
