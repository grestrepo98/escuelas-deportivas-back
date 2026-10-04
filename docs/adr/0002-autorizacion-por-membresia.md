# ADR 0002 — Autorización por membresía leída en cada llamada

- **Estado:** Aceptada
- **Fecha:** 2026-10-03
- **Spec:** `specs/01-fundaciones-backend.md` · **Plan:** D-05, D-06

## Contexto

Una persona puede pertenecer a varias escuelas con roles distintos. La propuesta
original llevaba la organización activa y el rol en *custom claims*. El texto de
la Fase 0 del plan aún mencionaba "membresías y claims", en contradicción con la
decisión de D-06.

## Decisión

- **Sin claims de tenant ni de rol.** Cada callable lee
  `memberships/{uid}_{tenantId}` en cada llamada y de ahí saca rol y alcance.
- El `tenantId` que envía el cliente **jamás se confía**: solo sirve para
  elegir qué membresía leer, y esa membresía debe estar activa.
- `memberships` vive **en la raíz**, no bajo `tenants/`. Es la única excepción a
  "todo bajo `tenants/`": una persona está en varios tenants y se la busca por
  `uid`. Ninguna colección de negocio vive en la raíz.
- Membresía inexistente e inactiva responden igual (`permission-denied`, mismo
  mensaje) para no revelar a quién pertenece cada tenant.

## Consecuencias

- Desactivar una membresía corta el acceso en la siguiente llamada, sin revocar
  tokens ni esperar a que un claim expire.
- Cada invocación hace al menos una lectura extra de Firestore (latencia y
  costo). Se mide en el piloto; la salida prevista en D-06 es una caché corta o
  claims.
- Los tests lo prueban con el mismo token antes y después de desactivar.
