# SPEC 06 — Jugadores y acudientes (ficha, inscripción por el personal, estados, búsqueda)

> **Status:** Approved
> **Depends on:** SPEC 02, SPEC 04 y SPEC 05. Cubre el núcleo de §7.3 y §7.4 de `docs/producto.md` y D-10 del plan técnico.
> **Date:** 2026-10-04
> **Objective:** Que el personal de una organización pueda inscribir jugadores con sus acudientes, ubicarlos en un grupo, cambiar su estado y encontrarlos, todo por rutas de un módulo nuevo `player`.

---

## Por qué existe esta spec

La Fase 1 debe dejar a Argentinos Juniors "cargado con sedes, grupos, jugadores, acudientes y pólizas". Las sedes, la estructura y el personal ya existen (specs 02 y 05). Los documentos y pólizas, la importación, la asistencia, el carné y todo el dinero necesitan un jugador con su acudiente responsable. Esta spec crea ese núcleo y deja para después la foto, las familias y la autoinscripción.

## Scope

**In:**

- Un módulo nuevo `functions/src/player/` (jugadores y acudientes) con su API `playerApi` (ADR 0009).
- Una ficha de jugador con nombres, documento opcional, fecha de nacimiento, contacto de emergencia, datos médicos básicos, grupo (con la sede y la categoría copiadas del grupo), estado y fecha de ingreso.
- Los acudientes como entidad propia (`guardians`), vinculados al jugador con parentesco y responsable de pago. Un acudiente sirve para varios jugadores, y un jugador puede tener varios acudientes (C17).
- La inscripción la hace el personal (dueño, auxiliar y coordinador en sus sedes). En la misma llamada vincula acudientes existentes o crea nuevos, todo en una transacción.
- Cuatro estados manuales: `preinscrito`, `activo`, `pausado` y `retirado`, con motivo cuando corresponde. Pasar a `activo` exige un acudiente responsable de pago y el consentimiento registrado.
- El consentimiento de tratamiento de datos lo registra el personal (`dataConsent`).
- El cambio de grupo (C10, solo el dato; el cobro va en la Fase 2) y el reingreso del mismo perfil (C12, solo el perfil).
- Un historial de movimientos en `players/{id}/history`: cambios de grupo y de estado.
- La detección de duplicados al crear: el documento repetido bloquea, y el mismo nombre con la misma fecha de nacimiento avisa.
- La búsqueda de D-10: una lista paginada por cursor con un filtro de ubicación y el estado, y un índice liviano para buscar en el cliente.
- La visibilidad por rol según la matriz de §6. El profesor ve la ficha de sus grupos sin el documento ni los datos de los acudientes.
- La bitácora de cada escritura, en la misma transacción.
- Índices compuestos en `firestore.indexes.json` para la lista paginada.
- Tests de reglas para `players`, `guardians` e `history` (siguen en denegar todo).
- Ampliación del seed (jugadores y acudientes ficticios) y del smoke test.
- Documentación: el ADR 0011, `functions/README.md`, `arquitectura.md`, `specs/ROADMAP.md`, `CLAUDE.md` y la réplica de `docs/` en `../escuelas-front/docs/` y `../docs/`.

**Out of scope (for future specs):**

- La foto del jugador y cualquier archivo: van con documentos y pólizas (§7.5, D-08).
- Familias, cuenta familiar, hermanos (C15) y pagadores autorizados con documento (C4): van en la spec 07.
- La inscripción hecha por el acudiente con aprobación, invitar acudientes y jugadores adultos (rol `guardian` y `adultPlayer` con `playerIds`), y que el acudiente edite (h).
- El estado "en mora": se calcula con los cobros de la Fase 2 y no se guarda.
- La matrícula automática al inscribir, el paso a activo por pago, las fechas de congelamiento (C13) y los cobros por cambio de grupo (C10): todo eso es de la Fase 2.
- La importación desde Excel (§7.18) y los roles de plataforma (§7.19).
- Las reglas para cerrar un grupo con jugadores activos (ver Risks).
- Cambiar `firestore.rules` o `storage.rules`.

## Data model

Colecciones nuevas bajo `tenants/{tenantId}/`:

```ts
// player/domain/player.ts
type PlayerStatus = "preinscrito" | "activo" | "pausado" | "retirado";
type DocumentType = "RC" | "TI" | "CC" | "CE" | "PA" | "PPT";

interface PersonDocument {
  type: DocumentType;
  number: string;
}

interface GuardianLink {
  guardianId: string;
  fullName: string; // copia para el índice liviano; se actualiza al editar al acudiente
  relationship: string; // "madre", "padre", "abuela", ...
  isPaymentResponsible: boolean;
}

interface Player {
  id: string;
  tenantId: string;
  firstNames: string;
  lastNames: string;
  nameKey: string; // apellidos + nombres normalizados (minúsculas, sin tildes, espacios simples)
  document: PersonDocument | null;
  documentKey: string | null; // `${type}:${number normalizado}`
  birthDate: string; // "YYYY-MM-DD"
  groupId: string;
  venueId: string; // copiada del grupo
  categoryId: string; // copiada del grupo
  status: PlayerStatus;
  statusReason: string | null;
  joinedAt: Date;
  emergencyContact: { name: string; phone: string; relationship: string };
  medical: {
    bloodType?: string;
    allergies?: string;
    conditions?: string;
    medications?: string;
    notes?: string;
  };
  guardians: GuardianLink[];
  guardianIds: string[]; // para array-contains
  dataConsent: { guardianId: string; recordedBy: string; at: Date } | null;
  createdAt: Date;
  updatedAt: Date;
}

// player/domain/guardian.ts
interface Guardian {
  id: string;
  tenantId: string;
  firstNames: string;
  lastNames: string;
  document: PersonDocument;
  documentKey: string;
  phone: string;
  email: string | null;
  preferredContact: "phone" | "whatsapp" | "email";
  createdAt: Date;
  updatedAt: Date;
}

// players/{playerId}/history/{id}
interface PlayerPlacementState {
  groupId?: string;
  venueId?: string;
  categoryId?: string;
  status?: PlayerStatus;
}

interface PlayerHistoryEntry {
  id: string;
  type: "placement" | "status";
  before: PlayerPlacementState;
  after: PlayerPlacementState;
  reason: string | null;
  actorUid: string;
  at: Date;
}
```

Reglas puras del dominio (`player/domain/`):

| Regla         | Detalle                                                                                                                                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Normalización | `nameKey` y `documentKey` con una función pura y probada (tildes, mayúsculas, espacios, ceros y puntos en el número)                                                                                                   |
| Vínculos      | Hay como máximo un `isPaymentResponsible`, el mismo acudiente no aparece dos veces, y un jugador `activo` tiene exactamente un responsable                                                                             |
| Transiciones  | `preinscrito → activo \| retirado`; `activo → pausado \| retirado`; `pausado → activo \| retirado`; `retirado → preinscrito \| activo` (reingreso, C12). `pausado` y `retirado` exigen motivo                          |
| Activar       | Exige un responsable de pago, `dataConsent` no nulo y un grupo activo                                                                                                                                                  |
| Visibilidad   | El dueño y el auxiliar ven todo. El coordinador ve `venueId ∈ scope.venueIds`. El profesor ve `groupId ∈ scope.groupIds`, sin `document`, `guardians` ni `dataConsent`. El acudiente y el jugador adulto reciben `403` |
| Escritura     | Escriben el dueño, el auxiliar y el coordinador (solo en sus sedes; un cambio de grupo exige que el origen y el destino sean de sus sedes). El profesor no escribe                                                     |

Puertos nuevos (`player/application/`): `PlayerRepository` (`newId`, `get`, `save`, `findByDocumentKey`, `findByNameAndBirthDate`, `listByGuardian`), `GuardianRepository` (`newId`, `get`, `save`, `findByDocumentKey`) y `PlayerHistoryWriter` (`append`). `TransactionContext` gana `players`, `guardians` y `playerHistory`. Las lecturas de lista, índice e historial son consultas de `infrastructure/firestore/` (como `structure-query.ts`), con la visibilidad pura del dominio.

### Rutas y contratos

El `tenantId` va en la ruta, el actor sale del token y los cuerpos usan zod `.strict()`. Rol "personal" significa dueño, auxiliar y coordinador (s).

| Método y ruta                                        | Quién              | Cuerpo / query                                                                                                                                                                                           | Respuesta                                                                                        |
| ---------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `POST /tenants/:tenantId/players`                    | personal           | `{ firstNames, lastNames, document?, birthDate, groupId, emergencyContact, medical?, guardians: ({ guardianId } \| { guardian: {...} }) & { relationship, isPaymentResponsible }[], confirmDuplicate? }` | `201 { playerId, status: "preinscrito", createdGuardianIds }`                                    |
| `GET /tenants/:tenantId/players`                     | personal, profesor | `?venueId \| categoryId \| groupId` (uno como máximo), `status?`, `cursor?`, `limit?` (50 por defecto, 100 como máximo)                                                                                  | `200 { players: PlayerSummary[], nextCursor }`                                                   |
| `GET /tenants/:tenantId/players/search-index`        | personal, profesor | —                                                                                                                                                                                                        | `200 { entries: { id, fullName, documentNumber?, guardianNames?, status, groupId }[] }`          |
| `GET /tenants/:tenantId/players/:playerId`           | personal, profesor | —                                                                                                                                                                                                        | `200` ficha (la del profesor va sin los campos restringidos)                                     |
| `PUT /tenants/:tenantId/players/:playerId`           | personal           | datos personales, de emergencia y médicos                                                                                                                                                                | `200 { playerId }`                                                                               |
| `PUT /tenants/:tenantId/players/:playerId/placement` | personal           | `{ groupId, reason? }`                                                                                                                                                                                   | `200 { playerId, groupId, venueId, categoryId }`                                                 |
| `PATCH /tenants/:tenantId/players/:playerId/status`  | personal           | `{ status, reason? }`                                                                                                                                                                                    | `200 { playerId, status }`                                                                       |
| `PUT /tenants/:tenantId/players/:playerId/guardians` | personal           | `{ guardians: [...] }` (mismo formato que al crear; reemplaza el conjunto)                                                                                                                               | `200 { playerId, createdGuardianIds }`                                                           |
| `PUT /tenants/:tenantId/players/:playerId/consent`   | personal           | `{ guardianId }` (debe estar vinculado)                                                                                                                                                                  | `200 { playerId, dataConsent }`                                                                  |
| `GET /tenants/:tenantId/players/:playerId/history`   | personal, profesor | —                                                                                                                                                                                                        | `200 { entries }` (más recientes primero)                                                        |
| `GET /tenants/:tenantId/guardians`                   | personal           | `?documentType&documentNumber`                                                                                                                                                                           | `200 { guardian \| null }` (el coordinador solo si está vinculado a un jugador de sus sedes)     |
| `PUT /tenants/:tenantId/guardians/:guardianId`       | personal           | datos del acudiente                                                                                                                                                                                      | `200 { guardianId }` (actualiza `fullName` en los jugadores vinculados, en la misma transacción) |

Reglas de las rutas:

- Un documento repetido en la organización responde `409` con el `playerId` existente, sin excepción. El mismo `nameKey` y `birthDate` responde `409` con los candidatos (`duplicateCandidates`), salvo que llegue `confirmDuplicate: true`.
- Un acudiente nuevo en línea cuyo documento ya existe responde `409` con su `guardianId`, para que el front lo vincule por id.
- Si el grupo está cerrado o es de otra organización al crear o mover, responde `409` o `404`. Si no hay cambio real de grupo o de estado, responde `409`.
- Si quitar al responsable de pago de un jugador `activo` lo deja sin uno, responde `409`.
- El cursor es opaco (`nameKey` + `id` en base64url) y un cursor inválido responde `400`. Se ordena por `nameKey` y luego por `id`. Sin filtro, el coordinador usa `venueId in scope.venueIds` y el profesor `groupId in scope.groupIds`. Un filtro fuera de su alcance responde `403`.
- Acciones de bitácora: `player.created`, `player.updated`, `player.placement_changed`, `player.status_changed`, `player.guardians_changed`, `player.consent_recorded`, `guardian.created` y `guardian.updated`.

Índices compuestos (`firestore.indexes.json`, colección `players`): `(venueId, nameKey)`, `(categoryId, nameKey)`, `(groupId, nameKey)`, `(status, nameKey)`, `(venueId, status, nameKey)`, `(categoryId, status, nameKey)` y `(groupId, status, nameKey)`. Si el orden por `id` exige incluirlo en el índice, se agrega en el paso de adaptadores, y el emulador lo confirma.

### Estructura de archivos

```
functions/src/player/
├── domain/ player.ts, guardian.ts, normalize.ts, guardian-links.ts,
│           player-status.ts, player-visibility.ts (+ .test.ts cada uno)
├── application/
│   ├── player-repository.ts, guardian-repository.ts, player-history-writer.ts
│   ├── enroll-player.ts, update-player.ts, change-player-placement.ts,
│   │   change-player-status.ts, set-player-guardians.ts, record-data-consent.ts,
│   │   update-guardian.ts, find-guardian.ts, get-player.ts (+ .test.ts cada uno)
│   └── testing/ in-memory-player-repository.ts, in-memory-guardian-repository.ts,
│                in-memory-player-history-writer.ts
└── infrastructure/
    ├── firestore/ firestore-player-repository.ts, firestore-guardian-repository.ts,
    │              firestore-player-history-writer.ts, player-list-query.ts,
    │              player-search-index-query.ts, player-history-query.ts
    └── http/ player-api.ts, router.ts, routes/<nombre>/{handler,schema}.ts
```

`shared/application/unit-of-work.ts`, `shared/infrastructure/firestore-unit-of-work.ts` y su fake ganan los tres repositorios. `index.ts` exporta `playerApi`.

## Implementation plan

TDD en cada paso (primero el test que falla). Un commit convencional por paso. Cada paso termina con `build`, `lint`, `typecheck`, `format:check` y las suites en verde.

0. **Línea base.** Anotar cuántos tests pasan en `test:unit`, `test:rules` y `test:integration`.
1. **Normalización.** `domain/normalize.ts` (`nameKey`, `documentKey`) con tests de tildes, mayúsculas, espacios, puntos y ceros a la izquierda.
2. **Entidades y reglas puras.** `player.ts`, `guardian.ts`, `guardian-links.ts` (un solo responsable, sin repetidos), `player-status.ts` (tabla de transiciones, motivo y requisitos para activar) y `player-visibility.ts` (por rol, con la ficha recortada para el profesor).
3. **Puertos, fakes y UnitOfWork.** Los tres puertos, sus fakes en memoria y la ampliación de `TransactionContext` y del fake de `UnitOfWork`.
4. **Inscribir.** `EnrollPlayer`: permisos por rol y sede, grupo activo, acudientes existentes o nuevos, duplicado por documento (`409`), duplicado por nombre y fecha (`409` con candidatos, o se acepta con `confirmDuplicate`), acudiente nuevo con documento existente (`409`), estado `preinscrito` y bitácora.
5. **Editar y acudientes.** `UpdatePlayer`, `SetPlayerGuardians` (con la regla del responsable en jugadores activos), `RecordDataConsent`, `UpdateGuardian` (que propaga `fullName`) y `FindGuardian`.
6. **Grupo y estado.** `ChangePlayerPlacement` (origen y destino en las sedes del coordinador, grupo activo, historial) y `ChangePlayerStatus` (transiciones, motivo, requisitos para activar, reingreso e historial).
7. **Lectura de la ficha.** `GetPlayer` con la visibilidad y el recorte del profesor.
8. **Adaptadores de Firestore.** Los repositorios, el historial y la ampliación de `FirestoreUnitOfWork`, con tests de integración contra el emulador.
9. **Consultas.** `player-list-query.ts` (filtros, alcance, cursor y límite), `player-search-index-query.ts` (proyección por rol) y `player-history-query.ts`, más los índices en `firestore.indexes.json`, con tests de integración (paginación de punta a punta con más de una página).
10. **Rutas HTTP.** `playerApi`, el router, los handlers y los esquemas de cada ruta, más la exportación en `index.ts`, con tests de integración por HTTP por ruta (ver criterios) que reutilizan `callApi`.
11. **Reglas.** Tests en `test/rules/` que prueban que `players`, `players/{id}/history` y `guardians` niegan lectura y escritura a cualquier cliente.
12. **Seed y humo.** El seed crea jugadores y acudientes ficticios por grupo (idempotente). `smoke-dev.ts` inscribe, lista con cursor, consulta el índice, mueve de grupo, activa y lee el historial. Confirmar `smoke:emulator`.
13. **Documentación.** El ADR 0011 (módulo `player`, acudientes como entidad, historial en subcolección, índices y cursor, recorte del profesor), `functions/README.md`, `arquitectura.md`, `CLAUDE.md`, `ROADMAP.md` y la réplica de `docs/`. Pasar la spec a `Implemented`.

## Acceptance criteria

- [ ] Cada ruta nueva responde por HTTP así: sin token, `401`; con entrada inválida (campo faltante, valor fuera de rango o campo extra), `400`; con un usuario de otra organización, `403` sin cambios; con cada rol no autorizado, `403`.
- [ ] `POST …/players` crea un jugador `preinscrito` con su grupo, su sede y su categoría copiadas, vincula acudientes existentes y crea los nuevos en una sola transacción. Si la transacción falla, no queda ningún acudiente creado.
- [ ] Un documento repetido responde `409` con el `playerId` existente. El mismo nombre normalizado con la misma fecha de nacimiento responde `409` con candidatos, y con `confirmDuplicate: true` se crea.
- [ ] Un coordinador no puede inscribir, editar, mover ni cambiar el estado de un jugador fuera de sus sedes, ni moverlo a un grupo de otra sede (`403`). El profesor recibe `403` en toda escritura.
- [ ] Pasar a `activo` sin un responsable de pago o sin `dataConsent` responde `409`. Una transición no permitida o sin el motivo exigido responde `409` o `400`. `retirado → activo` reactiva el mismo perfil y conserva su historial.
- [ ] Cada cambio de grupo y de estado crea una entrada en `players/{id}/history` y su registro en `auditLog`, en la misma transacción.
- [ ] `GET …/players` pagina por cursor ordenado por nombre sin repetir ni saltar jugadores entre páginas, filtra por una ubicación y por estado, y respeta el alcance del coordinador y del profesor. Dos filtros de ubicación a la vez responden `400`.
- [ ] `GET …/players/search-index` devuelve los campos livianos de todos los jugadores visibles. Al profesor no le llegan `documentNumber` ni `guardianNames`.
- [ ] `GET …/players/:id` al profesor no incluye `document`, `guardians` ni `dataConsent`, y un jugador fuera de su grupo responde `403`.
- [ ] Al editar el nombre de un acudiente se actualiza `fullName` en todos los jugadores vinculados, en la misma transacción.
- [ ] Cada escritura deja su registro en `auditLog` con las acciones listadas, en la misma transacción que el cambio.
- [ ] `lint-boundaries.test.ts` sigue en verde: `player/domain` y `player/application` no importan Firebase, `zod`, `express` ni `infrastructure`.
- [ ] Los tests de reglas prueban que `players`, `history` y `guardians` niegan todo acceso de cliente. `firestore.rules` y `storage.rules` no cambian.
- [ ] `firestore.indexes.json` contiene los índices de la lista, y la lista funciona contra el emulador.
- [ ] `test:unit`, `test:rules` y `test:integration` pasan, con los tests de la línea base más los nuevos. `build`, `lint`, `typecheck` y `format:check` pasan sin errores ni advertencias.
- [ ] El seed crea jugadores y acudientes ficticios de forma idempotente. `smoke:emulator` pasa con los pasos nuevos, y tras desplegar a `escuelas-deportivas-dev` (funciones e índices), `smoke:dev` también.
- [ ] El CI pasa en un PR real hacia `dev`.
- [ ] El ADR 0011, `functions/README.md`, `arquitectura.md`, `CLAUDE.md` y `ROADMAP.md` describen el módulo, y `docs/` está replicado en los otros dos lugares.

## Decisiones

- **Sí: una spec con jugador y acudientes; familias y pagadores autorizados en la 07.** La regla "un jugador activo exige un acudiente responsable" los ata. _Decidido por el usuario el 2026-10-04._
- **No: todo §7.3 y §7.4 en una spec.** Sería demasiado grande para revisarla.
- **Sí: inscribe solo el personal; la autoinscripción del acudiente se difiere.** Los acudientes todavía no tienen cuenta. _Decidido por el usuario el 2026-10-04._
- **Sí: datos médicos y contacto de emergencia ahora; la foto, con documentos (§7.5).** La foto abre Storage y URLs firmadas (D-08). _Decidido por el usuario el 2026-10-04._
- **Sí: lista paginada e índice liviano (D-10).** Los dos mecanismos que acordó el plan. _Decidido por el usuario el 2026-10-04._
- **Sí: acudientes en la colección `guardians`, con vínculos en el jugador.** Los hermanos comparten acudiente sin duplicarlo, y la spec 07 se apoya en eso. _Decidido por el usuario el 2026-10-04._
- **No: acudientes embebidos en el jugador.** Se duplican, y C15 y C17 tendrían que migrar los datos.
- **Sí: cuatro estados manuales; "en mora" se calcula en la Fase 2.** _Decidido por el usuario el 2026-10-04._
- **No: guardar las fechas de pausa (C13) ahora.** Solo sirven para generar cobros.
- **Sí: el documento repetido bloquea; el mismo nombre con la misma fecha avisa y se confirma.** _Decidido por el usuario el 2026-10-04._
- **Sí: el profesor ve la ficha de sus grupos sin el documento ni los acudientes.** Ve lo que necesita en la cancha y nada más (§14, Q12). _Decidido por el usuario el 2026-10-04._
- **Sí: el grupo es obligatorio; la sede y la categoría se copian del grupo.** Hay una sola fuente de verdad, y el profesor ve al jugador desde que se inscribe. _Decidido por el usuario el 2026-10-04._
- **Sí: acudientes nuevos o existentes en la misma llamada de inscripción.** Es una transacción, sin acudientes huérfanos. _Decidido por el usuario el 2026-10-04._
- **Sí: un filtro de ubicación más el estado (7 índices).** El índice liviano cubre las combinaciones restantes en el cliente. _Decidido por el usuario el 2026-10-04._
- **Sí: el personal registra el consentimiento, y es requisito para activar.** _Decidido por el usuario el 2026-10-04._
- **Sí: el historial en la subcolección `history`.** El coordinador no ve la bitácora, y un arreglo crecería sin límite. _Decidido por el usuario el 2026-10-04._
- **Sí: el dueño, el auxiliar y el coordinador (s) cambian el estado y el grupo, según la matriz de §6.** _Decidido por el usuario el 2026-10-04._
- **Sí: el módulo `player` con `playerApi`, acudientes incluidos.** La inscripción cruza los dos en una transacción. _Decidido por el usuario el 2026-10-04._
- **Sí: seed y smoke test con datos ficticios.** No se cargan datos reales mientras Q12 esté abierta. _Decidido por el usuario el 2026-10-04._
- **Sí: copiar `fullName` del acudiente en el vínculo.** El índice liviano no hace una lectura por acudiente. Costo aceptado: al editar el nombre se actualizan los jugadores vinculados.
- **Sí: unicidad del documento por consulta dentro de la transacción.** Con unos 200 jugadores, el riesgo de carrera es bajo (ver Risks). Descartado por ahora: un documento llave por número de documento.

## Risks

| Riesgo                                                                          | Mitigación                                                                                                                                                              |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dos inscripciones simultáneas con el mismo documento pasan la verificación      | El riesgo es bajo con el volumen del piloto. Si aparece, se agrega un documento llave por `documentKey` (decisión anotada)                                              |
| Se cierra un grupo con jugadores activos                                        | Queda fuera de esta spec. Al mover o activar se exige un grupo activo, y la regla de cierre se decide en un cambio a la spec 02, junto con la del alcance de la spec 05 |
| Datos de menores en `dev`                                                       | Solo datos ficticios en el seed y el smoke test. Q12 debe resolverse antes de cargar datos reales                                                                       |
| Un índice compuesto faltante hace fallar la lista en `dev`                      | Los tests de integración usan los índices del archivo, y el deploy incluye `firestore` (ver `docs/guias/despliegue-con-red-inestable.md`)                               |
| El índice liviano crece con miles de jugadores                                  | Es aceptado por D-10. Se pasa a un buscador de servidor después del piloto                                                                                              |
| El cliente filtra un jugador por el `venueId` copiado y el grupo cambia de sede | El `venueId` del grupo es inmutable (spec 02), así que la copia no se desincroniza                                                                                      |

## What is **not** in this spec

- La foto, los documentos y las pólizas.
- Familias, hermanos, cuenta familiar y pagadores autorizados.
- La autoinscripción, la invitación de acudientes y jugadores adultos, y la edición por el acudiente.
- El estado "en mora", la matrícula, los cobros y las fechas de congelamiento.
- La importación desde Excel y los roles de plataforma.
- Cambios en `firestore.rules` o `storage.rules`.
