(function(){
'use strict';
const previousOpenQuote=window.openQuoteModal;
function E(v){return String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));}
function allQuoteParties(){
 const pts=(typeof billingPatients==='function'?billingPatients():[]).map(p=>({type:'patient',id:p.id,name:p.name||p.nombre||'Paciente',rnc:p.rnc||p.cedula||'',phone:p.phone||p.telefono||'',email:p.email||p.correo||''}));
 const cls=(window.NMBillingClients||[]).map(c=>({type:'client',id:c.id,name:[c.nombre,c.apellido].filter(Boolean).join(' ')||'Cliente',rnc:c.cedula_rnc||c.cedula||c.rnc||'',phone:c.telefono||'',email:c.correo||c.email||''}));
 return [...pts,...cls];
}
function selectQuoteParty42(type,id){
 const p=allQuoteParties().find(x=>x.type===type&&String(x.id)===String(id)); if(!p)return;
 const sel=document.getElementById('q-party'); if(sel){let opt=[...sel.options].find(o=>o.value===type+':'+id);if(!opt){opt=new Option(p.name+(p.rnc?' · '+p.rnc:''),type+':'+id);sel.add(opt)}sel.value=type+':'+id;sel.dispatchEvent(new Event('change',{bubbles:true}));}
 const search=document.getElementById('q-party-search-42');if(search)search.value=p.name;
 const results=document.getElementById('q-party-results-42');if(results)results.innerHTML='';
 const chosen=document.getElementById('q-party-selected-42');if(chosen)chosen.innerHTML=`<div style="padding:9px 11px;border:1px solid #dfe8d8;background:#f7faf5;border-radius:10px"><b>${E(p.name)}</b>${p.rnc?`<span style="display:block;font-size:12px;color:#6c7568">RNC / Cédula: ${E(p.rnc)}</span>`:''}</div>`;
}
window.NMQuotePartySearch42=function(){
 const q=(document.getElementById('q-party-search-42')?.value||'').trim().toLowerCase();const box=document.getElementById('q-party-results-42');if(!box)return;
 if(!q){box.innerHTML='';return}
 const hits=allQuoteParties().filter(p=>[p.name,p.rnc,p.phone,p.email].some(v=>String(v||'').toLowerCase().includes(q))).slice(0,12);
 box.innerHTML=hits.length?hits.map(p=>`<button type="button" style="display:block;width:100%;text-align:left;padding:10px 12px;border:0;border-bottom:1px solid #edf0e9;background:#fff;cursor:pointer" onclick="NMSelectQuoteParty42('${p.type}','${E(p.id)}')"><b>${E(p.name)}</b><span style="display:block;font-size:11px;color:#737b70">${p.type==='patient'?'Paciente':'Cliente'}${p.rnc?' · '+E(p.rnc):''}${p.phone?' · '+E(p.phone):''}</span></button>`).join(''):`<div style="padding:12px;color:#6e766b">No encontrado. Puedes añadirlo como cliente.</div>`;
};
window.NMSelectQuoteParty42=selectQuoteParty42;
function enhanceQuoteParty42(){
 const modal=document.getElementById('quote-modal'),sel=document.getElementById('q-party');if(!modal||!sel||modal.querySelector('[data-quote-party-v42]'))return;
 const group=sel.closest('.form-group');if(!group)return;group.dataset.quotePartyV42='1';group.style.position='relative';
 sel.style.display='none';
 const selectedValue=sel.value||'';
 group.insertAdjacentHTML('beforeend',`<div data-quote-party-v42><div style="display:flex;gap:7px"><input id="q-party-search-42" class="form-control" autocomplete="off" placeholder="Buscar nombre, cédula, teléfono o correo..." oninput="NMQuotePartySearch42()"><button type="button" class="btn btn-outline" style="white-space:nowrap" onclick="NMOpenQuoteClient42()">+ Cliente</button></div><div id="q-party-results-42" style="position:absolute;left:0;right:0;top:72px;background:#fff;border:1px solid #dfe5da;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.12);z-index:80;max-height:280px;overflow:auto"></div><div id="q-party-selected-42" style="margin-top:7px"></div></div>`);
 if(selectedValue.includes(':')){const [t,...rest]=selectedValue.split(':');selectQuoteParty42(t,rest.join(':'))}
}
window.NMOpenQuoteClient42=function(){
 const before=new Set([...document.querySelectorAll('.modal-overlay')]);
 if(typeof window.openBillingClientModal!=='function'){window.notify?.('No se pudo abrir el formulario de cliente.','danger');return}
 window.openBillingClientModal();
 setTimeout(()=>{const mods=[...document.querySelectorAll('.modal-overlay')].filter(x=>!before.has(x));const cm=mods.at(-1);if(!cm)return;
   const save=[...cm.querySelectorAll('button')].find(b=>/guardar|crear/i.test(b.textContent||''));if(!save)return;
   save.addEventListener('click',()=>{setTimeout(async()=>{try{await window.NMBillingClientAPI?.loadBillingFromSupabase?.()}catch(e){};setTimeout(()=>{const clients=window.NMBillingClients||[];const newest=clients.at(-1);if(newest)selectQuoteParty42('client',newest.id)},250)},650)},{once:true});
 },50);
};
window.openQuoteModal=function(){const r=previousOpenQuote?.apply(this,arguments);setTimeout(enhanceQuoteParty42,30);return r};
})();
