(function(){
  'use strict';
  function esc(v){return typeof billingEscape==='function'?billingEscape(v):String(v??'');}
  function taxId(inv){
    if(inv?.rnc) return String(inv.rnc);
    const pts=typeof billingPatients==='function'?billingPatients():[];
    const p=pts.find(x=>String(x.id)===String(inv?.patientId))||pts.find(x=>String(x.nombre||'').trim().toLowerCase()===String(inv?.patient||'').trim().toLowerCase());
    return String(p?.cedula||p?.rnc||'');
  }
  function concept(inv){return (inv?.items||[]).map(i=>i.description).filter(Boolean).join(' / ')||'—';}
  function methods(inv){return [...new Set((inv?.paymentHistory||[]).map(p=>p.method).filter(Boolean))].join(' / ')||'—';}
  function reportRange(){
    const from=document.getElementById('acct-from')?.value||'';
    const to=document.getElementById('acct-to')?.value||'';
    return {from,to};
  }
  function reportRows(){
    const {from,to}=reportRange();
    const inv=(getBillingData()?.invoices||[]).filter(x=>(!from||String(x.date||'')>=from)&&(!to||String(x.date||'')<=to));
    return inv.slice().sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
  }
  function accountingTotals(rows){
    const active=rows.filter(x=>billingInvoiceStatus(x)!=='Archivada');
    return {
      billed:active.reduce((a,x)=>a+Number(x.total||0),0),
      paid:active.reduce((a,x)=>a+Number(x.paid||0),0),
      due:active.reduce((a,x)=>a+billingInvoiceBalance(x),0)
    };
  }
  window.renderAccountingReport=function(){
    const box=document.getElementById('accounting-report-results');if(!box)return;
    const rows=reportRows(),t=accountingTotals(rows);
    box.innerHTML=`<div class="bill-stats" style="margin:16px 0"><div class="card" style="padding:15px"><small>FACTURADO</small><h3>${moneyRD(t.billed)}</h3></div><div class="card" style="padding:15px"><small>COBRADO</small><h3>${moneyRD(t.paid)}</h3></div><div class="card" style="padding:15px"><small>PENDIENTE</small><h3>${moneyRD(t.due)}</h3></div><div class="card" style="padding:15px"><small>FACTURAS</small><h3>${rows.length}</h3></div></div>${rows.length?`<div class="table-responsive"><table class="table"><thead><tr><th>Fecha</th><th>Factura</th><th>Paciente / Cliente</th><th>RNC / Cédula</th><th>Concepto</th><th>Total</th><th>Pagado</th><th>Pendiente</th><th>Estado</th><th>Método</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.date||'—')}</td><td><b>${esc(x.number)}</b></td><td>${esc(x.patient)}</td><td>${esc(taxId(x)||'—')}</td><td>${esc(concept(x))}</td><td>${moneyRD(x.total)}</td><td>${moneyRD(x.paid)}</td><td><b>${moneyRD(billingInvoiceBalance(x))}</b></td><td>${esc(billingInvoiceStatus(x))}</td><td>${esc(methods(x))}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state"><div class="empty-title">No hay facturas en este período</div></div>'}`;
  };
  function accountingPanel(){
    const now=new Date(),first=new Date(now.getFullYear(),now.getMonth(),1).toISOString().slice(0,10),today=now.toISOString().slice(0,10);
    return `<div class="card mt-4"><div class="card-header"><div><div class="card-title">Reporte para contabilidad</div><div class="card-subtitle">Facturas, cobros y cuentas por cobrar con RNC / Cédula del paciente.</div></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-outline btn-sm" onclick="downloadAccountingCSV()">CSV / Excel</button><button class="btn btn-olive btn-sm" onclick="downloadAccountingPDF()">PDF</button></div></div><div class="card-body"><div class="form-row"><div class="form-group"><label for="acct-from">Desde</label><input id="acct-from" class="form-control" type="date" value="${first}" onchange="renderAccountingReport()"></div><div class="form-group"><label for="acct-to">Hasta</label><input id="acct-to" class="form-control" type="date" value="${today}" onchange="renderAccountingReport()"></div></div><div id="accounting-report-results"></div></div></div>`;
  }
  const oldRenderTab=window.renderBillingTab;
  window.renderBillingTab=function(tab,btn){
    oldRenderTab(tab,btn);
    if(tab==='financial'){
      const el=document.getElementById('billing-tab-content');
      if(el&&!document.getElementById('accounting-report-results')){el.insertAdjacentHTML('beforeend',accountingPanel());renderAccountingReport();}
    }
  };
  window.downloadAccountingCSV=function(){
    const rows=reportRows();if(!rows.length){notify('No hay facturas en el período seleccionado.','warning');return;}
    const data=[['Fecha','No. factura','Paciente / Cliente','RNC / Cédula','Concepto','Total facturado','Pagado','Pendiente','Estado','Método de pago']];
    rows.forEach(x=>data.push([x.date||'',x.number||'',x.patient||'',taxId(x),concept(x),Number(x.total||0).toFixed(2),Number(x.paid||0).toFixed(2),billingInvoiceBalance(x).toFixed(2),billingInvoiceStatus(x),methods(x)]));
    const csv='\\ufeff'+data.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\\r\
');
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=`Reporte_Contabilidad_${reportRange().from||'inicio'}_${reportRange().to||'hoy'}.csv`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
  };
  window.downloadAccountingPDF=function(){
    const rows=reportRows();if(!rows.length){notify('No hay facturas en el período seleccionado.','warning');return;}if(typeof html2pdf!=='function'){notify('El generador de PDF no está disponible.','danger');return;}
    const t=accountingTotals(rows),r=reportRange(),logo=(typeof NUTRIMACHATA_REPORT_LOGO!=='undefined'?NUTRIMACHATA_REPORT_LOGO:'');
    const wrap=document.createElement('div');wrap.style.cssText='position:fixed;left:-12000px;top:0;width:1050px;background:#fff';
    wrap.innerHTML=`<div style="font-family:Arial,sans-serif;color:#253126;padding:28px;background:white"><div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #5E8C2A;padding-bottom:14px">${logo?`<img src="${logo}" style="height:52px;max-width:220px;object-fit:contain">`:'<b style="font-size:24px;color:#355e20">NutriMachata</b>'}<div style="text-align:right"><h2 style="margin:0">REPORTE PARA CONTABILIDAD</h2><div>${esc(r.from||'Inicio')} — ${esc(r.to||'Hoy')}</div></div></div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:18px 0"><div><small>FACTURADO</small><b style="display:block;font-size:18px">${moneyRD(t.billed)}</b></div><div><small>COBRADO</small><b style="display:block;font-size:18px">${moneyRD(t.paid)}</b></div><div><small>PENDIENTE</small><b style="display:block;font-size:18px">${moneyRD(t.due)}</b></div></div><table style="width:100%;border-collapse:collapse;font-size:9px"><thead><tr style="background:#355E3B;color:white"><th style="padding:7px">Fecha</th><th>Factura</th><th>Paciente</th><th>RNC / Cédula</th><th>Concepto</th><th>Total</th><th>Pagado</th><th>Pendiente</th><th>Estado</th><th>Método</th></tr></thead><tbody>${rows.map(x=>`<tr>${[x.date,x.number,x.patient,taxId(x),concept(x),moneyRD(x.total),moneyRD(x.paid),moneyRD(billingInvoiceBalance(x)),billingInvoiceStatus(x),methods(x)].map(v=>`<td style="padding:7px 5px;border-bottom:1px solid #e5e9e2">${esc(v||'—')}</td>`).join('')}</tr>`).join('')}</tbody></table><div style="margin-top:18px;font-size:9px;color:#667">Facturas anuladas se muestran para trazabilidad, pero no se incluyen en los totales facturados/cobrados/pendientes.</div></div>`;
    document.body.appendChild(wrap);
    html2pdf().set({margin:[7,7,9,7],filename:`Reporte_Contabilidad_${r.from||'inicio'}_${r.to||'hoy'}.pdf`,image:{type:'jpeg',quality:.98},html2canvas:{scale:2,useCORS:true,backgroundColor:'#fff'},jsPDF:{unit:'mm',format:'a4',orientation:'landscape'},pagebreak:{mode:['css','legacy'],avoid:['tr']}}).from(wrap.firstElementChild).save().finally(()=>wrap.remove());
  };
  // Fill fiscal ID from the selected patient's cédula/RNC.
  const oldFill=window.billingFillPatient;
  window.billingFillPatient=function(sel){
    if(typeof oldFill==='function')oldFill(sel);
    const p=(typeof billingPatients==='function'?billingPatients():[]).find(x=>String(x.id)===String(sel?.value));
    const input=document.getElementById('inv-rnc');if(input&&p)input.value=String(p.cedula||p.rnc||'');
  };
})();
