# SPEC 04 — API HTTP por módulo con Express (deuda técnica tras la spec 03)

> **Status:** Implemented
> **Depends on:** SPEC 01, SPEC 02 y SPEC 03 (todas implementadas como callables). Decisión en `docs/adr/0009-api-http-por-modulo.md` y en D-03 de `docs/plan-tecnico.md`.
> **Date:** 2026-10-04
> **Objective:** Que cada módulo exponga todos sus endpoints en una sola Cloud Function HTTP con Express, en lugar de una callable por caso de uso, sin cambiar casos de uso, reglas de negocio, autorización ni datos.

---

## Por qué existe esta spec

Hoy `functions/src/index.ts` exporta 10 callables (`onCall`), una por caso de uso. Cada una es un despliegue y un arranque en frío propios, y las fases 1 a 3 agregan decenas de casos de uso más. La decisión (ADR 0009) es una Cloud Function `onRequest` por módulo, con una app Express adentro que enruta todos los endpoints del módulo, adaptada a la arquitectura hexagonal: Express vive solo en `infrastructure`.

El front todavía no llama ninguna callable (no tiene `firebase` ni `httpsCallable`), así que cambiar el contrato no exige periodo de transición. Es el momento más barato para hacerlo.

## Scope

**In:**

- Tres APIs: `membershipApi`, `tenantApi` y `structureApi`, cada una con su router Express en `<módulo>/infrastructure/http/`.
- Base compartida en `shared/infrastructure/http/`: `create-api` (Express, `express.json()` con el límite por defecto de 100kb, autenticación, router, manejador de errores), `authenticate` (`Authorization: Bearer` → `verifyIdToken` → `uid`), `error-handler`, `parse` y `device`.
- Mover los handlers y los esquemas zod de `callables/<nombre>/` a `http/routes/<nombre>/{handler,schema}.ts`, con el `tenantId` en la ruta.
- `requireUid` y `authorizeTenantMember` dejan de lanzar `HttpsError` y lanzan `DomainError`; el manejador de errores los traduce.
- Eliminar `infrastructure/callables/`, `shared/infrastructure/callable.ts` y `to-https-error.ts` (su mapeo pasa al manejador de errores, con test equivalente).
- Dependencias: `express` (^5) en `dependencies` y `@types/express` en `devDependencies`.
- Regla de frontera nueva: `domain` y `application` no importan `express` (en `.eslintrc.js`, probada por `lint-boundaries.test.ts`).
- Tests de integración por HTTP contra el emulador, con un helper `callApi` que reemplaza a `callCallable`. Actualizar `smoke-dev.ts` y `smoke:emulator`.
- CORS con `cors: true` en `onRequest` (cualquier origen mientras solo exista `dev`).
- `setGlobalOptions` en `index.ts` se mantiene con `maxInstances: 10` (por function).
- Borrado manual, una sola vez, de las 10 callables en `dev` (`firebase functions:delete … --project dev --force`) antes del primer despliegue; `deploy-dev.yml` no cambia. Luego despliegue a `dev`, `seed:dev` y `smoke:dev`.
- Documentación (ya actualizada en esta sesión): D-03 y D-01 del plan técnico, ADR 0009, notas en los ADR 0002, 0005, 0007 y 0008, `arquitectura.md`, la guía de casos de uso y `CLAUDE.md`. Al terminar el código, reescribir `functions/README.md` y quitar de `CLAUDE.md`, `arquitectura.md` y la guía los avisos de "hoy el código expone callables".

**Out of scope:**

- Cambiar casos de uso, puertos, adaptadores de Firestore, reglas de negocio, visibilidad, bitácora o datos.
- Cambiar `firestore.rules`, `storage.rules` o `firestore.indexes.json`.
- Una function por entidad, o una sola function para todo el backend (ver ADR 0009).
- Publicar un paquete de contratos o un cliente generado: el front sigue escribiendo su propio adaptador.
- Versionado de rutas (`/v1`): se agrega cuando haya un cambio incompatible real.
- Lista de orígenes CORS por ambiente: es requisito previo a crear `prod`, no de esta spec.
- Módulos de negocio nuevos (spec 05 en adelante).

## Data model

Sin datos nuevos. Cambia la forma del borde.

```
functions/src/
├── index.ts                          solo exporta membershipApi, tenantApi, structureApi
├── shared/infrastructure/http/       create-api.ts, authenticate.ts, error-handler.ts,
│                                     parse.ts, device.ts (con sus tests)
├── membership/infrastructure/http/   membership-api.ts, router.ts, routes/<nombre>/{handler,schema}.ts
├── tenant/infrastructure/http/       tenant-api.ts, router.ts, routes/<nombre>/{handler,schema}.ts
└── structure/infrastructure/http/    structure-api.ts, router.ts, routes/<nombre>/{handler,schema}.ts
```

### Rutas y contratos

El `tenantId` viaja en la ruta. El actor sale siempre del token. Los cuerpos se validan con zod `.strict()`.

| API             | Método y ruta                                         | Cuerpo / consulta                                                   | Respuesta                                                          | Reemplaza a                         |
| --------------- | ----------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------- |
| `membershipApi` | `GET /me/memberships`                                 | —                                                                   | `200 { memberships: { tenantId, tenantName, role, scope }[] }`     | `listMyMemberships`                 |
| `membershipApi` | `PATCH /tenants/:tenantId/memberships/:uid/role`      | `{ newRole, reason? }`                                              | `200 { membershipId, role }`                                       | `changeMembershipRole`              |
| `tenantApi`     | `PUT /tenants/:tenantId/profile`                      | `{ name, idrdRegistration?, contact: { email?, phone? } }`          | `200 { tenantId }`                                                 | `updateTenantProfile`               |
| `structureApi`  | `POST /tenants/:tenantId/venues`                      | `{ name, address, facility? }`                                      | `201 { venueId }`                                                  | `saveVenue` sin id                  |
| `structureApi`  | `PUT /tenants/:tenantId/venues/:venueId`              | `{ name, address, facility? }`                                      | `200 { venueId }`                                                  | `saveVenue` con id                  |
| `structureApi`  | `PATCH /tenants/:tenantId/venues/:venueId/status`     | `{ status: "active" \| "closed", reason? }`                         | `200 { venueId, status }`                                          | `setVenueStatus`                    |
| `structureApi`  | `POST`, `PUT` y `PATCH …/status` bajo `/categories`   | misma forma, con `birthYears?`                                      | `{ categoryId[, status] }`                                         | `saveCategory`, `setCategoryStatus` |
| `structureApi`  | `POST`, `PUT` y `PATCH …/status` bajo `/groups`       | misma forma, con `categoryId`, `schedule` y `venueId` solo al crear | `{ groupId[, status] }`                                            | `saveGroup`, `setGroupStatus`       |
| `structureApi`  | `GET /tenants/:tenantId/structure?includeClosed=true` | —                                                                   | `200 { venues, categories, groups }` (DTO con fechas ISO 8601 UTC) | `getStructure`                      |

Errores: cuerpo `{ error: { code, message } }` con `401` (sin token o token inválido), `400` (entrada inválida; solo nombres de campos), `403` (sin membresía activa o sin rol), `404` (no existe; ruta desconocida), `409` (`failed_precondition`) y `500` (genérico). Tabla completa en el ADR 0009.

## Implementation plan

TDD en cada paso (test que falla primero). Un commit convencional por paso. Cada paso termina con `build`, `lint`, `typecheck` y las suites en verde.

0. **Línea base.** Anotar cuántos tests pasan en `test:unit`, `test:rules` y `test:integration`.
1. **Base HTTP compartida.** Tests unitarios de `error-handler`, `parse` y `authenticate` (con `verifyIdToken` inyectado); después `create-api.ts`. Agregar `express` y `@types/express`. Regla de lint y caso en `lint-boundaries.test.ts` para `express` en `domain` y `application`. Helper `callApi(fn, método, ruta, cuerpo?, idToken?)`.
2. **`membershipApi`.** Portar los tests de integración de `listMyMemberships` y `changeMembershipRole` a las rutas (mismos casos, más 401 sin token y 403 de otro tenant), y mover los handlers. `changeMembershipRole` usa el `parseInput` compartido en vez de su `safeParse` propio.
3. **`tenantApi`.** Escribir el test de integración que hoy falta, y el handler.
4. **`structureApi`.** Portar los tests de `structure-callables`, `category-group-callables` y `get-structure`, y mover los handlers.
5. **Limpieza.** Eliminar `callables/`, `callable.ts` y `to-https-error.ts` (con su test, reemplazado por el del manejador de errores). Actualizar `index.ts`.
6. **Humo.** Actualizar `smoke-dev.ts`: URL local `http://127.0.0.1:5001/<proyecto>/us-central1/<api><ruta>` y en `dev` `https://us-central1-<proyecto>.cloudfunctions.net/<api><ruta>`. El seed no usa callables; solo verificarlo.
7. **Despliegue a `dev`.** Desde local, borrar las 10 callables: `firebase functions:delete listMyMemberships changeMembershipRole updateTenantProfile saveVenue setVenueStatus saveCategory setCategoryStatus saveGroup setGroupStatus getStructure --project dev --force`. Después `firebase deploy --only functions,firestore,storage --project dev`, `seed:dev` y `smoke:dev`. `deploy-dev.yml` no cambia. Esto también cierra lo que las specs 02 y 03 dejaron pendiente en `dev`.
8. **Documentación final.** Reescribir `functions/README.md` (árbol, rutas y reglas de toda ruta); quitar de `CLAUDE.md`, `arquitectura.md` y la guía los avisos de estado transitorio; poner la spec en `Implemented`; replicar `docs/` en `../escuelas-front/docs/` y `../docs/`.

## Acceptance criteria

- [ ] `functions/lib/index.js` exporta exactamente `membershipApi`, `tenantApi` y `structureApi`, y `express` queda como dependencia externa del bundle.
- [ ] No existe `infrastructure/callables/`, `callable.ts` ni `to-https-error.ts`, y ningún archivo importa `firebase-functions/v2/https` fuera de los `<módulo>-api.ts` y de `shared/infrastructure/http/`.
- [ ] `lint-boundaries.test.ts` demuestra que `express` falla en `*/domain/**` y `*/application/**` y pasa en `*/infrastructure/**`.
- [ ] Cada ruta de la tabla tiene tests de integración por HTTP: sin token → 401, entrada inválida → 400 (campo faltante, valor fuera de rango, campo extra), usuario de otro tenant → 403 sin cambios, cada rol no autorizado → 403, membresía recién desactivada → 403 con el mismo token, camino feliz y bitácora si escribe. Una ruta desconocida responde 404.
- [ ] Los casos de uso, los puertos y los adaptadores de Firestore no cambian (diff limitado a imports y ubicación del borde); los esquemas zod conservan sus campos, salvo `tenantId` (ruta) y, en `changeMembershipRole`, `targetUid` (ruta).
- [ ] Un error de dominio no esperado responde 500 con mensaje genérico, sin filtrar el mensaje original.
- [ ] `test:unit`, `test:rules` y `test:integration` pasan, con al menos la cobertura de casos de la línea base; `build`, `lint` y `typecheck` pasan sin errores ni advertencias.
- [ ] `smoke:emulator` pasa; tras el despliegue a `escuelas-deportivas-dev`, `seed:dev` y `smoke:dev` pasan, y en `dev` quedan solo las tres APIs.
- [ ] Una petición `OPTIONS` con cualquier origen recibe la cabecera `Access-Control-Allow-Origin`.
- [ ] `deploy-dev.yml` no usa `--force` y `index.ts` mantiene `maxInstances: 10`.
- [ ] El CI pasa en un PR real hacia `dev`.
- [ ] `functions/README.md`, `CLAUDE.md`, `arquitectura.md` y la guía describen las rutas sin avisos transitorios, y `docs/` está replicado en los otros dos lugares.

## Decisiones

- **Sí: una function `onRequest` por módulo con Express.** Menos functions y menos arranques en frío; agregar un caso de uso es agregar una ruta. _Decidido por el usuario el 2026-10-04; cambia D-03._
- **Sí: agrupar por módulo, no por entidad.** `getStructure` cruza sedes, categorías y grupos y encaja en `structureApi`. _Decidido por el usuario el 2026-10-04._
- **No: mantener las callables.** El número de functions crece con cada caso de uso.
- **No: una callable por módulo con un campo `action`.** No es REST y obliga a despachar a mano.
- **Sí: Express solo en `infrastructure/http`.** Los casos de uso no saben que existe; la frontera la hace cumplir ESLint.
- **Sí: sin periodo de transición.** El front no llama ninguna callable todavía.
- **Sí: el `tenantId` va en la ruta y se valida contra la membresía en cada petición.** D-05 y D-06 no cambian.
- **Sí: `cors: true` de `onRequest`, sin la dependencia `cors`.** Hoy solo existe `dev`, sin datos reales. _Decidido por el usuario el 2026-10-04._
- **No: lista de orígenes por ambiente (param `CORS_ORIGINS`).** Se hace antes de crear `prod`, en su propia tarea.
- **Sí: borrado manual único de las 10 callables.** Evita un `--force` permanente que borraría en `dev`, sin aviso, cualquier function que desaparezca de `index.ts`.
- **No: `--force` permanente en `deploy-dev.yml`.**
- **Sí: mantener `maxInstances: 10` por function.** Con concurrencia 80 por instancia en 2nd gen sobra para ~200 jugadores.
- **No: subir a 20.** Mayor techo de gasto ante un bucle, sin necesidad medida.
- **Sí: límite del cuerpo por defecto de Express (100kb).** Los archivos nunca pasan por functions (D-08).
- **No: 10kb explícito.** Habría que revisarlo cuando un módulo mande listas (p. ej. asistencia).
- **Sí: errores como `{ error: { code, message } }` con estados HTTP.** Tabla en el ADR 0009.

## Risks

| Riesgo                                                                                                             | Mitigación                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Perdemos lo que `onCall` daba gratis (token, sobre, errores estándar)                                              | Tres piezas pequeñas, compartidas y con tests unitarios (paso 1)                                                                |
| Un handler olvida la autorización y la ruta queda abierta a cualquier sesión                                       | El router aplica `authenticate` a todo; el test de contrato exige 403 de otro tenant en cada ruta                               |
| `dev` queda abierto a cualquier origen (`cors: true`)                                                              | Aceptado mientras no haya datos reales; la autenticación sigue exigiendo token. Se cierra con lista de orígenes antes de `prod` |
| Se olvida el borrado manual y el despliegue en CI se detiene pidiendo confirmar la eliminación de las 10 functions | Ejecutar primero el comando del paso 7                                                                                          |
| La capacidad total baja de 100 a 30 instancias (3 functions × 10)                                                  | Aceptado; se mide en el piloto                                                                                                  |
| Una sola function por módulo comparte arranque en frío y límites entre todas sus rutas                             | Aceptado; se mide en el piloto y se separa un módulo si hace falta                                                              |
| Express 5 trae dependencias nuevas al bundle                                                                       | `express` en `dependencies` (queda externo, no se incluye en esbuild)                                                           |

## What is **not** in this spec

- Cambios de casos de uso, reglas de negocio o datos.
- Módulos de negocio nuevos (usuarios, jugadores, documentos…: spec 05 en adelante).
- Versionado de rutas, cliente generado o paquete de contratos.
