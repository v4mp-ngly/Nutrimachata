(function(){
'use strict';
const esc54=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money54=v=>typeof moneyRD==='function'?moneyRD(Number(v||0)):'RD$ '+Number(v||0).toLocaleString('es-DO',{minimumFractionDigits:2,maximumFractionDigits:2});
const today54=()=>new Date().toISOString().slice(0,10);
function ensureAllBillingTabs54(){
 const tabs=document.querySelector('.bill-tabs'); if(!tabs)return;
 const wanted=[['balances','Saldos a favor'],['debts93','Deudas'],['invoices','Facturas'],['receivables','Cuentas por cobrar'],['payments','Pagos'],['inventory','Productos y servicios'],['templates','Plantilla'],['financial','Reportes'],['quotes','Cotizaciones'],['expenses','Gastos'],['cashclose','Cierre de caja'],['exports','Exportación'],['numbering','Configuración']];
 wanted.forEach(([k,label])=>{
   let b=tabs.querySelector(`[data-btab="${k}"]`);
   if(!b){b=document.createElement('button');b.className='bill-tab';b.type='button';b.dataset.btab=k;b.textContent=label;tabs.appendChild(b)}
   b.onclick=()=>window.renderBillingTab(k,b);
 });
 // Reordenar sin recrear botones ni observers.
 wanted.forEach(([k])=>{const b=tabs.querySelector(`[data-btab="${k}"]`);if(b)tabs.appendChild(b)});
 const quick=document.querySelector('.bill-quick');
 if(quick&&!quick.querySelector('[data-cashclose54]')){const a=document.createElement('a');a.dataset.cashclose54='1';a.innerHTML='<span>Cierre de caja</span><b>›</b>';a.onclick=()=>window.renderBillingTab('cashclose');quick.appendChild(a)}
}
async function getExpenses54(date){
 try{const f=window.NMBillingClientAPI?.billingFetch;if(!f)return [];return await f(`gastos?select=*&fecha=eq.${encodeURIComponent(date)}&estado=neq.anulado&order=created_at.asc`)||[]}catch(e){console.warn('[Cierre caja] gastos',e);return []}
}
async function paymentsForDate54(date){
 const f=window.NMBillingClientAPI?.billingFetch;
 if(!f)return [];
 try{
   const start=new Date(date+'T00:00:00-04:00');
   const end=new Date(start.getTime()+86400000);
   const rows=await f(`pagos?select=*&fecha_pago=gte.${encodeURIComponent(start.toISOString())}&fecha_pago=lt.${encodeURIComponent(end.toISOString())}&order=fecha_pago.asc`)||[];
   const b=typeof getBillingData==='function'?getBillingData():{invoices:[]};
   const invMap=new Map((b.invoices||[]).map(i=>[String(i.id),i]));
   return rows.map(r=>{
     const inv=invMap.get(String(r.factura_id))||{};
     return {p:{id:r.id,date:String(r.fecha_pago||'').slice(0,10),datetime:r.fecha_pago||'',amount:Number(r.monto||0),method:typeof mapMethodFromDb==='function'?mapMethodFromDb(r.metodo_pago):(r.metodo_pago||'Otro'),reference:r.referencia||''},inv};
   });
 }catch(e){console.error('[Cierre caja] pagos Supabase',e);return []}
}
window.renderCashCloseV54=async function(date=today54()){
 ensureAllBillingTabs54();
 document.querySelectorAll('[data-btab]').forEach(b=>b.classList.toggle('active',b.dataset.btab==='cashclose'));
 const el=document.getElementById('billing-tab-content');if(!el)return;
 el.innerHTML='<div class="card"><div class="card-body" style="padding:28px;text-align:center">Calculando cierre de caja...</div></div>';
 const [pays,expenses]=await Promise.all([paymentsForDate54(date),getExpenses54(date)]);
 const income=pays.reduce((n,x)=>n+Number(x.p.amount||0),0), out=expenses.reduce((n,x)=>n+Number(x.monto||x.amount||0),0), net=income-out;
 const methods={};pays.forEach(x=>{const m=x.p.method||'Otro';methods[m]=(methods[m]||0)+Number(x.p.amount||0)});
 let previous=null;
 try{
   const f=window.NMBillingClientAPI?.billingFetch;
   if(f){const rows=await f(`cierres_caja?select=*&fecha=eq.${encodeURIComponent(date)}&estado=eq.cerrado&order=fecha_cierre.desc&limit=1`)||[];previous=rows[0]||null}
 }catch(e){console.warn('[Cierre caja] cierre previo',e)}
 el.innerHTML=`<div class="card"><div class="card-header"><div><div class="card-title">Cierre de caja</div><div class="card-subtitle">Resumen diario de cobros y gastos registrados.</div></div><div style="display:flex;gap:8px"><input id="cash54-date" class="form-control" type="date" value="${esc54(date)}" onchange="renderCashCloseV54(this.value)"><button class="btn btn-outline" onclick="printCashCloseV54()">Imprimir</button><button class="btn btn-olive" onclick="saveCashCloseV54()">Cerrar caja</button></div></div><div class="card-body">
 <div class="bill-stats" style="margin-bottom:18px"><div class="card" style="padding:16px"><small>COBROS DEL DÍA</small><h3>${money54(income)}</h3></div><div class="card" style="padding:16px"><small>GASTOS DEL DÍA</small><h3>${money54(out)}</h3></div><div class="card" style="padding:16px"><small>NETO DE CAJA</small><h3>${money54(net)}</h3></div><div class="card" style="padding:16px"><small>TRANSACCIONES</small><h3>${pays.length}</h3></div></div>
 ${previous?`<div style="padding:10px 12px;border:1px solid #d5e5cc;background:#f5faf2;border-radius:10px;margin-bottom:14px">✓ Este día tiene un cierre guardado en Supabase: <b>${esc54(previous.fecha_cierre?new Date(previous.fecha_cierre).toLocaleString('es-DO'):'Registrado')}</b></div>`:''}
 <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,.55fr);gap:16px"><div class="card"><div class="card-header"><div class="card-title">Cobros</div></div><div class="card-body">${pays.length?`<div class="table-responsive"><table class="table"><thead><tr><th>Factura</th><th>Paciente / cliente</th><th>Método</th><th>Referencia</th><th>Monto</th></tr></thead><tbody>${pays.map(x=>`<tr><td><b>${esc54(x.inv.number||x.inv.numero||'—')}</b></td><td>${esc54(x.inv.patient||x.inv.paciente_nombre||x.inv.cliente_nombre||'—')}</td><td>${esc54(x.p.method||'Otro')}</td><td>${esc54(x.p.reference||'—')}</td><td><b>${money54(x.p.amount)}</b></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state"><div class="empty-text">No hay cobros registrados en esta fecha.</div></div>'}</div></div><div><div class="card" style="margin-bottom:16px"><div class="card-header"><div class="card-title">Por método de pago</div></div><div class="card-body">${Object.keys(methods).length?Object.entries(methods).map(([m,v])=>`<div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #edf0eb"><span>${esc54(m)}</span><b>${money54(v)}</b></div>`).join(''):'Sin cobros.'}</div></div><div class="card"><div class="card-header"><div class="card-title">Gastos</div></div><div class="card-body">${expenses.length?expenses.map(g=>`<div style="display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid #edf0eb"><span>${esc54(g.descripcion||g.concepto||g.categoria||'Gasto')}</span><b>${money54(g.monto||g.amount)}</b></div>`).join(''):'Sin gastos registrados.'}</div></div></div></div>
 </div></div>`;
 window.NMCashCloseCurrent54={date,income,out,net,count:pays.length,methods,closedAt:new Date().toLocaleString('es-DO')};
};
window.saveCashCloseV54=async function(){
 const x=window.NMCashCloseCurrent54;if(!x)return;
 const f=window.NMBillingClientAPI?.billingFetch;if(!f)return notify?.('No hay conexión con Supabase.','danger');
 try{
   const b=typeof getBillingData==='function'?getBillingData():{invoices:[]};
   const dayInv=(b.invoices||[]).filter(i=>String(i.date||'').slice(0,10)===x.date);
   const totalFacturado=dayInv.reduce((n,i)=>n+Number(i.total||0),0);
   const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
   const by=(name)=>Object.entries(x.methods||{}).reduce((n,[k,v])=>norm(k).includes(name)?n+Number(v||0):n,0);
   const efectivo=by('efectivo'), tarjeta=by('tarjeta'), transferencia=by('transfer'), cheque=by('cheque');
   const otros=Math.max(0,Number(x.income||0)-efectivo-tarjeta-transferencia-cheque);
   const expenses=await getExpenses54(x.date);
   const payload={fecha:x.date,fecha_cierre:new Date().toISOString(),total_facturado:totalFacturado,total_cobrado:Number(x.income||0),total_gastos:Number(x.out||0),efectivo,tarjeta,transferencia,cheque,otros,efectivo_esperado:efectivo,efectivo_contado:efectivo,diferencia:0,neto:Number(x.net||0),cantidad_facturas:dayInv.length,cantidad_pagos:Number(x.count||0),cantidad_gastos:expenses.length,estado:'cerrado'};
   const old=await f(`cierres_caja?select=id&fecha=eq.${encodeURIComponent(x.date)}&estado=eq.cerrado&limit=1`)||[];
   if(old[0]?.id)await f(`cierres_caja?id=eq.${encodeURIComponent(old[0].id)}`,'PATCH',payload);else await f('cierres_caja','POST',payload);
   notify?.('Cierre de caja guardado en Supabase.','success');
   await renderCashCloseV54(x.date);
 }catch(e){console.error('[Cierre caja] guardar',e);notify?.('No se pudo guardar el cierre de caja: '+(e.message||'Error'),'danger')}
};
window.printCashCloseV54=function(){const el=document.getElementById('billing-tab-content');if(!el)return;const w=window.open('','_blank');if(!w)return notify?.('Permite ventanas emergentes para imprimir.','warning');w.document.write(`<html><head><title>Cierre de caja</title><link rel="stylesheet" href="css/30-styles.css"></head><body><h2>NutriMachata · Cierre de caja</h2>${el.innerHTML}</body></html>`);w.document.close();setTimeout(()=>{w.focus();w.print()},250)};
const prevTab54=window.renderBillingTab;
window.renderBillingTab=function(tab,btn){
 // Mantener la pestaña seleccionada durante cualquier re-render/sincronización de Facturación.
 // v54 enrutaba Gastos/Cotizaciones directamente y saltaba el estado persistente de v29,
 // por eso la pestaña aparecía y volvía inmediatamente a Facturas al terminar Supabase.
 try{window.NMBillingTabStateV29?.set(tab||'invoices')}catch(e){}
 if(tab==='cashclose')return window.renderCashCloseV54();
 if(tab==='quotes'&&typeof window.renderQuotes==='function')return window.renderQuotes();
 if(tab==='expenses'&&typeof window.renderExpenses==='function')return window.renderExpenses();
 if(tab==='exports'&&typeof window.renderExportsV34==='function')return window.renderExportsV34();
 if(tab==='numbering'&&typeof window.renderNumberingV34==='function')return window.renderNumberingV34();
 if(tab==='receivables'&&typeof window.renderReceivablesV33==='function')return window.renderReceivablesV33();
 return prevTab54?prevTab54.apply(this,arguments):undefined;
};
const prevBilling54=window.renderBilling;
window.renderBilling=function(){const r=prevBilling54?prevBilling54.apply(this,arguments):undefined;setTimeout(ensureAllBillingTabs54,0);return r};
window.NMEnsureBillingTabsV54=ensureAllBillingTabs54;
window.NMEnsureBillingTabsV55=ensureAllBillingTabs54;
window.NMExpensesPersistentV56=true;
setTimeout(ensureAllBillingTabs54,0);
})();
