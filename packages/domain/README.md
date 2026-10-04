# `@escuelas/domain`

Reglas de negocio puras del backend: roles, membresías, casos de uso y los
**puertos** (interfaces) que los adaptadores implementan. No se publica (D-01):
solo lo consume `functions/`.

## Regla de oro

**No importa Firebase.** Ni `firebase-admin`, ni `firebase-functions`, ni
`@google-cloud/*`. Una regla de ESLint (`no-restricted-imports` en
`.eslintrc.js`) lo hace fallar en `npm run lint`. Por eso las fechas son `Date`
(UTC) y no `Timestamp`: el adaptador convierte.

## Qué contiene

| Carpeta | Contenido |
| --- | --- |
| `src/membership/` | `Role`, `ROLES`, `Membership`, `Scope`, `membershipId`, `isActiveMembershipOf`, `requireOwner` y el caso de uso `ChangeMembershipRole` |
| `src/audit/` | `AuditEntry`: lo que el dominio quiere dejar en la bitácora (sin `at`; lo asigna el escritor) |
| `src/structure/` | `Venue`, `Category`, `Group`, `ScheduleSlot`, validadores puros (nombre, años, horario), `isNameTaken`, los casos de uso `SaveVenue`/`SetVenueStatus`, `SaveCategory`/`SetCategoryStatus`, `SaveGroup`/`SetGroupStatus` y la función pura `visibleStructure` |
| `src/tenant/` | `Tenant` y el caso de uso `UpdateTenantProfile` |
| `src/ports/` | `Clock`, `MembershipRepository`, `TenantRepository`, `StructureRepository<T>` (con los alias `VenueRepository`, `CategoryRepository`, `GroupRepository`), `AuditLogWriter`, `UnitOfWork` |
| `src/errors.ts` | `DomainError` con los códigos `permission_denied`, `not_found`, `failed_precondition`, `invalid_argument` |
| `test/fakes/` | Dobles en memoria de los puertos, incluida una `UnitOfWork` con rollback |

Todo lo público sale de `src/index.ts`.

## Comandos

Desde la raíz del repo:

```bash
npm run test:domain          # Vitest, sin emulador
npm run lint                 # incluye la regla "sin Firebase"
npm run typecheck
```

Desde esta carpeta: `npm test`, `npm run build` (genera `dist/` con tipos, que
es lo que `functions/` usa para tipar).

## Cómo se prueba

TDD estricto: primero el test, con los dobles de `test/fakes/`. Cada regla de un
caso de uso tiene al menos un caso positivo y uno negativo. Los tests de
`ChangeMembershipRole` son el modelo a copiar.

Para agregar un caso de uso, ver `docs/guias/agregar-caso-de-uso.md`.
