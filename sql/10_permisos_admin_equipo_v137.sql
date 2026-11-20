-- ============================================================================
-- NutriMachata v137 · 10 · Corrige "new row violates row-level security policy
--                           for table doctor_localidades" al guardar un doctor
-- ----------------------------------------------------------------------------
-- Causa: las reglas de Supabase reconocen al administrador buscando su perfil en
-- public.usuarios por el ID de su cuenta (auth.uid()). Si el perfil del admin no
-- tiene rol 'admin' (p. ej. 'Administrador'), está inactivo o se creó con otro ID,
-- Supabase no lo reconoce y bloquea guardar localidades de doctores, ajustes, etc.
--
-- Qué hace (no borra datos ni cambia tablas o columnas):
--   PARTE 1 · Diagnóstico: muestra cómo ve Supabase a cada miembro del equipo.
--   PARTE 2 · Corrección (en una transacción):
--     a) nm_rol_activo_v134() reconoce el perfil por ID o, si el ID no coincide,
--        por el correo CONFIRMADO de la cuenta; acepta 'Administrador'/'Admin';
--        si no hay perfil, usa el rol de app_metadata (solo lo escribe el servidor).
--     b) Nueva nm_mi_usuario_id_v137(): el ID de perfil (public.usuarios.id) de quien
--        tiene la sesión. La usan las reglas de 09b, porque las asignaciones y las
--        localidades guardan ese ID.
--     c) El admin (admin@nutrimachata.com) queda con rol 'admin', activo y con
--        role=admin en app_metadata.
--   PARTE 3 · Verificación.
-- Se puede ejecutar varias veces. EJECUTA ESTE ARCHIVO ANTES DE 09b.
-- ============================================================================

-- ── PARTE 1 · Diagnóstico (solo lectura) ───────────────────────────────────
select u.email                                   as cuenta,
       u.id                                      as id_cuenta,
       us.id                                     as id_perfil,
       (us.id = u.id)                            as ids_coinciden,
       us.rol                                    as rol_en_perfil,
       us.activo                                 as perfil_activo,
       u.raw_app_meta_data->>'role'              as rol_app_metadata,
       u.email_confirmed_at is not null          as correo_confirmado
from auth.users u
left join public.usuarios us on us.id = u.id or lower(us.email) = lower(u.email)
where lower(u.email) = 'admin@nutrimachata.com'
   or lower(coalesce(us.rol, u.raw_app_meta_data->>'role', '')) in ('admin','administrador','doctor','doctora','nutricionista')
order by 1;

-- ── PARTE 2 · Corrección ───────────────────────────────────────────────────
begin;

create or replace function public.nm_mi_usuario_id_v137()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select us.id from public.usuarios us where us.id = auth.uid() limit 1),
    (select us.id from public.usuarios us
       join auth.users au on au.id = auth.uid()
      where au.email_confirmed_at is not null
        and lower(us.email) = lower(au.email)
      order by coalesce(us.activo, true) desc
      limit 1)
  );
$$;
revoke all on function public.nm_mi_usuario_id_v137() from public, anon;
grant execute on function public.nm_mi_usuario_id_v137() to authenticated;

create or replace function public.nm_rol_activo_v134()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case r when 'administrador' then 'admin' when 'administradora' then 'admin' else r end
  from (
    select lower(trim(coalesce(
      (select us.rol from public.usuarios us
        where us.id = public.nm_mi_usuario_id_v137() and coalesce(us.activo, true)
        limit 1),
      -- Sin perfil activo: rol puesto por el servidor (app_metadata). Nunca user_metadata.
      (select au.raw_app_meta_data->>'role' from auth.users au
        where au.id = auth.uid()
          and not exists (select 1 from public.usuarios us where us.id = public.nm_mi_usuario_id_v137()))
      , ''))) as r
  ) x;
$$;
revoke all on function public.nm_rol_activo_v134() from public;
grant execute on function public.nm_rol_activo_v134() to authenticated;

-- Perfil del administrador principal
update public.usuarios us
   set rol = 'admin', activo = true
  from auth.users au
 where lower(au.email) = 'admin@nutrimachata.com'
   and (us.id = au.id or lower(us.email) = lower(au.email));

insert into public.usuarios (id, email, rol, nombre, activo)
select au.id, lower(au.email), 'admin',
       coalesce(au.raw_user_meta_data->>'name', au.raw_user_meta_data->>'nombre', 'Administración'), true
  from auth.users au
 where lower(au.email) = 'admin@nutrimachata.com'
   and not exists (select 1 from public.usuarios us where us.id = au.id or lower(us.email) = lower(au.email));

update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
 where lower(email) = 'admin@nutrimachata.com';

commit;

-- ── PARTE 3 · Verificación: rol que Supabase reconoce a cada miembro ───────
create or replace function pg_temp.nm_rol_de(p_uid uuid) returns text language plpgsql volatile as $$
declare v text;
begin
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  execute 'select public.nm_rol_activo_v134()' into v;
  perform set_config('request.jwt.claim.sub', '', true);
  return coalesce(nullif(v,''), '(ninguno)');
end $$;

select au.email as cuenta, pg_temp.nm_rol_de(au.id) as rol_reconocido_por_supabase
from auth.users au
where exists (select 1 from public.usuarios us
              where (us.id = au.id or lower(us.email) = lower(au.email))
                and lower(coalesce(us.rol,'')) in ('admin','administrador','administradora','doctor','doctora','nutricionista'))
order by 1;
-- Debe aparecer: admin@nutrimachata.com → admin, y cada doctor/a → doctor / doctora / nutricionista.
