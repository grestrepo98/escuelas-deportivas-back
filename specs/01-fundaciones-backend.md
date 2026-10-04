# SPEC 01 — Fundaciones del backend (Fase 0 técnica)

> **Status:** Approved
> **Depends on:** ninguna (primera spec). Contexto en `docs/plan-tecnico.md` y `docs/producto.md`; trazabilidad de lo que queda fuera en `specs/ROADMAP.md`.
> **Date:** 2026-10-03
> **Objective:** Dejar el repo `escuelas-back` como workspace hexagonal con Firebase en modo "denegar todo", membresías por tenant, bitácora base, un cambio de rol auditado, CI y despliegue a `dev`, todo probado con TDD.

---

## Por qué existe esta spec

El backend completo abarca 4 fases técnicas y más de 15 módulos; no cabe en una sola spec. Esta cubre la Fase 0 del plan (cimientos) y es el suelo de todo lo demás: si el aislamiento por tenant, la bitácora o la estructura hexagonal salen mal aquí, se rehacen en cada módulo.

Al revisar los documentos se encontraron inconsistencias que esta spec resuelve (ver "Decisiones"): claims vs. sin claims (D-06), Node 22 vs. 24, IDs de proyecto Firebase, región, y la lista de puertos de D-02.

Estado real verificado el 2026-10-03:

- `functions/` es el starter de Firebase: `src/index.ts` solo llama `setGlobalOptions({maxInstances: 10})`; `engines.node` es `24`.
- `.firebaserc` solo tiene el alias `default` → `escuelas-deportivas-dev`; `firebase.json` solo declara `functions`.
- No hay commits, tests, emulador configurado ni `firestore.rules`/`storage.rules`.
- Firestore `(default)` existe en `escuelas-deportivas-dev`, modo `FIRESTORE_NATIVE`, ubicación `nam5`, sin protección contra borrado ni PITR.

## Scope

**In:**

- Convertir el repo en npm workspace: raíz + `functions/` + `packages/domain/`.
- `packages/domain` (TypeScript puro, sin importar Firebase): roles, entidad `Membership`, puertos y el caso de uso `ChangeMembershipRole`, probados con Vitest.
- Emulator Suite configurado (Auth, Firestore, Functions, Storage, UI) en `firebase.json`.
- `firestore.rules` y `storage.rules` en "denegar todo" para clientes, con tests en el emulador que prueban el rechazo de lectura y escritura (propio tenant, otro tenant, sin sesión).
- Adaptadores Firestore en `functions/` para los puertos del dominio.
- Helper de autorización que lee `memberships/{uid}_{tenantId}` en cada llamada (D-06) y rechaza si no hay membresía activa.
- Dos callables, con esquema zod de entrada y salida junto a cada una: `listMyMemberships` y `changeMembershipRole`.
- Bitácora base `tenants/{tenantId}/auditLog` de solo creación, escrita en la misma transacción que el cambio.
- Script de seed con Admin SDK: tenant de prueba, usuarios y membresías de los 6 roles, y un segundo tenant para probar aislamiento (emulador y `dev`).
- Región fija `us-central1` para Functions (par de `nam5`).
- Conversión `.firebaserc` con alias `dev`; el alias `prod` se agrega cuando exista ese proyecto.
- CI en GitHub Actions: lint, typecheck, tests de dominio, tests de rules y de functions con emulador en cada PR; deploy a `dev` al subir cambios a la rama `dev` (el ambiente `dev` refleja la rama `dev`).
- Documentación junto al código: README por paquete, `docs/arquitectura.md`, guía "cómo agregar un caso de uso o adaptador", ADRs de las decisiones de esta spec.

**Out of scope (para otras specs; ver `specs/ROADMAP.md`):**

- Cualquier módulo de negocio (sedes, jugadores, acudientes, pagos, etc.): Fases 1–3.
- Invitación de usuarios por correo, creación de tenants por callable, desactivación de usuarios (módulo 7.2/7.19, Fase 1).
- Roles de plataforma (super administrador, soporte): se diseñan con 7.19 en la Fase 1.
- Cambio de alcance (sedes, grupos, hijos) de una membresía.
- Frontend, PWA, login en el cliente y selector de escuela (repo `escuelas-front`).
- Deploy a `prod`, proyecto `prod`, aprobación manual, federación de identidad, respaldos, alertas de monitoreo, Sentry (Fase 3, endurecimiento).
- Signed URLs y subida de archivos (D-08): Fase 1 (documentos).
- App Check.

## Data model

Identidad (excepción deliberada a "todo bajo `tenants/`": una persona puede pertenecer a varios tenants, D-06):

```ts
// memberships/{uid}_{tenantId}
type Role =
  | "owner" // dueño o administrador
  | "accountant" // auxiliar administrativo o contable
  | "coordinator"
  | "teacher"
  | "guardian" // acudiente
  | "adultPlayer";

type Membership = {
  uid: string;
  tenantId: string;
  role: Role;
  status: "active" | "inactive";
  scope: { venueIds: string[]; groupIds: string[]; playerIds: string[] }; // vacío = sin restricción de alcance para owner/accountant
  createdAt: Timestamp; // UTC
  updatedAt: Timestamp; // UTC
};
```

Tenant y bitácora:

```ts
// tenants/{tenantId}
type Tenant = {
  name: string;
  status: "active" | "suspended";
  createdAt: Timestamp;
};

// tenants/{tenantId}/auditLog/{auditId}   (solo creación)
type AuditEntry = {
  at: Timestamp; // serverTimestamp, UTC
  tenantId: string;
  actorUid: string;
  actorRole: Role;
  action: "membership.role_changed"; // se amplía en specs futuras
  target: { type: "membership"; id: string };
  before: Record<string, unknown>; // p. ej. { role: 'coordinator' }
  after: Record<string, unknown>; // p. ej. { role: 'accountant' }
  reason?: string;
  device: { userAgent?: string };
};
```

Contratos de las callables (zod, junto a cada callable en `functions/src/callables/<nombre>/schema.ts`):

```ts
// listMyMemberships
input:  {}                                   // el uid sale de request.auth, nunca del cliente
output: { memberships: { tenantId: string; tenantName: string; role: Role; scope: Scope }[] }

// changeMembershipRole
input:  { tenantId: string; targetUid: string; newRole: Role; reason?: string }
output: { membershipId: string; role: Role }
```

Convenciones:

- Fechas en UTC (`Timestamp`); la zona America/Bogota es solo de presentación.
- IDs de membresía: `{uid}_{tenantId}`.
- Errores: `HttpsError` con `unauthenticated`, `permission-denied`, `invalid-argument`, `failed-precondition`, `not-found`.
- El `tenantId` que envía el cliente jamás se confía: se valida contra la membresía activa (D-05).

## Implementation plan

Cada paso deja el repo ejecutable y se hace con TDD (test que falla primero) salvo configuración pura. Un commit convencional por paso.

0. **Prerrequisitos manuales (sin código).** Crear los repos privados `escuelas-back` y `escuelas-front` en GitHub; habilitar Authentication con correo/contraseña en `escuelas-deportivas-dev`; confirmar plan Blaze y crear alerta de presupuesto en `dev` (D-15); `firebase login` en la máquina. Verificación: `firebase projects:list` muestra `escuelas-deportivas-dev`.
1. **Commit base.** Revisar `.gitignore` (excluye `node_modules`, `lib`, logs, `.env*`, claves de service account) y `skills-lock.json`/`.agents/`/`.atl/`; commit inicial del scaffold actual. Verificación: `git status` limpio y `cd functions && npm run build && npm run lint` pasan.
2. **Spike de empaquetado del workspace.** Cloud Functions solo sube `functions/`, así que una dependencia a `packages/domain` no viajaría. Probar en el emulador y en un deploy de prueba a `dev` una función mínima que importe una función de `packages/domain`; elegir y documentar el mecanismo (bundle con esbuild a `functions/lib`, o empaquetar el paquete en el predeploy). Salida: ADR 0001 y script `npm run build` que funciona. Este paso va antes de escribir dominio real.
3. **Workspace.** `package.json` raíz con `workspaces`, `tsconfig.base.json`, ESLint compartido, Vitest, scripts raíz (`lint`, `typecheck`, `test:domain`, `test:integration`, `build`). Verificación: `npm run build` y `npm run lint` desde la raíz pasan.
4. **Dominio: roles y membresía.** `packages/domain/src/membership/` con `Role`, `Membership` y la función que decide si una membresía está activa y pertenece al tenant pedido. Tests primero.
5. **Dominio: puertos.** `MembershipRepository`, `AuditLogWriter`, `UnitOfWork` (ejecuta lectura-modificación-escritura y bitácora en una transacción), `Clock`. Dobles en memoria en `packages/domain/test/fakes/`.
6. **Dominio: caso de uso `ChangeMembershipRole`.** Reglas (ver Decisiones): solo `owner` activo del mismo tenant; el objetivo debe existir en ese tenant; el rol nuevo debe diferir del actual; no se puede dejar al tenant sin un `owner` activo. Escribe la entrada de bitácora con `before`/`after`. Tests con los fakes, incluidos casos negativos.
7. **Configuración Firebase.** `firebase.json` con emuladores y apuntando a `firestore.rules`, `storage.rules`, `firestore.indexes.json`; reglas `allow read, write: if false;`; `setGlobalOptions({region: 'us-central1', maxInstances: 10})`; alias `dev` en `.firebaserc`. Verificación: `firebase emulators:start` arranca los 4 emuladores.
8. **Tests de rules.** `@firebase/rules-unit-testing`: sin sesión, usuario de su tenant y usuario de otro tenant fallan al leer y escribir `tenants/**`, `memberships/**`, `auditLog` y Storage. Verificación: `npm run test:rules` verde.
9. **Adaptadores Firestore.** `functions/src/adapters/firestore/` implementa `MembershipRepository`, `AuditLogWriter` y `UnitOfWork` con el Admin SDK; probados contra el emulador de Firestore (transacción atómica: si falla la bitácora, no cambia el rol).
10. **Helper de autorización y callable `listMyMemberships`.** `functions/src/shared/authorize.ts` exige `request.auth`, lee la membresía y falla con `permission-denied` si no existe o está inactiva. Esquema zod, test de contrato con emulador.
11. **Callable `changeMembershipRole`.** Esquema zod, `invalid-argument` ante entrada inválida, orquesta el caso de uso. Test de contrato y de aislamiento: un usuario del tenant B que apunta al tenant A recibe `permission-denied`.
12. **Seed.** `scripts/seed.ts` crea (idempotente) tenants `tenant-a` y `tenant-b`, un usuario por rol en `tenant-a` y un `owner` en `tenant-b`; corre contra emulador y contra `dev` con bandera explícita. Verificación: tras correr dos veces no hay duplicados.
13. **Documentación.** README de `packages/domain` y `functions`, `docs/arquitectura.md` (capas, puertos y adaptadores, flujo de punta a punta de `changeMembershipRole`), `docs/guias/agregar-caso-de-uso.md`, ADRs 0001–000N de las decisiones de esta spec; actualizar `CLAUDE.md` con los comandos de test reales y el estado; replicar los cambios en `docs/` de `../escuelas-front/docs/` y `../docs/` en la misma sesión (regla de D-01).
14. **CI.** `.github/workflows/ci.yml` (PR: lint, typecheck, tests de dominio, rules y functions con `firebase emulators:exec`) y `.github/workflows/deploy-dev.yml` (push a la rama `dev`: `firebase deploy --only functions,firestore,storage --project dev`) con service account guardada en un secreto de GitHub. Documentar en ADR que la autenticación por service account es provisional.
15. **Despliegue y humo en `dev`.** Desplegar, correr el seed contra `dev` y ejecutar el script de verificación `scripts/smoke-dev.ts` descrito en los criterios de aceptación. Es el último paso: no existe un paso "probar todo".

## Acceptance criteria

- [x] `npm run build`, `npm run lint` y `npm run typecheck` pasan en la raíz sin errores ni advertencias.
- [x] `packages/domain` no importa `firebase-admin`, `firebase-functions` ni ningún módulo `@google-cloud/*` (verificado por una regla de ESLint o un test).
- [x] `npm run test:domain` pasa sin emulador y cubre cada regla de `ChangeMembershipRole` con un caso positivo y uno negativo.
- [x] `npm run test:rules` demuestra que lectura y escritura directas a `tenants/**`, `memberships/**`, `tenants/*/auditLog/**` y a cualquier ruta de Storage fallan para: sin sesión, miembro del propio tenant y miembro de otro tenant.
- [x] Un usuario con membresía solo en `tenant-b` que llama `changeMembershipRole` con `tenantId: 'tenant-a'` recibe `permission-denied`, y `listMyMemberships` no le devuelve `tenant-a` (test automatizado).
- [x] Un usuario sin sesión que invoca cualquier callable recibe `unauthenticated`.
- [x] Una membresía con `status: 'inactive'` recibe `permission-denied` en la llamada inmediatamente siguiente a ser desactivada, sin revocar tokens.
- [x] `changeMembershipRole` por un `owner` de `tenant-a` sobre un `coordinator` cambia el rol y crea exactamente una entrada en `tenants/tenant-a/auditLog` con `before.role`, `after.role`, `actorUid`, `at` y `reason`.
- [x] `changeMembershipRole` rechaza con `failed-precondition` quitarle el rol al último `owner` activo del tenant.
- [x] Si falla la escritura de la bitácora, el rol no cambia (test de atomicidad con el emulador).
- [x] Un `coordinator`, `accountant`, `teacher`, `guardian` o `adultPlayer` que llama `changeMembershipRole` recibe `permission-denied`.
- [x] Una entrada que no cumple el esquema zod (campo faltante, rol inexistente) responde `invalid-argument`.
- [x] No hay un `number` de coma flotante ni un campo monetario en el modelo de esta spec (el dinero entero en COP llega con la Fase 2).
- [x] El seed corrido dos veces seguidas contra el emulador deja los mismos documentos, sin duplicados.
- [ ] Los workflows de CI ejecutan en un PR de prueba y quedan en verde; un push a la rama `dev` despliega a `dev`. *(pendiente: requiere subir el repo a GitHub; el flujo de `ci.yml` se simuló completo sobre una copia limpia y pasó)*
- [x] `scripts/smoke-dev.ts` contra `escuelas-deportivas-dev` confirma: `listMyMemberships` responde para un usuario del seed, un cambio de rol deja su entrada en la bitácora, y un usuario de `tenant-b` no ve `tenant-a`.
- [x] Las Functions desplegadas aparecen en la región `us-central1`.
- [x] Existen los README de ambos paquetes, `docs/arquitectura.md`, la guía de caso de uso y los ADRs; `CLAUDE.md` lista los comandos de test reales.

## Notas de implementación

Verificado el 2026-10-03. Lo que cambió o se decidió al implementar (el detalle de cada decisión está en `docs/adr/`):

- **Dominio con `Date`, no `Timestamp`:** el dominio no importa Firebase; el adaptador convierte (ADR 0004, `docs/arquitectura.md`).
- **`AuditEntry` sin `at`:** lo asigna el escritor (hora del servidor en Firestore, reloj en el doble de prueba).
- **Puerto ampliado:** `MembershipRepository.countActiveByRole`, necesario para la invariante del último `owner`.
- **`listMyMemberships` es una consulta de lectura** en el adaptador (`my-memberships-query.ts`), no un caso de uso del dominio.
- **`@escuelas/domain` no se declara en `functions/package.json`:** npm enlaza los workspaces, y declararlo con `"*"` rompería el build en la nube (ADR 0001).
- **`firebase-tools` como devDependency** de la raíz, para que el CI tenga el CLI.
- **Despliegue a `dev` desde la rama `dev`** (no desde `main`): decisión posterior a la spec; el ambiente `dev` refleja la rama `dev` (ADR 0006).
- **Política de limpieza de imágenes** de Artifact Registry (7 días) en `us-central1`, necesaria para que el despliegue no interactivo termine con código 0 (ADR 0006).
- **Bug solo de la nube, hallado por el humo en `dev`:** el runtime de Functions ya crea apps de Admin con otro nombre, así que decidir con `getApps().length` fallaba (`app/no-app`, 500). Corregido con test de regresión (`functions/test/integration/admin.test.ts`).
- **Alcance extra:** `npm run smoke:emulator` para verificar el propio script de humo en local, y reglas de seguridad del seed (`--target` obligatorio, `prod` inexistente, `dev` exige `SEED_PASSWORD` y `FIREBASE_API_KEY`).

Cobertura al cierre: 42 tests de dominio, 114 de reglas, 71 de integración; humo en `dev` 5/5.

Pendiente fuera del código: crear la rama `dev`, el *environment* `dev` con el secreto `FIREBASE_SERVICE_ACCOUNT_DEV` y la protección de ramas en GitHub, y confirmar que el CI queda en verde en un PR real.

## Decisiones

- **Sí: sin claims de tenant ni de rol (D-06 decisión).** Cada callable lee `memberships/{uid}_{tenantId}`. Corrige el texto de la Fase 0 del plan, que aún mencionaba "membresías y claims". Razón: no hay claims desactualizados y desactivar corta el acceso en la siguiente llamada.
- **No: custom claims con organización activa.** Descartado en D-06; se reevalúa solo si la latencia de la lectura extra lo exige.
- **Sí: dos repos independientes y workspace solo dentro del back (D-01).** `packages/domain` no se publica.
- **Sí: Node 24 y proyecto `escuelas-deportivas-dev`.** Es el estado real; se actualiza el plan (D-13 y Fase 0) en vez de crear otro proyecto. Los alias van `dev`/`prod`.
- **Sí: región de Functions `us-central1`.** Documentación oficial de Firebase recomienda esa región para Firestore `nam5`; ubicación de Firestore no se puede cambiar (D-14). Latencia mayor que São Paulo, ya aceptada en D-14.
- **Sí: `memberships` en la raíz.** Una persona está en varios tenants (§5 de producto); ninguna colección de negocio vive en la raíz.
- **Sí: solo el `owner` cambia roles.** Sale de la matriz de permisos "Usuarios y roles" (E/A solo dueño). El auxiliar solo ve.
- **Sí: invariante "siempre queda un `owner` activo".** No viene del plan; evita dejar un tenant sin administrador. Se registra en ADR.
- **Sí: el cambio de rol conserva el `scope` existente.** Cambiar alcance es otra operación (Fase 1).
- **Sí: puertos adicionales de D-02.** El dominio de esta spec solo crea los de membresía/bitácora; `PaymentRepository`, `ReceiptNumberGenerator`, `PaymentProvider` e `InvoicingProvider` (D-02, D-18, D-19) se crean en la Fase 2.
- **Sí: seed script en vez de callables de alta.** Evita adelantar 7.19/7.2; solo se construye la callable de cambio de rol porque la puerta de salida lo exige.
- **No: los 2 roles de plataforma.** No viven dentro de un tenant; exigen un mecanismo aparte, se difiere a la Fase 1.
- **Sí: CI de PR y deploy a `dev`; `prod` fuera.** Autenticación por service account como decisión provisional (D-16 dejó el método abierto).
- **Sí: Spike de empaquetado antes del dominio real.** Riesgo no verificado: el despliegue de Functions solo sube `functions/`.
- **Sí: TDD estricto en `domain` y `functions`; rules con tests desde el inicio (D-07, §8 del plan).**
- **No: spec única para todo el backend.** Se parte por fase técnica; la trazabilidad de lo restante vive en `specs/ROADMAP.md`.

## Risks

| Riesgo                                                                  | Mitigación                                                                                                          |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Workspace local no viaja en el deploy de Functions                      | Spike del paso 2 antes de escribir dominio; ADR con el mecanismo elegido                                            |
| `nam5` y `us-central1` no quedan alineados en la práctica               | El criterio de aceptación verifica la región desplegada; D-14 ya registra que Functions debe compartir región       |
| Emulador no replica el 100 % de producción                              | Humo en `dev` (paso 15) como verificación complementaria (D-13)                                                     |
| Service account en un secreto de GitHub es una credencial de larga vida | Permisos mínimos (solo `dev`), documentada como provisional; federación de identidad antes de abrir `prod` (Fase 3) |
| Una lectura extra de Firestore por invocación aumenta latencia y costo  | Se mide en el piloto; salida prevista en D-06 (caché corta o claims)                                                |
| Base `dev` sin protección contra borrado ni PITR                        | Aceptable en `dev`; en `prod` se activan antes de cargar datos reales (ROADMAP, Fase 3)                             |
| Seed corrido contra `dev` con datos reales por error                    | Bandera explícita `--target dev` y tenants con prefijo fijo; nunca contra `prod`                                    |
| Copias de `docs/` se desalinean entre repos                             | Regla de D-01: replicar en la misma sesión y mencionarlo en el commit                                               |

## What is **not** in this spec

- Ningún módulo de negocio: sedes, jugadores, acudientes, documentos, tarifas, cobros, pagos, recibos, cierres, asistencia, carné, reportes.
- Invitaciones, alta de tenants por API, desactivación de usuarios.
- Roles de plataforma y soporte.
- Frontend, login en cliente, selector de escuela.
- Deploy a `prod`, respaldos, monitoreo, Sentry, pruebas de carga.
- Subida y descarga de archivos con URLs firmadas.
- Cambio de alcance de una membresía.

Cada uno, cuando llegue, va en su propia spec según `specs/ROADMAP.md`.
