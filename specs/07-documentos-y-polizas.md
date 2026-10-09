# SPEC 07 — Documentos y pólizas (archivos del jugador con URLs firmadas)

> **Status:** Approved
> **Depends on:** SPEC 02, SPEC 04, SPEC 05 y SPEC 06. Cubre §7.5 de `docs/producto.md` y D-08 del plan técnico.
> **Date:** 2026-10-08
> **Objective:** Que el personal suba, reemplace y consulte los documentos de cada jugador (identidad, póliza, autorización de datos, certificado médico y foto) con URLs firmadas, y que se vea al instante si la póliza está vigente, por vencer o vencida.

---

## Por qué existe esta spec

La Fase 1 debe dejar a Argentinos Juniors "cargado con sedes, grupos, jugadores, acudientes y pólizas", y D7 pide encontrar la póliza de un jugador en menos de un minuto. La spec 06 dejó el jugador sin foto ni archivos. Esta spec abre Cloud Storage con URLs firmadas (D-08), que es la única pieza de infraestructura de la Fase 1 que todavía no existe, y resuelve el pendiente de verificar el permiso de firma de la cuenta de servicio, que solo se puede probar en `dev` (D-13).

## Scope

**In:**

- Módulo nuevo `document` en `functions/src/document/{domain,application,infrastructure}`, expuesto como la function `documentApi` (Express, ADR 0009).
- Catálogo fijo de tipos en código: `identity`, `policy`, `dataAuthorization`, `medicalCertificate` y `photo`.
- Los documentos pertenecen solo al jugador.
- Suben y reemplazan el dueño, el auxiliar (`accountant`) y el coordinador dentro de sus sedes. Reutilizan `requireStaff` y `assertCanWriteInVenue` de la spec 06.
- Lectura: dueño y auxiliar ven todo; el coordinador, lo de sus sedes; el profesor, solo `photo` y `policy` de sus grupos (mínimo acceso, mismo recorte de la spec 06).
- Versiones: cada carga crea un documento nuevo y el anterior del mismo tipo pasa a `superseded`. Nada se borra.
- Póliza con número, aseguradora, inicio y vencimiento. El archivo es opcional en la póliza (la importación traerá datos sin PDF) y se adjunta después como una versión nueva.
- Estado de la póliza calculado al leer con `Clock`: `valid`, `expiring`, `expired` o `missing`. La ventana de aviso es `policyWarningDays` en la organización, 30 por defecto, editable con la ruta `updateTenantProfile` de la spec 02.
- Flujo D-08 en tres pasos: pedir URL de subida, subir directo a Storage, confirmar. Al confirmar, la function verifica el objeto y lo mueve a su ruta definitiva.
- Límites: JPEG, PNG, WebP o PDF de hasta 10 MB; la foto, solo imagen y hasta 2 MB. Se validan al pedir la URL y otra vez al confirmar.
- URL de descarga firmada de corta duración, emitida por la function.
- Listado JSON de pólizas por categoría (para inscribir equipos en la liga), con los jugadores sin póliza incluidos.
- Puerto `FileStorage` con adaptador real (Admin SDK), adaptador de emulador sin firma y fake en memoria. Puerto de lectura `PlayerReader` para conocer sede y grupo del jugador sin tocar el módulo `player`.
- Bitácora: `document.uploaded`, `document.recorded` y `document.superseded`.
- Índices compuestos nuevos, pruebas de reglas de Storage (siguen en deny-all), seed con documentos ficticios, smoke test extendido, regla de ciclo de vida de `uploads/`, guía y ADR 0013.

**Out of scope (for future specs):**

- Tipos de documento configurables por escuela (§7.5 los pide así; el piloto tiene una sola escuela).
- Carga por el acudiente: espera a la invitación de acudientes (spec pendiente).
- Documentos del acudiente o del pagador autorizado (spec de familias y pagadores).
- Avisos de vencimiento por correo (§7.15, Fase 2) y cualquier función programada.
- CSV o formato de la liga: depende de Q8, que sigue abierta.
- Excepción del dueño para una póliza vencida en un partido (C19, "por decidir" en producto).
- Anulación de un documento con motivo (acción "A" de la matriz §7.2): reemplazar con una versión nueva cubre el error común.
- Filtro "sin póliza" en `listPlayers` (spec 06).
- Compresión de imágenes: la hace el cliente (D-08).

## Data model

Colección de primer nivel `tenants/{tenantId}/documents/{documentId}`, y no subcolección del jugador, para consultar las pólizas vigentes de un conjunto de jugadores sin collection group.

```ts
type DocumentType =
  | "identity"
  | "policy"
  | "dataAuthorization"
  | "medicalCertificate"
  | "photo";

type PolicyData = {
  number: string;
  insurer: string;
  validFrom: string; // YYYY-MM-DD, día calendario de Bogotá
  validUntil: string; // YYYY-MM-DD, inclusive
};

type PlayerDocument = {
  id: string;
  playerId: string;
  venueId: string; // copiado del jugador para filtrar por alcance
  groupId: string; // copiado del jugador para filtrar por alcance
  type: DocumentType;
  status: "current" | "superseded";
  supersededBy?: string; // id de la versión que lo reemplazó
  file?: {
    path: string; // tenants/{t}/players/{p}/documents/{docId}
    contentType: string;
    size: number; // bytes
  };
  policy?: PolicyData; // solo si type === "policy"
  createdAt: Date; // UTC
  createdBy: string; // uid
};

type PolicyStatus = "valid" | "expiring" | "expired" | "missing"; // calculado, no se guarda
```

Se agrega a `Tenant` el campo `policyWarningDays: number` (entero entre 1 y 365, 30 por defecto; un tenant existente sin el campo se lee como 30).

Convenciones:

- `venueId` y `groupId` se copian al crear el documento; si el jugador cambia de grupo (spec 06), el alcance de lectura de sus documentos se actualiza en la misma transacción del cambio de grupo del módulo `player`, que escribe las dos copias a través del puerto de lectura. Si esto no es viable sin acoplar los módulos, el alcance se resuelve leyendo el jugador en cada petición y los campos se descartan; la decisión se toma en el paso 3 del plan y queda registrada en el ADR 0013.
- Un solo documento `current` por jugador y tipo. Subir uno nuevo marca el anterior como `superseded` en la misma transacción.
- La póliza vence al final del día `validUntil` en America/Bogota. `expiring` si faltan `policyWarningDays` días o menos; `expired` si la fecha ya pasó; `missing` si el jugador no tiene póliza `current`.
- Rutas de Storage: subidas pendientes en `uploads/{t}/{uploadId}` (un solo prefijo para la regla de ciclo de vida; decidido por el usuario el 2026-10-08); archivos confirmados en `tenants/{t}/players/{p}/documents/{docId}`.
- Los metadatos del archivo (tipo y tamaño) se leen del objeto en Storage al confirmar, nunca de lo que diga el cliente.

### Rutas y contratos

Todas bajo `/tenants/:tenantId`, con `Authorization: Bearer`; los esquemas zod viven junto a cada handler (ADR 0009).

| Ruta                                                        | Quién                                        | Entrada                                                                   | Salida                                                                    |
| ----------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `POST /players/:playerId/documents/uploads`                 | personal                                     | `{ type, contentType, size }`                                             | `201 { uploadId, uploadUrl, expiresAt }`                                  |
| `POST /players/:playerId/documents`                         | personal                                     | `{ type, uploadId?, policy? }` (`uploadId` obligatorio salvo en `policy`) | `201 { document, policyStatus? }`                                         |
| `GET /players/:playerId/documents`                          | personal y profesor (recortado)              | `?history=true` opcional                                                  | `200 { documents, policyStatus }`                                         |
| `GET /players/:playerId/documents/:documentId/download-url` | personal y profesor (solo `photo`, `policy`) |                                                                           | `200 { url, expiresAt }`                                                  |
| `GET /categories/:categoryId/policies`                      | personal                                     |                                                                           | `200 { items: [{ playerId, fullName, groupId, policy?, policyStatus }] }` |

Reglas de las rutas:

- La URL de subida y la de descarga duran pocos minutos (15 para subida, 5 para descarga) y se firman para el tipo y tamaño exactos.
- Confirmar con un `uploadId` ajeno al tenant, inexistente, vencido, o cuyo objeto no cumple tipo y tamaño responde 400 y no crea registro.
- Confirmar el mismo `uploadId` dos veces es idempotente: devuelve el documento ya creado.
- Una póliza sin archivo se registra con `policy` y sin `uploadId`. Una póliza con archivo lleva los dos.
- `photo` exige imagen y máximo 2 MB; los demás tipos aceptan PDF o imagen hasta 10 MB.
- `GET .../policies` por categoría ordena por grupo y nombre, y el coordinador solo recibe jugadores de sus sedes.
- Errores como en la spec 06: 400 validación, 403 permiso, 404 recurso inexistente en el tenant.
- Acciones de bitácora: `document.uploaded` (se emitió URL de subida), `document.recorded` (versión creada) y `document.superseded` (versión anterior reemplazada).

### Estructura de archivos

```
functions/src/document/
├── domain/        document.ts, document-limits.ts, policy-status.ts, document-visibility.ts
├── application/   request-upload.ts, record-document.ts, list-player-documents.ts,
│                  get-download-url.ts, list-category-policies.ts,
│                  document-repository.ts, file-storage.ts, player-reader.ts,
│                  testing/ (fakes en memoria)
└── infrastructure/
    ├── firestore/ firestore-document-repository.ts, document-mapper.ts, firestore-player-reader.ts
    ├── storage/   gcs-file-storage.ts, emulator-file-storage.ts
    └── http/      document-api.ts, router.ts, routes/<name>/{handler,schema}.ts
```

## Implementation plan

1. Dominio: `DocumentType`, límites de tipo y tamaño, `policyStatus` con `Clock`, visibilidad por rol. Pruebas unitarias primero.
2. Agregar `policyWarningDays` a `Tenant`, a su mapper y a `updateTenantProfile` (con su esquema y pruebas).
3. Puertos `DocumentRepository`, `FileStorage` y `PlayerReader`, con fakes en `application/testing/`. Resolver aquí cómo se obtiene el alcance del jugador (ver convenciones) y registrarlo.
4. Casos de uso: `requestUpload`, `recordDocument` (incluye reemplazo en transacción), `listPlayerDocuments`, `getDownloadUrl`, `listCategoryPolicies`, cada uno con su prueba unitaria.
5. Adaptadores Firestore para `DocumentRepository` y `PlayerReader`, con pruebas de integración contra el emulador.
6. Adaptador `FileStorage` real (Admin SDK, URLs firmadas v4) y adaptador de emulador; selección por entorno. Prueba de integración contra el Storage emulator.
7. Rutas de `documentApi` y su export en `src/index.ts`; pruebas HTTP de integración de cada ruta.
8. Índices compuestos en `firestore.indexes.json` y pruebas de reglas: `documents` en Firestore y las rutas nuevas de Storage siguen en deny-all.
9. Seed con documentos y pólizas ficticias, y smoke test extendido (`smoke:emulator` y `smoke:dev`).
10. Regla de ciclo de vida de `uploads/` (archivo JSON versionado) y guía de despliegue: permiso IAM de firma y comando `gcloud storage buckets update --lifecycle-file`.
11. ADR 0013, README del módulo, actualizar `docs/arquitectura.md`, `CLAUDE.md`/`AGENTS.md` y `specs/ROADMAP.md`; replicar `docs/` al front y a la carpeta raíz.

## Acceptance criteria

- [ ] `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run test:unit`, `npm run test:rules` y `npm run test:integration` pasan.
- [ ] `src/index.ts` exporta `documentApi` y el build la incluye sin importar `scripts` ni tests.
- [ ] `domain` y `application` de `document` no importan Firebase, `zod` ni `infrastructure` (lo prueba `lint-boundaries.test.ts`).
- [ ] El personal pide una URL de subida con tipo y tamaño válidos y recibe `uploadId`, `uploadUrl` y `expiresAt`.
- [ ] Pedir una subida de `photo` de 3 MB responde 400; de `policy` en PDF de 10 MB, 201; de 11 MB, 400.
- [ ] Confirmar una subida cuyo objeto real no coincide con el tipo o tamaño declarado responde 400 y no crea documento.
- [ ] Confirmar dos veces el mismo `uploadId` devuelve el mismo documento y no crea otro.
- [ ] Subir un segundo documento del mismo tipo deja el primero en `superseded` con `supersededBy`, y solo uno queda `current`.
- [ ] `GET .../documents` sin `history` no devuelve las versiones `superseded`; con `history=true` sí.
- [ ] Una póliza con `validUntil` dentro de 10 días y `policyWarningDays` en 30 devuelve `expiring`; con `validUntil` ayer, `expired`; con 60 días, `valid`; sin póliza, `missing`.
- [ ] Una póliza que vence hoy (hora de Bogotá) sigue sin estar `expired` hasta que termina el día.
- [ ] Un tenant sin `policyWarningDays` guardado usa 30; `updateTenantProfile` acepta un entero entre 1 y 365 y rechaza otros valores.
- [ ] Se registra una póliza sin archivo (solo `policy`) y queda con `file` ausente.
- [ ] Un profesor de sus grupos lee `photo` y `policy`; pedir `identity`, `medicalCertificate` o `dataAuthorization` (listado o descarga) responde 403 o los omite del listado, y fuera de sus grupos responde 403.
- [ ] Un coordinador no sube ni lee documentos de un jugador de otra sede (403).
- [ ] Un usuario de otro tenant recibe 403 en todas las rutas; un `playerId` o `documentId` de otro tenant responde 404.
- [ ] `GET /categories/:categoryId/policies` incluye a los jugadores sin póliza con `policyStatus: "missing"`, y el coordinador solo ve su sede.
- [ ] Las firestore rules y las storage rules siguen negando todo a clientes, también para `documents` y las rutas nuevas (prueba de reglas).
- [ ] Cada subida, registro y reemplazo deja su entrada en `auditLog`.
- [ ] `smoke:emulator` ejecuta subir, confirmar, listar y descargar un documento, y pasa.
- [ ] `smoke:dev` descarga un archivo con una URL firmada real y confirma que la cuenta de servicio tiene permiso de firma.
- [ ] El archivo de ciclo de vida de `uploads/` existe en el repo y la guía dice cómo aplicarlo.
- [ ] El seed es idempotente y deja documentos y pólizas ficticias en distintos estados.

## Decisiones

- **Sí: un módulo nuevo `document` con su propia `documentApi`.** ADR 0009 pide una function por módulo, y así Storage no se mezcla con la ficha de `playerApi`, que ya tiene 12 rutas. **No:** meter las rutas en `playerApi`.
- **Sí: puerto de solo lectura `PlayerReader`.** El módulo `document` conoce sede y grupo del jugador sin importar `player`. _Decidido por el usuario el 2026-10-08._
- **Sí: catálogo fijo de cinco tipos en código.** El piloto tiene una sola escuela; un CRUD de tipos agrega rutas, pruebas y migración sin valor hoy. **No:** colección `documentTypes` por tenant. Queda registrado que §7.5 los pide configurables. _Decidido por el usuario el 2026-10-08._
- **Sí: la foto entra como un tipo más.** Usa el mismo flujo y el carné de la Fase 3 la necesita. **No:** spec aparte. _Decidido por el usuario el 2026-10-08._
- **Sí: solo el personal sube.** El acudiente todavía no tiene cuenta. **No:** subida por el acudiente, que obliga a crear antes sus cuentas y su alcance. _Decidido por el usuario el 2026-10-08._
- **Sí: el profesor ve solo `photo` y `policy`.** Es lo que necesita en un partido (flujo 10.8) y respeta el mínimo acceso sobre documentos de menores. _Decidido por el usuario el 2026-10-08._
- **Sí: reemplazar crea una versión nueva y conserva la anterior.** Cumple "nada se borra" y deja ver el historial de pólizas. **No:** sobrescribir. _Decidido por el usuario el 2026-10-08._
- **Sí: el estado de la póliza se calcula al leer con `Clock`.** No hay estado guardado que se desactualice ni función programada. **No:** job diario. _Decidido por el usuario el 2026-10-08._
- **Sí: `policyWarningDays` configurable por escuela, 30 por defecto.** Las políticas son configuración. **No:** constante fija. _Decidido por el usuario el 2026-10-08._
- **Sí: la póliza puede registrarse sin archivo.** La vigencia es lo que importa para la alerta y la importación (§7.18) traerá datos sin PDF. _Decidido por el usuario el 2026-10-08._
- **Sí: listado JSON de pólizas por categoría.** Basta para ver quién no tiene póliza. **No:** CSV, porque las columnas de la liga no están definidas (Q8). _Decidido por el usuario el 2026-10-08._
- **Sí: JPEG, PNG, WebP y PDF; 10 MB, foto 2 MB.** Las pólizas suelen llegar en PDF y las fotos de celular se comprimen en el cliente. **No:** solo imágenes. _Decidido por el usuario el 2026-10-08._
- **Sí: subida en `uploads/` con confirmación y borrado automático a 1 día.** El archivo se verifica y se mueve al confirmar. Un archivo sin confirmar nunca fue un registro, así que no viola "nada se borra". **No:** subir directo a la ruta final, que deja archivos huérfanos. _Decidido por el usuario el 2026-10-08._
- **Sí: adaptador de emulador sin firma más prueba real en `dev`.** El emulador no replica las URLs firmadas (D-13); `smoke:dev` prueba la firma real. **No:** solo fakes en memoria. _Decidido por el usuario el 2026-10-08._
- **Sí: colección de primer nivel `documents`.** Permite consultar por jugadores sin collection group. **No:** subcolección del jugador.
- **Sí: dejar la anulación fuera.** Reemplazar con una versión nueva cubre el error común; anular con motivo (acción "A" para el dueño) se agrega en otra spec si hace falta. Pendiente de confirmar por el usuario al revisar esta spec.

## Risks

| Risk                                                                                                  | Mitigation                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| La cuenta de servicio de las functions no tiene permiso para firmar URLs (D-08 lo deja pendiente).    | La guía documenta el rol IAM necesario; `smoke:dev` falla con un mensaje claro si falta.                                                              |
| El emulador no firma URLs ni aplica el ciclo de vida, así que no prueba nada de eso.                  | Adaptador de emulador solo para la lógica; la firma real y el ciclo de vida se verifican en `dev`.                                                    |
| La regla de ciclo de vida no se despliega con `firebase deploy`.                                      | Archivo versionado en el repo y comando `gcloud` en la guía; criterio de aceptación explícito.                                                        |
| Los despliegues desde la máquina local fallan por red (`docs/guias/despliegue-con-red-inestable.md`). | Leer la guía antes de desplegar; verificar qué destinos quedaron desplegados.                                                                         |
| Subir `venueId` y `groupId` en cada documento los deja desactualizados si el jugador cambia de grupo. | Resolver en el paso 3 del plan: actualizarlos en el cambio de grupo o leer el alcance del jugador en cada petición; el ADR 0013 registra la decisión. |
| Un cliente confirma un `uploadId` con un objeto distinto a lo declarado.                              | Tipo y tamaño se leen del objeto en Storage al confirmar, nunca del cliente.                                                                          |
| Q12 (datos de menores) sigue abierta y los documentos incluyen identidad y certificados médicos.      | Solo personal autorizado, deny-all para clientes y datos ficticios hasta resolver Q12.                                                                |

## What is **not** in this spec

- Tipos de documento configurables por escuela.
- Subida por el acudiente y documentos del acudiente o pagador.
- Avisos de vencimiento por correo y funciones programadas.
- CSV o formato de la liga (Q8) y excepción del dueño por póliza vencida (C19).
- Anulación de documentos con motivo.
- Filtro "sin póliza" en `listPlayers`.

Cada una de estas, si llega, va en su propia spec.
