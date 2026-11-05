(function(){
'use strict';
const esc32=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
function receiptNo32(p){
  const d=String(p?.datetime||p?.date||'').replace(/[^0-9]/g,'').slice(0,8)||new Date().toISOString().slice(0,10).replace(/-/g,'');
  const raw=String(p?.id||'').replace(/[^a-zA-Z0-9]/g,'').toUpperCase();
  return `REC-${d}-${(raw.slice(-6)||'000001').padStart(6,'0')}`;
}
function dateTime32(p){
  const raw=p?.datetime||p?.date; if(!raw)return '—';
  const d=new Date(raw);
  if(!Number.isNaN(d.getTime()) && String(raw).includes('T')) return d.toLocaleString('es-DO',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  return String(p.date||raw);
}
window.NMReceiptNumber=receiptNo32;
window.downloadPaymentReceiptV20=function(invoiceId,paymentId){
 const x=getBillingData().invoices.find(i=>String(i.id)===String(invoiceId));
 const p=x?.paymentHistory?.find(q=>String(q.id)===String(paymentId));
 if(!x||!p){notify('No se encontró el pago.','warning');return}
 if(typeof html2pdf!=='function'){notify('El generador de PDF no está disponible.','danger');return}
 const history=(x.paymentHistory||[]).slice();
 const idx=history.findIndex(q=>String(q.id)===String(paymentId));
 const paidBefore=history.slice(0,Math.max(0,idx)).reduce((n,q)=>n+Number(q.amount||0),0);
 const amount=Number(p.amount||0);
 const paidThrough=paidBefore+amount;
 const balanceBefore=Math.max(0,Number(x.total||0)-paidBefore);
 const remaining=Math.max(0,Number(x.total||0)-paidThrough);
 const pat=(typeof patient20==='function'?patient20(x.patientId,x.patient):null);
 const no=(window.NMReceiptNumberConfigured?window.NMReceiptNumberConfigured(p,x):receiptNo32(p));
 const logo=(typeof NUTRIMACHATA_REPORT_LOGO!=='undefined'?NUTRIMACHATA_REPORT_LOGO:'');
 const node=document.createElement('div');node.style.cssText='position:fixed;left:-10000px;top:0';
 node.innerHTML=`<div style="width:720px;padding:40px;font-family:Arial,sans-serif;color:#243126;background:white">
 <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #5E8C2A;padding-bottom:16px">${logo?`<img src="${logo}" style="width:110px;height:auto;max-height:42px;object-fit:contain;object-position:left center">`:'<b style="font-size:24px;color:#355e20">NutriMachata</b>'}<div style="text-align:right"><div style="font-size:23px;font-weight:800">RECIBO DE PAGO</div><div style="font-weight:700;color:#5E8C2A">${esc32(no)}</div></div></div>
 <div style="margin:22px 0;display:grid;grid-template-columns:1fr 1fr;gap:18px"><div><small>CLIENTE / PACIENTE</small><br><b style="font-size:17px">${esc32(x.patient)}</b><br><span>${esc32(x.rnc||pat?.cedula||'')}</span></div><div><small>FACTURA RELACIONADA</small><br><b>${esc32(x.number||'—')}</b><br><small>FECHA / HORA</small><br><b>${esc32(dateTime32(p))}</b></div></div>
 <div style="background:#f3f7ef;border-radius:14px;padding:22px;margin:18px 0"><small>MONTO RECIBIDO</small><div style="font-size:32px;font-weight:800;color:#355e20;margin-top:5px">${moneyRD(amount)}</div></div>
 <table style="width:100%;border-collapse:collapse"><tr><td style="padding:10px;border-bottom:1px solid #e5e9e2">Total de la factura</td><td style="text-align:right;border-bottom:1px solid #e5e9e2"><b>${moneyRD(x.total)}</b></td></tr><tr><td style="padding:10px;border-bottom:1px solid #e5e9e2">Balance anterior</td><td style="text-align:right;border-bottom:1px solid #e5e9e2"><b>${moneyRD(balanceBefore)}</b></td></tr><tr><td style="padding:10px;border-bottom:1px solid #e5e9e2">Monto pagado en este recibo</td><td style="text-align:right;border-bottom:1px solid #e5e9e2"><b>${moneyRD(amount)}</b></td></tr><tr><td style="padding:10px;border-bottom:1px solid #e5e9e2">Pagado acumulado</td><td style="text-align:right;border-bottom:1px solid #e5e9e2"><b>${moneyRD(paidThrough)}</b></td></tr><tr><td style="padding:12px 10px;font-size:17px">Balance restante</td><td style="text-align:right;font-size:19px;color:${remaining>0?'#b76812':'#355e20'}"><b>${moneyRD(remaining)}</b></td></tr></table>
 <div style="margin-top:22px;padding:14px 16px;border:1px solid #e5e9e2;border-radius:12px;display:grid;grid-template-columns:1fr 1fr;gap:14px"><div><small>MÉTODO DE PAGO</small><br><b>${esc32(p.method||'Otro')}</b></div><div><small>REFERENCIA</small><br><b>${esc32(p.reference||'—')}</b></div></div>
 <div style="margin-top:28px;color:#6d786b;font-size:11px;border-top:1px solid #e5e9e2;padding-top:14px">Comprobante de pago generado por NutriMachata · ${esc32(no)}</div></div>`;
 document.body.appendChild(node);
 html2pdf().set({margin:[8,8,8,8],filename:`${no}_${String(x.number||'Factura').replace(/[^a-zA-Z0-9_-]/g,'_')}.pdf`,image:{type:'jpeg',quality:.98},html2canvas:{scale:2,useCORS:true,backgroundColor:'#fff'},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}}).from(node.firstElementChild).save().finally(()=>node.remove());
};
// Add receipt number to the visible Payments table whenever it is rendered.
const obs=new MutationObserver(()=>{
 const el=document.getElementById('billing-tab-content'); if(!el)return;
 const table=el.querySelector('table'); if(!table||!table.textContent.includes('Referencia')||!table.textContent.includes('Recibo'))return;
 const head=table.querySelector('thead tr'); if(!head||head.querySelector('[data-rec32]'))return;
 const th=document.createElement('th');th.dataset.rec32='1';th.textContent='N.º recibo';head.insertBefore(th,head.children[1]||null);
 const b=getBillingData(); const pays=(b.invoices||[]).flatMap(x=>(x.paymentHistory||[]).map(p=>({...p,invoiceId:x.id}))).sort((a,z)=>String(z.date||'').localeCompare(String(a.date||'')));
 [...table.querySelectorAll('tbody tr')].forEach((tr,i)=>{const td=document.createElement('td');td.dataset.rec32='1';td.innerHTML=`<b>${esc32(window.NMReceiptNumberConfigured?window.NMReceiptNumberConfigured(pays[i]||{}):receiptNo32(pays[i]||{}))}</b>`;tr.insertBefore(td,tr.children[1]||null)});
});
obs.observe(document.documentElement,{subtree:true,childList:true});
})();
