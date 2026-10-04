# Cómo agregar un caso de uso (y su callable)

Receta con TDD, de adentro hacia afuera. Usa `ChangeMembershipRole` como modelo.
Cada paso termina en verde antes de pasar al siguiente.

## 0. Antes de escribir código

- La regla de negocio está en una spec aprobada (`specs/`). Si no, va primero a la spec.
- Decide si necesita **dominio** (hay reglas) o es una **lectura pura** (solo
  consultar y dar forma): las lecturas pueden ser una consulta en el adaptador,
  como `listMyMemberships`.

## 1. Dominio: puertos nuevos (solo si hacen falta)

1. Define la interfaz en `packages/domain/src/ports/` con lo mínimo que el caso
   de uso necesita (no copies la API de Firestore).
2. Escribe su doble en memoria en `packages/domain/test/fakes/` y **pruébalo**
   (`fakes.test.ts`). Si participa en transacciones, debe poder hacer rollback.
3. Expórtalo desde `src/index.ts`.

## 2. Dominio: el caso de uso

1. **Test primero** en `packages/domain/test/<área>/<caso>.test.ts`. Por cada
   regla: un caso positivo y uno negativo. Verifica también que, al rechazar, no
   se escribió nada (ni dato ni bitácora).
2. Corre `npm run test:domain` y confirma que falla **por la razón correcta**
   (falta el módulo, no un error de tipeo).
3. Implementa en `packages/domain/src/<área>/<caso>.ts`:
   - Recibe sus puertos por constructor (`UnitOfWork`, `Clock`, …).
   - Hace todo dentro de `unitOfWork.run(...)`: **primero todas las lecturas,
     después las escrituras**.
   - Sin efectos fuera del contexto de la transacción (puede reintentarse).
   - Falla con `DomainError` (`permission_denied`, `not_found`,
     `failed_precondition`).
   - Si cambia datos que importan, agrega una `AuditEntry` en la misma
     transacción (y amplía `AuditAction`).
4. Exporta desde `src/index.ts`.

El dominio no importa Firebase; `npm run lint` lo verifica.

## 3. Adaptador de Firestore (solo si hay un puerto nuevo)

1. Test de integración primero en `functions/test/integration/` (ida y vuelta,
   y atomicidad: si algo falla, no queda nada a medias).
2. Implementa en `functions/src/adapters/firestore/`. Acepta una `Transaction`
   opcional y úsala cuando exista. Convierte `Date` ↔ `Timestamp` en un mapper.
3. Corre `npm run test:integration`.

Las colecciones nuevas viven bajo `tenants/{tenantId}/...` (D-05). Si la consulta
usa varios filtros de desigualdad u orden, agrega el índice a
`firestore.indexes.json`.

## 4. Callable

1. Crea `functions/src/callables/<nombre>/schema.ts` con el zod de **entrada** y
   de **salida**. Usa `.strict()`. El actor nunca va en la entrada.
2. **Test de contrato primero** en `functions/test/integration/<nombre>.callable.test.ts`.
   Cubre como mínimo:
   - sin sesión → `UNAUTHENTICATED`;
   - entrada inválida → `INVALID_ARGUMENT` (campo faltante, valor fuera de rango, campo extra);
   - usuario de otro tenant → `PERMISSION_DENIED` y nada cambia;
   - cada rol que **no** debe poder hacerlo;
   - una membresía recién desactivada → `PERMISSION_DENIED` con el mismo token;
   - el camino feliz y, si escribe, su bitácora.
3. Implementa `index.ts` con este orden fijo:
   `requireUid` → `safeParse` (→ `invalid-argument`) → `authorizeTenantMember` →
   caso de uso dentro de `try/catch` con `toHttpsError` → `outputSchema.parse`.
4. Exporta la callable en `functions/src/index.ts`.

## 5. Cierre

```bash
npm run lint && npm run typecheck && npm run build
npm run test:domain && npm run test:rules && npm run test:integration
```

- Si agregaste una dependencia de runtime, va en `dependencies` de `functions`
  (no en `devDependencies`, o esbuild la incluirá en el bundle).
- Si el cambio altera el contrato de una callable ya publicada, **no lo rompas**:
  conserva la anterior hasta que el front publique la nueva (D-01).
- Un ADR en `docs/adr/` por cada decisión que no sea obvia, y replica `docs/` a
  `../escuelas-front/docs/` y `../docs/` en la misma sesión.
