(function(){
'use strict';
function decorateRecord120(p,tab){
 const root=document.getElementById('page-content'); if(!root||!p)return;
 root.classList.add('nm120-record-shell');
 const children=[...root.children];
 const top=children.find(el=>el.tagName==='DIV'&&el.querySelector('button[onclick*="_hcOriginPage"]'));
 if(top){top.className='nm120-record-top';const back=top.querySelector('button[onclick*="_hcOriginPage"]');if(back){back.className='nm120-record-back';back.innerHTML='← <span>Volver al directorio</span>'}const acts=top.querySelector('div');if(acts)acts.className='nm120-record-actions'}
 const hero=[...root.children].find(el=>el.tagName==='DIV'&&String(el.getAttribute('style')||'').includes('linear-gradient')&&el.textContent.includes(p.nombre));
 if(hero){
   hero.className='nm120-identity'; hero.removeAttribute('style');
   const evals=p.evaluaciones||[], last=evals.length?evals[evals.length-1]:null;
   const imc=Number(p.imc)>0?Number(p.imc).toFixed(1):'—'; const peso=Number(p.peso)>0?Number(p.peso).toFixed(1):'—';
   hero.innerHTML=`<div class="nm120-identity-main"><div class="nm120-person"><div class="nm120-avatar">${p.initials||'P'}</div><div style="min-width:0"><h1>${p.nombre||'Paciente'}</h1><div class="nm120-person-meta"><span>${p.edad||'—'} años</span><i></i><span>${typeof formatPatientSex==='function'?formatPatientSex(p.sexo):(p.sexo||'—')}</span>${p.cedula?`<i></i><span>${p.cedula}</span>`:''}</div><div class="nm120-tags"><span class="nm120-tag status">${p.activo!==false?'● Paciente activo':'Paciente inactivo'}</span><span class="nm120-tag">${p.estado||'Sin clasificación'}</span>${p.objetivo?`<span class="nm120-tag">Objetivo: ${String(p.objetivo).slice(0,36)}</span>`:''}</div></div></div><div class="nm120-metrics"><div class="nm120-metric"><span>Peso actual</span><strong>${peso}</strong><small>${peso==='—'?'Sin evaluación':'kg'}</small></div><div class="nm120-metric"><span>IMC actual</span><strong>${imc}</strong><small>${p.estado||'Sin clasificar'}</small></div><div class="nm120-metric"><span>Seguimiento</span><strong>${evals.length}</strong><small>${last?.fecha?'Última '+last.fecha:'Sin evaluaciones'}</small></div></div></div>`;
 }
 const tabs=[...root.children].find(el=>el.tagName==='DIV'&&el.querySelector('[id^="hc-tab-btn-"]'));
 if(tabs){tabs.className='nm120-tabs';tabs.removeAttribute('style');tabs.querySelectorAll('button').forEach(b=>{b.removeAttribute('style');b.classList.toggle('nm120-active',b.id===`hc-tab-btn-${tab||'resumen'}`)})}
}
const oldOpen120=window.openHistoriaClinica;
window.openHistoriaClinica=function(patientId,activeTab){const r=oldOpen120.apply(this,arguments);try{const p=(DB.patients||[]).find(x=>x.id==patientId);decorateRecord120(p,activeTab||'resumen')}catch(e){console.warn('[v120 expediente]',e)}return r};
try{openHistoriaClinica=window.openHistoriaClinica}catch(_){ }
const oldSwitch120=window.switchHCTabPage;
if(typeof oldSwitch120==='function') window.switchHCTabPage=function(tab,id){const r=oldSwitch120.apply(this,arguments);setTimeout(()=>{const p=(DB.patients||[]).find(x=>x.id==id);decorateRecord120(p,tab)},0);return r};
try{switchHCTabPage=window.switchHCTabPage}catch(_){ }
const oldHist120=window.renderHistorias;
window.renderHistorias=function(){const r=oldHist120.apply(this,arguments);const root=document.getElementById('page-content');if(!root)return r;const search=document.getElementById('hc-search');const filter=document.getElementById('hc-filter-status');const list=document.getElementById('historias-list');if(!search||!list)return r;const toolbar=search.closest('.card');const listCard=list.closest('.card');if(toolbar){toolbar.className='nm120-hc-toolbar';toolbar.removeAttribute('style');const row=toolbar.querySelector('.flex');if(row){row.style.display='contents';row.classList.remove('flex','items-center','gap-3')}}if(listCard){listCard.className='nm120-hc-list';const head=listCard.querySelector('.card-header');if(head)head.className='nm120-hc-list-head'}root.classList.add('nm120-hc-page');const intro=document.createElement('div');intro.className='nm120-hc-intro';intro.innerHTML='<div><h2>Expedientes clínicos</h2><p>Consulta historias, evolución y estado clínico desde un solo lugar.</p></div>';root.insertBefore(intro,root.firstChild);return r};
try{renderHistorias=window.renderHistorias}catch(_){ }
})();
