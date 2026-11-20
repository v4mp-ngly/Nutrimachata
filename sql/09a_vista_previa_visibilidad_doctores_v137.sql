-- ============================================================================
-- NutriMachata v137 · 09a · VISTA PREVIA (solo lectura) de la visibilidad por doctor
-- ----------------------------------------------------------------------------
-- No modifica nada. Muestra, para cada doctor/nutricionista activo, cuántos
-- pacientes verá cuando se aplique 09b, con la regla aprobada:
--     ve sus pacientes ASIGNADOS
--   + los pacientes de SUS LOCALIDADES
--   + los pacientes NUEVOS (sin doctor asignado y sin localidad).
-- El administrador sigue viendo todo y los pacientes solo lo suyo (sin cambios).
--
-- Revísalo ANTES de ejecutar 09b: si un doctor aparece con 0 localidades,
-- asígnale localidades en Equipo, o solo verá a sus asignados y a los nuevos.
-- ============================================================================
with staff as (
  select u.id, coalesce(u.nombre, u.email) as doctor, lower(u.rol) as rol
  from public.usuarios u
  where coalesce(u.activo, true) and lower(u.rol) in ('doctor','doctora','nutricionista')
),
asig as (
  select paciente_id, especialista_id from public.asignaciones_pacientes where coalesce(activo, true)
),
locs as (
  select usuario_id, localidad_id from public.doctor_localidades where coalesce(activo, true)
)
select s.doctor,
       s.rol,
       (select count(*) from locs l where l.usuario_id = s.id)                                             as localidades_asignadas,
       (select count(*) from public.pacientes p where exists (select 1 from asig a where a.paciente_id = p.id and a.especialista_id = s.id)) as por_asignacion,
       (select count(*) from public.pacientes p where p.localidad_id in (select localidad_id from locs l where l.usuario_id = s.id))        as por_localidad,
       (select count(*) from public.pacientes p where p.localidad_id is null and not exists (select 1 from asig a where a.paciente_id = p.id)) as nuevos_sin_asignar,
       (select count(*) from public.pacientes p where
            exists (select 1 from asig a where a.paciente_id = p.id and a.especialista_id = s.id)
         or p.localidad_id in (select localidad_id from locs l where l.usuario_id = s.id)
         or (p.localidad_id is null and not exists (select 1 from asig a where a.paciente_id = p.id)))   as total_que_vera,
       (select count(*) from public.pacientes)                                                            as total_pacientes
from staff s
order by s.doctor;
