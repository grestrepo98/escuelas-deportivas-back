# ADR 0011 — Jugadores y acudientes: módulo `player`, historial, cursor y acceso por rol

- **Estado:** Aceptada. El acceso de acudientes se amplió después de la spec 06 y está pendiente de implementación backend; también falta el deploy a `dev` con `smoke:dev` y el CI en un PR real (ver "Verificación")
- **Fecha:** 2026-10-04
- **Spec:** `specs/06-jugadores-y-acudientes.md` · **Plan:** D-10 · **Producto:** §7.3, §7.4, C10, C12, C17
- **Se apoya en:** ADR 0007 (estructura), ADR 0009 (una API por módulo) y ADR 0010 (alcance por rol)

## Resumen

El personal de una organización (dueño, auxiliar y coordinador en sus sedes) inscribe
jugadores con sus acudientes, los ubica en un grupo, cambia su estado y los encuentra.
Todo vive en un módulo nuevo, `functions/src/player/`, con su API `playerApi` y 12
rutas. Los acudientes son una entidad propia (`guardians`), el historial de
movimientos es una subcolección y la lista pagina por cursor.

## Decisiones

| Tema | Decisión |
| --- | --- |
| Módulo | Un solo módulo `player` con jugadores y acudientes: la inscripción cruza los dos en una transacción. `auxiliar` de la spec es el rol `accountant` |
| Acudientes | Colección `guardians`, con el vínculo en el jugador (`guardians[]` y `guardianIds[]` para `array-contains`). Los hermanos comparten acudiente sin duplicarlo, que es lo que necesita la spec 07 (C15, C17) |
| Lectura del acudiente | Solo lectura de los jugadores indicados por `scope.playerIds`, derivados de vínculos de acudiente verificados; nunca consulta ni revela jugadores no vinculados. La proyección no incluye ids/contactos de acudientes, contacto de emergencia ni consentimiento. Los documentos quedan sujetos al filtro del módulo `documents` |
| Jugador adulto | `adultPlayer` conserva `403` en esta fase; el acceso propio requiere un flujo y una proyección especificados aparte |
| Copia de `fullName` | El vínculo guarda el nombre del acudiente para que el índice liviano no lea un acudiente por jugador. `UpdateGuardian` lo actualiza en los jugadores vinculados, en la misma transacción. Costo aceptado: editar un nombre reescribe esos jugadores |
| Ubicación | El grupo es obligatorio; `venueId` y `categoryId` se copian del grupo. El `venueId` del grupo es inmutable (spec 02), así que la copia no se desincroniza |
| Estados | Cuatro, manuales: `preinscrito`, `activo`, `pausado` y `retirado`. "En mora" se calcula en la Fase 2 y no se guarda. `pausado` y `retirado` exigen motivo; `retirado → preinscrito \| activo` reingresa el mismo perfil (C12) |
| Activar | Exige un responsable de pago, `dataConsent` y un grupo activo. Un jugador `activo` tiene exactamente un responsable, y quitarlo con `PUT …/guardians` es `409` |
| Consentimiento | Lo registra el personal (`dataConsent`: acudiente, quién y cuándo). No se borra al desvincular al acudiente: es el registro de que se dio |
| Duplicados | El documento repetido bloquea (`409` con el `playerId`). El mismo `nameKey` con la misma `birthDate` avisa (`409` con `duplicateCandidates`) y se acepta con `confirmDuplicate: true`. Un acudiente nuevo con documento existente es `409` con su `guardianId` |
| Unicidad | Por consulta dentro de la transacción. Con unos 200 jugadores el riesgo de carrera es bajo. Si aparece, se agrega un documento llave por `documentKey`; no se hizo ahora |
| Historial | Subcolección `players/{id}/history/{entryId}`, solo creación y con hora del servidor. El coordinador no ve la bitácora y un arreglo dentro del jugador crecería sin límite |
| Bitácora | Ocho acciones: `player.created`, `player.updated`, `player.placement_changed`, `player.status_changed`, `player.guardians_changed`, `player.consent_recorded`, `guardian.created` y `guardian.updated`, en la misma transacción que el cambio. **No guarda documentos ni datos médicos**, solo ids y los campos de ubicación y estado |
| Errores con detalle | `DomainError` gana un `details` opcional que el manejador HTTP incluye en el cuerpo (`{error: {code, message, details}}`). Lo usan los `409` de duplicados y de acudientes repetidos. Es aditivo: sin `details`, el cuerpo es el de siempre |

## Normalización

Funciones puras en `player/domain/normalize.ts`:

| Clave | Cómo se forma |
| --- | --- |
| `nameKey` | apellidos y luego nombres, en minúsculas, sin tildes y con espacios simples |
| `documentKey` | `TIPO:número`, sin puntos, espacios ni guiones, y sin ceros a la izquierda |

Las dos se calculan al escribir y se guardan; el cliente no las envía.

## Visibilidad por rol

Regla pura en `player/domain/player-visibility.ts`:

| Rol | Lee | Escribe |
| --- | --- | --- |
| `owner`, `accountant` | todo | sí |
| `coordinator` | `venueId ∈ scope.venueIds` | solo en sus sedes; mover exige que el origen y el destino sean de sus sedes |
| `teacher` | `groupId ∈ scope.groupIds`, **sin** `document`, `documentKey`, `guardians`, `guardianIds`, contactos de emergencia ni `dataConsent` | no |
| `guardian` | solo `playerIds ∈ scope.playerIds`, en proyección de solo lectura | no |
| `adultPlayer` | `403` | `403` |

El recorte del profesor es de la respuesta, no de la consulta: la ficha se lee entera y
`playerViewFor` quita los campos. Lo mismo hace el índice liviano (sin `documentNumber`
ni `guardianNames`). Los datos de contacto del acudiente están en `guardians`, y solo
`GET …/guardians` y `PUT …/guardians/:id` los sirven, a quien puede escribir.

El acudiente solo obtiene fichas cuyos ids están en su alcance `playerIds`, derivado
de vínculos de acudiente verificados; la visibilidad se comprueba también en lecturas
por id y en cada resultado del índice.
La respuesta omite ids y datos de contacto de acudientes, contactos de emergencia y
`dataConsent`. No puede listar acudientes, consultar historial ni modificar jugadores.
`adultPlayer` continúa en `403` hasta que tenga un flujo de autoservicio aprobado.

Un coordinador solo encuentra a un acudiente vinculado a un jugador de sus sedes:
`FindGuardian` responde `{guardian: null}` en vez de `403`, para no revelar que el
documento existe en otra sede. `UpdateGuardian`, que ya recibe el id, responde `403`.

## Lista paginada y cursor

`GET …/players` pagina por **cursor**, no por `offset` (D-10):

- Orden por `nameKey` y luego por el id del documento (`FieldPath.documentId()`), para que dos jugadores con el mismo nombre no se repitan ni se salten entre páginas.
- El cursor es opaco: `base64url` de `[nameKey, id]`. Uno inválido es `400`.
- `limit` de 50 por defecto y 100 como máximo. El resultado trae `nextCursor` (o `null` en la última página).
- Un solo filtro de ubicación (`venueId`, `categoryId` o `groupId`; dos a la vez son `400`) y `status` opcional.
- Sin filtro, el coordinador consulta `venueId in scope.venueIds` y el profesor `groupId in scope.groupIds` (`in` admite hasta 30 valores). Un filtro fuera de su alcance es `403`, salvo que un profesor filtre por `venueId` o `categoryId`: recibe una lista vacía, no `403`, porque su alcance son grupos.
- La consulta de Firestore solo estrecha. La regla de visibilidad del dominio se vuelve a aplicar a cada resultado, así que si la consulta se equivocara no se filtraría nada de más. Cuando el filtro de dominio descarta resultados, se piden lotes hasta llenar la página.

### Índices compuestos

Siete, sobre la colección `players` (`firestore.indexes.json`): `(venueId, nameKey)`,
`(categoryId, nameKey)`, `(groupId, nameKey)`, `(status, nameKey)`,
`(venueId, status, nameKey)`, `(categoryId, status, nameKey)` y
`(groupId, status, nameKey)`. Cubren un filtro de ubicación más el estado; el índice
liviano cubre las demás combinaciones en el cliente.

**El emulador de Firestore no exige índices compuestos**, así que los tests de
integración no los prueban. Por eso un test unitario (`player-indexes.test.ts`) fija
el archivo a esos siete, y la comprobación real es el `smoke:dev` tras desplegar
`firestore`.

## Índice liviano

`GET …/players/search-index` devuelve `{id, fullName, documentNumber?, guardianNames?, status, groupId}`
de todos los jugadores visibles, para que el cliente busque sin pedir al servidor
por cada tecla (D-10). Crece con la organización; con miles de jugadores se pasa a un
buscador de servidor después del piloto.

## Rutas

El `tenantId` va en la ruta, el actor sale del token y los cuerpos usan zod `.strict()`
(ADR 0009). Un cuerpo inválido es `400` antes de consultar la membresía, como en las
rutas existentes.

| Método y ruta | Quién | Respuesta |
| --- | --- | --- |
| `POST /tenants/:tenantId/players` | personal | `201 {playerId, status: "preinscrito", createdGuardianIds}` |
| `GET /tenants/:tenantId/players` | personal, profesor, acudiente (solo vinculados) | `200 {players, nextCursor}` |
| `GET /tenants/:tenantId/players/search-index` | personal, profesor, acudiente (solo vinculados y recortado) | `200 {entries}` |
| `GET /tenants/:tenantId/players/:playerId` | personal, profesor, acudiente (solo vinculado) | `200` ficha (recortada por rol) |
| `PUT /tenants/:tenantId/players/:playerId` | personal | `200 {playerId}` |
| `PUT /tenants/:tenantId/players/:playerId/placement` | personal | `200 {playerId, groupId, venueId, categoryId}` |
| `PATCH /tenants/:tenantId/players/:playerId/status` | personal | `200 {playerId, status}` |
| `PUT /tenants/:tenantId/players/:playerId/guardians` | personal | `200 {playerId, createdGuardianIds}` |
| `PUT /tenants/:tenantId/players/:playerId/consent` | personal | `200 {playerId, dataConsent}` |
| `GET /tenants/:tenantId/players/:playerId/history` | personal, profesor | `200 {entries}` (más recientes primero) |
| `GET /tenants/:tenantId/guardians` | personal | `200 {guardian \| null}` |
| `PUT /tenants/:tenantId/guardians/:guardianId` | personal | `200 {guardianId}` |

"Personal" es dueño, auxiliar y coordinador. `search-index` se registra antes de
`/players/:playerId` para que Express no lo tome por un id.

## Transacciones

`TransactionContext` gana `players`, `guardians` y `playerHistory`. Firestore exige
leer antes de escribir, así que `resolveGuardianLinks` solo lee (devuelve los acudientes
por crear) y el caso de uso escribe después. La inscripción crea acudientes nuevos,
el jugador y la bitácora en una sola transacción (el historial empieza con el primer
cambio de grupo o de estado, no con la inscripción): si falla, no queda ningún acudiente.

`PlayerHistoryWriter.append` recibe la entrada sin `id` ni `at`: el adaptador los
asigna (id nuevo y hora del servidor), igual que la bitácora.

## Riesgos y consecuencias

| Riesgo | Mitigación |
| --- | --- |
| Dos inscripciones simultáneas con el mismo documento | Riesgo bajo con el volumen del piloto. Documento llave por `documentKey` si aparece |
| Se cierra un grupo con jugadores activos | Fuera de esta spec. Al mover o activar se exige un grupo activo; la regla de cierre se decide en un cambio a la spec 02, junto con la del alcance de la spec 05 |
| Un índice compuesto faltante rompe la lista en `dev` | El deploy incluye `firestore`; `smoke:dev` filtra por estado y sede. El emulador no lo detecta (ver "Índices compuestos") |
| Datos de menores en `dev` | Seed y smoke con datos ficticios (`@seed.escuelas.test`, documentos inventados). Q12 debe resolverse antes de cargar datos reales |
| El índice liviano crece con la organización | Aceptado por D-10; buscador de servidor después del piloto |
| Un `409` con `details` expone a otro jugador | Solo el personal con acceso a esa organización llega ahí; los candidatos llevan id, nombres, fecha de nacimiento y estado. Un coordinador puede ver así a un jugador de otra sede al inscribir: es la defensa contra duplicados y se acepta |
| La copia de `fullName` queda vieja si falla la propagación | Se escribe en la misma transacción que el acudiente; o se actualiza todo o nada |

## Verificación

- `test:unit` (709), `test:integration` (707), `test:rules` (339), `lint`, `typecheck`, `format:check`, `build` y `smoke:emulator` pasan en local para el alcance original de la spec 06.
- Pendiente de implementar y probar: lecturas recortadas de acudiente, con autorización por `scope.playerIds`; `adultPlayer` permanece denegado.
- El seed crea 9 jugadores y 10 acudientes ficticios por organización `tenant-a`, de forma idempotente; el smoke test inscribe uno propio y lo borra al terminar.
- Pendiente: desplegar funciones e índices a `escuelas-deportivas-dev`, correr `seed:dev` y `smoke:dev`, y el CI en un PR real hacia `dev`.
