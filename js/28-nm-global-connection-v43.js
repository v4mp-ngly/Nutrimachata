(function(){
'use strict';
let reconnectTimer=null;
function retryCurrentView(){
  clearTimeout(reconnectTimer);
  reconnectTimer=setTimeout(async()=>{
    if(!navigator.onLine)return;
    try{
      restoreSupaSession?.();
      if(SUPA_AUTH_SESSION?.access_token && supaSessionExpiresSoon?.(30)) await refreshSupaSession(true);
      // Rehidrata datos globales sin recargar la página completa.
      if(typeof loadAllData==='function') await loadAllData();
      else {
        try{ if(typeof loadPatients==='function') await loadPatients(); }catch(_){}
        try{ if(typeof loadAppointments==='function') await loadAppointments(); }catch(_){}
      }
      if(document.querySelector('.bill-tabs') && typeof window.renderBilling==='function') window.renderBilling();
      window.NMSupabaseStabilityV41?.hideOffline?.();
      notify?.('Conexión restablecida. Datos sincronizados.','success');
    }catch(e){ console.warn('[NutriMachata] Reintento de sincronización pendiente:',e?.message||e); }
  },700);
}
window.addEventListener('online',retryCurrentView);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&navigator.onLine)retryCurrentView();});
window.NMConnectionV43={retry:retryCurrentView};
})();
