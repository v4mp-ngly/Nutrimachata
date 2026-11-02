(function(){
'use strict';
function esc28(v){return typeof billingEscape==='function'?billingEscape(v):String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));}
function renderPayments28(btn){
  document.querySelectorAll('[data-btab]').forEach(x=>x.classList.toggle('active',x.dataset.btab==='payments'));
  const el=document.getElementById('billing-tab-content'); if(!el)return;
  const b=typeof getBillingData==='function'?getBillingData():{invoices:[]};
  const payments=(b.invoices||[]).flatMap(x=>(x.paymentHistory||[]).map(p=>({...p,invoice:x.number,patient:x.patient,invoiceId:x.id,rnc:x.rnc||''}))).sort((a,z)=>String(z.date||'').localeCompare(String(a.date||'')));
  el.innerHTML=`<div class="card"><div class="card-header"><div><div class="card-title">Pagos registrados</div><div class="card-subtitle">Abonos y pagos completos guardados en Facturación</div></div></div><div class="card-body">${payments.length?`<div class="table-responsive"><table class="table"><thead><tr><th>Fecha</th><th>Factura</th><th>Paciente / Cliente</th><th>Método</th><th>Referencia</th><th>Monto</th><th>Recibo</th></tr></thead><tbody>${payments.map(p=>`<tr><td>${esc28(p.date||'—')}</td><td><b>${esc28(p.invoice||'—')}</b></td><td>${esc28(p.patient||'—')}</td><td><span class="pay-chip">${esc28(p.method||'Otro')}</span></td><td>${esc28(p.reference||'—')}</td><td><b>${typeof moneyRD==='function'?moneyRD(p.amount):p.amount}</b></td><td>${p.id&&typeof window.downloadPaymentReceiptV20==='function'?`<button class="btn btn-outline btn-sm" onclick="downloadPaymentReceiptV20('${p.invoiceId}','${p.id}')">PDF</button>`:'—'}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state"><div class="empty-title">No hay pagos registrados</div><div class="empty-text">Los pagos y abonos aparecerán aquí cuando se registren en una factura.</div></div>'}</div></div>`;
}
const previousTab28=window.renderBillingTab;
window.renderBillingTab=function(tab,btn){
  if(tab==='payments') return renderPayments28(btn);
  return previousTab28.apply(this,arguments);
};
window.NMBillingV28={renderPayments:renderPayments28};
})();
