# SPEC 02 — Estructura de la organización (Fase 1 técnica, parte 1)

> **Status:** Implemented
> **Depends on:** SPEC 01 (`specs/01-fundaciones-backend.md`). Contexto en `docs/plan-tecnico.md` (Fase 1) y `docs/producto.md` (§7.1, §7.19, §6).
> **Date:** 2026-10-03
> **Objective:** Que el dueño gestione la ficha de su organización, sedes, categorías y grupos por callables auditadas, que cada rol lea solo la estructura de su alcance, y que el equipo cree una organización con su dueño mediante un script.

---

## Por qué existe esta spec

La Fase 1 trae 7 módulos (7.1, 7.2, 7.3, 7.4, 7.5, 7.18, 7.19) y no cabe en una spec. Jugadores, alcance de usuarios, documentos e importación cuelgan de sedes, categorías y grupos, así que la estructura va primero. Es la primera vez que el backend tiene escrituras de negocio distintas al cambio de rol: fija el patrón (caso de uso + puerto + adaptador + callable + bitácora) que repetirán las specs siguientes.

## Scope

**In:**

- Ficha de la organización editable por el dueño: `name`, `idrdRegistration`, `contact { email, phone }`.
- Sedes (`venues`), categorías (`categories`) y grupos (`groups`) bajo `tenants/{tenantId}/`: crear, editar, cerrar y reabrir. Nada se borra.
- Horario estructurado por grupo (día de la semana, hora de inicio y fin, hora local de Bogotá).
- Categorías por organización con años de nacimiento opcionales.
- Callable de lectura `getStructure` que devuelve el árbol filtrado por el alcance de la membresía.
- Entrada de bitácora por cada escritura, en la misma transacción.
- Script `scripts/create-tenant.ts` (Admin SDK): crea el tenant, el usuario dueño en Auth y su membresía `owner`, e imprime un enlace de restablecimiento de contraseña.
- Seed ampliado con sedes, categorías y grupos, y con el `scope` de coordinador y profesor apuntando a ellos.
- Tests de rules ampliados a las nuevas subcolecciones; humo en `dev` ampliado.
- Documentación: ADR 0007, `docs/arquitectura.md`, READMEs.

**Out of scope (para otras specs; ver `specs/ROADMAP.md`):**

- Asignar coordinador a sede o profesor a grupo: es cambio de `scope` de membresía, va con usuarios (7.2).
- Invitación, activación y desactivación de usuarios (7.2), y correo (Q11).
- Logo de la organización: necesita URLs firmadas (D-08), llega con documentos (7.5).
- Calendario de temporada y pausas (C13): su consumidor es la generación de cobros, Fase 2.
- Deportes o programas como entidad: el piloto es solo fútbol.
- Roles de plataforma y callable de alta de tenant (7.19 completo, F3).
- Jugadores, acudientes, documentos, importación.
- Mover un grupo de sede.

## Data model

```ts
// tenants/{tenantId}   (se amplía el documento de la spec 01)
type Tenant = {
  name: string;
  status: "active" | "suspended";
  idrdRegistration?: string;
  contact: { email?: string; phone?: string };
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

type StructureStatus = "active" | "closed";

// tenants/{tenantId}/venues/{venueId}
type Venue = {
  name: string; // único entre las sedes activas del tenant
  address: string;
  facility?: string; // escenario, p. ej. "Cancha sintética 2"
  status: StructureStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

// tenants/{tenantId}/categories/{categoryId}
type Category = {
  name: string; // único entre las categorías activas del tenant
  birthYears: number[]; // enteros; vacío = categoría por nivel
  status: StructureStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

// tenants/{tenantId}/groups/{groupId}
type Group = {
  venueId: string; // inmutable: un grupo pertenece a una sola sede
  categoryId: string;
  name: string; // único entre los grupos activos de la misma sede
  schedule: ScheduleSlot[];
  status: StructureStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

type ScheduleSlot = {
  weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7; // ISO 8601, 1 = lunes
  start: string; // "HH:mm", hora de pared America/Bogota
  end: string; // "HH:mm", mayor que start
};
```

Bitácora: `AuditAction` suma `tenant.updated`, `venue.created`, `venue.updated`, `venue.closed`, `venue.reopened` y los equivalentes de `category.*` y `group.*`. `target.type` suma `"tenant" | "venue" | "category" | "group"`.

Contratos (zod en `functions/src/callables/<nombre>/schema.ts`):

```ts
// updateTenantProfile
input:  { tenantId; name; idrdRegistration?; contact: { email?; phone? } }
output: { tenantId }

// saveVenue        (sin venueId = crear)
input:  { tenantId; venueId?; name; address; facility? }
output: { venueId }

// setVenueStatus
input:  { tenantId; venueId; status: "active" | "closed"; reason? }
output: { venueId; status }

// saveCategory / setCategoryStatus   (misma forma, con birthYears)
// saveGroup / setGroupStatus         (venueId solo al crear; categoryId, name, schedule)

// getStructure
input:  { tenantId; includeClosed?: boolean }
output: { venues: VenueDto[]; categories: CategoryDto[]; groups: GroupDto[] }
```

Visibilidad de `getStructure` (§6, matriz "Sedes, categorías, grupos"):

| Rol                       | Ve                                                           |
| ------------------------- | ------------------------------------------------------------ |
| `owner`, `accountant`     | Todo                                                         |
| `coordinator`             | Sedes de `scope.venueIds`, sus grupos y todas las categorías |
| `teacher`                 | Grupos de `scope.groupIds`, sus sedes y sus categorías       |
| `guardian`, `adultPlayer` | Nada: `permission-denied`                                    |

Un `coordinator` o `teacher` con `scope` vacío ve listas vacías (vacío solo significa "sin restricción" para `owner`/`accountant`, spec 01).

Convenciones: IDs autogenerados por Firestore; fechas en UTC; solo el `owner` escribe; errores con los mismos códigos de la spec 01.

## Implementation plan

TDD en cada paso (test que falla primero). Un commit convencional por paso.

1. **Dominio: entidades y validación.** `packages/domain/src/structure/` con `Venue`, `Category`, `Group`, `ScheduleSlot` y validadores puros (horario, años, nombres). Tests de bordes: `end <= start`, `weekday` fuera de 1–7, año no entero.
2. **Dominio: puertos y bitácora.** `TenantRepository`, `VenueRepository`, `CategoryRepository`, `GroupRepository` (cada uno con `newId()`), agregados a `TransactionContext` (`ports/unit-of-work.ts`); ampliar `AuditAction` y `target.type` (`audit/audit-entry.ts`); fakes en `packages/domain/test/fakes/`.
3. **Dominio: casos de uso de sede.** `SaveVenue` y `SetVenueStatus`: solo `owner` activo; nombre único entre activas; cerrar con grupos activos → `failed-precondition`; bitácora con `before`/`after`.
4. **Dominio: casos de uso de categoría.** `SaveCategory`, `SetCategoryStatus`; cerrar con grupos activos → `failed-precondition`.
5. **Dominio: casos de uso de grupo.** `SaveGroup`, `SetGroupStatus`: sede y categoría deben existir y estar activas al crear o reabrir; `venueId` inmutable; nombre único entre activos de la sede.
6. **Dominio: ficha y visibilidad.** `UpdateTenantProfile` y la función pura `visibleStructure(membership, structure)` que aplica la tabla de visibilidad.
7. **Adaptadores Firestore.** `functions/src/adapters/firestore/` con repositorios y mappers de las tres colecciones y de la ficha; ampliar `firestore-unit-of-work.ts`. Test de atomicidad: si falla la bitácora, la sede no cambia.
8. **Callables de sede y ficha.** `updateTenantProfile`, `saveVenue`, `setVenueStatus`, con `authorizeTenantMember` (`functions/src/shared/authorize.ts`); tests de contrato y aislamiento entre tenants.
9. **Callables de categoría y grupo.** `saveCategory`, `setCategoryStatus`, `saveGroup`, `setGroupStatus`.
10. **Callable `getStructure`.** Lee las tres colecciones del tenant (decenas de documentos) y aplica `visibleStructure`; sin índices compuestos.
11. **Rules.** Ampliar `test:rules` con `venues`, `categories` y `groups` (sin sesión, propio tenant, otro tenant).
12. **Script de alta.** `scripts/create-tenant.ts` y `npm run tenant:create` (`--target emulator|dev`, `--tenant-id`, `--name`, `--owner-email`): falla si el tenant existe; reutiliza el usuario de Auth si ya existe; imprime `generatePasswordResetLink`. Test de integración con el emulador.
13. **Seed.** `scripts/seed-lib.ts` agrega 2 sedes, 2 categorías y 3 grupos con IDs fijos en `tenant-a`, una sede en `tenant-b`, y el `scope` del coordinador y profesor seed apuntando a ellos. Sigue idempotente.
14. **Humo.** `scripts/smoke-dev.ts` suma: el coordinador seed ve solo su sede en `getStructure`; el `owner` crea y cierra una sede de prueba y queda su bitácora.
15. **Documentación.** ADR 0007 (decisiones de esta spec), `docs/arquitectura.md`, READMEs, `CLAUDE.md` (estado y comandos), fila 02 de `specs/ROADMAP.md`; replicar `docs/` en `../escuelas-front/docs/` y `../docs/`.
16. **Despliegue a `dev`.** Desplegar, correr el seed y `npm run smoke:dev`.

## Acceptance criteria

- [ ] `npm run build`, `npm run lint` y `npm run typecheck` pasan sin errores ni advertencias.
- [x] `packages/domain` sigue sin importar Firebase.
- [x] `npm run test:domain` cubre cada regla de los 7 casos de uso con un caso positivo y uno negativo.
- [x] `coordinator`, `accountant`, `teacher`, `guardian` y `adultPlayer` reciben `permission-denied` en las 7 callables de escritura.
- [x] Un `owner` de `tenant-b` que llama cualquier callable de esta spec con `tenantId: 'tenant-a'` recibe `permission-denied`.
- [x] Cada escritura exitosa crea exactamente una entrada en `tenants/{tenantId}/auditLog` con `action`, `target`, `before`, `after` y `actorUid`.
- [x] Si falla la escritura de la bitácora, la sede no cambia (test de atomicidad).
- [x] Cerrar una sede o categoría con grupos activos responde `failed-precondition` y no cambia nada.
- [x] Crear o reabrir un grupo en una sede o categoría cerrada responde `failed-precondition`.
- [x] Un nombre repetido entre activos (sede en tenant, categoría en tenant, grupo en sede) responde `failed-precondition`.
- [x] Un horario con `end <= start`, `weekday` fuera de 1–7 o una hora que no es `HH:mm` responde `invalid-argument`.
- [x] `saveGroup` sobre un grupo existente rechaza un `venueId` distinto (no mueve el grupo).
- [x] Ningún documento de sede, categoría o grupo se borra: cerrar cambia `status` y `getStructure({includeClosed: true})` lo devuelve.
- [x] `getStructure` devuelve todo a `owner` y `accountant`; al coordinador seed solo su sede y sus grupos; al profesor seed solo sus grupos; `permission-denied` a `guardian` y `adultPlayer`.
- [x] `npm run test:rules` demuestra que leer y escribir `venues`, `categories` y `groups` directamente falla sin sesión, para el propio tenant y para otro tenant.
- [x] `npm run tenant:create` contra el emulador crea tenant, usuario y membresía `owner` activa, e imprime un enlace de restablecimiento; correrlo de nuevo con el mismo `--tenant-id` falla sin cambiar nada.
- [x] El seed corrido dos veces deja los mismos documentos.
- [ ] `npm run smoke:dev` pasa contra `escuelas-deportivas-dev` con los casos nuevos.
- [x] Existen ADR 0007 y `docs/arquitectura.md` actualizado; `docs/` replicado en los otros dos lugares.

## Decisiones

- **Sí: la spec 02 cubre solo §7.1 más el script de alta.** Lo demás de la Fase 1 depende de la estructura.
- **Sí: alta de organización por script Admin SDK.** Una sola escuela en el piloto; los roles de plataforma se diseñan después.
- **Sí: el script imprime un enlace de restablecimiento.** Sin clave conocida en la terminal y sin depender del correo (Q11).
- **No: clave temporal ni registro previo del dueño.** La primera expone la clave; la segunda exige una pantalla de registro inexistente.
- **Sí: coordinador y profesor solo viven en `membership.scope`.** Una sola fuente de verdad para permisos; sede y grupo no guardan uids.
- **No: `coordinatorUid` en la sede ni `teacherUid` en el grupo.** Dos lugares que se desincronizan.
- **Sí: cerrar sede o categoría con grupos activos se rechaza.** Sin cascadas; en specs siguientes protegerá también a los jugadores activos.
- **Sí: reabrir, solo el dueño, con bitácora.** Evita duplicar una sede cerrada por error.
- **Sí: horario estructurado solo en grupos, en hora de pared de Bogotá.** Es una hora del calendario, no un instante; la asistencia (Fase 3) lo necesita.
- **Sí: categorías por organización con `birthYears` opcional.** Sugiere la categoría al inscribir sin imponerla.
- **No: calendario de temporada ni programas.** Se modelan cuando exista quien los use.
- **Sí: una callable de árbol `getStructure`.** Decenas de documentos; una invocación por pantalla.
- **Sí: dos callables de escritura por entidad (`save*` y `set*Status`).** Crear y editar comparten validación; cerrar y reabrir llevan motivo. Evita 13 callables casi iguales.
- **Sí: nombres únicos entre activos, sin distinguir mayúsculas.** Evita sedes "Norte" y "norte"; un cerrado no bloquea reutilizar el nombre. _Propuesto al escribir la spec; confirmar al revisar._
- **Sí: `venueId` de un grupo es inmutable.** Mover un grupo es cerrarlo y crear otro; conserva el historial por sede. _Propuesto al escribir la spec; confirmar al revisar._
- **Sí: filtrado en memoria, sin índices compuestos.** A esta escala leer todo el tenant es más barato que mantener índices.
- **No: logo en esta spec.** Llega con las URLs firmadas de documentos.

## Risks

| Riesgo                                                            | Mitigación                                                                                                   |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `scope` de coordinador/profesor apunta a una sede o grupo cerrado | `getStructure` con `includeClosed: false` no lo devuelve; la spec de usuarios valida el alcance al asignarlo |
| Unicidad de nombre con dos creaciones simultáneas                 | La comprobación y la escritura van en la misma transacción                                                   |
| Hora de pared confundida con UTC                                  | Tipo `"HH:mm"` sin fecha ni zona; ADR 0007 lo explica                                                        |
| Script de alta corrido contra `dev` con datos reales              | `--target` obligatorio, `prod` inexistente, falla si el tenant existe                                        |

## What is **not** in this spec

- Asignar personas a sedes o grupos, invitar, activar o desactivar usuarios.
- Logo y cualquier archivo.
- Calendario de temporada y pausas.
- Programas o deportes.
- Roles de plataforma.
- Jugadores, acudientes, documentos, importación.

Cada uno va en su propia spec según `specs/ROADMAP.md`.
