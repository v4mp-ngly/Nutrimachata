(function(){
  function E(v){return typeof billingEscape==='function'?billingEscape(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function M(v){return typeof moneyRD==='function'?moneyRD(Number(v||0)):`RD$ ${Number(v||0).toLocaleString('es-DO',{minimumFractionDigits:2,maximumFractionDigits:2})}`;}
  function fmtDate39(v){if(!v)return '—';try{const d=new Date(String(v).length<=10?String(v)+'T12:00:00':v);return d.toLocaleDateString('es-DO',{day:'2-digit',month:'long',year:'numeric'});}catch(_){return E(v)}}
  function invoiceStatus39(x){try{return typeof billingInvoiceStatus==='function'?billingInvoiceStatus(x):(Number(x.paid||0)>=Number(x.total||0)?'PAGADA':Number(x.paid||0)>0?'PAGO PARCIAL':'PENDIENTE')}catch(_){return 'PENDIENTE'}}
  function paymentInfo39(x){const h=Array.isArray(x.paymentHistory)?x.paymentHistory:[];if(!h.length)return {method:'Sin pagos registrados',reference:'',last:''};const p=h[h.length-1]||{};return {method:p.method||'Pago registrado',reference:p.reference||'',last:p.datetime||p.date||''};}
  window.NMInvoiceOfficialV39=true;
  nmInvoiceDocumentHTML=function(x,b){
    const logo=(typeof NUTRIMACHATA_REPORT_LOGO!=='undefined'?NUTRIMACHATA_REPORT_LOGO:'');
    const ident=typeof nmDocumentIdentity==='function'?nmDocumentIdentity():{clinic:'NutriMachata',doctor:'Dra. María Alejandra Chalas'};
    const status=invoiceStatus39(x),pay=paymentInfo39(x),balance=typeof billingInvoiceBalance==='function'?billingInvoiceBalance(x):Math.max(0,Number(x.total||0)-Number(x.paid||0));
    const items=(x.items||[]).map(i=>`<tr><td>${E(i.description||'')}</td><td>${E(i.qty||1)}</td><td>${M(i.price)}</td><td>${E(i.discount||0)}%</td><td><b>${M(typeof billingLineTotal==='function'?billingLineTotal(i):Number(i.qty||1)*Number(i.price||0))}</b></td></tr>`).join('')||'<tr><td colspan="5">Sin conceptos registrados</td></tr>';
    return `<div class="invoice-print-doc nm-invoice-official-v39" data-invoice="${E(x.number)}">
<link rel="stylesheet" href="css/29-styles.css">
<div class="v39-topline"></div><div class="v39-head"><div class="v39-brand">${logo?`<img src="${logo}" alt="NutriMachata">`:`<h1>${E(ident.clinic||'NutriMachata')}</h1>`}<div class="tag">Nutrición clínica · Bienestar · Seguimiento</div><div class="v39-doctor">${E(ident.doctor||'Dra. María Alejandra Chalas')}</div><div class="v39-care">Atención nutricional personalizada</div></div><div class="v39-title"><h2>FACTURA</h2><div class="num">${E(x.number||'')}</div><div class="meta">Fecha de emisión: ${fmtDate39(x.date)}</div><div class="meta">Estado: <span class="state">${E(String(status).toUpperCase())}</span></div></div></div>
<div class="v39-party"><div><div class="label">FACTURADO A</div><b>${E(x.patient||'Cliente / Paciente')}</b><span>RNC / Cédula: ${E(x.rnc||'No especificado')}</span></div><div><div class="label">DATOS FISCALES</div><b>NCF: ${E(x.ncf||'No especificado')}</b><span>Vencimiento: ${fmtDate39(x.dueDate)}</span></div></div>
<table><thead><tr><th>Concepto</th><th>Cant.</th><th>Precio</th><th>Desc.</th><th>Total</th></tr></thead><tbody>${items}</tbody></table>
<div class="v39-summary"><div><span>Subtotal</span><b>${M(x.subtotal)}</b></div><div><span>Descuento general</span><b>${E(x.discount||0)}%</b></div><div><span>ITBIS</span><b>${E(x.tax||0)}%</b></div><div class="total"><span>TOTAL</span><b>${M(x.total)}</b></div><div><span>Pagado</span><b>${M(x.paid)}</b></div><div class="strong"><span>Saldo pendiente</span><b>${M(balance)}</b></div></div>
<div class="v39-bottom"><div><div class="label">INFORMACIÓN DE PAGO</div><b>Método: ${E(pay.method)}</b>${pay.reference?`<p>Referencia: ${E(pay.reference)}</p>`:''}<p><b>Balance:</b> ${balance<=0.009?'Sin saldo pendiente':M(balance)}</p></div><div><div class="label">NOTA</div><p>${E(x.notes||b.templateNote||'Gracias por confiar en NutriMachata. Conserva esta factura como comprobante de tu servicio.')}</p></div></div>
<div class="v39-footer">Documento generado por NutriMachata · ${E(x.number||'')} · ${new Date().toLocaleDateString('es-DO',{day:'2-digit',month:'short',year:'numeric'})}</div><div class="v39-footline"></div></div>`;
  };
})();
