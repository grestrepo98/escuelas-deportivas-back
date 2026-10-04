# ADR 0005 — Seed en vez de callables de alta; roles de plataforma diferidos

- **Estado:** Aceptada
- **Fecha:** 2026-10-03
- **Spec:** `specs/01-fundaciones-backend.md` · **Plan:** módulos 7.2 y 7.19

## Contexto

Para probar el aislamiento entre tenants hacen falta datos: tenants, usuarios y
membresías de los 6 roles. Construir callables de alta (invitaciones, creación
de tenants, desactivación de usuarios) adelantaría los módulos 7.2 y 7.19 de la
Fase 1.

## Decisión

- Un **script de seed** (`scripts/seed.ts`) con el Admin SDK crea `tenant-a` con
  un usuario por rol y `tenant-b` con un `owner`. Solo se construye la callable
  de cambio de rol, porque la puerta de salida la exige.
- **Idempotente:** uids e ids fijos; lo que no cambia no se reescribe. Una
  membresía que se desvió del valor base se restaura.
- **Destino explícito y acotado:** `--target emulator|dev` es obligatorio; `prod`
  no existe como opción. `dev` exige `SEED_PASSWORD` (sin contraseña por defecto
  en un proyecto real) y se niega si hay variables de emulador definidas, para
  no escribir en el emulador creyendo que se escribe en `dev`.
- **Los dos roles de plataforma** (super administrador y soporte) no viven dentro
  de un tenant y exigen un mecanismo aparte: se diseñan con el módulo 7.19 en la
  Fase 1.

## Consecuencias

- Los tenants y usuarios del seed son datos de prueba con prefijo fijo
  (`seed-…`, `…@seed.escuelas.test`); no deben mezclarse con datos reales.
- En `dev` el seed necesita credenciales de aplicación (`gcloud auth
  application-default login` o `GOOGLE_APPLICATION_CREDENTIALS`).
- Las rutas de alta reales llegan con la Fase 1.
