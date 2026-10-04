# ADR 0007 — Estructura de la organización

- **Estado:** Aceptada
- **Fecha:** 2026-10-04
- **Spec:** `specs/02-estructura-organizacion.md` · **Plan:** módulo 7.1

## Resumen

El dueño gestiona la ficha de su organización, sedes, categorías y grupos con
**7 callables de escritura** auditadas y **1 de lectura** (`getStructure`). Nada
se borra: se cierra y se reabre. La alta de una organización es un script.

## Contexto

La Fase 1 trae 7 módulos y no cabe en una spec. Jugadores, usuarios con alcance,
documentos e importación cuelgan de sedes, categorías y grupos, así que la
estructura va primero. Es la primera escritura de negocio distinta del cambio de
rol (ADR 0004) y fija el patrón que repetirán las specs siguientes: caso de uso
+ puerto + adaptador + callable + bitácora en la misma transacción.

## Decisiones

| Tema | Decisión |
| --- | --- |
| Dónde viven | `tenants/{tenantId}/venues`, `categories`, `groups`. La ficha se amplía en `tenants/{tenantId}` |
| Quién escribe | Solo un `owner` activo del tenant. Los demás roles reciben `permission-denied` |
| Callables | Dos de escritura por entidad (`save*` crea o edita, `set*Status` cierra o reabre) más `updateTenantProfile` y `getStructure` |
| Borrado | Ninguno. Cerrar cambia `status`; reabrir lo restaura. Ambos con bitácora y motivo opcional |
| Cerrar | Una sede o categoría con grupos activos **no se puede cerrar** (`failed-precondition`). Sin cascadas |
| Reabrir | Un grupo exige sede y categoría activas. Todo se revalida contra la unicidad de nombre |
| Nombres | Únicos entre **activos**, sin distinguir mayúsculas ni espacios exteriores: por tenant (sedes, categorías) y por sede (grupos). Un cerrado no retiene su nombre |
| Grupo y sede | `venueId` es inmutable. Mover un grupo es cerrarlo y crear otro |
| Quién coordina | Coordinador y profesor viven solo en `membership.scope`. Sede y grupo no guardan uids |
| Horario | Solo en grupos: `weekday` ISO 1–7 y `start`/`end` `"HH:mm"` en hora de pared de `America/Bogota` |
| Categorías | Por organización. `birthYears` opcional (vacío = categoría por nivel); sugiere, no impone |
| Lectura | Una callable de árbol; el filtro se hace en memoria sin índices compuestos |

## Visibilidad de `getStructure`

| Rol | Ve |
| --- | --- |
| `owner`, `accountant` | Todo |
| `coordinator` | Sus sedes (`scope.venueIds`), los grupos de esas sedes y **todas** las categorías |
| `teacher` | Sus grupos (`scope.groupIds`), las sedes y las categorías de esos grupos |
| `guardian`, `adultPlayer` | `permission-denied` |

Un `coordinator` o `teacher` con `scope` vacío ve **todo vacío**, categorías
incluidas. Solo para `owner` y `accountant` vacío significa "sin restricción".
Lo cerrado se descarta **antes** de aplicar la visibilidad (salvo
`includeClosed: true`), para que un profesor no vea la sede de un grupo oculto.

## Alta de organización

`npm run tenant:create -- --target emulator|dev --tenant-id … --name … --owner-email …`

- Crea el tenant, el usuario dueño en Auth (o reutiliza el existente) y su
  membresía `owner`, e **imprime un enlace de restablecimiento de contraseña**.
  Sin clave temporal ni registro previo del dueño, y sin depender del correo (Q11).
- Orden: comprobar que el tenant no existe → usuario de Auth → enlace → una sola
  transacción (tenant + membresía). Si el tenant existe, falla sin cambiar nada.
- `--target` es obligatorio, `prod` no existe, y `dev` se rechaza si hay
  variables de emulador definidas (mismas salvaguardas que el seed, ADR 0005).
- El `--tenant-id` admite solo `[a-z0-9-]` (3–40): la membresía es
  `{uid}_{tenantId}` y un guion bajo haría ambiguo el separador.

## Interpretaciones donde la spec calla

- **`venueId` distinto al editar un grupo** responde `failed-precondition`
  (el grupo ya pertenece a otra sede), no `invalid-argument`.
- **Crear un grupo sin `venueId`** responde `invalid-argument`: el contrato lo
  marca opcional porque la edición no lo necesita, así que lo valida el dominio.
- **Editar una entidad cerrada** se permite. No revalida el nombre (un cerrado
  no lo retiene); la unicidad se comprueba al reabrir.
- **Pedir el estado que ya tiene** responde `failed-precondition`, igual que el
  cambio de rol sin cambio (ADR 0004).
- **Cerrar un grupo** no mira su sede: se puede cerrar aunque la sede ya esté
  cerrada.
- **`weekday` fuera de 1–7** lo rechaza zod (el tipo es un literal) y también el
  dominio; ambos responden `invalid-argument`. `HH:mm` y `end > start` solo los
  valida el dominio.
- **El alta no escribe bitácora**: la spec la pide para las callables y no define
  una acción `tenant.created`.

## Por qué hora de pared y no UTC

Un horario de entrenamiento es una hora del calendario ("martes 17:00"), no un
instante. Guardarlo como `Timestamp` obligaría a elegir una fecha arbitraria. El
tipo `"HH:mm"` sin fecha ni zona evita confundirlo con UTC; la asistencia
(Fase 3) lo combinará con la fecha de la sesión en Bogotá.

## Consecuencias

- El dominio sumó `invalid_argument` a `DomainError`; `toHttpsError` lo traduce a
  `invalid-argument`.
- `UnitOfWork` ahora entrega `tenants`, `venues`, `categories` y `groups` ligados
  a la transacción. Las comprobaciones de unicidad y de hijos activos leen dentro
  de la misma transacción que escribe (la mitigación que pide la spec para dos
  creaciones simultáneas). **No hay un test de concurrencia** que lo demuestre.
- Los DTO de `getStructure` llevan fechas ISO 8601 en UTC y no exponen `tenantId`.
  El front copia el contrato (D-01).
- El seed siembra 2 sedes, 2 categorías y 3 grupos en `tenant-a` y 1 sede en
  `tenant-b`, y apunta el `scope` del coordinador y del profesor a ellos. Fuerza
  lo sembrado a `active`: si se cierra una sede seed en `dev`, la siguiente
  corrida la reabre.
- Fuera de esta spec: asignar personas a sedes o grupos (7.2), logo (7.5),
  calendario de temporada (C13), programas o deportes, roles de plataforma.
