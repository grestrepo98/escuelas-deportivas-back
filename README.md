# Escuelas Deportivas — Backend

Backend de una plataforma multi-organización (multi-tenant) para escuelas deportivas.
Piloto: Argentinos Juniors, 4 sedes y cerca de 200 jugadores. Cada organización
vive aislada bajo `tenants/{tenantId}/...`, con un único backend compartido.

Este es el repo del **backend**. El frontend está en `../escuelas-front` (repo
aparte, con su propio historial y despliegue).

## Stack

- Cloud Functions 2.ª generación (Node 24, TypeScript 6)
- Firestore, Firebase Auth y Cloud Storage (reglas deny-all: el cliente nunca los toca)
- Express dentro de cada function, validación con zod
- Vitest + Firebase Emulator Suite
- ESLint, Prettier y GitHub Actions

## Cómo está organizado

Un solo paquete npm, `functions/`, dividido por módulo con arquitectura hexagonal
(ADR 0008):

```
functions/src/
├── audit/ membership/ tenant/ structure/ player/
│   ├── domain/           # entidades y reglas puras
│   ├── application/      # casos de uso y puertos (con dobles en memoria)
│   └── infrastructure/   # adaptadores de Firestore y API HTTP del módulo
├── shared/
└── scripts/              # seed, smoke test, tenant:create
```

Cada módulo expone una API HTTP (`membershipApi`, `tenantApi`, `structureApi`,
`playerApi`). Un caso de uso nuevo agrega una ruta, no una function. `domain` y
`application` no pueden importar Firebase, zod, Express ni `infrastructure`; ESLint
lo hace cumplir y un test lo prueba.

## Primeros pasos

Requisitos: Node 24 y Firebase CLI.

```bash
cd functions
npm ci
npm run build
npm run test:unit
```

## Comandos principales

Se ejecutan desde `functions/`.

| Comando | Qué hace |
| --- | --- |
| `npm run build` | Typecheck y bundle con esbuild en `lib/index.js` |
| `npm run lint` / `npm run format:check` | ESLint (con reglas de capas) y Prettier |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test:unit` | Tests unitarios, sin emulador |
| `npm run test:rules` | Reglas de Firestore y Storage bajo el emulador |
| `npm run test:integration` | Adaptadores y APIs HTTP bajo el emulador |
| `npm run serve` | Build y emulador de functions |
| `npm run seed:emulator` | Datos de ejemplo (dentro de una sesión de emulador) |
| `npm run smoke:emulator` | Prueba de humo de las APIs en local |
| `npm run tenant:create -- --target emulator --tenant-id <id> --name <n> --owner-email <e>` | Crea una organización con su dueño |

Los scripts `test:*` usan proyectos `demo-*` y nunca tocan `dev`. El detalle de
cada API y de sus rutas está en [`functions/README.md`](functions/README.md).

## Metodología

Desarrollo guiado por especificaciones y TDD estricto: se escribe primero el test
que falla. Cada cambio va con su documentación y se commitea con
[Conventional Commits](https://www.conventionalcommits.org/).

Las especificaciones están en [`specs/`](specs/) y el plan por fases en
[`specs/ROADMAP.md`](specs/ROADMAP.md): 0 Fundaciones → 1 Estructura y jugadores →
2 Dinero → 3 Campo y control. Hoy están implementadas las specs 01 a 06
(fundaciones, estructura, modularización, API HTTP por módulo, usuarios y alcance,
jugadores y acudientes).

## Entornos y despliegue

- **CI** (GitHub Actions): cada PR hacia `dev` o `main` corre formato, lint,
  typecheck, build, tests unitarios, de reglas y de integración.
- **`dev`**: refleja la rama `dev`; un push despliega al proyecto Firebase
  `escuelas-deportivas-dev` (región `us-central1`).
- **`prod`**: aún no existe; cuando exista requerirá aprobación manual.
- Este repo despliega `--only functions,firestore,storage`; el frontend solo hosting.

Los despliegues desde una máquina local fallan de forma intermitente por red.
Antes de planear un paso que borre algo en `dev`, leer
[`docs/guias/despliegue-con-red-inestable.md`](docs/guias/despliegue-con-red-inestable.md).

## Documentación

| Documento | Contenido |
| --- | --- |
| [`docs/producto.md`](docs/producto.md) | Producto, casos borde (C1–C22) y preguntas abiertas |
| [`docs/plan-tecnico.md`](docs/plan-tecnico.md) | Decisiones D-01…D-19 (solo las `Acordado` obligan) |
| [`docs/arquitectura.md`](docs/arquitectura.md) | Vista general de la arquitectura |
| [`docs/adr/`](docs/adr/) | Decisiones de arquitectura numeradas |
| [`docs/guias/agregar-caso-de-uso.md`](docs/guias/agregar-caso-de-uso.md) | Cómo sumar un caso de uso |

## Principios que no se negocian

- El cliente nunca toca Firestore ni Storage: todo pasa por las APIs HTTP.
- Nunca se confía en un `tenantId` enviado por el cliente; el rol y el alcance se
  leen de la membresía en cada llamada.
- Dinero en pesos enteros (COP), sin decimales; nada se borra (las anulaciones son
  movimientos inversos) y la bitácora es solo de creación.
- Fechas en UTC, mostradas en America/Bogota.
