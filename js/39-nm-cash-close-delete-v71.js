(function(){
'use strict';
const esc71=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
window.deleteCashCloseV71=async function(id,date=''){
 if(!id)return notify?.('No se encontró el cierre seleccionado.','warning');
 const label=date?` del ${date}`:'';
 if(!confirm(`¿Eliminar el cierre de caja${label}?\n\nSolo se borrará el cierre guardado. Las facturas, pagos y gastos originales permanecerán intactos.`))return;
 const api=window.NMBillingClientAPI?.billingFetch;if(!api)return notify?.('No hay conexión con Supabase.','danger');
 try{
  await api(`cierres_caja?id=eq.${encodeURIComponent(id)}`,'DELETE');
  notify?.('Cierre de caja eliminado correctamente.','success');
  const range=window.NMCashReportRangeV62;
  if(document.querySelector('[data-btab="financial"]')?.classList.contains('active')&&typeof window.renderCashReportsV62==='function')await window.renderCashReportsV62(range?.from,range?.to);else if(typeof window.renderCashCloseV54==='function')await window.renderCashCloseV54(date||undefined);
  try{window.NMRefreshDashboardFinanceV63?.()}catch(_){ }
 }catch(e){console.error('[Eliminar cierre de caja]',e);notify?.('No se pudo eliminar el cierre: '+(e.message||'Error'),'danger')}
};
const priorReports71=window.renderCashReportsV62;
if(typeof priorReports71==='function')window.renderCashReportsV62=async function(){
 const result=await priorReports71.apply(this,arguments),box=document.getElementById('billing-tab-content');
 if(!box)return result;
 box.querySelectorAll('button[onclick*="downloadSingleCashClosePDFV62"]').forEach(pdf=>{
  const row=pdf.closest('tr'),m=String(pdf.getAttribute('onclick')||'').match(/downloadSingleCashClosePDFV62\('([^']+)'\)/);if(!row||!m||row.querySelector('[data-delete-close71]'))return;
  const date=row.querySelector('td')?.textContent?.trim()||'';const del=document.createElement('button');del.type='button';del.className='btn btn-outline btn-sm';del.dataset.deleteClose71='1';del.style.cssText='color:#b42318;border-color:#e6b8b3';del.textContent='Eliminar';del.onclick=()=>window.deleteCashCloseV71(m[1],date);pdf.parentElement?.appendChild(del);
 });
 return result;
};
window.NMCashCloseDeleteV71=true;
})();
