(function(){
'use strict';
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const M=v=>typeof moneyRD==='function'?moneyRD(v):'RD$ '+Number(v||0).toLocaleString('es-DO',{minimumFractionDigits:2,maximumFractionDigits:2});
const logo=()=>typeof NUTRIMACHATA_REPORT_LOGO!=='undefined'?NUTRIMACHATA_REPORT_LOGO:'';
const brand=()=>logo()?`<img src="${logo()}" style="max-width:145px;max-height:46px;object-fit:contain">`:`<div class="nm-pdf-brand">NutriMachata</div>`;
const foot=(label='Documento')=>`<div class="nm-pdf-footer">${E(label)} generado por NutriMachata · Dra. María Alejandra Chalas · ${new Date().toLocaleDateString('es-DO')}</div>`;
async function save(root,filename,orientation='portrait'){
 if(typeof html2pdf!=='function')throw new Error('El generador PDF no está disponible');
 document.body.appendChild(root); const doc=root.firstElementChild||root;
 await Promise.all([...doc.querySelectorAll('img')].map(i=>i.complete?Promise.resolve():new Promise(r=>{i.onload=i.onerror=r})));
 try{if(window.NMProPDF64?.preview){root.remove();return await window.NMProPDF64.preview(doc.cloneNode(true),filename,{orientation})}return await html2pdf().set({margin:[10,10,10,10],filename,image:{type:'jpeg',quality:.98},html2canvas:{scale:2,useCORS:true,backgroundColor:'#fff',logging:false,scrollX:0,scrollY:0},jsPDF:{unit:'mm',format:'a4',orientation,compress:true},pagebreak:{mode:['css','legacy'],avoid:['tr','.nm-pdf-card','.nm-pdf-kpi']}}).from(doc).save()}finally{root.remove()}
}
function host(html){const h=document.createElement('div');h.style.cssText='position:fixed;left:-10000px;top:0;width:180mm;background:#fff;z-index:-1';h.innerHTML=html;return h}

// Estilo base para historia clínica, evaluaciones, dietas y documentos que usan downloadPDF.
const oldDownload=window.downloadPDF;
window.downloadPDF=function(htmlContent,filename){
 try{
  const p=new DOMParser().parseFromString(htmlContent,'text/html');
  const style=`<link rel="stylesheet" href="css/32-styles.css">`;
  p.head.insertAdjacentHTML('beforeend',style);
  return oldDownload.call(this,'<!doctype html>'+p.documentElement.outerHTML,filename);
 }catch(e){console.warn('[PDF v61] estilo base',e);return oldDownload.call(this,htmlContent,filename)}
};

// Cotización profesional.
window.downloadQuotePDF=async function(id){
 const q=(typeof QUOTES!=='undefined'?QUOTES:[]).find(x=>String(x.id)===String(id)); if(!q)return notify?.('No se encontró la cotización.','warning');
 const rows=(q.items||[]).map(i=>`<tr><td>${E(i.descripcion)}</td><td style="text-align:center">${E(i.cantidad)}</td><td style="text-align:right">${M(i.precio_unitario)}</td><td style="text-align:right">${Number(i.descuento||0)}%</td><td style="text-align:right"><b>${M(i.total_linea??i.subtotal)}</b></td></tr>`).join('');
 const html=`<div class="nm-pdf-v61" style="width:180mm;padding:4mm"><div class="nm-pdf-top"></div><div class="nm-pdf-head"><div>${brand()}<div class="nm-pdf-sub">Nutrición clínica · Bienestar · Seguimiento<br>Dra. María Alejandra Chalas</div></div><div class="nm-pdf-title"><strong>COTIZACIÓN</strong><div class="nm-pdf-meta">${E(q.numero_cotizacion||q.numero||'')}</div><div class="nm-pdf-meta">Fecha: ${E(q.fecha||'—')}</div></div></div><div class="nm-pdf-card"><div class="nm-pdf-label">Cliente / paciente</div><b style="font-size:15px">${E(q.cliente_nombre||q.paciente_nombre||'—')}</b><div style="font-size:10px;margin-top:3px">Cédula/RNC: ${E(q.cedula_rnc||q.cedula||'—')} · Válida hasta: ${E(q.valida_hasta||q.fecha_vencimiento||'—')}</div></div><table><thead><tr><th>Concepto</th><th>Cant.</th><th style="text-align:right">Precio</th><th style="text-align:right">Desc.</th><th style="text-align:right">Total</th></tr></thead><tbody>${rows||'<tr><td colspan="5">Sin conceptos registrados</td></tr>'}</tbody></table><div class="nm-pdf-total"><div><span>Subtotal</span><b>${M(q.subtotal)}</b></div><div><span>Descuento</span><b>${M(q.descuento)}</b></div><div><span>ITBIS</span><b>${M(q.impuestos)}</b></div><div class="grand"><span>TOTAL</span><b>${M(q.total)}</b></div></div>${q.notas?`<div class="nm-pdf-card"><div class="nm-pdf-label">Notas</div><div style="font-size:10px;margin-top:4px">${E(q.notas)}</div></div>`:''}${foot('Cotización')}</div>`;
 try{await save(host(html),`${E(q.numero_cotizacion||q.numero||'Cotizacion').replace(/[^a-zA-Z0-9_-]/g,'_')}.pdf`)}catch(e){console.error(e);notify?.('No se pudo generar la cotización PDF.','danger')}
};

// Recibo de pago profesional.
window.downloadPaymentReceiptV20=async function(invoiceId,paymentId){
 const x=getBillingData().invoices.find(i=>String(i.id)===String(invoiceId));const p=x?.paymentHistory?.find(q=>String(q.id)===String(paymentId));if(!x||!p)return notify?.('No se encontró el pago.','warning');
 const hist=x.paymentHistory||[],idx=hist.findIndex(q=>String(q.id)===String(paymentId)),before=hist.slice(0,Math.max(0,idx)).reduce((n,q)=>n+Number(q.amount||0),0),amount=Number(p.amount||0),remaining=Math.max(0,Number(x.total||0)-before-amount);const no=window.NMReceiptNumberConfigured?window.NMReceiptNumberConfigured(p,x):(window.NMReceiptNumber?.(p)||'RECIBO');
 const html=`<div class="nm-pdf-v61" style="width:180mm;padding:4mm"><div class="nm-pdf-top"></div><div class="nm-pdf-head"><div>${brand()}<div class="nm-pdf-sub">Dra. María Alejandra Chalas</div></div><div class="nm-pdf-title"><strong>RECIBO DE PAGO</strong><div class="nm-pdf-meta">${E(no)}</div><div class="nm-pdf-meta">${E(p.datetime||p.date||'')}</div></div></div><div class="nm-pdf-card"><div class="nm-pdf-label">Recibido de</div><b style="font-size:15px">${E(x.patient||'—')}</b><div style="font-size:10px;margin-top:3px">Factura: <b>${E(x.number||'—')}</b> · Cédula/RNC: ${E(x.rnc||'—')}</div></div><div style="background:#355e3b;color:#fff;border-radius:12px;padding:18px 20px;margin:18px 0"><div style="font-size:9px;letter-spacing:.6px">MONTO RECIBIDO</div><div style="font-size:29px;font-weight:800;margin-top:4px">${M(amount)}</div></div><table><tbody><tr><td>Total factura</td><td style="text-align:right"><b>${M(x.total)}</b></td></tr><tr><td>Balance antes del pago</td><td style="text-align:right"><b>${M(Math.max(0,Number(x.total||0)-before))}</b></td></tr><tr><td>Este pago</td><td style="text-align:right"><b>${M(amount)}</b></td></tr><tr><td style="font-size:12px;font-weight:800">Saldo restante</td><td style="text-align:right;font-size:15px;color:${remaining>0?'#b76812':'#355e20'}"><b>${M(remaining)}</b></td></tr></tbody></table><div class="nm-pdf-card" style="display:grid;grid-template-columns:1fr 1fr;gap:18px"><div><div class="nm-pdf-label">Método</div><b>${E(p.method||'Otro')}</b></div><div><div class="nm-pdf-label">Referencia</div><b>${E(p.reference||'—')}</b></div></div>${foot('Recibo de pago')}</div>`;
 try{await save(host(html),`${E(no).replace(/[^a-zA-Z0-9_-]/g,'_')}_${E(x.number).replace(/[^a-zA-Z0-9_-]/g,'_')}.pdf`)}catch(e){console.error(e);notify?.('No se pudo generar el recibo PDF.','danger')}
};

// Impresión del cierre de caja con formato de reporte A4.
window.printCashCloseV54=function(){const el=document.getElementById('billing-tab-content');if(!el)return;const w=window.open('','_blank');if(!w)return notify?.('Permite ventanas emergentes para imprimir.','warning');const clone=el.cloneNode(true);clone.querySelectorAll('button,input,select').forEach(n=>n.remove());w.document.write(`<!doctype html><html><head><title>Cierre de caja</title><link rel="stylesheet" href="css/33-styles.css">
<link rel="stylesheet" href="css/34-nm-v116-green-sidebar.css">
</head><body><div class="head"><div><h1>NutriMachata</h1><small>Dra. María Alejandra Chalas</small></div><div style="text-align:right"><b>CIERRE DE CAJA</b><br><small>${new Date().toLocaleDateString('es-DO')}</small></div></div>${clone.innerHTML}<div class="footer">Cierre de caja generado por NutriMachata</div><script>window.onload=()=>setTimeout(()=>window.print(),250);\x3c\/script>\x3c/body>\x3c/html>`);w.document.close()};
window.NMPDFProfessionalV61=true;
})();
