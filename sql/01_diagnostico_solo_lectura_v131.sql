-- =====================================================================
-- NutriMachata v131 · DIAGNÓSTICO (SOLO LECTURA)
-- No modifica datos, tablas ni políticas. Ejecutar en Supabase > SQL Editor
-- y revisar los resultados de cada consulta.
-- =====================================================================

-- 1) Tablas usadas por la aplicación y si tienen RLS activo.
--    Todas deberían mostrar rls_activo = true.
select c.relname as tabla, c.relrowsecurity as rls_activo, c.relforcerowsecurity as rls_forzado
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and c.relname in ('pacientes','evaluaciones','historias_clinicas','dietas','citas','seguimiento_paciente',
    'lab_notes','notas_clinicas','consentimientos_pacientes','usuarios','asignaciones_pacientes','localidades',
    'productos_servicios','facturas','factura_detalles','pagos','movimientos_inventario','clientes','gastos',
    'cierres_caja','cotizaciones','configuracion_facturacion','saldos_favor','movimientos_saldo_favor',
    'deudas_clinica','pagos_deuda_clinica','glp1_catalogo','glp1_tratamientos','glp1_aplicaciones')
order by rls_activo, tabla;

-- 2) Políticas RLS existentes (revisar quién puede leer/escribir cada tabla).
select tablename as tabla, policyname as politica, cmd as operacion, roles, qual as condicion_using, with_check
from pg_policies where schemaname = 'public'
order by tablename, cmd, policyname;

-- 3) RIESGO: políticas que confían en user_metadata (el propio usuario puede modificarlo
--    desde Supabase Auth). Si aparece alguna fila, un paciente podría atribuirse un rol.
select tablename as tabla, policyname as politica, cmd as operacion
from pg_policies
where schemaname = 'public'
  and (coalesce(qual,'') ilike '%user_metadata%' or coalesce(with_check,'') ilike '%user_metadata%'
       or coalesce(qual,'') ilike '%raw_user_meta_data%' or coalesce(with_check,'') ilike '%raw_user_meta_data%');

-- 4) RIESGO: políticas totalmente abiertas (using true) en tablas clínicas o financieras.
select tablename as tabla, policyname as politica, cmd as operacion, roles
from pg_policies
where schemaname = 'public' and (qual = 'true' or with_check = 'true')
order by tablename;

-- 5) Funciones RPC que usa la aplicación (deben existir) y si son SECURITY DEFINER.
select p.proname as funcion, p.prosecdef as security_definer, pg_get_function_identity_arguments(p.oid) as argumentos
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in (
  'nm_registrar_pago_con_saldo','nm_registrar_pago_deuda','nm_glp1_registrar_aplicacion',
  'nm_glp1_agregar_stock','nm_asignar_localidad_paciente','recalcular_pago_factura','nm_ajustar_stock_v131')
order by funcion;

-- 6) Integridad financiera: números de factura repetidos.
select numero_factura, count(*) as veces from public.facturas group by numero_factura having count(*) > 1;

-- 7) Integridad financiera: total_pagado distinto de la suma de pagos aplicados.
select f.id, f.numero_factura, f.total, f.total_pagado,
       coalesce(sum(coalesce(p.monto_aplicado, p.monto)),0) as suma_pagos
from public.facturas f left join public.pagos p on p.factura_id = f.id
group by f.id, f.numero_factura, f.total, f.total_pagado
having abs(coalesce(f.total_pagado,0) - coalesce(sum(coalesce(p.monto_aplicado, p.monto)),0)) > 0.01
order by f.numero_factura;

-- 8) Integridad financiera: subtotal de la factura distinto de la suma de sus líneas.
select f.id, f.numero_factura, f.subtotal, coalesce(sum(d.subtotal),0) as suma_lineas, count(d.id) as lineas
from public.facturas f left join public.factura_detalles d on d.factura_id = f.id
group by f.id, f.numero_factura, f.subtotal
having abs(coalesce(f.subtotal,0) - coalesce(sum(d.subtotal),0)) > 0.01 or count(d.id) = 0
order by f.numero_factura;

-- 9) Posibles pagos duplicados (misma factura, mismo monto, menos de 2 minutos de diferencia).
select a.factura_id, a.id as pago_1, b.id as pago_2, a.monto_recibido, a.created_at, b.created_at
from public.pagos a join public.pagos b
  on a.factura_id = b.factura_id and a.id < b.id
 and coalesce(a.monto_recibido,a.monto) = coalesce(b.monto_recibido,b.monto)
 and abs(extract(epoch from (a.created_at - b.created_at))) < 120;

-- 10) Productos con existencia negativa (la v85 permite vender sin stock; revisar si corresponde).
select id, nombre, stock from public.productos_servicios where coalesce(stock,0) < 0 order by nombre;

-- 11) Tratamientos GLP-1 con cantidad restante negativa (no debería ocurrir).
select id, paciente_id, cantidad_restante_mg from public.glp1_tratamientos where coalesce(cantidad_restante_mg,0) < 0;

-- 12) Columnas de fecha de creación que usa la verificación de escrituras inciertas (v131).
select table_name as tabla, string_agg(column_name, ', ') as columnas_fecha
from information_schema.columns
where table_schema='public' and column_name in ('created_at','creado_en')
group by table_name order by table_name;
