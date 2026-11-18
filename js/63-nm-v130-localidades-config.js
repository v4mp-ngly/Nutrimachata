/* NutriMachata v130.3 - Configuracion Localidades visible y estable
   (v131: extraido a su propio archivo fuente; antes existia solo dentro de app.bundle.js) */
(function(){
'use strict';
const isAdmin=()=>String(window.DB?.currentRole||'').toLowerCase()==='admin';
function ensureLocationsSettings(){
  if(!isAdmin()) return;
  const side=document.querySelector('.settings-sidebar');
  if(!side) return;
  const layout=side.closest('.settings-layout');
  const holder=layout?.querySelector(':scope > div[style*="flex:1"]') || document.getElementById('settings-perfil')?.parentElement;
  if(!holder) return;
  let item=side.querySelector('[data-nm121-localidades]');
  if(!item){
    item=document.createElement('div');
    item.className='settings-nav-item';
    item.dataset.nm121Localidades='1';
    item.innerHTML='<span aria-hidden="true">📍</span> Localidades';
    item.onclick=()=>window.switchSettingsTab?.('localidades',item);
    side.appendChild(item);
  }
  let sec=document.getElementById('settings-localidades');
  if(!sec){
    sec=document.createElement('div');
    sec.id='settings-localidades';
    sec.className='settings-section';
    sec.innerHTML='<div class="settings-header"><h2>Localidades</h2><p>Crea y administra las sedes o ubicaciones disponibles.</p></div><div id="nm121-locations-root"></div>';
    holder.appendChild(sec);
  }
}
const previousRender=window.renderSettings;
window.renderSettings=function(){
  const r=previousRender?.apply(this,arguments);
  setTimeout(ensureLocationsSettings,0);
  setTimeout(ensureLocationsSettings,120);
  return r;
};
try{renderSettings=window.renderSettings}catch(_){ }
const previousSwitch=window.switchSettingsTab;
window.switchSettingsTab=function(id,el){
  ensureLocationsSettings();
  const r=previousSwitch?.apply(this,arguments);
  if(id==='localidades') setTimeout(()=>window.renderLocationsSettings121?.(),0);
  return r;
};
try{switchSettingsTab=window.switchSettingsTab}catch(_){ }
window.NM1303EnsureLocationsSettings=ensureLocationsSettings;
})();
