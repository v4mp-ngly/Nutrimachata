-- ═══════════════════════════════════════════════════════════════════════════
-- NutriMachata v137 · PASO 1 de 2 · VISTA PREVIA (solo lectura, no cambia nada)
-- Facturas guardadas "Sin localidad" cuyo paciente HOY sí tiene localidad.
-- Revisa el resumen y el detalle. Si estás de acuerdo, ejecuta el PASO 2 (07b).
--
-- Importante: se usará la localidad que el paciente tiene HOY. Si un paciente se atendió antes en
-- otra sede, esas facturas quedarían en la sede actual. Si ves casos así, excluye esas facturas en el paso 2.
-- No se incluyen facturas de clientes externos (sin paciente) ni anuladas/archivadas.
-- ═══════════════════════════════════════════════════════════════════════════

-- Resumen por localidad
select l.nombre                          as localidad_que_se_asignara,
       count(*)                          as facturas,
       count(distinct f.paciente_id)     as pacientes,
       sum(f.total)                      as total_facturado,
       sum(coalesce(f.total_pagado,0))   as total_cobrado,
       min(f.fecha)                      as desde,
       max(f.fecha)                      as hasta
  from public.facturas f
  join public.pacientes p   on p.id = f.paciente_id
  join public.localidades l on l.id = p.localidad_id
 where f.localidad_id is null
   and p.localidad_id is not null
   and coalesce(lower(f.estado),'') not in ('anulada','archivada')
 group by l.nombre
 order by facturas desc;

-- Detalle factura por factura (descomenta para verlo)
-- select f.numero_factura, f.fecha, f.paciente_nombre, f.total, f.estado, l.nombre as localidad_que_se_asignara
--   from public.facturas f
--   join public.pacientes p   on p.id = f.paciente_id
--   join public.localidades l on l.id = p.localidad_id
--  where f.localidad_id is null and p.localidad_id is not null
--    and coalesce(lower(f.estado),'') not in ('anulada','archivada')
--  order by f.fecha, f.numero_factura;

-- Lo que seguirá "Sin localidad" (el paciente tampoco tiene localidad hoy)
-- select count(*) as facturas_que_seguiran_sin_localidad, sum(f.total) as total
--   from public.facturas f left join public.pacientes p on p.id = f.paciente_id
--  where f.localidad_id is null and (p.localidad_id is null or f.paciente_id is null)
--    and coalesce(lower(f.estado),'') not in ('anulada','archivada');
