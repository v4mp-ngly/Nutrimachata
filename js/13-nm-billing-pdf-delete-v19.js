(function(){
'use strict';
function esc(v){return typeof billingEscape==='function'?billingEscape(v):String(v??'');}
function taxId(inv){if(inv?.rnc)return String(inv.rnc);const pts=typeof billingPatients==='function'?billingPatients():[];const p=pts.find(x=>String(x.id)===String(inv?.patientId))||pts.find(x=>String(x.nombre||'').trim().toLowerCase()===String(inv?.patient||'').trim().toLowerCase());return String(p?.cedula||p?.rnc||'');}
function concept(inv){return (inv?.items||[]).map(i=>i.description).filter(Boolean).join(' / ')||'—';}
function methods(inv){return [...new Set((inv?.paymentHistory||[]).map(p=>p.method).filter(Boolean))].join(' / ')||'—';}
function reportRange(){return {from:document.getElementById('acct-from')?.value||'',to:document.getElementById('acct-to')?.value||''};}
function reportRows(){const {from,to}=reportRange();return (getBillingData()?.invoices||[]).filter(x=>(!from||String(x.date||'')>=from)&&(!to||String(x.date||'')<=to)).slice().sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));}
function accountingTotals(rows){const active=rows.filter(x=>billingInvoiceStatus(x)!=='Archivada');return {billed:active.reduce((a,x)=>a+Number(x.total||0),0),paid:active.reduce((a,x)=>a+Number(x.paid||0),0),due:active.reduce((a,x)=>a+billingInvoiceBalance(x),0)};}
function waitAssets(root){
  const imgs=[...root.querySelectorAll('img')];
  return Promise.all([document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve(),...imgs.map(img=>img.complete?Promise.resolve():new Promise(r=>{img.addEventListener('load',r,{once:true});img.addEventListener('error',r,{once:true});setTimeout(r,2500)}))]);
}
window.deleteInvoice=async function(id){
  const x=getBillingData().invoices.find(i=>String(i.id)===String(id));
  if(!x){notify('La factura ya no existe.','warning');return;}
  const paid=Number(x.paid||0), balance=typeof billingInvoiceBalance==='function'?billingInvoiceBalance(x):Math.max(0,Number(x.total||0)-paid);
  if(!confirm(`¿Eliminar DEFINITIVAMENTE la factura ${x.number}?\
\
Total: ${moneyRD(x.total)}\
Pagado: ${moneyRD(paid)}\
Pendiente: ${moneyRD(balance)}\
\
También se eliminarán sus pagos y detalles. Esta acción no se puede deshacer.`))return;
  try{
    // Devuelve inventario antes de borrar los detalles.
    const bi=window.NMBillingInternal;
    if(!bi) throw new Error('Módulo interno de Facturación no disponible');
    await bi.applyInvoiceStock(x.items||[],+1,id,'Reverso por eliminación definitiva de factura');
    // Eliminar dependencias explícitamente para funcionar aunque las FK no tengan ON DELETE CASCADE.
    await bi.billingFetch(`${bi.BILLING_DB_TABLES.payments}?factura_id=eq.${encodeURIComponent(id)}`,'DELETE');
    await bi.billingFetch(`${bi.BILLING_DB_TABLES.details}?factura_id=eq.${encodeURIComponent(id)}`,'DELETE');
    // Los movimientos se conservan para auditoría, pero se desvinculan si la FK lo exige.
    try{await bi.billingFetch(`${bi.BILLING_DB_TABLES.inventory}?factura_id=eq.${encodeURIComponent(id)}`,'PATCH',{factura_id:null});}catch(_){ }
    await bi.billingFetch(`${bi.BILLING_DB_TABLES.invoices}?id=eq.${encodeURIComponent(id)}`,'DELETE');
    await bi.loadBillingFromSupabase(true);
    document.getElementById('invoice-view-modal')?.remove();
    if(typeof legacyRenderBilling==='function')legacyRenderBilling();else if(typeof renderBilling==='function')renderBilling();
    notify('Factura eliminada definitivamente.','success');
  }catch(e){
    console.error('[Facturación] Error eliminando factura:',e);
    const bi=window.NMBillingInternal;
    if(bi?.humanDbError) bi.humanDbError(e,'eliminar definitivamente la factura');
    else notify('No se pudo eliminar la factura. Revisa la conexión e inténtalo nuevamente.','danger');
    if(bi?.loadBillingFromSupabase) await bi.loadBillingFromSupabase(true).catch(()=>{});
  }
};

window.downloadInvoicePDF=function(id){
  const b=getBillingData(),x=b.invoices.find(i=>String(i.id)===String(id));
  if(!x){notify('La factura ya no existe','danger');return;}
  if(typeof html2pdf!=='function'){notify('El generador de PDF no está disponible','danger');return;}
  const stage=document.createElement('div');
  Object.assign(stage.style,{position:'absolute',left:'0',top:'0',zIndex:'-9999',width:'180mm',background:'#fff',pointerEvents:'none'});
  stage.innerHTML=nmInvoicePrintStyles()+nmInvoiceDocumentHTML(x,b);
  document.body.appendChild(stage);
  const node=stage.querySelector('.invoice-print-doc');
  node.style.width='180mm';node.style.padding='0';node.style.overflow='visible';
  const filename=`${x.number}_${String(x.patient).replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+/g,'_')}.pdf`,stamp=nmGenerationStamp();
  waitAssets(node).then(()=>html2pdf().set({margin:[12,15,16,15],filename,image:{type:'jpeg',quality:.99},html2canvas:{scale:2,useCORS:true,allowTaint:true,backgroundColor:'#fff',logging:false,scrollX:0,scrollY:0},jsPDF:{unit:'mm',format:'a4',orientation:'portrait',compress:true},pagebreak:{mode:['css','legacy'],avoid:['tr','.invoice-print-summary','.invoice-print-note','.invoice-party']}}).from(node).toPdf().get('pdf')).then(pdf=>{
    const total=pdf.internal.getNumberOfPages(),ident=nmDocumentIdentity();
    for(let i=1;i<=total;i++){pdf.setPage(i);pdf.setFontSize(7);pdf.setTextColor(110);pdf.text(`${ident.clinic} · ${ident.doctor} · ${x.number} · ${stamp}`,15,291);pdf.text(`Página ${i} de ${total}`,195,291,{align:'right'});}
    pdf.save(filename);notify('Factura PDF descargada correctamente.','success');
  }).catch(e=>{console.error(e);notify('No se pudo generar el PDF de la factura','danger');}).finally(()=>stage.remove());
};

window.downloadAccountingPDF=function(){
  const rows=reportRows();
  if(!rows.length){notify('No hay facturas en el período seleccionado.','warning');return;}
  if(typeof html2pdf!=='function'){notify('El generador de PDF no está disponible.','danger');return;}
  const t=accountingTotals(rows),r=reportRange(),logo=(typeof NUTRIMACHATA_REPORT_LOGO!=='undefined'?NUTRIMACHATA_REPORT_LOGO:'');
  const stage=document.createElement('div');
  Object.assign(stage.style,{position:'absolute',left:'0',top:'0',zIndex:'-9999',width:'275mm',background:'#fff',pointerEvents:'none'});
  const bodyRows=rows.map(x=>`<tr><td>${esc(x.date||'—')}</td><td><b>${esc(x.number||'—')}</b></td><td>${esc(x.patient||'—')}</td><td>${esc(taxId(x)||'—')}</td><td class="concept">${esc(concept(x))}</td><td class="num">${moneyRD(x.total)}</td><td class="num">${moneyRD(x.paid)}</td><td class="num"><b>${moneyRD(billingInvoiceBalance(x))}</b></td><td>${esc(billingInvoiceStatus(x))}</td><td>${esc(methods(x))}</td></tr>`).join('');
  stage.innerHTML=`<div id="acct-pdf-v19" style="font-family:Arial,sans-serif;color:#253126;background:#fff;width:275mm;box-sizing:border-box">
  <link rel="stylesheet" href="css/25-styles.css">
  <div class="head"><div>${logo?`<img src="${logo}" alt="NutriMachata">`:'<b style="font-size:20px;color:#315f0b">NutriMachata</b>'}</div><div style="text-align:right"><h1>REPORTE PARA CONTABILIDAD</h1><div class="range">Período: ${esc(r.from||'Inicio')} — ${esc(r.to||'Hoy')}</div></div></div>
  <div class="kpis"><div class="kpi"><small>TOTAL FACTURADO</small><b>${moneyRD(t.billed)}</b></div><div class="kpi"><small>TOTAL COBRADO</small><b>${moneyRD(t.paid)}</b></div><div class="kpi"><small>CUENTAS POR COBRAR</small><b>${moneyRD(t.due)}</b></div><div class="kpi"><small>FACTURAS DEL PERÍODO</small><b>${rows.length}</b></div></div>
  <table><thead><tr><th>Fecha</th><th>Factura</th><th>Paciente / Cliente</th><th>RNC / Cédula</th><th>Concepto</th><th>Total</th><th>Pagado</th><th>Pendiente</th><th>Estado</th><th>Método</th></tr></thead><tbody>${bodyRows}</tbody></table>
  <div class="note">Las facturas anuladas se conservan para trazabilidad y no se incluyen en los totales contables. Generado: ${new Date().toLocaleString('es-DO')}.</div></div>`;
  document.body.appendChild(stage);const node=stage.querySelector('#acct-pdf-v19');
  waitAssets(node).then(()=>html2pdf().set({margin:[10,10,13,10],filename:`Reporte_Contabilidad_${r.from||'inicio'}_${r.to||'hoy'}.pdf`,image:{type:'jpeg',quality:.99},html2canvas:{scale:2,useCORS:true,allowTaint:true,backgroundColor:'#fff',logging:false,scrollX:0,scrollY:0},jsPDF:{unit:'mm',format:'a4',orientation:'landscape',compress:true},pagebreak:{mode:['css','legacy'],avoid:['tr','.kpi','.head']}}).from(node).toPdf().get('pdf')).then(pdf=>{
    const total=pdf.internal.getNumberOfPages(),ident=nmDocumentIdentity(),stamp=nmGenerationStamp();
    for(let i=1;i<=total;i++){pdf.setPage(i);pdf.setFontSize(7);pdf.setTextColor(110);pdf.text(`${ident.clinic} · ${ident.doctor} · Reporte contable · ${stamp}`,10,203);pdf.text(`Página ${i} de ${total}`,287,203,{align:'right'});}
    pdf.save(`Reporte_Contabilidad_${r.from||'inicio'}_${r.to||'hoy'}.pdf`);notify('Reporte contable PDF descargado correctamente.','success');
  }).catch(e=>{console.error(e);notify('No se pudo generar el reporte contable PDF.','danger');}).finally(()=>stage.remove());
};
})();
