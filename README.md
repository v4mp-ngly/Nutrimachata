# NutriMachata v126 - Proyecto organizado

Esta carpeta es una reorganizacion conservadora de la v126 completa.

## Estructura
- `index.html`: entrada principal.
- `css/`: 49 bloques de estilos extraidos, manteniendo su posicion relativa mediante links.
- `js/`: 61 bloques JavaScript propios extraidos, manteniendo el orden original.
- `backup/`: HTML monolitico original v126.

## Importante
- No se modifico Supabase ni se incluyen credenciales nuevas.
- Las librerias externas siguen cargandose desde sus CDN originales.
- Para publicar en GitHub Pages, sube todo el contenido conservando las carpetas `css` y `js`.
- Abre/publica `index.html`; no abras archivos JS individualmente.

## GLP-1
El modulo GLP-1 sigue usando las tablas ya creadas en Supabase. No vuelvas a ejecutar el SQL solo por usar esta version organizada.

## v127 - Correccion contable de Facturacion
- Reportes de caja ya no suman cierres solapados.
- Facturado: facturas reales del rango.
- Cobrado: dinero realmente recibido del rango (`monto_recibido`, con fallback a `monto`).
- Saldo a favor usado no se cuenta como nuevo ingreso de caja.
- Gastos: gastos reales no anulados del rango.
- Neto: cobrado real - gastos.
- Pendiente: saldo actual de las facturas del rango.
- Historial de cierres se conserva solo como referencia.
- PDF del periodo usa los totales reales, no la suma de cierres.

## v129 · GLP-1 PRO
- Control de frascos y cantidad en mg por tratamiento/paciente.
- Descuento atómico de medicamento al registrar cada aplicación.
- Proyección de aplicaciones restantes usando la dosis indicada por el profesional.
- Alertas: atrasada, hoy, mañana, esta semana, poco medicamento y requiere nuevo frasco.
- Resumen GLP-1 en Dashboard y acceso a WhatsApp.
- Ejecutar `NutriMachata_v129_GLP1_PRO_SUPABASE.sql` una sola vez en Supabase antes de usar las nuevas cantidades.
- La migración no inventa stock para tratamientos anteriores: se debe registrar la cantidad real disponible con “Añadir frasco”.

## v130.3 - Localidades visible en Configuracion
- Corrige la insercion de Configuracion > Localidades en el contenedor real de ajustes.
- Localidades activas/inactivas se administran solo por admin.
- Facturacion permite continuar sin localidad o asignar una activa desde la alerta.
- Supabase debe tener localidad_id nullable segun el HOTFIX v130.2.

## v131 - Estabilización (sin cambios visuales)
- Mismo diseño, mismos módulos y mismo flujo. Detalle completo en `INFORME_CORRECCIONES_v131.md`.
- Supabase es la fuente de verdad: un error de red ya no cierra la sesión, no vacía datos cargados
  y no muestra pacientes de demostración.
- Una sola sincronización a la vez; reconexión automática al volver Internet.
- Las escrituras nunca se repiten solas. Si una respuesta se pierde, se verifica en Supabase antes
  de permitir repetir (evita facturas, pagos y aplicaciones GLP-1 duplicadas). Doble clic = una sola solicitud.
- Listas paginadas completas (más de 1000 pagos/facturas ya no se truncan en reportes y cierres).

### Cómo se construye
`index.html` carga solo `css/app.bundle.css` y `js/app.bundle.js`. Los bundles se generan desde
los archivos numerados de `css/` y `js/`:

```
node build/build-bundle.mjs          # regenera los dos bundles
node build/build-bundle.mjs --check  # verifica que estén al día con las fuentes
```

Nunca edites los bundles a mano. Después de regenerar, sube el número de versión `?v=` en `index.html`.

### SQL (opcional, en `sql/`)
1. `01_diagnostico_solo_lectura_v131.sql`: revisa RLS, políticas y consistencia financiera. No modifica nada.
2. `02_funcion_ajuste_stock_atomico_v131.sql`: inventario en una sola transacción. La app la usa si existe.
3. `03_indices_rendimiento_integridad_opcional_v131.sql`: índices (solo crea si no existen).
