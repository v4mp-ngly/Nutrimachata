(function(){
'use strict';
function ensureExpensesUI(){
  const tabs=document.querySelector('.bill-tabs');
  if(tabs&&!tabs.querySelector('[data-btab="expenses"]')){
    const b=document.createElement('button');
    b.className='bill-tab'; b.dataset.btab='expenses'; b.type='button'; b.textContent='Gastos';
    b.addEventListener('click',()=>{ if(window.NMBillingTabStateV29) window.NMBillingTabStateV29.set('expenses'); if(typeof window.renderBillingTab==='function') window.renderBillingTab('expenses',b); else if(typeof window.renderExpenses==='function') window.renderExpenses(); });
    tabs.appendChild(b);
  }
  const quick=document.querySelector('.bill-quick');
  if(quick&&!quick.querySelector('[data-expense-link]')){
    const a=document.createElement('a'); a.dataset.expenseLink='1'; a.href='javascript:void(0)'; a.innerHTML='<span>＋ Añadir gasto</span><b>›</b>';
    a.addEventListener('click',()=>{ if(window.NMBillingTabStateV29) window.NMBillingTabStateV29.set('expenses'); if(typeof window.renderBillingTab==='function') window.renderBillingTab('expenses'); setTimeout(()=>window.openExpenseModal&&window.openExpenseModal(),80); });
    quick.appendChild(a);
  }
}
// v51: sin MutationObserver global; evitamos bucles de renderizado en Facturación.
document.addEventListener('click',e=>{ if(e.target.closest?.('[data-nav="billing"], [onclick*="billing"]')) setTimeout(ensureExpensesUI,0); });
// v51: sin polling cada 500 ms.
window.NMEnsureExpensesV30=ensureExpensesUI;
ensureExpensesUI();
})();
