// Mock mínimo de Supabase (Auth + PostgREST) para pruebas locales sin tocar producción.
const crypto=require('crypto');
const uuid=()=>crypto.randomUUID();
const nowIso=()=>new Date().toISOString();
function b64url(o){return Buffer.from(JSON.stringify(o)).toString('base64url')}
function makeJwt(user,ttl=3600){const exp=Math.floor(Date.now()/1000)+ttl;return 'h.'+b64url({sub:user.id,email:user.email,role:'authenticated',exp})+'.s'}
function parseJwt(t){try{return JSON.parse(Buffer.from(String(t).split('.')[1],'base64url').toString())}catch(_){return null}}

function createMock(){
  const U={
    admin:{id:uuid(),email:'admin@nutrimachata.com',password:'Admin#2026',user_metadata:{name:'Administrador NutriMachata'},app_metadata:{}},
    doctor:{id:uuid(),email:'doctor@nutrimachata.com',password:'Doctor#2026',user_metadata:{name:'Dra. Prueba',role:'doctor'},app_metadata:{}},
    patient:{id:uuid(),email:'ana@example.com',password:'Paciente#2026',user_metadata:{name:'Ana Pérez',role:'patient'},app_metadata:{}},
    norole:{id:uuid(),email:'sinrol@example.com',password:'SinRol#2026',user_metadata:{},app_metadata:{}},
  };
  const P1=uuid(),P2=uuid(),P3=uuid(),LOC=uuid(),PR1=uuid(),PR2=uuid(),F1=uuid(),G1=uuid(),T1=uuid();
  const d=(n)=>{const x=new Date();x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)};
  const db={
    usuarios:[{id:U.admin.id,email:U.admin.email,rol:'admin',nombre:'Admin'},{id:U.doctor.id,email:U.doctor.email,rol:'doctor',nombre:'Dra. Prueba'},{id:U.patient.id,email:U.patient.email,rol:'patient',nombre:'Ana Pérez'}],
    pacientes:[
      {id:P1,nombre:'Ana Pérez',email:U.patient.email,telefono:'8095550001',cedula:'001-0000001-1',sexo:'F',edad:34,peso:72,talla:1.62,imc:27.4,presion:'120/80',estado:'Sobrepeso',auth_user_id:U.patient.id,created_at:'2026-01-02T10:00:00Z',localidad_id:LOC,activo:true},
      {id:P2,nombre:'Luis Gómez',email:'luis@example.com',telefono:'8095550002',cedula:'001-0000002-2',sexo:'M',edad:45,peso:95,talla:1.78,imc:30,presion:'145/95',estado:'Obesidad I',created_at:'2026-02-03T10:00:00Z',localidad_id:null,activo:true},
      {id:P3,nombre:'María Rosario',email:'maria@example.com',telefono:'8095550003',cedula:'001-0000003-3',sexo:'F',edad:29,peso:58,talla:1.60,imc:22.7,presion:'110/70',estado:'Normal',created_at:'2026-03-04T10:00:00Z',localidad_id:LOC,activo:true},
    ],
    evaluaciones:[
      {id:uuid(),paciente_id:P1,fecha:'2026-09-01',peso:74,talla:1.62,imc:28.2,presion:'120/80',created_at:'2026-09-01T10:00:00Z'},
      {id:uuid(),paciente_id:P1,fecha:'2026-10-15',peso:72,talla:1.62,imc:27.4,presion:'118/78',created_at:'2026-10-15T10:00:00Z'},
      {id:uuid(),paciente_id:P2,fecha:'2026-10-20',peso:95,talla:1.78,imc:30,presion:'145/95',created_at:'2026-10-20T10:00:00Z'},
    ],
    dietas:[{id:uuid(),paciente_id:P1,nombre:'Plan hipocalórico',kcal:1600,created_at:'2026-10-15T11:00:00Z'}],
    historias_clinicas:[{id:uuid(),paciente_id:P1,motivo:'Control de peso',antecedentes:[],antec_fam:[],habitos:[],sintomas:[]}],
    citas:[{id:uuid(),paciente_id:P1,fecha:d(1),hora:'09:00:00',descripcion:'Control',estado:'pendiente'},{id:uuid(),paciente_id:P2,fecha:d(2),hora:'10:30:00',descripcion:'Evaluación',estado:'pendiente'}],
    seguimiento_paciente:[],lab_notes:[],notas_clinicas:[],consentimientos_pacientes:[],
    asignaciones_pacientes:[],
    localidades:[{id:LOC,nombre:'Sede Central',codigo:'SC',activo:true,created_at:'2026-01-01T00:00:00Z'}],
    productos_servicios:[
      {id:PR1,nombre:'Consulta nutricional',tipo:'servicio',precio:2500,costo:0,stock:0,stock_minimo:0,activo:true,created_at:'2026-01-01T00:00:00Z'},
      {id:PR2,nombre:'Suplemento proteico',tipo:'producto',precio:1800,costo:900,stock:10,stock_minimo:2,activo:true,created_at:'2026-01-01T00:00:00Z'},
    ],
    facturas:[{id:F1,numero_factura:'FAC-0001',paciente_id:P1,paciente_nombre:'Ana Pérez',fecha:d(-3),estado:'parcial',subtotal:4300,descuento:300,impuestos:0,total:4000,total_pagado:1000,saldo:3000,created_at:new Date(Date.now()-3*864e5).toISOString()}],
    factura_detalles:[{id:uuid(),factura_id:F1,producto_servicio_id:PR1,descripcion:'Consulta nutricional',cantidad:1,precio_unitario:2500,descuento:300,subtotal:2200,created_at:new Date(Date.now()-3*864e5).toISOString()},{id:uuid(),factura_id:F1,producto_servicio_id:PR2,descripcion:'Suplemento proteico',cantidad:1,precio_unitario:1800,descuento:0,subtotal:1800,created_at:new Date(Date.now()-3*864e5).toISOString()}],
    pagos:[{id:uuid(),factura_id:F1,monto:1000,monto_aplicado:1000,monto_recibido:1000,metodo_pago:'efectivo',fecha_pago:new Date(Date.now()-2*864e5).toISOString(),created_at:new Date(Date.now()-2*864e5).toISOString()}],
    movimientos_inventario:[],clientes:[],gastos:[{id:uuid(),fecha:d(-1),descripcion:'Material de oficina',categoria:'Operativo',monto:500,metodo_pago:'efectivo',estado:'activo',created_at:new Date(Date.now()-864e5).toISOString()}],
    cierres_caja:[],cotizaciones:[],configuracion_facturacion:[],saldos_favor:[],movimientos_saldo_favor:[],deudas_clinica:[],pagos_deuda_clinica:[],
    glp1_catalogo:[{id:G1,nombre:'Semaglutida',presentacion:'Pluma 2 mg',descripcion:'',activo:true,mg_por_frasco:2}],
    glp1_tratamientos:[{id:T1,glp1_id:G1,paciente_id:P2,estado:'activo',dosis_indicada_mg:0.25,cantidad_restante_mg:1.5,cantidad_total_mg:2,frecuencia_dias:7,proxima_aplicacion:d(2),creado_en:'2026-10-01T00:00:00Z'}],
    glp1_aplicaciones:[],glp1_movimientos:[],
  };
  const ctl={offline:false,delay:0,failTables:new Set(),failStatus:500,dropResponseAfterCommit:false,dropOnce:false,log:[],tokenTtl:3600,refreshFails:null,authDown:false,maxRows:1000,rls:true,hangAuth:false,failOnce:[]};
  const sessions=new Map(); // refresh -> user
  const userByToken=t=>{const j=parseJwt(t);if(!j)return null;if(j.exp*1000<Date.now())return 'expired';return Object.values(U).find(u=>u.id===j.sub)||null};
  const roleOf=u=>u===U.admin?'admin':u===U.doctor?'doctor':u===U.patient?'patient':'none';
  const ownPatient=u=>db.pacientes.find(p=>p.auth_user_id===u.id)?.id;

  function filterRows(rows,params){
    let out=rows.slice();
    for(const [k,v] of params){
      if(['select','order','limit','offset','on_conflict'].includes(k))continue;
      const m=String(v).match(/^(eq|neq|gt|gte|lt|lte|is)\.(.*)$/);if(!m)continue;
      const [_,op,raw]=m;const val=decodeURIComponent(raw);
      out=out.filter(r=>{const x=r[k];const sx=x==null?null:String(x);
        if(op==='eq')return sx===val||(typeof x==='boolean'&&String(x)===val);
        if(op==='neq')return sx!==val; if(op==='is')return val==='null'?x==null:String(x)===val;
        const a=typeof x==='number'?x:String(x??''),b=typeof x==='number'?Number(val):val;
        return op==='gt'?a>b:op==='gte'?a>=b:op==='lt'?a<b:a<=b});
    }
    return out;
  }
  function order(rows,spec){if(!spec)return rows;const keys=spec.split(',').map(s=>{const [c,dir]=s.split('.');return [c,dir==='desc'?-1:1]});return rows.slice().sort((a,b)=>{for(const [c,d] of keys){const x=a[c]??'',y=b[c]??'';if(x<y)return -d;if(x>y)return d}return 0})}
  function rlsScope(table,rows,u,write=false){
    if(!ctl.rls)return rows;const r=roleOf(u);
    if(r==='admin'||r==='doctor')return rows;
    if(r==='patient'){const pid=ownPatient(u);
      if(table==='pacientes')return rows.filter(x=>x.id===pid);
      if(table==='usuarios')return rows.filter(x=>x.id===u.id);
      if(['evaluaciones','dietas','historias_clinicas','citas','seguimiento_paciente','consentimientos_pacientes','lab_notes','notas_clinicas','glp1_tratamientos'].includes(table))return write?[]:rows.filter(x=>x.paciente_id===pid);
      return [];}
    return [];
  }
  function recalcFactura(fid){const f=db.facturas.find(x=>x.id===fid);if(!f)return;const paid=db.pagos.filter(p=>p.factura_id===fid).reduce((a,p)=>a+Number(p.monto_aplicado??p.monto??0),0);f.total_pagado=Math.round(paid*100)/100;f.saldo=Math.max(0,Math.round((f.total-paid)*100)/100);if(f.estado!=='anulada')f.estado=paid<=0?'pendiente':paid+0.001>=f.total?'pagada':'parcial'}
  function json(status,body,headers={}){return {status,headers:{'content-type':'application/json','access-control-allow-origin':'*',...headers},body:body===undefined?'':JSON.stringify(body)}}

  async function handle(method,url,headers,bodyText){
    const u=new URL(url);const path=u.pathname;
    ctl.log.push({method,path:path+u.search,time:Date.now(),body:bodyText});
    if(method==='OPTIONS')return {status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'},body:''};
    if(ctl.offline)return 'abort';
    if(ctl.delay)await new Promise(r=>setTimeout(r,ctl.delay));
    let body=null;try{body=bodyText?JSON.parse(bodyText):null}catch(_){}
    // ---------- AUTH ----------
    if(path.startsWith('/auth/v1/')){
      if(ctl.hangAuth)return 'hang';
      if(ctl.authDown)return json(503,{message:'Service Unavailable'});
      if(path==='/auth/v1/token'){
        const gt=u.searchParams.get('grant_type');
        if(gt==='password'){const usr=Object.values(U).find(x=>x.email===body.email&&x.password===body.password);if(!usr)return json(400,{error:'invalid_grant',error_description:'Invalid login credentials'});const rt=uuid();sessions.set(rt,usr);return json(200,{access_token:makeJwt(usr,ctl.tokenTtl),refresh_token:rt,expires_in:ctl.tokenTtl,token_type:'bearer',user:{id:usr.id,email:usr.email,user_metadata:usr.user_metadata,app_metadata:usr.app_metadata}})}
        if(gt==='refresh_token'){if(ctl.refreshFails)return json(ctl.refreshFails,{error:'x',error_description:'refresh failed'});const usr=sessions.get(body.refresh_token);if(!usr)return json(400,{error:'invalid_grant',error_description:'Invalid Refresh Token'});sessions.delete(body.refresh_token);const rt=uuid();sessions.set(rt,usr);return json(200,{access_token:makeJwt(usr,ctl.tokenTtl),refresh_token:rt,expires_in:ctl.tokenTtl,user:{id:usr.id,email:usr.email,user_metadata:usr.user_metadata,app_metadata:usr.app_metadata}})}
      }
      const tok=(headers.authorization||'').replace(/^Bearer /,'');const usr=userByToken(tok);
      if(path==='/auth/v1/user'){if(!usr||usr==='expired')return json(401,{message:'invalid JWT'});if(method==='PUT'){Object.assign(usr.user_metadata,body?.data||{});if(body?.password)usr.password=body.password}return json(200,{id:usr.id,email:usr.email,user_metadata:usr.user_metadata,app_metadata:usr.app_metadata})}
      if(path==='/auth/v1/logout')return json(204);
      if(path==='/auth/v1/signup'){const nu={id:uuid(),email:body.email,password:body.password,user_metadata:body.data||{},app_metadata:{}};U['u'+nu.id]=nu;return json(200,{id:nu.id,user:{id:nu.id,email:nu.email},email:nu.email})}
      return json(404,{message:'not found'});
    }
    if(path.startsWith('/functions/v1/'))return json(404,{message:'function not found'});
    // ---------- REST ----------
    const tok=(headers.authorization||'').replace(/^Bearer /,'');const usr=userByToken(tok);
    if(usr==='expired')return json(401,{code:'PGRST301',message:'JWT expired'});
    if(!usr)return json(401,{message:'No API key / JWT'});
    const rest=path.replace('/rest/v1/','');
    const params=[...u.searchParams.entries()];
    const sp=u.searchParams;
    const wantsRep=String(headers.prefer||'').includes('return=representation');
    // RPC
    if(rest.startsWith('rpc/')){
      const fn=rest.slice(4);
      if(fn==='nm_registrar_pago_con_saldo'){
        if(roleOf(usr)==='patient')return json(403,{code:'42501',message:'permission denied for function'});
        const f=db.facturas.find(x=>x.id===body.p_factura_id);if(!f)return json(400,{message:'factura no existe'});
        const rem=Math.max(0,f.total-f.total_pagado);const cash=Number(body.p_monto_recibido||0);const applied=Math.min(cash,rem);
        const pid=uuid();const ts=nowIso();db.pagos.push({id:pid,factura_id:f.id,monto:applied,monto_aplicado:applied,monto_recibido:cash,saldo_favor_generado:Math.max(0,cash-applied),saldo_favor_usado:0,metodo_pago:body.p_metodo_pago,referencia:body.p_referencia,fecha_pago:ts,created_at:ts});recalcFactura(f.id);
        const res={pago_recibido_id:pid,monto_aplicado_efectivo:applied,saldo_favor_usado:0,saldo_favor_generado:Math.max(0,cash-applied)};
        if(ctl.dropResponseAfterCommit){if(ctl.dropOnce)ctl.dropResponseAfterCommit=false;return 'abort'}
        return json(200,res);
      }
      if(fn==='nm_ajustar_stock_v131'&&ctl.stockRpc){const pr=db.productos_servicios.find(x=>x.id===body.p_producto_id);if(!pr)return json(400,{message:'no existe'});if(pr.tipo==='servicio')return json(200,{ok:true});const before=pr.stock;pr.stock+=Number(body.p_delta);db.movimientos_inventario.push({id:uuid(),producto_id:pr.id,tipo:body.p_tipo,cantidad:Math.abs(body.p_delta),stock_anterior:before,stock_nuevo:pr.stock,factura_id:body.p_factura_id,motivo:body.p_motivo,created_at:nowIso()});ctl.stockRpcCalls=(ctl.stockRpcCalls||0)+1;return json(200,{ok:true,stock_anterior:before,stock_nuevo:pr.stock})}
      if(fn==='nm_asignar_localidad_paciente'){const p=db.pacientes.find(x=>x.id===body.p_paciente_id);if(p)p.localidad_id=body.p_localidad_id;return json(200,{ok:true})}
      if(fn==='nm_glp1_registrar_aplicacion'){const t=db.glp1_tratamientos.find(x=>x.id===(body.p_tratamiento_id));if(!t)return json(400,{message:'tratamiento no existe'});const mg=Number(body.p_dosis_mg||t.dosis_indicada_mg||0);if(t.cantidad_restante_mg-mg< -1e-9)return json(400,{message:'stock insuficiente'});t.cantidad_restante_mg=Math.round((t.cantidad_restante_mg-mg)*1000)/1000;const a={id:uuid(),tratamiento_id:t.id,paciente_id:t.paciente_id,fecha_aplicacion:body.p_fecha_aplicacion||nowIso().slice(0,10),dosis_mg:mg,cantidad_consumida_mg:mg,creado_en:nowIso(),created_at:nowIso()};db.glp1_aplicaciones.push(a);if(ctl.dropResponseAfterCommit){if(ctl.dropOnce)ctl.dropResponseAfterCommit=false;return 'abort'}return json(200,a)}
      if(fn==='nm_glp1_agregar_stock'){const t=db.glp1_tratamientos.find(x=>x.id===(body.p_tratamiento_id));if(!t)return json(400,{message:'no existe'});t.cantidad_restante_mg+=Number(body.p_cantidad_mg||0);return json(200,t)}
      return json(404,{code:'PGRST202',message:`Could not find the function public.${fn}`});
    }
    const table=rest.split('?')[0];
    if(ctl.failTables.has(table))return json(ctl.failStatus,{code:'XX000',message:`fallo simulado en ${table}`});
    const fo=ctl.failOnce.findIndex(x=>x.table===table&&x.method===method);if(fo>=0){const x=ctl.failOnce.splice(fo,1)[0];return json(x.status||500,{code:'XX000',message:`fallo simulado en ${method} ${table}`});}
    if(!db[table])return json(404,{code:'42P01',message:`relation "public.${table}" does not exist`});
    let scope=rlsScope(table,db[table],usr,method!=='GET');
    if(method==='GET'){
      let rows=order(filterRows(scope,params),sp.get('order'));
      const off=Number(sp.get('offset')||0);let lim=sp.has('limit')?Number(sp.get('limit')):Infinity;lim=Math.min(lim,ctl.maxRows);
      rows=rows.slice(off,off+lim);
      return json(200,rows);
    }
    if(method==='POST'){
      if(roleOf(usr)==='patient'&&!['consentimientos_pacientes'].includes(table))return json(403,{code:'42501',message:`new row violates row-level security policy for table "${table}"`});
      const arr=Array.isArray(body)?body:[body];const out=[];
      const conflict=sp.get('on_conflict');
      for(const r0 of arr){
        const r={...r0};
        if(table==='facturas'&&db.facturas.some(f=>f.numero_factura===r.numero_factura))return json(409,{code:'23505',message:'duplicate key value violates unique constraint "facturas_numero_factura_key"'});
        if(conflict){const keys=decodeURIComponent(conflict).split(',');const ex=db[table].find(x=>keys.every(k=>String(x[k])===String(r[k])));if(ex){Object.assign(ex,r);out.push(ex);continue}}
        if(!r.id)r.id=uuid();if(!r.created_at)r.created_at=nowIso();if(!r.creado_en)r.creado_en=r.created_at;
        db[table].push(r);out.push(r);
        if(table==='pagos'){if(r.monto_aplicado==null)r.monto_aplicado=r.monto;if(r.monto_recibido==null)r.monto_recibido=r.monto;if(!r.fecha_pago)r.fecha_pago=r.created_at;recalcFactura(r.factura_id)}
      }
      if(ctl.dropResponseAfterCommit){if(ctl.dropOnce)ctl.dropResponseAfterCommit=false;return 'abort'}
      return json(201,wantsRep?out:undefined);
    }
    if(method==='PATCH'){
      if(roleOf(usr)==='patient')return json(wantsRep?200:204,wantsRep?[]:undefined);
      const rows=filterRows(scope,params);rows.forEach(r=>Object.assign(r,body));
      if(table==='pagos')rows.forEach(r=>recalcFactura(r.factura_id));
      if(ctl.dropResponseAfterCommit){if(ctl.dropOnce)ctl.dropResponseAfterCommit=false;return 'abort'}
      return json(200,wantsRep?rows:undefined);
    }
    if(method==='DELETE'){
      if(roleOf(usr)==='patient')return json(200,[]);
      const rows=filterRows(scope,params);db[table]=db[table].filter(r=>!rows.includes(r));
      return json(200,wantsRep?rows:undefined);
    }
    return json(405,{message:'method'});
  }
  return {db,ctl,U,ids:{P1,P2,P3,LOC,PR1,PR2,F1,G1,T1},handle,makeJwt};
}
module.exports={createMock};
