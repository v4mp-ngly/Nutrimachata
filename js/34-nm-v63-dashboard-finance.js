(function(){
'use strict';
const M63=v=>typeof moneyRD==='function'?moneyRD(Number(v||0)):'RD$ '+Number(v||0).toLocaleString('es-DO',{minimumFractionDigits:2,maximumFractionDigits:2});
const E63=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const month63=()=>new Date().toISOString().slice(0,7);
window.NMFinanceMonthV63=month63();
function api63(){return window.NMBillingClientAPI?.billingFetch}
function sum63(a,k){return (a||[]).reduce((s,x)=>s+Number(x?.[k]||0),0)}
async function finance63(ym){
 const f=api63(); if(!f) throw new Error('Supabase todavía no está disponible');
 const start=ym+'-01', d=new Date(Number(ym.slice(0,4)),Number(ym.slice(5,7)),1), end=d.toISOString().slice(0,10);
 const [inv,pay,exp,clo]=await Promise.all([
  f(`facturas?select=id,fecha,total,total_pagado,saldo,estado&fecha=gte.${start}&fecha=lt.${end}`),
  f(`pagos?select=id,fecha_pago,monto,monto_recibido,monto_aplicado,saldo_favor_usado,factura_id&fecha_pago=gte.${start}&fecha_pago=lt.${end}`),
  f(`gastos?select=id,fecha,monto,estado&fecha=gte.${start}&fecha=lt.${end}`),
  f(`cierres_caja?select=*&fecha=gte.${start}&fecha=lt.${end}&order=fecha.asc`)
 ]);
 const validInv=(inv||[]).filter(x=>String(x.estado||'').toLowerCase()!=='anulada');
 const validExp=(exp||[]).filter(x=>String(x.estado||'').toLowerCase()!=='anulado');
 const closed=(clo||[]).filter(x=>String(x.estado||'').toLowerCase()==='cerrado');
 const facturado=sum63(validInv,'total'), cobrado=(pay||[]).reduce((s,x)=>s+Math.max(0,Number(x.monto_recibido??x.monto??0)),0), gastos=sum63(validExp,'monto');
 const pending=validInv.reduce((s,x)=>s+Math.max(0,Number(x.saldo??(Number(x.total||0)-Number(x.total_pagado||0)))),0);
 const closedNeto=sum63(closed,'neto'); // Solo informativo; nunca se usa como total del período.
 const closedDates=new Set(closed.map(x=>x.fecha));
 const activityDates=new Set([...(pay||[]).map(x=>String(x.fecha_pago||'').slice(0,10)),...validExp.map(x=>String(x.fecha||'').slice(0,10))].filter(Boolean));
 const pendingDates=[...activityDates].filter(x=>!closedDates.has(x) && x<=new Date().toISOString().slice(0,10));
 return {ym,start,end,inv:validInv,pay:pay||[],exp:validExp,clo:clo||[],closed,facturado,cobrado,pending,gastos,neto:cobrado-gastos,closedNeto,pendingDates};
}
window.NMFinanceSummaryV63=finance63;

async function hydrateDashboard63(){
 if(window.currentPage!=='dashboard' && (typeof currentPage!=='undefined'&&currentPage!=='dashboard')) return;
 const host=document.querySelector('.nm-dashboard'); if(!host)return;
 let box=document.getElementById('nm63-dashboard-finance');
 if(!box){box=document.createElement('section');box.id='nm63-dashboard-finance';box.className='nm63-finance nm63-loading';const welcome=host.querySelector('.nm-welcome');welcome?.insertAdjacentElement('afterend',box)}
 box.innerHTML='<div class="nm63-finance-head"><div><h3>Resumen financiero · '+E63(window.NMFinanceMonthV63)+'</h3><p>Cargando datos actuales desde Supabase…</p></div></div>';
 try{const x=await finance63(window.NMFinanceMonthV63);if(!document.getElementById('nm63-dashboard-finance'))return;box.classList.remove('nm63-loading');box.innerHTML=`<div class="nm63-finance-head"><div><h3>Resumen financiero del mes</h3><p>Facturación, cobros, gastos y cierres conectados a Supabase</p></div><button class="nm63-close-alert ${x.pendingDates.length?'':'ok'}" type="button" onclick="navigate('billing');setTimeout(()=>renderCashCloseV54&&renderCashCloseV54(),150)">${x.pendingDates.length?`⚠ ${x.pendingDates.length} cierre(s) pendiente(s)`:'✓ Cierres al día'}</button></div><div class="nm63-finance-grid"><div class="nm63-finance-card"><small>FACTURADO</small><b>${M63(x.facturado)}</b></div><div class="nm63-finance-card"><small>COBRADO</small><b>${M63(x.cobrado)}</b></div><div class="nm63-finance-card warn"><small>PENDIENTE</small><b>${M63(x.pending)}</b></div><div class="nm63-finance-card"><small>GASTOS</small><b>${M63(x.gastos)}</b></div><div class="nm63-finance-card net"><small>NETO</small><b>${M63(x.neto)}</b></div></div>`}catch(e){box.classList.remove('nm63-loading');box.innerHTML='<div class="nm63-finance-head"><div><h3>Resumen financiero</h3><p>No se pudo consultar Supabase: '+E63(e.message)+'</p></div><button class="btn btn-outline btn-sm" onclick="NMRefreshDashboardFinanceV63()">Reintentar</button></div>'}
}
window.NMRefreshDashboardFinanceV63=hydrateDashboard63;

const oldDash=window.renderDashboard;
if(typeof oldDash==='function') window.renderDashboard=function(){const r=oldDash.apply(this,arguments);setTimeout(hydrateDashboard63,60);return r};

const oldBilling=window.renderBilling;
if(typeof oldBilling==='function') window.renderBilling=function(){const r=oldBilling.apply(this,arguments);setTimeout(()=>enhanceBilling63(window.NMFinanceMonthV63),50);return r};
window.enhanceBilling63=async function(ym){window.NMFinanceMonthV63=ym||month63();const pc=document.getElementById('page-content');if(!pc)return;const hero=pc.querySelector('.billing-hero');if(hero){hero.querySelector('.billing-title')&&(hero.querySelector('.billing-title').textContent='Centro financiero');hero.querySelector('.billing-sub')&&(hero.querySelector('.billing-sub').textContent='Facturas, cobros, gastos, cierres de caja y reportes conectados en un solo lugar.');let period=document.getElementById('nm63-period');if(!period){period=document.createElement('div');period.id='nm63-period';period.className='nm63-billing-period';period.innerHTML=`<div><label>Período financiero</label><input class="form-control" type="month" value="${E63(window.NMFinanceMonthV63)}" onchange="enhanceBilling63(this.value)"></div>`;hero.appendChild(period)}}
 let flow=document.getElementById('nm63-flow');if(!flow){flow=document.createElement('div');flow.id='nm63-flow';flow.className='nm63-flow nm63-loading';const k=pc.querySelector('.bill-kpis');k?.insertAdjacentElement('beforebegin',flow)}if(!flow)return;flow.innerHTML='<div class="nm63-flow-card"><small>CARGANDO SUPABASE…</small><b>—</b></div>';
 try{const x=await finance63(window.NMFinanceMonthV63);flow.classList.remove('nm63-loading');flow.innerHTML=`<div class="nm63-flow-card"><small>FACTURADO</small><b>${M63(x.facturado)}</b></div><div class="nm63-flow-card"><small>COBRADO</small><b>${M63(x.cobrado)}</b></div><div class="nm63-flow-card pending"><small>PENDIENTE</small><b>${M63(x.pending)}</b></div><div class="nm63-flow-card expense"><small>GASTOS</small><b>${M63(x.gastos)}</b></div><div class="nm63-flow-card"><small>NETO</small><b>${M63(x.neto)}</b></div>`;let note=document.getElementById('nm63-finance-note');if(!note){note=document.createElement('div');note.id='nm63-finance-note';note.className='nm63-finance-note';flow.insertAdjacentElement('afterend',note)}note.innerHTML=`${x.closed.length} cierre(s) guardado(s) en el período · Neto consolidado de cierres: <b>${M63(x.closedNeto)}</b>${x.pendingDates.length?` · <span style="color:#9a620b"><b>${x.pendingDates.length}</b> fecha(s) con movimientos pendientes de cierre</span>`:' · <span style="color:#355e20">Cierres al día</span>'}`;}catch(e){flow.classList.remove('nm63-loading');flow.innerHTML='<div class="nm63-flow-card"><small>CONEXIÓN</small><b style="font-size:13px;color:#a33">'+E63(e.message)+'</b></div>'}
};

// Refresca el resumen al volver a la pestaña, sin polling ni MutationObserver.
window.addEventListener('focus',()=>{if(typeof currentPage!=='undefined'&&currentPage==='dashboard')hydrateDashboard63();if(typeof currentPage!=='undefined'&&currentPage==='billing')enhanceBilling63(window.NMFinanceMonthV63)});
window.NMV63Ready=true;
})();
