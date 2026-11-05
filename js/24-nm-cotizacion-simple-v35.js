(function(){
'use strict';
const oldOpen=window.openQuoteModal;
function esc35(v){return String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));}
function productOptions35(){
  const src=(typeof getBillingData==='function'?(getBillingData().inventory||[]):[]);
  return src.map(x=>({name:x.name||x.nombre||x.description||x.descripcion||'Producto / servicio',price:Number(x.price??x.precio??x.precio_venta??0)}));
}
function enhanceQuote35(){
 const m=document.getElementById('quote-modal'); if(!m)return;
 m.querySelector('.modal')?.setAttribute('style','max-width:980px');
 const status=document.getElementById('q-status'); if(status){status.closest('.form-group').style.display='none'; if(!status.value)status.value='Borrador';}
 const lines=document.getElementById('quote-lines'); if(!lines)return;
 const products=productOptions35();
 const style=document.createElement('style');style.textContent=`
 #quote-modal .q-simple-head{display:grid;grid-template-columns:minmax(250px,1fr) 90px 150px 120px 44px;gap:8px;padding:0 4px 7px;color:#697165;font-size:11px;font-weight:800;text-transform:uppercase} 
 #quote-modal #quote-lines .invoice-line{display:grid!important;grid-template-columns:minmax(250px,1fr) 90px 150px 120px 44px!important;gap:8px!important;align-items:center;margin-bottom:8px} 
 #quote-modal .q-disc{display:none!important} #quote-modal .q-simple-total{font-weight:800;text-align:right;padding:0 10px} 
 #quote-modal .q-advanced{border:1px solid #e1e7dc;border-radius:12px;padding:12px 14px;margin-top:12px;background:#fafcf8} 
 #quote-modal .q-advanced summary{cursor:pointer;font-weight:750;color:#466b2c} 
 #quote-modal .q-help{font-size:12px;color:#747d70;margin-top:5px} 
 @media(max-width:760px){#quote-modal .q-simple-head{display:none}#quote-modal #quote-lines .invoice-line{grid-template-columns:1fr 75px 120px 42px!important;border:1px solid #e4e9df;border-radius:12px;padding:10px}.q-simple-total{display:none}#quote-modal .q-desc{grid-column:1/-1}}`;
 m.appendChild(style);
 lines.insertAdjacentHTML('beforebegin','<div class="q-simple-head"><span>Producto / servicio</span><span>Cant.</span><span>Precio</span><span>Total</span><span></span></div>');
 function rowEnhance(r){
   const desc=r.querySelector('.q-desc'),qty=r.querySelector('.q-qty'),price=r.querySelector('.q-price'); if(!desc||r.dataset.simple35)return; r.dataset.simple35='1';
   desc.setAttribute('list','q-products-35'); desc.placeholder='Buscar o escribir producto / servicio'; qty.title='Cantidad'; price.title='Precio unitario';
   const total=document.createElement('div');total.className='q-simple-total';r.insertBefore(total,r.lastElementChild);
   const calc=()=>{const v=Number(qty.value||0)*Number(price.value||0);total.textContent=(typeof moneyRD==='function'?moneyRD(v):'RD$ '+v.toLocaleString('es-DO',{minimumFractionDigits:2}));};
   desc.addEventListener('change',()=>{const hit=products.find(x=>x.name.toLowerCase()===desc.value.trim().toLowerCase());if(hit&&hit.price>=0){price.value=hit.price;price.dispatchEvent(new Event('input',{bubbles:true}));}calc();});qty.addEventListener('input',calc);price.addEventListener('input',calc);calc();
 }
 lines.querySelectorAll('.invoice-line').forEach(rowEnhance);
 const dl=document.createElement('datalist');dl.id='q-products-35';dl.innerHTML=products.map(x=>`<option value="${esc35(x.name)}">${x.price?('RD$ '+x.price.toLocaleString('es-DO')):''}</option>`).join('');m.appendChild(dl);
 new MutationObserver(()=>lines.querySelectorAll('.invoice-line').forEach(rowEnhance)).observe(lines,{childList:true});
 const gd=document.getElementById('q-discount')?.closest('.form-row'); if(gd){gd.classList.add('q-advanced');const wrap=document.createElement('details');wrap.className='q-advanced';wrap.innerHTML='<summary>Opciones adicionales</summary><div class="q-help">Usa descuento, ITBIS o notas solo cuando lo necesites.</div>';gd.parentNode.insertBefore(wrap,gd);wrap.appendChild(gd);gd.classList.remove('q-advanced');}
 const footer=m.querySelector('.modal-footer');if(footer){const save=footer.querySelector('.btn-olive');if(save)save.textContent='Guardar cotización';const pdf=document.createElement('button');pdf.className='btn btn-outline';pdf.type='button';pdf.textContent='Guardar y generar PDF';pdf.onclick=async()=>{const before=[...document.querySelectorAll('.modal-overlay')];await window.saveQuote();setTimeout(async()=>{try{if(typeof window.renderQuotes==='function')await window.renderQuotes();const rows=[...document.querySelectorAll('#billing-tab-content tbody tr')];const first=rows[0]?.querySelector('button[title="PDF"]');if(first)first.click();}catch(e){}},700)};footer.insertBefore(pdf,save);}}
window.openQuoteModal=function(){oldOpen.apply(this,arguments);setTimeout(enhanceQuote35,0)};
})();
