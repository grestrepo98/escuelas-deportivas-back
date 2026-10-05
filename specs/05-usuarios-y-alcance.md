# SPEC 05 — Usuarios y alcance (invitar, activar/desactivar y asignar alcance)

> **Status:** Approved
> **Depends on:** SPEC 01, SPEC 02 y SPEC 04. Cubre §7.2 de `docs/producto.md` y el gancho de C21 que deja pendiente `specs/ROADMAP.md`.
> **Date:** 2026-10-04
> **Objective:** Que el dueño de una organización pueda invitar a auxiliares, coordinadores y profesores, asignarles sedes o grupos, y activarlos o desactivarlos, todo por rutas del módulo `membership`.

---

## Por qué existe esta spec

La spec 01 dejó membresías, roles y el cambio de rol, pero las personas solo entran por el seed y por `tenant:create`. La Fase 1 sigue con jugadores, documentos y pólizas, y todos filtran por el alcance de quien consulta (coordinador por sede, profesor por grupo). Esta spec cierra primero el modelo y la validación del alcance, para que esos módulos lo usen sin reabrirlo.

## Scope

**In:**

- Cuatro rutas nuevas en `membershipApi` y un cambio aditivo a `changeMembershipRole` (ver Data model).
- Invitación **sin correo**: la ruta crea (o reutiliza) la cuenta de Auth, crea la membresía y devuelve un enlace de restablecimiento de contraseña que el dueño comparte por su cuenta. No depende de Resend ni de dominio (Q11 sigue para la Fase 2).
- Roles invitables: `accountant`, `coordinator` y `teacher`. Solo el dueño invita, cambia alcance y activa o desactiva.
- Validación del alcance contra la estructura de la spec 02: un coordinador exige al menos una sede activa de la organización; un profesor, al menos un grupo activo; un auxiliar, alcance vacío.
- Cuenta existente: si el correo ya existe en Auth se reutiliza el `uid` y se agrega la membresía (un mismo usuario en varias organizaciones).
- Activar y desactivar membresías sin borrar nada. Una membresía inactiva pierde el acceso en la siguiente llamada (D-06), sin revocar tokens.
- Puerto `MembershipDeactivationGuard` con un adaptador que siempre permite (gancho de C21). La Fase 2 agrega el adaptador que verifica caja abierta.
- Listado de miembros de la organización con la visibilidad de la matriz de §6 de producto.
- Bitácora de cada escritura, en la misma transacción.
- Tests unitarios, de integración por HTTP, y ampliación de `smoke:emulator` y `smoke:dev`.
- Documentación: ADR 0010, `functions/README.md`, `arquitectura.md`, `docs/guias/agregar-caso-de-uso.md` si cambia el flujo, `specs/ROADMAP.md` y réplica de `docs/` en `../escuelas-front/docs/` y `../docs/`.

**Out of scope (for future specs):**

- Invitar acudientes y jugadores adultos: su alcance son `playerIds` y los jugadores no existen todavía (spec de jugadores y acudientes).
- Invitación por celular o SMS, y envío de correo (Fase 2, Q11).
- Roles de plataforma (super administrador y soporte, §7.19).
- Cambiar el correo o los datos personales de una persona, y el reenvío de un enlace vencido a una cuenta que ya inició sesión (la persona usa "olvidé mi contraseña" de Auth).
- Cerrar sedes o grupos que tengan miembros asignados: esa regla pertenece a un cambio de la spec 02 (ver Risks).
- Cambiar `firestore.rules`, `storage.rules` o `firestore.indexes.json`.
- Un adaptador real de C21 (necesita la caja de la Fase 2).

## Data model

Sin colecciones nuevas. `memberships/{uid}_{tenantId}` conserva su forma (`role`, `status`, `scope`, fechas). El módulo gana un puerto de identidad y un puerto de guardia.

```ts
// membership/application/identity-provider.ts (puerto; Auth no es transaccional)
interface IdentityProvider {
  findByEmail(
    email: string,
  ): Promise<{ uid: string; hasSignedIn: boolean } | null>;
  create(email: string): Promise<{ uid: string }>;
  createPasswordResetLink(email: string): Promise<string>;
  getEmails(uids: string[]): Promise<Map<string, string>>;
}

// membership/application/membership-deactivation-guard.ts (gancho de C21)
interface MembershipDeactivationGuard {
  assertCanDeactivate(membership: Membership): Promise<void>; // lanza DomainError("failed_precondition")
}

// MembershipRepository gana: listByTenant(tenantId): Promise<Membership[]>
```

Regla de alcance por rol, pura, en `membership/domain/scope.ts`:

| Rol                       | `venueIds`                                     | `groupIds` | `playerIds` |
| ------------------------- | ---------------------------------------------- | ---------- | ----------- |
| `owner`, `accountant`     | vacío                                          | vacío      | vacío       |
| `coordinator`             | 1 o más                                        | vacío      | vacío       |
| `teacher`                 | vacío                                          | 1 o más    | vacío       |
| `guardian`, `adultPlayer` | sin cambios respecto a hoy (no se valida aquí) |            |             |

La existencia y el estado activo de sedes y grupos se comprueban en el caso de uso, dentro de la transacción, con `venues` y `groups` del `UnitOfWork`.

### Rutas y contratos

El `tenantId` va en la ruta, el actor sale del token y los cuerpos usan zod `.strict()` (ADR 0009).

| Método y ruta                                                | Quién                        | Cuerpo                                                                                          | Respuesta                                                    |
| ------------------------------------------------------------ | ---------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `POST /tenants/:tenantId/memberships`                        | dueño                        | `{ email, role: "accountant" \| "coordinator" \| "teacher", scope?: { venueIds?, groupIds? } }` | `201 { uid, membershipId, role, passwordResetLink? }`        |
| `GET /tenants/:tenantId/memberships`                         | dueño, auxiliar, coordinador | —                                                                                               | `200 { memberships: { uid, email, role, status, scope }[] }` |
| `PATCH /tenants/:tenantId/memberships/:uid/status`           | dueño                        | `{ status: "active" \| "inactive", reason? }`                                                   | `200 { membershipId, status }`                               |
| `PUT /tenants/:tenantId/memberships/:uid/scope`              | dueño                        | `{ scope: { venueIds?, groupIds? } }`                                                           | `200 { membershipId, scope }`                                |
| `PATCH /tenants/:tenantId/memberships/:uid/role` (existente) | dueño                        | `{ newRole, reason?, scope? }`                                                                  | `200 { membershipId, role }`                                 |

Reglas de las rutas:

- `passwordResetLink` solo aparece cuando la cuenta se creó en esta llamada o nunca ha iniciado sesión (`hasSignedIn` falso). Una cuenta con sesiones previas entra con sus credenciales.
- Invitar a alguien que ya tiene membresía en la organización (activa o inactiva) responde `409`. Para volver a activarla se usa la ruta de `status`.
- `GET` del coordinador devuelve solo los miembros con alguna de sus sedes en `venueIds` y los profesores con algún grupo de sus sedes. El auxiliar y el dueño ven todos. El profesor recibe `403`.
- `status` a `inactive` primero consulta `MembershipDeactivationGuard` y rechaza con `409` si el último dueño activo quedaría sin dueño (se reutiliza `countActiveByRole`). A `active` revalida el alcance guardado contra la estructura actual y responde `409` si una sede o grupo ya no está activo.
- `changeMembershipRole` acepta `scope` opcional: es obligatorio si `newRole` es `coordinator` o `teacher` (si no llega, `400`); para `owner` y `accountant` el alcance se deja vacío y un `scope` no vacío responde `400`. Cambio aditivo del contrato: sin `scope`, `owner` y `accountant` siguen funcionando igual.
- Acciones de bitácora nuevas: `membership.invited`, `membership.status_changed` y `membership.scope_changed`. `membership.role_changed` ahora guarda también `scope` en `before` y `after`.

Errores: los de la tabla del ADR 0009 (`401`, `400`, `403`, `404`, `409`, `500`).

### Estructura de archivos

```
functions/src/membership/
├── domain/scope.ts (+ scope.test.ts)
├── application/
│   ├── invite-member.ts, set-membership-status.ts, set-membership-scope.ts,
│   │   list-memberships.ts (+ un .test.ts por caso de uso)
│   ├── identity-provider.ts, membership-deactivation-guard.ts, scope-references.ts
│   ├── change-membership-role.ts (modificado)
│   └── testing/ in-memory-identity-provider.ts, allow-all-deactivation-guard.ts
└── infrastructure/
    ├── firebase/firebase-identity-provider.ts
    ├── firestore/ (listByTenant en el repositorio)
    └── http/routes/{inviteMember,listMemberships,setMembershipStatus,setMembershipScope}/{handler,schema}.ts
```

## Implementation plan

TDD en cada paso (test que falla primero). Un commit convencional por paso. Cada paso termina con `build`, `lint`, `typecheck` y las suites en verde.

0. **Línea base.** Anotar cuántos tests pasan en `test:unit`, `test:rules` y `test:integration`.
1. **Regla de alcance.** `domain/scope.ts` y su test: la tabla de arriba, incluidos los casos con listas mezcladas (coordinador con grupos, profesor con sedes) y duplicados.
2. **Referencias del alcance.** `application/scope-references.ts`: comprueba que cada sede y grupo exista, sea de la organización y esté activo. Tests con los fakes en memoria de la spec 02.
3. **Puertos y fakes.** `IdentityProvider`, `MembershipDeactivationGuard`, `listByTenant`, sus fakes en `application/testing/` y el adaptador que siempre permite.
4. **Invitar.** Caso de uso `InviteMember` con tests unitarios: dueño ok, otros roles `403`, cuenta nueva con enlace, cuenta existente sin enlace, cuenta nunca usada con enlace, membresía repetida `409`, alcance inválido, bitácora.
5. **Alcance, estado y rol.** `SetMembershipScope`, `SetMembershipStatus` (guardia, último dueño, reactivación con alcance caído) y la ampliación de `ChangeMembershipRole`, cada uno con sus tests unitarios.
6. **Listado.** `ListMemberships` con la visibilidad por rol y sede, con tests unitarios.
7. **Adaptadores.** `FirebaseIdentityProvider` y `listByTenant` en Firestore, con tests de integración contra el emulador (Auth + Firestore).
8. **Rutas HTTP.** Handlers, esquemas y router, con tests de integración por HTTP por ruta (ver criterios). Reutilizar `callApi`.
9. **Humo.** Ampliar `smoke-dev.ts` (invitar, listar, desactivar, comprobar `403` con el mismo token, reactivar) y confirmar `smoke:emulator`.
10. **Documentación.** ADR 0010, `functions/README.md`, `arquitectura.md`, guía, `ROADMAP.md`, y réplica de `docs/` en los otros dos lugares. Poner la spec en `Implemented`.

## Acceptance criteria

- [ ] Cada ruta nueva responde por HTTP: sin token → `401`, entrada inválida → `400` (campo faltante, valor fuera de rango, campo extra), usuario de otra organización → `403` sin cambios, y cada rol no autorizado → `403`.
- [ ] `POST …/memberships` con un correo nuevo crea la cuenta de Auth, la membresía activa y devuelve `passwordResetLink`; con un correo que ya inició sesión en otra organización reutiliza el `uid` y no devuelve enlace.
- [ ] `POST …/memberships` con un coordinador sin sedes, con un profesor sin grupos, con una sede cerrada o de otra organización, o con un auxiliar con alcance no vacío responde `400` o `409` según el caso y no crea membresía ni bitácora.
- [ ] Invitar a quien ya tiene membresía en la organización responde `409`.
- [ ] Un usuario desactivado recibe `403` con el mismo token en la siguiente llamada, en cualquier ruta, y su historial y bitácora se conservan.
- [ ] No se puede desactivar al último dueño activo (`409`), ni a un coordinador cuando el guardia de prueba rechaza; con el adaptador por defecto sí se permite.
- [ ] Reactivar una membresía cuyo alcance apunta a una sede o grupo cerrado responde `409`.
- [ ] `changeMembershipRole` a `coordinator` o `teacher` sin `scope` responde `400`; a `accountant` o `owner` deja el alcance vacío; sin `scope` y hacia `owner` o `accountant` se comporta como antes (los tests de la spec 01 siguen en verde).
- [ ] `GET …/memberships` devuelve todos los miembros al dueño y al auxiliar, solo los de sus sedes al coordinador, y `403` al profesor; incluye `email` y no expone nada de otra organización.
- [ ] Cada escritura deja su registro en `auditLog` (`membership.invited`, `membership.status_changed`, `membership.scope_changed`, `membership.role_changed` con `scope`), en la misma transacción que el cambio.
- [ ] `lint-boundaries.test.ts` sigue en verde: `domain` y `application` no importan Firebase ni `express`; el adaptador de Auth vive en `infrastructure/firebase/`.
- [ ] `firestore.rules`, `storage.rules` y `firestore.indexes.json` no cambian y los tests de rules pasan.
- [ ] `test:unit`, `test:rules` y `test:integration` pasan, con al menos la cobertura de casos de la línea base más los nuevos; `build`, `lint` y `typecheck` pasan sin errores ni advertencias.
- [ ] `smoke:emulator` pasa con los pasos nuevos; tras desplegar a `escuelas-deportivas-dev`, `smoke:dev` también.
- [ ] El CI pasa en un PR real hacia `dev`.
- [ ] `functions/README.md`, `arquitectura.md` y el ADR 0010 describen las rutas y reglas, `ROADMAP.md` registra la spec 05, y `docs/` está replicado en los otros dos lugares.

## Decisiones

- **Sí: invitación con enlace manual, sin correo.** El dueño comparte el enlace; evita depender de Resend, dominio y secretos antes de la Fase 2. _Decidido por el usuario el 2026-10-04._
- **No: enviar el correo con Resend ahora.** Adelanta Q11 sin cuenta ni dominio disponibles.
- **No: solo asignar membresía a usuarios ya registrados.** Deja sin resolver cómo entra un coordinador nuevo.
- **Sí: puerto `MembershipDeactivationGuard` con adaptador vacío.** La Fase 2 enchufa la verificación de caja de C21 sin tocar el caso de uso. _Decidido por el usuario el 2026-10-04._
- **No: dejar C21 para modificar el caso de uso después.** Se puede olvidar y la regla queda sin cumplirse.
- **Sí: invitar solo `accountant`, `coordinator` y `teacher`.** Acudiente y jugador adulto necesitan jugadores para validar su alcance. _Decidido por el usuario el 2026-10-04._
- **No: aceptar `playerIds` sin validarlos.** Crearía alcances que nada comprueba.
- **Sí: reutilizar la cuenta de Auth si el correo ya existe y agregar la membresía.** Cumple "un mismo usuario en varias organizaciones" de §7.2. Costo aceptado: el dueño puede inferir que el correo ya tiene cuenta. _Decidido por el usuario el 2026-10-04._
- **No: responder `409` siempre ante un correo existente.** Impediría que una persona trabaje en dos escuelas por invitación.
- **Sí: `changeMembershipRole` acepta `scope` y rol y alcance cambian juntos.** Evita un coordinador sin sede. Más una ruta aparte para cambiar solo el alcance. _Decidido por el usuario el 2026-10-04._
- **No: dejar `changeMembershipRole` sin tocar.** Permitiría estados incoherentes.
- **Sí: devolver el enlace también a una cuenta que nunca inició sesión.** Cubre el caso de una cuenta creada cuya transacción posterior falló, y la reinvitación a quien no llegó a entrar.
- **Sí: crear la cuenta de Auth antes de la transacción de Firestore.** Auth no participa en transacciones; si la transacción falla, queda una cuenta sin membresía que la reinvitación reutiliza.
- **Sí: desactivar la membresía, no la cuenta de Auth.** La persona puede tener otras organizaciones; el acceso se corta por la membresía (D-06).
- **Sí: solo el dueño invita, cambia alcance y activa o desactiva.** Es lo que dice la matriz de §6 (auxiliar y coordinador solo ven).

## Risks

| Riesgo                                                                    | Mitigación                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Una sede o grupo se cierra mientras un miembro lo tiene en su alcance     | Queda fuera de esta spec; se valida solo al invitar, cambiar alcance y reactivar. La spec que haga cumplir el alcance en jugadores debe tratar una sede cerrada como sin acceso, y la regla de "no cerrar con miembros asignados" se decide en un cambio a la spec 02 |
| Cuenta de Auth huérfana si falla la transacción tras crearla              | La reinvitación la reutiliza y devuelve el enlace porque `hasSignedIn` es falso; una cuenta sin membresía no accede a nada                                                                                                                                            |
| El enlace de restablecimiento viaja por canales no controlados (WhatsApp) | El enlace es de un solo uso y vence; se documenta en el ADR 0010 y se reemplaza por correo en la Fase 2                                                                                                                                                               |
| `GET` revela a un coordinador el correo de miembros de su sede            | Aceptado: la matriz de §6 le da "ver" usuarios de su sede; no ve otras sedes                                                                                                                                                                                          |
| El dueño se desactiva a sí mismo o al último dueño                        | Regla del último dueño activo con test (`409`)                                                                                                                                                                                                                        |
| Cambiar el contrato de `changeMembershipRole` rompe al front              | El cambio es aditivo (`scope` opcional) y el front aún no llama esa ruta                                                                                                                                                                                              |

## What is **not** in this spec

- Invitar acudientes o jugadores adultos, ni sus `playerIds`.
- Envío de correo o SMS para la invitación.
- Roles de plataforma y administración de organizaciones.
- Un adaptador real de C21 (caja abierta).
- Reglas para cerrar sedes o grupos con miembros asignados.
- Cambios en `firestore.rules`, `storage.rules` o `firestore.indexes.json`.
