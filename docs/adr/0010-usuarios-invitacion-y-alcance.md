# ADR 0010 — Usuarios: invitación sin correo, alcance por rol y activación

- **Estado:** Aceptada. Implementada en la spec 05; falta `smoke:dev` en `dev` y el CI en un PR real (ver "Verificación")
- **Fecha:** 2026-10-04
- **Spec:** `specs/05-usuarios-y-alcance.md` · **Plan:** D-05, D-06 · **Producto:** §7.2, C21
- **Amplía a:** ADR 0002 (autorización por membresía) y ADR 0004 (cambio de rol)

## Resumen

El dueño de una organización puede **invitar** a un auxiliar, un coordinador o un
profesor, **asignarles sedes o grupos** y **activarlos o desactivarlos**, todo con
cuatro rutas nuevas de `membershipApi` y un cambio aditivo a `changeMembershipRole`.
La invitación no envía correo: la ruta devuelve un enlace de restablecimiento de
contraseña que el dueño comparte por su cuenta.

## Contexto

La spec 01 dejó membresías, roles y el cambio de rol, pero las personas solo
entraban por el seed y por `tenant:create`. Los módulos de la Fase 1 (jugadores,
documentos, pólizas) filtran por el alcance de quien consulta (coordinador por
sede, profesor por grupo), así que el modelo y la validación del alcance se cierran
antes, para no reabrirlos después. El correo (Resend, Q11) necesita cuenta y dominio
que todavía no existen.

## Decisiones

| Tema | Decisión |
| --- | --- |
| Quién | Solo el dueño invita, cambia alcance y activa o desactiva (matriz de §6). Auxiliar y coordinador solo ven |
| Roles invitables | `accountant`, `coordinator` y `teacher`. Acudiente y jugador adulto esperan a que existan los jugadores (su alcance son `playerIds`) |
| Invitación | Sin correo. Devuelve `passwordResetLink`, que el dueño comparte. Se reemplaza por correo en la Fase 2 |
| Cuenta existente | Si el correo ya existe en Auth se reutiliza el `uid` y se agrega la membresía (un usuario en varias organizaciones). Costo aceptado: el dueño puede inferir que el correo ya tiene cuenta |
| Cuándo hay enlace | Solo si la cuenta se creó en la llamada o nunca ha iniciado sesión. Una cuenta con sesiones previas entra con sus credenciales |
| Cómo se sabe que inició sesión | `metadata.lastRefreshTime` de Auth, no `lastSignInTime`: el Admin SDK rellena `lastSignInTime` con la fecha de creación cuando nunca hubo ingreso, así que siempre parecería "ya inició sesión". Probado en el emulador; falta confirmarlo en `dev` real |
| Invitar a quien ya es miembro | `409`, esté activo o inactivo. Para volver a activarlo se usa la ruta de `status` |
| Auth no es transaccional | El caso de uso va en tres fases: (1) transacción de solo lectura que valida actor, rol, forma del alcance y referencias; (2) buscar o crear la cuenta y generar el enlace, fuera de toda transacción; (3) transacción que repite las validaciones, comprueba que no haya membresía y escribe membresía y bitácora. Una invitación rechazada no crea cuenta. Si falla la fase 3 queda una cuenta sin membresía (no da acceso a nada) que la reinvitación reutiliza y a la que vuelve a dar enlace |
| Desactivar | Se desactiva la **membresía**, no la cuenta de Auth: la persona puede tener otras organizaciones. El acceso se corta en la siguiente llamada (D-06), sin revocar tokens. No se borra nada |
| Último dueño | No se puede desactivar al último dueño activo (`409`), con la misma regla de `countActiveByRole` del cambio de rol |
| Gancho de C21 | Puerto `MembershipDeactivationGuard`, que se consulta **antes** de la regla del último dueño. El adaptador de la Fase 1 siempre permite; la Fase 2 enchufa el que verifica caja abierta sin tocar el caso de uso |
| Reactivar | Revalida el alcance guardado contra la estructura actual: si una sede o un grupo ya no está activo, `409` |
| Bitácora | `membership.invited`, `membership.status_changed` y `membership.scope_changed`, en la misma transacción que el cambio. `membership.role_changed` ahora guarda también `scope` en `before` y `after`. El correo no se guarda en la bitácora: basta el `uid` |

## Alcance por rol

Regla pura en `membership/domain/scope.ts` (`resolveScopeForRole`):

| Rol | `venueIds` | `groupIds` | `playerIds` |
| --- | --- | --- | --- |
| `owner`, `accountant` | vacío | vacío | vacío |
| `coordinator` | 1 o más | vacío | vacío |
| `teacher` | vacío | 1 o más | vacío |
| `guardian`, `adultPlayer` | no se valida aquí | | |

La forma incorrecta (un coordinador sin sedes, un profesor con sedes, un auxiliar con
alcance, un id en blanco) es `invalid_argument` (`400`). Se quitan los duplicados
conservando el primero.

La existencia se comprueba en el caso de uso, dentro de la transacción
(`scope-references.ts`), porque depende de la estructura de la spec 02:

| Caso | Error |
| --- | --- |
| Sede o grupo que no existe, o de otra organización | `invalid_argument` (`400`). Los repositorios se consultan por organización, así que un id ajeno es indistinguible de uno inexistente |
| Sede o grupo cerrado | `failed_precondition` (`409`) |

`SetMembershipScope` (la ruta `PUT …/scope`) no gestiona el alcance de `guardian` ni
`adultPlayer`: está hecho de `playerIds`, y reemplazarlo los borraría.

## Cambio de rol con alcance

`changeMembershipRole` acepta un `scope` opcional y el rol y el alcance cambian
juntos, para que no exista un coordinador sin sede ni un auxiliar con sedes:

- hacia `coordinator` o `teacher` el `scope` es obligatorio (`400` si falta o no encaja);
- hacia `owner` o `accountant` el alcance queda vacío, y un `scope` con sedes o grupos es `400`;
- hacia `guardian` o `adultPlayer` se conservan sus `playerIds`, y un `scope` con sedes o grupos es `400`.

El cambio es aditivo en el contrato (`scope` es opcional y el front aún no llama esta
ruta), **pero cambia un comportamiento de la spec 01**: antes, pasar a `accountant`
conservaba el alcance anterior. Dos tests de la spec 01 se actualizaron por eso (el
de "conserva el alcance" y el de la bitácora, que ahora incluye `scope`) y uno de
integración HTTP.

## Rutas

El `tenantId` va en la ruta, el actor sale del token y los cuerpos usan zod `.strict()`
(ADR 0009).

| Método y ruta | Quién | Respuesta |
| --- | --- | --- |
| `POST /tenants/:tenantId/memberships` | dueño | `201 {uid, membershipId, role, passwordResetLink?}` |
| `GET /tenants/:tenantId/memberships` | dueño, auxiliar, coordinador | `200 {memberships: {uid, email, role, status, scope}[]}` |
| `PATCH /tenants/:tenantId/memberships/:uid/status` | dueño | `200 {membershipId, status}` |
| `PUT /tenants/:tenantId/memberships/:uid/scope` | dueño | `200 {membershipId, scope}` |
| `PATCH /tenants/:tenantId/memberships/:uid/role` (existente) | dueño | `200 {membershipId, role}` |

Visibilidad de `GET` (matriz de §6): el dueño y el auxiliar ven a todos; el coordinador
ve a los coordinadores que comparten alguna de sus sedes y a los profesores con algún
grupo en sus sedes, y no ve dueños, auxiliares ni acudientes; el profesor y la familia
reciben `403`. Un miembro sin cuenta de Auth se devuelve con `email: ""` en vez de
ocultarlo.

## Herramientas de formato (misma spec)

Antes de la funcionalidad se arregló el formato, porque `npm run lint` daba 3707
errores `linebreak-style` en Windows (índice en LF, árbol de trabajo en CRLF por
`core.autocrlf=true`):

- `.gitattributes` (`* text=auto eol=lf`) y `.editorconfig`: ataca la causa, no desactiva la regla.
- Prettier 3 con `eslint-config-prettier` (al final de `extends`), sin `eslint-plugin-prettier`: Prettier formatea y ESLint solo revisa lo que no es formato. Se quitaron `quotes`, `indent` y `max-len`; la base de Google y las fronteras de capas se conservan.
- Un solo commit de formato mecánico, registrado en `.git-blame-ignore-revs` (cada clon activa `git config blame.ignoreRevsFile .git-blame-ignore-revs`).
- `format:check` corre en el CI. Sin hooks de pre-commit por ahora.

## Riesgos y consecuencias

| Riesgo | Mitigación |
| --- | --- |
| El enlace de restablecimiento viaja por canales no controlados (WhatsApp) | Es de un solo uso y vence; se reemplaza por correo en la Fase 2 |
| Una sede o grupo se cierra mientras un miembro lo tiene en su alcance | Fuera de esta spec: se valida al invitar, cambiar alcance y reactivar. La spec que haga cumplir el alcance en jugadores debe tratar una sede cerrada como sin acceso; la regla de "no cerrar con miembros asignados" se decide en un cambio a la spec 02 |
| Cuenta de Auth huérfana si falla la fase 3 | La reinvitación la reutiliza y devuelve el enlace; una cuenta sin membresía no accede a nada |
| `lastRefreshTime` se comporta distinto en Auth real | Lo cubre `smoke:dev` ("una cuenta que ya inició sesión se reutiliza, sin enlace"); si falla, se ajusta el adaptador sin tocar el caso de uso |
| El adaptador por defecto de C21 vive en `application/testing/` | La spec lo ubicó ahí; el handler lo importa desde esa carpeta. Se puede mover a `application/` cuando la Fase 2 traiga el adaptador real |
| El dueño se desactiva a sí mismo o al último dueño | Regla del último dueño activo, con test (`409`) |

## Verificación

- `test:unit`, `test:integration` y `smoke:emulator` pasan en local (los casos nuevos están en cada suite).
- Pendiente: `smoke:dev` tras desplegar a `escuelas-deportivas-dev` (las functions de la spec 04 siguen sin desplegarse en `dev`) y el CI en un PR real hacia `dev`.
