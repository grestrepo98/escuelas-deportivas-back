# Plan Técnico — Plataforma de Escuelas Deportivas

Oct 1, 2026 · Borrador para conversar con Gustavo

Este documento es la contraparte técnica de `producto.md`. No es una especificación cerrada: es una conversación. Cada decisión trae una propuesta, el porqué, la alternativa con su tradeoff y un estado. Lo que marquemos como **Acordado** se vuelve regla; lo que quede **Por decidir** lo discutimos.

## 1. Cómo leer este documento

Cada decisión usa este formato:

> **D-XX · Título**
> **Propuesta:** qué haremos.
> **Por qué:** la razón, normalmente atada a un principio o módulo de `producto.md`.
> **Alternativa:** qué otra cosa se podría hacer y qué costaría.
> **Estado:** `Acordado` o `Por decidir`.

Las referencias como §7.9, C22 o Q3 apuntan a secciones, casos borde y preguntas abiertas de `producto.md`.

## 2. Lo que ya está decidido

| Tema | Decisión | Estado |
| --- | --- | --- |
| Backend | Node.js + TypeScript | Acordado |
| Front | React + TypeScript | Acordado |
| Plataforma | Firebase: Authentication, Firestore, Cloud Functions, Hosting (y Storage para archivos) | Acordado |
| Ambientes | Dos proyectos Firebase: `dev` y `prod` | Acordado |
| Fases | La F1 de producto (MVP del piloto) se parte en 3 entregas técnicas incrementales | Acordado |

## 3. Arquitectura propuesta

### D-01 · Dos repositorios independientes

> **Reemplaza** la decisión anterior de monorepo con npm workspaces. Esa decisión ya había dejado "dos repos" como alternativa y como salida si el monorepo dolía; se separa antes de escribir código.

**Propuesta:** dos proyectos independientes, cada uno con su propio repositorio git, configuración, historial y despliegue. Conviven lado a lado en la carpeta de trabajo (que no es un repositorio) y en GitHub se agrupan en un solo GitHub Project.

```
escuelas-deportivas-app/            (carpeta simple, NO es un repo git)
├── escuelas-front/                 repo grestrepo98/escuelas-front
│   ├── src/                        React + Vite + TypeScript (PWA), por módulos (D-04)
│   ├── firebase.json, .firebaserc  solo Hosting
│   ├── .github/workflows/          lint, typecheck, tests, despliegue de Hosting
│   └── docs/                       copia de los docs de producto + arquitectura del front
└── escuelas-back/                  repo grestrepo98/escuelas-back
    ├── functions/                  único paquete npm: Cloud Functions 2nd gen, Node 24, TypeScript
    │   └── src/<módulo>/           domain · application · infrastructure (ADR 0008)
    ├── firebase.json, firestore.rules, storage.rules, firestore.indexes.json
    ├── .github/workflows/          lint, typecheck, tests + emulador, despliegue
    └── docs/                       docs de producto, ADRs y arquitectura del back
```

**Por qué:** independencia real entre las dos partes: despliegue, configuración, versiones e historial propios. Las reglas de negocio (aplicar un abono al cobro más antiguo, calcular el semáforo, C1–C22) viven en `domain`, sin depender de Firebase, y se prueban rápido con Vitest. Como el front nunca ejecuta lógica de negocio (D-03), no necesita importar `domain`.

**Contratos entre front y back:** la fuente de verdad es el back. Define los esquemas zod de entrada y salida de cada callable en su propio código, junto a la callable en `functions/`, y valida cada petición; si la entrada no cumple, falla con `HttpsError('invalid-argument')`. No se publica ningún paquete: el front escribe sus propios tipos y esquemas zod dentro de su adaptador de acceso a datos (D-03), copiados de los del back.

- Flujo: cambio de un esquema en el back → se despliega → el front ajusta su adaptador en su propio PR.
- Cambio incompatible: como los despliegues son independientes, el back mantiene la callable anterior funcionando hasta que el front publique la nueva.
- Costo aceptado: los tipos quedan duplicados y una diferencia entre front y back no se detecta al compilar. Aparece como un error de validación del back, por eso cada callable lleva tests de su contrato y el adaptador del front tiene los suyos. Un cambio de contrato exige dos PRs (uno por repo).

**Firebase compartido:** ambos repos apuntan a los mismos proyectos (`escuelas-deportivas-dev`, `escuelas-deportivas-prod`, D-13). Cada repo despliega solo lo suyo: el front con `--only hosting`; el back con `--only functions,firestore,storage`. Así ninguno pisa al otro.

**Documentación:** los docs transversales (producto, plan técnico, diseño de páginas, ADRs) se **copian en ambos repos**. Para limitar la deriva entre copias: `docs/` en `escuelas-back` es la copia de edición; todo cambio se replica en `escuelas-front/docs/` en la misma sesión de trabajo y ambos commits lo indican.

**Alternativas descartadas:**

- Monorepo con npm workspaces (un solo repo, tipos compartidos sin publicar). Se descarta porque se priorizó la independencia de los dos proyectos sobre la comodidad de compartir código.
- Paquete npm privado publicado (`contracts`) con los esquemas y tipos de las callables: tipos compartidos y verificados al compilar, a cambio de un registro de paquetes, tokens de lectura en el CI del front, versionado y publicación en cada cambio. Se descarta por el costo operativo para un equipo pequeño.

**Decisión:** dos repositorios, `escuelas-front` y `escuelas-back`, en GitHub cuenta personal `grestrepo98`, privados (aún no creados), agrupados en un GitHub Project.

**Actualización (spec 03, 2026-10-04):** dentro de `escuelas-back` ya no hay workspace npm ni `packages/domain`: todo el código vive en `functions/src`, por módulo y con tres capas (ADR 0008).

**Estado:** Acordado.

### D-02 · Arquitectura hexagonal en el backend

**Propuesta:** `domain` define puertos (`PaymentRepository`, `Clock`, `ReceiptNumberGenerator`, y más adelante `PaymentProvider` e `InvoicingProvider`, D-18 y D-19) y casos de uso. Cada puerto se crea en la fase que lo necesita; la Fase 0 solo crea los de membresía y bitácora. `functions` implementa los adaptadores con Firestore y expone los casos de uso como callable functions. Ambos viven en el repo `escuelas-back` (D-01).

**Por qué:** Firestore es una decisión de infraestructura, no de negocio. Si más adelante una parte necesita otra base de datos (por ejemplo reportes en BigQuery), el dominio no cambia. Además permite TDD estricto sin emulador en la mayoría de los tests.

**Alternativa:** escribir la lógica directamente dentro de cada function. Más rápido al inicio, pero las reglas del dinero quedan atadas al SDK y son más difíciles de probar.

**Decisión:** hexagonal en el backend. Requisito adicional: el proyecto lleva **documentación pensada para que un desarrollador nuevo lo entienda**. Mínimo: un `README` por paquete, un documento de arquitectura (capas, puertos y adaptadores, flujo de un caso de uso de punta a punta), una guía de cómo agregar un caso de uso o un adaptador, y registro de decisiones de arquitectura (ADR) para las decisiones de este documento. La documentación se escribe junto con el código, no al final.

**Actualización (spec 03, 2026-10-04):** `domain` deja de ser un paquete aparte. Cada módulo de `functions/src` tiene `domain` (reglas puras), `application` (casos de uso y puertos) e `infrastructure` (adaptadores Firestore y callables). La frontera la verifica ESLint y la prueba un test (ADR 0008).

**Estado:** Acordado.

### D-03 · Modelo híbrido de lectura y escritura

**Propuesta:**

- **Lecturas** desde el cliente con el SDK de Firestore, protegidas por Security Rules (tiempo real, soporte offline gratis).
- **Escrituras sensibles** solo por Cloud Functions callable: pagos, efectivo, recibos, cierres de caja, anulaciones, becas, cambios de rol y bitácora. Las rules niegan escritura directa del cliente en esas colecciones.
- **Escrituras simples** (por ejemplo marcar asistencia) pueden ir directas si las rules las validan.

**Por qué:** los principios 3 y 4 de producto (cada peso deja rastro, nada se borra) no se pueden garantizar si el cliente escribe pagos directamente: cualquier coordinador con las herramientas del navegador podría saltarse la validación. La function es el único punto que escribe el movimiento y su bitácora en una misma transacción.

**Alternativa:** todo por functions (más simple de razonar, pero perdemos tiempo real y offline en lecturas) o todo directo con rules (más rápido, pero las reglas complejas se vuelven inmanejables).

**Qué es una callable:** un tipo de Cloud Function (`onCall`) que funciona como endpoint del backend. El front la invoca con el SDK (`httpsCallable`), Firebase adjunta y verifica el token del usuario (`request.auth.uid` llega ya validado), serializa la entrada y la salida en JSON y estandariza los errores (`HttpsError`). La alternativa, `onRequest`, es una function HTTP común donde CORS, token y formato corren por nuestra cuenta.

**Decisión:** el producto no necesita tiempo real, así que **todo pasa por Cloud Functions callable, lecturas y escrituras**. El cliente no accede a Firestore directamente. Consecuencias aceptadas:

- Las Security Rules arrancan en modo "denegar todo" para clientes (`allow read, write: if false`). Los permisos por rol, organización y sede se validan en el backend, en el dominio (D-02). Las rules siguen con sus tests (D-07), incluyendo que el acceso directo del cliente falla.
- Se pierde la caché offline automática de Firestore. La asistencia y el carné (§7.11, §7.12) usan una **caché local propia** (IndexedDB) con la lista del grupo y una cola de sincronización (ver D-12).
- Cada lectura es una invocación: más latencia y costo por invocación. Se mide en el piloto.
- **Puerta abierta:** el front accede a los datos solo a través de una interfaz de acceso a datos (un adaptador), nunca llamando a las functions desde cada pantalla. Si el uso de functions resulta lento, se puede agregar un adaptador de lectura directa a Firestore para esas consultas, escribiendo y probando las rules correspondientes. No cambia el resto de la app.

**Estado:** Acordado.

### D-04 · Front como PWA mobile-first

**Propuesta:** una sola app React instalable (PWA). Pantallas de coordinador, profesor y acudiente diseñadas primero para celular; las del dueño, para computador. Estructura por módulo (screaming architecture: `players/`, `payments/`, `cash-closing/`, `attendance/`) y patrón container-presentational.

**Por qué:** coordinadores, profesores y acudientes usan celular (§6, §9). Una PWA evita tiendas de apps en el piloto, se despliega con Hosting y soporta el modo sin conexión que exige la asistencia (§7.11).

**Alternativa:** app nativa con React Native/Expo. Mejor acceso a cámara y notificaciones, pero duplica trabajo, exige publicar en tiendas y alarga el piloto. Se puede reevaluar después del piloto.

**Estado:** Acordado. PWA alojada en Firebase Hosting.

## 4. Multitenancy y seguridad

### D-05 · Aislamiento por ruta

**Propuesta:** todos los datos de una escuela viven bajo `tenants/{tenantId}/...` (por ejemplo `tenants/{tenantId}/players`, `tenants/{tenantId}/documents`). Ninguna colección de negocio vive en la raíz. Un tenant es un documento más sus subcolecciones dentro de la misma base de datos: **no** es otro proyecto Firebase ni otro despliegue. Un solo frontend y un solo backend sirven a todos los tenants.

**Por qué:** el aislamiento entre escuelas es un requisito legal y comercial (§5, §14). Con la ruta por tenant, el aislamiento queda en la estructura de los datos y todo el subárbol se protege con una sola validación de membresía.

**Alternativa:** colecciones planas con un campo `tenantId` en cada documento. Más flexible para consultas entre tenants, pero un olvido en una consulta filtra datos de una escuela a otra.

**Decisión:** aislamiento por ruta, con `tenants/{tenantId}/...`. En el código y en la base de datos el término es `tenant`; en producto el mismo concepto se llama "organización" o "escuela" (glosario de `producto.md`). Regla de implementación: como todo pasa por functions (D-03), el cliente envía el `tenantId` de la escuela activa, pero la function **nunca lo confía sin validarlo**: lo comprueba contra la membresía activa del usuario (D-06) antes de leer o escribir. Si no existe una membresía activa para ese par usuario y tenant, la llamada falla. Así, cambiar un ID en una petición no da acceso a otra escuela.

**Estado:** Acordado.

### D-06 · Membresías (sin custom claims)

> La propuesta original usaba custom claims; la **Decisión** más abajo la reemplazó y es la que rige.

**Propuesta original (reemplazada):**

- Una persona es un usuario de Firebase Auth. Sus pertenencias viven en `memberships/{uid}_{tenantId}` con rol y alcance (sedes, grupos, hijos).
- El token lleva solo la **organización activa y el rol** en custom claims. Al cambiar de organización, el cliente llama una function que reemite los claims.

**Por qué:** una persona puede estar en varias organizaciones con varios roles (§5, §6). Los custom claims tienen un límite de 1.000 bytes, así que no caben todas las membresías; con solo la activa, el token es pequeño y las rules son baratas.

**Alternativa:** leer la membresía desde Firestore en cada rule (`get()`). Siempre está al día, pero cada lectura cuesta una lectura extra y tiene límite de llamadas por regla.

**Consecuencia a tener en cuenta:** un claim no se invalida solo. Cuando se desactiva a un coordinador (§7.2: "pierde el acceso de inmediato") hay que revocar sus refresh tokens y verificar la membresía activa en las functions sensibles.

**Decisión:** variante sin claims de tenant. Como todo pasa por functions (D-03), **cada function lee `memberships/{uid}_{tenantId}` en cada llamada** y de ahí saca el rol y el alcance (sedes, grupos, hijos). No hay claims de tenant ni de rol, así que no hay claims desactualizados: desactivar una membresía corta el acceso en la siguiente llamada, sin revocar tokens. Costo aceptado: una lectura extra por invocación, barata a la escala del piloto. Si se vuelve un problema de latencia, se puede cachear la membresía por unos segundos o volver a claims.

**Estado:** Acordado.

### D-07 · Security Rules con pruebas desde el día 1

**Propuesta:** cada rule se escribe con tests en el emulador (`@firebase/rules-unit-testing`), incluyendo los casos negativos: otro tenant, otro rol, otra sede, escritura directa en colecciones protegidas.

**Por qué:** las rules son la barrera de seguridad real. Un error aquí es un incidente de datos de menores.

**Decisión:** como el cliente no accede a Firestore ni a Storage por su cuenta (D-03), las rules son una **segunda barrera**. Arrancan en "denegar todo" para clientes, con tests en el emulador que comprueban que un cliente no puede leer ni escribir nada directamente, ni siquiera de su propia organización. Los tests corren en cada pull request (D-16). Cuando se agregue una lectura directa (puerta abierta de D-03), se escriben en ese momento sus rules y los tests de aislamiento por organización, rol y sede.

**Estado:** Acordado.

### D-08 · Archivos en Cloud Storage

**Propuesta:** fotos, comprobantes y pólizas en Cloud Storage for Firebase, ruta `tenants/{tenantId}/...`, con storage rules por tenant y rol. Las imágenes se comprimen en el cliente antes de subir (comprobantes de celular).

**Por qué:** §7.5 y §7.8 piden carga por foto. Los documentos de menores solo los ven roles autorizados (§14).

**Decisión:** subida y descarga con **URLs firmadas** emitidas por functions, coherente con D-03. Flujo de subida:

1. El cliente pide permiso a la function, enviando solo tipo y tamaño del archivo.
2. La function valida membresía y rol (D-06) y devuelve una URL firmada y temporal.
3. El cliente sube el archivo **directo a Cloud Storage**; el archivo nunca pasa por la function, así que su tamaño no depende de los límites de las functions.
4. El cliente avisa a la function, que guarda la ruta en Firestore.

Las descargas se piden también por function, con URL firmada de corta duración. Storage queda en "denegar todo" para clientes (D-07). El cliente comprime las fotos antes de subir, y se limitan tipos y tamaño máximo.

**Pendiente de verificar:** que la cuenta de servicio de las functions tenga el permiso necesario para firmar URLs, y los límites de tamaño que fijemos. Si la URL firmada resulta problemática en el piloto, la alternativa es subir con el SDK de Storage y rules que consulten la membresía en Firestore.

**Estado:** Acordado.

## 5. Modelo de datos inicial

Borrador de colecciones bajo `tenants/{tenantId}/`:

| Colección | Contenido | Notas |
| --- | --- | --- |
| `venues` | Sedes | Cerrar una sede no la borra |
| `categories`, `groups` | Categorías y grupos | Un grupo pertenece a una sola sede |
| `players` | Jugadores | Estado: preinscrito, activo, en mora, pausado, retirado |
| `guardians`, `families` | Acudientes y familias | Pagadores autorizados con documento |
| `documents` | Documentos y pólizas | Archivo en Storage, vigencia y número |
| `concepts`, `rates` | Conceptos y tarifas | Tarifas versionadas por vigencia |
| `charges` | Cuentas por cobrar | Generadas por función programada o manual |
| `paymentAccounts` | Cuentas que reciben el dinero | Una por organización en el piloto; el modelo admite varias (D-18) |
| `payments` | Pagos y comprobantes | Con imputaciones por jugador y concepto y referencia a la cuenta destino |
| `receipts` | Recibos de efectivo | Consecutivo por organización |
| `cashClosings` | Cierres de caja | Aprobación por dueño o auxiliar |
| `attendance` | Asistencia | Por grupo y fecha |
| `auditLog` | Bitácora | Solo creación; rules niegan update y delete |

**Reglas transversales:**

- **Dinero como entero en pesos colombianos**, sin decimales (§14). Nunca `number` con coma flotante.
- **Nada se borra**: un pago anulado genera un movimiento contrario (C7).
- **Tarifas versionadas** para que cambiar un precio no altere cobros pasados (C11).
- **Fechas** guardadas en UTC y mostradas en zona horaria de Bogotá.

**Estado:** Por decidir. Es un borrador; el modelo definitivo de cada colección se cierra al empezar su fase.

## 6. Donde Firestore choca con el producto

Esta es la parte que más conviene negociar, porque cada punto tiene un costo real.

### D-09 · Recibos consecutivos sin saltos

**Problema:** §14 exige recibos numerados y sin saltos por organización. Firestore no tiene secuencias.

**Propuesta:** un documento contador por organización, incrementado dentro de una transacción en la misma function que crea el recibo. Si la transacción falla, el número no se consume.

**Costo:** el contador es un punto de escritura serializado (alrededor de una escritura por segundo sostenida por documento). Con ~100 comprobantes por sede en 10 días no es un problema; sí lo sería con miles por minuto.

**Decisión:** contador por organización en transacción. Es coherente con la decisión de C22 (D-12): el recibo se numera siempre en la nube, al sincronizar.

**Estado:** Acordado.

### D-10 · Búsqueda tolerante a errores de escritura

**Problema:** §7.3 pide encontrar jugadores aunque el nombre esté mal escrito. Firestore no hace búsqueda de texto.

**Propuesta:** en la Fase 1, cargar la lista liviana de jugadores de la organización y buscar en el cliente con un índice en memoria (MiniSearch o Fuse.js). Con 200–500 jugadores es instantáneo y funciona sin conexión.

**Alternativa:** Typesense o Algolia cuando una escuela supere unos miles de jugadores. Se evalúa en F3 de producto.

**Decisión:** dos mecanismos separados, porque resuelven problemas distintos:

1. **Lista paginada** para navegar y filtrar (sede, categoría, estado, mora), con paginación por cursor en la function. Es la pantalla "Jugadores" del dueño.
2. **Índice liviano para buscar:** una function entrega solo los campos de búsqueda de cada jugador (id, nombre, documento, nombre del acudiente, estado). El cliente lo guarda en memoria y busca con MiniSearch o Fuse.js, tolerando errores de escritura. Sirve además para la caché offline del coordinador (D-03, D-12).

La paginación no reemplaza al índice: Firestore solo busca por prefijo exacto y un buscador paginado solo vería la página cargada. Límite: con unos miles de jugadores por escuela el índice se vuelve pesado y se pasa a un buscador de servidor.

**Estado:** Acordado.

### D-11 · Reportes y agregados

**Problema:** el tablero del dueño (recaudo del mes, mora por sede) necesita sumar muchos documentos; Firestore cobra por lectura.

**Propuesta:** consultas de agregación (`count`, `sum`) para totales simples, y contadores precalculados por triggers para lo que se consulta seguido. Exportación a BigQuery solo si los reportes crecen.

**Costo:** los contadores precalculados deben mantenerse consistentes; se prueban con los mismos escenarios del dominio.

**Decisión:** se empieza simple. Primero, **consultas de agregación** (`count`, `sum`) ejecutadas por una function, sin precalcular. Los contadores precalculados con triggers se agregan solo si una consulta del tablero resulta lenta o cara, con tests, porque mantenerlos consistentes con anulaciones y reembolsos es delicado y una cifra desincronizada es peor que una consulta lenta en un sistema de auditoría. BigQuery queda fuera del piloto.

**Estado:** Acordado.

### D-12 · Asistencia sin conexión y efectivo sin conexión

**Propuesta:**

- La **asistencia** usa una caché local propia en IndexedDB y una cola de sincronización, porque el cliente no lee Firestore directamente (D-03). La cola reintenta al recuperar la conexión y debe tolerar duplicados (operaciones idempotentes). Es el punto de mayor riesgo técnico del piloto y merece pruebas propias (§7.11).
- El **efectivo sin conexión** queda como solicitud pendiente con la hora original y no cuenta como registrado hasta sincronizar. Esto es el caso C22 de producto, decidido más abajo.

**Por qué importa:** si el dueño decide que el efectivo debe poder registrarse offline con recibo inmediato, el consecutivo de recibos (D-09) no puede depender de la nube y habría que repensarlo (por ejemplo bloques de números asignados por sede). Necesitamos esa decisión antes de la Fase 2.

**Decisión (C22):** opción (a). El efectivo sin conexión queda pendiente en el celular con la hora original y el recibo numerado se genera al sincronizar. El consecutivo por organización se mantiene estricto (D-09 sigue como está) y no se necesitan bloques de números por sede. Costo aceptado: el acudiente no recibe el recibo en el momento si no hay señal.

**Estado:** Acordado.

### D-18 · Cuentas de recaudo y proveedores de pago

**Propuesta:**

- Una sola cuenta de recaudo por escuela como regla de negocio en el piloto, pero guardada en `paymentAccounts` y referenciada por cada pago. Si otra escuela cobra por sede, no hay migración.
- Los proveedores de pago en línea (F2 de producto) se integran como puerto del dominio, `PaymentProvider`, con un adaptador por proveedor. Cada organización configura cuál usa. La Fase 2 diseña los pagos sin atarse a ninguno.

**Por qué:** la visión es servir a muchas escuelas (§5) y poder integrar varios proveedores (Q5 sigue abierta). Es el mismo patrón hexagonal de D-02.

**Pendiente de confirmar:** que Argentinos Juniors use hoy una sola cuenta y qué datos entrega su extracto (Juan David).

**Estado:** Acordado.

### D-19 · Recibo interno ahora, facturación electrónica después

**Propuesta:**

- **Piloto:** el pago en efectivo genera un **recibo interno** numerado (D-09). No es una factura ni un documento fiscal, y debe decirlo en su texto ("Recibo interno, no válido como factura") para que nadie lo confunda con uno.
- **Después:** un puerto del dominio, `InvoicingProvider`, con un adaptador por servicio de facturación (por ejemplo Siigo), que emita la factura electrónica cuando se registre un pago en efectivo. Mismo patrón que D-02 y D-18.
- El recibo interno guarda un campo opcional de referencia externa (número y enlace de la factura) para enlazarlo cuando exista la integración.

**Por qué:** hoy no sabemos si la escuela está obligada a facturar (Q4; está registrada ante el IDRD como escuela, no como empresa). Construir la integración antes de saberlo sería trabajo posiblemente innecesario, pero dejar el puerto evita rehacer el flujo de pagos.

**Pendiente:** confirmar con el contador del dueño si hay obligación de facturar (Q4) y validar que Siigo ofrezca la integración que necesitamos; no lo he verificado.

**Estado:** Acordado.

## 7. Ambientes y despliegue

### D-13 · Dos proyectos Firebase más emulador local

**Propuesta:**

| Ambiente | Proyecto | Para qué |
| --- | --- | --- |
| Local | Emulator Suite (Auth, Firestore, Functions, Storage) | Desarrollo y tests; no toca la nube |
| `dev` | `escuelas-deportivas-dev` | Integración, demos al dueño con datos de prueba |
| `prod` | `escuelas-deportivas-prod` (por crear) | Piloto real con datos de menores |

`.firebaserc` con alias `dev` y `prod` existe en ambos repos (`escuelas-front` y `escuelas-back`), con los mismos alias. Mientras `prod` no exista, solo está el alias `dev`. Solo `escuelas-back` ejecuta el Emulator Suite; el desarrollo local del front apunta a esos emuladores mediante variables de entorno. La app lee la configuración de variables por ambiente, nunca hardcodeada.

**Por qué el emulador:** no cuenta como tercer proyecto, pero es indispensable para TDD, pruebas de rules y para no gastar cuota en desarrollo.

**Decisión:** se usa el Emulator Suite local (Auth, Firestore, Functions, Storage) para desarrollo, TDD y pruebas de rules, y los tests de GitHub Actions corren contra él. Limitación conocida: el emulador no replica el 100 % de producción (por ejemplo, detalles de permisos de las URLs firmadas de D-08), así que esos casos se prueban también en `dev`.

**Estado:** Acordado.

### D-14 · Región de Firestore (bloqueante)

**Problema:** la ubicación de Firestore **no se puede cambiar** una vez creada la base de datos.

**Decisión:** usar la ubicación que ofrezca la consola de Firebase al crear el proyecto, sin cambiarla. La configura Gustavo.

**Notas:**

- Firebase no tiene una región por defecto fija: la ubicación se elige al crear el proyecto o la base de datos, y la de Firestore depende de la "ubicación de recursos por defecto de Google Cloud", que también se fija una sola vez (Storage la comparte).
- Hay que **fijarla igual en `dev` y en `prod`**, para que el comportamiento y la latencia sean comparables.
- **Tradeoff aceptado:** si la consola ofrece una región de Estados Unidos, la latencia desde Bogotá será mayor que con São Paulo. Es una estimación, no una medición. Con 200–500 jugadores y lecturas con caché offline, no debería notarse en el piloto. Si se mide un problema real, el cambio exige crear una base nueva y migrar los datos.
- Functions debe quedar en la misma región que Firestore para no sumar latencia entre ambos.
- **Estado real en `dev` (verificado el 2026-10-03):** Firestore quedó en `nam5` (multi-región de EE. UU.). Functions se fija en `us-central1`, la región más cercana a `nam5` según la documentación de Firebase. La base de `dev` no tiene protección contra borrado ni recuperación a un punto en el tiempo (PITR); en `prod` se activan antes de cargar datos reales (D-17).

**Estado:** Acordado.

### D-15 · Plan de facturación y presupuesto

**Propuesta:** plan Blaze en ambos proyectos (Cloud Functions lo exige), con alertas de presupuesto en `dev` y `prod`. Para 200–220 jugadores el consumo esperado es bajo, pero las alertas protegen de un bucle o una consulta mal hecha.

**Decisión:** por ahora las cuentas de facturación son de Gustavo y el equipo asume el costo. Cuando el piloto se convierta en suscripción, se revisa si la facturación pasa a otra cuenta. Un proyecto se puede vincular a otra cuenta de facturación más adelante, a diferencia de la región.

**Estado:** Acordado.

### D-16 · CI/CD

**Propuesta:** GitHub Actions.

Dos pipelines independientes, uno por repo:

- **`escuelas-front`:** en pull request, lint, typecheck y tests; al hacer merge a `main`, despliega Hosting a `dev`; con tag de versión, despliega a `prod` con aprobación manual.- **`escuelas-back`:** en pull request, lint, typecheck, tests de dominio y tests de rules en emulador; al subir cambios a la rama `dev`, despliega functions y rules al proyecto `dev` (el ambiente `dev` refleja la rama `dev`); con tag de versión, despliega a `prod` con aprobación manual.
**Decisión:** se usarán GitHub Actions y se ejecutan cuando Gustavo sube cambios al repositorio. Quedan por definir los detalles: qué evento despliega a `prod` y cómo se autentica Actions contra Firebase (service account o federación de identidad).

**Estado:** Acordado en lo general; detalles por decidir.

### D-17 · Respaldo y monitoreo

**Propuesta:**

- Exportación programada de Firestore a un bucket de Cloud Storage en `prod` (requisito de §14 "respaldo y conservación"), y restauración probada al menos una vez.
- Cloud Logging y alertas de error en Functions; Sentry (u otro) en el front.

**Decisión:** respaldo diario de Firestore a un bucket en `prod`, restauración probada al menos una vez antes de abrir el piloto, y monitoreo con Cloud Logging, alertas de error y Sentry en el front. La conservación se separa por tipo de dato:

1. **Registros financieros** (pagos, recibos, cierres de caja, bitácora): la aplicación nunca los borra. Se conservan al menos 10 años (Ley 962 de 2005, art. 28, según las fuentes consultadas).
2. **Datos personales de menores** (fotos, documentos de identidad, datos médicos): se pueden eliminar cuando el acudiente lo pida (Ley 1581 de 2012). Los registros financieros se conservan, pero el jugador queda anonimizado en ellos.
3. **Respaldos:** sin borrado automático por ahora. La retención se fija cuando responda la asesoría legal.

**Pendiente de validar con el abogado y el contador (Q4, Q12):** si el plazo de 10 años aplica a una escuela registrada ante el IDRD y no como empresa, y cómo se atiende una solicitud de supresión que llegue a los respaldos. Esto no es asesoría legal.

**Estado:** Acordado.

## 8. Calidad y forma de trabajo

**Propuesta:** TDD estricto.

| Capa | Herramienta | Qué prueba |
| --- | --- | --- |
| `domain` | Vitest | Reglas de negocio y casos borde C1–C22 |
| `functions` | Vitest + emulador | Casos de uso con Firestore real local |
| Rules | `@firebase/rules-unit-testing` | Aislamiento por organización, rol y sede |
| Front | Vitest + Testing Library | Comportamiento de pantallas |
| E2E | Playwright | Flujos 10.3 (comprobante), 10.5 (efectivo y cierre), 10.7 (asistencia) |

Commits con convención conventional commits. Cada fase termina con sus tests en verde y un despliegue a `dev` que podamos ver.

**Decisión:** TDD como práctica de trabajo, con estas herramientas. Aplica de forma estricta en `domain` y `functions`; en la interfaz visual y la configuración de Firebase los tests son sobre todo una red de seguridad.

**Estado:** Acordado.

## 9. Fases técnicas

La F1 de producto es grande (15 módulos). La partimos en tres entregas que se pueden ver y llenar con datos reales. Proponemos además una fase previa de cimientos.

```
Fase 0 técnica  →  Fase 1  →  Fase 2  →  Fase 3
Cimientos          Estructura   Dinero     Cancha y control
                   y jugadores
                                                  ↓
                                   Puerta de salida de F1 de producto
```

### Fase 0 técnica · Cimientos (propuesta nueva)

- **Objetivo:** dejar listo todo lo que no se ve pero que cualquier módulo necesita.
- **Incluye:** los dos repositorios git (`escuelas-front` y `escuelas-back`), los dos proyectos Firebase, CI/CD, Authentication, membresías (sin claims, D-06), rules base con sus tests, bitácora base, y la app con inicio de sesión y selector de escuela/rol.
- **Entregable visible:** login real en `dev` y un tenant de prueba (una escuela de prueba).
- **Listo cuando:** un usuario de otra organización no puede leer nada de la primera (probado), y un cambio de rol queda en la bitácora.

### Fase 1 · Estructura y jugadores ("llenar la app")

- **Módulos:** §7.1 sedes y estructura, §7.2 usuarios y roles, §7.3 jugadores e inscripción, §7.4 acudientes, §7.5 documentos y pólizas, §7.18 importación asistida, §7.19 administración mínima.
- **Entregable visible:** Argentinos Juniors cargado con sedes, grupos, jugadores, acudientes y pólizas. Búsqueda tolerante a errores y ficha del jugador. La póliza de un jugador aparece en menos de un minuto (D7).
- **Importación:** un script con Admin SDK que lee las hojas de Excel, muestra vista previa y reporte de errores y duplicados antes de confirmar.
- **Listo cuando:** el dueño revisa la base migrada y confirma que representa a sus jugadores reales.

### Fase 2 · Dinero

- **Módulos:** §7.6 conceptos y tarifas, §7.7 cuentas por cobrar, §7.8 pagos con comprobante, §7.9 efectivo, recibos y cierre de caja, §7.15 notificaciones de recibo.
- **Entregable visible:** un ciclo de cobro completo en `dev` y luego en `prod`: cobros generados, comprobantes en cola de validación, efectivo con recibo consecutivo y cierre de caja aprobado por el dueño.
- **Listo cuando:** todo el efectivo registrado tiene recibo y entra a un cierre; el estado de cuenta de un jugador se ve en menos de 15 segundos.
- **Bloqueado por:** C9 y C14 (reglas configurables de prorrateo y descuentos). Q3 (mora) y C22 (efectivo sin conexión) ya están decididos.

### Fase 3 · Cancha y control

- **Módulos:** §7.11 asistencia sin conexión, §7.12 carné digital con QR, §7.16 reportes, §7.17 bitácora completa y filtrable, tablero del dueño.
- **Entregable visible:** el profesor toma asistencia o escanea el carné y ve el semáforo; el dueño audita las 4 sedes desde el tablero.
- **Listo cuando:** se cumple la puerta de salida de F1 de producto (§11): las 4 sedes operan un ciclo de cobro completo y el dueño cuadra caja y mora sin Excel.
- **Endurecimiento antes de abrir `prod` a las 4 sedes** (se reparte aquí en lugar de una fase propia): pruebas de carga con los picos de los primeros 10 días del mes (~100 comprobantes por sede), simulacro de restauración de un respaldo (D-17), y revisión de seguridad (rules en "denegar todo", aislamiento entre organizaciones, URLs firmadas).

### Después

Pasarela de pagos, conciliación bancaria, inventario, torneos, recordatorios y alertas (F2 de producto); autoservicio y suscripciones (F3); módulo deportivo (F4). Se planean en un documento posterior, cuando termine el piloto.

### Cobertura de módulos F1

| Módulo de producto | Fase técnica |
| --- | --- |
| 7.1 Organización, sedes y estructura | Fase 1 |
| 7.2 Usuarios, roles y accesos | Fase 0 (base) y Fase 1 |
| 7.3 Jugadores e inscripción | Fase 1 |
| 7.4 Acudientes y familias | Fase 1 |
| 7.5 Documentos y pólizas | Fase 1 |
| 7.6 Conceptos, tarifas, descuentos y becas | Fase 2 |
| 7.7 Cuentas por cobrar | Fase 2 |
| 7.8 Pagos (comprobante) | Fase 2 |
| 7.9 Efectivo, recibos y cierre de caja | Fase 2 |
| 7.11 Asistencia | Fase 3 |
| 7.12 Carné digital | Fase 3 |
| 7.15 Notificaciones (recibos) | Fase 2 |
| 7.16 Reportes | Fase 3 |
| 7.17 Bitácora | Fase 0 (base) y Fase 3 |
| 7.18 Importación asistida | Fase 1 |
| 7.19 Administración de plataforma (mínimo) | Fase 1 |

## 10. Cosas que faltan por crear o negociar

Respuesta directa a tu pregunta. Ordenadas por urgencia.

**Bloquean el arranque técnico:**

1. ~~**Repositorio git**~~ Decidido (D-01): dos repos privados, `grestrepo98/escuelas-front` y `grestrepo98/escuelas-back`, en un GitHub Project. Faltan crearlos.
2. ~~**Región de Firestore** (D-14)~~ Resuelto: la que ofrezca la consola, igual en `dev` y `prod`.
3. ~~**Cuenta de facturación de Google Cloud** (D-15)~~ Resuelto: cuenta de Gustavo, costo asumido por el equipo.
4. ~~**Nombre del producto** (Q14)~~ Resuelto parcialmente: el proyecto de desarrollo es `escuelas-deportivas-dev` (ya creado) y el de producción se llamará `escuelas-deportivas-prod` (por crear). El nombre comercial y el dominio siguen abiertos (Q14). Los IDs de proyecto son globales y únicos: si el de `prod` está tomado, Firebase propone un sufijo y hay que actualizar `.firebaserc`.

**Bloquean el diseño de una fase:**

5. ~~**Q3, mora**~~ Resuelto por ahora: solo **alerta**, no bloquea la asistencia. La asistencia de un jugador en mora se registra igual, marcada. Los días de gracia siguen configurables por escuela. Conviene dejar la política como configuración (`alertar` / `bloquear`) para poder cambiarla sin desarrollo nuevo.
6. ~~**C22, efectivo sin conexión**~~ Resuelto: pendiente hasta sincronizar, recibo al sincronizar (D-12).
7. ~~**Q7, cuentas bancarias**~~ Resuelto (D-18): una cuenta por escuela, modelo preparado para varias. Falta confirmar con Juan David que sea así hoy.
8. ~~**Q9, confirmación del recibo**~~ Resuelto: el acudiente solo **ve** el recibo en su perfil; no hay confirmación. El recibo numerado ya deja el rastro.
9. **C9 y C14:** C9 (ingreso a mitad de mes) queda **provisional en prorrateo según los días restantes**, y se registró como Q15 en `producto.md` para hablarlo después. C14 (mezcla de descuentos y becas) **se pospone**: no se decide ahora. Opciones evaluadas: (a) gana el mayor (recomendada), (b) se suman con tope, (c) no se mezclan. Hasta decidir, la Fase 2 no implementa acumulación: un jugador tiene un solo beneficio activo. Como C9 es configurable por escuela, el prorrateo se implementa como política y no como regla fija.
10. **Q8, pólizas:** se deja como pregunta abierta en `producto.md` para discutirla con el equipo. Mientras tanto, la Fase 1 usa los campos que ya define §7.5 (número, aseguradora, vigencia, archivo) y se difiere el formato de exportación para la liga, que no bloquea la Fase 1.

**Por negociar (no de producto):**

11. ~~**PWA o nativa** (D-04)~~ Resuelto: PWA en Firebase Hosting.
12. **Canal de mensajes** (Q11): correo para invitaciones y recibos (por ejemplo con Resend) desde el inicio; WhatsApp u otros después, por su costo y aprobación de plantillas.
13. **Recibo en PDF:** generarlo en una function y guardarlo en Storage, o solo mostrarlo en pantalla. Decisión de forma. El recibo es interno, no factura (D-19).
14. **Asesoría legal** (Q12): datos de menores bajo la Ley 1581 de 2012 y quién tiene acceso a `prod`. Antes de cargar datos reales.
15. **Quién accede a `prod`** y cómo se manejan secretos y cuentas de servicio.

**Fases:** se agrega la Fase 0 técnica (cimientos). Las tareas de endurecimiento (pruebas de carga, simulacro de restauración y revisión de seguridad) **no son una fase aparte**: se reparten como criterios de "listo" de la Fase 3.

## 11. Próximos pasos

1. Revisar este documento juntos y marcar cada decisión como `Acordado` o ajustarla.
2. Resolver los puntos 1 a 4 de la sección 10 para poder arrancar.
3. Empezar la Fase 0 técnica con TDD.
