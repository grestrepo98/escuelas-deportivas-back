# ADR 0008 — Estructura modular en `functions`

- **Estado:** Aceptada (verificación en `dev` pendiente, ver "Verificación")
- **Fecha:** 2026-10-04
- **Spec:** `specs/03-reestructura-modular-functions.md`
- **Reemplaza a:** ADR 0001 (empaquetado de `packages/domain`)

## Resumen

Todo el código del backend vive en `functions/src`, organizado **por módulo de
negocio** y, dentro de cada módulo, en tres capas hexagonales: `domain`,
`application` e `infrastructure`. Desaparecen el workspace npm, el paquete
`packages/domain` y el `package.json` de la raíz. La frontera entre capas deja de
ser física y pasa a estar verificada por ESLint y probada por un test.

## Contexto

El código estaba repartido en `packages/domain`, `functions/src` y `scripts/`, y
organizado por tipo técnico (`ports/`, `adapters/`, `callables/`). El dominio era
un paquete aparte para que la frontera fuera física (D-01, D-02), a cambio de un
workspace, de compilar el dominio antes que todo lo demás y de empaquetarlo con
esbuild (ADR 0001). Ese costo ya produjo un fallo de despliegue: `deploy-dev.yml`
fallaba en un checkout limpio porque `packages/domain/dist` no existía.

La spec 02 sumó dos módulos (`tenant`, `structure`), un puerto genérico y 8
callables, todo en la estructura por tipo técnico. Antes de seguir con la Fase 1
(usuarios, jugadores, documentos…) la estructura pasa a ser por módulo.

## Decisiones

| Tema | Decisión |
| --- | --- |
| Raíz de código | Todo en `functions/src`. `functions/` es el único paquete npm del repo, con su propio `package-lock.json` |
| Organización | Por módulo (`audit`, `membership`, `tenant`, `structure`) más `shared/` y `scripts/` |
| Capas por módulo | `domain` (entidades y reglas puras), `application` (casos de uso y puertos) e `infrastructure` (Firestore y callables) |
| Frontera | `no-restricted-imports` en `functions/.eslintrc.js`, probada por `shared/infrastructure/lint-boundaries.test.ts` |
| Herramientas de frontera | Ninguna nueva: no se usa `eslint-plugin-boundaries` ni `dependency-cruiser` |
| Empaquetado | Se mantiene esbuild (`build.mjs`, entrada `src/index.ts`); el bundle ya no necesita workspace |
| Scripts | `functions/src/scripts/`; esbuild solo empaqueta lo que alcanza `src/index.ts`, así que no viajan al despliegue |
| Tests | Junto al código: `*.test.ts` (unitarios) y `*.integration.test.ts` (emulador). Los de rules, en `functions/test/rules/` |
| Comandos | Todos desde `functions/` |

## Estructura

```
functions/src/
├── index.ts          solo exporta las 10 callables
├── shared/           domain (DomainError, Clock) · application (UnitOfWork) · infrastructure
├── audit/            domain · application · infrastructure/firestore
├── membership/       domain · application · infrastructure/{firestore,callables,authorize.ts}
├── tenant/           domain · application · infrastructure/{firestore,callables}
├── structure/        domain · application · infrastructure/{firestore,callables}
└── scripts/          seed, smoke-dev, create-tenant (no se importan desde index.ts)
```

Los dobles en memoria de cada puerto viven en `application/testing/` de su
módulo; los helpers de emulador, en `shared/infrastructure/testing/`.

## Reglas de dependencia

| Capa | Puede importar | No puede importar |
| --- | --- | --- |
| `*/domain/**` | `shared/domain` y el `domain` de otros módulos | Firebase, `@google-cloud/*`, `zod`, cualquier `application/` o `infrastructure/` |
| `*/application/**` | `domain` y `application` (propios, de otros módulos y de `shared`) | Firebase, `@google-cloud/*`, `zod`, cualquier `infrastructure/` |
| `*/infrastructure/**` | todo lo anterior y Firebase/zod | — |
| `scripts/**` | todo | — (nada en `src` importa `scripts/`) |

`require-owner.ts` y `group-parents.ts` van en `application`, no en `domain`,
porque reciben puertos de repositorio. `authorize.ts` va en
`membership/infrastructure`, porque depende del repositorio de membresías y
`shared/` no debe depender de un módulo.

## Excepción documentada: `TransactionContext`

`shared/application/unit-of-work.ts` define `TransactionContext`, que referencia
los puertos de cuatro módulos (`membership`, `audit`, `tenant`, `structure`).
Son imports **solo de tipos** y es el único punto de composición transaccional:
un caso de uso recibe todos los repositorios ligados a la misma transacción. Crece
con cada módulo nuevo; se revisa al sumar jugadores.

## Alternativas descartadas

- **Mantener `packages/domain`:** daba una frontera física, pero a cambio de un
  workspace, un orden de build y el empaquetado del ADR 0001.
- **`ports/` y `adapters/in|out` como carpetas:** más carpetas por módulo sin
  ganar claridad a esta escala.
- **Una raíz delgada que solo delegue:** dos `package.json` y una capa de
  indirección.
- **`eslint-plugin-boundaries` o `dependency-cruiser`:** otra herramienta que
  configurar para tres reglas.
- **Cambiar esbuild por `tsc` emit:** funciona y está verificado en la nube;
  cambiarlo no es parte de esta decisión.

## Consecuencias

- La frontera es más débil que la de paquete: depende de que `lint` corra. Corre
  en cada PR y en el `predeploy`, y el test de fronteras evita que la regla se
  rompa en silencio.
- Agregar un módulo es agregar una carpeta con sus tres capas; no toca la
  configuración del repo.
- Cloud Build instala desde `functions/package-lock.json`. Las devDependencies
  (eslint, vitest, firebase-tools…) conviven en el mismo `package.json`; el
  bundle no las incluye porque solo las `dependencies` quedan externas y lo demás
  se alcanza desde `src/index.ts`.
- El historial de los archivos movidos se conserva (`git mv`).

## Verificación

- Hecho (local, desde `functions/`): `build`, `lint` y `typecheck` limpios;
  `test:unit` (219, incluye 34 del test de fronteras), `test:rules` (222) y
  `test:integration` (223); `smoke:emulator` pasa; `lib/index.js` exporta
  exactamente las 10 callables y no contiene código de `scripts/` ni de tests.
- Pendiente: CI en un PR real hacia `dev`, y el despliegue a
  `escuelas-deportivas-dev` con `seed:dev` y `smoke:dev` (paso 8 de la spec).
