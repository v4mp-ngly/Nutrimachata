(function(){
'use strict';
const esc62=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money62=v=>typeof moneyRD==='function'?moneyRD(Number(v||0)):'RD$ '+Number(v||0).toLocaleString('es-DO',{minimumFractionDigits:2,maximumFractionDigits:2});
const api62=()=>window.NMBillingClientAPI?.billingFetch;
const norm62=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const rdDate62=raw=>{if(!raw)return '';const s=String(raw);if(/^\d{4}-\d{2}-\d{2}$/.test(s.slice(0,10))&&!/[T ]/.test(s))return s.slice(0,10);const d=new Date(raw);if(!Number.isNaN(d.getTime()))return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santo_Domingo',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);return s.slice(0,10)};
const inRange62=(d,a,b)=>d&&d>=a&&d<=b;
const dateLabel62=d=>{if(!d)return '—';const x=new Date(String(d).slice(0,10)+'T12:00:00');return Number.isNaN(x.getTime())?String(d):x.toLocaleDateString('es-DO',{day:'2-digit',month:'short',year:'numeric'})};
window.NMCashReportRangeV62=window.NMCashReportRangeV62||{from:new Date().toISOString().slice(0,7)+'-01',to:new Date().toISOString().slice(0,10),rows:[],real:null};

async function fetchClosures62(from,to){const f=api62();if(!f)throw new Error('Supabase no está disponible.');return await f(`cierres_caja?select=*&fecha=gte.${encodeURIComponent(from)}&fecha=lte.${encodeURIComponent(to)}&order=fecha.desc`)||[]}
async function realPeriod62(from,to){
 const f=api62();if(!f)throw new Error('Supabase no está disponible.');
 const [pays,inv,exp]=await Promise.all([
  f('pagos?select=*&order=fecha_pago.asc'),
  f('facturas?select=*&order=fecha.asc,created_at.asc'),
  f('gastos?select=*&order=fecha.asc,created_at.asc').catch(()=>[])
 ]);
 const seen=new Set();
 const realPays=(pays||[]).map(p=>{const key=String(p.id||`${p.factura_id||''}:${p.fecha_pago||p.created_at||''}:${p.monto_recibido??p.monto??0}`);if(seen.has(key))return null;seen.add(key);return {...p,_date:rdDate62(p.fecha_pago||p.created_at),_cash:Math.max(0,Number(p.monto_recibido??p.monto??0))}}).filter(p=>p&&p._cash>.009&&inRange62(p._date,from,to));
 const invoices=(inv||[]).filter(x=>inRange62(String(x.fecha||x.created_at||'').slice(0,10),from,to)&&!['anulada','archivada','cancelada'].includes(norm62(x.estado)));
 const expenses=(exp||[]).filter(x=>inRange62(String(x.fecha||x.created_at||'').slice(0,10),from,to)&&!['anulado','anulada','cancelado','cancelada'].includes(norm62(x.estado)));
 const methods={efectivo:0,tarjeta:0,transferencia:0,cheque:0,otros:0};
 realPays.forEach(p=>{const m=norm62(p.metodo_pago);if(m.includes('efectivo'))methods.efectivo+=p._cash;else if(m.includes('tarjeta'))methods.tarjeta+=p._cash;else if(m.includes('transfer'))methods.transferencia+=p._cash;else if(m.includes('cheque'))methods.cheque+=p._cash;else methods.otros+=p._cash});
 const facturado=invoices.reduce((s,x)=>s+Number(x.total||0),0);
 const cobrado=realPays.reduce((s,x)=>s+x._cash,0);
 const gastos=expenses.reduce((s,x)=>s+Number(x.monto||0),0);
 const pendiente=invoices.reduce((s,x)=>s+Math.max(0,Number(x.saldo??(Number(x.total||0)-Number(x.total_pagado||0)))),0);
 return {facturado,cobrado,gastos,neto:cobrado-gastos,pendiente,methods,pagos:realPays.length,facturas:invoices.length,gastosCount:expenses.length};
}
function totals62(rows){return rows.reduce((a,r)=>{a.facturado+=Number(r.total_facturado||0);a.cobrado+=Number(r.total_cobrado||0);a.gastos+=Number(r.total_gastos||0);a.neto+=Number(r.neto??(Number(r.total_cobrado||0)-Number(r.total_gastos||0)));a.pagos+=Number(r.cantidad_pagos||0);return a},{facturado:0,cobrado:0,gastos:0,neto:0,pagos:0})}
window.renderCashReportsV62=async function(from=window.NMCashReportRangeV62.from,to=window.NMCashReportRangeV62.to){
 const el=document.getElementById('billing-tab-content');if(!el)return;window.NMCashReportRangeV62.from=from;window.NMCashReportRangeV62.to=to;el.innerHTML='<div class="card"><div class="card-body" style="padding:32px;text-align:center">Calculando movimientos reales del período…</div></div>';
 try{const [rows,t]=await Promise.all([fetchClosures62(from,to),realPeriod62(from,to)]);window.NMCashReportRangeV62.rows=rows;window.NMCashReportRangeV62.real=t;
 el.innerHTML=`<div class="card"><div class="card-header"><div><div class="card-title">Reportes de caja</div><div class="card-subtitle">Los totales se calculan directamente desde facturas, pagos y gastos reales del período. Los cierres de abajo son solo historial y no se suman entre sí.</div></div></div><div class="card-body">
 <div class="nm62-toolbar"><div class="form-group" style="margin:0"><label>Desde</label><input id="nm62-from" class="form-control" type="date" value="${esc62(from)}"></div><div class="form-group" style="margin:0"><label>Hasta</label><input id="nm62-to" class="form-control" type="date" value="${esc62(to)}"></div><button class="btn btn-outline" onclick="renderCashReportsV62(document.getElementById('nm62-from').value,document.getElementById('nm62-to').value)">Actualizar</button><button class="btn btn-olive" onclick="downloadCashPeriodPDFV62()">Descargar PDF del período</button></div>
 <div class="nm62-kpis"><div class="nm62-kpi"><small>FACTURADO</small><b>${money62(t.facturado)}</b></div><div class="nm62-kpi"><small>COBRADO REAL</small><b>${money62(t.cobrado)}</b></div><div class="nm62-kpi"><small>PENDIENTE</small><b>${money62(t.pendiente)}</b></div><div class="nm62-kpi"><small>GASTOS</small><b>${money62(t.gastos)}</b></div><div class="nm62-kpi"><small>NETO DE CAJA</small><b>${money62(t.neto)}</b></div></div>
 <div class="nm62-methods"><div><small>Efectivo</small><b>${money62(t.methods.efectivo)}</b></div><div><small>Tarjeta</small><b>${money62(t.methods.tarjeta)}</b></div><div><small>Transferencia</small><b>${money62(t.methods.transferencia)}</b></div><div><small>Cheque</small><b>${money62(t.methods.cheque)}</b></div><div><small>Otros</small><b>${money62(t.methods.otros)}</b></div></div>
 <div style="display:flex;justify-content:space-between;align-items:end;margin:22px 0 9px"><div><div class="card-title">Historial de cierres</div><div class="card-subtitle">Referencia histórica. Estos registros NO se usan para sumar los totales superiores.</div></div><div class="text-sm text-muted">${t.facturas} factura(s) · ${t.pagos} pago(s) real(es) · ${t.gastosCount} gasto(s)</div></div>
 ${rows.length?`<div class="table-responsive"><table class="table"><thead><tr><th>Fecha</th><th>Facturado al cerrar</th><th>Cobrado al cerrar</th><th>Gastos al cerrar</th><th>Neto al cerrar</th><th>Pagos</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${dateLabel62(r.fecha)}</b></td><td>${money62(r.total_facturado)}</td><td><b>${money62(r.total_cobrado)}</b></td><td>${money62(r.total_gastos)}</td><td><b>${money62(r.neto)}</b></td><td>${Number(r.cantidad_pagos||0)}</td><td><span class="nm62-status">Cerrado</span></td><td><div class="bill-actions"><button class="btn btn-outline btn-sm" onclick="renderCashCloseV54('${esc62(r.fecha)}')">Ver</button><button class="btn btn-outline btn-sm" onclick="downloadSingleCashClosePDFV62('${esc62(r.id)}')">PDF</button></div></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state" style="padding:38px"><div class="empty-title">No hay cierres guardados en este período</div></div>'}
 </div></div>`}catch(e){console.error('[Reportes caja corregidos]',e);el.innerHTML=`<div class="card"><div class="card-body"><div class="empty-title">No se pudo calcular el reporte</div><div class="empty-text">${esc62(e.message||'Error de conexión')}</div></div></div>`}
};
function pdfShell62(title,sub,body){return `<div style="font-family:Arial,sans-serif;padding:24px;color:#172217"><h1 style="margin:0">${esc62(title)}</h1><p>${esc62(sub)}</p>${body}</div>`}
function realBody62(t){return `<h3>Resumen real del período</h3><table style="width:100%;border-collapse:collapse"><tr><td>Facturado</td><td style="text-align:right"><b>${money62(t.facturado)}</b></td></tr><tr><td>Cobrado real</td><td style="text-align:right"><b>${money62(t.cobrado)}</b></td></tr><tr><td>Pendiente</td><td style="text-align:right"><b>${money62(t.pendiente)}</b></td></tr><tr><td>Gastos</td><td style="text-align:right"><b>${money62(t.gastos)}</b></td></tr><tr><td>Neto de caja</td><td style="text-align:right"><b>${money62(t.neto)}</b></td></tr></table><p>${t.facturas} factura(s) · ${t.pagos} pago(s) real(es) · ${t.gastosCount} gasto(s)</p>`}
async function savePdf62(html,name){if(typeof html2pdf==='undefined')throw new Error('Generador PDF no disponible');const host=document.createElement('div');host.innerHTML=html;document.body.appendChild(host);try{await html2pdf().set({margin:8,filename:name,html2canvas:{scale:2},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}}).from(host).save()}finally{host.remove()}}
window.downloadCashPeriodPDFV62=async function(){const x=window.NMCashReportRangeV62,t=x.real;if(!t)return notify?.('Actualiza primero el reporte.','warning');try{await savePdf62(pdfShell62('REPORTE DE CAJA',`${dateLabel62(x.from)} - ${dateLabel62(x.to)}`,realBody62(t)),`Reporte_Caja_${x.from}_${x.to}.pdf`)}catch(e){console.error(e);notify?.('No se pudo generar el PDF: '+(e.message||'Error'),'danger')}};
window.downloadSingleCashClosePDFV62=async function(id){let r=(window.NMCashReportRangeV62.rows||[]).find(x=>String(x.id)===String(id));if(!r)return notify?.('No se encontró el cierre.','warning');const h=totals62([r]);try{await savePdf62(pdfShell62('CIERRE DE CAJA',dateLabel62(r.fecha),`<p>Facturado: <b>${money62(h.facturado)}</b></p><p>Cobrado: <b>${money62(h.cobrado)}</b></p><p>Gastos: <b>${money62(h.gastos)}</b></p><p>Neto: <b>${money62(h.neto)}</b></p>`),`Cierre_Caja_${r.fecha}.pdf`)}catch(e){notify?.('No se pudo generar el PDF.','danger')}};
const prevTab62=window.renderBillingTab;window.renderBillingTab=function(tab,btn){if(tab==='financial'){try{window.NMBillingTabStateV29?.set('financial')}catch(e){}return window.renderCashReportsV62()}return prevTab62?prevTab62.apply(this,arguments):undefined};
window.NMCashReportsAccountingFixedV127=true;
})();
