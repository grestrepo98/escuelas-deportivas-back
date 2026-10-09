# Arquitectura del backend

Estado: refleja lo construido por las specs 01 (fundaciones), 02 (estructura de
la organización), 03 (reestructura modular de `functions`), 04 (una API HTTP con
Express por módulo, **ADR 0009**), 05 (usuarios y alcance, **ADR 0010**), 06
(jugadores y acudientes, **ADR 0011**) y 07 (documentos y pólizas con URLs
firmadas, **ADR 0013**). Las decisiones numeradas (D-xx) están en
`plan-tecnico.md`; las de cada spec, en `adr/`.

## Capas

Todo el código vive en `functions/src`, organizado **por módulo** (`audit`,
`membership`, `tenant`, `structure`, `player`, `document`) más `shared/` y `scripts/`. Cada módulo
tiene tres capas (ADR 0008):

```
┌──────────────────────────────────────────────────────────────┐
│ Cliente (escuelas-front): solo llama a las APIs HTTP         │
└──────────────────────────────┬───────────────────────────────┘
                               │ HTTPS + ID token de Firebase Auth
┌──────────────────────────────▼───────────────────────────────┐
│ <módulo>/infrastructure/http   (borde, Express)              │
│   token → zod → autorización por membresía → caso de uso     │
├──────────────────────────────────────────────────────────────┤
│ <módulo>/application   casos de uso + PUERTOS (interfaces)   │
│ <módulo>/domain        entidades y reglas puras              │
├──────────────────────────────────────────────────────────────┤
│ <módulo>/infrastructure/firestore  (implementan los puertos) │
└──────────────────────────────┬───────────────────────────────┘
                               │ Admin SDK
                          Firestore
```

| Capa | Contiene | Puede importar |
| --- | --- | --- |
| `domain` | entidades, validadores y funciones puras | `shared/domain` y el `domain` de otros módulos |
| `application` | casos de uso, puertos y sus dobles en memoria (`testing/`) | `domain` y `application` |
| `infrastructure` | adaptadores de Firestore, routers Express (`http/`), `authorize` | todo, incluidos Firebase y zod |

La dependencia apunta hacia adentro. Lo hace cumplir ESLint
(`no-restricted-imports` en `functions/.eslintrc.js`) y lo prueba
`test/unit/shared/infrastructure/lint-boundaries.test.ts`: `domain` y `application` no
importan Firebase, `@google-cloud/*` ni `zod`, y ninguno importa `infrastructure`.
`shared/application/unit-of-work.ts` es la única excepción de composición (ADR 0008).

**Todo pasa por la API HTTP del módulo (D-03, ADR 0009).** Cada módulo expone una
sola Cloud Function `onRequest` (`membershipApi`, `tenantApi`, `structureApi`, `playerApi`, `documentApi`) con una
app Express adentro. Express vive solo en `infrastructure/http`; `domain` y
`application` no lo importan. El cliente nunca toca Firestore ni Storage:
`firestore.rules` y `storage.rules` son `allow read, write: if false`, y
`test:rules` lo demuestra con tres tipos de llamante sobre cada colección.

## Casos de uso y rutas

| API | Ruta | Caso de uso (`application`) | Quién | ADR |
| --- | --- | --- | --- | --- |
| `membershipApi` | `GET /me/memberships` | lectura pura (consulta en el adaptador) | cualquier sesión | 0002 |
| `membershipApi` | `PATCH /tenants/:tenantId/memberships/:uid/role` | `ChangeMembershipRole` (con `scope`) | `owner` | 0004, 0010 |
| `membershipApi` | `POST /tenants/:tenantId/memberships` | `InviteMember` | `owner` | 0010 |
| `membershipApi` | `GET /tenants/:tenantId/memberships` | `ListMemberships` | `owner`, `accountant`, `coordinator` (sus sedes) | 0010 |
| `membershipApi` | `PATCH /tenants/:tenantId/memberships/:uid/status` | `SetMembershipStatus` | `owner` | 0010 |
| `membershipApi` | `PUT /tenants/:tenantId/memberships/:uid/scope` | `SetMembershipScope` | `owner` | 0010 |
| `tenantApi` | `PUT /tenants/:tenantId/profile` | `UpdateTenantProfile` | `owner` | 0007 |
| `structureApi` | `POST /tenants/:tenantId/venues`, `PUT …/venues/:id`, `PATCH …/venues/:id/status` | `SaveVenue`, `SetVenueStatus` | `owner` | 0007 |
| `structureApi` | las mismas tres rutas para `categories` | `SaveCategory`, `SetCategoryStatus` | `owner` | 0007 |
| `structureApi` | las mismas tres rutas para `groups` | `SaveGroup`, `SetGroupStatus` | `owner` | 0007 |
| `structureApi` | `GET /tenants/:tenantId/structure` | `visibleStructure` (función pura) sobre la lectura del tenant | por rol y alcance | 0007 |
| `playerApi` | `POST /tenants/:tenantId/players` | `EnrollPlayer` | `owner`, `accountant`, `coordinator` (sus sedes) | 0011 |
| `playerApi` | `GET /tenants/:tenantId/players` | lectura pura (`listPlayers`: cursor, filtros, alcance) | personal, `teacher` (sus grupos) y `guardian` (solo vinculados) | 0011 |
| `playerApi` | `GET /tenants/:tenantId/players/search-index` | lectura pura (`readPlayerSearchIndex`) | personal, `teacher` y `guardian`, siempre recortado por alcance | 0011 |
| `playerApi` | `GET /tenants/:tenantId/players/:playerId` | `GetPlayer` | personal, `teacher` (recortado) y `guardian` (solo vinculado) | 0011 |
| `playerApi` | `PUT /tenants/:tenantId/players/:playerId` | `UpdatePlayer` | personal | 0011 |
| `playerApi` | `PUT …/players/:playerId/placement` | `ChangePlayerPlacement` | personal | 0011 |
| `playerApi` | `PATCH …/players/:playerId/status` | `ChangePlayerStatus` | personal | 0011 |
| `playerApi` | `PUT …/players/:playerId/guardians` | `SetPlayerGuardians` | personal | 0011 |
| `playerApi` | `PUT …/players/:playerId/consent` | `RecordDataConsent` | personal | 0011 |
| `playerApi` | `GET …/players/:playerId/history` | lectura pura (`readPlayerHistory`) | personal y `teacher` | 0011 |
| `playerApi` | `GET /tenants/:tenantId/guardians` | `FindGuardian` | personal | 0011 |
| `playerApi` | `PUT /tenants/:tenantId/guardians/:guardianId` | `UpdateGuardian` | personal | 0011 |
| `documentApi` | `POST …/players/:playerId/documents/uploads` | `RequestUpload` (URL de subida firmada) | personal | 0013 |
| `documentApi` | `POST …/players/:playerId/documents` | `RecordDocument` (confirma la subida o registra una póliza sin archivo) | personal | 0013 |
| `documentApi` | `GET …/players/:playerId/documents` | `ListPlayerDocuments` | personal y `teacher` (solo `photo` y `policy` de sus grupos) | 0013 |
| `documentApi` | `GET …/players/:playerId/documents/:documentId/download-url` | `GetDownloadUrl` (URL firmada de 5 minutos) | personal y `teacher` (solo `photo` y `policy`) | 0013 |
| `documentApi` | `GET /tenants/:tenantId/categories/:categoryId/policies` | `ListCategoryPolicies` | personal (el coordinador, solo sus sedes) | 0013 |

"Personal" es `owner`, `accountant` (el "auxiliar" de la spec) y `coordinator`, este
último solo en sus sedes.

## Puertos y adaptadores

| Puerto (`application`) | Adaptador (`infrastructure/firestore`) | Doble de prueba (`application/testing`) |
| --- | --- | --- |
| `MembershipRepository` | `FirestoreMembershipRepository` | `InMemoryMembershipRepository` |
| `TenantRepository` | `FirestoreTenantRepository` | `InMemoryTenantRepository` |
| `VenueRepository`, `CategoryRepository`, `GroupRepository` (todos `StructureRepository<T>`) | `FirestoreStructureRepository<T>` + un mapper por entidad | `InMemoryStructureRepository<T>` |
| `IdentityProvider` (cuentas de Auth; no es transaccional) | `FirebaseIdentityProvider` (`infrastructure/firebase`) | `InMemoryIdentityProvider` |
| `MembershipDeactivationGuard` (gancho de C21) | el de la Fase 2 (caja abierta) | `AllowAllDeactivationGuard` (el que rige hoy), `RejectingDeactivationGuard` |
| `PlayerRepository` | `FirestorePlayerRepository` | `InMemoryPlayerRepository` |
| `GuardianRepository` | `FirestoreGuardianRepository` | `InMemoryGuardianRepository` |
| `PlayerHistoryWriter` | `FirestorePlayerHistoryWriter` | `InMemoryPlayerHistoryWriter` |
| `DocumentRepository` | `FirestoreDocumentRepository` | `InMemoryDocumentRepository` |
| `FileStorage` (Cloud Storage; no es transaccional) | `GcsFileStorage` (`infrastructure/storage`, URLs v4) y `EmulatorFileStorage` (solo con el emulador de Functions) | `InMemoryFileStorage` |
| `PlayerReader` (sede, grupo y categoría del jugador, sin importar `player`) | `FirestorePlayerReader` | `InMemoryPlayerReader` |
| `AuditLogWriter` | `FirestoreAuditLogWriter` | `InMemoryAuditLogWriter` |
| `UnitOfWork` | `FirestoreUnitOfWork` (`runTransaction`) | `InMemoryUnitOfWork` (snapshot y rollback) |
| `Clock` | `systemClock` | `FakeClock` |

Cada puerto, su adaptador y su doble viven en su módulo; `UnitOfWork` y `Clock`
son de `shared`.

`UnitOfWork.run(work)` entrega a `work` repositorios **ligados a la
transacción** (`memberships`, `tenants`, `venues`, `categories`, `groups`, `players`,
`guardians`, `playerHistory`, `documents` y `auditLog`): o se confirma todo (cambio + bitácora) o nada. Firestore exige leer
antes de escribir y puede reintentar la función, así que el trabajo no debe tener
efectos fuera del contexto recibido.

`MembershipRepository` suma `listByTenant` (todas las membresías del tenant, y el
caso de uso filtra en memoria). `IdentityProvider` y `MembershipDeactivationGuard`
**no** forman parte de `UnitOfWork`: Auth no entra en la transacción de Firestore,
por eso `InviteMember` crea la cuenta entre dos transacciones (ADR 0010). Tampoco
`FileStorage` ni `PlayerReader`: se inyectan en el constructor del caso de uso. Por eso
`RecordDocument` valida y mueve el archivo antes de escribir, y un reintento del confirmar
completa lo que quedó a medias (ADR 0013).

`StructureRepository<T>` expone `newId()`, `get`, `save` y `listByTenant`. No hay
búsquedas por nombre ni por padre: los casos de uso filtran `listByTenant` en
memoria (decenas de documentos por tenant, sin índices compuestos).

Los puertos de pagos y recibos (D-02, D-18, D-19) no existen todavía: se crean
en la Fase 2.

### Lecturas

- Las lecturas del módulo `player` (lista, índice liviano e historial) son consultas
  de `player/infrastructure/firestore/` con la visibilidad pura del dominio. La lista
  pagina por cursor y exige siete índices compuestos (ADR 0011).
- Los listados del módulo `document` son casos de uso (`ListPlayerDocuments`,
  `ListCategoryPolicies`) que calculan el estado de la póliza al leer con `Clock`; el
  alcance sale del jugador, leído en cada petición. Exigen dos índices compuestos
  (ADR 0013).

- `GET /me/memberships` no pasa por el dominio: es una consulta de lectura
  (`membership/infrastructure/firestore/my-memberships-query.ts`).
- `GET /tenants/:tenantId/structure` lee con `readStructure` (`structure/infrastructure/firestore/structure-query.ts`),
  descarta lo cerrado salvo `includeClosed`, aplica `visibleStructure` del dominio
  y devuelve DTO con fechas ISO 8601 en UTC y sin `tenantId`.

## Modelo de datos

```
memberships/{uid}_{tenantId}          # excepción a "todo bajo tenants/" (ADR 0002)
tenants/{tenantId}                    # ficha: name, status, idrdRegistration?, contact
tenants/{tenantId}/venues/{id}        # sedes
tenants/{tenantId}/categories/{id}    # categorías (birthYears opcional)
tenants/{tenantId}/groups/{id}        # grupos: una sola sede (venueId inmutable), horario
tenants/{tenantId}/players/{id}       # jugadores: grupo, sede y categoría copiadas, estado, vínculos
tenants/{tenantId}/players/{id}/history/{id}  # cambios de grupo y de estado, solo creación
tenants/{tenantId}/guardians/{id}     # acudientes, compartidos entre jugadores
tenants/{tenantId}/documents/{id}     # documentos de un jugador: versiones, póliza opcional
tenants/{tenantId}/policyWarningDays  # campo de la ficha: días de aviso de vencimiento (30)
tenants/{tenantId}/auditLog/{id}      # solo creación
```

- Fechas en UTC (`Timestamp` en Firestore, `Date` en el dominio); Bogotá es solo presentación.
- Excepción: el horario de un grupo es **hora de pared** (`"HH:mm"`, día ISO 1–7),
  no un instante (ADR 0007).
- El `id` y el `tenantId` de sedes, categorías, grupos, jugadores y acudientes
  viven en la ruta, no en el documento.
- Cloud Storage (solo URLs firmadas, nunca acceso directo): las subidas pendientes viven
  en `uploads/{tenantId}/{uploadId}` y una regla de ciclo de vida las borra a 1 día; al
  confirmar pasan a `tenants/{t}/players/{p}/documents/{documentId}` (ADR 0013).
- La bitácora se escribe con `create` sobre un id nuevo y `at` = hora del servidor.
- Nada se borra: sedes, categorías y grupos pasan a `closed`, y un jugador pasa a
  `retirado` (el perfil y su historial se conservan).

## Autorización (D-05, D-06)

No hay claims de tenant ni de rol. En cada petición:

1. El header `Authorization: Bearer <idToken>` debe traer un token válido (`401`).
2. El `tenantId` de la ruta **no se confía**: se lee `memberships/{uid}_{tenantId}`.
3. Sin membresía activa: `403` (mismo mensaje si no existe o está inactiva).
4. El caso de uso aplica las reglas de rol: las escrituras de estructura exigen
   `owner` (`requireOwner`); la ruta de estructura aplica la tabla de visibilidad.

Desactivar una membresía (`PATCH …/status`) corta el acceso en la **siguiente**
llamada, en cualquier ruta, sin revocar tokens ni tocar la cuenta de Auth. Quién
puede invitar, cambiar alcance y activar o desactivar, y qué ve cada rol en el
listado de miembros, está en el ADR 0010.

### Visibilidad de `GET /tenants/:tenantId/structure`

| Rol | Ve |
| --- | --- |
| `owner`, `accountant` | Todo |
| `coordinator` | Sus sedes, los grupos de esas sedes y todas las categorías |
| `teacher` | Sus grupos, las sedes y categorías de esos grupos |
| `guardian`, `adultPlayer` | `403` |

Un `coordinator` o `teacher` con `scope` vacío ve todo vacío. Detalle en el ADR 0007.

### Visibilidad de los jugadores

| Rol | Ve |
| --- | --- |
| `owner`, `accountant` | Todo |
| `coordinator` | Los jugadores de sus sedes |
| `teacher` | Los de sus grupos, sin `document`, `guardians`, contactos de emergencia ni `dataConsent` |
| `guardian` | Solo los jugadores de `scope.playerIds`, sin ids/contactos de acudientes, contacto de emergencia ni `dataConsent` |
| `adultPlayer` | `403` hasta que exista un flujo de autoservicio aprobado |

Detalle y reglas de escritura en el ADR 0011.

### Visibilidad de los documentos

| Rol | Lee | Escribe |
| --- | --- | --- |
| `owner`, `accountant` | Todos los tipos | Sí |
| `coordinator` | Todos los tipos de los jugadores de sus sedes | Solo en sus sedes |
| `teacher` | Solo `photo` y `policy` de los jugadores de sus grupos | No |
| `guardian`, `adultPlayer` | `403` | `403` |

La sede y el grupo se leen del jugador en cada petición; no se copian al documento.
Detalle en el ADR 0013.

## Flujo de punta a punta: `changeMembershipRole`

```mermaid
sequenceDiagram
    participant C as Cliente
    participant F as membershipApi PATCH …/memberships/:uid/role
    participant A as authorizeTenantMember
    participant U as ChangeMembershipRole (application)
    participant DB as Firestore (transacción)

    C->>F: PATCH /tenants/{tenantId}/memberships/{targetUid}/role {newRole, reason?} + ID token
    F->>F: authenticate: verifyIdToken (si falla: 401)
    F->>F: zod: validar entrada (si falla: 400)
    F->>A: ¿membresía activa del actor en tenantId?
    A->>DB: get memberships/{actor}_{tenantId}
    A-->>F: ok / 403
    F->>U: execute({tenantId, actorUid, targetUid, newRole, reason, device})
    U->>DB: leer actor, leer objetivo, contar owners activos
    U->>U: reglas (solo owner, existe, rol distinto, queda un owner)
    U->>DB: guardar membresía + crear entrada de bitácora
    DB-->>U: commit atómico (o rollback total)
    U-->>F: {membershipId, role}
    F->>F: DomainError → estado HTTP (error-handler)
    F-->>C: {membershipId, role}
```

Reglas del caso de uso (ADR 0004): solo un `owner` activo del mismo tenant; el
objetivo debe existir en ese tenant; el rol nuevo debe diferir; el tenant
conserva al menos un `owner` activo. Desde la spec 05 el rol y el `scope` cambian
juntos (obligatorio para `coordinator` y `teacher`, vacío para `owner` y
`accountant`; ADR 0010).

Las escrituras de estructura (spec 02) siguen el mismo flujo, con tres
diferencias: el caso de uso lee sedes, categorías o grupos (no membresías
objetivo), la bitácora lleva `before`/`after` de la entidad, y cerrar o reabrir
revalida a los padres y a los hijos (por ejemplo, no se cierra una sede con
grupos activos).

## Errores

El cuerpo de todo error es `{error: {code, message}}` (ADR 0009).

| Error | Estado HTTP | Ejemplo |
| --- | --- | --- |
| sin token o token inválido | `401` | petición sin `Authorization` |
| `permission_denied` | `403` | un no-`owner` intenta escribir |
| `not_found` y ruta desconocida | `404` | la sede no existe en ese tenant |
| `failed_precondition` | `409` | nombre repetido; cerrar con hijos activos |
| `invalid_argument` | `400` | nombre en blanco; horario con `end <= start` |
| cualquier otro | `500` (mensaje genérico) | |

La forma de la entrada la rechaza zod en el borde (también `400`, con los nombres
de los campos y nunca sus valores); las reglas de negocio de los valores, el
dominio.

## Pruebas

| Suite | Qué prueba | Emulador |
| --- | --- | --- |
| `test:unit` | dominio y casos de uso con dobles, las fronteras de capas, los índices de `players` y `documents` y la regla de ciclo de vida de `uploads/` | no |
| `test:rules` | Firestore y Storage deniegan todo al cliente, también en sedes, categorías y grupos | Firestore + Storage |
| `test:integration` | adaptadores, atomicidad, rutas de las APIs por HTTP (las de documentos suben y bajan archivos de verdad), seed, alta de organización | Auth + Firestore + Functions + Storage |
| `smoke:dev` / `smoke:emulator` | APIs desplegadas (o locales) de punta a punta; `smoke:dev` prueba la firma real de URLs | Functions desplegadas / emuladores |

Los emuladores usan proyectos `demo-*`, sin acceso a la nube.

## Scripts de operación

| Comando | Qué hace |
| --- | --- |
| `npm run seed:emulator` / `seed:dev` | datos de prueba idempotentes: usuarios, estructura, 10 acudientes, 9 jugadores y 7 documentos ficticios con sus archivos (ADR 0005, 0007, 0011 y 0013) |
| `npm run tenant:create -- --target … --tenant-id … --name … --owner-email …` | alta de una organización con su dueño (ADR 0007) |

Se corren desde `functions/`. Ambos exigen `--target` y no existe `prod`.

## Empaquetado y despliegue

`functions/` es el único paquete npm y se empaqueta con esbuild a `lib/index.js`
(entrada `src/index.ts`; ADR 0008, que reemplaza al 0001). Los scripts de
operación no viajan al despliegue. Región `us-central1`
(ADR 0003). Este repo despliega `functions`, `firestore` y `storage`; el front
despliega solo hosting.
