(function(){
'use strict';
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const M=v=>typeof moneyRD==='function'?moneyRD(Number(v||0)):'RD$ '+Number(v||0).toLocaleString('es-DO',{minimumFractionDigits:2,maximumFractionDigits:2});
const api=()=>window.NMBillingClientAPI?.billingFetch;
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santo_Domingo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const monthStart=()=>today().slice(0,7)+'-01';
function rdDate(raw){if(!raw)return '';const s=String(raw);if(/^\d{4}-\d{2}-\d{2}$/.test(s.slice(0,10))&&!/[T ]/.test(s))return s.slice(0,10);const d=new Date(raw);if(!Number.isNaN(d.getTime()))return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santo_Domingo',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);return s.slice(0,10)}
function inRange(d,a,b){return d&&d>=a&&d<=b}
function method(m){return typeof mapMethodFromDb==='function'?mapMethodFromDb(m):(m||'Otro')}
async function rangeData(from,to){
 const f=api();if(!f)throw new Error('No hay conexión con Supabase.');
 const rs=await Promise.allSettled([f('pagos?select=*&order=fecha_pago.asc'),f('facturas?select=*&order=fecha.asc,created_at.asc'),f('gastos?select=*&order=fecha.asc,created_at.asc')]);
 if(rs[0].status==='rejected')throw rs[0].reason;if(rs[1].status==='rejected')throw rs[1].reason;
 const paysAll=rs[0].value||[], invAll=rs[1].value||[], expAll=rs[2].status==='fulfilled'?(rs[2].value||[]):[];
 const invMap=new Map(invAll.map(x=>[String(x.id),x]));
 // Caja contabiliza solamente dinero real recibido dentro del período.
 // Los pagos aplicados desde un saldo a favor reducen la deuda, pero no son una entrada nueva de caja.
 // Un sobrepago sí entra completo a caja y su excedente queda registrado como saldo a favor.
 const seenPayments=new Set();
 const orderedPays=[...paysAll].sort((a,b)=>String(a.fecha_pago||a.created_at||'').localeCompare(String(b.fecha_pago||b.created_at||'')));
 const reconciled=orderedPays.map(p=>{
   const pid=String(p.id||`${p.factura_id||''}:${p.fecha_pago||p.created_at||''}:${p.monto_recibido??p.monto??0}`);
   if(seenPayments.has(pid))return null;seenPayments.add(pid);
   const inv=invMap.get(String(p.factura_id))||{};
   const amount=Math.max(0,Number(p.monto_recibido??p.monto??0));
   return {raw:p,inv,amount,rawAmount:amount,applied:Math.max(0,Number(p.monto_aplicado??p.monto??0)),creditGenerated:Math.max(0,Number(p.saldo_favor_generado||0)),creditUsed:Math.max(0,Number(p.saldo_favor_usado||0)),method:method(p.metodo_pago),date:rdDate(p.fecha_pago||p.created_at)};
 }).filter(Boolean);
 const pays=reconciled.filter(p=>p.amount>.009&&inRange(p.date,from,to));
 const excludedInRange=[];
 // La facturación usa la MISMA fuente normalizada que el panel de Facturación.
 // Así evitamos sumar filas crudas/duplicadas de Supabase que no aparecen en el total oficial de la interfaz.
 const billing=typeof getBillingData==='function'?getBillingData():null;
 const normalizedInvoices=(billing?.invoices||[]);
 const invoices=normalizedInvoices.length
   ? normalizedInvoices.filter(x=>inRange(String(x.date||'').slice(0,10),from,to))
   : invAll.filter(x=>inRange(String(x.fecha||x.created_at||'').slice(0,10),from,to)&&!['archivada','anulada','cancelada'].includes(norm(x.estado)));
 const expenses=expAll.filter(g=>inRange(String(g.fecha||g.created_at||'').slice(0,10),from,to)&&!['anulado','anulada','cancelado','cancelada'].includes(norm(g.estado)));
 const methods={};pays.forEach(p=>methods[p.method]=(methods[p.method]||0)+p.amount);
 const billed=invoices.reduce((n,x)=>n+Number(x.total||0),0),income=pays.reduce((n,x)=>n+x.amount,0),out=expenses.reduce((n,x)=>n+Number(x.monto||0),0);
 const pending=invoices.reduce((n,x)=>n+Math.max(0,Number(x.total||0)-Number(x.paid??x.total_pagado??0)),0);
 return {from,to,pays,invoices,expenses,methods,billed,income,pending,out,net:income-out,excludedInRange,excludedAmount:0};
}
function expected(methods){return Object.entries(methods||{}).reduce((n,[k,v])=>norm(k).includes('efectivo')?n+Number(v||0):n,0)}
function updateDiff(){const x=window.NMCashCloseCurrent54;if(!x)return;const counted=Number(document.getElementById('cash73-counted')?.value||0),d=counted-Number(x.expectedCash||0),el=document.getElementById('cash73-diff');x.countedCash=counted;x.difference=d;if(el){el.textContent=M(d);el.className='nm70-difference '+(Math.abs(d)<.01?'ok':'warn')}}
window.NMUpdateCashDifferenceV73=updateDiff;
window.renderCashCloseV54=async function(from=monthStart(),to=today()){
 if(from&&typeof from==='object')from=monthStart();from=from||monthStart();to=to||today();if(from>today())from=today();if(to>today())to=today();if(from>to){const z=from;from=to;to=z}
 const el=document.getElementById('billing-tab-content');if(!el)return;try{window.NMBillingTabStateV29?.set('cashclose')}catch(_){}document.querySelectorAll('[data-btab]').forEach(b=>b.classList.toggle('active',b.dataset.btab==='cashclose'));
 el.innerHTML='<div class="card"><div class="card-body" style="padding:30px;text-align:center">Calculando pagos del período desde Supabase...</div></div>';
 try{const x=await rangeData(from,to),exp=expected(x.methods);window.NMCashCloseCurrent54={...x,date:to,count:x.pays.length,expectedCash:exp,countedCash:exp,difference:0,previousId:''};
 const payRows=x.pays.map(p=>`<tr><td>${E(p.date)}</td><td><b>${E(p.inv.numero_factura||p.inv.numero||'—')}</b></td><td>${E(p.inv.paciente_nombre||p.inv.cliente_nombre||'—')}</td><td>${E(p.method)}</td><td>${E(p.raw.referencia||'—')}</td><td style="text-align:right"><b>${M(p.amount)}</b></td></tr>`).join('');
 const methods=Object.entries(x.methods).map(([k,v])=>`<div class="nm70-close-row"><span>${E(k)}</span><b>${M(v)}</b></div>`).join('')||'<div class="text-muted">Sin cobros registrados.</div>';
 const expenses=x.expenses.map(g=>`<div class="nm70-close-row"><span>${E(String(g.fecha||'').slice(0,10))} · ${E(g.concepto||g.categoria||'Gasto')}</span><b>${M(g.monto)}</b></div>`).join('')||'<div class="text-muted">Sin gastos registrados.</div>';
 el.innerHTML=`<div class="card"><div class="card-header"><div><div class="card-title">Cierre de caja por período</div><div class="card-subtitle">Selecciona desde qué fecha hasta qué fecha. Se incluyen todos los pagos realizados dentro del rango, ambas fechas incluidas.</div></div><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end"><label style="font-size:11px;font-weight:800">DESDE<input id="cash73-from" class="form-control" type="date" max="${today()}" value="${E(from)}"></label><label style="font-size:11px;font-weight:800">HASTA<input id="cash73-to" class="form-control" type="date" max="${today()}" value="${E(to)}"></label><button class="btn btn-outline" onclick="renderCashCloseV54(document.getElementById('cash73-from').value,document.getElementById('cash73-to').value)">Aplicar filtro</button><button class="btn btn-outline" onclick="printCashCloseV54()">Descargar PDF</button><button id="cash73-save" class="btn btn-olive" onclick="saveCashCloseV54()">Cerrar período</button></div></div><div class="card-body"><div style="padding:10px 12px;border:1px solid #d5e5cc;background:#f5faf2;border-radius:10px;margin-bottom:14px">Período seleccionado: <b>${E(from)}</b> hasta <b>${E(to)}</b> · ${x.pays.length} pago(s) recibido(s).</div>${x.excludedAmount>0?`<div style="padding:10px 12px;border:1px solid #efcf9d;background:#fff8eb;color:#815516;border-radius:10px;margin-bottom:14px"><b>Conciliación automática:</b> se excluyeron ${M(x.excludedAmount)} en pagos repetidos o excedentes que sobrepasaban el total de sus facturas. Estos montos no se suman al cierre.</div>`:''}<div class="nm70-close-grid"><div class="nm70-close-kpi"><small>FACTURADO</small><b>${M(x.billed)}</b></div><div class="nm70-close-kpi"><small>COBRADO</small><b>${M(x.income)}</b></div><div class="nm70-close-kpi"><small>GASTOS</small><b>${M(x.out)}</b></div><div class="nm70-close-kpi"><small>NETO DE CAJA</small><b>${M(x.net)}</b></div><div class="nm70-close-kpi"><small>TRANSACCIONES</small><b>${x.pays.length}</b></div></div><div class="nm70-close-layout"><div class="nm70-close-box"><div class="card-title" style="margin-bottom:10px">Pagos del período</div>${payRows?`<div class="table-responsive"><table class="table"><thead><tr><th>Fecha pago</th><th>Factura</th><th>Paciente / cliente</th><th>Método</th><th>Referencia</th><th style="text-align:right">Monto</th></tr></thead><tbody>${payRows}</tbody></table></div>`:'<div class="empty-state"><div class="empty-text">No hay pagos registrados entre estas fechas.</div></div>'}</div><div><div class="nm70-close-box"><div class="card-title" style="margin-bottom:8px">Por método de pago</div>${methods}<div class="nm70-count"><label for="cash73-counted" style="font-size:11px;font-weight:800">Efectivo contado</label><input id="cash73-counted" class="form-control" type="number" min="0" step="0.01" value="${exp.toFixed(2)}" oninput="NMUpdateCashDifferenceV73()"><div class="nm70-close-row"><span>Efectivo esperado</span><b>${M(exp)}</b></div><div class="nm70-close-row"><span>Diferencia</span><b id="cash73-diff" class="nm70-difference ok">${M(0)}</b></div></div></div><div class="nm70-close-box" style="margin-top:14px"><div class="card-title" style="margin-bottom:8px">Gastos del período</div>${expenses}</div></div></div></div></div>`;
 }catch(e){console.error('[Cierre caja v73]',e);el.innerHTML=`<div class="card"><div class="card-body"><div class="empty-title">No se pudo calcular el cierre</div><div class="empty-text">${E(e.message||'Error de conexión')}</div></div></div>`}
};
window.saveCashCloseV54=async function(){const x=window.NMCashCloseCurrent54,f=api();if(!x||!f)return notify?.('No se pudo preparar el cierre.','warning');updateDiff();const btn=document.getElementById('cash73-save');if(btn){btn.disabled=true;btn.textContent='Guardando...'}try{const by=n=>Object.entries(x.methods||{}).reduce((s,[k,v])=>norm(k).includes(n)?s+Number(v||0):s,0),efectivo=by('efectivo'),tarjeta=by('tarjeta'),transferencia=by('transfer'),cheque=by('cheque'),otros=Math.max(0,x.income-efectivo-tarjeta-transferencia-cheque);const payload={fecha:x.to,fecha_cierre:new Date().toISOString(),total_facturado:Number(x.billed||0),total_cobrado:Number(x.income||0),total_gastos:Number(x.out||0),efectivo,tarjeta,transferencia,cheque,otros,efectivo_esperado:Number(x.expectedCash||0),efectivo_contado:Number(x.countedCash||0),diferencia:Number(x.difference||0),neto:Number(x.net||0),cantidad_facturas:Number(x.invoices.length||0),cantidad_pagos:Number(x.pays.length||0),cantidad_gastos:Number(x.expenses.length||0),observaciones:`Cierre de período ${x.from} al ${x.to}`,estado:'cerrado'};const existentes=await f(`cierres_caja?select=id&fecha=eq.${encodeURIComponent(x.to)}&limit=1`)||[];if(existentes[0]?.id){await f(`cierres_caja?id=eq.${encodeURIComponent(existentes[0].id)}`,'PATCH',payload)}else{await f('cierres_caja','POST',payload)}notify?.(`Período ${x.from} al ${x.to} cerrado correctamente.`,'success');if(typeof window.NMRefreshDashboardFinanceV63==='function')window.NMRefreshDashboardFinanceV63();await window.renderCashCloseV54(x.from,x.to)}catch(e){console.error(e);notify?.('No se pudo guardar el cierre: '+(e.message||'Error'),'danger');if(btn){btn.disabled=false;btn.textContent='Cerrar período'}}};
window.NMCashCloseRangeV73=true;window.NMCashCloseAccountingV75=true;window.NMCashCloseReconciledV77=true;
})();
