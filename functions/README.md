# `functions`

Cloud Functions (2.ª generación, Node 24, TypeScript). Expone los casos de uso
del dominio como callables y contiene los adaptadores de Firestore. Región fija
`us-central1` (ADR 0003).

## Estructura

```
src/
├── index.ts                      # setGlobalOptions + exporta las callables
├── callables/<nombre>/
│   ├── schema.ts                 # zod de entrada y salida (el contrato)
│   └── index.ts                  # onCall: sesión → validar → autorizar → caso de uso
├── adapters/firestore/           # implementan los puertos del dominio
└── shared/                       # authorize, errors, clock, admin
test/
├── rules/                        # reglas de Firestore/Storage (emulador)
└── integration/                  # adaptadores y callables (emulador)
```

## Callables

| Nombre | Quién | Qué hace |
| --- | --- | --- |
| `listMyMemberships` | cualquier usuario con sesión | Lista las membresías activas propias con el nombre del tenant |
| `changeMembershipRole` | `owner` activo del tenant | Cambia el rol de otra membresía y registra la bitácora en la misma transacción |

El contrato de cada una vive en su `schema.ts`. El back es la fuente de verdad;
el front mantiene su propia copia en su adaptador de datos (D-01).

## Reglas que cumple toda callable

1. `requireUid(request.auth)` primero: el `uid` sale de la sesión, nunca del payload.
2. El payload se valida con zod; si falla, `invalid-argument`.
3. `authorizeTenantMember(db, uid, tenantId)` lee `memberships/{uid}_{tenantId}`
   en **cada llamada** (D-06). Sin membresía activa: `permission-denied`.
4. Los errores de negocio salen de `DomainError` y se traducen con `toHttpsError`;
   los inesperados se ocultan como `internal`.

## Comandos

Desde la raíz del repo:

```bash
npm run build              # tsc del dominio + typecheck + bundle esbuild de functions
npm run lint
npm run typecheck
npm run test:domain        # sin emulador
npm run test:rules         # emuladores Firestore + Storage
npm run test:integration   # compila y levanta Auth + Firestore + Functions
npm run seed:emulator      # datos de prueba (dentro de emulators:exec o start)
SEED_PASSWORD=... npm run seed:dev
SEED_PASSWORD=... FIREBASE_API_KEY=... npm run smoke:dev   # callables desplegadas
npm run smoke:emulator     # verifica el propio smoke test en local
```

`test:rules` y `test:integration` arrancan y apagan los emuladores solos
(`firebase emulators:exec`) con proyectos `demo-*`: nunca tocan `dev`.

## Empaquetado

Cloud Functions solo sube esta carpeta, así que `build.mjs` empaqueta con
esbuild a `lib/index.js` e incluye `@escuelas/domain`. Las `dependencies`
(`firebase-admin`, `firebase-functions`, `zod`) quedan externas. Detalle en
`docs/adr/0001-empaquetado-del-workspace.md`.

> Cualquier paquete nuevo que deba existir en producción va en `dependencies`;
> si va en `devDependencies`, esbuild lo incluirá en el bundle.

## Diferencias entre el emulador y la nube

El emulador no replica el 100 % de producción. Caso real del paso 15: en Cloud Functions el
runtime ya crea apps de Admin con otro nombre, así que `getApps().length === 0` no sirve para
decidir si inicializar la app por defecto (daba `app/no-app` y un 500 solo en `dev`).
`shared/admin.ts` busca la app `[DEFAULT]` por nombre y `test/integration/admin.test.ts` lo
cubre. Por eso el humo en `dev` (`npm run smoke:dev`) es parte de la verificación.

## Seed

`scripts/seed.ts` (en la raíz) crea `tenant-a` con un usuario por rol y
`tenant-b` con un `owner`, de forma idempotente. El destino es obligatorio
(`--target emulator|dev`), `prod` no existe como opción y `dev` exige
`SEED_PASSWORD`. Para `dev` hacen falta credenciales de aplicación
(`gcloud auth application-default login` o `GOOGLE_APPLICATION_CREDENTIALS`).
