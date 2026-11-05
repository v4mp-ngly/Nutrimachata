(function(){
  let banner=null;
  function showOffline(){
    if(banner&&document.body.contains(banner))return;
    banner=document.createElement('div');
    banner.id='nm-offline-banner';
    banner.textContent='Sin conexión. NutriMachata conservará la pantalla actual y volverá a sincronizar cuando regrese Internet.';
    banner.style.cssText='position:fixed;left:50%;transform:translateX(-50%);bottom:18px;z-index:999999;background:#5b2b2b;color:#fff;padding:11px 18px;border-radius:12px;font:600 13px Montserrat,Arial,sans-serif;box-shadow:0 8px 28px #0003;max-width:min(92vw,720px);text-align:center';
    document.body.appendChild(banner);
  }
  function hideOffline(){if(banner){banner.remove();banner=null;} if(typeof restoreSupaSession==='function')restoreSupaSession();}
  window.addEventListener('offline',showOffline);
  window.addEventListener('online',()=>{hideOffline();setTimeout(()=>{try{if(document.querySelector('.bill-tabs')&&typeof window.renderBilling==='function')window.renderBilling();}catch(_){}},350);});
  if(typeof navigator!=='undefined'&&!navigator.onLine)setTimeout(showOffline,0);
  // Evita ruido de promesas de red no controladas en módulos tardíos; no oculta errores reales.
  window.addEventListener('unhandledrejection',ev=>{
    const m=String(ev.reason?.message||ev.reason||'');
    if(/Failed to fetch|NetworkError|Internet|ERR_INTERNET|ERR_NAME_NOT_RESOLVED/i.test(m)){showOffline();}
  });
  window.NMSupabaseStabilityV41={showOffline,hideOffline};
})();
