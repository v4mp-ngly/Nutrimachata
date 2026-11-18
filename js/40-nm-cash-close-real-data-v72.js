(function(){
'use strict';
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const M=v=>typeof moneyRD==='function'?moneyRD(Number(v||0)):'RD$ '+Number(v||0).toLocaleString('es-DO',{minimumFractionDigits:2,maximumFractionDigits:2});
const api=()=>window.NMBillingClientAPI?.billingFetch;
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santo_Domingo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const monthStart=()=>today().slice(0,7)+'-01';
function doDate(raw){if(!raw)return '';const s=String(raw);if(/^\d{4}-\d{2}-\d{2}$/.test(s.slice(0,10))&&!/[T ]/.test(s))return s.slice(0,10);const d=new Date(raw);if(!Number.isNaN(d.getTime()))return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santo_Domingo',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);return s.slice(0,10)}
function method(m){return typeof mapMethodFromDb==='function'?mapMethodFromDb(m):(m||'Otro')}
async function data(date){
 const f=api();if(!f)throw new Error('No hay conexión con Supabase.');
 /* Consultamos las tablas fuente y filtramos la fecha en RD en el navegador.
    Esto evita que un timestamp UTC o un filtro PostgREST deje el cierre en RD$0.00. */
 const rs=await Promise.allSettled([
   f('pagos?select=*&order=fecha_pago.asc'),
   f('facturas?select=*&order=fecha.asc,created_at.asc'),
   f('gastos?select=*&order=fecha.asc,created_at.asc'),
   f(`cierres_caja?select=*&fecha=eq.${encodeURIComponent(date)}&estado=eq.cerrado&order=fecha_cierre.desc&limit=1`)
 ]);
 const val=i=>rs[i].status==='fulfilled'?(rs[i].value||[]):[];
 if(rs[0].status==='rejected')throw rs[0].reason;
 if(rs[1].status==='rejected')throw rs[1].reason;
 const allPays=val(0),allInv=val(1),allExp=val(2),previous=val(3)[0]||null;
 const invMap=new Map(allInv.map(x=>[String(x.id),x]));
 const pays=allPays.filter(p=>doDate(p.fecha_pago||p.created_at)===date).map(p=>({raw:p,inv:invMap.get(String(p.factura_id))||{},amount:Number(p.monto||0),method:method(p.metodo_pago)}));
 const invoices=allInv.filter(x=>String(x.fecha||'').slice(0,10)===date&&!['archivada','anulada','cancelada'].includes(norm(x.estado)));
 const expenses=allExp.filter(g=>String(g.fecha||'').slice(0,10)===date&&!['anulado','anulada','cancelado','cancelada'].includes(norm(g.estado)));
 const billed=invoices.reduce((n,x)=>n+Number(x.total||0),0),income=pays.reduce((n,x)=>n+x.amount,0),out=expenses.reduce((n,x)=>n+Number(x.monto||0),0),methods={};
 pays.forEach(p=>methods[p.method]=(methods[p.method]||0)+p.amount);
 return {date,billed,income,out,net:income-out,pays,expenses,methods,invoiceCount:invoices.length,previous};
}
function expected(methods){return Object.entries(methods||{}).reduce((n,[k,v])=>norm(k).includes('efectivo')?n+Number(v||0):n,0)}
function diff(){const x=window.NMCashCloseCurrent54;if(!x)return;const counted=Number(document.getElementById('cash72-counted')?.value||0),d=counted-Number(x.expectedCash||0),el=document.getElementById('cash72-diff');x.countedCash=counted;x.difference=d;if(el){el.textContent=M(d);el.className='nm70-difference '+(Math.abs(d)<.01?'ok':'warn')}}
window.NMUpdateCashDifferenceV72=diff;
window.renderCashCloseV54=async function(date=today()){
 const el=document.getElementById('billing-tab-content');if(!el)return;try{window.NMBillingTabStateV29?.set('cashclose')}catch(_){ }document.querySelectorAll('[data-btab]').forEach(b=>b.classList.toggle('active',b.dataset.btab==='cashclose'));
 if(date>today())date=today();el.innerHTML='<div class="card"><div class="card-body" style="padding:30px;text-align:center">Calculando cierre de caja desde Supabase...</div></div>';
 try{const x=await data(date),exp=expected(x.methods),counted=Number(x.previous?.efectivo_contado??exp),difference=counted-exp;window.NMCashCloseCurrent54={...x,count:x.pays.length,expectedCash:exp,countedCash:counted,difference,previousId:x.previous?.id||''};
 const payRows=x.pays.map(p=>`<tr><td><b>${E(p.inv.numero_factura||p.inv.numero||'—')}</b></td><td>${E(p.inv.paciente_nombre||p.inv.cliente_nombre||'—')}</td><td>${E(p.method)}</td><td>${E(p.raw.referencia||'—')}</td><td style="text-align:right"><b>${M(p.amount)}</b></td></tr>`).join('');
 const methods=Object.entries(x.methods).map(([k,v])=>`<div class="nm70-close-row"><span>${E(k)}</span><b>${M(v)}</b></div>`).join('')||'<div class="text-muted">Sin cobros registrados.</div>';
 const expenses=x.expenses.map(g=>`<div class="nm70-close-row"><span>${E(g.concepto||g.categoria||'Gasto')}</span><b>${M(g.monto)}</b></div>`).join('')||'<div class="text-muted">Sin gastos registrados.</div>';
 el.innerHTML=`<div class="card"><div class="card-header"><div><div class="card-title">Cierre de caja</div><div class="card-subtitle">Datos reales de facturas, pagos y gastos registrados en Supabase.</div></div><div style="display:flex;gap:8px;flex-wrap:wrap"><input id="cash54-date" class="form-control" type="date" max="${today()}" value="${E(date)}" onchange="renderCashCloseV54(this.value)"><button class="btn btn-outline" onclick="printCashCloseV54()">Descargar PDF</button>${x.previous?`<button class="btn btn-outline" style="color:#b42318;border-color:#e6b8b3" onclick="deleteCashCloseV71('${E(x.previous.id)}','${E(date)}')">Eliminar cierre</button>`:''}<button id="cash72-save" class="btn btn-olive" onclick="saveCashCloseV54()">${x.previous?'Actualizar cierre':'Cerrar caja'}</button></div></div><div class="card-body">${x.previous?`<div class="nm70-saved">✓ Este cierre ya está guardado. Los importes mostrados se recalculan desde los movimientos reales del día.</div>`:''}<div class="nm70-close-grid"><div class="nm70-close-kpi"><small>FACTURADO</small><b>${M(x.billed)}</b></div><div class="nm70-close-kpi"><small>COBRADO</small><b>${M(x.income)}</b></div><div class="nm70-close-kpi"><small>PENDIENTE</small><b>${M(x.pending)}</b></div><div class="nm70-close-kpi"><small>GASTOS</small><b>${M(x.out)}</b></div><div class="nm70-close-kpi"><small>NETO DE CAJA</small><b>${M(x.net)}</b></div><div class="nm70-close-kpi"><small>TRANSACCIONES</small><b>${x.pays.length}</b></div></div><div class="nm70-close-layout"><div class="nm70-close-box"><div class="card-title" style="margin-bottom:10px">Cobros del día</div>${payRows?`<div class="table-responsive"><table class="table"><thead><tr><th>Factura</th><th>Paciente / cliente</th><th>Método</th><th>Referencia</th><th style="text-align:right">Monto</th></tr></thead><tbody>${payRows}</tbody></table></div>`:'<div class="empty-state"><div class="empty-text">No hay pagos en Supabase para esta fecha.</div></div>'}</div><div><div class="nm70-close-box"><div class="card-title" style="margin-bottom:8px">Por método de pago</div>${methods}<div class="nm70-count"><label for="cash72-counted" style="font-size:11px;font-weight:800">Efectivo contado</label><input id="cash72-counted" class="form-control" type="number" min="0" step="0.01" value="${counted.toFixed(2)}" oninput="NMUpdateCashDifferenceV72()"><div class="nm70-close-row"><span>Efectivo esperado</span><b>${M(exp)}</b></div><div class="nm70-close-row"><span>Diferencia</span><b id="cash72-diff" class="nm70-difference ${Math.abs(difference)<.01?'ok':'warn'}">${M(difference)}</b></div></div></div><div class="nm70-close-box" style="margin-top:14px"><div class="card-title" style="margin-bottom:8px">Gastos del día</div>${expenses}</div></div></div></div></div>`;
 }catch(e){console.error('[Cierre caja v72]',e);el.innerHTML=`<div class="card"><div class="card-body"><div class="empty-title">No se pudo calcular el cierre</div><div class="empty-text">${E(e.message||'Error de conexión')}</div><button class="btn btn-outline mt-3" onclick="renderCashCloseV54('${E(date)}')">Reintentar</button></div></div>`}
};
window.saveCashCloseV54=async function(){const x=window.NMCashCloseCurrent54,f=api();if(!x||!f)return notify?.('No se pudo preparar el cierre.','warning');diff();const btn=document.getElementById('cash72-save');if(btn){btn.disabled=true;btn.textContent='Guardando...'}try{const by=n=>Object.entries(x.methods||{}).reduce((s,[k,v])=>norm(k).includes(n)?s+Number(v||0):s,0),efectivo=by('efectivo'),tarjeta=by('tarjeta'),transferencia=by('transfer'),cheque=by('cheque'),otros=Math.max(0,x.income-efectivo-tarjeta-transferencia-cheque),payload={fecha:x.date,fecha_cierre:new Date().toISOString(),total_facturado:Number(x.billed||0),total_cobrado:Number(x.income||0),total_gastos:Number(x.out||0),efectivo,tarjeta,transferencia,cheque,otros,efectivo_esperado:Number(x.expectedCash||0),efectivo_contado:Number(x.countedCash||0),diferencia:Number(x.difference||0),neto:Number(x.net||0),cantidad_facturas:Number(x.invoiceCount||0),cantidad_pagos:Number(x.pays.length||0),cantidad_gastos:Number(x.expenses.length||0),estado:'cerrado'};if(x.previousId)await f(`cierres_caja?id=eq.${encodeURIComponent(x.previousId)}`,'PATCH',payload);else await f('cierres_caja','POST',payload);notify?.('Cierre de caja guardado con los valores reales.','success');await window.renderCashCloseV54(x.date);if(typeof window.NMRefreshDashboardFinanceV63==='function')window.NMRefreshDashboardFinanceV63()}catch(e){console.error(e);notify?.('No se pudo guardar el cierre: '+(e.message||'Error'),'danger');if(btn){btn.disabled=false;btn.textContent=x.previousId?'Actualizar cierre':'Cerrar caja'}}};
window.NMCashCloseRealDataV72=true;
})();
