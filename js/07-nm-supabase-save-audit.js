(function(){
  const TABLES=['pacientes','evaluaciones','historias_clinicas','dietas','citas','productos_servicios','facturas','factura_detalles','pagos','movimientos_inventario'];
  window.nmSupabaseSaveAudit = async function(showOk=true){
    const failures=[];
    for(const table of TABLES){
      try{
        await supa(table + '?select=*&limit=1','GET');
      }catch(e){ failures.push({table,error:e.message||String(e)}); }
    }
    if(failures.length){
      console.table(failures);
      notify?.('Supabase: ' + failures.length + ' módulo(s) sin acceso. Revisa consola/RLS.','danger');
      return {ok:false,failures};
    }
    if(showOk) notify?.('Supabase conectado: módulos principales accesibles ✓','success');
    return {ok:true,failures:[]};
  };
  window.addEventListener('online',()=>{ if(typeof currentAuthUserId==='function' && currentAuthUserId()) nmSupabaseSaveAudit(false); });
})();
