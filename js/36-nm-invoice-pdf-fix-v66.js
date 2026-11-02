(function(){
'use strict';
/* La factura debe ser A4 horizontal. Esta última sobreescritura es intencional:
   evita que una definición anterior vuelva a exportarla en vertical. */
const safe68=v=>String(v||'Factura').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'');
const invoiceNode68=(x,b)=>{
 const wrap=document.createElement('div');
 wrap.innerHTML=(typeof nmInvoicePrintStyles==='function'?nmInvoicePrintStyles():'')+(typeof nmInvoiceDocumentHTML==='function'?nmInvoiceDocumentHTML(x,b):'');
 const doc=wrap.querySelector('.invoice-print-doc')||wrap;
 doc.style.setProperty('padding','0 6mm','important');
 doc.style.setProperty('box-sizing','border-box','important');
 const fix=document.createElement('style');fix.textContent=`
 .invoice-print-doc.nm-invoice-official-v39{overflow:hidden!important}
 .invoice-print-doc.nm-invoice-official-v39 .v39-topline{margin-bottom:4mm!important}
 .invoice-print-doc.nm-invoice-official-v39 .v39-head{gap:8mm!important}
 .invoice-print-doc.nm-invoice-official-v39 .v39-brand img{max-height:13mm!important;margin-bottom:1mm!important}
 .invoice-print-doc.nm-invoice-official-v39 .v39-brand .tag{margin:0 0 1.5mm!important}
 .invoice-print-doc.nm-invoice-official-v39 .v39-title{padding-right:1mm!important}
 .invoice-print-doc.nm-invoice-official-v39 .v39-title h2{font-size:24px!important}
 .invoice-print-doc.nm-invoice-official-v39 .v39-party{margin:4mm 0!important;padding:3mm!important;gap:8mm!important}
 .invoice-print-doc.nm-invoice-official-v39 table{width:100%!important;max-width:100%!important;table-layout:fixed!important}
 .invoice-print-doc.nm-invoice-official-v39 th,.invoice-print-doc.nm-invoice-official-v39 td{box-sizing:border-box!important;overflow-wrap:anywhere!important}
 .invoice-print-doc.nm-invoice-official-v39 th:nth-child(1),.invoice-print-doc.nm-invoice-official-v39 td:nth-child(1){width:54%!important;text-align:left!important}
 .invoice-print-doc.nm-invoice-official-v39 th:nth-child(2),.invoice-print-doc.nm-invoice-official-v39 td:nth-child(2){width:9%!important;text-align:center!important;white-space:nowrap!important}
 .invoice-print-doc.nm-invoice-official-v39 th:nth-child(3),.invoice-print-doc.nm-invoice-official-v39 td:nth-child(3){width:14%!important;text-align:right!important;white-space:nowrap!important}
 .invoice-print-doc.nm-invoice-official-v39 th:nth-child(4),.invoice-print-doc.nm-invoice-official-v39 td:nth-child(4){width:9%!important;text-align:right!important;white-space:nowrap!important}
 .invoice-print-doc.nm-invoice-official-v39 th:nth-child(5),.invoice-print-doc.nm-invoice-official-v39 td:nth-child(5){width:14%!important;text-align:right!important;white-space:nowrap!important;padding-right:3mm!important}
 .invoice-print-doc.nm-invoice-official-v39 .v39-summary{width:46%!important;margin:4mm 2mm 4mm auto!important}
 .invoice-print-doc.nm-invoice-official-v39 .v39-summary>div{padding:1.2mm 2mm!important}
 .invoice-print-doc.nm-invoice-official-v39 .v39-summary .total{padding:2mm!important;margin-top:1mm!important}
 .invoice-print-doc.nm-invoice-official-v39 .v39-bottom{padding:3mm!important;margin-top:2mm!important}
 .invoice-print-doc.nm-invoice-official-v39 .v39-footer{margin-top:4mm!important}
 .invoice-print-doc.nm-invoice-official-v39 .v39-footline{height:2.5mm!important;margin-top:3mm!important}
 @media print{@page{size:A4 landscape;margin:12mm 10mm 14mm}}
 `;doc.appendChild(fix);
 return doc;
};
window.downloadInvoicePDF=async function(id){
 const b=typeof getBillingData==='function'?getBillingData():null,x=b?.invoices?.find(i=>String(i.id)===String(id));
 if(!x)return notify?.('La factura ya no existe.','warning');
 try{
  if(!window.NMProPDF64?.save)throw new Error('El generador PDF no está disponible');
  await window.NMProPDF64.save(invoiceNode68(x,b),`${safe68(x.number)}_${safe68(x.patient)}.pdf`,{orientation:'landscape'});
  notify?.('Factura A4 horizontal descargada correctamente.','success');
 }catch(e){console.error('[Factura PDF horizontal v68]',e);notify?.('No se pudo generar la factura PDF.','danger');}
};
window.previewInvoicePDF=function(id){
 const b=typeof getBillingData==='function'?getBillingData():null,x=b?.invoices?.find(i=>String(i.id)===String(id));
 if(!x)return notify?.('La factura ya no existe.','warning');
 if(!window.NMProPDF64?.preview)return window.downloadInvoicePDF(id);
 return window.NMProPDF64.preview(invoiceNode68(x,b),`${safe68(x.number)}_${safe68(x.patient)}.pdf`,{orientation:'landscape'});
};
window.NMInvoicePDFFixV66=true;window.NMPDFNoClipV67=true;window.NMInvoiceLandscapeV68=true;
})();
