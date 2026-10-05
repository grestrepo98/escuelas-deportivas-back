# ADR 0009 — API HTTP por módulo con Express

- **Estado:** Aceptada. Implementada en la spec 04; el despliegue a `dev` está pendiente (ver "Verificación")
- **Fecha:** 2026-10-04
- **Spec:** `specs/04-api-http-por-modulo.md` · **Plan:** D-03
- **Reemplaza a:** la parte de "callables" de los ADR 0002, 0005, 0007 y 0008 (sus decisiones de negocio siguen vigentes)

## Resumen

Cada módulo expone **una sola Cloud Function HTTP** (`onRequest`) con una app
Express adentro que enruta todos los endpoints del módulo: `membershipApi`,
`tenantApi`, `structureApi` y las que vengan (`playersApi`, `paymentsApi`…). Se
reemplazan las 10 callables (`onCall`, una function por caso de uso). El cliente
sigue sin tocar Firestore ni Storage; lo que cambia es la forma del borde.

## Contexto

La spec 01 y la spec 02 expusieron cada caso de uso como una callable. Con 10 ya
se veía que el número de functions crece con cada caso de uso y que cada una es un
despliegue y un arranque en frío propios. Las fases 1 a 3 agregan decenas de casos
de uso. El front aún no llama ninguna callable (no tiene la dependencia `firebase`
ni `httpsCallable`), así que cambiar el contrato no rompe nada.

## Decisiones

| Tema | Decisión |
| --- | --- |
| Granularidad | Una function `onRequest` por **módulo**, no por caso de uso ni por entidad. `getStructure` cruza sedes, categorías y grupos y encaja en `structureApi` |
| Ruteo | Express 5 dentro de la function. Los errores de handlers async llegan al manejador de errores sin envoltorios |
| Estilo | REST bajo `/tenants/:tenantId/...` y `/me/...` |
| Autenticación | `Authorization: Bearer <idToken>` verificado con `verifyIdToken` en un middleware compartido. Sin token o con token inválido, `401` |
| Autorización | Sin cambios (ADR 0002): cada petición lee `memberships/{uid}_{tenantId}`. El `tenantId` ahora viaja en la ruta y sigue sin confiarse |
| Actor | Siempre sale del token, nunca de la petición |
| Contratos | zod de entrada y salida junto a cada handler (`routes/<nombre>/schema.ts`). El back sigue siendo la fuente de verdad y no se publica nada |
| Entrada inválida | `400` con los nombres de los campos inválidos, nunca sus valores |
| CORS | `cors: true` de `onRequest` mientras solo exista `dev`; lista de orígenes por ambiente antes de crear `prod`. Sin dependencia `cors` |
| Hexagonal | Express solo en `<módulo>/infrastructure/http/`. `domain` y `application` no lo importan (regla nueva de ESLint, probada por `lint-boundaries.test.ts`) |
| Casos de uso y adaptadores | Sin cambios |
| Cambio incompatible | La ruta anterior sigue funcionando (o la nueva va bajo otra versión de ruta) hasta que el front publique la suya |

## Estructura

```
functions/src/
├── index.ts                            solo exporta las APIs: membershipApi, tenantApi, structureApi
├── shared/infrastructure/http/         create-api, authenticate, error-handler, parse, device
└── <módulo>/infrastructure/http/
    ├── <módulo>-api.ts                 onRequest({cors}, app)
    ├── router.ts                       ruta → handler
    └── routes/<nombre>/{handler.ts,schema.ts}
```

## Rutas de lo que ya existe

(Las rutas de usuarios, `POST`/`GET …/memberships`, `PATCH …/status` y
`PUT …/scope`, las agregó la spec 05: ADR 0010.)

| API | Ruta | Hoy (callable) |
| --- | --- | --- |
| `membershipApi` | `GET /me/memberships` | `listMyMemberships` |
| `membershipApi` | `PATCH /tenants/:tenantId/memberships/:uid/role` | `changeMembershipRole` |
| `tenantApi` | `PUT /tenants/:tenantId/profile` | `updateTenantProfile` |
| `structureApi` | `GET /tenants/:tenantId/structure` | `getStructure` |
| `structureApi` | `POST /tenants/:tenantId/{venues,categories,groups}` | `save*` sin id |
| `structureApi` | `PUT /tenants/:tenantId/{venues,categories,groups}/:id` | `save*` con id |
| `structureApi` | `PATCH /tenants/:tenantId/{venues,categories,groups}/:id/status` | `set*Status` |

## Errores

El cuerpo es `{error: {code, message}}`. La tabla reemplaza a `toHttpsError`.

| Error de dominio o de borde | Estado HTTP |
| --- | --- |
| Sin token o token inválido | `401` |
| `invalid_argument` (y entrada que no cumple el zod) | `400` |
| `permission_denied` | `403` |
| `not_found` y ruta desconocida | `404` |
| `failed_precondition` | `409` |
| Cualquier otro | `500` con `Internal error` |

## Alternativas descartadas

- **Mantener una callable por caso de uso:** verifica el token, serializa y
  estandariza errores sin código propio, pero el número de functions crece con
  cada caso de uso.
- **Una callable por módulo con un campo `action`:** conserva las comodidades del
  SDK, pero no es REST y obliga a despachar a mano.
- **Una function por entidad** (`venueApi`, `categoryApi`, `groupApi`…): más
  granular, pero más arranques en frío, y `getStructure` queda sin lugar natural.
- **Una sola function para todo el backend:** el menor número de despliegues, pero
  un solo arranque en frío para todos los módulos y un solo punto de falla.

## Consecuencias

- **Perdemos lo que `onCall` daba gratis:** la verificación del token, el sobre
  `{data}` y los errores estándar. Pasamos a mantener un middleware de
  autenticación, un manejador de errores y la configuración de CORS. Son piezas
  pequeñas, compartidas y con tests.
- **Ganamos** REST simple, menos functions y menos arranques en frío. Agregar un
  caso de uso agrega una ruta al router del módulo, no una function.
- Express y `@types/express` son dependencias nuevas (`dependencies` y
  `devDependencies`).
- El primer despliegue a `dev` exige eliminar antes, a mano y una sola vez, las 10
  functions anteriores (`firebase functions:delete … --force`). El CI no usa
  `--force`: así un `--force` permanente no podría borrar en `dev`, sin aviso,
  cualquier function que desaparezca de `index.ts`.
- El front tendrá un adaptador con `fetch` y el token en `Authorization`, en vez de
  `httpsCallable`.

## Verificación

- Hecho: tests de integración por HTTP de cada ruta (401, 400, 403, camino feliz y
  bitácora), tests unitarios de `authenticate`, `parse`, `error-handler`, `device` y
  `create-api`, la regla de ESLint para `express` probada en `lint-boundaries.test.ts`
  y `smoke:emulator`.
- Pendiente: despliegue a `dev` (borrado de las 10 callables hecho; faltan reglas y
  functions), `seed:dev`, `smoke:dev` y el CI en un PR real.
