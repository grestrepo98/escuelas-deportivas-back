# ADR 0003 — Región `us-central1`, Node 24 y proyecto `escuelas-deportivas-dev`

- **Estado:** Aceptada
- **Fecha:** 2026-10-03
- **Spec:** `specs/01-fundaciones-backend.md` · **Plan:** D-13, D-14

## Contexto

Al revisar los documentos había datos que no coincidían con el estado real:
Node 22 vs. 24, el identificador del proyecto Firebase y la región. Estado
verificado: `engines.node` es `24`; el proyecto es `escuelas-deportivas-dev`; la
base Firestore `(default)` ya existe en `nam5` (multi-región de EE. UU.), y su
ubicación no se puede cambiar.

## Decisión

- **Node 24.** Es el estado real del scaffold; se actualiza el plan, no el código.
- **Proyecto `escuelas-deportivas-dev`**, con alias `dev` en `.firebaserc` (y
  `default`). El alias `prod` se agrega cuando exista ese proyecto.
- **Functions en `us-central1`**, fijada con
  `setGlobalOptions({region: "us-central1", maxInstances: 10})`. La
  documentación de Firebase recomienda esa región para Firestore en `nam5`, y
  Functions debe compartir región con Firestore (D-14).

## Consecuencias

- Latencia mayor que desde São Paulo, ya aceptada en D-14.
- La región de Functions también es difícil de cambiar: cambiarla implica
  recrear las funciones. Está fijada una sola vez, en `functions/src/index.ts`.
- La región desplegada se verifica en el despliegue de `dev` (spec 01, paso 15).
