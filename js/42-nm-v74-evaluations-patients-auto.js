(function(){
'use strict';
window.NMEvaluationsV74=true;
const E=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
let loading=null;
async function refreshEvaluationData74(){
 try { await ensureSupaSession(); } catch(_) { return DB.patients||[]; }
 if(loading)return loading;
 loading=(async()=>{
  try{
   const [pacs,evals]=await Promise.all([
    SB.getPacientes(),
    (typeof supaFetchAll==='function'?supaFetchAll('evaluaciones?order=fecha.asc&select=*'):Promise.resolve([]))
   ]);
   if(!Array.isArray(pacs))return DB.patients||[];
   const old=Array.isArray(DB.patients)?DB.patients:[];
   const allEvals=Array.isArray(evals)?evals:[];
   DB.patients=pacs.map(row=>{
    const prev=old.find(x=>String(x.id)===String(row.id));
    const pe=allEvals.filter(x=>String(x.paciente_id)===String(row.id));
    return mapPaciente(row,pe,prev?.dietas||prev?.diets||[],prev?.historiaClinica||null);
   });
   document.dispatchEvent(new CustomEvent('nm:patients-updated',{detail:{action:'evaluations-refresh',patients:DB.patients}}));
  }catch(e){console.warn('[Evaluaciones v74] No se pudo sincronizar:',e)}
  finally{loading=null}
  return DB.patients||[];
 })();
 return loading;
}
window.refreshEvaluationData74=refreshEvaluationData74;

// Corrige también el refresco general: antes podía perder evaluaciones por usar old.evaluations.
window.refreshPatientsFromSupabase=async function(options={}){
 try{
  try { await ensureSupaSession(); } catch(_) { return DB.patients||[]; }
  const pacs=await SB.getPacientes();
  if(!Array.isArray(pacs))return DB.patients||[];
  const old=Array.isArray(DB.patients)?DB.patients:[];
  DB.patients=pacs.map(row=>{const prev=old.find(x=>String(x.id)===String(row.id));return mapPaciente(row,prev?.evaluaciones||prev?.evaluations||[],prev?.dietas||prev?.diets||[],prev?.historiaClinica||null)});
  if(options.render!==false&&String(currentPage||'')==='patients')renderPatients();
  document.dispatchEvent(new CustomEvent('nm:patients-updated',{detail:{action:'refresh',patients:DB.patients}}));
  return DB.patients;
 }catch(e){console.warn('[Pacientes v74] refresco:',e);return DB.patients||[]}
};

const baseRender=window.renderEvaluations||renderEvaluations;
let renderToken=0;
window.renderEvaluations=function(){
 const token=++renderToken,host=document.getElementById('page-content');
 if(host)host.innerHTML='<div class="card"><div class="card-body" style="padding:34px;text-align:center"><div style="font-weight:700;color:var(--olive-dark)">Cargando evaluaciones…</div><div class="text-sm text-muted" style="margin-top:6px">Sincronizando pacientes con Supabase</div></div></div>';
 refreshEvaluationData74().then(()=>{if(token!==renderToken||String(currentPage||'')!=='evaluations')return;baseRender();});
};
try{renderEvaluations=window.renderEvaluations}catch(_){ }

const baseOpen=window.openEvalModal||openEvalModal;
function patientText74(p){return [p.nombre,p.cedula,p.telefono,p.email].filter(Boolean).join(' ')}
window.filterEvalPatients74=function(){
 const q=String(document.getElementById('eval-patient-search74')?.value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const box=document.getElementById('eval-patient-results74');if(!box)return;
 const rows=(DB.patients||[]).filter(p=>!q||patientText74(p).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(q)).slice(0,40);
 box.innerHTML=rows.length?rows.map(p=>`<button type="button" class="nm-eval-patient-option" onclick="selectEvalPatient74('${E(p.id)}')"><span class="patient-avatar" style="background:${E(p.color||'#5E8C2A')}">${E(p.initials||String(p.nombre||'P').split(/\s+/).map(x=>x[0]).slice(0,2).join(''))}</span><span><b>${E(p.nombre||'Paciente')}</b><small>${E([p.cedula,p.telefono,p.email].filter(Boolean).join(' · ')||'Paciente registrado')}</small></span></button>`).join(''):'<div style="padding:16px;text-align:center;color:var(--gray-400);font-size:12px">No se encontraron pacientes.</div>';
};
window.selectEvalPatient74=function(id){
 const p=(DB.patients||[]).find(x=>String(x.id)===String(id));if(!p)return;
 const hidden=document.getElementById('eval-patient-select');if(hidden)hidden.value=p.id;
 const input=document.getElementById('eval-patient-search74');if(input)input.value=p.nombre||'';
 const results=document.getElementById('eval-patient-results74');if(results)results.style.display='none';
 const chosen=document.getElementById('eval-patient-selected74');if(chosen){chosen.style.display='flex';chosen.innerHTML=`<span><small style="display:block;color:var(--gray-400)">PACIENTE SELECCIONADO</small><b>${E(p.nombre)}</b></span><button type="button" class="btn btn-outline btn-sm" onclick="clearEvalPatient74()">Cambiar</button>`}
 const title=document.getElementById('eval-patient-name');if(title)title.textContent=p.nombre||'Paciente';
 const peso=document.getElementById('eval-peso');if(peso&&!peso.value&&p.peso)peso.value=p.peso;
 const talla=document.getElementById('eval-talla-cm');if(talla&&!talla.value&&p.talla)talla.value=Math.round(Number(p.talla)*100);
 const pa=document.getElementById('eval-presion');if(pa&&!pa.value&&p.presion)pa.value=p.presion;
 try{calcEvalIMC()}catch(_){ }
};
window.clearEvalPatient74=function(){const h=document.getElementById('eval-patient-select');if(h)h.value='';const i=document.getElementById('eval-patient-search74');if(i){i.value='';i.focus()}const c=document.getElementById('eval-patient-selected74');if(c)c.style.display='none';const r=document.getElementById('eval-patient-results74');if(r){r.style.display='block';filterEvalPatients74()}const t=document.getElementById('eval-patient-name');if(t)t.textContent='Seleccione paciente'};
window.openEvalModal=async function(patientId){
 await refreshEvaluationData74();
 baseOpen(patientId);
 if(patientId!==null&&patientId!==undefined&&String(patientId).trim()!=='')return;
 setTimeout(()=>{
  const oldInput=document.getElementById('eval-patient-search');if(!oldInput)return;
  const group=oldInput.closest('.form-group');if(!group)return;
  group.innerHTML=`<label>Paciente *</label><div class="nm-eval-patient-picker"><input class="form-control" id="eval-patient-search74" autocomplete="off" placeholder="Buscar por nombre, cédula, teléfono o correo…" oninput="document.getElementById('eval-patient-results74').style.display='block';filterEvalPatients74()" onfocus="document.getElementById('eval-patient-results74').style.display='block';filterEvalPatients74()"><input type="hidden" id="eval-patient-select" value=""><div id="eval-patient-selected74" class="nm-eval-selected" style="display:none"></div><div id="eval-patient-results74" class="nm-eval-patient-results"></div></div>`;
  filterEvalPatients74();
 },0);
};
try{openEvalModal=window.openEvalModal}catch(_){ }
})();
