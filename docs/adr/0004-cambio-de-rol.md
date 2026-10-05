# ADR 0004 — Reglas del cambio de rol

- **Estado:** Aceptada
- **Fecha:** 2026-10-03
- **Spec:** `specs/01-fundaciones-backend.md`

## Contexto

La spec 01 incluye un único cambio de negocio, el cambio de rol de una
membresía, porque la puerta de salida de la Fase 0 exige probar de punta a punta
autorización, transacción y bitácora.

## Decisión

El caso de uso `ChangeMembershipRole` aplica estas reglas:

1. **Solo un `owner` activo del mismo tenant** cambia roles. Sale de la matriz de
   permisos "Usuarios y roles" (editar/administrar solo el dueño; el auxiliar
   solo ve).
2. El objetivo debe **existir en ese tenant**; si no, `not-found`. Un objetivo
   que solo existe en otro tenant tampoco se ve.
3. El rol nuevo debe **diferir** del actual (`failed-precondition`).
4. **Siempre queda al menos un `owner` activo** (`failed-precondition`). Esta
   invariante no viene del plan: evita dejar un tenant sin administrador. Un
   `owner` inactivo no cuenta como respaldo.
5. ~~El cambio conserva el `scope`.~~ **Reemplazada por la spec 05 (ADR 0010):**
   rol y alcance cambian juntos. Hacia `coordinator` o `teacher` llega un
   `scope` obligatorio; hacia `owner` o `accountant` queda vacío; hacia
   `guardian` o `adultPlayer` se conservan sus `playerIds`. Cambiar solo el
   alcance es la ruta `PUT …/scope`.
6. La entrada de bitácora (`before`/`after`, actor, `reason`, `device`, hora del
   servidor) se escribe **en la misma transacción**: si falla la bitácora, el rol
   no cambia. Desde la spec 05, `before` y `after` llevan también el `scope`.

## Interpretaciones donde la spec calla

- "Rol sin cambios" responde `failed-precondition` (también era defendible
  `invalid-argument`).
- Un `owner` **inactivo** puede cambiar de rol sin activar la invariante, porque
  no cuenta como `owner` activo.
- `reason` no tiene longitud máxima; conviene acotarla en una spec futura.

## Consecuencias

- Un único `owner` no puede degradarse a sí mismo: primero debe promover a otro.
- Los tests de dominio cubren cada regla con un caso positivo y uno negativo, y
  los de integración repiten los críticos contra Firestore real (emulador).
