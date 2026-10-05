# ADR 0012 — Ubicación de los tests en `functions/test/`

- **Estado:** Aceptada
- **Fecha:** 2026-10-04
- **Enmienda a:** ADR 0008 (fila "Tests" de la estructura modular)

## Resumen

Los tests unitarios y de integración salen de `functions/src/` y pasan a
`functions/test/unit/` y `functions/test/integration/`, espejando la ruta de `src/`.
Es un refactor puro: ninguna prueba cambia de contenido ni de cantidad.

## Decisiones

| Tema | Decisión |
| --- | --- |
| Unitarios | `test/unit/<ruta de src>/<nombre>.test.ts`; los recoge `vitest.unit.config.ts` |
| Integración | `test/integration/<ruta de src>/<nombre>.integration.test.ts`; los recoge `vitest.integration.config.ts` |
| Rules | Sin cambios: `test/rules/` |
| Dobles en memoria | Siguen en `src/<módulo>/application/testing/` (no son tests, los importan scripts y otros módulos). Solo los archivos `*.test.ts` se mueven, incluidos los que prueban los dobles (`fakes.test.ts`) |
| Importaciones | Relativas con extensión `.js` hacia `src/` (NodeNext), p. ej. `../../../../src/player/domain/player.js` |
| Frontera de capas | Las sobreescrituras de `.eslintrc.js` para `src/*/domain/**` y `src/*/application/**` no cambian; `lint-boundaries.test.ts` sigue probándolas con rutas ficticias de `src/` |
| tsconfig | `tsconfig.json` ya incluía `test`; no cambia. El bundle de esbuild no cambia (entrada `src/index.ts`) |

## Por qué

- `src/` queda solo con código de producción: es más fácil de leer y de revisar.
- Un solo árbol `test/` para los tres tipos de prueba (unit, integration, rules).
- El espejo de rutas mantiene a la vista qué archivo prueba cada test.

## Costos

- Las importaciones desde los tests son más largas.
- Un archivo y su test ya no aparecen juntos en el explorador.

## Verificación

- `test:unit` mantiene sus 39 archivos y 709 pruebas.
- `typecheck`, `lint`, `format:check` y `build` pasan; `test:integration` y `test:rules` se corren con emuladores.
