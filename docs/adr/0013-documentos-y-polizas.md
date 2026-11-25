# ADR 0013 — Documentos y pólizas: módulo `document`, URLs firmadas y estado calculado

- **Estado:** Aceptada. Implementada en código; faltan el despliegue a `dev` con la guía de URLs firmadas, `seed:dev`, `smoke:dev` (que prueba la firma real) y el CI en un PR real (ver "Verificación")
- **Fecha:** 2026-10-08
- **Spec:** `specs/07-documentos-y-polizas.md` · **Plan:** D-08 · **Producto:** §7.5, C19
- **Se apoya en:** ADR 0009 (una API por módulo), ADR 0010 (alcance por rol) y ADR 0011 (jugadores)

## Resumen

El personal sube, reemplaza y consulta los documentos de cada jugador (identidad, póliza,
autorización de datos, certificado médico y foto) con URLs firmadas, y el sistema dice al
instante si la póliza está vigente, por vencer o vencida. Todo vive en un módulo nuevo,
`functions/src/document/`, con su API `documentApi` y 5 rutas. Es la primera pieza que usa
Cloud Storage: los archivos nunca pasan por las functions (D-08).

## Decisiones

| Tema | Decisión |
| --- | --- |
| Módulo | Uno propio, `document`, con su `documentApi`. No se mezcla con `playerApi`, que ya tiene 12 rutas |
| Tipos | Catálogo fijo de cinco en código: `identity`, `policy`, `dataAuthorization`, `medicalCertificate` y `photo`. La spec 07 lo prefiere a una colección por tenant: el piloto tiene una sola escuela. §7.5 los pide configurables y queda registrado |
| Quién escribe | Dueño, auxiliar y coordinador en sus sedes: las mismas reglas de escritura del módulo `player` (`requireStaff` y `assertCanWriteInVenue`). El acudiente todavía no sube |
| Quién lee | Dueño y auxiliar, todo; coordinador, sus sedes; profesor, solo `photo` y `policy` de sus grupos (mínimo acceso sobre documentos de menores) |
| Versiones | Cada carga crea un documento nuevo y el anterior del mismo tipo pasa a `superseded` con `supersededBy`, en la misma transacción. Nada se borra |
| Colección | De primer nivel, `tenants/{t}/documents/{id}`, y no subcolección del jugador: así se consultan las pólizas de un conjunto de jugadores sin *collection group* |
| Estado de la póliza | Se calcula al leer con `Clock` (`valid`, `expiring`, `expired`, `missing`); no se guarda, así que no se desactualiza y no hay función programada. La ventana de aviso es `policyWarningDays` del tenant (1 a 365, 30 por defecto; un tenant sin el campo se lee como 30) |
| Fin de la vigencia | `validUntil` es inclusivo y se mide por día calendario en America/Bogota: una póliza que vence hoy sigue sin estar `expired` hasta que termina el día |
| Póliza sin archivo | Se registra solo con sus datos (la importación de §7.18 traerá datos sin PDF). El archivo se adjunta después como una versión nueva |
| Límites | JPEG, PNG, WebP o PDF de hasta 10 MB; la foto, solo imagen y hasta 2 MB. Se validan al pedir la URL y otra vez al confirmar, leyendo el objeto guardado |
| Bitácora | `document.uploaded` (se emitió una URL), `document.recorded` y `document.superseded`, en la misma transacción que el cambio. Sin contenido de documentos |

## Alcance del jugador: se lee en cada petición, no se copia

La spec dejó una decisión abierta para el paso 3: guardar `venueId` y `groupId` en cada
documento (y actualizarlos cuando el jugador cambia de grupo) o resolver el alcance leyendo
al jugador en cada petición. Se eligió **leer al jugador**.

- Copiar las dos columnas obliga a que el cambio de grupo del módulo `player` escriba
  también en `documents`, acoplando los módulos y dejando una copia que se desactualiza si
  alguien olvida esa escritura.
- Leer al jugador cuesta una lectura extra por petición. El puerto `PlayerReader`
  (`get` y `listByCategory`) la hace sin que `document` importe el módulo `player`; su
  adaptador lee de `tenants/{t}/players` solo sede, grupo, categoría y nombre.
- Por eso `PlayerDocument` no lleva `venueId` ni `groupId`, y las reglas de visibilidad
  (`document-visibility.ts`) reciben la ubicación del jugador más el tipo del documento.

## Flujo de tres pasos (D-08)

1. `POST …/players/:playerId/documents/uploads` con `{type, contentType, size}`: valida,
   emite una URL de subida de 15 minutos y deja `document.uploaded`.
2. El cliente sube el archivo **directo a Storage**, a `uploads/{tenantId}/{uploadId}`.
3. `POST …/players/:playerId/documents` con `{type, uploadId?, policy?}`: lee tipo y tamaño
   **del objeto guardado**, lo valida, lo mueve a `tenants/{t}/players/{p}/documents/{id}` y
   crea el registro.

Para ver un archivo: `GET …/documents/:documentId/download-url`, una URL firmada de 5 minutos.

Decisiones de este flujo:

| Tema | Decisión |
| --- | --- |
| `uploadId` es el `documentId` | Confirmar dos veces el mismo `uploadId` es idempotente (un `get` devuelve el documento ya creado) y reclamarlo con otro jugador o tipo es `400`. No hace falta un registro de subidas pendientes |
| Reintento de un confirmar cortado | Si el archivo ya se movió pero el registro se perdió, el reintento lo encuentra en la ruta final y completa el confirmar. El orden es: validar, mover, escribir |
| Subida vencida | Una subida de más de 24 horas no se confirma (`400`), aunque la regla de ciclo de vida no la haya borrado todavía |
| `uploadId` como ruta | Solo admite `[A-Za-z0-9_-]{1,128}`: entra en una ruta de Storage y en un id de Firestore |
| Ruta de las subidas | `uploads/{tenantId}/{uploadId}` y **no** `tenants/{t}/uploads/…` como decía la spec. La condición `matchesPrefix` del ciclo de vida de Cloud Storage es un prefijo literal sin comodines, y con el tenant al principio habría que listar un prefijo por tenant y recordar añadirlo al crear cada uno. Un solo prefijo `uploads/` cubre a todos. Decidido por el usuario el 2026-10-08 |
| El archivo no pasa por la function | Las dos URLs se firman para el tipo y el tamaño exactos. La respuesta de `uploads` incluye lo que el cliente debe enviar (ver abajo) |
| `file.path` no sale por la API | El DTO de un documento solo expone `contentType` y `size`: el cliente baja con la URL firmada, no por ruta |

### Contrato del ticket de subida

La salida de `POST …/uploads` es `{uploadId, uploadUrl, uploadMethod, uploadHeaders, expiresAt}`.
La spec listaba `{uploadId, uploadUrl, expiresAt}`; se añadieron `uploadMethod` y
`uploadHeaders` (campos nuevos, no cambian los existentes) porque, sin ellos, una URL firmada
real no se puede usar:

- Una URL firmada de escritura exige `PUT`; el emulador de Storage usa `POST`. El cliente
  necesita saber cuál.
- Google solo aplica el límite de tamaño firmado si el cliente envía
  `x-goog-content-length-range: N,N`, además del `Content-Type`. `uploadHeaders` los trae.

Alternativa descartada: firmar solo el tipo y confiar en la verificación al confirmar. Un
cliente podría subir archivos enormes que quedarían hasta el borrado del ciclo de vida.

## Puertos y adaptadores

| Puerto | Adaptador | Doble |
| --- | --- | --- |
| `DocumentRepository` | `FirestoreDocumentRepository` | `InMemoryDocumentRepository` |
| `FileStorage` | `GcsFileStorage` (Admin SDK, URLs v4); `EmulatorFileStorage` si corre el emulador de Functions | `InMemoryFileStorage` |
| `PlayerReader` | `FirestorePlayerReader` | `InMemoryPlayerReader` |

`DocumentRepository` entra en `TransactionContext` (con el reemplazo y la bitácora en una
transacción). `FileStorage` y `PlayerReader` quedan fuera: no son transaccionales y se
inyectan en el constructor del caso de uso.

El emulador de Storage no firma URLs (D-13). `EmulatorFileStorage` extiende al real y solo
reemplaza las dos URLs: apunta al API REST del emulador (`POST` con `Authorization: Bearer
owner`) y, para descargar, usa un token de descarga. Cubre la lógica del flujo; **la firma
real solo se prueba en `dev`**.

## Datos e índices

- `documents` guarda `playerId`, `type`, `status`, `supersededBy?`, `file?` (`path`,
  `contentType`, `size`), `policy?` (`number`, `insurer`, `validFrom`, `validUntil`),
  `createdAt` y `createdBy`. El `id` y el `tenantId` viven en la ruta.
- Dos índices compuestos nuevos, ambos con `createdAt` descendente: `playerId, status,
  createdAt` (documentos vigentes) y `playerId, createdAt` (con historial). Las otras dos
  consultas (`findCurrent` y `listCurrentPolicies`) solo usan igualdades y un `in`, y no
  necesitan índice compuesto. `listCurrentPolicies` trocea el `in` en bloques de 30.
- El emulador no exige índices: `document-indexes.test.ts` mantiene el archivo alineado con
  las consultas y `smoke:dev` es la prueba real.

## Visibilidad por rol

Regla pura en `document/domain/document-visibility.ts`:

| Rol | Lee | Escribe |
| --- | --- | --- |
| `owner`, `accountant` | todos los tipos | sí |
| `coordinator` | todos los tipos de jugadores de `scope.venueIds` | solo en sus sedes |
| `teacher` | `photo` y `policy` de jugadores de `scope.groupIds` | no |
| `guardian`, `adultPlayer` | `403` | `403` |

Las lecturas con un tipo no permitido responden `403` (descarga) o lo omiten (listado). Un
`playerId`, `documentId` o categoría de otro tenant responde `404`. Un usuario de otro tenant
recibe `403` en todas las rutas.

## Pólizas por categoría

`GET …/categories/:categoryId/policies` devuelve todos los jugadores de la categoría que el
llamante puede ver, con o sin póliza (`policyStatus: "missing"`), ordenados por grupo y nombre.
Es para inscribir equipos en la liga. No hay CSV: las columnas dependen de Q8, que sigue abierta.
Hoy incluye a los jugadores en cualquier estado, también `retirado`; excluirlos es una
decisión pendiente.

## Qué no se puede probar fuera de `dev`

La guía `docs/guias/documentos-y-urls-firmadas.md` lo detalla y dice cómo configurarlo:

| Pieza | Dónde se prueba |
| --- | --- |
| Firma de URLs v4 y el permiso `signBlob` de la cuenta de servicio | `smoke:dev` |
| Regla de ciclo de vida (`storage.lifecycle.json`, se aplica con `gcloud`) | `gcloud storage buckets describe` |
| Índices compuestos de `documents` | `smoke:dev` |
| CORS del bucket para subir desde el navegador | cuando exista el front |

## Verificación

Hecho: `lint`, `format:check`, `typecheck`, `test:unit`, `test:rules`, `test:integration` y
`smoke:emulator` pasan. Pendiente, y necesita tus credenciales y un despliegue: Storage
habilitado en `dev`, permiso de firma, regla de ciclo de vida, despliegue de functions,
reglas e índices, `seed:dev` y `smoke:dev` con los chequeos de la spec 07, y el CI en un PR real.

## Fuera de esta spec

Tipos configurables por escuela, subida por el acudiente, documentos del acudiente o pagador,
avisos de vencimiento por correo, CSV de la liga (Q8), excepción del dueño por póliza vencida
(C19), anulación de documentos con motivo, filtro "sin póliza" en `listPlayers` y compresión de
imágenes (la hace el cliente).
