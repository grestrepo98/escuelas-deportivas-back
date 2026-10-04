# `functions`

Cloud Functions (2.ª generación, Node 24, TypeScript). Es el único paquete npm del
repo y contiene todo el código del backend, organizado por módulo (ADR 0008):
dominio, casos de uso, adaptadores de Firestore y callables. Región fija
`us-central1` (ADR 0003).

## Estructura

```
src/
├── index.ts                      # setGlobalOptions + exporta las 10 callables
├── shared/                       # domain (DomainError, Clock) · application (UnitOfWork)
│                                 # · infrastructure (admin, callable, toHttpsError, unit of work)
├── audit/ membership/ tenant/ structure/
│   ├── domain/                   # entidades y reglas puras
│   ├── application/              # casos de uso, puertos y testing/ (dobles en memoria)
│   └── infrastructure/
│       ├── firestore/            # adaptadores de los puertos
│       └── callables/<nombre>/   # schema.ts (zod, el contrato) + index.ts (onCall)
└── scripts/                      # seed, smoke-dev, create-tenant (no viajan al despliegue)
test/rules/                       # reglas de Firestore/Storage (emulador)
```

Los tests viven junto al código: `*.test.ts` (unitarios) y
`*.integration.test.ts` (emulador). `domain` y `application` no importan Firebase,
`zod` ni `infrastructure`: lo hace cumplir `.eslintrc.js` y lo prueba
`src/shared/infrastructure/lint-boundaries.test.ts`. Para sumar un caso de uso, ver
`docs/guias/agregar-caso-de-uso.md`.

## Callables

| Nombre | Quién | Qué hace |
| --- | --- | --- |
| `listMyMemberships` | cualquier usuario con sesión | Lista las membresías activas propias con el nombre del tenant |
| `changeMembershipRole` | `owner` activo del tenant | Cambia el rol de otra membresía y registra la bitácora en la misma transacción |
| `updateTenantProfile` | `owner` activo del tenant | Edita la ficha de la organización (nombre, registro IDRD, contacto) |
| `saveVenue` / `setVenueStatus` | `owner` activo del tenant | Crea o edita una sede / la cierra o reabre. Cerrar con grupos activos se rechaza |
| `saveCategory` / `setCategoryStatus` | `owner` activo del tenant | Igual, para categorías |
| `saveGroup` / `setGroupStatus` | `owner` activo del tenant | Igual, para grupos. Sede y categoría deben estar activas; la sede no cambia |
| `getStructure` | `owner`, `accountant`, `coordinator`, `teacher` | Árbol de sedes, categorías y grupos filtrado por rol y alcance. `includeClosed` incluye lo cerrado |

Cada escritura deja exactamente una entrada de bitácora en la misma transacción.
Detalle de las reglas en `docs/adr/0007-estructura-de-la-organizacion.md`.

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

Todo se corre desde `functions/` (no hay `package.json` en la raíz):

```bash
npm run build              # typecheck + bundle esbuild
npm run lint
npm run typecheck
npm run test:unit          # sin emulador
npm run test:rules         # emuladores Firestore + Storage
npm run test:integration   # compila y levanta Auth + Firestore + Functions
npm run seed:emulator      # datos de prueba (dentro de emulators:exec o start)
SEED_PASSWORD=... npm run seed:dev
npm run tenant:create -- --target dev --tenant-id <id> --name <nombre> --owner-email <correo>
SEED_PASSWORD=... FIREBASE_API_KEY=... npm run smoke:dev   # callables desplegadas
npm run smoke:emulator     # verifica el propio smoke test en local
```

`test:rules` y `test:integration` arrancan y apagan los emuladores solos
(`firebase emulators:exec`) con proyectos `demo-*`: nunca tocan `dev`.

## Empaquetado

Cloud Functions solo sube esta carpeta, así que `build.mjs` empaqueta con
esbuild a `lib/index.js` desde `src/index.ts`: el código propio (todos los módulos)
queda dentro del bundle y los scripts y tests no, porque `index.ts` no los alcanza.
Las `dependencies` (`firebase-admin`, `firebase-functions`, `zod`) quedan externas
y Cloud Build las instala desde `package-lock.json`. Detalle en
`docs/adr/0008-estructura-modular-en-functions.md`.

> Cualquier paquete nuevo que deba existir en producción va en `dependencies`;
> si va en `devDependencies`, esbuild lo incluirá en el bundle.

## Diferencias entre el emulador y la nube

El emulador no replica el 100 % de producción. Caso real del paso 15: en Cloud Functions el
runtime ya crea apps de Admin con otro nombre, así que `getApps().length === 0` no sirve para
decidir si inicializar la app por defecto (daba `app/no-app` y un 500 solo en `dev`).
`shared/infrastructure/admin.ts` busca la app `[DEFAULT]` por nombre y
`shared/infrastructure/admin.integration.test.ts` lo cubre. Por eso el humo en `dev` (`npm run smoke:dev`) es parte de la verificación.

## Seed

`src/scripts/seed.ts` crea `tenant-a` con un usuario por rol y
`tenant-b` con un `owner`, de forma idempotente. El destino es obligatorio
(`--target emulator|dev`), `prod` no existe como opción y `dev` exige
`SEED_PASSWORD`. Para `dev` hacen falta credenciales de aplicación
(`gcloud auth application-default login` o `GOOGLE_APPLICATION_CREDENTIALS`).

Desde la spec 02 el seed también siembra estructura con ids fijos: en `tenant-a`
2 sedes (Norte y Sur), 2 categorías (Sub-10 y Sub-12) y 3 grupos; en `tenant-b`
1 sede. El `scope` del coordinador seed apunta a la sede Norte y el del profesor
seed al grupo "Sub-10 Norte". Sigue siendo idempotente y restaura lo que se
desvió (por ejemplo, una sede seed cerrada).

## Alta de una organización

`src/scripts/create-tenant.ts` crea el tenant, el usuario dueño en Auth (o reutiliza
el existente) y su membresía `owner`, e imprime un **enlace de restablecimiento
de contraseña**: quien lo abre fija la clave del dueño, así que se envía por un
canal privado.

```bash
# contra el emulador (dentro de emulators:exec o start)
npm run tenant:create -- --target emulator --tenant-id escuela-x \
  --name "Escuela X" --owner-email dueno@escuela-x.co

# contra dev (credenciales de aplicación, como el seed)
npm run tenant:create -- --target dev --tenant-id escuela-x \
  --name "Escuela X" --owner-email dueno@escuela-x.co
```

Si el tenant ya existe falla sin cambiar nada. `--target` es obligatorio, `prod`
no existe y `dev` se rechaza si hay variables de emulador. El `--tenant-id` admite
minúsculas, dígitos y guiones (3–40). Detalle en `docs/adr/0007-estructura-de-la-organizacion.md`.
