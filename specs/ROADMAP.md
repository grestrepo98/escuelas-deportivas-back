# ROADMAP — Trazabilidad del backend

> Inventario de todo lo que el backend debe cubrir y la spec/fase donde se resuelve. Fuentes: `docs/plan-tecnico.md` y `docs/producto.md`. Se actualiza cada vez que se crea una spec. Fecha: 2026-10-03.

## Specs por fase

| Spec | Fase técnica | Estado | Resumen |
| --- | --- | --- | --- |
| 01 `fundaciones-backend` | Fase 0 | Aprobada; implementada (falta confirmar el CI en GitHub) | Workspace, Firebase deny-all, membresías, bitácora base, cambio de rol, CI y deploy a `dev` |
| 02 `estructura-organizacion` | Fase 1 (parte 1) | Aprobada; en implementación (falta desplegar a `dev` y verificar los criterios) | Ficha de la organización, sedes, categorías, grupos, `getStructure` y script de alta de organización |
| 03+ (por crear) | Fase 1 (resto) | Pendiente | Usuarios y alcance (7.2), jugadores y acudientes (7.3, 7.4), documentos (7.5), importación (7.18) |
| (por crear) | Fase 2 | Pendiente | Dinero |
| (por crear) | Fase 3 | Pendiente | Cancha, control y endurecimiento |

Las fases 1–3 pueden partirse en más de una spec. Cada una se define con `/spec` al llegar su turno, una vez cumplida la puerta de salida de la anterior.

## Módulos de producto → fase

| Módulo | Fase | Notas |
| --- | --- | --- |
| 7.1 Organización, sedes, estructura | 1 | Cerrar sede no la borra; un grupo, una sola sede |
| 7.2 Usuarios, roles, accesos | 0 (base) y 1 | Fase 1: invitación, activar/desactivar, alcance |
| 7.3 Jugadores e inscripción | 1 | Detección de duplicados; D-10 paginada + índice liviano |
| 7.4 Acudientes y familias | 1 | |
| 7.5 Documentos y pólizas | 1 | Signed URLs (D-08); verificar permiso de firma de la cuenta de servicio |
| 7.6 Conceptos, tarifas, descuentos, becas | 2 | Tarifas versionadas; un solo beneficio activo hasta decidir C14 |
| 7.7 Cuentas por cobrar | 2 | Función programada de cobros |
| 7.8 Pagos con comprobante | 2 | Pasarela queda para el plan posterior |
| 7.9 Efectivo, recibos, cierre de caja | 2 | Contador consecutivo (D-09), recibo con texto "Recibo interno, no válido como factura" |
| 7.11 Asistencia | 3 | Offline + cola idempotente (D-12) |
| 7.12 Carné digital | 3 | |
| 7.15 Notificaciones (recibos) | 2 | Correo (Q11), p. ej. Resend |
| 7.16 Reportes | 3 | Agregación `count`/`sum` (D-11) |
| 7.17 Bitácora | 0 (base) y 3 | Fase 3: filtros y exportación |
| 7.18 Importación asistida | 1 | Script Admin SDK con vista previa y reporte de errores |
| 7.19 Administración de plataforma | 1 | Incluye roles de plataforma, diferidos desde spec 01 |
| 7.10, 7.13, 7.14, 7.20 | Después | Fuera del plan técnico actual |

## Casos borde C1–C22 → dónde se resuelven

| Caso | Fase | Observación |
| --- | --- | --- |
| C1 Abono parcial | 2 | |
| C2 Pago adelantado / saldo a favor | 2 | |
| C3 Un pago, varios hijos | 2 | Imputaciones por jugador y concepto |
| C4 Pago de tercero | 2 | Pagador autorizado (modelo en Fase 1, 7.4) |
| C5 Valores repetidos / duplicados | 2 | |
| C6 Bandeja "por asignar" | 2 | Alerta tras N días |
| C7 Anulación y reembolso | 2 | Movimiento contrario; si el cierre está aprobado entra en el siguiente |
| C8 Pago duplicado por error | 2 | |
| C9 Ingreso a mitad de mes | 2 | Política configurable; provisional prorrateo (Q15) |
| C10 Cambio de sede/categoría | 2 | Datos de jugador en Fase 1 |
| C11 Cambio de tarifa | 2 | Solo hacia adelante |
| C12 Retiro y reingreso | 1 y 2 | Perfil y estado en 1; cobro de matrícula en 2 |
| C13 Pausa y congelamiento | 1 y 2 | Calendario en 1; generación de cobros en 2 |
| C14 Becas y descuentos a la vez | 2 | **Pospuesto (Q16)**; un solo beneficio activo |
| C15 Hermanos | 2 | Familia en Fase 1 |
| C16 Acudiente sin acceso digital | 2 | Efectivo y recibo a otro familiar o impreso |
| C17 Padres separados | 1 | Dos acudientes, un responsable de pago |
| C18 Mora que llega a entrenar | 3 | Política `alertar`/`bloquear` configurable; hoy solo alerta (Q3) |
| C19 Póliza vencida en partido | 1 | Estado "por decidir" en producto: la excepción del dueño no está definida |
| C20 Cierre con diferencia | 2 | |
| C21 Salida de coordinador | 2 | **Dependencia cruzada:** la desactivación (Fase 1) debe verificar caja abierta, que existe desde la Fase 2; definir el gancho en la spec de desactivación |
| C22 Sin conexión | 2 y 3 | Efectivo pendiente hasta sincronizar (2); cola de asistencia (3) |

## Preguntas abiertas Q1–Q16

| Q | Estado | Se necesita en |
| --- | --- | --- |
| Q1 Efectivo por sede | Abierta (Juan David) | Diseño de caja, Fase 2 |
| Q2 Política de efectivo (quién, fechas, cortes 15/30) | Abierta | Fase 2 |
| Q3 Mora | Decidida: alerta, configurable | Fase 3 |
| Q4 Facturación electrónica | Abierta (contador) | Antes de Fase 2 |
| Q5 Proveedor de pagos en línea | Abierta | Plan posterior |
| Q6 Formato y limpieza de datos | Abierta | Fase 1 (importación) |
| Q7 Cuentas bancarias | Decidida: una por escuela; confirmar con Juan David | Fase 2 |
| Q8 Datos y formato de la liga para pólizas | Abierta | Fase 1 (campos de §7.5 ya definidos) |
| Q9 Confirmación del recibo | Decidida: basta con que lo vea | Fase 2 |
| Q10 Auditoría previa encubierta | Abierta (negocio) | No bloquea el backend |
| Q11 Canal de mensajes | Propuesto: correo (Resend) | Fase 2 |
| Q12 Asesoría legal datos de menores y retención | Abierta | **Antes de cargar datos reales**; Fase 1 si se importan datos de verdad |
| Q13 Precios y relación societaria | Abierta (negocio) | No bloquea el backend |
| Q14 Nombre del producto | Abierta | Fase 1 |
| Q15 Prorrateo (C9) | Provisional | Fase 2 |
| Q16 Becas y descuentos (C14) | Pospuesta | Fase 2 |

## Pendientes de decisiones del plan técnico

| Origen | Pendiente | Dónde se cierra |
| --- | --- | --- |
| §5 Modelo de datos | Borrador; "Por decidir" | Cada fase cierra sus colecciones |
| D-08 | Permiso de firma de URLs y límites de tamaño | Fase 1 (documentos); probar también en `dev` |
| D-13 | URLs firmadas no se replican en el emulador | Probar en `dev` |
| D-15 | Alertas de presupuesto `dev` y `prod` | `dev`: prerrequisito de spec 01; `prod`: Fase 3 |
| D-16 | Qué evento despliega a `prod` y autenticación de Actions | Spec 01 deja service account provisional; decisión final en Fase 3 |
| D-17 | Respaldo diario, restauración probada, retención (Q12), protección contra borrado y PITR en `prod` | Fase 3 |
| D-18 | Confirmar cuenta única de Argentinos Juniors | Fase 2 |
| D-19 | Obligación de facturar; puerto `InvoicingProvider` | Fase 2 (puerto), después (adaptador) |
| §10.13 | Recibo en PDF: function + Storage, o solo en pantalla | Fase 2 |
| §10.15 | Quién accede a `prod`, secretos y cuentas de servicio | Antes de abrir `prod` (Fase 3) |
| D-11 | Contadores precalculados solo si una consulta del tablero resulta lenta | Fase 3 |
| D-10 | Buscador de servidor si una escuela supera unos miles de jugadores | Después del piloto |

## Requisitos transversales (§14 de producto) → verificación

| Requisito | Dónde se prueba |
| --- | --- |
| Aislamiento entre escuelas | Spec 01 (rules + callables); se repite en cada colección nueva |
| Mínimo acceso por rol (profesor sin montos) | Cada spec de módulo; el semáforo no expone valores |
| Huella inmutable | Spec 01 (bitácora base); Fase 3 (completa y filtrable) |
| Recibos consecutivos sin saltos | Fase 2 |
| Dinero entero en COP, fechas UTC | Todas las specs; criterios de aceptación propios |
| Picos de los primeros 10 días del mes | Fase 3 (pruebas de carga, ~100 comprobantes por sede) |
| Mala conexión | Fase 3 |
| Respaldo y conservación | Fase 3 |
| Protección de datos de menores | Q12 antes de datos reales; supresión con anonimización en registros financieros (D-17) |

## Endurecimiento antes de abrir `prod` a las 4 sedes (Fase 3)

- Pruebas de carga con los picos de los primeros 10 días del mes.
- Simulacro de restauración de un respaldo.
- Revisión de seguridad: rules en "denegar todo", aislamiento entre organizaciones, URLs firmadas.
- Proyecto `prod`, alias `prod` en `.firebaserc`, aprobación manual, federación de identidad, monitoreo y alertas.

## Inconsistencias detectadas el 2026-10-03

| Hallazgo | Resolución | Estado |
| --- | --- | --- |
| Fase 0 del plan menciona claims; D-06 decidió sin claims | Plan corregido (Fase 0 y título de D-06) | Corregido |
| Plan dice Node 22; `functions/package.json` dice Node 24 | Plan corregido (D-01) a Node 24 | Corregido |
| Plan usa `escuelas-dev`/`escuelas-prod`; el proyecto real es `escuelas-deportivas-dev` | Plan corregido (D-01, D-13, §10); `prod` = `escuelas-deportivas-prod` (por crear) | Corregido |
| D-02 lista 3 puertos; `CLAUDE.md` suma `PaymentProvider` e `InvoicingProvider` | Plan corregido (D-02): cada puerto se crea en su fase | Corregido |
| Firestore en `nam5`, sin protección contra borrado ni PITR | Plan corregido (D-14); activar protección en `prod` | Corregido |
| `.firebaserc` solo tiene `default`; el plan exige alias `dev`/`prod` | Agregado alias `dev` → `escuelas-deportivas-dev` (`prod` cuando exista el proyecto) | Corregido |

Correcciones al plan replicadas el 2026-10-03 en `docs/` de `escuelas-back`, `escuelas-front` y la carpeta raíz (regla de D-01).
