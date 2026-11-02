(function(){
'use strict';
let scheduled=false;
function enhance(){
  if(scheduled)return; scheduled=true;
  setTimeout(()=>{scheduled=false;try{window.NMEnsureExpensesV30?.()}catch(e){};try{document.querySelector('.bill-tabs')&&window.NMBillingTabStateV29}catch(e){}},0);
}
document.addEventListener('click',e=>{if(e.target.closest?.('[data-nav="billing"]'))enhance()});
window.NMBillingStableV51=true;
})();
