(function(){
'use strict';
const clean=s=>String(s||'').trim();
const role=()=>String(window.DB?.currentRole||window.DB?.currentUser?.rol||window.DB?.currentUser?.role||'').toLowerCase();
const isAdmin=()=>role()==='admin';
function msg(t,type='success'){ if(typeof window.notify==='function') window.notify(t,type); else alert(t); }
async function ownEmail(){
  const e=clean(window.DB?.currentUser?.email); if(e) return e;
  const token=window.supaAccessToken?.(); if(!token) throw new Error('No hay una sesión activa.');
  const r=await fetch(SUPA_URL.replace(/\/$/,'')+'/auth/v1/user',{headers:{apikey:SUPA_ANON,Authorization:'Bearer '+token}});
  const j=await r.json().catch(()=>({})); if(!r.ok) throw new Error(j?.message||'No se pudo identificar la cuenta actual.'); return clean(j.email);
}
async function changeOwnPassword(btn){
  const cur=document.getElementById('nm111-current-password')?.value||'', np=document.getElementById('nm111-new-password')?.value||'', cp=document.getElementById('nm111-confirm-password')?.value||'';
  if(!cur) return msg('Escribe tu contraseña actual.','error');
  if(np.length<8) return msg('La nueva contraseña debe tener al menos 8 caracteres.','error');
  if(np!==cp) return msg('Las nuevas contraseñas no coinciden.','error');
  const old=btn?.textContent; if(btn){btn.disabled=true;btn.textContent='Actualizando…';}
  try{
    const email=await ownEmail();
    await supaAuthLogin(email,cur); // verifica contraseña actual y renueva la sesión
    const token=supaAccessToken();
    const r=await fetch(SUPA_URL.replace(/\/$/,'')+'/auth/v1/user',{method:'PUT',headers:{apikey:SUPA_ANON,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({password:np})});
    const j=await r.json().catch(()=>({})); if(!r.ok) throw new Error(j?.msg||j?.message||j?.error_description||'No se pudo actualizar la contraseña.');
    ['nm111-current-password','nm111-new-password','nm111-confirm-password'].forEach(id=>{const x=document.getElementById(id);if(x)x.value='';});
    msg('Contraseña actualizada correctamente.','success');
  }catch(e){console.error('[Seguridad v112] Cambiar contraseña propia',e);msg(e.message||'No se pudo actualizar la contraseña.','error');}
  finally{if(btn){btn.disabled=false;btn.textContent=old||'Actualizar mi contraseña';}}
}
let NM111_USERS=[];
function esc111(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function searchUsers(q=''){
  const box=document.getElementById('nm111-user-results'), input=document.getElementById('nm111-user-search'), hidden=document.getElementById('nm111-target-user');
  if(!box||!input||!hidden)return;
  const term=clean(q).toLowerCase();
  if(input.dataset.selectedLabel && input.value!==input.dataset.selectedLabel){hidden.value='';delete input.dataset.selectedLabel;}
  const list=NM111_USERS.filter(u=>!term||[u.nombre,u.email,u.rol].some(v=>String(v||'').toLowerCase().includes(term))).slice(0,30);
  box.innerHTML=list.length?list.map(u=>`<button type="button" data-nm111-user="${esc111(u.id)}" style="width:100%;border:0;background:transparent;text-align:left;padding:10px 12px;border-radius:10px;cursor:pointer" onmouseenter="this.style.background='#f4f8f0'" onmouseleave="this.style.background='transparent'" onclick="NM111.selectUser('${esc111(u.id)}')"><b>${esc111(u.nombre||u.email)}</b><div style="font-size:12px;color:#7b8077;margin-top:2px">${esc111(u.email)} · ${esc111(u.rol||'usuario')}</div></button>`).join(''):'<div style="padding:12px;color:#8b8f87">No se encontraron usuarios.</div>';
  box.style.display='block';
}
function selectUser(id){
  const u=NM111_USERS.find(x=>String(x.id)===String(id)), input=document.getElementById('nm111-user-search'), hidden=document.getElementById('nm111-target-user'), box=document.getElementById('nm111-user-results');
  if(!u||!input||!hidden)return;
  hidden.value=u.id;
  const label=`${u.nombre||u.email} · ${u.email}`;
  input.value=label;input.dataset.selectedLabel=label;
  if(box)box.style.display='none';
}
async function loadAdminUsers(){
  const panel=document.getElementById('nm111-admin-password-panel'); if(!panel)return;
  panel.style.display=isAdmin()?'block':'none'; if(!isAdmin())return;
  const input=document.getElementById('nm111-user-search');
  try{
    const rows=await supa('usuarios?select=id,nombre,email,rol,activo&order=nombre.asc');
    NM111_USERS=(Array.isArray(rows)?rows:[]).filter(u=>u?.id&&u?.email);
    if(input) input.placeholder=`Buscar entre ${NM111_USERS.length} usuarios por nombre, correo o rol…`;
  }catch(e){console.error('[Seguridad v112] Cargar usuarios',e);NM111_USERS=[];if(input)input.placeholder='No se pudieron cargar los usuarios';msg('No se pudo cargar la lista de usuarios.','error');}
}
document.addEventListener('click',e=>{const box=document.getElementById('nm111-user-results');if(box&&!e.target.closest('#nm111-admin-password-panel'))box.style.display='none';});
async function adminSetPassword(btn){
  if(!isAdmin()) return msg('Solo un administrador puede realizar esta acción.','error');
  const uid=clean(document.getElementById('nm111-target-user')?.value), np=document.getElementById('nm111-admin-new-password')?.value||'', cp=document.getElementById('nm111-admin-confirm-password')?.value||'';
  if(!uid)return msg('Busca y selecciona un usuario de los resultados.','error'); if(np.length<8)return msg('La nueva contraseña debe tener al menos 8 caracteres.','error'); if(np!==cp)return msg('Las contraseñas no coinciden.','error');
  const token=await ensureSupaSession().then(x=>x?.access_token||supaAccessToken()); if(!token)return msg('Tu sesión ha vencido. Inicia sesión nuevamente.','error');
  const old=btn?.textContent;if(btn){btn.disabled=true;btn.textContent='Actualizando…';}
  try{
    const r=await fetch(SUPA_URL.replace(/\/$/,'')+'/functions/v1/admin-set-password',{method:'POST',headers:{apikey:SUPA_ANON,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({target_user_id:uid,new_password:np})});
    const j=await r.json().catch(()=>({})); if(!r.ok)throw new Error(j?.error||j?.message||'No se pudo cambiar la contraseña.');
    document.getElementById('nm111-admin-new-password').value='';document.getElementById('nm111-admin-confirm-password').value='';msg('Contraseña del usuario actualizada correctamente.','success');
  }catch(e){console.error('[Seguridad v112] Cambio administrativo',e);msg(e.message||'No se pudo cambiar la contraseña.','error');}
  finally{if(btn){btn.disabled=false;btn.textContent=old||'Cambiar contraseña del usuario';}}
}
window.NM111={changeOwnPassword,adminSetPassword,loadAdminUsers,searchUsers,selectUser};
const oldSwitch=window.switchSettingsTab;
window.switchSettingsTab=function(id,el){const r=oldSwitch?.apply(this,arguments);if(id==='seguridad')setTimeout(loadAdminUsers,0);return r;};
})();
