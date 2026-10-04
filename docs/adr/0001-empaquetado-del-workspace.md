# ADR 0001 — Empaquetado de `packages/domain` en el despliegue de Functions

- **Estado:** Aceptada (verificación en despliegue real pendiente, ver "Verificación")
- **Fecha:** 2026-10-03
- **Spec:** `specs/01-fundaciones-backend.md`, paso 2

## Contexto

`firebase deploy` solo sube la carpeta `functions/`. Una dependencia a
`packages/domain` (workspace local, no publicado, D-01) no viajaría en el
despliegue y la función fallaría al arrancar.

## Decisión

Empaquetar con **esbuild** a un único `functions/lib/index.js`:

- `@escuelas/domain` **no se declara** en `functions/package.json`: npm enlaza todos los
  workspaces en `node_modules`, así que se resuelve igual. Al no estar en `dependencies`,
  se **incluye en el bundle**. (Declararlo como `devDependency` con `"*"` rompería el
  build en la nube: Cloud Build lo buscaría en el registro público de npm.)
- Las `dependencies` de `functions` (`firebase-admin`, `firebase-functions`) quedan
  **externas**; Cloud Build las instala desde `functions/package.json`.
- `functions/build.mjs` deriva la lista de externos de `dependencies`, así que
  agregar una dependencia de runtime no requiere tocar el script.
- `npm run build` (raíz): `tsc` de `domain` (genera `dist/` con tipos), luego
  `tsc --noEmit` + esbuild en `functions`. `tsc` sigue siendo el verificador de tipos;
  esbuild solo genera el JavaScript.

## Alternativas descartadas

- **Empaquetar el paquete en el predeploy** (copiar o `npm pack` a `functions/`):
  más piezas móviles y el `package.json` de `functions` tendría que apuntar a un
  archivo local que no existe en Cloud Build.
- **Publicar `@escuelas/domain`:** contradice D-01 (nada se publica).

## Consecuencias

- El despliegue depende de que el bundle no haga `require("@escuelas/domain")`.
- El lockfile pasa a la raíz (`package-lock.json`); `functions/package-lock.json` se elimina.
- Los stack traces apuntan al bundle; se generan source maps (`sourcemap: true`).

## Verificación

- Hecho: `npm run build` pasa; el bundle contiene el código del dominio y no importa
  `@escuelas/domain`; en el emulador, la función temporal `spikeDomainPing` (retirada en el paso 10) respondió con código del dominio. Desde el paso 10 el mismo bundle sirve `listMyMemberships`, que importa `@escuelas/domain` y `zod`, probada por los tests de integración.
- **Verificado en la nube (2026-10-03, paso 15):** `firebase deploy --only functions,firestore,storage`
  a `escuelas-deportivas-dev` creó `listMyMemberships` y `changeMembershipRole` como funciones
  2.ª gen, `nodejs24`, en `us-central1`. El bundle con el dominio incluido arrancó en Cloud Run
  y un segundo despliegue sin cambios las omitió (`No changes detected`).
- Los primeros intentos de despliegue habían fallado con `getaddrinfo ENOTFOUND` /
  `EREFUSED`: era el servidor DNS local rechazando ráfagas de consultas, no el bundle ni los
  permisos. Se sorteó resolviendo por DNS público solo para ese comando.
