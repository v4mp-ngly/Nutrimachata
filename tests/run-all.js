// Pruebas automatizadas de NutriMachata contra un Supabase simulado (sin tocar producción).
// Uso: node run-all.js <carpeta-del-proyecto> [filtro]
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
  if(opts.noWait)return a;
  await waitFor(a.page,()=>window.DB&&DB.loaded===true,9000);
  await sleep(1200);
  return a;
}
const reqCount=(a,method,table,contains='')=>a.mock.ctl.log.filter(l=>l.method===method&&l.path.split('?')[0]==='/rest/v1/'+table&&decodeURIComponent(l.path).includes(contains)).length;
const FULL='order=created_at.desc';
async function test(id,name,fn){
  if(filter&&!filter.split(',').some(f=>id===f))return;
  const browser=await chromium.launch();
  const t0=Date.now();let status='PASS',detail='';
  try{const r=await Promise.race([fn(browser),new Promise((_,rej)=>setTimeout(()=>rej(new Error('TIMEOUT de la prueba (120 s)')),120000))]);detail=r||'';}
  catch(e){status='FAIL';detail=String(e&&e.message||e).slice(0,400);}
  finally{await browser.close().catch(()=>{});}
  results.push({id,name,status,detail,ms:Date.now()-t0});
  console.log(`${status==='PASS'?'✔':'✘'} ${id} ${name} ${detail?'— '+detail:''}`);
}
function assert(c,msg){if(!c)throw new Error(msg)}
async function noErrors(a,ctx){const rej=await a.page.evaluate(()=>window.__rej||[]);const errs=a.errors.concat(rej.map(r=>'unhandledrejection: '+r));assert(!errs.length,`${ctx}: errores JS: ${errs.slice(0,3).join(' | ')}`)}

(async()=>{
await test('T01','Navegación administrador por todos los módulos sin errores JS',async b=>{
  const a=await boot(b);
  const pages=['dashboard','patients','historias','evaluations','consents','diets','ai','diet-templates','agenda','analisis','billing','reports','settings','glp1','team'];
  const bad=[];
  for(const p of pages){await a.page.evaluate(p=>navigate(p),p);await sleep(700);const t=await a.page.evaluate(()=>document.getElementById('page-content')?.innerText.length||0);if(t<20)bad.push(p)}
  for(const t of ['invoices','expenses','cashclose','reports','inventory','receivables','balances','quotes']){await a.page.evaluate(t=>{navigate('billing');},t);await sleep(400);await a.page.evaluate(t=>{try{renderBillingTab(t)}catch(e){window.__rej.push('tab '+t+': '+e.message)}},t);await sleep(700)}
  await noErrors(a,'navegación');assert(!bad.length,'páginas vacías: '+bad.join(','));
  return `${pages.length} módulos + pestañas de Facturación`;
});
await test('T02','Equipo médico se renderiza (antes: ReferenceError esc)',async b=>{
  const a=await boot(b);await a.page.evaluate(()=>navigate('team'));await sleep(1200);
  const t=await a.page.evaluate(()=>document.getElementById('page-content').innerText);
  assert(/Equipo médico/i.test(t)&&/Asignación de pacientes/i.test(t),'la pantalla no se mostró: '+t.slice(0,120));await noErrors(a,'team');
});
await test('T03','Doctor: solo módulos clínicos; Facturación bloqueada',async b=>{
  const a=await boot(b,'doctor');await a.page.evaluate(()=>navigate('billing'));await sleep(800);
  const title=await a.page.evaluate(()=>document.getElementById('page-title').textContent);
  assert(title!=='Facturación','el doctor pudo abrir Facturación');await noErrors(a,'doctor');return 'redirigido a: '+title;
});
await test('T04','Paciente: solo ve su expediente y no accede a módulos administrativos',async b=>{
  const a=await boot(b,'patient');
  const st=await a.page.evaluate(()=>({n:DB.patients.length,ids:DB.patients.map(p=>p.id),role:DB.currentRole}));
  assert(st.role==='patient','rol '+st.role);assert(st.n===1&&st.ids[0]===a.mock.ids.P1,'el paciente ve '+st.n+' expedientes');
  for(const p of ['billing','patients','settings','team','glp1']){await a.page.evaluate(p=>navigate(p),p);await sleep(500);const t=await a.page.evaluate(()=>document.getElementById('page-title').textContent);assert(!['Facturación','Pacientes','Configuración','Equipo médico','GLP-1'].includes(t),'paciente abrió '+t)}
  await noErrors(a,'paciente');
});
await test('T05','Cuenta sin rol NO entra como administrador por la pestaña elegida',async b=>{
  const a=await boot(b,'norole',{noWait:true});await sleep(2500);
  const role=await a.page.evaluate(()=>DB.currentUser?DB.currentRole:'(sin sesión de aplicación)');const appVisible=await a.page.evaluate(()=>getComputedStyle(document.getElementById('app')).display!=='none');
  assert(!(role==='admin'&&appVisible),'la cuenta sin rol obtuvo interfaz de administrador');return 'rol resultante: '+role+', app visible: '+appVisible;
});
await test('T06','Fallo de tabla crítica en primera carga: no se muestran pacientes de demostración',async b=>{
  const a=await boot(b,'admin',{noWait:true,before:a=>{a.mock.ctl.failTables.add('pacientes')}});await sleep(4500);
  const st=await a.page.evaluate(()=>({names:(DB.patients||[]).map(p=>p.nombre),html:document.getElementById('page-content').innerText}));
  assert(!st.names.some(n=>/Sofía Martínez|Carlos Rodríguez|Isabella Torres/.test(n))&&!/Sofía Martínez/.test(st.html),'se muestran pacientes ficticios: '+st.names.join(', '));
  return 'pacientes en memoria: '+st.names.length;
});
await test('T07','Carga parcial: una tabla opcional que falla no borra datos ya cargados',async b=>{
  const a=await boot(b);const P1=a.mock.ids.P1;
  const before=await a.page.evaluate(id=>DB.patients.find(p=>p.id===id).evaluaciones.length,P1);
  a.mock.ctl.failTables.add('evaluaciones');a.mock.ctl.failTables.add('citas');
  await a.page.evaluate(()=>refreshData().catch(()=>{}));await sleep(3500);
  const after=await a.page.evaluate(id=>({ev:DB.patients.find(p=>p.id===id).evaluaciones.length,apts:DB.appointments.length,warn:DB.syncWarnings||null}),P1);
  assert(before>0&&after.ev===before,`evaluaciones antes ${before}, después ${after.ev}`);assert(after.apts===2,'citas después: '+after.apts);
  await noErrors(a,'carga parcial');return `evaluaciones conservadas ${after.ev}/${before}; aviso: ${JSON.stringify(after.warn)}`;
});
await test('T08','Sincronizaciones simultáneas se unifican (una sola carga completa)',async b=>{
  const a=await boot(b);await sleep(1500);a.mock.ctl.log.length=0;a.mock.ctl.delay=600;
  await a.page.evaluate(async()=>{await Promise.allSettled([loadFromSupabase(),loadFromSupabase(),loadFromSupabase(),refreshData()]);});
  await sleep(1500);a.mock.ctl.delay=0;
  const n=reqCount(a,'GET','pacientes',FULL);const all=a.mock.ctl.log.filter(l=>l.method==='GET').length;assert(n<=1,`la carga completa de pacientes se ejecutó ${n} veces para 4 solicitudes simultáneas`);await noErrors(a,'sync');return `cargas completas: ${n}; total GET: ${all}`;
});
await test('T09','Desconexión: no cierra sesión, conserva datos, sin promesas sin manejar; recupera al volver',async b=>{
  const a=await boot(b);const n0=await a.page.evaluate(()=>DB.patients.length);
  await a.context.setOffline(true);a.mock.ctl.offline=true;await sleep(300);
  await a.page.evaluate(async()=>{try{await refreshData()}catch(_){};try{await supa('pacientes?select=id&limit=1')}catch(_){};});
  await sleep(1500);
  const mid=await a.page.evaluate(()=>({n:DB.patients.length,user:!!DB.currentUser,login:getComputedStyle(document.getElementById('login-page')).display,tok:!!SUPA_AUTH_SESSION?.access_token}));
  assert(mid.n===n0&&mid.user&&mid.tok&&mid.login==='none',`estado offline: ${JSON.stringify(mid)}`);
  a.mock.ctl.log.length=0;a.mock.ctl.offline=false;await a.context.setOffline(false);await sleep(4500);
  const resynced=reqCount(a,'GET','pacientes',FULL);
  await noErrors(a,'offline');assert(resynced>=1,'no se resincronizó al volver la conexión');
  assert(resynced<=2,'resincronizaciones duplicadas: '+resynced);
  return `pacientes conservados ${mid.n}; GET pacientes al reconectar: ${resynced}`;
});
await test('T10','Renovación de token con Auth 503 no cierra la sesión',async b=>{
  const a=await boot(b);a.mock.ctl.refreshFails=503;
  const r=await a.page.evaluate(async()=>{SUPA_AUTH_SESSION.expires_at=Math.floor(Date.now()/1000)+30;try{const x=await supa('pacientes?select=id&limit=1');return {ok:true,n:x.length,tok:!!SUPA_AUTH_SESSION?.access_token}}catch(e){return {ok:false,msg:e.message,code:e.code,tok:!!SUPA_AUTH_SESSION?.access_token}}});
  assert(r.tok,'la sesión fue eliminada: '+JSON.stringify(r));assert(r.ok,'la consulta falló: '+JSON.stringify(r));return JSON.stringify(r);
});
await test('T11','Auth colgado: la renovación termina con error controlado (no bloquea para siempre)',async b=>{
  const a=await boot(b);a.mock.ctl.hangAuth=true;
  const r=await a.page.evaluate(async()=>{const t=Date.now();const res=await Promise.race([refreshSupaSession(true).then(()=>'ok',e=>'err:'+e.code),new Promise(r=>setTimeout(()=>r('colgado'),30000))]);return {res,ms:Date.now()-t,tok:!!SUPA_AUTH_SESSION?.access_token}});
  assert(r.res!=='colgado','la renovación quedó colgada >30 s');assert(r.tok,'la sesión se perdió');return JSON.stringify(r);
});
await test('T12','CRUD clínico: paciente, cita, evaluación e historia clínica confirmados por el servidor',async b=>{
  const a=await boot(b);const P2=a.mock.ids.P2;
  const r=await a.page.evaluate(async P2=>{
    const p=await SB.createPaciente({nombre:'Paciente CRUD',email:'crud@example.com',telefono:'8095559999'});
    await SB.updatePaciente(p.id,{telefono:'8095550000'});
    const c=await SB.createCita({paciente_id:p.id,fecha:'2026-12-01',hora:'08:00',descripcion:'CRUD',estado:'pendiente'});
    await SB.updateCita(c.id,{estado:'confirmada'});await SB.deleteCita(c.id);
    const e=await SB.createEvaluacion({paciente_id:P2,fecha:'2026-11-12',peso:94,talla:1.78,imc:29.7});
    await SB.upsertHistoria(P2,{motivo:'Prueba'});await SB.upsertHistoria(P2,{motivo:'Prueba 2'});
    return {pid:p.id,cid:c.id,eid:e?.id};
  },P2);
  const db=a.mock.db;
  assert(db.pacientes.find(x=>x.id===r.pid)?.telefono==='8095550000','paciente no actualizado');
  assert(!db.citas.find(x=>x.id===r.cid),'cita no eliminada');assert(db.evaluaciones.find(x=>x.id===r.eid),'evaluación no creada');
  assert(db.historias_clinicas.filter(h=>h.paciente_id===P2).length===1,'historias duplicadas');
  await noErrors(a,'crud');
});
async function saveInv(a,{double=false}={}){
  // Si aparece el aviso "Paciente sin localidad" (error del original, D5) se elige "Continuar sin localidad".
  const p=a.page.evaluate(d=>{if(d){const btn=document.querySelector('#invoice-modal .modal-footer .btn-olive');btn.click();btn.click();return saveInvoice()}return saveInvoice()},double);
  let modal=false;for(let i=0;i<40;i++){await sleep(150);const m=await a.page.evaluate(()=>{const b=document.getElementById('nm-loc-none');if(b){b.click();return true}return false});if(m)modal=true;const done=await Promise.race([p.then(()=>true),sleep(10).then(()=>false)]);if(done)break}
  const r=await p;a.locModal=(a.locModal||0)+(modal?1:0);return r;
}
async function fillInvoice(a,{party,lines,discount=0}){
  await a.page.evaluate(()=>navigate('billing'));await sleep(1200);
  await a.page.evaluate(()=>openInvoiceModal());await sleep(400);
  await a.page.evaluate(({party,lines,discount})=>{nmSelectBillingParty('patient',party);document.getElementById('invoice-lines').innerHTML='';lines.forEach(l=>addInvoiceLine(l));document.getElementById('inv-discount').value=discount;recalcInvoiceEditor();},{party,lines,discount});
  await sleep(300);
  return a.page.evaluate(()=>document.getElementById('inv-number').value);
}
await test('T13','Factura: cálculo de descuentos, detalle, inventario y confirmación del servidor',async b=>{
  const a=await boot(b);const {P1,PR2}=a.mock.ids;
  const num=await fillInvoice(a,{party:P1,lines:[{productId:PR2,description:'Suplemento proteico',qty:2,price:1800,discount:10}],discount:5});
  const ok=await saveInv(a);await sleep(1500);
  const f=a.mock.db.facturas.find(x=>x.numero_factura===num);assert(ok===true&&f,'factura no creada');
  // 2*1800=3600; -10% línea = 3240; -5% global = 3078
  assert(Math.abs(f.subtotal-3240)<.01&&Math.abs(f.descuento-162)<.01&&Math.abs(f.total-3078)<.01,`montos ${f.subtotal}/${f.descuento}/${f.total}`);
  const det=a.mock.db.factura_detalles.filter(d=>d.factura_id===f.id);assert(det.length===1&&Math.abs(det[0].descuento-360)<.01,'detalle incorrecto');
  const stock=a.mock.db.productos_servicios.find(p=>p.id===PR2).stock;assert(stock===8,'stock '+stock);
  const ui=await a.page.evaluate(n=>getBillingData().invoices.find(x=>x.number===n),num);assert(ui&&Math.abs(ui.total-3078)<.01,'la UI no refleja el total del servidor');
  await noErrors(a,'factura');return `subtotal 3240, descuento 162, total 3078, stock 10→8`+(a.locModal?' (apareció el aviso falso "Paciente sin localidad")':'');
});
await test('T14','Factura: doble clic en Guardar crea una sola factura',async b=>{
  const a=await boot(b);const {P1,PR1}=a.mock.ids;
  const num=await fillInvoice(a,{party:P1,lines:[{productId:PR1,description:'Consulta nutricional',qty:1,price:2500,discount:0}]});
  a.mock.ctl.delay=500;
  await saveInv(a,{double:true});
  await sleep(5000);a.mock.ctl.delay=0;
  const n=a.mock.db.facturas.filter(x=>x.numero_factura===num).length;assert(n===1,'facturas creadas: '+n);return 'facturas creadas: '+n;
});
async function openPayment(a,fid,amount){await a.page.evaluate(()=>navigate('billing'));await sleep(1200);await a.page.evaluate(id=>registerInvoicePayment(id),fid);await sleep(700);await a.page.evaluate(v=>{document.getElementById('pay-amount').value=v;NMUpdatePaymentSummary92?.()},String(amount));}
await test('T15','Pago: doble envío simultáneo registra un solo pago',async b=>{
  const a=await boot(b);const F1=a.mock.ids.F1;const n0=a.mock.db.pagos.length;
  await openPayment(a,F1,1000);a.mock.ctl.delay=400;
  await a.page.evaluate(id=>Promise.all([saveInvoicePayment(id),saveInvoicePayment(id)]),F1);await sleep(1500);a.mock.ctl.delay=0;
  const n=a.mock.db.pagos.length-n0;const f=a.mock.db.facturas.find(x=>x.id===F1);
  assert(n===1,'pagos registrados: '+n);assert(Math.abs(f.total_pagado-2000)<.01,'total pagado '+f.total_pagado);return `pagos nuevos: ${n}; pagado ${f.total_pagado}`;
});
await test('T16','Pago con respuesta perdida tras guardarse: se verifica y NO se duplica al reintentar',async b=>{
  const a=await boot(b);const F1=a.mock.ids.F1;const n0=a.mock.db.pagos.length;
  await openPayment(a,F1,500);a.mock.ctl.dropResponseAfterCommit=true;a.mock.ctl.dropOnce=true;
  const r1=await a.page.evaluate(id=>saveInvoicePayment(id),F1);await sleep(2500);
  // Usuario vuelve a pulsar "Guardar pago" (si el modal sigue abierto)
  const stillOpen=await a.page.evaluate(()=>!!document.getElementById('invoice-payment-modal'));
  if(stillOpen){await a.page.evaluate(id=>saveInvoicePayment(id),F1);await sleep(2500)}
  const n=a.mock.db.pagos.length-n0;assert(n===1,'pagos registrados: '+n+' (duplicado)');
  return `primer intento devolvió ${r1}; modal abierto tras el corte: ${stillOpen}; pagos nuevos: ${n}`;
});
await test('T17','Escritura incierta sin poder verificar: el reintento comprueba antes de enviar',async b=>{
  const a=await boot(b);const F1=a.mock.ids.F1;const n0=a.mock.db.pagos.length;
  await openPayment(a,F1,700);a.mock.ctl.dropResponseAfterCommit=true;a.mock.ctl.dropOnce=true;a.mock.ctl.failTables.add('pagos');
  const r1=await a.page.evaluate(async id=>{const res=await saveInvoicePayment(id);return res},F1);await sleep(2500);
  a.mock.ctl.failTables.delete('pagos');const posts0=a.mock.ctl.log.filter(l=>l.method==='POST'&&l.path.includes('nm_registrar_pago_con_saldo')).length;
  const open=await a.page.evaluate(()=>!!document.getElementById('invoice-payment-modal'));
  if(open)await a.page.evaluate(id=>saveInvoicePayment(id),F1);await sleep(2500);
  const posts1=a.mock.ctl.log.filter(l=>l.method==='POST'&&l.path.includes('nm_registrar_pago_con_saldo')).length;
  const n=a.mock.db.pagos.length-n0;assert(n===1,'pagos registrados: '+n);assert(posts1===posts0,'se reenviaron '+(posts1-posts0)+' pagos sin verificar');
  return `pagos nuevos ${n}; reenvíos ${posts1-posts0}`;
});
await test('T18','Facturación reanudable: si fallan las líneas, el reintento completa la MISMA factura',async b=>{
  const a=await boot(b);const {P1,PR1}=a.mock.ids;
  const num=await fillInvoice(a,{party:P1,lines:[{productId:PR1,description:'Consulta nutricional',qty:1,price:2500,discount:0}]});
  a.mock.ctl.failOnce.push({table:'factura_detalles',method:'POST'});
  const r1=await saveInv(a);await sleep(1500);
  const r2=await saveInv(a);await sleep(1500);
  const fs_=a.mock.db.facturas.filter(x=>x.numero_factura===num);const det=fs_[0]?a.mock.db.factura_detalles.filter(d=>d.factura_id===fs_[0].id).length:0;
  assert(fs_.length===1&&det===1&&r2===true,`facturas ${fs_.length}, detalles ${det}, segundo intento ${r2}`);return `intento1=${r1} intento2=${r2}; facturas=${fs_.length}; líneas=${det}`;
});
await test('T19','Cálculos financieros consistentes: Facturado → Cobrado → Pendiente → Gastos → Neto (y anuladas excluidas)',async b=>{
  const a=await boot(b);const {F1}=a.mock.ids;
  // anular una factura nueva para comprobar exclusión
  const {P1,PR1}=a.mock.ids;const num=await fillInvoice(a,{party:P1,lines:[{productId:PR1,description:'Consulta nutricional',qty:1,price:9999,discount:0}]});
  await saveInv(a);await sleep(1500);
  const nf=a.mock.db.facturas.find(x=>x.numero_factura===num);a.page.on('dialog',d=>d.accept());
  await a.page.evaluate(id=>archiveInvoice(id),nf.id);await sleep(1500);
  await a.page.evaluate(()=>{navigate('billing')});await sleep(1200);
  const from=new Date(Date.now()-10*864e5).toISOString().slice(0,10);
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santo_Domingo'}).format(new Date());
  await a.page.evaluate(([f,t])=>renderCashCloseV54(f,t),[from,today]);await sleep(2500);
  const cc=await a.page.evaluate(()=>{const x=window.NMCashCloseCurrent54;return {billed:x.billed,income:x.income,pending:x.pending,out:x.out,net:x.net}});
  // esperado desde los datos crudos del servidor
  const inRange=d=>String(d).slice(0,10)>=from&&String(d).slice(0,10)<=today;
  const inv=a.mock.db.facturas.filter(x=>inRange(x.fecha)&&x.estado!=='anulada');
  const exp={billed:inv.reduce((s,x)=>s+x.total,0),income:a.mock.db.pagos.filter(p=>inRange(p.fecha_pago)).reduce((s,p)=>s+Number(p.monto_recibido??p.monto),0),out:a.mock.db.gastos.filter(g=>inRange(g.fecha)).reduce((s,g)=>s+g.monto,0)};
  exp.pending=inv.reduce((s,x)=>s+Math.max(0,x.total-x.total_pagado),0);exp.net=exp.income-exp.out;
  const rep=await a.page.evaluate(([f,t])=>renderCashReportsV62(f,t).then(()=>window.NMCashReportRangeV62.real),[from,today]);
  const diffs=[];for(const k of ['billed','income','pending','out','net'])if(Math.abs(cc[k]-exp[k])>.01)diffs.push(`cierre.${k}=${cc[k]} esperado ${exp[k]}`);
  const map={billed:'facturado',income:'cobrado',pending:'pendiente',out:'gastos',net:'neto'};for(const k in map)if(Math.abs(rep[map[k]]-exp[k])>.01)diffs.push(`reporte.${map[k]}=${rep[map[k]]} esperado ${exp[k]}`);
  assert(!diffs.length,diffs.join('; '));await noErrors(a,'finanzas');
  return `facturado ${exp.billed}, cobrado ${exp.income}, pendiente ${exp.pending}, gastos ${exp.out}, neto ${exp.net} (cierre = reporte = servidor)`;
});
await test('T20','Paginación: más de 1000 pagos se cargan completos (límite de PostgREST)',async b=>{
  const a=await boot(b,'admin',{before:a=>{const FO='00000000-0000-4000-8000-0000000000aa';a.mock.db.facturas.push({id:FO,numero_factura:'FAC-OLD',paciente_id:a.mock.ids.P3,paciente_nombre:'María Rosario',fecha:'2025-01-10',estado:'pagada',subtotal:2600,descuento:0,impuestos:0,total:2600,total_pagado:2600,saldo:0,created_at:'2025-01-10T00:00:00Z'});for(let i=0;i<2600;i++){const ts=new Date(Date.parse('2025-01-11T00:00:00Z')+i*60000).toISOString();a.mock.db.pagos.push({id:'p-'+String(i).padStart(5,'0'),factura_id:FO,monto:1,monto_aplicado:1,monto_recibido:1,metodo_pago:'efectivo',fecha_pago:ts,created_at:ts})}}});
  await a.page.evaluate(()=>navigate('billing'));await sleep(3500);
  const n=await a.page.evaluate(()=>getBillingData().invoices.find(x=>x.number==='FAC-OLD')?.paymentHistory?.length||0);
  assert(n===2600,'pagos cargados: '+n+' de 2600');return 'pagos cargados: '+n;
});
await test('T21','GLP-1: doble clic al registrar aplicación descuenta una sola vez y confirma',async b=>{
  const a=await boot(b);const T1=a.mock.ids.T1;
  await a.page.evaluate(()=>navigate('glp1'));await sleep(1500);
  await a.page.evaluate(t=>glp1NewApplication(t),T1);await sleep(500);
  await a.page.evaluate(()=>{document.getElementById('g-app-dose').value='0.25';});a.mock.ctl.delay=400;
  await a.page.evaluate(()=>{const b=document.getElementById('glp1-save');b.click();b.click();});await sleep(3000);a.mock.ctl.delay=0;
  const n=a.mock.db.glp1_aplicaciones.length;const rem=a.mock.db.glp1_tratamientos.find(t=>t.id===T1).cantidad_restante_mg;
  const toast=await a.page.evaluate(()=>[...document.querySelectorAll('.notification,.toast,[class*="notif"]')].map(e=>e.textContent).join(' | ').slice(0,300));
  assert(n===1,'aplicaciones registradas: '+n);assert(Math.abs(rem-1.25)<1e-9,'restante '+rem);
  assert(!/No se pudo registrar|no confirmó/i.test(toast),'se mostró error aunque se guardó: '+toast);
  return `aplicaciones ${n}; restante 1.5→${rem} mg`;
});
await test('T22','Cierre de sesión borra datos clínicos y la copia local; otro usuario no ve datos previos',async b=>{
  const a=await boot(b);await a.page.evaluate(()=>window.nmSaveCriticalSnapshot?.('test'));
  a.page.on('dialog',d=>d.accept());
  await a.page.evaluate(()=>doLogout());await sleep(300);
  await a.page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/^(Confirmar|Aceptar|Sí|Si|Cerrar sesión)$/i.test(x.textContent.trim())&&x.offsetParent);b&&b.click()});
  await sleep(2500);
  const snap=await a.page.evaluate(()=>sessionStorage.getItem('nutrimachata_critical_snapshot_v3'));
  // el paciente inicia sesión en la misma pestaña con la tabla de pacientes fallando
  a.mock.ctl.failTables.add('pacientes');
  await login(a.page,a.mock.U.patient.email,a.mock.U.patient.password);await sleep(4000);
  const seen=await a.page.evaluate(()=>(DB.patients||[]).map(p=>p.nombre));
  assert(!snap,'la copia local con datos clínicos sigue en sessionStorage');
  assert(!seen.includes('Luis Gómez')&&!seen.includes('María Rosario'),'el paciente ve expedientes de otros: '+seen.join(', '));
  return 'pacientes visibles para el paciente: '+JSON.stringify(seen);
});
await test('T23','Alertas clínicas (presión, IMC, cambio de peso) presentes en el Centro de alertas',async b=>{
  const a=await boot(b);const al=await a.page.evaluate(()=>computeClinicAlerts().map(x=>x.title));
  assert(al.includes('Presión arterial elevada'),'faltan alertas clínicas: '+al.join(', '));return al.slice(0,6).join(', ');
});
await test('T24','Token vencido (401) se renueva de forma transparente',async b=>{
  const a=await boot(b);
  const r=await a.page.evaluate(async()=>{SUPA_AUTH_SESSION.access_token='h.'+btoa(JSON.stringify({sub:SUPA_AUTH_SESSION.user.id,exp:1})).replace(/=+$/,'')+'.s';const x=await supa('citas?select=id');return x.length});
  assert(r===2,'resultado '+r);
});
await test('T25','Doctor desactivado no puede iniciar sesión',async b=>{
  const a=await boot(b,'doctor',{noWait:true,before:a=>{a.mock.db.usuarios.find(u=>u.rol==='doctor').activo=false}});await sleep(2500);
  const vis=await a.page.evaluate(()=>getComputedStyle(document.getElementById('app')).display!=='none');assert(!vis,'el doctor desactivado entró al sistema');
});
await test('T26','Referencias locales de index.html y bundles existentes; sin <link> a CSS dentro de JS',async b=>{
  const html=fs.readFileSync(dir+'/index.html','utf8');const refs=[...html.matchAll(/(?:src|href)="([^"#:]+?)(?:\?[^"]*)?"/g)].map(m=>m[1]).filter(x=>!x.startsWith('http')&&!x.startsWith('data'));
  const missing=refs.filter(r=>!fs.existsSync(dir+'/'+r));assert(!missing.length,'faltan: '+missing.join(','));
  const bundle=fs.readFileSync(dir+'/js/app.bundle.js','utf8');const links=(bundle.match(/<link rel="stylesheet" href="css\//g)||[]).length;
  assert(!links,`${links} plantillas PDF/impresión enlazan CSS externo en lugar de estilos en línea`);
  return 'referencias: '+refs.join(', ');
});
await test('T27','Recarga de pacientes (módulo v74) conserva plan semanal, historia clínica y medidas',async b=>{
  const a=await boot(b,'admin',{before:a=>{const d=a.mock.db.dietas[0];d.week_plan={Desayuno:{Lunes:'Avena con frutas'}};const h=a.mock.db.historias_clinicas[0];h.antec_fam=['Diabetes'];h.tiene_alergias='Sí';a.mock.db.evaluaciones[1].porcentaje_grasa=31.5;}});
  const P1=a.mock.ids.P1;
  const snap=()=>a.page.evaluate(id=>{const p=DB.patients.find(x=>x.id===id);return {plan:p.dietas[0]?.weekPlan?.Desayuno?.Lunes||'',fam:(p.historiaClinica.antecFam||[]).join(','),alerg:p.historiaClinica.tieneAlergias||'',grasa:p.evaluaciones.map(e=>e.grasa).filter(Boolean).join(',')}},P1);
  const before=await snap();
  await a.page.evaluate(()=>refreshPatientsFromSupabase({render:false}));await a.page.evaluate(()=>refreshEvaluationData74());await sleep(800);
  const after=await snap();
  assert(JSON.stringify(before)===JSON.stringify(after)&&before.plan&&before.fam&&before.grasa,`antes ${JSON.stringify(before)} después ${JSON.stringify(after)}`);
  return JSON.stringify(after);
});
await test('T28','Inventario atómico: con la función SQL v131 instalada se usa la transacción del servidor',async b=>{
  const a=await boot(b,'admin',{before:a=>{a.mock.ctl.stockRpc=true}});const {P1,PR2}=a.mock.ids;
  const num=await fillInvoice(a,{party:P1,lines:[{productId:PR2,description:'Suplemento proteico',qty:3,price:1800,discount:0}]});
  const ok=await saveInv(a);await sleep(1500);
  const st=a.mock.db.productos_servicios.find(p=>p.id===PR2).stock;assert(ok===true&&st===7&&a.mock.ctl.stockRpcCalls===1,`ok=${ok} stock=${st} llamadas=${a.mock.ctl.stockRpcCalls}`);
  return 'stock 10→7 en una sola transacción';
});
fs.writeFileSync(process.env.OUT||require('path').join(__dirname,'resultados.json'),JSON.stringify(results,null,2));
const pass=results.filter(r=>r.status==='PASS').length;console.log(`\n${pass}/${results.length} pruebas superadas`);process.exit(results.every(r=>r.status==='PASS')?0:1);
})();
