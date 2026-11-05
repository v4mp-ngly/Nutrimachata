(function(){
'use strict';
function fixBillingTabs95(){
  const tabs=document.querySelector('.bill-tabs');
  if(!tabs)return;
  const bal=tabs.querySelector('[data-btab="balances"]');
  if(bal){bal.textContent='Saldos a favor';bal.onclick=()=>window.renderBillingTab('balances',bal);}
  if(!tabs.querySelector('[data-btab="debts93"]')){
    const b=document.createElement('button'); b.className='bill-tab'; b.type='button'; b.dataset.btab='debts93'; b.textContent='Deudas';
    b.onclick=()=>window.renderBillingTab('debts93',b); bal?bal.insertAdjacentElement('afterend',b):tabs.insertBefore(b,tabs.firstChild);
  }
}
const rb95=window.renderBilling;
window.renderBilling=function(){
  const r=rb95?.apply(this,arguments);
  [0,60,250].forEach(ms=>setTimeout(fixBillingTabs95,ms));
  return r;
};
try{renderBilling=window.renderBilling}catch(_){}
const rt95=window.renderBillingTab;
window.renderBillingTab=function(tab,btn){
  if(tab==='balances' && typeof window.renderBalances92==='function') return window.renderBalances92();
  if(tab==='debts93' && typeof window.renderDebts93==='function') return window.renderDebts93();
  return rt95?.apply(this,arguments);
};
try{renderBillingTab=window.renderBillingTab}catch(_){}
setTimeout(fixBillingTabs95,0);
window.NMV95IntegralFixes=true;
})();
