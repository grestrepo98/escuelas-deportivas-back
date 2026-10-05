# Despliegue con red inestable

**Qué es:** una limitación del entorno de desarrollo, no del código. Desde la máquina local de desarrollo, los despliegues de Firebase (functions y hosting) fallan de forma intermitente por problemas de red. Esta guía dice cómo reconocerlo y qué tener en cuenta al planear.

**Fecha:** 2026-10-04 · **Detectado en:** despliegue a `dev` de la spec 04.

## Cómo se manifiesta

Los fallos aparecen en llamadas de red a las APIs de Google, no en el código ni en los permisos. En el despliegue a `dev` de la spec 04 se vieron, en intentos consecutivos y sin cambiar nada:

- `Error: Failed to make request to https://firebaserules.googleapis.com/v1/projects/…:test` (validación de reglas).
- `Failed to fetch the list of extensions` (advertencia) y `Error generating the service identity for pubsub.googleapis.com`.
- `getaddrinfo ENOTFOUND cloudbilling.googleapis.com` (con `--debug`): falla la resolución DNS.
- Un `firebase functions:list` falló una vez y funcionó al repetirlo.

Una comprobación posterior sí resolvía esos mismos hosts: el fallo es intermitente. Quien desarrolla reporta además problemas al subir hosting.

## Qué esperar de un despliegue que se corta

`firebase deploy` no es atómico entre targets. En el intento con `--debug` quedaron desplegados los índices de Firestore, pero no las reglas ni las functions. Antes de reintentar, mirar qué quedó: `firebase functions:list --project dev` y la consola de Firebase.

Reintentar es seguro: el despliegue es idempotente. Las llamadas que ya terminaron se repiten sin efecto.

## Qué hacer al planear

1. **Ordenar los pasos destructivos.** Si un plan borra recursos en `dev` antes de desplegar (por ejemplo, la spec 04 borró las 10 callables y después desplegó), un corte de red deja `dev` sin esas functions hasta que el despliegue termine. Cuando se pueda, desplegar primero lo nuevo y borrar lo viejo después. Si el orden no se puede cambiar, avisar que `dev` queda caído en ese lapso.
2. **Dividir el despliegue** cuando falle seguido: `--only firestore`, `--only storage` y `--only functions` por separado acotan lo que se pierde en cada corte.
3. **Reservar margen** en las specs con despliegue: un paso de "desplegar a `dev`" puede requerir varios intentos y no es señal de un defecto del cambio.
4. **Preferir el CI** como alternativa. `deploy-dev.yml` despliega a `dev` en cada push a la rama `dev` desde un runner de GitHub, que no pasa por la red local. Queda sujeto a que el CI ya haya corrido en GitHub (ver ADR 0006).
5. **No tocar el código ni las reglas para "arreglar" estos errores.** Si el mensaje es de red (`ENOTFOUND`, `Failed to make request`), el cambio no tiene la culpa.

## Cómo distinguirlo de un fallo real

| Síntoma | Probable causa |
| --- | --- |
| `ENOTFOUND`, `Failed to make request`, que cambia entre intentos | Red local |
| Error de compilación de reglas, de lint, de typecheck | Código |
| `403` o `PERMISSION_DENIED` estable en cada intento | Permisos de la cuenta o del proyecto |
