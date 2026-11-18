# NutriMachata v133 · Verificación final

Comparación automática del ZIP original contra el proyecto corregido (hash SHA-256 de cada archivo).

## Resumen

| Concepto | Resultado |
|---|---|
| Archivos originales | 120 |
| Archivos originales que faltan | **0** ✅ |
| Sin cambios (idénticos) | 90 |
| Modificados | 30 |
| Nuevos | 19 |
| Módulos JS originales presentes en el bundle | 62/62 ✅ |
| Módulos JS en el bundle (incluye v130.3 extraído) | 64 |
| Referencias locales de index.html | css/app.bundle.css?v=133, js/app.bundle.js?v=133 → existen ✅ |
| Orden de carga | Chart.js → html2pdf → app.bundle.css → app.bundle.js (sin cambios) |
| Bundles coherentes con las fuentes (`build-bundle.mjs --check`) | ✅ |
| Diseño | v133 "Bento Verde" en css/51 (paleta oficial; se desactiva quitando la clase nm-bento). Funciones y datos sin cambios |

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `README.md` | Sección v131 añadida al final. |
| `VERIFICACION_DESPLIEGUE.txt` | Nota de despliegue v131 añadida al final. |
| `css/38-nm-billing-pdf-suite-v69.css` | Estilo del desglose por método (solo PDF). |
| `css/app.bundle.css` | Regenerado (incluye el cambio anterior). |
| `index.html` | Versión de caché ?v=133 y clase nm-bento en <body> (3 líneas). |
| `js/01-glp1.js` | Núcleo: Auth con tiempo límite, supa() (clasificación de errores, sin conexión, paginación, lecturas compartidas, protección de escrituras), carga única/parcial, refreshData, nmResync, datos demo solo en file://, logout/login limpios, roles, mapPaciente, contraseñas, IA escapada, plantillas con estilo en línea restaurado. |
| `js/03-nm-reliability-layer.js` | Copia de sesión con propietario; no sobrescribe memoria; evento online sin promesa sin manejar. |
| `js/04-nm-pagination-print-runtime.js` | Estilo en línea restaurado en la plantilla de factura; descuento e ITBIS legibles. |
| `js/05-nm-consent-module.js` | Tiempo límite en consentimientos. |
| `js/06-nm-billing-supabase-v3.js` | billingFetch con cancelación real, paginación y protección de escrituras; carga parcial segura; recarga forzada; factura reanudable; inventario atómico opcional; mapMethodFromDb global; totales persistidos. |
| `js/07-nm-supabase-save-audit.js` | Auditoría al reconectar diferida y con errores capturados. |
| `js/08-nm-notifications-reports-v2.js` | Funciones auxiliares de alertas clínicas definidas; estilo en línea restaurado. |
| `js/13-nm-billing-pdf-delete-v19.js` | Estilo en línea restaurado (PDF contable). |
| `js/14-nm-v20-features.js` | patient20 expuesto para recibos. |
| `js/20-nm-cotizaciones-v31.js` | QUOTES expuesto (PDF de cotizaciones). |
| `js/22-nm-finanzas-clientes-v33.js` | allParties expuesto e incluye localidad. |
| `js/25-nm-factura-oficial-v39.js` | Estilo en línea restaurado; descuento e ITBIS con porcentaje redondeado y monto. |
| `js/26-nm-supabase-stability-v41.js` | Evento online sin render duplicado. |
| `js/28-nm-global-connection-v43.js` | Resincronización real y única (antes llamaba funciones inexistentes). |
| `js/31-nm-billing-complete-v54.js` | Estilo en línea restaurado (impresión de cierre). |
| `js/32-nm-pdf-profesional-v61.js` | Estilos en línea restaurados (PDF y cierre). |
| `js/33-nm-v62-cash-reports.js` | Rango por defecto en hora de República Dominicana. |
| `js/34-nm-v63-dashboard-finance.js` | Recarga por foco limitada a 1/min. |
| `js/35-nm-pdf-professional-v64.js` | Logo de páginas siguientes con proporción real. |
| `js/37-nm-billing-pdf-suite-v69.js` | Desglose por método de pago legible. |
| `js/38-nm-cash-close-final-v70.js` | Fecha legible en recibos. |
| `js/41-nm-cash-close-range-v73.js` | Excluye facturas anuladas en Facturado/Pendiente. |
| `js/48-nm-v92-executive-history-credit.js` | PDF de saldos a favor coherente, fecha de recibo legible, sin doble encabezado. |
| `js/51-nm-v96-role-hierarchy.js` | Función esc definida (Equipo médico). |
| `js/app.bundle.js` | Regenerado desde las fuentes con build/build-bundle.mjs. |

## Archivos nuevos

| Archivo | Propósito |
|---|---|
| `INFORME_CORRECCIONES_v131.md` | Informe de correcciones. |
| `VERIFICACION_FINAL_v131.md` | Este documento. |
| `build/build-bundle.mjs` | Generador de bundles (Node, sin dependencias). |
| `build/bundle.config.json` | Orden de concatenación de JS y CSS. |
| `css/51-nm-v133-bento-verde.css` | Diseño v133 "Bento Verde" (solo estilos, adaptable). |
| `js/63-nm-v130-localidades-config.js` | Bloque v130.3 que antes solo existía dentro del bundle. |
| `js/64-nm-v132-pdf-engine.js` | Motor PDF unificado v132 (compatible con html2pdf). |
| `js/vendor/html2canvas.min.js` | html2canvas 1.4.1 (MIT), local. |
| `js/vendor/jspdf.umd.min.js` | jsPDF 2.5.1 (MIT), local. |
| `sql/01_diagnostico_solo_lectura_v131.sql` | Diagnóstico RLS e integridad financiera (solo lectura). |
| `sql/02_funcion_ajuste_stock_atomico_v131.sql` | Función opcional de inventario atómico. |
| `sql/03_indices_rendimiento_integridad_opcional_v131.sql` | Índices opcionales (no destructivo). |
| `tests/README.md` | Cómo ejecutar las pruebas automatizadas. |
| `tests/harness.js` | Abre la app en Chromium con Supabase simulado. |
| `tests/mock-supabase.js` | Supabase simulado (Auth + PostgREST) en memoria. |
| `tests/package.json` | Dependencias de desarrollo de las pruebas (no se usan en producción). |
| `tests/pdfall.js` | Genera todos los PDF para revisión visual. |
| `tests/run-all.js` | Las 28 pruebas automatizadas. |
| `tests/visual.js` | Comparación visual original vs corregido. |

## Archivos sin cambios

<details><summary>90 archivos idénticos al original</summary>

- `backup/NutriMachata_v126_COMPLETA_GLP1_CIERRE_OK.html`
- `css/01-styles.css`
- `css/02-nm-modern-dashboard-style.css`
- `css/03-nm-clinical-timeline-style.css`
- `css/04-nm-ui-consistency-2026.css`
- `css/05-nm-print-paging-upgrade.css`
- `css/06-hc-required-style.css`
- `css/07-nm-antecedent-selection-fix.css`
- `css/08-nm-v113-dashboard-style.css`
- `css/09-nm-v114-premium-ui.css`
- `css/10-nm-v115-new-visual-language.css`
- `css/11-styles.css`
- `css/12-styles.css`
- `css/13-styles.css`
- `css/14-styles.css`
- `css/15-styles.css`
- `css/16-styles.css`
- `css/17-styles.css`
- `css/18-nm-agenda-alerts-upgrade.css`
- `css/19-nm-reliability-layer-style.css`
- `css/20-styles.css`
- `css/21-nm-consent-style.css`
- `css/22-nm-notifications-reports-v2-style.css`
- `css/23-styles.css`
- `css/24-nm-agenda-smart-v9-style.css`
- `css/25-styles.css`
- `css/26-nm-v20-style.css`
- `css/27-nm-finanzas-clientes-v33-style.css`
- `css/28-nm-config-export-v34-style.css`
- `css/29-styles.css`
- `css/30-styles.css`
- `css/31-nm-pdf-design-v61.css`
- `css/32-styles.css`
- `css/33-styles.css`
- `css/34-nm-v116-green-sidebar.css`
- `css/35-nm-v62-cash-reports-style.css`
- `css/36-nm-v63-dashboard-finance-style.css`
- `css/37-nm-pdf-professional-v64.css`
- `css/39-nm-cash-close-final-v70-style.css`
- `css/40-nm-v74-eval-patient-style.css`
- `css/41-nm-v92-executive-credit-style.css`
- `css/42-nm-v97-clinical-notes-style.css`
- `css/43-nm-v98-team-settings-style.css`
- `css/44-nm-v120-clinical-record-ui.css`
- `css/45-nm-v121-localidades-style.css`
- `css/46-nm-v122-localidad-facturacion.css`
- `css/47-nm-v123-glp1-style.css`
- `css/48-nm-v117-patients-premium.css`
- `css/49-nm-v119-global-green-sidebar.css`
- `css/50-nm-v129-glp1-pro.css`
- `js/02-facturacion.js`
- `js/09-core.js`
- `js/10-nm-agenda-smart-v9.js`
- `js/11-nm-v16-stability-guards.js`
- `js/12-nm-billing-accounting-report-v18.js`
- `js/15-nm-billing-clientes-v1.js`
- `js/16-nm-gastos-v26.js`
- `js/17-nm-final-billing-stability-v28.js`
- `js/18-nm-billing-tab-persistence-v29.js`
- `js/19-nm-gastos-visible-v30.js`
- `js/21-nm-recibos-completos-v32.js`
- `js/23-nm-config-export-v34.js`
- `js/24-nm-cotizacion-simple-v35.js`
- `js/27-nm-quote-external-clients-v42.js`
- `js/29-nm-billing-stable-v51.js`
- `js/30-nm-structural-fix-v53.js`
- `js/36-nm-invoice-pdf-fix-v66.js`
- `js/39-nm-cash-close-delete-v71.js`
- `js/40-nm-cash-close-real-data-v72.js`
- `js/42-nm-v74-evaluations-patients-auto.js`
- `js/43-nm-discount-fix-v76.js`
- `js/44-nm-v80-patient-session-fix.js`
- `js/45-core.js`
- `js/46-core.js`
- `js/47-nm-v85-facturacion-stock-red.js`
- `js/49-nm-v93-deudas-saldos-separados.js`
- `js/50-nm-v95-integral-fixes.js`
- `js/52-nm-v97-clinical-notes.js`
- `js/53-nm-v98-team-settings.js`
- `js/54-nm-v112-password-security.js`
- `js/55-nm-v115-marker.js`
- `js/56-nm-v118-patient-clinical-permissions.js`
- `js/57-nm-v120-clinical-record-experience.js`
- `js/58-nm-v121-localidades-y-asignaciones.js`
- `js/59-nm-v122-localidad-facturacion.js`
- `js/60-nm-v123-glp1.js`
- `js/61-nm-v117-patients-ui.js`
- `js/62-nm-v129-glp1-pro.js`
- `locality_hits.txt`
- `manifest.json`

</details>

## Funcionalidades realmente probadas

Probadas en navegador (Chromium) contra un Supabase **simulado**. Columna "Original" = mismo test sobre el ZIP recibido.

| Prueba | Descripción | Original | v131 |
|---|---|---|---|
| T01 | Navegación administrador por todos los módulos sin errores JS | ❌ | ✅ |
| T02 | Equipo médico se renderiza (antes: ReferenceError esc) | ❌ | ✅ |
| T03 | Doctor: solo módulos clínicos; Facturación bloqueada | ✅ | ✅ |
| T04 | Paciente: solo ve su expediente y no accede a módulos administrativos | ✅ | ✅ |
| T05 | Cuenta sin rol NO entra como administrador por la pestaña elegida | ❌ | ✅ |
| T06 | Fallo de tabla crítica en primera carga: no se muestran pacientes de demostración | ❌ | ✅ |
| T07 | Carga parcial: una tabla opcional que falla no borra datos ya cargados | ❌ | ✅ |
| T08 | Sincronizaciones simultáneas se unifican (una sola carga completa) | ❌ | ✅ |
| T09 | Desconexión: no cierra sesión, conserva datos, sin promesas sin manejar; recupera al volver | ✅ | ✅ |
| T10 | Renovación de token con Auth 503 no cierra la sesión | ❌ | ✅ |
| T11 | Auth colgado: la renovación termina con error controlado (no bloquea para siempre) | ❌ | ✅ |
| T12 | CRUD clínico: paciente, cita, evaluación e historia clínica confirmados por el servidor | ✅ | ✅ |
| T13 | Factura: cálculo de descuentos, detalle, inventario y confirmación del servidor | ✅ | ✅ |
| T14 | Factura: doble clic en Guardar crea una sola factura | N/C | ✅ |
| T15 | Pago: doble envío simultáneo registra un solo pago | ❌ | ✅ |
| T16 | Pago con respuesta perdida tras guardarse: se verifica y NO se duplica al reintentar | ❌ | ✅ |
| T17 | Escritura incierta sin poder verificar: el reintento comprueba antes de enviar | ❌ | ✅ |
| T18 | Facturación reanudable: si fallan las líneas, el reintento completa la MISMA factura | ❌ | ✅ |
| T19 | Cálculos financieros consistentes: Facturado → Cobrado → Pendiente → Gastos → Neto (y anuladas excluidas) | ❌ | ✅ |
| T20 | Paginación: más de 1000 pagos se cargan completos (límite de PostgREST) | ❌ | ✅ |
| T21 | GLP-1: doble clic al registrar aplicación descuenta una sola vez y confirma | ❌ | ✅ |
| T22 | Cierre de sesión borra datos clínicos y la copia local; otro usuario no ve datos previos | ❌ | ✅ |
| T23 | Alertas clínicas (presión, IMC, cambio de peso) presentes en el Centro de alertas | ❌ | ✅ |
| T24 | Token vencido (401) se renueva de forma transparente | ✅ | ✅ |
| T25 | Doctor desactivado no puede iniciar sesión | ❌ | ✅ |
| T26 | Referencias locales de index.html y bundles existentes; sin <link> a CSS dentro de JS | ❌ | ✅ |
| T27 | Recarga de pacientes (módulo v74) conserva plan semanal, historia clínica y medidas | ❌ | ✅ |
| T28 | Inventario atómico: con la función SQL v131 instalada se usa la transacción del servidor | N/A | ✅ |

## No probado (requiere Supabase real)

- Políticas RLS reales y aislamiento por rol en la base de datos.
- RPC reales `nm_registrar_pago_con_saldo`, `nm_glp1_registrar_aplicacion`, `nm_glp1_agregar_stock`, `nm_asignar_localidad_paciente` (simuladas según su uso).
- Exportación a Excel y PDF distintos de factura e historia clínica (esos dos se generaron y compararon con el original: mismo diseño).
- Edge Function `admin-set-password`.
- Archivos de `sql/` en Supabase real (se ejecutaron en PostgreSQL 16 con un esquema equivalente; ver informe).
