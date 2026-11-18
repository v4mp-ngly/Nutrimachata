// Genera TODOS los PDF del sistema y los convierte a PNG para revisión visual.
const {openApp,login}=require('./harness');const fs=require('fs');const path=require('path');
const dir=process.argv[2],out=process.argv[3]||'/tmp/pdfs',only=process.argv[4]||'';
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function seed(m){
  const {P1,P2,PR1,PR2,F1}=m.ids;const db=m.db;const now=new Date().toISOString();
  const d=n=>{const x=new Date();x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)};
  const P=db.pacientes.find(p=>p.id===P1);Object.assign(P,{fecha_nacimiento:'1992-04-18',direccion:'Av. Winston Churchill #45, Santo Domingo',objetivo:'Reducir 8 kg y mejorar hábitos',alergias:'Mariscos',enfermedades:'Hipotiroidismo controlado'});
  Object.assign(db.historias_clinicas[0],{motivo:'Control de peso y energía',objetivo:'Bajar 8 kg en 6 meses',plazo:'6 meses',antecedentes:['Hipotiroidismo'],antec_fam:['Diabetes tipo 2','Hipertensión'],medicamentos:'Levotiroxina 50 mcg',tiene_alergias:'Sí',alergias:'Mariscos',actividad:'Ligera',ejercicio:'Caminar',frecuencia:'3 veces/semana',sueno:'6 horas',estres:'Moderado',habitos:['Café diario'],sintomas:['Cansancio','Ansiedad por dulce'],come_estres:'Sí',come_rapido:'Sí',horarios_regulares:'No',rec24_desayuno:'Pan con huevo y café',rec24_almuerzo:'Arroz, habichuelas, pollo',rec24_cena:'Sándwich',created_at:'2026-01-02T10:00:00Z'});
  db.evaluaciones.filter(e=>e.paciente_id===P1).forEach((e,i)=>Object.assign(e,{cuello:34+i,pecho:96-i,cintura:88-2*i,abdomen:94-2*i,cadera:104-i,muslo:58,porcentaje_grasa:33-i,frecuencia_cardiaca:72,obs:i?'Buena adherencia al plan. Mejoró hidratación.':'Primera consulta.'}));
  const wp={};['Desayuno','Media mañana','Almuerzo','Merienda','Cena'].forEach(c=>{wp[c]={};['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'].forEach((dd,j)=>wp[c][dd]=`${c} opción ${j+1}: 1 taza de vegetales\n4 oz proteína magra`)});
  Object.assign(db.dietas[0],{week_plan:wp,fecha:d(-5),calorias:1600,tipo:'Semanal',indicaciones:'Beber 2 litros de agua diarios. Evitar frituras y azúcares simples. Caminar 30 minutos.'});
  // factura larga (30 líneas) para probar varias páginas
  const F2='00000000-0000-4000-8000-0000000000f2';let sub=0;
  for(let i=1;i<=30;i++){const pr=i%2?2500:1800;sub+=pr;db.factura_detalles.push({id:'d2-'+i,factura_id:F2,producto_servicio_id:i%2?PR1:PR2,descripcion:(i%2?'Consulta nutricional de seguimiento':'Suplemento proteico sabor vainilla 2 lb')+' #'+i,cantidad:1,precio_unitario:pr,descuento:0,subtotal:pr,created_at:now})}
  db.facturas.push({id:F2,numero_factura:'FAC-0002',paciente_id:P2,paciente_nombre:'Luis Gómez',fecha:d(-1),estado:'pendiente',subtotal:sub,descuento:0,impuestos:0,total:sub,total_pagado:0,saldo:sub,ncf:'B0100000012',notas:'Plan trimestral de seguimiento.',created_at:now});
  db.cotizaciones=[{id:'q1',numero_cotizacion:'COT-0001',cliente_nombre:'Ana Pérez',paciente_id:P1,fecha:d(-2),valida_hasta:d(13),estado:'pendiente',subtotal:4300,descuento:0,total:4300,notas:'Incluye 2 consultas.',created_at:now}];
  db.cotizacion_detalles=[{id:'qd1',cotizacion_id:'q1',descripcion:'Consulta nutricional',cantidad:1,precio_unitario:2500,subtotal:2500,created_at:now},{id:'qd2',cotizacion_id:'q1',descripcion:'Suplemento proteico',cantidad:1,precio_unitario:1800,subtotal:1800,created_at:now}];
  db.cierres_caja=[{id:'c1',fecha:d(-1),fecha_cierre:now,total_facturado:4000,total_cobrado:1000,total_gastos:500,efectivo:1000,tarjeta:0,transferencia:0,cheque:0,otros:0,efectivo_esperado:1000,efectivo_contado:1000,diferencia:0,neto:500,cantidad_facturas:1,cantidad_pagos:1,cantidad_gastos:1,observaciones:'Cierre de prueba',estado:'cerrado',created_at:now}];
  db.saldos_favor=[{id:'s1',paciente_id:P1,saldo:750,updated_at:now}];
}
const jobs=[
 ['01_factura','async(ids)=>downloadInvoicePDF(ids.F1)'],
 ['02_factura_larga','async(ids)=>downloadInvoicePDF("00000000-0000-4000-8000-0000000000f2")'],
 ['03_recibo_pago','async(ids)=>{const x=getBillingData().invoices.find(i=>i.id===ids.F1);return downloadPaymentReceiptV20(ids.F1,x.paymentHistory[0].id)}'],
 ['04_cotizacion','async(ids)=>{navigate("billing");await new Promise(r=>setTimeout(r,1200));await renderBillingTab("quotes");await new Promise(r=>setTimeout(r,1500));return downloadQuotePDF("q1")}'],
 ['05_estado_cuenta','async(ids)=>NMDownloadStatement("patient:"+ids.P1)'],
 ['06_reporte_contable','async(ids)=>{navigate("billing");await new Promise(r=>setTimeout(r,1200));try{renderBillingTab("reports")}catch(e){};await new Promise(r=>setTimeout(r,1500));return downloadAccountingPDF()}'],
 ['07_reporte_caja_periodo','async(ids)=>{navigate("billing");await new Promise(r=>setTimeout(r,1200));const t=new Date().toISOString().slice(0,10);await renderCashReportsV62(t.slice(0,7)+"-01",t);await new Promise(r=>setTimeout(r,800));return downloadCashPeriodPDFV62()}'],
 ['08_cierre_individual','async(ids)=>{navigate("billing");await new Promise(r=>setTimeout(r,1200));const t=new Date().toISOString().slice(0,10);await renderCashReportsV62(t.slice(0,7)+"-01",t);return downloadSingleCashClosePDFV62("c1")}'],
 ['09_cierre_caja','async(ids)=>{navigate("billing");await new Promise(r=>setTimeout(r,1200));const t=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Santo_Domingo"}).format(new Date());await renderCashCloseV54(t.slice(0,7)+"-01",t);await new Promise(r=>setTimeout(r,800));return printCashCloseV54()}'],
 ['10_saldos_favor','async(ids)=>{navigate("billing");await new Promise(r=>setTimeout(r,1200));await renderBillingTab("balances");await new Promise(r=>setTimeout(r,1500));return downloadBalancesPDF92()}'],
 ['11_historia_clinica','async(ids)=>downloadHistoriaClinica(ids.P1)'],
 ['12_evaluacion','async(ids)=>{const p=DB.patients.find(x=>x.id===ids.P1);const e=[...p.evaluaciones].sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha))).pop();return downloadEvalReport(ids.P1,e.id)}'],
 ['13_reporte_paciente','async(ids)=>downloadPatientReport(ids.P1)'],
 ['14_reporte_clinico','async(ids)=>{openReportModal(ids.P1);await new Promise(r=>setTimeout(r,2500));return downloadReportPDF()}'],
 ['15_dieta','async(ids)=>{const p=DB.patients.find(x=>x.id===ids.P1);return downloadDiet(ids.P1,p.dietas[0].id)}'],
 ['16_dieta_archivo','async(ids)=>{const p=DB.patients.find(x=>x.id===ids.P1);return downloadDietFile(ids.P1,p.dietas[0].id)}'],
];
(async()=>{
  const res=[];
  for(const [name,fn] of jobs){
    if(only&&!only.split(',').includes(name))continue;
    const a=await openApp(dir,{before:null});seed(a.mock);
    const {page,mock}=a;let popup=null;
    a.context.on('page',p=>{popup=p});
    page.on('dialog',d=>d.accept().catch(()=>{}));
    await sleep(400);await login(page,mock.U.admin.email,mock.U.admin.password);await sleep(3500);
    await page.evaluate(()=>navigate('billing'));await sleep(1500);
    let status='';
    try{
      const dl=page.waitForEvent('download',{timeout:60000});
      page.evaluate(`(${fn})(${JSON.stringify(mock.ids)})`).catch(e=>{status='ERR '+e.message.slice(0,120)});
      // vista previa: pulsar el botón Descargar si aparece
      const clicker=(async()=>{for(let i=0;i<60;i++){await sleep(500);const c=await page.evaluate(()=>{const b=document.querySelector('#nm64-save,#nm-pdf64-preview .btn-olive,.nm-print-preview-actions .btn-olive');if(b&&!b.disabled){b.click();return true}return false}).catch(()=>false);if(c)return}})();
      const d=await Promise.race([dl,(async()=>{for(let i=0;i<120;i++){await sleep(500);if(popup)return 'popup'}return null})()]);
      if(d==='popup'){await sleep(2500);const f=path.join(out,name+'.pdf');await popup.pdf({path:f,format:'A4',printBackground:true}).catch(async()=>{await popup.screenshot({path:f.replace('.pdf','.png'),fullPage:true})});status=status||'popup(print)';}
      else if(d){const f=path.join(out,name+'.pdf');await d.saveAs(f);status=status||'ok';}
      else status=status||'sin descarga';
    }catch(e){status='ERR '+String(e.message).slice(0,150)}
    const errs=a.errors.concat((await page.evaluate(()=>window.__rej||[]).catch(()=>[])).map(x=>'rej:'+x));
    res.push({name,status,errors:errs.slice(0,3)});console.log(name,status,errs.length?JSON.stringify(errs.slice(0,2)):'');
    await a.browser.close();
  }
  fs.writeFileSync(path.join(out,'pdfs.json'),JSON.stringify(res,null,1));
})();
