# Escuelas Deportivas: estado y pendientes

Fecha de corte: 2026-11-24

Fuentes: `reuniones/` (10 y 24 de septiembre), `docs/producto.md`, `docs/plan-tecnico.md`, `escuelas-back/specs/ROADMAP.md`, specs de ambos repos, código y GitHub (PR y Actions).

Leyenda: **[B]** back, **[F]** front, **[I]** infraestructura, **[N]** negocio. 🔴 bloquea a otros. D = dolor, C = caso borde, Q = pregunta abierta (`docs/producto.md`).

## 1. Dónde estamos

| Fase | Back | Front | Falta para cerrarla |
| --- | --- | --- | --- |
| 0 Cimientos | Hecha | Hecha (mocks) | Deploy automático a `dev`; criterios sin marcar |
| 1 Estructura y jugadores | Specs 02 a 07 en código | Pantallas base con mocks | Familias, acudientes con acceso, importación, plataforma, conexión front-back |
| 2 Dinero | Nada | Nada | Todo |
| 3 Cancha y control | Solo escritura de bitácora | Nada | Todo |
| Después del piloto | Nada | Nada | Pasarela, conciliación, inventario, torneos, recordatorios, suscripciones, deportivo |

**Lectura franca:** el dolor principal de las reuniones (efectivo, pagos, mora, asistencia) todavía no tiene código. Lo construido es la base. No hay nada que el dueño pueda usar: el front no está conectado al back y no consta un deploy automático exitoso.

### Verificado hoy

- Back (`spec-07`): lint, typecheck y formato en verde; 837 tests unitarios en verde. En una primera corrida, con otros procesos en paralelo, falló 1; en la segunda pasaron todos. **No se corrieron** los tests de reglas ni de integración (emulador).
- Front (`spec-02`): lint y typecheck en verde; 277 tests en verde. `format:check` **falla en 8 archivos**.
- Los **10 deploys a `dev` consultados fallaron** (4 al 8 de octubre). Los 7 últimos por el mismo 403 de permisos. No se comprobó qué hay desplegado hoy en `dev`.
- Spec 07 del back: subida a GitHub, **sin PR**, 5 commits por delante de `dev`.
- PR #1 del front: abierto desde el 12 de octubre, CI en verde, mezclable. 161 archivos y unas 12.000 líneas.
- `main` del back sigue en el 3 de octubre; todo el trabajo vive en `dev`.

## 2. Orden recomendado

1. Desatascar: deploy a `dev`, PR de spec 07, PR #1 del front (sección 3).
2. Conseguir los datos reales y las respuestas de Juan David (sección 4). Corre en paralelo.
3. Conectar el front al back con lo que ya existe y mostrarlo al dueño (sección 5.1).
4. Cerrar la Fase 1 (sección 5).
5. Fase 2, dinero (sección 6).
6. Fase 3, asistencia y control (sección 7), y piloto en `prod` (sección 8).

La conexión va antes de la Fase 2 porque los tipos del front ya se separaron del back (5.1). Cada pantalla nueva con mocks agranda ese retrabajo.

## 3. Desatascar lo ya construido

- [ ] 🔴 **[I]** Arreglar el deploy a `dev`. Error: `403 Permission denied to get service [firebasestorage.googleapis.com]`. Causa probable: a la cuenta de servicio de Actions le falta permiso de Service Usage (probar `roles/serviceusage.serviceUsageConsumer`) y pueden aparecer otros permisos después.
- [ ] 🔴 **[I]** Seguir `docs/guias/documentos-y-urls-firmadas.md`: bucket, API `iamcredentials`, permiso de firma y `storage.lifecycle.json`. La guía dice que no se ha ejecutado.
- [ ] **[B]** Abrir y mezclar el PR de spec 07 hacia `dev`.
- [ ] **[B]** Correr `seed:dev` y `smoke:dev` (cierra pendientes de specs 02 a 07; es lo único que prueba índices y URLs firmadas).
- [ ] **[B]** Marcar los criterios de las specs 04 (12), 06 (18) y 07 (23), más los sueltos de 01, 02, 03 y 05. Hoy aparecen abiertos aunque hay código.
- [ ] **[B]** Vigilar el test unitario intermitente e identificarlo si reaparece.
- [ ] **[B]** Decidir cuándo `dev` pasa a `main`.
- [ ] **[F]** Revisar y mezclar el PR #1. Si se quiere revisión real, partirlo.
- [ ] **[F]** Corregir `format:check` y agregar `format:check` y `build` al CI, que hoy no los corre.
- [ ] **[F]** Verificar y marcar los 15 criterios de la spec 01.
- [ ] **[F]** Configurar Hosting: no existe `firebase.json` ni deploy en el CI.
- [ ] Actualizar los `AGENTS.md` (raíz dice "Pre-code"; el del front dice que el back no existe; el del back dice que el CI no ha corrido).
- [ ] Replicar documentación: ADR 0011 difiere en las tres copias; ADR 0002, 0005, 0006, 0007 y la guía de red inestable difieren en el front (en el 0002 se vio un cambio de formato).
- [ ] Actualizar el tablero de Obsidian: aún pide subir los repos a GitHub.

## 4. Negocio y decisiones

### 4.1 Pedir a Juan David (una sola conversación)

- [ ] 🔴 **[N]** Su base de datos completa. El 24 de septiembre la ofreció; desbloquea la importación (Q6).
- [ ] 🔴 **[N]** **Nombres reales de las sedes.** El resumen dice Suba, Puente Aranda, Cedritos y Rafael Uribe; la transcripción menciona Antonio Nariño y otros nombres ilegibles. Además, el 10 de septiembre se habló de 3 sedes y el 24 de 4.
- [ ] 🔴 **[N]** Tabla real de tarifas. Se oyeron 175.000 (matrícula, y también un pago del 24 de septiembre), 150.000 y 157.500.
- [ ] **[N]** Jugadores que pagan en efectivo, por sede (Q1). Lo prometió para el 25 de septiembre.
- [ ] **[N]** Política de efectivo: quién recibe, cuándo, cortes 15/30 (Q2).
- [ ] **[N]** Confirmar cuenta bancaria única y entregar un extracto de ejemplo anonimizado (Q7, D-18).
- [ ] **[N]** Datos y formato de la liga para pólizas; aseguradora (Q8). Excepción por póliza vencida (C19).
- [ ] **[N]** Obligación de facturar, con su contador (Q4).
- [ ] **[N]** Prorrateo al ingresar a mitad de mes (Q15) y mezcla de becas y descuentos (Q16).
- [ ] **[N]** Días de gracia para mora (Q3) y si su padre, su mano derecha presencial, tendrá rol de auxiliar.

### 4.2 Equipo

- [ ] 🔴 **[N]** Asesoría legal sobre datos de menores y conservación (Q12). **Antes de cargar datos reales.**
- [ ] **[N]** Plan de cobro y precios (Q13): jugadores activos (propuesta actual) o usuarios con sesión. Quedó en "requiere más debate".
- [ ] **[N]** Condiciones del piloto y relación societaria (Q13); nombre comercial y dominio (Q14).
- [ ] **[N]** Auditoría interna previa (Q10).
- [ ] **[N]** Canal de mensajes; propuesta: correo con Resend (Q11). Proveedor de pagos en línea (Q5).
- [ ] **[N]** Validar el prototipo con el dueño y al menos un coordinador (puerta de salida de F0).
- [ ] **[N]** Agendar la reunión siguiente y guardar sus notas: no hay ninguna posterior al 24 de septiembre en `reuniones/`.
- [ ] **[N]** Confirmar si se cumplieron los compromisos: nombres de otras apps y enlace de Train and Play. La propuesta consolidada de requerimientos **ya existe**: es `docs/producto.md`.

## 5. Cerrar Fase 1: estructura y jugadores

### 5.1 Conectar front y back

Diferido por decisión expresa; **necesita tu orden**.

- [ ] 🔴 **[F]** Spec de conexión: Firebase Auth, cliente HTTP con `Authorization: Bearer` y variables por ambiente.
- [ ] 🔴 **[F]** Alinear contratos. Diferencias encontradas:

| Tema | Front (mock) | Back (real) |
| --- | --- | --- |
| Estado del jugador | Incluye `en_mora` | Cuatro estados; no incluye mora |
| Documento de identidad | Un texto, obligatorio | Tipo y número; puede ser nulo |
| Acudiente | Pertenece a un jugador | Entidad propia con vínculos |
| Consentimiento de datos | No existe | Obligatorio para activar |
| Horario de grupo | Texto libre | Franjas por día y hora |
| Categoría | `sport` | `birthYears` |
| Categorías y grupos | Se pueden borrar | Se cierran, nunca se borran |
| Tipos de documento | `data_authorization`, sin foto | `dataAuthorization`, con `photo` |
| Familias | Módulo propio | No existe |

- [ ] **[F]** Reemplazar los adaptadores mock de auth, membresías, organización, estructura, jugadores, acudientes y documentos.
- [ ] **[F]** Subida y descarga real con URLs firmadas, compresión de fotos. **[I]** CORS en el bucket.
- [ ] **[F]** Recuperación de acceso real (hoy es un `window.alert`).

### 5.2 Back

- [ ] **[B]** Spec 08: familias, hermanos y pagadores autorizados (7.4, C15, C4).
- [ ] **[B]** Invitar acudientes y jugadores adultos; autoinscripción con aprobación (7.2, 7.3).
- [ ] **[B]** API de lectura para acudientes: solo sus hijos.
- [ ] 🔴 **[B]** Importación asistida con vista previa, errores y duplicados (7.18). Bloqueada por Q6.
- [ ] **[B]** Administración mínima de plataforma y sus roles (7.19). Hoy solo hay un script de alta.
- [ ] **[B]** Faltantes de 7.1 **que no estaban en el tablero**: calendario de temporada y pausas (C13), deportes o programas, y logo. Verificado: no están en el modelo.
- [ ] **[B]** Tipos de documento configurables, subida por acudiente y anulación (7.5).
- [ ] **[B]** Exportar el listado de pólizas para la liga (Q8).

### 5.3 Front

- [ ] **[F]** Spec 02, paso 6: módulo `import` con validadores. No existe.
- [ ] **[F]** Spec 02, paso 7: cierre con `fase-1.test.tsx`. No existe.
- [ ] **[F]** Navegación: el inicio es un texto provisional y no hay menú por rol.
- [ ] **[F]** Pantallas móviles: inscribir (COO-02) y buscar jugador (COO-03).
- [ ] **[F]** Pantallas del acudiente: ACU-01, ACU-06, ACU-07.
- [ ] **[F]** Aceptar invitación (COM-05), configuración (DUE-15), importar (DUE-16) y plataforma (PLA-01).
- [ ] **[F]** Consulta rápida de póliza en partido (flujo 10.8, D7).
- [ ] **[F]** Mostrar el historial del jugador.

**Listo cuando:** el dueño revisa la base migrada y confirma que son sus jugadores; una póliza aparece en menos de 1 minuto.

## 6. Fase 2: dinero (el dolor principal)

Sin specs ni código. Cada bloque debería ser una spec.

- [ ] **[B][F]** **Tarifas (7.6, D9, D10):** conceptos (matrícula, mensualidad, semestral, uniforme, póliza, torneo, traslado), valor por sede y categoría, versiones (C11), descuentos y becas con motivo y aprobación. Un solo beneficio activo hasta Q16.
- [ ] **[B][F]** **Cuentas por cobrar (7.7, D12):** cobros programados, cobros manuales, estado de cuenta por jugador y familia, abonos (C1), saldo a favor (C2), prorrateo (C9), cambio de sede (C10), pausas (C13), hermanos (C15), semáforo y morosos.
- [ ] **[B][F]** **Comprobantes (7.8, D2, D3, D4):** subir foto, cola de validación, duplicados (C5, C8), varios hijos (C3), pago de tercero (C4), bandeja "por asignar" (C6).
- [ ] **[B][F]** **Efectivo y recibos (7.9, D1):** registro por el coordinador, consecutivo sin saltos (D-09), texto "Recibo interno, no válido como factura", pago de quien no usa la app (C16), efectivo sin conexión (C22).
- [ ] **[B][F]** **Cierre de caja:** por sede, diferencia atribuida (C20), soporte de consignación, aprobación por dueño o auxiliar, alerta de caja abierta.
- [ ] **[B]** **Anulaciones y reembolsos (C7):** movimiento contrario, solo el dueño aprueba.
- [ ] **[B]** Reemplazar `AllowAllDeactivationGuard` por la validación de caja abierta (C21). Hoy permite siempre, y la ruta de producción lo importa desde `application/testing/`.
- [ ] **[B]** Puertos `PaymentProvider` e `InvoicingProvider` sin adaptador (D-18, D-19).
- [ ] **[B]** Recibo por correo (7.15, Q11) y decisión de PDF o pantalla.
- [ ] **[F]** Pantallas: DUE-05, 06, 07, 09; COO-01, 04, 05, 06, 07; ACU-02, 03, 04.
- [ ] **[F]** E2E con Playwright de los flujos 10.3 y 10.5.

**Cuidado de alcance:** que el acudiente vea su pago es un **control antifraude**, no un adorno. Juan David lo explicó el 24 de septiembre: si el coordinador no registra el efectivo, la familia no ve el pago y reclama. ACU-02 y ACU-04 no se deben posponer.

**Listo cuando:** todo el efectivo tiene recibo y entra a un cierre; el estado de cuenta se ve en menos de 15 segundos.

## 7. Fase 3: cancha y control

- [ ] **[B][F]** **Asistencia (7.11, D5, D6):** presente, ausente o tarde; sin conexión con IndexedDB y cola idempotente (D-12); aviso si el jugador no existe. Es el mayor riesgo técnico.
- [ ] **[B][F]** **Mora en cancha (C18):** alertar o bloquear según la escuela, con excepción del coordinador.
- [ ] **[B][F]** **Carné digital (7.12):** QR, foto, estado en vivo, versión imprimible.
- [ ] **[B][F]** **Reportes y tablero (7.16, D13):** recaudo por sede, concepto y medio; activos; morosos; cierres; Excel y PDF. Debe mostrar efectivo frente a jugadores activos, el cruce que pidieron en ambas reuniones.
- [ ] **[B][F]** **Bitácora (7.17):** lectura, filtros y exportación. Hoy solo se escribe.
- [ ] **[F]** Pantallas: DUE-01, 10, 11; COO-08; PRO-01 a 04; ACU-05.
- [ ] **[F]** E2E del flujo 10.7.

**Listo cuando:** las 4 sedes operan un ciclo completo y el dueño cuadra caja y mora sin Excel.

## 8. Salida a producción

- [ ] **[I]** Crear `escuelas-deportivas-prod` con la misma región y su alias en `.firebaserc`.
- [ ] **[I]** Respaldo diario, PITR, protección contra borrado y una restauración probada (D-17).
- [ ] **[I]** Alertas de presupuesto (D-15), monitoreo, Sentry en el front.
- [ ] **[I]** Deploy a `prod` con aprobación manual y federación de identidad (D-16). La llave actual es provisional.
- [ ] **[I]** Definir accesos, secretos y cuentas de servicio.
- [ ] **[B]** Pruebas de carga: ~100 comprobantes por sede entre el 1 y el 10.
- [ ] **[B]** Revisión de seguridad: reglas, aislamiento y URLs firmadas.
- [ ] **[B][F]** Política de datos y solicitudes de supresión con anonimización (Ley 1581).
- [ ] **[N]** Capacitación, guía rápida, canal de soporte y comunicado del canal único a las familias.

## 9. Después del piloto

- [ ] **F2 de producto:** pasarela y referencia única por jugador (7.8), conciliación bancaria (7.10), inventario y uniformes (7.13, D11), torneos y viajes (7.14), recordatorios (7.15), alertas automáticas (7.16), Alianza Sport como segunda escuela.
- [ ] **F3:** alta autoservicio, suscripciones y planes, marca por escuela, otros deportes y academias, exportación completa, sitio público.
- [ ] **F4:** asistencia ligada a tiempo jugado, partidos, evaluaciones, planificación del profesor, boletines.
- [ ] **Más adelante:** video con IA (BO3), perfiles para exportar jugadores (PIF).

Fuera de alcance: red social interna y contabilidad completa.

## 10. Trazabilidad: qué dolor sigue abierto

| Dolor | Estado hoy |
| --- | --- |
| D1 Efectivo sin control | Sin código (Fase 2) |
| D2 Transferencias anónimas | Sin código (Fase 2 parcial; completo con pasarela y conciliación) |
| D3 Conciliación manual | Sin código (Fase 2 parcial; completo con conciliación) |
| D4 Comprobantes por WhatsApp | Sin código (Fase 2) |
| D5 Jugadores inexistentes | Parcial: registro en el back; falta asistencia |
| D6 Sin asistencia ni acceso | Sin código (Fase 3) |
| D7 Pólizas inencontrables | Parcial: back hecho; front con mocks y sin archivos |
| D8 Datos dispersos | Parcial: modelo y búsqueda; falta importar |
| D9 Tarifas complejas | Sin código (Fase 2) |
| D10 Otros cobros | Sin código (Fase 2; eventos después) |
| D11 Sin inventario | Después del piloto |
| D12 Saber quién debe | Sin código (Fase 2) |
| D13 Operación remota | Parcial: solo escritura de bitácora |
| D14 Apps que no sirven al dueño | Depende de cerrar las fases 2 y 3 |
