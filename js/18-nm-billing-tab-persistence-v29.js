(function(){
'use strict';
let activeBillingTab='invoices';
let restoring=false;
const prevTab=window.renderBillingTab;
const prevBilling=window.renderBilling;

window.renderBillingTab=function(tab,btn){
  activeBillingTab=tab||'invoices';
  return prevTab.apply(this,arguments);
};

function restoreActiveBillingTab(){
  if(restoring||activeBillingTab==='invoices') return;
  const content=document.getElementById('billing-tab-content');
  if(!content) return;
  restoring=true;
  try{
    const btn=document.querySelector(`[data-btab="${activeBillingTab}"]`);
    window.renderBillingTab(activeBillingTab,btn||null);
  } finally {
    setTimeout(()=>{restoring=false},0);
  }
}

window.renderBilling=function(){
  const keep=activeBillingTab;
  const result=prevBilling.apply(this,arguments);
  activeBillingTab=keep;
  if(keep!=='invoices'){
    setTimeout(restoreActiveBillingTab,0);
    setTimeout(restoreActiveBillingTab,80);
    setTimeout(restoreActiveBillingTab,250);
  }
  return result;
};

// Restauracion por MutationObserver eliminada: podia provocar ciclos de renderizado.
window.NMBillingTabStateV29={get:()=>activeBillingTab,set:v=>{activeBillingTab=v||'invoices'}};
})();
