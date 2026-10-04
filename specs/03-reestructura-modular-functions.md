# SPEC 03 — Reestructura modular de `functions` (Fase 1 técnica, previa a la spec 02)

> **Status:** Draft
> **Depends on:** SPEC 01 (`specs/01-fundaciones-backend.md`). Se implementa antes que la SPEC 02 (`specs/02-estructura-organizacion.md`), que se ajusta a esta estructura.
> **Date:** 2026-10-04
> **Objective:** Que todo el código del backend viva en `functions/src`, organizado por módulo con capas hexagonales (`domain`, `application`, `infrastructure`) y fronteras verificadas por lint, sin cambiar el comportamiento de las callables desplegadas.

---

## Por qué existe esta spec

Hoy el código está repartido en tres lugares: `packages/domain`, `functions/src` y `scripts/`. El dominio es un paquete aparte para que la frontera hexagonal sea física (D-01, D-02). Eso exige un workspace npm, compilar el dominio antes que todo lo demás y empaquetarlo con esbuild (ADR 0001). Además, el código se organiza por tipo técnico (`ports/`, `adapters/`, `callables/`) y no por módulo de negocio.

La spec 02 está por sumar 4 repositorios, 7 casos de uso y 7 callables. Antes de eso, la estructura pasa a ser **por módulo** (screaming architecture) con las tres capas dentro de cada uno, todo en `functions/src`. La frontera deja de ser física y queda **verificada por lint y probada por un test**.

## Scope

**In:**

- Mover `packages/domain/src` y el código de `functions/src` a `functions/src/<módulo>/{domain,application,infrastructure}` y a `functions/src/shared/`.
- Mover `scripts/` a `functions/src/scripts/`.
- Mover los tests junto al código: unitarios como `*.test.ts` y de integración como `*.integration.test.ts`. Los tests de rules quedan en `functions/test/rules/`, porque prueban `firestore.rules` y `storage.rules` de la raíz, no código de `src`.
- Eliminar el `package.json` y el `package-lock.json` de la raíz, el workspace y `packages/`. `functions/package.json` pasa a tener todas las dependencias y scripts, con su propio `package-lock.json`.
- Unificar ESLint y tsconfig en `functions/`, con reglas de frontera por capa y un test que las prueba.
- Ajustar `.github/workflows/ci.yml` y `deploy-dev.yml` a `working-directory: functions`.
- Documentación:
  - ADR 0007, que reemplaza al ADR 0001.
  - D-01 y D-02 de `docs/plan-tecnico.md`, y también `docs/arquitectura.md`, `docs/guias/agregar-caso-de-uso.md`, `functions/README.md`, `CLAUDE.md` y `specs/ROADMAP.md`.
  - Las rutas, el número de ADR y los criterios de `specs/02-estructura-organizacion.md`.
  - Replicar `docs/` en `../escuelas-front/docs/` y `../docs/`.
- Desplegar a `dev` y pasar el humo.

**Out of scope:**

- Cambiar nombres, contratos (esquemas zod) o comportamiento de `listMyMemberships` y `changeMembershipRole`.
- Agregar lógica de negocio, módulos o callables nuevos (eso es la spec 02 en adelante).
- Cambiar el empaquetado con esbuild por `tsc` emit.
- Cambiar `firestore.rules`, `storage.rules`, `firestore.indexes.json` o `firebase.json`, salvo lo estrictamente necesario para la nueva ubicación.
- Herramientas nuevas de fronteras, como `eslint-plugin-boundaries` o `dependency-cruiser`.

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
    ├── index.ts                      solo exporta las callables
    ├── shared/
    │   ├── domain/                   DomainError (errors.ts), Clock (clock.ts)
    │   ├── application/              UnitOfWork, TransactionContext; testing/ (fake-clock, in-memory-unit-of-work)
    │   └── infrastructure/           admin.ts, system-clock.ts, to-https-error.ts, firestore-unit-of-work.ts
    ├── audit/
    │   ├── domain/                   audit-entry.ts (AuditEntry, AuditAction)
    │   ├── application/              audit-log-writer.ts (puerto); testing/in-memory-audit-log-writer.ts
    │   └── infrastructure/firestore/ firestore-audit-log-writer.ts
    ├── membership/
    │   ├── domain/                   role.ts, membership.ts
    │   ├── application/              change-membership-role.ts, membership-repository.ts (puerto);
    │   │                             testing/in-memory-membership-repository.ts
    │   └── infrastructure/
    │       ├── authorize.ts          requireUid, authorizeTenantMember
    │       ├── firestore/            repository, mapper, my-memberships-query
    │       └── callables/            listMyMemberships/{index,schema}.ts, changeMembershipRole/{index,schema}.ts
    └── scripts/                      seed.ts, seed-lib.ts, smoke-dev.ts (no se importan desde index.ts)
```

Reglas de dependencia (verificadas por `.eslintrc.js`):

| Capa | Puede importar | No puede importar |
| --- | --- | --- |
| `*/domain/**` | `shared/domain`, el `domain` de otros módulos | `firebase-admin*`, `firebase-functions*`, `@google-cloud/*`, `zod`, cualquier `application/` o `infrastructure/` |
| `*/application/**` | `domain` y `application` (propios, de otros módulos, de `shared`) | Firebase, `@google-cloud/*`, `zod`, cualquier `infrastructure/` |
| `*/infrastructure/**` | todo lo anterior y Firebase/zod | — |
| `scripts/**` | todo | — (nada en `src` importa `scripts/`) |

## Implementation plan

TDD en cada paso: primero el test que falla. Un commit convencional por paso, y se mueve con `git mv` para conservar el historial. Cada paso termina con `build`, `lint`, `typecheck` y los tests en verde.

0. **Línea base.** Correr `test:domain`, `test:rules` y `test:integration`, y anotar cuántos tests pasan en cada uno. Es la referencia de "sin regresiones".
1. **Frontera por lint, primero el test.** `functions/src/shared/infrastructure/lint-boundaries.test.ts` usa la API de ESLint (`lintText` con `filePath` ficticio) y comprueba que fallan los imports prohibidos de la tabla y que pasan los permitidos. Después se agregan los `overrides` en `functions/.eslintrc.js`, que absorbe `.eslintrc.base.js` y la regla de `packages/domain/.eslintrc.js`.
2. **Dominio a `functions/src`.**
   - Mover `packages/domain/src` a `shared/`, `audit/` y `membership/` según el árbol, con los tests co-ubicados y los fakes en `application/testing/`.
   - Reemplazar los imports de `@escuelas/domain` por rutas relativas.
   - Crear `vitest.unit.config.ts` y el script `test:unit`.
   - Eliminar `packages/domain` y su entrada en el workspace, y quitar el alias de `vitest.integration.config.ts`.
3. **Adaptadores y callables por módulo.**
   - Mover `functions/src/adapters/firestore/*`, `callables/*` y `shared/*` a su módulo y capa.
   - `authorize.ts` va a `membership/infrastructure/`, porque depende del repositorio de membresías.
   - Los tests de `functions/test/integration/` pasan junto al código como `*.integration.test.ts`; los helpers de emulador van a `shared/infrastructure/testing/`.
   - Ajustar `vitest.integration.config.ts`.
4. **Scripts a `functions/src/scripts/`.** Mover `seed.ts`, `seed-lib.ts`, `smoke-dev.ts` y el test del seed. Eliminar `scripts/tsconfig.json` y `scripts/.eslintrc.js`.
5. **Un solo paquete npm.**
   - Pasar las devDependencies de la raíz (eslint y plugins, typescript, vitest, tsx, firebase-tools) a `functions/package.json`, junto con los scripts `build`, `lint`, `typecheck`, `test:unit`, `test:rules`, `test:integration`, `seed:emulator`, `seed:dev`, `smoke:dev` y `smoke:emulator`.
   - Absorber `tsconfig.base.json`.
   - Eliminar el `package.json`, el `package-lock.json` y `tsconfig.base.json` de la raíz, y generar `functions/package-lock.json`.
   - Comprobar que `firebase emulators:exec` corrido desde `functions/` encuentra `../firebase.json`.
6. **CI.** En `ci.yml` y `deploy-dev.yml`: `working-directory: functions`, la caché de npm apuntando a `functions/package-lock.json` y `test:domain` reemplazado por `test:unit`.
7. **Documentación.**
   - ADR 0007, `docs/adr/0007-estructura-modular-en-functions.md`, con las decisiones de esta spec. El ADR 0001 queda en estado "Reemplazada por ADR 0007".
   - D-01 (árbol de `escuelas-back`) y D-02 de `docs/plan-tecnico.md`.
   - `docs/arquitectura.md`, `docs/guias/agregar-caso-de-uso.md`, `functions/README.md` y `CLAUDE.md` (estado, comandos desde `functions/`, arquitectura).
   - `specs/02-estructura-organizacion.md`: rutas al nuevo árbol (`functions/src/structure/...`, `functions/src/scripts/create-tenant.ts`), su ADR pasa a 0008 y el criterio "packages/domain sin Firebase" pasa a la regla de capas.
   - `specs/ROADMAP.md`: fila 03, que se implementa antes que la 02.
   - Replicar `docs/` en `../escuelas-front/docs/` y `../docs/`.
8. **Despliegue a `dev`.** `firebase deploy --only functions,firestore,storage --project dev`, luego `npm run seed:dev` y `npm run smoke:dev` desde `functions/`.

## Acceptance criteria

- [ ] En la raíz del repo no existen `package.json`, `package-lock.json`, `tsconfig.base.json`, `packages/` ni `scripts/`; todo archivo `.ts` versionado está bajo `functions/`.
- [ ] Ningún archivo importa `@escuelas/domain`.
- [ ] Desde `functions/`, `npm run build`, `npm run lint` y `npm run typecheck` pasan sin errores ni advertencias.
- [ ] `npm run test:unit`, `npm run test:rules` y `npm run test:integration` pasan, con al menos la misma cantidad de tests que la línea base del paso 0.
- [ ] `lint-boundaries.test.ts` demuestra que fallan los imports de `firebase-admin`, `firebase-functions`, `@google-cloud/*`, `zod` o de `infrastructure/` desde `*/domain/**`, y los de Firebase o `infrastructure/` desde `*/application/**`, y que pasa un import de `domain` desde `infrastructure`.
- [ ] `functions/lib/index.js` exporta solo `listMyMemberships` y `changeMembershipRole`, y no contiene código de `scripts/` ni de tests.
- [ ] Los esquemas zod de las dos callables no cambian (diff limitado a imports y ubicación).
- [ ] `npm run seed:emulator` corrido dos veces deja los mismos documentos, y `npm run smoke:emulator` pasa.
- [ ] El CI (`ci.yml`) pasa en un PR real hacia `dev`.
- [ ] Tras desplegar a `escuelas-deportivas-dev`, `npm run smoke:dev` pasa.
- [ ] Existe el ADR 0007, el ADR 0001 figura como reemplazado, D-01/D-02, `arquitectura.md`, la guía, el README, `CLAUDE.md`, la spec 02 y el ROADMAP describen la estructura nueva, y `docs/` está replicado en los otros dos lugares.

## Decisiones

- **Sí: todo el código en `functions/src`, por módulo.** Una sola raíz de código, sin workspace ni build previo del dominio, y la carpeta dice de qué trata el negocio. _Decidido por el usuario el 2026-10-04; cambia D-01 y D-02._
- **No: mantener `packages/domain` como paquete aparte.** Daba una frontera física, pero a cambio de un workspace, un orden de build y el empaquetado del ADR 0001.
- **Sí: tres capas por módulo (`domain`, `application`, `infrastructure`).** Las entidades y reglas puras van en `domain`; los casos de uso y los puertos que necesitan, en `application`; Firestore y las callables, en `infrastructure`.
- **No: `ports/` y `adapters/in|out` como carpetas.** Más carpetas por módulo sin ganar claridad a esta escala.
- **Sí: frontera por `no-restricted-imports` de ESLint, probada con un test.** No suma dependencias, y el test evita que la regla se rompa en silencio.
- **No: `eslint-plugin-boundaries` ni `dependency-cruiser`.** Otra herramienta que configurar para tres reglas.
- **Sí: eliminar el `package.json` de la raíz.** `functions/` es el único paquete, y Cloud Build instala desde su propio lockfile. Los comandos se corren desde `functions/`. _Decidido por el usuario._
- **No: una raíz delgada que solo delegue.** Dos `package.json` y una capa de indirección.
- **Sí: scripts en `functions/src/scripts/`.** esbuild solo empaqueta lo que alcanza desde `src/index.ts`, así que no viajan al despliegue.
- **Sí: tests junto al código; los de rules quedan en `functions/test/rules/`.** Los de rules prueban archivos de la raíz, no código de un módulo.
- **Sí: `authorize.ts` en `membership/infrastructure`.** Depende del repositorio de membresías, y `shared/` no debe depender de un módulo.
- **Sí: `TransactionContext` en `shared/application` importa los puertos de los módulos (solo tipos).** Es el único punto de composición transaccional; se documenta como excepción en el ADR 0007.
- **Sí: se mantiene esbuild.** Funciona y está verificado en la nube, y cambiar el empaquetado no es parte de esta spec.
- **Sí: la spec 03 se implementa antes que la 02.** La 02 está en Borrador y sin código, así que nace directamente en la estructura nueva.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| La frontera por lint es más débil que la de paquete | Test de fronteras en CI; `lint` corre en cada PR y en el predeploy |
| Cloud Build falla con el nuevo `functions/package-lock.json` | Paso 8: se despliega a `dev` antes de dar la spec por cumplida |
| `firebase emulators:exec` no encuentra `firebase.json` desde `functions/` | Se verifica en el paso 5; si falla, `--config ../firebase.json` en los scripts |
| Se pierde el historial de los archivos movidos | `git mv` y commits de movimiento separados de los de edición |
| `TransactionContext` acopla `shared` con cada módulo nuevo | Imports solo de tipos, excepción documentada en ADR 0007; se revisa si crece demasiado |
| Hoy `deploy-dev.yml` no construye `packages/domain` antes del predeploy (posible fallo, no verificado en GitHub) | Desaparece al eliminar el paquete; el paso 6 lo confirma en CI |

## What is **not** in this spec

- Cambios de comportamiento o de contratos en las callables.
- Módulos de negocio nuevos (sedes, categorías, grupos: spec 02).
- Cambiar esbuild por otra forma de empaquetar.
- Herramientas nuevas de análisis de dependencias.
