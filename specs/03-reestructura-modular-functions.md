# SPEC 03 — Reestructura modular de `functions` (deuda técnica tras la spec 02)

> **Status:** Approved
> **Depends on:** SPEC 01 (`specs/01-fundaciones-backend.md`) y SPEC 02 (`specs/02-estructura-organizacion.md`, ya implementada sobre la estructura actual). Esta spec reubica ese código sin cambiar su comportamiento.
> **Date:** 2026-10-04
> **Objective:** Que todo el código del backend viva en `functions/src`, organizado por módulo con capas hexagonales (`domain`, `application`, `infrastructure`) y fronteras verificadas por lint, sin cambiar el comportamiento de las 10 callables desplegadas.

---

## Por qué existe esta spec

Hoy el código está repartido en tres lugares: `packages/domain`, `functions/src` y `scripts/`. El dominio es un paquete aparte para que la frontera hexagonal sea física (D-01, D-02). Eso exige un workspace npm, compilar el dominio antes que todo lo demás y empaquetarlo con esbuild (ADR 0001). Además, el código se organiza por tipo técnico (`ports/`, `adapters/`, `callables/`) y no por módulo de negocio.

El costo del workspace ya se pagó una vez: `deploy-dev.yml` falló en cada despliegue porque `packages/domain/dist` no existía en un checkout limpio (`af7e123`). Y la spec 02 ya sumó tenant, sedes, categorías y grupos (dos módulos nuevos, un `StructureRepository<T>` genérico, 7 casos de uso y 8 callables) en la estructura por tipo técnico. Antes de la Fase 1 restante (usuarios, jugadores, documentos…), la estructura pasa a ser **por módulo** (screaming architecture) con las tres capas dentro de cada uno, todo en `functions/src`. La frontera deja de ser física y queda **verificada por lint y probada por un test**.

## Scope

**In:**

- Mover `packages/domain/src` y el código de `functions/src` a `functions/src/<módulo>/{domain,application,infrastructure}` y a `functions/src/shared/`. Módulos actuales: `audit`, `membership`, `tenant` y `structure`.
- Mover `scripts/` (`seed`, `seed-lib`, `smoke-dev`, `create-tenant`, `create-tenant-lib`) a `functions/src/scripts/`.
- Mover los tests junto al código: unitarios como `*.test.ts` y de integración como `*.integration.test.ts`. Los tests de rules quedan en `functions/test/rules/`, porque prueban `firestore.rules` y `storage.rules` de la raíz, no código de `src`.
- Eliminar el `package.json` y el `package-lock.json` de la raíz, el workspace y `packages/`. `functions/package.json` pasa a tener todas las dependencias y scripts (incluido `tenant:create`), con su propio `package-lock.json`.
- Unificar ESLint y tsconfig en `functions/`, con reglas de frontera por capa y un test que las prueba.
- Ajustar `.github/workflows/ci.yml` y `deploy-dev.yml` a `working-directory: functions`, y quitar de `deploy-dev.yml` el paso `npm run build -w @escuelas/domain`.
- Documentación:
  - ADR 0008, que reemplaza al ADR 0001 (el 0007 ya lo usa la estructura de la organización).
  - D-01 y D-02 de `docs/plan-tecnico.md`, y también `docs/arquitectura.md`, `docs/guias/agregar-caso-de-uso.md`, `functions/README.md`, `CLAUDE.md` y `specs/ROADMAP.md`.
  - `specs/02-estructura-organizacion.md` queda como registro histórico: solo se le agrega una nota al inicio ("Código reubicado por la spec 03, ver ADR 0008"); no se reescriben sus rutas.
  - Replicar `docs/` en `../escuelas-front/docs/` y `../docs/`.
- Desplegar a `dev`, correr el seed con la estructura y pasar el humo (esto cierra lo que la spec 02 dejó pendiente en `dev`).

**Out of scope:**

- Cambiar nombres, contratos (esquemas zod) o comportamiento de las 10 callables: `listMyMemberships`, `changeMembershipRole`, `updateTenantProfile`, `saveVenue`, `setVenueStatus`, `saveCategory`, `setCategoryStatus`, `saveGroup`, `setGroupStatus` y `getStructure`.
- Agregar lógica de negocio, módulos o callables nuevos (eso es la spec 04 en adelante).
- Cambiar el empaquetado con esbuild por `tsc` emit.
- Cambiar `firestore.rules`, `storage.rules`, `firestore.indexes.json` o `firebase.json`, salvo lo estrictamente necesario para la nueva ubicación.
- Herramientas nuevas de fronteras, como `eslint-plugin-boundaries` o `dependency-cruiser`.
- Reescribir la spec 02.

## Data model

Esta spec no introduce datos nuevos ni cambia documentos de Firestore. Lo que cambia es la estructura de carpetas:

```
functions/
├── package.json, package-lock.json   único paquete npm del back
├── tsconfig.json, tsconfig.dev.json  (absorbe tsconfig.base.json)
├── .eslintrc.js                      (absorbe .eslintrc.base.js; reglas de frontera)
├── build.mjs                         esbuild, entrada src/index.ts (sin cambios de lógica)
├── vitest.unit.config.ts             src/**/*.test.ts excepto *.integration.test.ts
├── vitest.integration.config.ts      src/**/*.integration.test.ts
├── vitest.rules.config.ts            test/rules/**/*.test.ts
├── test/rules/                       firestore.rules / storage.rules
└── src/
    ├── index.ts                      solo exporta las 10 callables
    ├── shared/
    │   ├── domain/                   errors.ts (DomainError), clock.ts (Clock)
    │   ├── application/              unit-of-work.ts (UnitOfWork, TransactionContext);
    │   │                             testing/ (fake-clock, in-memory-unit-of-work)
    │   └── infrastructure/           admin.ts, system-clock.ts, to-https-error.ts,
    │                                 callable.ts (parseInput, deviceOf), firestore-unit-of-work.ts;
    │                                 testing/ (helpers de emulador)
    ├── audit/
    │   ├── domain/                   audit-entry.ts (AuditEntry, AuditAction)
    │   ├── application/              audit-log-writer.ts (puerto); testing/in-memory-audit-log-writer.ts
    │   └── infrastructure/firestore/ firestore-audit-log-writer.ts
    ├── membership/
    │   ├── domain/                   role.ts, membership.ts
    │   ├── application/              change-membership-role.ts, require-owner.ts,
    │   │                             membership-repository.ts (puerto);
    │   │                             testing/in-memory-membership-repository.ts
    │   └── infrastructure/
    │       ├── authorize.ts          requireUid, authorizeTenantMember
    │       ├── firestore/            repository, mapper, my-memberships-query
    │       └── callables/            listMyMemberships/{index,schema}.ts, changeMembershipRole/{index,schema}.ts
    ├── tenant/
    │   ├── domain/                   tenant.ts
    │   ├── application/              update-tenant-profile.ts, tenant-repository.ts (puerto);
    │   │                             testing/in-memory-tenant-repository.ts
    │   └── infrastructure/
    │       ├── firestore/            repository, mapper
    │       └── callables/            updateTenantProfile/{index,schema}.ts
    ├── structure/
    │   ├── domain/                   structure.ts (Venue, Category, Group), validation.ts, visible-structure.ts
    │   ├── application/              save-venue|category|group.ts, set-venue|category|group-status.ts,
    │   │                             group-parents.ts, structure-repository.ts (puerto genérico);
    │   │                             testing/in-memory-structure-repository.ts
    │   └── infrastructure/
    │       ├── firestore/            repository, mapper, structure-query
    │       └── callables/            saveVenue, setVenueStatus, saveCategory, setCategoryStatus,
    │                                 saveGroup, setGroupStatus, getStructure ({index,schema}.ts cada una)
    └── scripts/                      seed.ts, seed-lib.ts, smoke-dev.ts, create-tenant.ts,
                                      create-tenant-lib.ts (no se importan desde index.ts)
```

Reglas de dependencia (verificadas por `.eslintrc.js`):

| Capa                  | Puede importar                                                    | No puede importar                                                                                                |
| --------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `*/domain/**`         | `shared/domain`, el `domain` de otros módulos                     | `firebase-admin*`, `firebase-functions*`, `@google-cloud/*`, `zod`, cualquier `application/` o `infrastructure/` |
| `*/application/**`    | `domain` y `application` (propios, de otros módulos, de `shared`) | Firebase, `@google-cloud/*`, `zod`, cualquier `infrastructure/`                                                  |
| `*/infrastructure/**` | todo lo anterior y Firebase/zod                                   | —                                                                                                                |
| `scripts/**`          | todo                                                              | — (nada en `src` importa `scripts/`)                                                                             |

`require-owner.ts` y `group-parents.ts` van en `application` y no en `domain`, porque reciben puertos de repositorio.

## Implementation plan

TDD en cada paso: primero el test que falla. Un commit convencional por paso (los movimientos, separados por módulo), y se mueve con `git mv` para conservar el historial. Cada paso termina con `build`, `lint`, `typecheck` y los tests en verde.

0. **Línea base.** Correr `test:domain`, `test:rules` y `test:integration`, y anotar cuántos tests pasan en cada uno (ya incluyen los de la spec 02). Es la referencia de "sin regresiones".
1. **Frontera por lint, primero el test.** `functions/src/shared/infrastructure/lint-boundaries.test.ts` usa la API de ESLint (`lintText` con `filePath` ficticio) y comprueba que fallan los imports prohibidos de la tabla y que pasan los permitidos. Después se agregan los `overrides` en `functions/.eslintrc.js`, que absorbe `.eslintrc.base.js` y la regla de `packages/domain/.eslintrc.js`.
2. **Dominio a `functions/src`.**
   - Mover `packages/domain/src` a `shared/`, `audit/`, `membership/`, `tenant/` y `structure/` según el árbol, con los tests co-ubicados y los fakes en `application/testing/` de su módulo.
   - Reemplazar los imports de `@escuelas/domain` por rutas relativas.
   - Crear `vitest.unit.config.ts` y el script `test:unit`.
   - Eliminar `packages/domain` y su entrada en el workspace, y quitar el alias de `vitest.integration.config.ts`.
3. **Adaptadores y callables por módulo.**
   - Mover `functions/src/adapters/firestore/*`, `callables/*` (las 10) y `shared/*` a su módulo y capa. `callable.ts` pasa a `shared/infrastructure/`.
   - `authorize.ts` va a `membership/infrastructure/`, porque depende del repositorio de membresías.
   - Los tests de `functions/test/integration/` pasan junto al código como `*.integration.test.ts`; los helpers de emulador van a `shared/infrastructure/testing/`.
   - Ajustar `vitest.integration.config.ts`.
4. **Scripts a `functions/src/scripts/`.** Mover `seed.ts`, `seed-lib.ts`, `smoke-dev.ts`, `create-tenant.ts`, `create-tenant-lib.ts` y los tests del seed y de `create-tenant`. Eliminar `scripts/tsconfig.json` y `scripts/.eslintrc.js`.
5. **Un solo paquete npm.**
   - Pasar las devDependencies de la raíz (eslint y plugins, typescript, vitest, tsx, firebase-tools) a `functions/package.json`, junto con los scripts `build`, `lint`, `typecheck`, `test:unit`, `test:rules`, `test:integration`, `seed:emulator`, `seed:dev`, `tenant:create`, `smoke:dev` y `smoke:emulator`.
   - Absorber `tsconfig.base.json`.
   - Eliminar el `package.json`, el `package-lock.json` y `tsconfig.base.json` de la raíz, y generar `functions/package-lock.json`.
   - Comprobar que `firebase emulators:exec` corrido desde `functions/` encuentra `../firebase.json`.
6. **CI.** En `ci.yml` y `deploy-dev.yml`: `working-directory: functions`, la caché de npm apuntando a `functions/package-lock.json` y `test:domain` reemplazado por `test:unit`. En `deploy-dev.yml`, eliminar el paso `npm run build -w @escuelas/domain`.
7. **Documentación.**
   - ADR 0008, `docs/adr/0008-estructura-modular-en-functions.md`, con las decisiones de esta spec. El ADR 0001 queda en estado "Reemplazada por ADR 0008".
   - D-01 (árbol de `escuelas-back`) y D-02 de `docs/plan-tecnico.md`.
   - `docs/arquitectura.md`, `docs/guias/agregar-caso-de-uso.md`, `functions/README.md` y `CLAUDE.md` (estado, comandos desde `functions/`, arquitectura).
   - `specs/02-estructura-organizacion.md`: solo la nota de reubicación al inicio; sus rutas y su ADR 0007 no se tocan.
   - `specs/ROADMAP.md`: fila 03 con esta spec, y "03+ (por crear)" pasa a "04+".
   - Replicar `docs/` en `../escuelas-front/docs/` y `../docs/`.
8. **Despliegue a `dev`.** `firebase deploy --only functions,firestore,storage --project dev`, luego `npm run seed:dev` y `npm run smoke:dev` desde `functions/`. El seed y el humo ya incluyen la estructura de la spec 02, así que esto también cierra lo que esa spec dejó pendiente en `dev`.

## Acceptance criteria

- [ ] En la raíz del repo no existen `package.json`, `package-lock.json`, `tsconfig.base.json`, `packages/` ni `scripts/`; todo archivo `.ts` versionado está bajo `functions/`.
- [ ] Ningún archivo importa `@escuelas/domain`, y `deploy-dev.yml` no menciona `@escuelas/domain` ni `packages/`.
- [ ] Desde `functions/`, `npm run build`, `npm run lint` y `npm run typecheck` pasan sin errores ni advertencias.
- [ ] `npm run test:unit`, `npm run test:rules` y `npm run test:integration` pasan, con al menos la misma cantidad de tests que la línea base del paso 0.
- [ ] `lint-boundaries.test.ts` demuestra que fallan los imports de `firebase-admin`, `firebase-functions`, `@google-cloud/*`, `zod` o de `infrastructure/` desde `*/domain/**`, y los de Firebase o `infrastructure/` desde `*/application/**`, y que pasa un import de `domain` desde `infrastructure`.
- [ ] `functions/lib/index.js` exporta exactamente las 10 callables (`listMyMemberships`, `changeMembershipRole`, `updateTenantProfile`, `saveVenue`, `setVenueStatus`, `saveCategory`, `setCategoryStatus`, `saveGroup`, `setGroupStatus`, `getStructure`), y no contiene código de `scripts/` ni de tests.
- [ ] Los esquemas zod de las 10 callables no cambian (diff limitado a imports y ubicación).
- [ ] `npm run seed:emulator` corrido dos veces deja los mismos documentos, y `npm run smoke:emulator` pasa.
- [ ] `npm run tenant:create` contra el emulador crea la organización con su dueño y falla sin cambios si el tenant ya existe (cubierto por su test).
- [ ] El CI (`ci.yml`) pasa en un PR real hacia `dev`.
- [ ] Tras desplegar a `escuelas-deportivas-dev` y correr `npm run seed:dev`, `npm run smoke:dev` pasa con los chequeos de estructura.
- [ ] Existe el ADR 0008, el ADR 0001 figura como reemplazado, D-01/D-02, `arquitectura.md`, la guía, el README, `CLAUDE.md` y el ROADMAP describen la estructura nueva, la spec 02 tiene su nota de reubicación, y `docs/` está replicado en los otros dos lugares.

## Decisiones

- **Sí: todo el código en `functions/src`, por módulo.** Una sola raíz de código, sin workspace ni build previo del dominio, y la carpeta dice de qué trata el negocio. _Decidido por el usuario el 2026-10-04; cambia D-01 y D-02._
- **No: mantener `packages/domain` como paquete aparte.** Daba una frontera física, pero a cambio de un workspace, un orden de build y el empaquetado del ADR 0001 (que ya causó un fallo de despliegue, `af7e123`).
- **Sí: tres capas por módulo (`domain`, `application`, `infrastructure`).** Las entidades y reglas puras van en `domain`; los casos de uso y los puertos que necesitan, en `application`; Firestore y las callables, en `infrastructure`.
- **No: `ports/` y `adapters/in|out` como carpetas.** Más carpetas por módulo sin ganar claridad a esta escala.
- **Sí: `tenant` y `structure` como módulos separados.** Coinciden con las carpetas que hoy tiene el dominio y con los repositorios de la spec 02.
- **Sí: `require-owner.ts` y `group-parents.ts` en `application`.** Reciben puertos de repositorio, así que no pueden vivir en `domain`.
- **Sí: frontera por `no-restricted-imports` de ESLint, probada con un test.** No suma dependencias, y el test evita que la regla se rompa en silencio.
- **No: `eslint-plugin-boundaries` ni `dependency-cruiser`.** Otra herramienta que configurar para tres reglas.
- **Sí: eliminar el `package.json` de la raíz.** `functions/` es el único paquete, y Cloud Build instala desde su propio lockfile. Los comandos se corren desde `functions/`. _Decidido por el usuario._
- **No: una raíz delgada que solo delegue.** Dos `package.json` y una capa de indirección.
- **Sí: scripts en `functions/src/scripts/`.** esbuild solo empaqueta lo que alcanza desde `src/index.ts`, así que no viajan al despliegue.
- **Sí: tests junto al código; los de rules quedan en `functions/test/rules/`.** Los de rules prueban archivos de la raíz, no código de un módulo.
- **Sí: `authorize.ts` en `membership/infrastructure`.** Depende del repositorio de membresías, y `shared/` no debe depender de un módulo.
- **Sí: `TransactionContext` en `shared/application` importa los puertos de los módulos (solo tipos).** Hoy referencia cuatro módulos (membership, audit, tenant, structure). Es el único punto de composición transaccional; se documenta como excepción en el ADR 0008.
- **Sí: se mantiene esbuild.** Funciona y está verificado en la nube, y cambiar el empaquetado no es parte de esta spec.
- **No: implementar la spec 03 antes que la 02.** Era el plan original, pero la 02 se implementó primero. **Sí:** la 03 se implementa ahora y reubica el código de la 02 sin cambiar su comportamiento.
- **Sí: la spec 02 queda como registro histórico.** Solo recibe una nota de reubicación; sus rutas y su ADR 0007 describen cómo se implementó. _Decidido por el usuario el 2026-10-04._

## Risks

| Riesgo                                                                                                             | Mitigación                                                                                          |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| La frontera por lint es más débil que la de paquete                                                                | Test de fronteras en CI; `lint` corre en cada PR y en el predeploy                                  |
| Cloud Build falla con el nuevo `functions/package-lock.json`                                                       | Paso 8: se despliega a `dev` antes de dar la spec por cumplida                                      |
| `firebase emulators:exec` no encuentra `firebase.json` desde `functions/`                                          | Se verifica en el paso 5; si falla, `--config ../firebase.json` en los scripts                      |
| Se pierde el historial de los archivos movidos                                                                     | `git mv` y commits de movimiento separados de los de edición                                        |
| Volumen del movimiento (~110 archivos, 10 callables desplegadas)                                                   | Commits de movimiento por módulo, suites en verde en cada paso y humo en `dev` antes de cerrar      |
| `TransactionContext` ya acopla `shared` con cuatro módulos y crecerá con cada uno nuevo                            | Imports solo de tipos, excepción documentada en ADR 0008; se revisa al sumar jugadores              |
| Queda el paso `npm run build -w @escuelas/domain` en `deploy-dev.yml` y el deploy falla al no existir el workspace | El paso 6 lo elimina y el criterio de aceptación verifica que no quede mención a `@escuelas/domain` |

## What is **not** in this spec

- Cambios de comportamiento o de contratos en las callables.
- Módulos de negocio nuevos (usuarios, jugadores, documentos…: specs 04 en adelante).
- Reescribir la spec 02 (solo recibe la nota de reubicación).
- Cambiar esbuild por otra forma de empaquetar.
- Herramientas nuevas de análisis de dependencias.
