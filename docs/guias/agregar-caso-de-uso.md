# Cómo agregar un caso de uso (y su ruta)

Receta con TDD, de adentro hacia afuera. Usa `ChangeMembershipRole` como modelo.
Cada paso termina en verde antes de pasar al siguiente. Todo el código vive en
`functions/src/<módulo>/{domain,application,infrastructure}` (ADR 0008) y los
comandos se corren desde `functions/`.

## 0. Antes de escribir código

- La regla de negocio está en una spec aprobada (`specs/`). Si no, va primero a la spec.
- Decide a qué **módulo** pertenece (`membership`, `tenant`, `structure`…). Si es
  un módulo nuevo, crea su carpeta con las tres capas y su `<módulo>Api` (paso 4).
- Decide si necesita **dominio** (hay reglas) o es una **lectura pura** (solo
  consultar y dar forma): las lecturas pueden ser una consulta en el adaptador,
  como `GET /me/memberships`.

## 1. Application: puertos nuevos (solo si hacen falta)

1. Define la interfaz en `<módulo>/application/<puerto>.ts` con lo mínimo que el
   caso de uso necesita (no copies la API de Firestore).
2. Escribe su doble en memoria en `<módulo>/application/testing/` y **pruébalo**
   (`shared/application/testing/fakes.test.ts`). Si participa en transacciones, debe poder hacer rollback.
3. Si participa en transacciones, agrégalo a `TransactionContext`
   (`shared/application/unit-of-work.ts`, solo tipos).

## 2. Domain y application: el caso de uso

1. **Test primero** junto al código, en `<módulo>/application/<caso>.test.ts`. Por cada
   regla: un caso positivo y uno negativo. Verifica también que, al rechazar, no
   se escribió nada (ni dato ni bitácora).
2. Corre `npm run test:unit` y confirma que falla **por la razón correcta**
   (falta el módulo, no un error de tipeo).
3. Implementa en `<módulo>/application/<caso>.ts` (las entidades y reglas puras
   van en `<módulo>/domain/`):
   - Recibe sus puertos por constructor (`UnitOfWork`, `Clock`, …).
   - Hace todo dentro de `unitOfWork.run(...)`: **primero todas las lecturas,
     después las escrituras**.
   - Sin efectos fuera del contexto de la transacción (puede reintentarse).
   - Si solo el `owner` puede hacerlo, usa `requireOwner`
     (`membership/application/require-owner.ts`) como primera lectura.
   - Falla con `DomainError` (`permission_denied`, `not_found`,
     `failed_precondition`, `invalid_argument`).
   - Si cambia datos que importan, agrega una `AuditEntry` en la misma
     transacción (y amplía `AuditAction`).

`domain` y `application` no importan Firebase, `@google-cloud/*`, `zod` ni
`infrastructure`; `npm run lint` lo verifica y `lint-boundaries.test.ts` prueba la
regla.

## 3. Adaptador de Firestore (solo si hay un puerto nuevo)

1. Test de integración primero, junto al adaptador, como
   `<módulo>/infrastructure/firestore/<nombre>.integration.test.ts` (ida y
   vuelta, y atomicidad: si algo falla, no queda nada a medias).
2. Implementa en `<módulo>/infrastructure/firestore/`. Acepta una `Transaction`
   opcional y úsala cuando exista. Convierte `Date` ↔ `Timestamp` en un mapper.
3. Corre `npm run test:integration`.

Si la colección nueva es una subcolección de `tenants/{tenantId}` con la forma
de sedes, categorías y grupos, **no escribas otro adaptador**: reutiliza
`FirestoreStructureRepository<T>` con un mapper (`structure/infrastructure/firestore/structure-mapper.ts`).

Las colecciones nuevas viven bajo `tenants/{tenantId}/...` (D-05). Si la consulta
usa varios filtros de desigualdad u orden, agrega el índice a
`firestore.indexes.json`.

## 4. Ruta en la API del módulo

1. Define la ruta REST (`/tenants/:tenantId/...` o `/me/...`) y el método. El
   `tenantId` va en la ruta, nunca en el cuerpo.
2. Crea `<módulo>/infrastructure/http/routes/<nombre>/schema.ts` con el zod de
   **entrada** y de **salida**. Usa `.strict()`. El actor nunca va en la entrada.
3. **Test de contrato primero** en
   `<módulo>/infrastructure/http/routes/<nombre>/<nombre>.route.integration.test.ts`,
   llamando a la ruta por HTTP contra el emulador. Cubre como mínimo:
   - sin token → `401`;
   - entrada inválida → `400` (campo faltante, valor fuera de rango, campo extra);
   - usuario de otro tenant → `403` y nada cambia;
   - cada rol que **no** debe poder hacerlo;
   - una membresía recién desactivada → `403` con el mismo token;
   - el camino feliz y, si escribe, su bitácora.
4. Implementa `handler.ts` con este orden fijo: `parseInput` (zod; → `400`) →
   `authorizeTenantMember` (el `uid` ya lo dejó el middleware `authenticate`) →
   caso de uso → `outputSchema.parse`. Los errores los traduce el manejador
   compartido (`shared/infrastructure/http/error-handler.ts`); el handler no
   captura nada.
5. Registra la ruta en `<módulo>/infrastructure/http/router.ts`.
6. Si es un **módulo nuevo**, crea `<módulo>/infrastructure/http/<módulo>-api.ts`
   (`onRequest({cors}, createApi(router))`) y expórtalo en `functions/src/index.ts`.
   Un módulo existente no toca `index.ts`: agregar un caso de uso es agregar una
   ruta, no una function.

## 5. Cierre

```bash
cd functions
npm run lint && npm run typecheck && npm run build
npm run test:unit && npm run test:rules && npm run test:integration
```

- Si agregaste una dependencia de runtime, va en `dependencies` de `functions`
  (no en `devDependencies`, o esbuild la incluirá en el bundle).
- Si el cambio altera el contrato de una ruta ya publicada, **no lo rompas**:
  conserva la anterior (o publica la nueva bajo otra versión de ruta) hasta que el
  front publique la suya (D-01).
- Un ADR en `docs/adr/` por cada decisión que no sea obvia, y replica `docs/` a
  `../escuelas-front/docs/` y `../docs/` en la misma sesión.
