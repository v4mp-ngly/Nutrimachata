(function(){
'use strict';
const oldRenderPatients=window.renderPatients;
window.renderPatients=function(){
  const r=oldRenderPatients?.apply(this,arguments);
  const page=document.querySelector('.patients-page');
  if(!page)return r;
  const actions=page.querySelector('.patients-actions');
  if(actions&&!actions.querySelector('.nm-v117-patient-intro')){
    const intro=document.createElement('div'); intro.className='nm-v117-patient-intro';
    intro.innerHTML='<div style="font-size:10px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:#6e8e62;margin-bottom:6px">Gestión clínica</div><div style="font-size:25px;line-height:1.15;font-weight:700;color:#20261f">Tu población, en una vista más clara.</div><div style="font-size:13px;color:#8a9186;margin-top:6px">Busca, revisa y entra al expediente sin perder contexto.</div>';
    actions.style.justifyContent='space-between'; actions.insertBefore(intro,actions.firstChild);
  }
  return r;
};
try{renderPatients=window.renderPatients}catch(_){ }

const oldOpenHC=window.openHistoriaClinica;
window.openHistoriaClinica=function(patientId,activeTab){
  const r=oldOpenHC?.apply(this,arguments);
  setTimeout(()=>{
    const root=document.getElementById('page-content'); if(!root)return;
    const first=root.firstElementChild; if(!first||first.classList.contains('nm-hc-shell'))return;
    first.classList.add('nm-hc-top');
    const hero=[...root.children].find(el=>String(el.getAttribute('style')||'').includes('linear-gradient(135deg,var(--olive-dark)'));
    if(hero)hero.classList.add('nm-hc-hero');
    const tabs=[...root.children].find(el=>String(el.getAttribute('style')||'').includes('overflow-x:auto')&&el.querySelector('[id^="hc-tab-btn-"]'));
    if(tabs)tabs.classList.add('nm-hc-tabs');
    root.classList.add('nm-hc-shell');
  },0);
  return r;
};
try{openHistoriaClinica=window.openHistoriaClinica}catch(_){ }
window.NMV117PatientsPremium=true;
})();
