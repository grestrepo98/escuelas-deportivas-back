# ADR 0006 — CI en pull requests y despliegue a `dev` (credencial provisional)

- **Estado:** Aceptada (la autenticación es **provisional**)
- **Fecha:** 2026-10-03
- **Spec:** `specs/01-fundaciones-backend.md`, paso 14 · **Plan:** D-13, D-16

## Contexto

D-16 dejó abierto cómo se autentica el despliegue. Hace falta CI en cada PR y un
despliegue al proyecto `dev`. Regla acordada: **el ambiente `dev` refleja lo que
tenga la rama `dev`**. `prod` no existe todavía.

## Decisión

Dos workflows en `.github/workflows/`:

- **`ci.yml`** (en cada PR a `dev` o a `main`, y reutilizable): dos trabajos en paralelo.
  - `checks`: `lint`, `typecheck`, `build`, `test:domain`.
  - `emulators`: `test:rules` y `test:integration`, cada uno con
    `firebase emulators:exec` sobre proyectos `demo-*` (JVM 21; el JAR de los
    emuladores se cachea). Nunca tocan un proyecto real.
- **`deploy-dev.yml`** (push a la rama `dev`): vuelve a ejecutar `ci.yml` y solo si
  pasa despliega `firebase deploy --only functions,firestore,storage --project dev`.
  Una sola ejecución a la vez, sin cancelar la que esté en curso.

Autenticación: una **service account** guardada como secreto
`FIREBASE_SERVICE_ACCOUNT_DEV` en el *environment* `dev` de GitHub, entregada al
CLI con `google-github-actions/auth`. Es una decisión **provisional**.

## Consecuencias

- **Riesgo aceptado en `dev`:** es una credencial de larga vida. Mitigación:
  permisos mínimos (solo el proyecto `dev`), secreto atado al environment y
  rotación manual. Antes de abrir `prod` se reemplaza por federación de identidad
  (Workload Identity Federation, sin llaves), previsto en la Fase 3.
- **Roles de la service account:** deben alcanzar para desplegar Functions, reglas
  de Firestore/Storage e índices. El conjunto exacto se confirma en el primer
  despliegue real (paso 15); se parte del mínimo y se amplía solo lo que el
  error pida.
- Las acciones de terceros van fijadas por versión mayor (`@v4`, `@v2`). Fijarlas
  por SHA es una mejora pendiente.
- Para exigir que el CI pase antes de fusionar, hay que activar la protección de
  las ramas `dev` y `main` en GitHub marcando los dos trabajos como obligatorios. Es
  configuración del repositorio, no del código.
- `functions/` no tiene `package-lock.json` propio (el lockfile está en la raíz),
  así que Cloud Build resuelve las dependencias de runtime sin lockfile.
- **Política de limpieza de imágenes (hecho en el paso 15):** en modo no interactivo el CLI
  termina con error si el repositorio `gcf-artifacts` de Artifact Registry no tiene política de
  limpieza, aunque el despliegue haya salido bien; eso habría puesto en rojo el workflow. Se
  configuró una vez con `firebase functions:artifacts:setpolicy --project dev --location
  us-central1 --days 7 --force` (se borran imágenes de más de 7 días; por defecto serían 1).
  En `prod` habrá que repetirlo al crear el proyecto.
- No hay `prod` ni aprobación manual: llegan con la Fase 3.
