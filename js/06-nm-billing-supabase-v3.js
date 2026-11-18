/* =========================================================
   NutriMachata Facturacion Supabase v3
   Fuente principal: Supabase. sessionStorage queda solo como cache de lectura.
   ========================================================= */
(function(){
  'use strict';

  const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const BILLING_DB_TABLES={products:'productos_servicios',invoices:'facturas',details:'factura_detalles',payments:'pagos',inventory:'movimientos_inventario',clients:'clientes'};
  let billingClients=[];
  let billingDbLoaded=false;
  let billingDbLoading=null;
  let billingBusy=false;
  let billingLastError='';
  const pendingInvoiceCreates=new Map(); // numero_factura -> {id, stockStarted} de creaciones incompletas

  function isUuid(v){return UUID_RE.test(String(v||''));}
  function num(v,d=0){const n=Number(v);return Number.isFinite(n)?n:d;}
  function lower(v){return String(v||'').toLowerCase();}
  function dbRole(){return String(DB?.currentUser?.role||DB?.currentRole||'').toLowerCase();}
  function canManageBilling(){return ['admin','doctor','recepcion','reception','assistant','asistente'].includes(dbRole());}
  function currentCreatorId(){
    const authId=currentAuthUserId();
    if(authId) return authId;
    const candidates=[DB?.currentUser?.supabaseId,DB?.currentUser?.id];
    return candidates.find(isUuid)||null;
  }
  function mapStatusFromDb(v){
    return ({borrador:'Borrador',pendiente:'Pendiente',parcial:'Pago parcial',pagada:'Pagada',vencida:'Vencida',anulada:'Archivada'})[lower(v)]||'Pendiente';
  }
  function mapStatusToDb(v){
    return ({borrador:'borrador',pendiente:'pendiente','pago parcial':'parcial',parcial:'parcial',pagada:'pagada',vencida:'vencida',archivada:'anulada',anulada:'anulada'})[lower(v)]||'pendiente';
  }
  function mapMethodToDb(v){
    const m=lower(v);
    if(m.includes('efect'))return 'efectivo';
    if(m.includes('tarjet'))return 'tarjeta';
    if(m.includes('transfer'))return 'transferencia';
    if(m.includes('deposit'))return 'deposito';
    return 'otro';
  }
  function mapMethodFromDb(v){return ({efectivo:'Efectivo',tarjeta:'Tarjeta',transferencia:'Transferencia',deposito:'Depósito',otro:'Otro'})[lower(v)]||'Otro';}
  // v131: los módulos de cierre/recibos (v54, v70, v72, v73) esperan esta función global; sin ella
  // mostraban el valor crudo ("efectivo") y el cierre v70 separaba "efectivo" y "Efectivo" en filas distintas.
  window.mapMethodFromDb=mapMethodFromDb;

  function billingTimeout(promise,ms,message){
    let timer;
    const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{const e=new Error(message||'La operación tardó demasiado.');e.code='BILLING_TIMEOUT';reject(e)},ms)});
    return Promise.race([Promise.resolve(promise).finally(()=>clearTimeout(timer)),timeout]);
  }
  // v131: una solicitud HTTP real con cancelación por tiempo (AbortController). Antes el
  // tiempo límite solo rechazaba la promesa y la escritura podía completarse después sin aviso.
  async function billingRequest(path,method='GET',body=null,extraHeaders={}){
    const url=SUPA_URL.replace(/\/$/,'')+'/rest/v1/'+path;
    const request=async()=>{
      const token=supaAccessToken();
      if(!token){const e=new Error('No hay una sesión activa. Inicia sesión nuevamente.');e.code='AUTH_SESSION_EXPIRED';e.kind='auth';throw e;}
      const headers={apikey:SUPA_ANON,Authorization:'Bearer '+token,'Content-Type':'application/json',...extraHeaders};
      if((method==='POST'||method==='PATCH')&&!Object.keys(extraHeaders||{}).some(k=>k.toLowerCase()==='prefer')) headers.Prefer='return=representation';
      let res;
      try{res=await nmFetchTimeout(url,{method,headers,body:body==null?undefined:JSON.stringify(body),mode:'cors',credentials:'omit'},25000);nmTrackServerClock(res);}
      catch(err){
        const e=new Error('No se pudo conectar con Supabase. Revisa tu conexión a Internet e inténtalo nuevamente.');
        e.code='NETWORK_ERROR';e.kind='network';e.cause=err;e.uncertain=method!=='GET';throw e;
      }
      const raw=await res.text();
      let data=null;try{data=raw?JSON.parse(raw):null}catch(_){data=raw;}
      return {res,raw,data};
    };
    let out=await request();
    // Un 401 suele ser token vencido. Renovamos una sola vez y repetimos la petición (el servidor no la aplicó).
    if(out.res.status===401){
      await refreshSupaSession(true);
      out=await request();
    }
    if(!out.res.ok){
      const msg=(out.data&&typeof out.data==='object'&&(out.data.message||out.data.hint||out.data.details))||out.raw||`HTTP ${out.res.status}`;
      const e=new Error(msg);e.status=out.res.status;e.payload=out.data;e.kind=typeof nmClassifyHttpError==='function'?nmClassifyHttpError(out.res.status,out.data):'server';throw e;
    }
    if(typeof SUPA_ONLINE!=='undefined')SUPA_ONLINE=true;
    return out.data;
  }
  async function billingFetch(path,method='GET',body=null,extraHeaders={}){
    method=String(method||'GET').toUpperCase();
    if(IS_LOCAL) throw new Error('Abre NutriMachata desde una URL web (http/https). Supabase no se usa en modo file://.');
    if(typeof navigator!=='undefined' && navigator.onLine===false){
      const e=new Error('Sin conexión a Internet. Vuelve a intentarlo cuando se restablezca la conexión.');
      e.code='NETWORK_OFFLINE'; e.kind='offline'; e.uncertain=false; throw e;
    }
    // Toda Facturación usa una sesión Supabase válida. Evita enviar "Bearer null"
    // y renueva el token antes de cargar gastos, cotizaciones o configuración.
    // v85: no bloquear cada consulta esperando una validación redundante de sesión.
    // Si ya existe token, úsalo directamente; si falta, entonces sí recupera/valida la sesión.
    if(!supaAccessToken()) await billingTimeout(ensureSupaSession(),18000,'Supabase tardó demasiado en validar la sesión.');
    if(method==='GET'){
      // Lecturas simultáneas idénticas comparten la solicitud y las listas se paginan completas.
      return nmShareGet('BILL '+path,()=>nmPageablePath(path)?nmFetchAllPages(path,p=>billingRequest(p,'GET')):billingRequest(path,'GET'));
    }
    // Escrituras: sin reintentos automáticos; si el resultado es incierto se verifica antes de repetir.
    return nmGuardedWrite({method,path,body,send:()=>billingRequest(path,method,body,extraHeaders),get:p=>billingRequest(p,'GET')});
  }

  function humanDbError(e,action='guardar'){
    console.error('[Facturacion Supabase]',e);
    let msg=String(e?.message||e||'Error desconocido');
    if(e?.status===401||e?.status===403||/row-level security|permission denied|jwt|rls/i.test(msg)){
      msg='Supabase bloqueó la operación por permisos RLS. El usuario debe estar autenticado en Supabase Auth y tener permiso para Facturación.';
    }else if(/duplicate key|unique constraint|numero_factura/i.test(msg)){
      msg='Ese número de factura ya existe. Actualiza la lista e intenta nuevamente.';
    }else if(/foreign key|violates foreign key/i.test(msg)){
      msg='No se pudo relacionar el registro con el paciente, factura o producto seleccionado.';
    }else if(/stock/i.test(msg)){
      msg='No hay inventario suficiente para completar esta operación.';
    }
    billingLastError=msg;
    notify(`No se pudo ${action}: ${msg}`,'danger');
    return msg;
  }

  function setBusy(btn,busy,label='Guardando...'){
    if(!btn)return;
    if(busy){btn.dataset.oldText=btn.innerHTML;btn.disabled=true;btn.innerHTML=label;}
    else{btn.disabled=false;if(btn.dataset.oldText)btn.innerHTML=btn.dataset.oldText;}
  }
  async function withBillingLock(btn,fn,label='Guardando...'){
    if(billingBusy){notify('Ya hay una operación de facturación en proceso.','info');return false;}
    billingBusy=true;setBusy(btn,true,label);
    try{return await fn();}finally{billingBusy=false;setBusy(btn,false);}
  }

  function productDbToUi(p){return normalizeBillingProduct({
    id:p.id,name:p.nombre,description:p.descripcion||'',type:lower(p.tipo)==='servicio'?'Servicio':'Producto',category:p.categoria||'',price:num(p.precio),cost:num(p.costo),stock:num(p.stock),min:num(p.stock_minimo),active:p.activo!==false
  });}
  function detailDbToUi(d){const qty=num(d.cantidad,1),price=num(d.precio_unitario),gross=qty*price,discountAmount=Math.max(0,num(d.descuento));const discount=gross>0?Math.max(0,Math.min(100,discountAmount/gross*100)):0;return {id:d.id,productId:d.producto_servicio_id||'',description:d.descripcion||'Concepto',qty,price,discount,discountAmount};}
  function paymentDbToUi(p,inv){const applied=num(p.monto_aplicado??p.monto),received=num(p.monto_recibido??p.monto),creditGenerated=num(p.saldo_favor_generado),creditUsed=num(p.saldo_favor_usado);return {id:p.id,date:String(p.fecha_pago||p.created_at||'').slice(0,10),datetime:String(p.fecha_pago||p.created_at||''),amount:applied,applied,received,creditGenerated,creditUsed,method:(creditUsed>0&&received<=0)?'Saldo a favor':mapMethodFromDb(p.metodo_pago),reference:p.referencia||'',notes:p.notas||'',invoice:inv?.number||'',patient:inv?.patient||''};}

  async function loadBillingFromSupabase(force=false){
    // v131: una recarga forzada (después de guardar) no puede reutilizar una carga iniciada antes del guardado.
    if(billingDbLoading){ if(!force) return billingDbLoading; return billingDbLoading.catch(()=>null).then(()=>loadBillingFromSupabase(true)); }
    billingDbLoading=(async()=>{
      try{
        const results=await Promise.allSettled([
          billingFetch(`${BILLING_DB_TABLES.products}?select=*&order=created_at.desc`),
          billingFetch(`${BILLING_DB_TABLES.invoices}?select=*&order=fecha.desc,created_at.desc`),
          billingFetch(`${BILLING_DB_TABLES.details}?select=*&order=created_at.asc`),
          billingFetch(`${BILLING_DB_TABLES.payments}?select=*&order=fecha_pago.asc`),
          billingFetch(`${BILLING_DB_TABLES.clients}?select=*&activo=eq.true&order=nombre.asc`)
        ]);
        const val=i=>results[i].status==='fulfilled'?(results[i].value||[]):[];
        const products=val(0), invoices=val(1), details=val(2), payments=val(3), clients=val(4);
        // Facturas y pagos son el núcleo. Si fallan, no reemplazamos la memoria por ceros.
        if(results[1].status!=='fulfilled') throw results[1].reason;
        if(results[3].status!=='fulfilled') throw results[3].reason;
        // v131: sin detalles, una factura editada se guardaría sin líneas (se borrarían sus conceptos).
        // Por eso los detalles también son críticos: si fallan se conserva la memoria anterior completa.
        if(results[2].status!=='fulfilled') throw results[2].reason;
        if(results[0].status==='rejected') console.warn('[Facturación] productos no disponibles temporalmente; se conserva el catálogo cargado',results[0].reason?.message||results[0].reason);
        if(results[4].status==='rejected') console.warn('[Facturación] clientes no disponibles temporalmente; se conservan los clientes cargados',results[4].reason?.message||results[4].reason);
        if(results[4].status==='fulfilled') billingClients=(clients||[]).map(c=>({id:c.id,type:'client',nombre:[c.nombre,c.apellido].filter(Boolean).join(' ').trim(),cedula:c.cedula_rnc||'',telefono:c.telefono||'',email:c.correo||'',direccion:c.direccion||'',tipo:c.tipo||'persona'}));
        window.NMBillingClients=billingClients;
        const uiProducts=results[0].status==='fulfilled'?(products||[]).map(productDbToUi):(BILLING_MEMORY?.products||[]);
        const uiInvoices=(invoices||[]).map(f=>{
          const its=(details||[]).filter(d=>d.factura_id===f.id).map(detailDbToUi);
          const pays=(payments||[]).filter(p=>p.factura_id===f.id);
          const inv=normalizeBillingInvoice({
            id:f.id,number:f.numero_factura,date:f.fecha,dueDate:f.fecha_vencimiento||'',patientId:f.paciente_id||'',clientId:f.cliente_id||'',partyType:f.cliente_id?'client':'patient',patient:f.paciente_nombre||'',rnc:(()=>{const bp=billingPatients();const px=f.cliente_id?billingClients.find(c=>String(c.id)===String(f.cliente_id)):(bp.find(p=>String(p.id)===String(f.paciente_id))||bp.find(p=>String(p.nombre||'').trim().toLowerCase()===String(f.paciente_nombre||'').trim().toLowerCase()));return String(px?.cedula||px?.rnc||'')})(),ncf:f.ncf||'',notes:f.notas||'',items:its,
            discount:num(f.descuento),tax:num(f.subtotal)>0?num(f.impuestos)/Math.max(.01,(num(f.subtotal)-num(f.descuento)))*100:0,
            paid:num(f.total_pagado),paymentHistory:[],status:mapStatusFromDb(f.estado),localityId:f.localidad_id||'',localityName:f.localidad_nombre_snapshot||''
          });
          // En BD descuento es monto; normalize usa porcentaje. Recalculamos con los valores persistidos para no alterar cifras historicas.
          inv.subtotal=num(f.subtotal); inv.total=num(f.total); inv.paid=num(f.total_pagado); inv.status=mapStatusFromDb(f.estado);
          inv.discountAmount=num(f.descuento); inv.taxAmount=num(f.impuestos);
          inv.discount=inv.subtotal?Math.max(0,Math.min(100,inv.discountAmount/inv.subtotal*100)):0;
          const taxable=Math.max(0,inv.subtotal-inv.discountAmount);
          inv.tax=taxable?Math.max(0,inv.taxAmount/taxable*100):0;
          inv.paymentHistory=pays.map(p=>paymentDbToUi(p,inv));
          inv._dbTotals={subtotal:num(f.subtotal),total:num(f.total)}; // v131: totales confirmados por Supabase
          return inv;
        });
        BILLING_MEMORY=normalizeBillingData({invoices:uiInvoices,products:uiProducts,templateNote:BILLING_MEMORY?.templateNote||'Gracias por confiar en NutriMachata.',settings:BILLING_MEMORY?.settings||{defaultTax:0,currency:'RD$'}});
        // Cache de emergencia, nunca fuente principal de escritura.
        try{sessionStorage.setItem(BILLING_KEY,JSON.stringify(BILLING_MEMORY));}catch(_e){}
        billingDbLoaded=true;billingLastError='';
        return BILLING_MEMORY;
      }catch(e){humanDbError(e,'cargar Facturación');return null;}
      finally{billingDbLoading=null;}
    })();
    return billingDbLoading;
  }

  // Lectura sincronica para la UI. La fuente se rellena desde Supabase.
  window.getBillingData=function(){return normalizeBillingData(BILLING_MEMORY||{});};
  window.saveBillingData=function(data){BILLING_MEMORY=normalizeBillingData(data);try{sessionStorage.setItem(BILLING_KEY,JSON.stringify(BILLING_MEMORY));}catch(_e){}return true;};

  const legacyRenderBilling=window.renderBilling;
  window.renderBilling=function(){
    legacyRenderBilling();
    const page=document.getElementById('page-content');
    if(page){
      const hero=page.querySelector('.billing-hero');
      if(hero&&!page.querySelector('#billing-db-status')){
        hero.insertAdjacentHTML('afterend',`<div id="billing-db-status" style="margin:-10px 0 16px;padding:9px 12px;border:1px solid #dfe9da;background:#f7fbf4;border-radius:10px;font-size:12px;color:#46613c">⏳ Sincronizando Facturación con Supabase...</div>`);
      }
    }
    loadBillingFromSupabase(false).then(ok=>{
      const st=document.getElementById('billing-db-status');
      if(!ok){if(st){st.innerHTML='⚠️ No se pudo sincronizar con Supabase. '+billingEscape(billingLastError);st.style.background='#fff5f3';st.style.borderColor='#f1c7c0';st.style.color='#9b2c22';}return;}
      // Detectar tipo real de ID cargado desde pacientes.
      const p=billingPatients()[0];
      const uuidOk=!p||isUuid(p.id);
      legacyRenderBilling();
      // v55: este redibujado ocurre al terminar Supabase y antes borraba las pestañas añadidas.
      // Restaurarlas aqui, despues del render real, sin observers ni polling.
      setTimeout(()=>{try{window.NMEnsureBillingTabsV54?.();}catch(_e){}},0);
      const hero2=document.querySelector('.billing-hero');
      if(hero2){hero2.insertAdjacentHTML('afterend',`<div id="billing-db-status" style="margin:-10px 0 16px;padding:9px 12px;border:1px solid ${uuidOk?'#d4ead0':'#f1c7c0'};background:${uuidOk?'#f5fbf2':'#fff5f3'};border-radius:10px;font-size:12px;color:${uuidOk?'#315c2b':'#9b2c22'}">${uuidOk?'✓ Facturación sincronizada con Supabase':'⚠️ El ID de pacientes no parece UUID. facturas.paciente_id es UUID; la factura guardará paciente_nombre pero no paciente_id hasta corregir el tipo.'}</div>`);}
    });
  };

  function invoiceDbPayload(p,items,totals,old){
    const partyRawId=p?.id;
    const isClient=p?.type==='client';
    const discountAmount=totals.sub*totals.disc/100;
    const taxable=Math.max(0,totals.sub-discountAmount);
    const taxAmount=taxable*totals.tax/100;
    return {
      numero_factura:document.getElementById('inv-number').value,
      paciente_id:!isClient&&isUuid(partyRawId)?partyRawId:null,
      cliente_id:isClient&&isUuid(partyRawId)?partyRawId:null,
      paciente_nombre:p.nombre,
      fecha:document.getElementById('inv-date').value||billingToday(),
      fecha_vencimiento:document.getElementById('inv-due').value||null,
      estado:old?mapStatusToDb(old.status):'pendiente',
      ncf:document.getElementById('inv-ncf').value.trim()||null,
      tipo_comprobante:null,
      subtotal:Number(totals.sub.toFixed(2)),
      descuento:Number(discountAmount.toFixed(2)),
      impuestos:Number(taxAmount.toFixed(2)),
      total:Number(totals.total.toFixed(2)),
      total_pagado:old?num(old.paid):0,
      saldo:Number(Math.max(0,totals.total-(old?num(old.paid):0)).toFixed(2)),
      notas:document.getElementById('inv-notes').value.trim()||null,
      localidad_id:(!isClient&&old&&String(old.patientId||'')===String(partyRawId))?(old.localityId||null):((!isClient&&isUuid(p.localidad_id))?p.localidad_id:null),
      localidad_nombre_snapshot:(!isClient&&old&&String(old.patientId||'')===String(partyRawId))?(old.localityName||null):((!isClient?(window.NM121?.locations||[]).find(l=>String(l.id)===String(p.localidad_id))?.nombre:null)||null),
      created_by:currentCreatorId()
    };
  }

  function detailsPayload(invoiceId,items){return items.map(i=>({
    factura_id:invoiceId,
    producto_servicio_id:isUuid(i.productId)?i.productId:null,
    descripcion:i.description,
    cantidad:Number(num(i.qty,1).toFixed(2)),
    precio_unitario:Number(num(i.price).toFixed(2)),
    descuento:Number((num(i.qty)*num(i.price)*Math.min(100,Math.max(0,num(i.discount)))/100).toFixed(2)),
    subtotal:Number(billingLineTotal(i).toFixed(2))
  }));}

  async function productStock(id){
    const r=await billingFetch(`${BILLING_DB_TABLES.products}?id=eq.${encodeURIComponent(id)}&select=id,nombre,tipo,stock&limit=1`);
    return r&&r[0]?r[0]:null;
  }
  // v131: si existe la función SQL nm_ajustar_stock_v131 (ver sql/), el ajuste de existencias y su
  // movimiento se registran en una sola transacción con stock = stock + delta (sin carreras entre usuarios).
  // Si la función no existe, se usa el método anterior sin cambios.
  let stockRpcAvailable=null;
  async function adjustStock(productId,delta,invoiceId,movementType,reason){
    if(!isUuid(productId)||!delta)return;
    if(stockRpcAvailable!==false){
      try{
        await billingFetch('rpc/nm_ajustar_stock_v131','POST',{p_producto_id:productId,p_delta:Math.round(delta),p_factura_id:isUuid(invoiceId)?invoiceId:null,p_tipo:movementType,p_motivo:reason||null});
        stockRpcAvailable=true;return;
      }catch(e){
        if(e?.status===404||/PGRST202|Could not find the function|schema cache/i.test(String(e?.message||''))){stockRpcAvailable=false;}
        else throw e;
      }
    }
    const p=await productStock(productId);
    if(!p||lower(p.tipo)==='servicio')return;
    const before=num(p.stock),after=before+delta;
    // v85: Facturación no se bloquea por inventario. Si no hay existencias suficientes,
    // el stock puede quedar negativo para reflejar la venta pendiente de reposición.
    await billingFetch(`${BILLING_DB_TABLES.products}?id=eq.${encodeURIComponent(productId)}`,'PATCH',{stock:after});
    await billingFetch(BILLING_DB_TABLES.inventory,'POST',{
      producto_id:productId,tipo:movementType,cantidad:Math.abs(Math.round(delta)),stock_anterior:before,stock_nuevo:after,factura_id:isUuid(invoiceId)?invoiceId:null,motivo:reason,created_by:currentCreatorId()
    });
  }
  async function applyInvoiceStock(items,sign,invoiceId,reason){
    // sign -1 = venta, +1 = reverso
    for(const i of items){
      if(!i.productId)continue;
      const qty=num(i.qty);
      await adjustStock(i.productId,sign*qty,invoiceId,sign<0?'venta':'entrada',reason);
    }
  }

  async function nmChooseInvoiceLocality(p){
    let locations=[];
    try{locations=await billingFetch('localidades?select=id,nombre,codigo,activo&activo=eq.true&order=nombre.asc')||[];}catch(e){console.warn('[Facturacion] No se pudieron cargar localidades',e)}
    return await new Promise(resolve=>{
      const prev=document.getElementById('nm-invoice-locality-warning');if(prev)prev.remove();
      const wrap=document.createElement('div');wrap.id='nm-invoice-locality-warning';wrap.style.cssText='position:fixed;inset:0;z-index:100000;background:rgba(16,30,22,.55);display:flex;align-items:center;justify-content:center;padding:20px';
      const opts=locations.map(l=>`<option value="${String(l.id).replace(/"/g,'&quot;')}">${String(l.nombre||'Localidad').replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]))}</option>`).join('');
      wrap.innerHTML=`<div style="width:min(520px,100%);background:#fff;border-radius:20px;padding:24px;box-shadow:0 24px 70px rgba(0,0,0,.24)"><div style="font-size:13px;font-weight:800;color:#9a6b00;margin-bottom:7px">⚠️ PACIENTE SIN LOCALIDAD</div><h3 style="margin:0 0 8px;color:#20372b">${String(p.nombre||'Paciente').replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]))}</h3><p style="margin:0 0 18px;color:#66736b;line-height:1.5">Puedes seleccionar una localidad creada en Ajustes y continuar, o emitir la factura sin localidad. Esto no bloqueará la facturación.</p>${locations.length?`<label style="display:block;font-weight:700;margin-bottom:7px">Seleccionar localidad</label><select id="nm-invoice-locality-choice" class="form-select" style="width:100%;margin-bottom:18px"><option value="">Selecciona una localidad...</option>${opts}</select>`:`<div style="padding:11px 13px;background:#f5f7f5;border-radius:10px;margin-bottom:18px;color:#66736b">No hay localidades activas creadas. Puedes continuar sin localidad y crearlas luego en Ajustes → Localidades.</div>`}<div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap"><button type="button" id="nm-loc-cancel" class="btn btn-outline">Cancelar</button><button type="button" id="nm-loc-none" class="btn btn-outline">Continuar sin localidad</button>${locations.length?'<button type="button" id="nm-loc-assign" class="btn btn-olive">Asignar y continuar</button>':''}</div></div>`;
      document.body.appendChild(wrap);
      const done=v=>{wrap.remove();resolve(v)};
      wrap.querySelector('#nm-loc-cancel').onclick=()=>done(false);
      wrap.querySelector('#nm-loc-none').onclick=()=>done(true);
      const assign=wrap.querySelector('#nm-loc-assign');if(assign)assign.onclick=async()=>{const lid=wrap.querySelector('#nm-invoice-locality-choice')?.value||'';if(!lid){notify('Selecciona una localidad o usa “Continuar sin localidad”.','warning');return}const l=locations.find(x=>String(x.id)===String(lid));try{await supa('rpc/nm_asignar_localidad_paciente','POST',{p_paciente_id:p.id,p_localidad_id:lid,p_origen:'facturacion'});p.localidad_id=lid;if(window.NM121){window.NM121.locations=locations;const px=(window.NM121.patients||[]).find(x=>String(x.id)===String(p.id));if(px)px.localidad_id=lid}notify(`Localidad asignada: ${l?.nombre||'Localidad'}.`,'success');done(true)}catch(e){console.error('[Facturacion localidad]',e);notify('No se pudo asignar la localidad. Puedes continuar sin localidad.','danger')}};
    });
  }

  window.saveInvoice=async function(){
    const btn=document.querySelector('#invoice-modal .modal-footer .btn-olive');
    return withBillingLock(btn,async()=>{
      if(!canManageBilling()){notify('Tu usuario no tiene permiso para modificar Facturación.','danger');return false;}
      const id=document.getElementById('inv-id')?.value||'';
      const partyId=document.getElementById('inv-party-id')?.value||document.getElementById('inv-patient')?.value||'';
      const partyType=document.getElementById('inv-party-type')?.value||'patient';
      const p=partyType==='client'?billingClients.find(x=>String(x.id)===String(partyId)):billingPatients().find(x=>String(x.id)===String(partyId));
      const items=collectInvoiceLines();
      if(!p){notify('Busca y selecciona un cliente o paciente.','warning');return false;}
      p.type=partyType;
      if(partyType==='patient'&&!p.localidad_id){
        const choice=await nmChooseInvoiceLocality(p);
        if(choice===false)return false;
      }
      if(!items.length){notify('Agrega al menos un producto o servicio.','warning');return false;}
      if(items.some(i=>!Number.isFinite(i.qty)||i.qty<=0||!Number.isFinite(i.price)||i.price<0)){notify('Revisa cantidades y precios.','warning');return false;}
      const totals=recalcInvoiceEditor();
      const old=getBillingData().invoices.find(x=>x.id===id)||null;
      try{
        // v85: el inventario informa existencias, pero no impide emitir una factura.
        // applyInvoiceStock registrará la salida y permitirá stock negativo si corresponde.

        const payload=invoiceDbPayload(p,items,totals,old);
        let invoiceId=id;
        if(old){
          // Reverso del inventario anterior ANTES de aplicar la nueva version.
          await applyInvoiceStock(old.items,+1,old.id,'Reverso por edición de factura');
          // No alterar total_pagado manualmente; pagos siguen siendo la verdad.
          delete payload.total_pagado;
          delete payload.saldo;
          await billingFetch(`${BILLING_DB_TABLES.invoices}?id=eq.${encodeURIComponent(id)}`,'PATCH',payload);
          await billingFetch(`${BILLING_DB_TABLES.details}?factura_id=eq.${encodeURIComponent(id)}`,'DELETE');
        }else{
          // v131: si un intento anterior creó la factura pero falló antes de guardar sus líneas,
          // se completa esa misma factura en lugar de crear otra (evita facturas duplicadas o vacías).
          const resume=pendingInvoiceCreates.get(String(payload.numero_factura||''));
          let resumed=null;
          if(resume){
            const ex=await billingFetch(`${BILLING_DB_TABLES.invoices}?id=eq.${encodeURIComponent(resume.id)}&select=id,numero_factura&limit=1`);
            const exDetails=ex?.[0]?.id?await billingFetch(`${BILLING_DB_TABLES.details}?factura_id=eq.${encodeURIComponent(resume.id)}&select=id&limit=1`):null;
            if(ex?.[0]?.id&&Array.isArray(exDetails)&&!exDetails.length&&!resume.stockStarted){
              await billingFetch(`${BILLING_DB_TABLES.invoices}?id=eq.${encodeURIComponent(resume.id)}`,'PATCH',payload);
              resumed=resume.id;
            }else pendingInvoiceCreates.delete(String(payload.numero_factura||''));
          }
          if(resumed) invoiceId=resumed;
          else{
            const created=await billingFetch(BILLING_DB_TABLES.invoices,'POST',payload);
            if(!created?.[0]?.id)throw new Error('Supabase no devolvió el ID de la factura creada.');
            invoiceId=created[0].id;
            pendingInvoiceCreates.set(String(payload.numero_factura||''),{id:invoiceId,stockStarted:false});
          }
        }
        const dp=detailsPayload(invoiceId,items); if(dp.length)await billingFetch(BILLING_DB_TABLES.details,'POST',dp);
        const pend=pendingInvoiceCreates.get(String(payload.numero_factura||''));if(pend)pend.stockStarted=true;
        await applyInvoiceStock(items,-1,invoiceId,old?'Venta actualizada por edición de factura':'Venta por factura');
        if(!old)pendingInvoiceCreates.delete(String(payload.numero_factura||''));
        await loadBillingFromSupabase(true);
        document.getElementById('invoice-modal')?.remove();
        legacyRenderBilling();
        notify(old?'Factura actualizada en Supabase.':'Factura creada en Supabase.','success');
        return true;
      }catch(e){
        // Recargar siempre para reflejar la verdad del servidor tras una operación parcial.
        await loadBillingFromSupabase(true);
        humanDbError(e,old?'actualizar la factura':'crear la factura');
        return false;
      }
    });
  };

  window.saveInvoicePayment=async function(id){
    const btn=document.querySelector('#invoice-payment-modal .modal-footer .btn-olive');
    return withBillingLock(btn,async()=>{
      if(!canManageBilling()){notify('Tu usuario no tiene permiso para registrar pagos.','danger');return false;}
      const x=getBillingData().invoices.find(i=>i.id===id);if(!x){notify('La factura ya no existe.','danger');return false;}
      const rem=billingInvoiceBalance(x),amount=num(document.getElementById('pay-amount')?.value);
      if(!(amount>0)||amount>rem+.001){notify('El monto debe ser mayor que cero y no superar el saldo pendiente.','warning');return false;}
      try{
        await billingFetch(BILLING_DB_TABLES.payments,'POST',{
          factura_id:id,monto:Number(amount.toFixed(2)),metodo_pago:mapMethodToDb(document.getElementById('pay-method')?.value),referencia:document.getElementById('pay-reference')?.value.trim()||null,notas:null,created_by:currentCreatorId()
        });
        // El trigger recalcular_pago_factura actualiza total_pagado, saldo y estado.
        await loadBillingFromSupabase(true);
        document.getElementById('invoice-payment-modal')?.remove();legacyRenderBilling();
        const refreshed=getBillingData().invoices.find(i=>i.id===id);
        if(refreshed&&Math.abs(refreshed.paid-(x.paid+amount))>.02)notify('El pago se guardó, pero el total calculado no coincide. Revisa el trigger recalcular_pago_factura.','warning');
        else notify('Pago registrado y saldo actualizado por Supabase.','success');
        return true;
      }catch(e){humanDbError(e,'registrar el pago');return false;}
    });
  };

  window.saveBillingProduct=async function(id){
    const btn=document.querySelector('#billing-product-modal .modal-footer .btn-olive');
    return withBillingLock(btn,async()=>{
      if(!canManageBilling()){notify('Tu usuario no tiene permiso para modificar productos.','danger');return false;}
      const name=document.getElementById('prd-name')?.value.trim()||'',price=num(document.getElementById('prd-price')?.value,NaN);
      if(!name){notify('Escribe el nombre.','warning');return false;}if(!Number.isFinite(price)||price<0){notify('Precio inválido.','warning');return false;}
      const type=document.getElementById('prd-type')?.value||'Producto';
      const stock=type==='Servicio'?0:num(document.getElementById('prd-stock')?.value);
      const min=num(document.getElementById('prd-min')?.value);
      if(stock<0||min<0){notify('Stock y stock mínimo no pueden ser negativos.','warning');return false;}
      const payload={nombre:name,descripcion:document.getElementById('prd-description')?.value.trim()||null,tipo:type==='Servicio'?'servicio':'producto',categoria:document.getElementById('prd-category')?.value.trim()||null,precio:Number(price.toFixed(2)),costo:Number(Math.max(0,num(document.getElementById('prd-cost')?.value)).toFixed(2)),stock:Math.round(stock),stock_minimo:Math.round(min),controla_inventario:type!=='Servicio',activo:true};
      try{
        if(id){
          const before=await productStock(id);
          await billingFetch(`${BILLING_DB_TABLES.products}?id=eq.${encodeURIComponent(id)}`,'PATCH',payload);
          if(before&&lower(before.tipo)!=='servicio'&&num(before.stock)!==payload.stock){
            await billingFetch(BILLING_DB_TABLES.inventory,'POST',{producto_id:id,tipo:'ajuste',cantidad:Math.abs(payload.stock-num(before.stock)),stock_anterior:num(before.stock),stock_nuevo:payload.stock,factura_id:null,motivo:'Ajuste manual desde catálogo',created_by:currentCreatorId()});
          }
        }else await billingFetch(BILLING_DB_TABLES.products,'POST',payload);
        await loadBillingFromSupabase(true);document.getElementById('billing-product-modal')?.remove();renderBillingTab('inventory');notify(`${type} guardado en Supabase.`,'success');return true;
      }catch(e){humanDbError(e,'guardar el producto/servicio');return false;}
    });
  };

  window.deleteBillingProduct=async function(id){
    const p=getBillingData().products.find(x=>x.id===id);if(!p)return;
    if(!confirm(`¿Eliminar “${p.name}” del catálogo? Si ya fue usado en facturas, los detalles históricos conservarán la descripción.`))return;
    try{await billingFetch(`${BILLING_DB_TABLES.products}?id=eq.${encodeURIComponent(id)}`,'DELETE');await loadBillingFromSupabase(true);renderBillingTab('inventory');notify('Producto/servicio eliminado de Supabase.','success');}catch(e){humanDbError(e,'eliminar el producto/servicio');}
  };

  window.deleteInvoice=async function(id){
    const x=getBillingData().invoices.find(i=>i.id===id);if(!x)return;
    if((x.paymentHistory||[]).length||num(x.paid)>0){notify('Una factura con pagos no se elimina. Anúlala para conservar la trazabilidad.','warning');return;}
    if(!confirm(`¿Eliminar definitivamente la factura ${x.number}? El inventario vendido será devuelto.`))return;
    try{await applyInvoiceStock(x.items,+1,id,'Reverso por eliminación de factura');await billingFetch(`${BILLING_DB_TABLES.invoices}?id=eq.${encodeURIComponent(id)}`,'DELETE');await loadBillingFromSupabase(true);document.getElementById('invoice-view-modal')?.remove();legacyRenderBilling();notify('Factura eliminada y stock restaurado.','success');}catch(e){humanDbError(e,'eliminar la factura');await loadBillingFromSupabase(true);}
  };

  window.archiveInvoice=async function(id){
    const x=getBillingData().invoices.find(i=>i.id===id);if(!x)return;
    const isAnnulled=x.status==='Archivada';
    if(!isAnnulled&&!confirm(`¿Anular la factura ${x.number}? Se restaurará el inventario y se conservará el historial.`))return;
    try{
      if(isAnnulled){
        // Reactivar requiere stock disponible.
        await applyInvoiceStock(x.items,-1,id,'Reaplicación de inventario por reactivación de factura');
        await billingFetch(`${BILLING_DB_TABLES.invoices}?id=eq.${encodeURIComponent(id)}`,'PATCH',{estado:num(x.paid)>0?(num(x.paid)>=num(x.total)?'pagada':'parcial'):'pendiente'});
      }else{
        await applyInvoiceStock(x.items,+1,id,'Reverso de inventario por anulación de factura');
        await billingFetch(`${BILLING_DB_TABLES.invoices}?id=eq.${encodeURIComponent(id)}`,'PATCH',{estado:'anulada'});
      }
      await loadBillingFromSupabase(true);legacyRenderBilling();notify(isAnnulled?'Factura reactivada.':'Factura anulada sin borrar su historial.','success');
    }catch(e){humanDbError(e,isAnnulled?'reactivar la factura':'anular la factura');await loadBillingFromSupabase(true);}
  };

  // Puente seguro para funciones internas de Facturación usadas por extensiones posteriores.
  window.NMBillingInternal={applyInvoiceStock,billingFetch,humanDbError,BILLING_DB_TABLES,loadBillingFromSupabase};

  // Asegurar que los onclick inline apunten a las versiones Supabase.
  Object.assign(window,{saveInvoice:window.saveInvoice,saveInvoicePayment:window.saveInvoicePayment,saveBillingProduct:window.saveBillingProduct,deleteBillingProduct:window.deleteBillingProduct,deleteInvoice:window.deleteInvoice,archiveInvoice:window.archiveInvoice,renderBilling:window.renderBilling});
  window.NMBillingClientAPI={billingFetch,loadBillingFromSupabase,getClients:()=>billingClients};

  // Aviso de RLS/auth. El HTML actual usa la anon key; si Supabase Auth no está activo, las policies "to authenticated" bloquearán escrituras.
  window.billingSupabasePreflight=async function(){
    try{
      await billingFetch(`${BILLING_DB_TABLES.products}?select=id&limit=1`);
      return {ok:true,patientIdType:(billingPatients()[0]?(isUuid(billingPatients()[0].id)?'uuid':'no-uuid'):'sin-pacientes'),creatorId:currentCreatorId()};
    }catch(e){return {ok:false,error:String(e.message||e),patientIdType:(billingPatients()[0]?(isUuid(billingPatients()[0].id)?'uuid':'no-uuid'):'sin-pacientes')};}
  };
})();
