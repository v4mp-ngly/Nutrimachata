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

- Deploy v129.1
