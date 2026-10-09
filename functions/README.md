# `functions`

Cloud Functions (2.ª generación, Node 24, TypeScript). Es el único paquete npm del
repo y contiene todo el código del backend, organizado por módulo (ADR 0008):
dominio, casos de uso, adaptadores de Firestore y una API HTTP con Express por
módulo (ADR 0009). Región fija `us-central1` (ADR 0003).

## Estructura

```
src/
├── index.ts                      # setGlobalOptions + exporta las 5 APIs
├── shared/                       # domain (DomainError, Clock) · application (UnitOfWork)
│   └── infrastructure/           # admin, unit of work, clock
│       └── http/                 # create-api, authenticate, error-handler, parse, device
├── audit/ membership/ tenant/ structure/ player/ document/
│   ├── domain/                   # entidades y reglas puras
│   ├── application/              # casos de uso, puertos y testing/ (dobles en memoria)
│   └── infrastructure/
│       ├── firestore/            # adaptadores de los puertos
│       ├── firebase/             # adaptadores de sistemas fuera de Firestore (Auth)
│       ├── storage/              # adaptadores de Cloud Storage (solo document)
│       └── http/                 # <módulo>-api.ts (onRequest) · router.ts
│           └── routes/<nombre>/  # schema.ts (zod, el contrato) + handler.ts
└── scripts/                      # seed, smoke-dev, create-tenant (no viajan al despliegue)
test/rules/                       # reglas de Firestore/Storage (emulador)
```

`audit` no tiene API propia: solo ofrece su puerto a los demás módulos.

Los tests viven en `test/` y espejan `src/` (ADR 0012): `test/unit/**/*.test.ts`,
`test/integration/**/*.integration.test.ts` (emulador) y `test/rules/`. `domain` y `application` no importan Firebase,
`zod`, `express` ni `infrastructure`: lo hace cumplir `.eslintrc.js` y lo prueba
`test/unit/shared/infrastructure/lint-boundaries.test.ts`. Para sumar un caso de uso, ver
`docs/guias/agregar-caso-de-uso.md`.

## APIs y rutas

Cinco Cloud Functions `onRequest`, una por módulo, cada una con una app Express
adentro. Una ruta nueva se agrega al `router.ts` del módulo, no como function nueva.
La URL base de una API es `https://us-central1-<proyecto>.cloudfunctions.net/<api>`
(en el emulador, `http://127.0.0.1:5001/<proyecto>/us-central1/<api>`).

| API | Método y ruta | Quién | Qué hace |
| --- | --- | --- | --- |
| `membershipApi` | `GET /me/memberships` | cualquier usuario con sesión | Lista las membresías activas propias con el nombre del tenant |
| `membershipApi` | `PATCH /tenants/:tenantId/memberships/:uid/role` | `owner` activo del tenant | Cambia el rol de otra membresía y registra la bitácora en la misma transacción. `scope` opcional: obligatorio hacia `coordinator` (sedes) y `teacher` (grupos); hacia `owner` y `accountant` el alcance queda vacío |
| `membershipApi` | `POST /tenants/:tenantId/memberships` | `owner` activo del tenant | Invita a un `accountant`, `coordinator` o `teacher` (`201`). Crea o reutiliza la cuenta de Auth y devuelve `passwordResetLink` solo si la cuenta es nueva o nunca inició sesión. Persona que ya es miembro: `409` |
| `membershipApi` | `GET /tenants/:tenantId/memberships` | `owner`, `accountant`, `coordinator` | Miembros con correo, rol, estado y alcance. El coordinador solo ve a los de sus sedes; profesor y familia reciben `403` |
| `membershipApi` | `PATCH /tenants/:tenantId/memberships/:uid/status` | `owner` activo del tenant | Activa o desactiva una membresía sin borrar nada; corta el acceso en la siguiente llamada. No desactiva al último dueño; al reactivar revalida el alcance |
| `membershipApi` | `PUT /tenants/:tenantId/memberships/:uid/scope` | `owner` activo del tenant | Reemplaza el alcance (sedes de un coordinador, grupos de un profesor), validado contra la estructura activa |
| `tenantApi` | `PUT /tenants/:tenantId/profile` | `owner` activo del tenant | Edita la ficha de la organización (nombre, registro IDRD, contacto) |
| `structureApi` | `POST /tenants/:tenantId/venues` · `PUT …/venues/:venueId` | `owner` activo del tenant | Crea (201) o edita una sede |
| `structureApi` | `PATCH /tenants/:tenantId/venues/:venueId/status` | `owner` activo del tenant | Cierra o reabre una sede. Cerrar con grupos activos se rechaza |
| `structureApi` | `POST`, `PUT …/:categoryId` y `PATCH …/:categoryId/status` bajo `/categories` | `owner` activo del tenant | Igual, para categorías (`birthYears` puede ir vacío) |
| `structureApi` | `POST`, `PUT …/:groupId` y `PATCH …/:groupId/status` bajo `/groups` | `owner` activo del tenant | Igual, para grupos. Sede y categoría deben estar activas; `venueId` solo se envía al crear y la sede no cambia |
| `structureApi` | `GET /tenants/:tenantId/structure?includeClosed=true` | `owner`, `accountant`, `coordinator`, `teacher` | Árbol de sedes, categorías y grupos filtrado por rol y alcance. `includeClosed` incluye lo cerrado |
| `playerApi` | `POST /tenants/:tenantId/players` | personal (`owner`, `accountant`, `coordinator` en sus sedes) | Inscribe un jugador `preinscrito` en un grupo (la sede y la categoría se copian) y vincula o crea sus acudientes en una transacción (`201`). Documento repetido: `409` con el `playerId`; mismo nombre y fecha: `409` con candidatos, salvo `confirmDuplicate` |
| `playerApi` | `GET /tenants/:tenantId/players` | personal y `teacher` (sus grupos) | Lista paginada por cursor (`limit` 50, máximo 100), ordenada por nombre. Un filtro de ubicación (`venueId`, `categoryId` o `groupId`) y `status`; dos filtros de ubicación son `400` |
| `playerApi` | `GET /tenants/:tenantId/players/search-index` | personal y `teacher` | Campos livianos de todos los jugadores visibles para buscar en el cliente. Sin documento ni acudientes para el profesor |
| `playerApi` | `GET /tenants/:tenantId/players/:playerId` | personal y `teacher` | La ficha; la del profesor va sin `document`, `guardians` ni `dataConsent` |
| `playerApi` | `PUT /tenants/:tenantId/players/:playerId` | personal | Edita datos personales, de emergencia y médicos |
| `playerApi` | `PUT …/players/:playerId/placement` | personal | Cambia de grupo (origen y destino en las sedes del coordinador) y deja historial |
| `playerApi` | `PATCH …/players/:playerId/status` | personal | Cambia el estado (`preinscrito`, `activo`, `pausado`, `retirado`) con la tabla de transiciones; activar exige responsable de pago y consentimiento |
| `playerApi` | `PUT …/players/:playerId/guardians` | personal | Reemplaza los acudientes del jugador (existentes por id o nuevos en línea) |
| `playerApi` | `PUT …/players/:playerId/consent` | personal | Registra el consentimiento de datos de uno de sus acudientes |
| `playerApi` | `GET …/players/:playerId/history` | personal y `teacher` | Cambios de grupo y de estado, el más reciente primero |
| `playerApi` | `GET /tenants/:tenantId/guardians?documentType&documentNumber` | personal | Busca un acudiente por documento (`{guardian: null}` si no existe o el coordinador no lo alcanza) |
| `playerApi` | `PUT /tenants/:tenantId/guardians/:guardianId` | personal | Edita al acudiente y actualiza su nombre en los jugadores vinculados |
| `documentApi` | `POST /tenants/:tenantId/players/:playerId/documents/uploads` | personal (`coordinator` en sus sedes) | Paso 1 de D-08: valida `{type, contentType, size}` (JPEG, PNG, WebP o PDF de hasta 10 MB; la foto, solo imagen y hasta 2 MB) y devuelve `{uploadId, uploadUrl, uploadMethod, uploadHeaders, expiresAt}` (`201`, 15 minutos). El cliente sube con ese método y **todas** esas cabeceras |
| `documentApi` | `POST …/players/:playerId/documents` | personal | Paso 3: confirma `{type, uploadId}` leyendo tipo y tamaño del objeto guardado, o registra una póliza sin archivo con `{type: "policy", policy}` (`201`). Confirmar dos veces el mismo `uploadId` devuelve el mismo documento; subir otro del mismo tipo deja el anterior en `superseded` |
| `documentApi` | `GET …/players/:playerId/documents?history=true` | personal y `teacher` (solo `photo` y `policy` de sus grupos) | Documentos vigentes (con `history=true`, también las versiones reemplazadas) y `policyStatus` (`valid`, `expiring`, `expired` o `missing`) |
| `documentApi` | `GET …/players/:playerId/documents/:documentId/download-url` | personal y `teacher` (solo `photo` y `policy`) | URL firmada de descarga de 5 minutos |
| `documentApi` | `GET /tenants/:tenantId/categories/:categoryId/policies` | personal (`coordinator`, solo sus sedes) | Jugadores de la categoría con su póliza y estado, incluidos los que no tienen (`missing`), ordenados por grupo y nombre |

Cada escritura deja exactamente una entrada de bitácora en la misma transacción.
Detalle de las reglas en `docs/adr/0007-estructura-de-la-organizacion.md` (estructura)
`docs/adr/0010-usuarios-invitacion-y-alcance.md` (usuarios y alcance) y
`docs/adr/0011-jugadores-y-acudientes.md` (jugadores, acudientes, cursor e índices) y
`docs/adr/0013-documentos-y-polizas.md` (documentos, URLs firmadas y estado de la póliza). La
invitación no envía correo: el dueño comparte el enlace de restablecimiento.

El contrato de cada ruta vive en el `schema.ts` junto a su handler: el `tenantId`
y el id de la entidad viajan en la ruta, el actor sale del token y los cuerpos se
validan con zod `.strict()`. El back es la fuente de verdad; el front mantiene su
propia copia en su adaptador de datos (D-01). Un cambio incompatible conserva la
ruta anterior (o publica la nueva bajo otra versión) hasta que el front publique la suya.

## Reglas que cumple toda ruta

1. `create-api` aplica `authenticate` antes que nada: `Authorization: Bearer <idToken>`
   se verifica con `verifyIdToken` y el `uid` queda en `res.locals.uid`, nunca
   viene del cuerpo. Sin token o con token inválido: `401`.
2. El handler lee el `uid` con `requireUid(res.locals.uid)`.
3. El cuerpo (o la consulta) se valida con `parseInput` y el esquema zod de la ruta;
   si falla, `400` con solo los nombres de los campos, nunca sus valores.
4. `authorizeTenantMember(db, uid, tenantId)` lee `memberships/{uid}_{tenantId}`
   en **cada petición** (D-06). Sin membresía activa: `403`.
5. Los errores de negocio salen como `DomainError` y el manejador de errores los
   traduce; los inesperados se ocultan como `500` con `Internal error`.

| Error | Estado | Cuerpo |
| --- | --- | --- |
| Sin token o token inválido | `401` | `{ error: { code: "unauthenticated", message } }` |
| `invalid_argument` (y entrada que no cumple el zod) | `400` | igual, con `code: "invalid_argument"` |
| `permission_denied` | `403` | igual |
| `not_found` y ruta desconocida | `404` | igual |
| `failed_precondition` | `409` | igual |
| Cualquier otro | `500` | `code: "internal"`, `message: "Internal error"` |

Tabla completa en el ADR 0009. Cada API se publica con `cors: true`, que acepta
cualquier origen mientras solo exista `dev`; antes de crear `prod` hay que pasar a
una lista de orígenes por ambiente.

> **Cuerpo con JSON inválido:** el runtime de Cloud Functions interpreta el cuerpo
> antes de que corra la app Express. Un cuerpo que no sea un objeto JSON válido
> (`{`, `null`) recibe un `400` propio del runtime, en HTML y sin el sobre
> `{ error }`, y se resuelve antes de la autenticación. Los cuerpos que sí son JSON
> pero no cumplen el esquema salen con el sobre normal.

## Comandos

Todo se corre desde `functions/` (no hay `package.json` en la raíz):

```bash
npm run build              # typecheck + bundle esbuild
npm run lint
npm run format             # Prettier: formatea los .ts y .js
npm run format:check       # lo mismo sin escribir; lo corre el CI
npm run typecheck
npm run test:unit          # sin emulador
npm run test:rules         # emuladores Firestore + Storage
npm run test:integration   # compila y levanta Auth + Firestore + Functions + Storage
npm run seed:emulator      # datos de prueba (dentro de emulators:exec o start)
STORAGE_BUCKET=<bucket> SEED_PASSWORD=... npm run seed:dev   # el bucket es para los archivos del seed
npm run tenant:create -- --target dev --tenant-id <id> --name <nombre> --owner-email <correo>
STORAGE_BUCKET=<bucket> SEED_PASSWORD=... FIREBASE_API_KEY=... npm run smoke:dev   # APIs desplegadas; el bucket es opcional (limpieza)
npm run smoke:emulator     # verifica el propio smoke test en local
```

`test:rules` y `test:integration` arrancan y apagan los emuladores solos
(`firebase emulators:exec`) con proyectos `demo-*`: nunca tocan `dev`. Los tests de
integración de las rutas llaman a la API por HTTP con el helper `callApi`
(`src/shared/infrastructure/testing/emulator-helpers.ts`).

El formato lo gobierna Prettier (`.prettierrc.json`) y ESLint solo revisa lo que
no es formato (`eslint-config-prettier` va al final de `extends`). Los saltos de
línea son LF en cualquier sistema: `.gitattributes` (`eol=lf`) y `.editorconfig`
lo fijan aunque `core.autocrlf=true`. Para que `git blame` ignore el commit de
formato: `git config blame.ignoreRevsFile .git-blame-ignore-revs`. Los
despliegues desde la máquina local pueden fallar por la red: ver
`docs/guias/despliegue-con-red-inestable.md`.

## Empaquetado

Cloud Functions solo sube esta carpeta, así que `build.mjs` empaqueta con
esbuild a `lib/index.js` desde `src/index.ts`: el código propio (todos los módulos)
queda dentro del bundle y los scripts y tests no, porque `index.ts` no los alcanza.
Las `dependencies` (`express`, `firebase-admin`, `firebase-functions`, `zod`) quedan
externas y Cloud Build las instala desde `package-lock.json`. Detalle en
`docs/adr/0008-estructura-modular-en-functions.md`.

> Cualquier paquete nuevo que deba existir en producción va en `dependencies`;
> si va en `devDependencies`, esbuild lo incluirá en el bundle. Los tipos
> (`@types/express`) sí van en `devDependencies`.

## Diferencias entre el emulador y la nube

El emulador no replica el 100 % de producción. Caso real del paso 15: en Cloud Functions el
runtime ya crea apps de Admin con otro nombre, así que `getApps().length === 0` no sirve para
decidir si inicializar la app por defecto (daba `app/no-app` y un 500 solo en `dev`).
`shared/infrastructure/admin.ts` busca la app `[DEFAULT]` por nombre y
`test/integration/shared/infrastructure/admin.integration.test.ts` lo cubre. Por eso el humo en `dev` (`npm run smoke:dev`) es parte de la verificación.

Lo mismo pasa con los documentos (ADR 0013): el emulador de Storage **no firma URLs**, así que
con `FUNCTIONS_EMULATOR` se usa `EmulatorFileStorage`, que apunta a la API REST del emulador. La
firma real, el permiso `signBlob` de la cuenta de servicio, los índices compuestos de `documents`
y la regla de ciclo de vida de `uploads/` (`storage.lifecycle.json`, que se aplica con `gcloud`)
solo se prueban en `dev`. Cómo configurarlos: `docs/guias/documentos-y-urls-firmadas.md`.

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

Desde la spec 07 también siembra 7 documentos ficticios de `tenant-a` y los archivos
diminutos de los que tienen uno (un PDF y un PNG de 1×1). Las pólizas quedan en cada
estado (vigente, por vencer, vencida con una versión anterior y sin archivo, y jugadores
sin póliza); sus fechas son desplazamientos desde el día en que corre el seed, así que los
estados se mantienen al repetirlo. Necesita el bucket: en el emulador lo deduce, en `dev`
exige `STORAGE_BUCKET`.

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
