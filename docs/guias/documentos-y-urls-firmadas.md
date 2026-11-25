# Documentos y URLs firmadas

**Qué es:** lo que hay que hacer **fuera del código** para que los documentos de la spec 07 funcionen en un proyecto real: el permiso para firmar URLs, la regla de ciclo de vida de las subidas pendientes y el bucket. Nada de esto lo despliega `firebase deploy`, y el emulador no lo reproduce (D-13), así que solo se prueba en `dev`.

**Fecha:** 2026-10-08 · **Spec:** 07 · **ADR:** 0013

> **Estado:** los pasos de esta guía están escritos a partir de la documentación de Google y **aún no se han ejecutado en `dev`**. `npm run smoke:dev` es la prueba: si algo falta, falla con un mensaje que apunta aquí.

## Cómo viaja un archivo

1. El cliente pide `POST .../documents/uploads` y recibe `uploadUrl`, `uploadMethod` (`PUT`) y `uploadHeaders`.
2. El cliente sube el archivo **directo a Storage** con esa URL firmada (v4). El archivo queda en `uploads/{tenantId}/{uploadId}`.
3. El cliente confirma con `POST .../documents`. La function lee el tipo y el tamaño **del objeto guardado** (no de lo que dijo el cliente), lo valida y lo mueve a `tenants/{t}/players/{p}/documents/{id}`.
4. Para ver el archivo, el cliente pide `GET .../download-url` y recibe una URL firmada de 5 minutos.

La URL de subida dura 15 minutos y fija el tipo (`Content-Type`) y el tamaño exacto (`x-goog-content-length-range`). El cliente debe enviar **todas** las cabeceras de `uploadHeaders` con el método de `uploadMethod`; si no, Storage rechaza la firma.

## 1. Storage habilitado y nombre del bucket

1. En la consola de Firebase del proyecto, abrir **Storage** y crear el bucket por defecto si no existe. La región debe coincidir con la de Firestore y Functions.
2. Anotar el nombre del bucket (por ejemplo `escuelas-deportivas-dev.firebasestorage.app`; los proyectos antiguos usan `.appspot.com`).
3. Las functions usan el bucket por defecto del proyecto. Para el seed y el smoke test hay que indicarlo: `STORAGE_BUCKET=<nombre>`.

## 2. Permiso para firmar URLs

Una function de Firebase no tiene una llave privada con la que firmar. El Admin SDK firma llamando a la API de credenciales de IAM (`signBlob`), y eso exige dos cosas:

1. **Habilitar la API** `iamcredentials.googleapis.com` en el proyecto:

   ```
   gcloud services enable iamcredentials.googleapis.com --project escuelas-deportivas-dev
   ```

2. **Dar a la cuenta de servicio de las functions el rol** `roles/iam.serviceAccountTokenCreator` **sobre sí misma**. Primero, saber cuál es la cuenta (las functions de 2.ª generación corren en Cloud Run; por defecto usan la cuenta de Compute, `NUMERO_DE_PROYECTO-compute@developer.gserviceaccount.com`):

   ```
   gcloud run services describe documentapi --region us-central1 --project escuelas-deportivas-dev --format="value(spec.template.spec.serviceAccountName)"
   ```

   Luego, el permiso:

   ```
   gcloud iam service-accounts add-iam-policy-binding CUENTA --member="serviceAccount:CUENTA" --role="roles/iam.serviceAccountTokenCreator" --project escuelas-deportivas-dev
   ```

   El nombre del servicio de Cloud Run es el de la function en minúsculas (`documentapi`). Si la cuenta es otra (por ejemplo una creada para las functions), usar esa.

**Síntoma si falta:** `POST .../uploads` o `GET .../download-url` responden **500**, y en los logs de la function aparece un error de permisos al firmar (`iam.serviceAccounts.signBlob`). `smoke:dev` lo reporta en el chequeo de subida y sugiere esta guía.

## 3. Regla de ciclo de vida de `uploads/`

Una subida que nunca se confirma deja un objeto huérfano. El archivo `storage.lifecycle.json` (raíz del repo) borra los objetos de `uploads/` a **1 día**. Un archivo sin confirmar nunca fue un registro, así que esto no viola "nada se borra".

Por qué `uploads/{tenantId}/…` y no `tenants/{t}/uploads/…`: la condición `matchesPrefix` de Cloud Storage compara el **inicio literal** del nombre del objeto, sin comodines. Con el tenant al principio de la ruta habría que listar un prefijo por tenant y acordarse de añadirlo al crear cada uno.

Aplicarla (`firebase deploy` no lo hace):

```
gcloud storage buckets update gs://NOMBRE_DEL_BUCKET --lifecycle-file=storage.lifecycle.json
```

Comprobarla:

```
gcloud storage buckets describe gs://NOMBRE_DEL_BUCKET --format="default(lifecycle_config)"
```

Debe mostrar una regla `Delete` con `age: 1` y `matchesPrefix: [uploads/]`. Hay que repetir el comando en cada proyecto (`dev` y, cuando exista, `prod`).

La prueba `storage-lifecycle.test.ts` mantiene el archivo alineado con las rutas del código.

## 4. Desplegar y comprobar en `dev`

Leer antes [Despliegue con red inestable](despliegue-con-red-inestable.md). El orden recomendado:

```
firebase deploy --only firestore,storage --project dev
firebase deploy --only functions --project dev
```

Los índices de `documents` tardan unos minutos en construirse; hasta entonces `GET .../documents` falla con un error de índice.

Luego, con las credenciales de aplicación y el bucket:

```
STORAGE_BUCKET=<bucket> SEED_PASSWORD=... npm run seed:dev
STORAGE_BUCKET=<bucket> SEED_PASSWORD=... FIREBASE_API_KEY=... npm run smoke:dev
```

`STORAGE_BUCKET` en el smoke es opcional: sin él, los archivos que sube el smoke test no se borran (son diminutos y ficticios) y lo avisa.

## Lo que el emulador no prueba

| Pieza | En el emulador | Se prueba en |
| --- | --- | --- |
| Firma de URLs v4 | No firma: el adaptador del emulador apunta a su API REST | `smoke:dev` |
| Permiso `signBlob` de la cuenta de servicio | No existe | `smoke:dev` |
| Regla de ciclo de vida | No se aplica | `gcloud storage buckets describe` |
| Índices compuestos de `documents` | No los exige | `smoke:dev` (la lista de documentos) |
| Cabecera `x-goog-content-length-range` | No se valida | `smoke:dev` |

## Pendiente para cuando llegue el front

El navegador sube con `PUT` directo al bucket, y eso exige **CORS en el bucket** (origen del front, método `PUT`, cabeceras `Content-Type` y `x-goog-content-length-range`). No es parte de la spec 07 (el front aún no existe); se configura con `gcloud storage buckets update --cors-file=…` cuando haya un origen que permitir.
