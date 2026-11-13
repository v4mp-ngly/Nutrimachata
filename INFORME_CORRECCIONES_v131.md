# NutriMachata v131 · Informe de correcciones

**Base auditada:** `Nutrimachata-main.zip` (v130.3, GitHub Pages).
**Resultado:** mismo sistema, mismo diseño y mismos módulos; se corrigieron errores de causa raíz en conexión con Supabase, protección de datos clínicos, facturación, inventario/GLP-1, seguridad y construcción del bundle.
**Fecha:** 12 de noviembre de 2026.

> Ningún cambio se probó contra el Supabase real de producción. Todas las pruebas se ejecutaron contra un Supabase simulado (Auth + PostgREST) en un navegador Chromium automatizado. Las verificaciones que requieren la base real están en la sección 6.

---

## 1. Cómo se construye y despliega (inventario)

| Elemento | Hallazgo |
|---|---|
| Entrada | `index.html` carga 2 librerías de CDN (Chart.js 4.4.1, html2pdf 0.10.1), `css/app.bundle.css` y `js/app.bundle.js`. |
| Fuentes | 62 módulos `js/NN-*.js` y 50 hojas `css/NN-*.css` extraídos del HTML monolítico v126 (`backup/`). |
| Bundle JS | Concatenación en orden de los módulos **más un bloque v130.3 que no existía en ninguna fuente** (se perdería en la siguiente compilación). |
| Bundle CSS | Concatenación de 35 hojas en un orden propio. Las otras 15 son plantillas de documentos PDF/impresión. |
| Generador | No existía script de compilación en el ZIP. |
| Despliegue | Sitio estático (GitHub Pages), sin backend. Se conserva así. |

Se agregó `build/build-bundle.mjs` (Node, sin dependencias) y `build/bundle.config.json`. Regenera ambos bundles desde las fuentes; `--check` verifica que coinciden. El CSS regenerado es **idéntico byte a byte** al original.

---

## 2. Problemas encontrados y correcciones

Columnas: **Archivo** = fuente modificada (el bundle se regeneró en todos los casos).

### A. Construcción, carga y coherencia fuente/bundle

| # | Problema | Archivo | Corrección | Motivo |
|---|---|---|---|---|
| A1 | El bloque "v130.3 Configuración > Localidades" existía solo dentro de `app.bundle.js`. | `js/63-nm-v130-localidades-config.js` (nuevo) | Se extrajo a su propio archivo fuente y se incluyó en la configuración del bundle. | Una recompilación lo habría borrado. |
| A2 | La extracción v126 convirtió estilos en línea de 14 documentos (PDF de facturas, recibos, historia clínica, reportes, cierres de caja, Facturación) en `<link href="css/NN.css">` dentro de plantillas JS. En `08` el "CSS" extraído era en realidad código JS (`'+String(document.getElementById(...))+'`). | `01, 04, 08, 13, 25, 31, 32` | Se restauró el `<style>` original exacto desde `backup/…v126.html` (verificado: cada módulo restaurado es idéntico a su bloque en el respaldo, salvo `01`, que tiene cambios legítimos posteriores). | En PDF (html2pdf) y ventanas de impresión el CSS externo carga de forma asíncrona: documentos sin estilo o con estilo parcial. El reporte de notificaciones perdía su estilo por completo. |
| A3 | En un único bundle, un error al iniciar cualquier módulo detenía todos los posteriores (antes eran `<script>` independientes). | `build/build-bundle.mjs` | Cada módulo autocontenido (IIFE) se aísla con `try/catch`. `01` y `04` no se envuelven porque declaran globales. | Restaura el aislamiento original sin cambiar alcances. |
| A4 | Caché del navegador. | `index.html` | `?v=130` → `?v=131` en CSS y JS. | Garantiza que GitHub Pages sirva la nueva versión. |

### B. Supabase: conexión, sesión y sincronización

| # | Problema | Archivo | Corrección | Motivo |
|---|---|---|---|---|
| B1 | Login, renovación de token, registro y cierre de sesión usaban `fetch` sin tiempo límite. Si Auth no respondía, `SUPA_REFRESH_PROMISE` quedaba pendiente para siempre y **todas** las consultas se bloqueaban. | `01` | `nmAuthFetch` con 20 s; logout 8 s; prueba de conexión 12 s. | Prueba T11: antes colgado; ahora error controlado a los 20 s. |
| B2 | Un 500/503/429 de Auth al renovar el token se trataba como "sesión vencida" y **borraba la sesión**. | `01` | Solo 4xx de credenciales invalida la sesión; 5xx/429/408 = error transitorio. | T10. |
| B3 | Si la renovación fallaba por red, se lanzaba error aunque el token aún fuera válido. | `01` (`ensureSupaSession`) | Se sigue usando el token vigente hasta su expiración real. | Una desconexión temporal no cierra la sesión. |
| B4 | `supa()` enviaba la solicitud aun con el navegador sin conexión y registraba en consola el **cuerpo completo** de cada escritura fallida (datos clínicos y financieros). | `01` | Sin conexión: no envía y conserva la pantalla. La consola registra solo método, tabla, estado y código. | Privacidad y diagnóstico. |
| B5 | Errores sin clasificar. | `01`, `06` | `err.kind`: `offline`, `network`, `auth`, `permission` (RLS/403/42501), `conflict` (23505/409), `validation`, `not_found`, `server`. Los mensajes HTTP se conservan con su formato original (otros módulos los analizan). | Distinguir red, autenticación, RLS y base de datos. |
| B6 | Las llamadas RPC (`rpc/…`) que devuelven un objeto o `void` se rechazaban con "Supabase no confirmó ningún registro" **aunque se hubieran ejecutado**. Afectaba la aplicación GLP-1 (descuento de mg) y la asignación de localidad. El usuario veía error y repetía la acción. | `01` | La confirmación por representación se exige solo a tablas; en RPC basta el 2xx. | T21: antes error tras guardarse; ahora confirmación correcta. |
| B7 | `loadFromSupabase` sin control de concurrencia: login, reconexión, botón Actualizar y módulos podían lanzar varias cargas completas a la vez. | `01` | Una sola carga en curso; las llamadas simultáneas comparten la misma promesa. | T08 (4 solicitudes → 1 carga). |
| B8 | Una tabla opcional que fallaba (evaluaciones, dietas, historias, citas, usuarios) se reemplazaba por `[]` y **vaciaba esos datos en pantalla**. | `01` | Se conserva la última copia correcta; aviso de "sincronización parcial" con las tablas afectadas e indicador en la barra lateral. | T07. |
| B9 | Cada actualización mostraba la pantalla completa de carga. | `01` | Solo la primera carga bloquea; las siguientes no impiden navegar. | Requisito de interactividad. |
| B10 | `refreshData()` mostraba "Datos actualizados ✓" aunque no se hubiera podido conectar, y su error quedaba como promesa sin manejar (llamado desde el evento `online`). | `01`, `03` | Éxito solo si Supabase confirmó; errores capturados. | Mensajes de éxito solo con confirmación. |
| B11 | Al volver a la pestaña o reconectar, el módulo v43 llamaba funciones inexistentes (`loadAllData`, `loadPatients`, `loadAppointments`) y aun así anunciaba "Conexión restablecida. Datos sincronizados." Además, tres módulos reaccionaban a `online` por separado (carga completa + 2 renders de Facturación). | `28`, `26`, `03`, `07`, `01` | Nueva `nmResync()` única: al reconectar sincroniza una vez y anuncia solo si tuvo éxito; al volver a la pestaña, como máximo cada 5 min y sin mensaje. | T09. |
| B12 | Al recargar sin Internet, la sesión válida se descartaba y aparecía el login. | `01` | Se conserva y se reanuda automáticamente al volver la conexión. | Desconexión temporal. |
| B13 | Lecturas idénticas simultáneas generaban solicitudes duplicadas. | `01`, `06` | Se comparten (cada consumidor recibe su propia copia). Toda escritura invalida lo compartido para no leer datos previos al guardado. | Menos solicitudes redundantes. |
| B14 | `loadBillingFromSupabase(true)` después de guardar podía devolver una carga **iniciada antes** del guardado (datos viejos). | `06` | Una recarga forzada espera la anterior y lanza una nueva. | Totales correctos tras guardar. |
| B16 | Cualquier respuesta correcta cuyo contenido incluyera el texto "token expired" (p. ej. una nota) forzaba una renovación de sesión innecesaria. | `01` | El texto solo se analiza en respuestas de error. | Solicitudes redundantes. |
| B15 | La sincronización de citas cada 3 min seguía consultando con la pestaña oculta; el dashboard financiero recargaba facturas/pagos/gastos/cierres en **cada** foco de ventana. | `01`, `34` | Sin consultas con la pestaña oculta; dashboard como máximo una vez por minuto. | Rendimiento. |

### C. Escrituras: confirmación real y protección contra duplicados

| # | Problema | Archivo | Corrección |
|---|---|---|---|
| C1 | El tiempo límite de Facturación (`billingTimeout`) solo rechazaba la promesa; la solicitud **seguía viva** y podía guardarse después de mostrar "No se pudo…". | `06` | `AbortController` real (25 s). |
| C2 | Un corte de red durante una escritura no distinguía "no se envió" de "se envió y se perdió la respuesta". El usuario repetía y duplicaba facturas, pagos o aplicaciones GLP-1. | `01` (`nmGuardedWrite`), `06` | Las escrituras nunca se reintentan solas. Si el resultado es incierto, la app espera 1,5 s y **verifica en Supabase** si el registro existe (mismos campos, creado en la ventana del intento, usando la hora del servidor). Existe → se trata como guardado. No existe → se informa que puede repetirse. No se puede verificar → se bloquea la repetición idéntica hasta poder comprobar. Para RPC sin verificación posible se pide confirmación explícita. |
| C3 | Doble clic o doble envío simultáneo. | `01`, `06` | Una escritura idéntica en curso devuelve la misma solicitud (aplica a todos los módulos: pacientes, citas, evaluaciones, facturas, pagos, gastos, cierres, GLP-1, cotizaciones…). |
| C4 | `PATCH`/`DELETE`/upsert inciertos. | `01` | Mensaje específico: repetir no crea duplicados. |

Pruebas: T14, T15, T16, T17, T21.

### D. Datos clínicos

| # | Problema | Archivo | Corrección |
|---|---|---|---|
| D1 | El store arrancaba con **5 pacientes y 3 citas de demostración** (Sofía Martínez, Carlos Rodríguez…). Se veían tras el login hasta terminar la carga y **permanecían** si fallaba la conexión. | `01` | En el sitio publicado el store arranca vacío; la demostración queda solo para `file://`. (T06) |
| D2 | La copia de seguridad en `sessionStorage` (todos los pacientes) se restauraba **sin comprobar el usuario**: tras cerrar sesión, una cuenta de paciente en la misma pestaña podía ver los expedientes del administrador si su carga fallaba. También podía sobrescribir datos más recientes en memoria. | `03` | La copia lleva propietario (UID); solo se restaura para el mismo usuario y nunca sobre datos ya cargados. (T22) |
| D3 | Cerrar sesión dejaba en memoria y en `sessionStorage` pacientes, facturación y borradores del usuario anterior. | `01` | Se limpian y la página se recarga limpia. Un login de otra cuenta en la misma pestaña también recarga. |
| D4 | El módulo v74 (`refreshPatientsFromSupabase`, `refreshEvaluationData74`) volvía a transformar datos **ya transformados**: se perdía en memoria el plan semanal de las dietas (quedaba vacío), antecedentes y campos de la historia clínica y medidas (grasa, FC). Guardar después desde esa vista podía escribir datos vacíos. | `01` (`mapPaciente`) | `mapPaciente` reconoce objetos ya transformados y los conserva. (T27) |
| D5 | `mapPaciente` descartaba `localidad_id`: **toda** factura de paciente mostraba "PACIENTE SIN LOCALIDAD" y no guardaba su localidad. | `01`, `22` | Se conserva el campo. |
| D6 | Las alertas clínicas v2 (evaluación atrasada, IMC, presión elevada, cambio de peso, fin de plan) nunca aparecían: sus funciones auxiliares eran locales de otro módulo. | `08` | Se definen en el módulo. (T23) |

### E. Facturación y centro financiero

| # | Problema | Archivo | Corrección |
|---|---|---|---|
| E1 | Listas sin paginación: PostgREST devuelve como máximo 1000 filas. Con más pagos, facturas, detalles o gastos, **Facturación, cierres de caja y reportes omitían registros sin avisar**. | `01`, `06` | Paginación automática completa (1000 por página, orden estable con `id`) para toda lista sin `limit`. (T20: 2600/2600; antes 1000) |
| E2 | Si fallaba la carga de `factura_detalles`, las facturas quedaban sin líneas; editar una y guardarla **borraba sus conceptos** en Supabase. Si fallaban productos o clientes, el catálogo quedaba vacío. | `06` | Detalles = tabla crítica (se conserva todo lo anterior). Productos y clientes conservan su última copia. |
| E3 | Si fallaba el guardado de líneas tras crear la factura, quedaba una factura sin conceptos y el reintento chocaba con "número ya existe". | `06` | El reintento completa la **misma** factura (sin duplicar). (T18) |
| E4 | Totales recalculados en el navegador a partir de las líneas en lugar de los persistidos: Facturación/cierre podían diferir de Reportes (que leen la base). | `01`, `06` | Las facturas de Supabase usan `subtotal` y `total` guardados. El editor sigue calculando igual al crear o editar. (T19) |
| E5 | **Cierre por período (v73) sumaba facturas anuladas** en "Facturado" y "Pendiente". Reportes, cierre diario, dashboard y panel de Facturación sí las excluían. | `41` | Se excluyen anuladas/archivadas. (T19: cierre = reporte = servidor) |
| E6 | `mapMethodFromDb` era local: recibos y cierres mostraban `efectivo` en minúscula y el cierre v70 separaba "efectivo" y "Efectivo" en dos filas. | `06` | Se expone globalmente. |
| E7 | Rango por defecto de Reportes de caja calculado en UTC: después de las 8:00 p. m. del último día del mes abría el mes siguiente. | `33` | Fecha de República Dominicana. |
| E8 | Descarga de PDF de cotizaciones: siempre "No se encontró la cotización" (`QUOTES` era local de otro módulo). | `20` | Se expone en lectura. |
| E9 | Recibos v32 no completaban la cédula del paciente (`patient20` local). | `14` | Se expone. |
| E10 | `deleteInvoice` v3 usaba una variable inexistente (`bi`) tras devolver el stock (código hoy reemplazado por v19). | `06` | Corregido por si vuelve a activarse. |

Verificado sin cambios (correcto): descuento por línea y global (T13: 2 × 1800 − 10 % − 5 % = 3078), detalle por línea, pagos completos y parciales con disparador del servidor, cobrado = dinero recibido (`monto_recibido`), saldo a favor usado no cuenta como ingreso, Neto = Cobrado − Gastos.

### F. Inventario y GLP-1

| # | Problema | Archivo | Corrección |
|---|---|---|---|
| F1 | Doble clic en "Guardar" de GLP-1 (sin bloqueo de botón) podía registrar dos aplicaciones y descontar dos veces. | `01` (protección general C3) | Una sola solicitud. (T21) |
| F2 | Ajuste de existencias por lectura-modificación-escritura en el navegador: dos ventas simultáneas podían perder un descuento; el movimiento podía quedar sin registrar. | `06`, `sql/02` | Si existe `nm_ajustar_stock_v131` (SQL opcional), el ajuste y su movimiento se hacen en una transacción con `stock = stock + delta`. Sin la función, se usa el método anterior. (T28) |
| F3 | Stock negativo | — | Se conserva la regla v85 (se puede facturar sin existencias). Lo que se eliminó es el descuento doble por solicitudes repetidas. |

### G. Autenticación, roles y seguridad

| # | Problema | Archivo | Corrección |
|---|---|---|---|
| G1 | **Una cuenta sin rol entraba como administrador** si en el login estaba seleccionada la pestaña de administración. | `01` | Rol desconocido = paciente (mínimo privilegio). (T05) |
| G2 | El rol se tomaba primero de `user_metadata`, que **el propio usuario puede modificar** desde Supabase Auth. | `01` | Prioridad: `app_metadata` → `public.usuarios.rol` → `user_metadata`. |
| G3 | Un doctor desactivado (`usuarios.activo = false`) seguía pudiendo entrar. | `01` | Se bloquea el acceso. (T25) |
| G4 | Contraseñas generadas: solo 9 posibles (`123456`, `234567`…), usadas para cuentas del portal. | `01` | 10 caracteres aleatorios criptográficos. |
| G5 | Respuesta de la IA insertada como HTML sin escapar. | `01` | Se escapa (mismo aspecto). |
| G6 | Pantalla "Equipo médico" no cargaba (`esc is not defined`). | `51` | Se define. (T02) |
| G7 | Consentimientos sin tiempo límite. | `05` | 18 s. |
| G8 | La búsqueda del perfil en `usuarios` durante el login podía demorar el acceso con mala conexión. | `01` | Máximo 8 s; si no responde se usa el rol de `app_metadata`/`user_metadata`. |

La protección real de datos depende de las políticas RLS de Supabase (no incluidas en el ZIP). Ver sección 6.

---

## 3. Pruebas ejecutadas

Entorno: Chromium automatizado (Playwright) + Supabase simulado en memoria (Auth con tokens, PostgREST con filtros `eq/gte/lt`, orden, `limit/offset`, límite de 1000 filas, RLS simplificado por rol, disparador de pagos y RPC de pagos/GLP-1). Cada prueba usa un navegador y una base nuevos. Las mismas 28 pruebas se ejecutaron sobre el ZIP original y sobre v131.

Validación estática: `node --check` sobre los 63 módulos y el bundle (sin errores), análisis `no-undef` (ESLint) de todos los módulos, verificación de referencias de `index.html`, y `build-bundle.mjs --check`. Los 10 identificadores "no definidos" que quedan están protegidos con `typeof` y tienen alternativa funcional.

PDF: se generaron con html2pdf, desde el original y desde v131, la factura FAC-0001 y la historia clínica de un paciente. Ambos se descargan sin errores y tienen el mismo diseño; la factura de v131 muestra el total guardado en Supabase.

SQL: los tres archivos se ejecutaron en PostgreSQL 16 sobre un esquema que reproduce las columnas que usa la app (roles `anon`/`authenticated` y `auth.uid()` como en Supabase). Resultado: el diagnóstico corre completo; `03` se puede ejecutar dos veces sin error (crea el índice único solo una vez); `nm_ajustar_stock_v131` con **20 llamadas simultáneas** dejó el stock exacto (10 → −10, 20 movimientos con stocks consecutivos, sin pérdidas), ignora servicios, registra `created_by` y rechaza al rol `anon`.

| Prueba | Qué verifica | ZIP original | v131 | Detalle v131 |
|---|---|---|---|---|
| T01 | Navegación administrador por todos los módulos sin errores JS | ❌ navegación: errores JS: ReferenceError: esc is not defined | ✅ | 15 módulos + pestañas de Facturación |
| T02 | Equipo médico se renderiza (antes: ReferenceError esc) | ❌ la pantalla no se mostró: Cargando equipo médico... | ✅ |  |
| T03 | Doctor: solo módulos clínicos; Facturación bloqueada | ✅ | ✅ | redirigido a: Pacientes |
| T04 | Paciente: solo ve su expediente y no accede a módulos administrativos | ✅ | ✅ |  |
| T05 | Cuenta sin rol NO entra como administrador por la pestaña elegida | ❌ la cuenta sin rol obtuvo interfaz de administrador | ✅ | rol resultante: (sin sesión de aplicación), app visible: false |
| T06 | Fallo de tabla crítica en primera carga: no se muestran pacientes de demostración | ❌ se muestran pacientes ficticios: Sofía Martínez, Carlos Rodríguez, Isabella Torres, Andrés Gómez, Valentina Ló | ✅ | pacientes en memoria: 0 |
| T07 | Carga parcial: una tabla opcional que falla no borra datos ya cargados | ❌ evaluaciones antes 2, después 0 | ✅ | evaluaciones conservadas 2/2; aviso: ["citas","evaluaciones"] |
| T08 | Sincronizaciones simultáneas se unifican (una sola carga completa) | ❌ la carga completa de pacientes se ejecutó 4 veces para 4 solicitudes simultáneas | ✅ | cargas completas: 1; total GET: 14 |
| T09 | Desconexión: no cierra sesión, conserva datos, sin promesas sin manejar; recupera al volver | ✅ | ✅ | pacientes conservados 3; GET pacientes al reconectar: 1 |
| T10 | Renovación de token con Auth 503 no cierra la sesión | ❌ la sesión fue eliminada: {"ok":false,"msg":"refresh failed","code":"AUTH_SESSION_EXPIRED","tok":false} | ✅ | {"ok":true,"n":1,"tok":true} |
| T11 | Auth colgado: la renovación termina con error controlado (no bloquea para siempre) | ❌ la renovación quedó colgada >30 s | ✅ | {"res":"err:NETWORK_ERROR","ms":20002,"tok":true} |
| T12 | CRUD clínico: paciente, cita, evaluación e historia clínica confirmados por el servidor | ✅ | ✅ |  |
| T13 | Factura: cálculo de descuentos, detalle, inventario y confirmación del servidor | ✅ | ✅ | subtotal 3240, descuento 162, total 3078, stock 10→8 |
| T14 | Factura: doble clic en Guardar crea una sola factura | N/C · No concluyente en el original: el aviso falso "Paciente sin localidad" (D5) interrumpe el guardado. | ✅ | facturas creadas: 1 |
| T15 | Pago: doble envío simultáneo registra un solo pago | ❌ pagos registrados: 2 | ✅ | pagos nuevos: 1; pagado 2000 |
| T16 | Pago con respuesta perdida tras guardarse: se verifica y NO se duplica al reintentar | ❌ pagos registrados: 2 (duplicado) | ✅ | primer intento devolvió true; modal abierto tras el corte: false; pagos nuevos: 1 |
| T17 | Escritura incierta sin poder verificar: el reintento comprueba antes de enviar | ❌ pagos registrados: 2 | ✅ | pagos nuevos 1; reenvíos 0 |
| T18 | Facturación reanudable: si fallan las líneas, el reintento completa la MISMA factura | ❌ facturas 1, detalles 0, segundo intento false | ✅ | intento1=false intento2=true; facturas=1; líneas=1 |
| T19 | Cálculos financieros consistentes: Facturado → Cobrado → Pendiente → Gastos → Neto (y anuladas excluidas) | ❌ cierre.billed=3720.9302325581393 esperado 4000; cierre.pending=2720.9302325581393 esperado 3000 | ✅ | facturado 4000, cobrado 1000, pendiente 3000, gastos 500, neto 500 (cierre = reporte = servidor) |
| T20 | Paginación: más de 1000 pagos se cargan completos (límite de PostgREST) | ❌ pagos cargados: 1000 de 2600 | ✅ | pagos cargados: 2600 |
| T21 | GLP-1: doble clic al registrar aplicación descuenta una sola vez y confirma | ❌ aplicaciones registradas: 2 | ✅ | aplicaciones 1; restante 1.5→1.25 mg |
| T22 | Cierre de sesión borra datos clínicos y la copia local; otro usuario no ve datos previos | ❌ la copia local con datos clínicos sigue en sessionStorage | ✅ | pacientes visibles para el paciente: [] |
| T23 | Alertas clínicas (presión, IMC, cambio de peso) presentes en el Centro de alertas | ❌ faltan alertas clínicas: Paciente sin evaluación, Cita sin confirmar, Cita mañana sin confirmar | ✅ | Presión arterial elevada, Paciente sin evaluación, IMC fuera de rango, Cita sin confirmar, Cita mañana sin confirmar |
| T24 | Token vencido (401) se renueva de forma transparente | ✅ | ✅ |  |
| T25 | Doctor desactivado no puede iniciar sesión | ❌ el doctor desactivado entró al sistema | ✅ |  |
| T26 | Referencias locales de index.html y bundles existentes; sin <link> a CSS dentro de JS | ❌ 15 plantillas PDF/impresión enlazan CSS externo en lugar de estilos en línea | ✅ | referencias: css/app.bundle.css, js/app.bundle.js |
| T27 | Recarga de pacientes (módulo v74) conserva plan semanal, historia clínica y medidas | ❌ antes {"plan":"Avena con frutas","fam":"Diabetes","alerg":"Sí","grasa":"31.5"} después {"plan":"","fam":"","al | ✅ | {"plan":"Avena con frutas","fam":"Diabetes","alerg":"Sí","grasa":"31.5"} |
| T28 | Inventario atómico: con la función SQL v131 instalada se usa la transacción del servidor | N/A · No aplica: la función SQL es nueva en v131. | ✅ | stock 10→7 en una sola transacción |

**Resultado:** v131 supera **28/28** pruebas. El ZIP original supera 6/28 con las mismas pruebas (2 no aplican o no son concluyentes); sus fallas corresponden a los errores corregidos.

---

## 4. Comparación visual

Capturas de las mismas pantallas (1366×850, mismos datos simulados) en el original y en v131, comparadas píxel a píxel (pixelmatch, umbral 0.12).

| Pantalla | Píxeles distintos | % de la pantalla |
|---|---|---|
| login | 0 | 0 % |
| dashboard | 6 | 0.001 % |
| patients | 5 | 0 % |
| historias | 5 | 0 % |
| evaluations | 6 | 0.001 % |
| consents | 6 | 0.001 % |
| diets | 5 | 0 % |
| agenda | 6 | 0.001 % |
| analisis | 6 | 0.001 % |
| billing | 1059 | 0.091 % |
| glp1 | 6 | 0.001 % |
| settings | 6 | 0.001 % |
| reports | 6 | 0.001 % |

Las únicas diferencias son de **contenido**, no de diseño: (1) el número del ícono de notificaciones (3 → 5) porque vuelven a aparecer las alertas clínicas (D6); (2) en Facturación, con datos donde el subtotal guardado no coincide con la suma de líneas, el original mostraba en la misma pantalla "Facturado RD$ 4,000.00" y "Total facturado RD$ 3,720.93"; v131 muestra RD$ 4,000.00 en ambos, igual que Supabase (E4). Colores, fuentes, espaciado y disposición son idénticos.

---

## 5. Archivos

Ver `VERIFICACION_FINAL_v131.md` (archivos cambiados, intactos, nuevos y pruebas). Las pruebas automatizadas se incluyen en `tests/` (ver `tests/README.md`) para repetirlas después de cada cambio.

---

## 6. Pendiente: requiere intervención manual

1. **Políticas RLS (crítico).** No están en el ZIP, así que no se pudieron auditar ni probar. Ejecutar `sql/01_diagnostico_solo_lectura_v131.sql` y revisar especialmente la consulta 3 (políticas que confían en `user_metadata`: un paciente podría atribuirse un rol), la 4 (políticas abiertas) y que pacientes y doctores solo lean sus filas. Las correcciones de rol del frontend (G1–G3) son solo de interfaz; la protección real es RLS.
2. **Probar con el Supabase real** (en un entorno de pruebas o con datos de prueba): login de cada rol, crear/editar/anular factura, pago parcial y con saldo a favor, cierre de caja, aplicación GLP-1. Las RPC `nm_registrar_pago_con_saldo`, `nm_glp1_registrar_aplicacion` y `nm_glp1_agregar_stock` se simularon según su uso en el código; su SQL real no está en el ZIP.
3. **Verificación de escrituras inciertas.** Usa `created_at` o `creado_en`. La consulta 12 del diagnóstico muestra qué tablas las tienen; donde no existan, la app pide confirmación antes de repetir.
4. **SQL opcional:** `02` (inventario atómico) y `03` (índices; el índice único de número de factura solo se crea si no hay duplicados).
5. **Consultas de integridad 6–11** del diagnóstico: detectan facturas duplicadas, totales pagados distintos de la suma de pagos, facturas sin líneas, posibles pagos duplicados anteriores a v131 y stock/GLP-1 negativos. No se corrigió ningún dato existente.
6. **Búsqueda global:** al elegir un paciente solo abre el directorio (la función `openPatientDetail` que espera nunca existió). No se cambió porque no está claro qué pantalla debía abrir.
7. **Ajustes que solo viven en la pestaña:** el perfil de la clínica (Configuración > Perfil), las plantillas de dietas y la lista de formularios de consentimiento se guardan en `sessionStorage` y se pierden al cerrar el navegador. Guardarlos en Supabase requiere tablas nuevas, por eso no se cambió. (La numeración de facturas sí se sincroniza con `configuracion_facturacion`.)
8. **Clave de IA en el navegador:** el módulo de IA llama a la API desde el navegador con una clave escrita en Configuración. Para producción conviene moverlo a una Edge Function.
9. **15 hojas CSS** (`css/11…17, 20, 23, 25, 29, 30, 32, 33, 34`) ya no se usan (sus estilos vuelven a estar en línea en las plantillas). Se conservaron. `locality_hits.txt` es un registro de búsqueda de una auditoría anterior; no se usa.
