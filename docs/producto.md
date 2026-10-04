# Documento de Producto — Plataforma de Escuelas Deportivas

Oct 1, 2026 · @Gustavo Restrepo

## 1. Resumen ejecutivo

Construiremos una plataforma web y móvil, multitenant, que le da al dueño de una escuela deportiva control total sobre quién entra, quién paga y cuánto dinero se mueve en cada sede. El primer cliente y piloto es Argentinos Juniors (Bogotá, 4 sedes, 200–220 jugadores), pero el producto nace para servir a muchas escuelas y academias de cualquier deporte.

**El problema.** Los dueños administran con carpetas de Drive y Excel, reciben unos 100 comprobantes de pago por sede entre el día 1 y el 10 de cada mes, no pueden saber quién pagó cuando transfiere un tercero, y pierden dinero en efectivo que nadie registra. Las aplicaciones del mercado (por ejemplo Train and Play, unos 10 millones de pesos en 11–12 meses) están pensadas para los padres: red social, boletines y estadísticas. No resuelven la administración.

**La propuesta.** Una herramienta pensada para el dueño, no para el padre. Cada jugador existe en el sistema o no entra; cada pago, en efectivo o digital, queda registrado con responsable, fecha y sede; el dueño cruza ingresos contra jugadores activos y detecta diferencias sin revisar 50 carpetas.

**Cómo se construye.** Por fases, empezando por el control administrativo y financiero. Lo deportivo (evaluaciones, partidos, video con inteligencia artificial) llega después, porque no es el dolor por el que el dueño pagaría (reunión del 24 de septiembre de 2026). El plan completo está en la sección 11.

**Lo que la app no resuelve sola.** Si el personal que maneja dinero es deshonesto, ninguna app basta; la plataforma debe acompañarse de auditoría interna y de una política clara sobre quién recibe efectivo (reunión del 10 de septiembre de 2026).

## 2. Contexto y dolores

Se identificaron 14 dolores en dos reuniones (10 y 24 de septiembre de 2026). Todos son del dueño o del coordinador, ninguno del padre de familia. Cada uno se rastrea en la matriz de la sección 12.

| # | Dolor | Evidencia en las reuniones | Reunión |
| --- | --- | --- | --- |
| D1 | Efectivo sin control | Profesores y coordinadores reciben efectivo sin facturar ni registrar; el dueño no sabe cuánto entró. Un coordinador podría inscribir un jugador, cobrar matrícula y torneo en efectivo y no reportar nada. | 10 y 24 sep |
| D2 | Transferencias anónimas | El extracto de Caja Social solo muestra "pago por QR", valor y documento. Paga un tío, un primo o un abuelo y no se sabe a qué jugador corresponde. Se repite el valor 157.500 en muchos pagos del mismo día. | 10 y 24 sep |
| D3 | Conciliación manual | Entre el día 1 y el 10, cada coordinador recibe cerca de 100 comprobantes por WhatsApp, los registra a mano, los marca "aprobado" y el dueño los cruza con el extracto en Excel. | 24 sep |
| D4 | Comprobantes dispersos por WhatsApp | Hay una línea por sede más una general (Club, Suba, Puente Aranda, Cedritos, Rafael Uribe). Las familias envían al número equivocado, reenvían sin indicar sede ni jugador. | 24 sep |
| D5 | Jugadores que no existen en el sistema | Un jugador puede entrenar, recibir uniforme y competir sin estar registrado. El dueño no conoce cuántos jugadores reales tiene, sobre todo en sedes nuevas como Alianza. | 24 sep |
| D6 | Sin control de asistencia ni de acceso | Entra cualquiera. El carné con sello mensual fue falsificado. Niños con mensualidad vencida siguen entrenando; un profesor puede decir "páguelo en dos meses" o cobrar 20.000 por todo el mes. | 10 sep |
| D7 | Pólizas inencontrables | La liga exige una póliza por jugador. Un domingo a las 4 p.m. piden el carné de un jugador y hay que buscarlo entre unos 200 documentos. | 10 y 24 sep |
| D8 | Datos dispersos | Todo vive en carpetas de Drive ("50.000 carpetas") y matrices de Excel. Buscar un cliente es lento y un nombre mal escrito lo hace desaparecer. | 10 sep |
| D9 | Tarifas con muchas variables | Matrícula de 175.000; mensualidad de unos 150.000–157.500 según categoría; descuentos por parentesco o amistad; planes semestrales; becas del 10, 20, 50, 80 o 100 %. Llevarlo en Excel es "tortuoso". | 10 y 24 sep |
| D10 | Cobros distintos a la mensualidad | Uniformes (2 por jugador; 3–4 en categorías de liga), matrícula, pólizas, unos 4 torneos al año, traslados a eventos nacionales (por ejemplo viajes a Pereira). | 10 y 24 sep |
| D11 | Sin inventario | Balones, petos y conos se "pierden" y nadie responde. Uniformes entregados sin registro. | 10 sep |
| D12 | Saber quién debe | El dueño no puede ver rápido si un jugador debe mensualidad o el torneo de liga. | 24 sep |
| D13 | Operación remota | El dueño vive en Pereira y administra 4 sedes en Bogotá; visita cada 3 meses. Depende de lo que le reporten los coordinadores. | 24 sep |
| D14 | Apps actuales no sirven al dueño | Train and Play: red social, boletines, sin botón ni enlace de pago, el comprobante se sube como pantallazo. Costó unos 10 millones en 11–12 meses. | 10 y 24 sep |

**Datos de operación del piloto.** Aprox. 200–220 jugadores activos, 4 sedes, un coordinador por sede y entre 4 y 5 profesores por sede. Cerca de 70 % de los jugadores paga en los primeros 10 días del mes. Hay unos 10 jugadores de 200 que piden pagar en efectivo, principalmente adultos mayores (estimación del dueño; está pendiente la cifra exacta por sede).

**Aclaración de contexto legal.** Las escuelas están registradas ante el IDRD como escuelas deportivas, no como empresas, porque lo exige el uso de escenarios públicos. Falta confirmar si requieren facturación electrónica.

**Advertencia del equipo.** Sebastián y Gustavo coincidieron en que la app no corrige la deshonestidad. Michael lo matizó: el problema principal hoy es que el dueño no tiene los datos de ingresos ni de jugadores habilitados para cruzarlos; con ambos números, un faltante se vuelve evidente.

## 3. Usuarios objetivo y mercado

El cliente que paga es el dueño o administrador de la escuela, no el padre de familia. Así lo definieron Juan David y el equipo el 24 de septiembre de 2026: la prioridad es resolver su dolor, y lo demás se suma después.

**Cliente ideal.** Escuelas de formación deportiva aficionadas o recreativas, en crecimiento, con 2 o más sedes, entre 100 y 500 jugadores, y un dueño que no puede estar presente en todas las sedes. No son clubes profesionales (Millonarios, Santa Fe, Inter de Bogotá, Fortaleza), que ya tienen personal contable y otra metodología.

**Cliente piloto.** Argentinos Juniors, Bogotá. El dueño tiene 26–27 años, es abierto a la tecnología, está dispuesto a probar el software y a compartir su base de datos, y conoce el gremio, lo que abre la puerta a más escuelas. Segundo candidato: Alianza Sport (en proceso de implementación con el mismo dueño; tiene sitio web y pago por botón o QR).

**Mercado a mediano plazo.** Cualquier academia con mensualidades, sedes y personal que cobra: fútbol, microfútbol, fútbol salón, baloncesto, voleibol, baile y salsa. Ambos socios del negocio coinciden en que el problema administrativo es el mismo en todas.

**Usuarios finales dentro de una escuela.**

- Dueño o administrador: toma decisiones y audita. Usa principalmente computador.
- Coordinador de sede: opera el día a día, recibe pagos y comprobantes. Usa celular.
- Profesor: toma asistencia en la cancha. Usa celular, a veces con mala conexión.
- Acudiente: paga y consulta. Muy variable en destreza digital (desde padres que pagan por llave hasta abuelos que solo manejan efectivo).

**Quién no es el cliente.** El padre de familia no decide la compra. Si se quita una app, el padre sigue pagando (testimonio del dueño sobre Train and Play). Por eso las funciones para padres son un medio para que el dato llegue completo, no el motivo de la compra.

## 4. Principios de producto

Diez principios guían cada decisión de diseño. Cuando dos requisitos choquen, gana el que respete el principio de número más bajo.

1. **El cliente es el dueño.** Cada función debe darle control, claridad o ahorro de tiempo al dueño. Lo que solo ayuda al padre se pospone.
2. **Si no está en la app, no existe.** Un jugador sin perfil no se inscribe en asistencia, no recibe carné, no entra a torneo y no recibe uniforme. Así se obliga a que todo jugador exista en la base de datos (idea de Juan David, 24 de septiembre).
3. **Cada peso deja rastro.** Todo pago registra quién lo recibió, cuándo, en qué sede, por qué medio y a nombre de qué jugador. Sin pago anónimo.
4. **Nada se borra, se anula con motivo.** Cualquier corrección queda en una bitácora que ni el dueño puede alterar, para que la auditoría sea confiable.
5. **El efectivo se permite, pero se audita.** No se prohíbe (hay familias que no pueden o no quieren pagar digital), pero cada billete debe registrarse, generar recibo y cerrarse en una caja que el dueño pueda cuadrar.
6. **Fricción mínima para quien paga.** Flexibilidad máxima en medios y fechas; el negocio depende de captar y retener más jugadores (Michael y Gustavo, 10 de septiembre). Las reglas de orden se aplican por política de cada escuela, no por obligación del producto.
7. **Los datos hacen el trabajo, no la confianza.** El sistema cruza ingresos, jugadores activos y asistencia para mostrar diferencias sin depender de que alguien reporte.
8. **Simple para el coordinador y el profesor.** Si registrar un pago o tomar asistencia toma más tiempo que hacerlo en papel, no lo usarán. Pensado para celular y con poca conectividad.
9. **Un solo canal oficial con las familias.** Un único punto de pago y de comprobante por escuela, en lugar de una línea de WhatsApp por sede.
10. **Configurable, no a la medida.** Cada escuela ajusta nombres, tarifas, medios de pago y políticas desde configuración, sin desarrollo nuevo. Un producto que se adapta, no cinco productos.

**Lo que explícitamente no es.** No es una red social, no es una app de rendimiento deportivo para padres y no es un sistema contable completo. Es el sistema de control operativo y de recaudo de la escuela.

## 5. Modelo multitenant

Una sola plataforma sirve a muchas escuelas, y cada escuela vive en su propio espacio aislado: nadie de otra organización puede ver sus jugadores, pagos ni documentos.

> **Diagrama:** modelo multitenant · plataforma, dos organizaciones y una persona con dos roles. Se ve dibujado en el documento compartido (Claude Doc).

La plataforma solo administra organizaciones, planes y facturación. Cada organización gestiona su propia estructura, configuración y datos. Argentinos Juniors es la organización del piloto.

**Qué se configura por organización.**

- Deportes o programas, y los nombres que usa (categoría, nivel, grupo).
- Conceptos, tarifas, planes, descuentos y becas.
- Medios de pago aceptados y cuenta que recibe el dinero.
- Política de efectivo (quién lo recibe y en qué fechas), política de mora y ciclo de cobro.
- Calendario de temporada y pausas, por ejemplo diciembre–enero.
- Documentos que se piden al inscribir, como la póliza.
- Plantillas de mensajes y marca (logo y colores, desde F3).

**Reglas de aislamiento y pertenencia.**

- Los datos de una organización nunca aparecen en otra, ni en búsquedas, reportes ni exportaciones.
- Una misma persona puede estar en varias organizaciones con roles distintos. Al entrar elige con cuál trabaja, y solo ve lo de esa organización.
- Los roles y permisos de la sección 6 se aplican dentro de cada organización; un dueño lo es solo de la suya.
- El equipo de la plataforma no ve jugadores ni pagos de una escuela sin autorización del dueño.

**Ciclo de vida de una organización.**

1. Alta: el equipo crea la organización y a su dueño (F1); en F3 la escuela se da de alta sola.
2. Configuración inicial guiada: sedes, categorías, tarifas, usuarios y políticas.
3. Carga de datos desde las hojas de cálculo y carpetas actuales.
4. Operación con un plan según jugadores activos (sección 15).
5. Suspensión por falta de pago: se conservan los datos y se permite consultar y exportar, pero no registrar movimientos nuevos (propuesta).
6. Baja: la escuela recibe una copia completa de sus datos. Cuánto tiempo se conservan en la plataforma está por definir (pregunta Q12).

**Qué es igual para todas y qué cambia.** Son iguales los módulos, las pantallas y las reglas de seguridad. Cambian los nombres, las tarifas, las políticas y la marca. Si una escuela necesita algo que no se puede configurar, se evalúa como mejora del producto para todas, no como desarrollo a la medida.

## 6. Tipos de usuario y permisos

Hay 8 roles. Cada permiso se limita por organización y, cuando aplica, por sede, grupo o hijo. El profesor nunca maneja dinero, y quien registra un pago no es quien aprueba su cierre.

| Rol | Quién es | Alcance | Dispositivo principal |
| --- | --- | --- | --- |
| Super administrador de plataforma | Equipo del producto | Todas las organizaciones (solo gestión y facturación de la suscripción) | Computador |
| Soporte de plataforma | Equipo del producto | Una organización, solo con autorización del dueño y con bitácora | Computador |
| Dueño o administrador | Juan David | Toda su organización y todas sus sedes | Computador y celular |
| Auxiliar administrativo o contable | Persona de confianza del dueño (opcional) | Toda la organización, sin configuración ni anulaciones | Computador |
| Coordinador de sede | Responsable de una sede | Solo su sede | Celular |
| Profesor o entrenador | Quien dicta los entrenamientos | Solo sus grupos | Celular |
| Acudiente | Padre, madre, abuelo, tío que paga | Solo sus hijos o representados | Celular |
| Jugador adulto | Jugador mayor de edad | Solo su propio perfil (equivale a acudiente de sí mismo) | Celular |

**Matriz de permisos.** V = ver, C = crear, E = editar, A = anular con motivo, P = aprobar. (s) = solo su sede, (g) = solo sus grupos, (h) = solo sus hijos. Una celda vacía significa sin acceso. El Super administrador de plataforma no aparece porque no ve datos de jugadores ni pagos; solo gestiona organizaciones, planes y su facturación.

| Módulo | Dueño | Auxiliar | Coordinador | Profesor | Acudiente |
| --- | --- | --- | --- | --- | --- |
| Sedes, categorías, grupos y configuración | V C E A | V | V (s) | V (g) |  |
| Usuarios y roles | V C E A | V | V (s) |  |  |
| Jugadores e inscripción | V C E A P | V C E | V C E (s) | V (g) | V E (h) |
| Documentos y pólizas | V C E A | V C E | V C E (s) | V (g) | V C (h) |
| Tarifas, descuentos y becas | V C E A P | V | V |  | V (h) |
| Cuentas por cobrar y estado de cuenta | V C E A P | V C E | V C (s) | V semáforo (g) | V (h) |
| Pagos en efectivo y recibos | V A P | V | V C (s) |  | V (h) |
| Validación de comprobantes | V P | V P | V P (s) |  | C (h) |
| Cierre de caja | V P | V P | C (s) |  |  |
| Conciliación bancaria | V C P | V C P |  |  |  |
| Anulaciones y reembolsos | V A P | V solicita | V solicita (s) |  |  |
| Asistencia | V | V | V E (s) | C (g) | V (h) |
| Inventario y uniformes | V C E A | V | V C E (s) | V solicita (g) |  |
| Torneos y eventos | V C E A | V C E | V C (s) | V (g) | V pagar (h) |
| Reportes y auditoría | V | V financiero | V limitado (s) |  |  |
| Bitácora de auditoría | V | V |  |  |  |

**Reglas de separación de funciones.**

- El coordinador registra el efectivo y cierra su caja, pero no aprueba su propio cierre ni anula un pago. Solo el dueño o el auxiliar aprueban.
- Solo el dueño anula o reembolsa. El coordinador puede solicitarlo con motivo.
- El profesor ve el estado de pago de sus jugadores como semáforo (al día, en mora, sin registrar) y toma asistencia. No recibe dinero, no ve montos ni datos bancarios (criterio de Sebastián del 10 de septiembre).
- Una misma persona puede tener varios roles en una o varias organizaciones, por ejemplo un profesor que también es acudiente, o un acudiente con hijos en dos escuelas. El sistema le pide elegir con qué organización y rol trabaja.
- El soporte de plataforma solo entra a una organización si el dueño lo autoriza, por un tiempo limitado, y todo queda en la bitácora.

## 7. Módulos funcionales

La plataforma tiene 20 módulos. Cada uno lleva la fase en que se entrega (F1 a F4, definidas en la sección 11). Los módulos 7.1 a 7.10 están aquí y los 7.11 a 7.20 continúan debajo.

### 7.1 Organización, sedes y estructura deportiva (F1)

- **Objetivo:** reflejar cómo está armada la escuela.
- **Incluye:** ficha de la organización (nombre, registro ante el IDRD, contacto, logo); sedes con dirección, escenario, horarios y coordinador responsable; deportes o programas; categorías (por año de nacimiento o nivel, por ejemplo sub 15 o 2014); grupos con horario y profesor; calendario de temporada con pausas (por ejemplo diciembre–enero).
- **Reglas:** un grupo pertenece a una sola sede; los nombres de categoría son configurables; cerrar una sede conserva su historial.

### 7.2 Usuarios, roles y accesos (F1)

- **Objetivo:** que cada persona vea y haga solo lo que le corresponde.
- **Incluye:** invitación por correo o celular; asignación de rol y alcance (sedes, grupos); activación y desactivación; inicio de sesión y recuperación de acceso; un mismo usuario en varias organizaciones.
- **Reglas:** desactivar a alguien no borra su historial; un coordinador que sale pierde el acceso de inmediato; todo cambio de rol queda en la bitácora.

### 7.3 Jugadores e inscripción (F1)

- **Objetivo:** que todo jugador exista en el sistema desde el primer día.
- **Incluye:** ficha con nombres, documento, fecha de nacimiento, foto, contacto de emergencia y datos médicos básicos; estado (preinscrito, activo, en mora, pausado, retirado); sede, categoría, grupo y fecha de ingreso; historial de movimientos; búsqueda por nombre, documento o acudiente que tolera errores de escritura; detección de duplicados; inscripción en pocos pasos hecha por el coordinador o por el acudiente con aprobación.
- **Reglas:** un jugador activo exige un acudiente responsable; al inscribir se genera la matrícula pendiente; sin perfil no hay asistencia, carné, torneo ni uniforme.

### 7.4 Acudientes y familias (F1)

- **Objetivo:** saber quién responde por cada jugador y quién paga.
- **Incluye:** uno o varios acudientes por jugador con parentesco; responsable de pago; otras personas autorizadas a pagar (tío, abuelo) con su documento; hermanos agrupados en una familia con una sola cuenta; contacto preferido.
- **Reglas:** un pago de tercero se asocia al jugador por la referencia del pago, no por el nombre de quien paga.

### 7.5 Documentos y pólizas (F1)

- **Objetivo:** encontrar la póliza de cualquier jugador en segundos, incluso un domingo en la tarde.
- **Incluye:** tipos de documento configurables (documento de identidad, póliza, autorización de datos, certificado médico); carga por foto; póliza por jugador con número, aseguradora y vigencia; alertas de vencimiento; vista rápida para partido; listado de pólizas por categoría, exportable para inscribir equipos en la liga.
- **Reglas:** una póliza vencida marca al jugador con alerta; los documentos solo los ven roles autorizados.

### 7.6 Conceptos, tarifas, descuentos y becas (F1)

- **Objetivo:** modelar sin Excel toda la variedad de cobros de la escuela.
- **Incluye:** catálogo de conceptos (matrícula, mensualidad, plan semestral, uniforme, póliza, torneo, traslado, otros); valor por sede, categoría y vigencia; descuentos por porcentaje o valor (parentesco, convenio, hermanos); becas del 10 al 100 % con motivo; planes (mensual, semestral); cobro a una categoría completa o a un jugador.
- **Reglas:** el histórico de tarifas se conserva, así que cambiar un precio no altera cobros pasados; si descuentos y becas se acumulan lo define cada escuela; toda beca requiere motivo y aprobación del dueño.

### 7.7 Cuentas por cobrar y estado de cuenta (F1)

- **Objetivo:** responder en segundos "¿este jugador debe algo?".
- **Incluye:** cobros automáticos de la mensualidad según el plan; cobros manuales (uniforme, torneo); estado de cuenta por jugador y por familia con saldo; abonos; cartera por vencer y vencida; semáforo (al día, por vencer, en mora); listado de morosos por sede.
- **Reglas:** el ciclo de cobro es configurable, ya sea mes calendario o desde la fecha de ingreso (Sebastián propuso cortes los días 15 y 30 para ordenar el recaudo); los días de gracia antes de la mora son configurables.

### 7.8 Pagos: comprobante y pago digital (F1 comprobante, F2 pasarela)

- **Objetivo:** que cada pago llegue ya identificado a un jugador.
- **Incluye en F1:** el acudiente o el coordinador sube la foto del comprobante e indica jugador y conceptos; el sistema pide fecha, hora, valor, medio y referencia; el comprobante entra a una cola de validación donde se aprueba o rechaza con motivo; detección de comprobantes repetidos (mismo valor, fecha y referencia).
- **Incluye en F2:** botón o enlace de pago con un proveedor de pagos en línea (por definir); referencia única por jugador que identifica pagos de terceros; confirmación automática; pago de varios hijos y conceptos en una sola operación; pago por QR.
- **Reglas:** un comprobante no se aprueba sin jugador asignado ni dos veces; el pago se aplica primero al cobro más antiguo salvo indicación distinta.

### 7.9 Efectivo, recibos y cierre de caja (F1)

- **Objetivo:** permitir el efectivo sin perder el control.
- **Incluye:** el coordinador registra el pago en efectivo con jugador, conceptos y valor; se genera un recibo numerado y consecutivo que el acudiente ve en su perfil; cierre de caja por sede y periodo con total registrado, efectivo entregado o consignado (con soporte) y diferencia; aprobación del cierre por el dueño o el auxiliar; alerta si una caja lleva muchos días abierta.
- **Reglas:** un pago en efectivo no se edita, solo se anula con motivo; el dueño define quién puede recibir efectivo y en qué fechas; las diferencias de caja quedan visibles y atribuidas al responsable.

### 7.10 Conciliación bancaria (F2)

- **Objetivo:** cruzar el extracto del banco con los pagos registrados sin hacerlo a mano.
- **Incluye:** carga del extracto en archivo; cruce automático por valor, fecha y referencia; lista de movimientos sin identificar; asignación manual de un movimiento a un jugador, que el sistema recuerda para el mismo pagador; lista de pagos registrados que no aparecen en el banco; reporte de conciliación mensual.
- **Reglas:** un movimiento ya conciliado no se reutiliza; las diferencias quedan abiertas hasta que alguien las explique.

### 7.11 Asistencia (F1)

- **Objetivo:** saber quién entrena, dónde y cuándo, y que cada jugador asistente exista y esté al día.
- **Incluye:** el profesor abre su grupo y marca presente, ausente o tarde con la hora; o escanea el QR del carné del jugador; al escanear ve el semáforo de pago y de póliza; si el jugador no existe, el sistema lo dice y pide registro al coordinador; funciona sin conexión y sincroniza después; reportes por jugador, grupo y sede (porcentaje de asistencia y puntualidad).
- **Reglas:** la asistencia de un jugador en mora se registra igual pero queda marcada, nunca se oculta; si la escuela alerta o bloquea la entrada a quien está en mora es una política configurable (pregunta abierta en la sección 17).

### 7.12 Carné digital (F1)

- **Objetivo:** reemplazar el carné de papel con sello, que fue falsificado.
- **Incluye:** carné en el celular del acudiente con foto, nombre, sede, categoría y QR único; estado de pago visible en tiempo real; versión imprimible para quien no use celular.
- **Reglas:** el estado del carné lo calcula el sistema y no se puede alterar a mano; no hay sellos.

### 7.13 Inventario y uniformes (F2)

- **Objetivo:** saber qué hay, quién lo tiene y qué se perdió.
- **Incluye:** artículos (balones, petos, conos, uniformes por talla); existencias por sede; entradas por compra; salidas por entrega a un profesor o a un jugador; préstamos con responsable; bajas con motivo (pérdida, daño); conteo físico periódico con diferencias; uniforme entregado ligado al jugador y a su cobro.
- **Reglas:** toda salida tiene un responsable; una pérdida exige motivo; alerta de existencia mínima.

### 7.14 Torneos y eventos (F2)

- **Objetivo:** organizar los cobros y cupos de torneos, viajes y excursiones (unos 4 torneos al año).
- **Incluye:** crear un evento con fecha, sede, categorías, cupo y costos (inscripción, traslado); lista de inscritos con estado de pago; cobro generado a cada inscrito; cierre de inscripciones; lista de jugadores habilitados (póliza vigente y pagos al día) para enviar a la liga.
- **Reglas:** el cobro del evento es independiente de la mensualidad; sin póliza vigente el jugador no queda habilitado.

### 7.15 Notificaciones y recordatorios (F1 recibos, F2 recordatorios)

- **Objetivo:** un solo canal oficial entre la escuela y las familias, en lugar de varias líneas de WhatsApp.
- **Incluye:** recibo al registrar un pago; aviso de comprobante aprobado o rechazado; recordatorio antes del vencimiento y en mora; aviso de póliza por vencer; avisos generales de la escuela (por ejemplo cambio de horario); plantillas editables por escuela.
- **Reglas:** se respeta el contacto preferido de la familia; hay un límite de frecuencia para no saturar; el tono de los cobros es configurable.

### 7.16 Reportes y panel de auditoría (F1 reportes, F2 alertas)

- **Objetivo:** que el dueño audite sin revisar carpetas.
- **Incluye en F1:** recaudo por sede, concepto, medio y periodo; jugadores activos por sede y categoría; morosos; cierres de caja.
- **Incluye en F2:** alertas automáticas: jugadores que asisten sin pago al día; efectivo recibido frente a jugadores activos por sede; cajas sin cerrar o con diferencia; comprobantes rechazados o repetidos; anulaciones por usuario; becas y descuentos otorgados por sede; pagos sin asignar; jugadores con pagos pero sin asistencia.
- **Reglas:** todo informe se exporta a Excel o PDF; el coordinador solo ve su sede.

### 7.17 Bitácora de auditoría (F1)

- **Objetivo:** que nadie pueda cambiar algo sin dejar huella.
- **Incluye:** registro de quién, qué, cuándo, desde qué dispositivo, y valor anterior y nuevo; filtros por usuario, sede, jugador y fecha; exportación.
- **Reglas:** la bitácora no se edita ni se borra, ni siquiera por el dueño; registra siempre anulaciones, aprobaciones, cambios de tarifa, becas, cambios de rol y accesos de soporte.

### 7.18 Importación y exportación de datos (F1 asistida, F3 autoservicio)

- **Objetivo:** salir de Drive y Excel sin perder historia, y poder llevarse los datos.
- **Incluye en F1:** carga inicial asistida por el equipo del producto de jugadores, acudientes, tarifas, saldos y pólizas desde las hojas de cálculo del dueño, con reporte de errores.
- **Incluye en F3:** importación de autoservicio con plantillas; exportación de jugadores, pagos y asistencia en cualquier momento; copia completa de datos al darse de baja.
- **Reglas:** nada se importa sin vista previa; los duplicados se muestran antes de confirmar.

### 7.19 Administración de plataforma (F1 mínimo, F3 completo)

- **Objetivo:** operar el negocio de suscripción.
- **Incluye en F1:** crear una organización, su usuario dueño y activar el plan de forma manual.
- **Incluye en F3:** alta y baja de organizaciones; planes y límites por jugadores activos; facturación de la suscripción; suspensión por falta de pago; indicadores de uso; soporte con acceso autorizado y limitado en el tiempo; mensajes de plataforma a los dueños.
- **Reglas:** la plataforma no ve datos de jugadores ni de pagos de una escuela sin autorización del dueño.

### 7.20 Módulo deportivo (F4)

- **Objetivo:** sumar valor deportivo sobre una base administrativa ya sólida.
- **Incluye:** perfil deportivo del jugador; evaluaciones por ítems del profesor; partidos (rival, marcador, tiempo jugado); planificación mensual del profesor contrastada con resultados; estadísticas por categoría y jugador; boletín para padres; el tiempo jugado se explica con asistencia y puntualidad; ítems configurables para otros deportes. Expansión posterior: video con inteligencia artificial (por ejemplo cámaras tipo BO3, con las mejores jugadas por jugador) y perfiles para exportar jugadores (proyecto PIF).
- **Reglas:** se activa por organización y no es requisito para usar el módulo administrativo.

## 8. Casos borde y reglas de negocio

Estos 22 casos son los que suelen romper un sistema de cobros. Cada uno trae una regla propuesta; la columna Tipo indica si es una regla fija del producto, una política que cada escuela configura, o un punto por decidir con el dueño.

| # | Caso | Regla propuesta | Tipo |
| --- | --- | --- | --- |
| C1 | Abono parcial | El abono se aplica al cobro más antiguo; el saldo queda pendiente y el recibo muestra el monto abonado. | Fija |
| C2 | Pago adelantado de varios meses | Se crea saldo a favor que se aplica a los cobros siguientes. El plan semestral es un caso formal de esto. | Fija |
| C3 | Un solo pago para varios hijos | Se reparte por jugador y por concepto antes de aprobar; un comprobante puede tener varias imputaciones. | Fija |
| C4 | Pago hecho por un tercero (tío, abuelo, primo) | El pago se asocia al jugador por la referencia o por la selección del coordinador; el tercero queda guardado como pagador autorizado. | Fija |
| C5 | Varios pagos del mismo valor el mismo día | Cada comprobante exige un jugador distinto y una referencia propia. Si valor, fecha y referencia coinciden con otro, se marca como posible duplicado y no se aprueba hasta revisarlo. | Fija |
| C6 | Comprobante enviado a la línea o sede equivocada | Existe una bandeja única "por asignar" para toda la organización; cualquier coordinador autorizado puede reasignarlo, y se alerta si pasa de N días. | Fija |
| C7 | Anulación o reembolso | Solo el dueño aprueba, con motivo. Nunca se borra: se crea un movimiento contrario. Si el efectivo ya está en un cierre aprobado, la anulación entra en el siguiente cierre. | Fija |
| C8 | Pago duplicado por error del acudiente | Queda como saldo a favor o se reembolsa a decisión del dueño. | Fija |
| C9 | Ingreso a mitad de mes | El dueño elige: cobro completo, prorrateo, o ciclo que empieza en la fecha de ingreso. | Configurable |
| C10 | Cambio de sede o categoría a mitad de mes | El mes en curso conserva la tarifa de origen; el nuevo valor aplica desde el siguiente ciclo. El historial queda registrado. | Fija |
| C11 | Cambio de tarifa durante el año | Solo rige hacia adelante; los cobros ya generados no cambian. | Fija |
| C12 | Retiro y reingreso | El retiro conserva historial y deuda. Al reingresar se reactiva el mismo perfil; si se cobra matrícula de nuevo (por ejemplo después de N meses) lo define la escuela. | Configurable |
| C13 | Pausa de temporada y congelamiento individual | En una pausa de calendario (diciembre–enero) no se generan cobros. Un jugador puede congelarse con fechas y motivo. | Configurable |
| C14 | Becas y descuentos a la vez | La escuela define si se suman con tope, si gana el mayor, o si no se mezclan. Toda beca tiene vigencia, motivo y revisión. | Configurable |
| C15 | Hermanos | Descuento automático configurable para el segundo hijo en adelante y cuenta familiar única. | Configurable |
| C16 | Acudiente sin acceso digital (por ejemplo una abuela que solo paga en efectivo) | Puede pagar en efectivo. El coordinador registra el pago y el recibo llega a otro familiar o se imprime. El jugador sigue existiendo en el sistema. El dueño estima unos 10 casos de 200. | Fija |
| C17 | Padres separados | Dos acudientes por jugador, con un responsable de pago designado. Ambos pueden pagar y ver el estado de cuenta. | Fija |
| C18 | Jugador en mora que llega a entrenar | Por defecto el sistema solo alerta y no bloquea; cada escuela puede cambiarlo a bloqueo en su configuración, con días de gracia. El coordinador puede autorizar una excepción con motivo y fecha prometida de pago. | Configurable |
| C19 | Póliza vencida el día de un partido | El jugador aparece como no habilitado. El dueño puede autorizar una excepción con motivo. | Por decidir |
| C20 | Cierre de caja con diferencia | La diferencia queda atribuida al coordinador y visible. Un cierre aprobado no se reabre sin el dueño. | Fija |
| C21 | Cambio o salida de coordinador | Antes de desactivarlo se exige cerrar o traspasar su caja abierta. | Fija |
| C22 | Sin conexión en la cancha | La asistencia se guarda en el celular y se sincroniza. Un pago en efectivo sin conexión queda pendiente con la hora original y no cuenta como registrado hasta sincronizar. | Fija |

**Datos de menores.** Los jugadores suelen ser menores de edad. El acudiente debe aceptar el tratamiento de datos al inscribir al jugador. Las fotos y documentos solo los ven los roles autorizados y no se comparten fuera de la escuela. Los detalles están en la sección 14.

## 9. Pantallas por rol

Son 51 pantallas en total, agrupadas por rol. El dueño trabaja sobre todo en computador; coordinador, profesor y acudiente trabajan en celular, así que sus pantallas se diseñan primero para pantalla pequeña y poca conectividad. La columna Fase indica cuándo llega cada pantalla.

### Comunes a todos los roles

| Pantalla | Contenido clave | Fase |
| --- | --- | --- |
| Iniciar sesión y recuperar acceso | Entrada con correo o celular; recuperación de acceso. | F1 |
| Elegir organización y rol | Aparece si la persona pertenece a más de una organización o tiene varios roles. | F1 |
| Mi perfil | Datos personales, contacto preferido, cierre de sesión. | F1 |
| Notificaciones | Lista de avisos recibidos. | F2 |

### Dueño o administrador (y auxiliar, sin configuración)

| Pantalla | Contenido clave | Fase |
| --- | --- | --- |
| Tablero | Recaudo del mes frente a lo esperado, jugadores activos y en mora por sede, cajas pendientes de aprobar, comprobantes por validar, alertas. | F1 (alertas en F2) |
| Sedes, categorías y grupos | Árbol de la estructura, horarios, profesores y coordinador de cada sede. | F1 |
| Jugadores | Lista con filtros (sede, categoría, estado, mora, sin póliza) y búsqueda. | F1 |
| Ficha del jugador | Datos, acudientes, estado de cuenta, póliza, asistencia, historial y bitácora del jugador. | F1 |
| Cobros y cartera | Cuentas por cobrar, cartera vencida y por vencer, morosos por sede. | F1 |
| Pagos | Cola de comprobantes, pagos en efectivo, pagos por asignar. | F1 |
| Cajas | Cierres por sede pendientes de aprobación, diferencias y su historial. | F1 |
| Conciliación bancaria | Carga del extracto, movimientos sin identificar, pagos sin movimiento. | F2 |
| Tarifas, descuentos y becas | Catálogo de conceptos, valores, planes, aprobación de becas. | F1 |
| Auditoría | Alertas y bitácora filtrable. | F1 bitácora, F2 alertas |
| Reportes | Recaudo, jugadores, mora, asistencia, exportación. | F1 |
| Inventario | Existencias por sede, movimientos, conteos. | F2 |
| Torneos y eventos | Eventos, inscritos, cobros, lista de habilitados. | F2 |
| Usuarios y roles | Invitar, asignar rol y alcance, desactivar. | F1 |
| Configuración | Políticas (efectivo, mora, ciclos de cobro), plantillas de mensajes, marca. | F1 (marca en F3) |
| Importar y exportar | Carga de datos y descargas. | F1 asistida, F3 autoservicio |

### Coordinador de sede (celular)

| Pantalla | Contenido clave | Fase |
| --- | --- | --- |
| Inicio de la sede | Pendientes del día: comprobantes por validar, morosos, jugadores sin póliza, estado de la caja abierta. | F1 |
| Inscribir jugador | Formulario corto con acudiente, categoría, documentos y cobro de matrícula. | F1 |
| Buscar jugador | Ficha con estado de cuenta, carné y póliza. | F1 |
| Registrar pago | Jugador, conceptos, valor, medio (efectivo o comprobante); genera recibo. | F1 |
| Validar comprobantes | Cola con foto del comprobante, jugador sugerido, aprobar o rechazar con motivo. | F1 |
| Por asignar | Pagos o comprobantes sin jugador identificado. | F1 |
| Cierre de caja | Total registrado, efectivo a entregar o consignar, soporte y diferencia. | F1 |
| Asistencia de la sede | Resumen por grupo y por jugador. | F1 |
| Inventario de la sede | Existencias, entregas, bajas. | F2 |
| Eventos de la sede | Inscritos y pagos de torneos y viajes. | F2 |

### Profesor o entrenador (celular)

| Pantalla | Contenido clave | Fase |
| --- | --- | --- |
| Mis grupos | Grupos del día con horario y lugar. | F1 |
| Tomar asistencia | Lista de jugadores con presente, ausente o tarde; funciona sin conexión. | F1 |
| Escanear carné | Cámara que lee el QR y muestra foto, semáforo de pago y de póliza. | F1 |
| Ficha rápida | Foto, categoría, acudiente de contacto, semáforo; sin montos. | F1 |
| Solicitar material | Pedido de balones, petos y conos a la sede. | F2 |
| Evaluaciones y partidos | Calificación del entrenamiento, marcador, tiempo jugado. | F4 |

### Acudiente y jugador adulto (celular)

| Pantalla | Contenido clave | Fase |
| --- | --- | --- |
| Mis jugadores | Tarjeta por hijo con sede, categoría y estado de pago. | F1 |
| Estado de cuenta | Cobros pendientes, abonos y saldo, por hijo o por familia. | F1 |
| Pagar o subir comprobante | Elegir jugador y conceptos; subir comprobante (F1) o pagar en línea (F2). | F1 y F2 |
| Recibos e historial | Recibos descargables de cada pago. | F1 |
| Carné digital y póliza | Carné con QR y documento de la póliza. | F1 |
| Documentos del jugador | Subir y ver documentos requeridos. | F1 |
| Datos y autorizaciones | Datos de contacto, personas autorizadas a pagar, tratamiento de datos. | F1 |
| Eventos y torneos | Inscribir y pagar torneos, viajes y excursiones. | F2 |
| Avisos de la escuela | Mensajes y cambios de horario. | F2 |
| Boletín del jugador | Evaluación y asistencia por periodo. | F4 |

### Plataforma (equipo del producto, computador)

| Pantalla | Contenido clave | Fase |
| --- | --- | --- |
| Organizaciones | Lista, alta, estado y plan de cada escuela. | F1 mínimo, F3 completo |
| Planes y límites | Planes por número de jugadores activos y límites. | F3 |
| Facturación de suscripciones | Cobro a cada escuela y estado de pago. | F3 |
| Soporte | Solicitudes de acceso autorizado y su bitácora. | F3 |
| Indicadores de uso | Escuelas activas, jugadores activos, adopción. | F3 |

## 10. Flujos clave

Diez flujos describen el día a día de la plataforma. Los dos que se bifurcan, el pago con comprobante y el pago en efectivo, están dibujados; el resto son secuencias de pasos.

### 10.1 Alta de una organización (F1 asistida, F3 autoservicio)

1. El equipo crea la organización y su usuario dueño.
2. El dueño configura sedes, categorías, grupos y usuarios (coordinadores y profesores).
3. Define conceptos, tarifas, planes, descuentos y becas, y sus políticas de efectivo y mora.
4. El equipo carga jugadores, acudientes, saldos y pólizas desde las hojas de cálculo actuales; el dueño revisa el reporte de errores.
5. Se invita a coordinadores, profesores y acudientes. Cada acudiente acepta el tratamiento de datos al ingresar.

### 10.2 Inscripción de un jugador (F1)

1. El coordinador, o el acudiente con aprobación, abre la pantalla de inscripción.
2. Registra al jugador y a su acudiente responsable; el sistema avisa si parece un duplicado.
3. Elige sede, categoría, grupo y plan de pago, y aplica un descuento o una beca si corresponde. La beca la aprueba el dueño.
4. El acudiente acepta el tratamiento de datos y sube los documentos, incluida la póliza.
5. El sistema genera la matrícula como cuenta por cobrar y crea el carné digital.
6. El jugador queda preinscrito y pasa a activo según la política de la escuela, por ejemplo con la matrícula pagada o con una fecha acordada.

### 10.3 Pago con comprobante (F1)

> **Diagrama:** pago con comprobante · 3 pasos, 1 decisión. Se ve dibujado en el documento compartido (Claude Doc).

Si el comprobante parece repetido, el sistema lo avisa en la cola y quien valida decide si lo rechaza. Un comprobante aprobado se aplica al cobro más antiguo salvo que se indique otro.

### 10.4 Pago en línea (F2)

1. El acudiente elige jugador y conceptos y paga desde el botón o el enlace.
2. El proveedor de pagos confirma y el sistema identifica al jugador por la referencia única.
3. El cobro queda pagado y el acudiente recibe el recibo.
4. Si paga un tío o un abuelo, la referencia lo asocia al jugador correcto sin intervención del coordinador.

### 10.5 Pago en efectivo y cierre de caja (F1)

> **Diagrama:** pago en efectivo y cierre de caja · 4 pasos, 1 decisión. Se ve dibujado en el documento compartido (Claude Doc).

Un pago en efectivo registrado no se edita: solo se anula con motivo. Si una caja lleva muchos días abierta, el dueño recibe una alerta.

### 10.6 Conciliación con el extracto bancario (F2)

1. El dueño o el auxiliar carga el extracto del banco.
2. El sistema cruza cada movimiento con los pagos registrados por valor, fecha y referencia.
3. La persona revisa los movimientos sin identificar y asigna cada uno a un jugador; el sistema recuerda la asignación para el mismo pagador.
4. Revisa los pagos registrados que no aparecen en el banco.
5. Cierra el mes con un reporte. Las diferencias quedan abiertas hasta que alguien las explique.

### 10.7 Asistencia con alerta (F1)

1. El profesor abre su grupo, o escanea el carné del jugador.
2. El sistema muestra la foto y el semáforo de pago y de póliza.
3. Si el jugador está en mora, aparece una alerta o un bloqueo según la política de la escuela. El coordinador puede autorizar una excepción con motivo y fecha prometida de pago.
4. Si el jugador no existe en el sistema, el profesor lo ve y pide al coordinador que lo registre.
5. Al terminar, la asistencia se guarda; si no había conexión, se sincroniza después.

### 10.8 Consulta de póliza en un partido (F1)

1. El coordinador o el dueño busca al jugador por nombre, aun con errores de escritura.
2. Abre su ficha y la póliza.
3. Muestra o comparte el documento. Si la póliza está vencida, el sistema lo indica antes de que alguien lo pida.

### 10.9 Torneo o evento (F2)

1. El dueño o el auxiliar crea el evento con fecha, sede, categorías, cupo y costos (inscripción y traslado).
2. El sistema genera el cobro a cada jugador inscrito.
3. El acudiente confirma la inscripción y paga desde la app.
4. Al cerrar inscripciones, el sistema entrega la lista de jugadores habilitados, con póliza vigente y pagos al día.
5. El dueño exporta la lista para enviarla a la liga.

### 10.10 Auditoría mensual del dueño (F1 manual, F2 con alertas)

1. Abre el tablero y revisa las alertas de cada sede (alertas desde F2).
2. Compara el recaudo con los jugadores activos de cada sede.
3. Revisa los cierres de caja y sus diferencias.
4. Revisa anulaciones, becas y descuentos otorgados.
5. Revisa comprobantes por asignar y la lista de morosos.
6. Exporta lo necesario y, si algo no cuadra, consulta la bitácora para ver quién hizo qué.

## 11. Plan por fases del proyecto

Construiremos en cinco fases, y no se pasa a la siguiente hasta cumplir la puerta de salida de la anterior. La fase administrativa va primero porque es el dolor por el que el dueño pagaría; lo deportivo se suma después (acuerdo del 24 de septiembre de 2026).

> **Diagrama:** plan por fases · 5 fases, 4 puertas. Se ve dibujado en el documento compartido (Claude Doc).

Este plan fija el orden y los criterios, no las fechas: las duraciones se definen en la conversación técnica. Cada puerta la aprueba el equipo junto al dueño del piloto, con las métricas de la sección 13. El aislamiento entre organizaciones (sección 5) se construye desde F1 aunque solo exista una escuela, para no rehacer el producto cuando llegue la segunda.

**Cómo se entrega la F1.** Para construirla, la F1 se divide en tres partes que se pueden ver y llenar con datos reales: estructura y jugadores, dinero, y cancha y control. Antes va una fase corta de cimientos (acceso, seguridad y despliegue). El detalle está en el plan técnico del proyecto.

### Módulos por fase

| Módulo | F1 | F2 | F3 | F4 |
| --- | --- | --- | --- | --- |
| 7.1 Organización, sedes y estructura | Completo |  |  |  |
| 7.2 Usuarios, roles y accesos | Completo |  |  |  |
| 7.3 Jugadores e inscripción | Completo |  |  |  |
| 7.4 Acudientes y familias | Completo |  |  |  |
| 7.5 Documentos y pólizas | Completo |  |  |  |
| 7.6 Conceptos, tarifas, descuentos y becas | Completo |  |  |  |
| 7.7 Cuentas por cobrar y estado de cuenta | Completo |  |  |  |
| 7.8 Pagos | Comprobante | Pago en línea |  |  |
| 7.9 Efectivo, recibos y cierre de caja | Completo |  |  |  |
| 7.10 Conciliación bancaria |  | Completo |  |  |
| 7.11 Asistencia | Completo |  |  |  |
| 7.12 Carné digital | Completo |  |  |  |
| 7.13 Inventario y uniformes |  | Completo |  |  |
| 7.14 Torneos y eventos |  | Completo |  |  |
| 7.15 Notificaciones | Recibos | Recordatorios |  |  |
| 7.16 Reportes y panel de auditoría | Reportes | Alertas |  |  |
| 7.17 Bitácora de auditoría | Completo |  |  |  |
| 7.18 Importación y exportación | Asistida |  | Autoservicio |  |
| 7.19 Administración de plataforma | Mínimo |  | Completo |  |
| 7.20 Módulo deportivo |  |  |  | Completo |

### F0 · Descubrimiento y validación

- **Objetivo:** confirmar con datos reales que el diseño resuelve los dolores del dueño antes de construir.
- **Qué se hace:** obtener la cifra de efectivo por sede (Q1); revisar las hojas de cálculo, carpetas y tarifas reales; ver el día a día con coordinadores y profesores; decidir las políticas de efectivo y de mora (Q2, Q3); construir un prototipo navegable de las pantallas del dueño, el coordinador y el acudiente; resolver la revisión legal de datos de menores (Q12); definir precios y condiciones del piloto (Q13).
- **Quiénes participan:** el equipo, el dueño y uno o dos coordinadores.
- **Puerta de salida:** políticas de efectivo y mora decididas; estructura real de tarifas y planes documentada; prototipo validado por el dueño y al menos un coordinador; datos del piloto revisados y listos para migrar.
- **Riesgos:** el dueño tiene poco tiempo (vive en Pereira y sus entrenamientos van de martes a viernes de 4 a 6 p. m.); los datos están más desordenados de lo esperado.

### F1 · MVP administrativo (piloto en Argentinos Juniors)

- **Objetivo:** que el dueño sepa quién existe, quién debe y cuánto efectivo debería haber, en las 4 sedes.
- **Usuarios habilitados:** dueño, auxiliar, 4 coordinadores, profesores y acudientes.
- **Módulos:** los marcados F1 en la tabla anterior.
- **Puerta de salida:** las 4 sedes operan con la plataforma durante un ciclo de cobro completo; todo el efectivo tiene recibo y entra a un cierre aprobado; no hay jugadores con pago o asistencia sin perfil; se toma asistencia en al menos el 90 % de los entrenamientos; el dueño cuadra caja y mora sin usar Excel.
- **Riesgos:** coordinadores y profesores se resisten porque hoy manejan el efectivo; las familias siguen enviando comprobantes por WhatsApp; la migración de datos es más lenta de lo previsto.
- **Mitigación:** capacitación corta, un solo canal oficial para comprobantes, carga asistida de datos y seguimiento semanal con el dueño.

### F2 · Pagos digitales y control

- **Objetivo:** reducir el trabajo manual de recaudo y darle al dueño alertas automáticas.
- **Módulos:** los marcados F2 en la tabla anterior, y el portal del acudiente completo (eventos y avisos).
- **Segunda escuela:** Alianza Sport, de la mano de Juan David.
- **Puerta de salida:** al menos el 90 % de los pagos se identifican sin intervención manual; la conciliación mensual se hace sin hoja de cálculo; un torneo se cobra completo desde la app; una segunda escuela opera.
- **Riesgos:** familias reacias a pagar en línea (el efectivo sigue siendo una opción); comisión del proveedor de pagos; decisiones pendientes sobre proveedor de pagos y facturación electrónica (Q4, Q5).

### F3 · Escala comercial

- **Objetivo:** vender a escuelas nuevas sin que el equipo haga cada alta a mano.
- **Módulos:** los marcados F3 en la tabla, marca por organización y terminología configurable por deporte, probada con una escuela de otro deporte (voleibol o baile).
- **Puerta de salida:** una escuela nueva se da de alta y opera sin ayuda del equipo; las suscripciones se cobran; al menos una escuela de un deporte distinto al fútbol usa la plataforma.
- **Riesgos:** las escuelas piden cosas únicas que empujan a desarrollos a la medida (Gustavo lo advirtió el 24 de septiembre); el soporte crece más rápido que el equipo.

### F4 · Deportivo y valor agregado

- **Objetivo:** sumar valor para profesores y padres sobre una base administrativa ya sólida.
- **Módulos:** 7.20 y, después, video con inteligencia artificial y perfiles para exportar jugadores.
- **Puerta de salida:** el módulo deportivo está en uso en al menos una escuela sin que baje la cobertura de asistencia.
- **Riesgos:** perder el foco del dueño; el costo del video con inteligencia artificial (referencia: 180.000 a 200.000 pesos por partido con cámaras tipo BO3, que suelen pagar los padres).

## 12. Matriz de trazabilidad

Los 14 dolores de la sección 2 tienen módulo y fase. D11 (inventario) solo llega en F2; D2, D3 y D10 empiezan en F1 y se completan en F2; los otros 10 quedan resueltos en F1.

| Dolor | Módulos que lo resuelven | Fase | Cómo sabremos que se resolvió |
| --- | --- | --- | --- |
| D1 Efectivo sin control | 7.9 Efectivo y cierre de caja; 7.16 Reportes; 7.17 Bitácora | F1 | Todo el efectivo tiene recibo y entra a un cierre; las diferencias de caja están explicadas. |
| D2 Transferencias anónimas | 7.8 Pagos (referencia única en F2); 7.10 Conciliación | F1 parcial, F2 completo | Porcentaje de pagos asignados a un jugador sin intervención manual. |
| D3 Conciliación manual | 7.8 Pagos; 7.10 Conciliación | F1 cola de validación, F2 automática | Horas al mes que el equipo dedica a conciliar. |
| D4 Comprobantes por WhatsApp | 7.8 Pagos; 7.15 Notificaciones | F1 | Comprobantes recibidos fuera de la app (debe tender a cero). |
| D5 Jugadores que no existen | 7.3 Jugadores; 7.11 Asistencia; 7.16 Reportes | F1 | Jugadores con pagos o asistencia pero sin perfil activo. |
| D6 Sin asistencia ni control de acceso | 7.11 Asistencia; 7.12 Carné digital | F1 | Porcentaje de entrenamientos con asistencia tomada. |
| D7 Pólizas inencontrables | 7.5 Documentos y pólizas | F1 | Tiempo para entregar la póliza de un jugador. |
| D8 Datos dispersos | 7.3 Jugadores; 7.18 Importación | F1 | Porcentaje de jugadores migrados desde Drive y Excel. |
| D9 Tarifas con muchas variables | 7.6 Conceptos y tarifas; 7.7 Cuentas por cobrar | F1 | Cobros generados sin tocar Excel. |
| D10 Cobros distintos a la mensualidad | 7.6 Conceptos; 7.14 Torneos y eventos | F1 conceptos, F2 eventos | Torneos y uniformes cobrados dentro de la app. |
| D11 Sin inventario | 7.13 Inventario y uniformes | F2 | Diferencia entre el conteo físico y el sistema. |
| D12 Saber quién debe | 7.7 Cuentas por cobrar; 7.16 Reportes | F1 | Tiempo para saber si un jugador debe. |
| D13 Operación remota | 7.16 Reportes y tablero; 7.17 Bitácora | F1 | El dueño audita las 4 sedes sin visitarlas. |
| D14 Apps actuales no sirven al dueño | Todo el producto, centrado en el rol de dueño | F1 | El dueño sigue usando la plataforma tras 3 meses de piloto. |

## 13. Métricas de éxito

Diez métricas dicen si el producto resuelve los dolores del dueño. Las metas son propuestas del equipo, no compromisos: en F0 se mide la línea base real con los datos de Juan David y se ajustan.

| Métrica | Cómo se calcula | Meta propuesta | Desde |
| --- | --- | --- | --- |
| Pagos identificados automáticamente | Pagos asignados a un jugador sin intervención manual, sobre el total de pagos | 90 % o más | F2 |
| Efectivo con recibo y cierre | Efectivo registrado con recibo y dentro de un cierre aprobado, sobre el efectivo registrado | 100 % | F1 |
| Diferencia de caja sin explicar | Suma de diferencias de cierre sin justificar | Cero | F1 |
| Tiempo para encontrar una póliza | Segundos desde que se pide hasta que se muestra | Menos de 1 minuto | F1 |
| Tiempo para saber si un jugador debe | Segundos para ver su estado de cuenta | Menos de 15 segundos | F1 |
| Horas de conciliación al mes | Horas del equipo cruzando extracto y comprobantes | Reducir a la mitad de la línea base | F2 |
| Jugadores con pago o asistencia sin perfil | Cantidad detectada por el sistema | Cero | F1 |
| Cobertura de asistencia | Entrenamientos con asistencia tomada, sobre los programados | 90 % o más | F1 |
| Adopción de acudientes | Familias activas que pagan o suben comprobantes desde la app, sobre las familias activas | 70 % o más a los 3 meses | F1 |
| Comprobantes recibidos fuera de la app | Comprobantes que llegan por WhatsApp u otro medio | Tender a cero | F1 |

**Referencia comercial.** La app anterior costó unos 10 millones de pesos en 11–12 meses para una escuela de 200–220 jugadores. El precio de nuestra suscripción debe justificarse frente a ese valor (ver sección 15). Un indicador adicional de éxito del piloto: el dueño sigue usando la plataforma a los 3 meses.

## 14. Requisitos generales no técnicos

Doce condiciones que el producto debe cumplir sin importar el módulo. No definen tecnología; esa conversación queda para después.

| Requisito | Qué significa en la práctica | Por qué |
| --- | --- | --- |
| Protección de datos de menores | El acudiente acepta el tratamiento de datos al inscribir. Hay política de tratamiento, y el acudiente puede consultar, corregir o pedir la eliminación de los datos. Las fotos y documentos solo se usan para fines de la escuela. Se recogen solo los datos médicos necesarios. | Casi todos los jugadores son menores. La norma aplicable en Colombia es la Ley 1581 de 2012; se debe validar con asesoría legal antes del piloto. |
| Aislamiento entre escuelas | Ninguna escuela puede ver datos de otra, ni siquiera por error de configuración. | El modelo es multitenant y el dueño entrega información sensible. |
| Mínimo acceso necesario | Cada rol ve solo lo que necesita (sección 6). El profesor no ve montos ni datos bancarios. | Reduce fraude y fuga de datos. |
| Huella inmutable | Cada cambio importante queda registrado y no se puede borrar ni editar. | Es la base de la auditoría. |
| Recibos consecutivos | Cada pago en efectivo genera un recibo numerado y sin saltos por organización. | Permite detectar recibos faltantes o caídos. |
| Disponibilidad en momentos clave | Debe funcionar bien los fines de semana (partidos y carné de póliza el domingo) y los primeros 10 días del mes, cuando llegan unos 100 comprobantes por sede. | Son los picos reales de uso. |
| Uso con mala conexión | La asistencia se toma sin internet y se sincroniza. Las pantallas del coordinador y el profesor son livianas. | Las canchas no siempre tienen buena señal. |
| Rapidez de operación | Registrar un pago debe tomar menos de un minuto; tomar asistencia de un grupo, pocos minutos. | Si es más lento que el papel, no lo usarán. |
| Lenguaje claro y accesible | Textos simples, letra legible y flujos cortos para acudientes mayores. El efectivo siempre es una opción válida. | Hay familias con poco manejo digital. |
| Contexto colombiano | Idioma español de Colombia, pesos colombianos sin decimales, zona horaria de Bogotá, fechas día/mes/año. | El mercado inicial es Bogotá. |
| Respaldo y conservación | La información de pagos no se pierde. El dueño puede exportar todo en cualquier momento. Se debe confirmar por cuántos años se conserva la información contable. | Es dinero y es historial legal de la escuela. |
| Soporte y capacitación | Guía rápida y capacitación corta para coordinadores y profesores; un canal de soporte con horario definido. | La adopción depende de quienes operan el día a día. |

## 15. Modelo de negocio (borrador)

Proponemos una suscripción mensual por organización, con planes escalonados según el tamaño de la escuela. El 24 de septiembre de 2026 el equipo lo dejó como tema "requiere más debate": falta definir la oferta inicial y los precios.

**Unidad de cobro: jugadores activos.** Michael propuso planes por número de usuarios con inicio de sesión (por ejemplo de 0 a 50) y Gustavo habló de escuelas de 100, 300 o 500 estudiantes. Recomendamos contar **jugadores activos**: es la cifra que el dueño conoce, crece con sus ingresos y es predecible. Contar usuarios con sesión incluiría a padres y abuelos y haría el precio difícil de anticipar. Juan David preguntó si el costo debe subir con cada jugador; con planes por rangos, el precio solo cambia al cruzar un límite, no con cada alta.

**Estructura de planes (ilustrativa, sin precios).**

| Plan | Jugadores activos | Perfil típico |
| --- | --- | --- |
| Inicial | Hasta 50 | Escuela pequeña de una sede |
| Crecimiento | 51 a 150 | Escuela con 1 o 2 sedes |
| Escuela | 151 a 300 | Escuela multi-sede; aquí estaría el piloto (200–220 jugadores) |
| Club | 301 a 500 | Varias sedes y personal administrativo |
| A la medida | Más de 500 | Cotización individual |

**Qué incluye.** Todos los planes incluyen los módulos administrativos y financieros de F1 y F2, sedes y usuarios ilimitados (profesores y acudientes no cuestan extra). El módulo deportivo (F4) y el video con inteligencia artificial se evaluarán como complementos opcionales con precio aparte.

**Referencia de mercado.** La escuela piloto pagó unos 10 millones de pesos por 11–12 meses a Train and Play, alrededor de 830.000 pesos al mes o 4.000 pesos por jugador al mes (estimación con 210 jugadores). Juan David lo calificó como "demasiado alto" para lo que recibía. Nuestro precio debe estar claramente por debajo de ese valor y justificarse por control, no por fotos ni estadísticas.

**Decisiones pendientes.**

- Precio de cada plan y si hay descuento por pago anual.
- Condiciones del piloto: gratuito, con descuento o a cambio de retroalimentación y acceso a contactos del gremio.
- Quién asume la comisión del proveedor de pagos en línea (escuela o familia) cuando exista (F2).
- Qué pasa cuando una escuela supera el límite de su plan (aviso, cambio automático o bloqueo).
- Si la relación con Juan David incluye participación en el negocio: Michael se asoció con él para escalar el producto a otras escuelas, pero los términos no se discutieron en las reuniones.

## 16. Fuera de alcance

Estos límites mantienen el producto enfocado en el dueño. Los puntos marcados como propuesta no se discutieron en las reuniones y se deben confirmar.

**No forman parte del producto.**

- Red social interna con perfiles, fotos y "me gusta": se descartó explícitamente porque no resuelve el dolor del dueño (24 de septiembre).
- Contabilidad completa, nómina y pago a profesores. La plataforma controla el recaudo y la operación, no reemplaza al contador (propuesta).
- Custodia del dinero. Los pagos llegan directamente a la cuenta que la escuela designe; la plataforma no retiene fondos (propuesta, alineada con lo que sugirió Sebastián el 10 de septiembre).
- Auditoría interna del personal. La plataforma da herramientas para auditar, pero no sustituye una revisión presencial ni una decisión administrativa sobre el equipo.
- Control físico de acceso, como torniquetes. El carné digital y la asistencia dan la señal; la puerta la controla la persona (propuesta).
- Reserva de escenarios y pago de arriendo de canchas (propuesta).

**Se pospone a fases posteriores.**

- Facturación electrónica: falta confirmar si las escuelas están obligadas; si lo están, se agenda en F2 o F3.
- Módulo deportivo (evaluaciones, partidos, boletines): F4.
- Video con inteligencia artificial y perfiles para exportar jugadores: después de F4.
- Autoservicio completo de nuevas escuelas y cobro de suscripciones: F3.

## 17. Preguntas abiertas

Hay 16 preguntas: 3 ya tienen una respuesta provisional (Q3, Q7 y Q9) y 13 siguen abiertas. Las que cierran F0 (descubrimiento) son las que más urgen, porque definen reglas que afectan el diseño de F1.

| # | Pregunta | Quién responde | Se necesita antes de |
| --- | --- | --- | --- |
| Q1 | ¿Cuántos jugadores por sede piden pagar en efectivo? Juan David ofreció tener la cifra el día siguiente a la reunión del 24 de septiembre. | Juan David | F0 |
| Q2 | Política de efectivo: ¿quién puede recibirlo, en qué fechas y se mantiene en todas las sedes? ¿Se adoptan cortes los días 15 y 30 como propuso Sebastián? | Dueño | F0 |
| Q3 | Mora: ¿el sistema solo alerta al coordinador o bloquea la asistencia? ¿Cuántos días de gracia? Decidido por ahora: solo alerta, sin bloquear; la política queda configurable. | Dueño | Diseño de F1 |
| Q4 | ¿La escuela está obligada a facturación electrónica? Hoy está registrada ante el IDRD como escuela, no como empresa. | Dueño con su contador | F2 |
| Q5 | Proveedor de pagos en línea (se mencionaron OnePay y Mercado Pago) y quién asume la comisión. | Equipo técnico y dueño | F2 |
| Q6 | ¿En qué formato están hoy los datos (Excel, carpetas, fotos) y qué tan limpios están para migrarlos? | Dueño | F0 |
| Q7 | ¿El recaudo entra a una sola cuenta bancaria o a una por sede? ¿Qué datos entrega el banco en el extracto? Decidido por ahora: una cuenta por escuela, con el modelo preparado para varias; falta confirmarlo con Juan David. | Dueño | F1 |
| Q8 | ¿Qué datos y formato exige la liga para las pólizas y quién es la aseguradora? | Dueño | F1 |
| Q9 | ¿El acudiente debe confirmar que recibió el recibo de un pago en efectivo, o basta con que lo vea? Decidido: basta con que lo vea. | Dueño | Diseño de F1 |
| Q10 | Auditoría interna previa: Sebastián propuso visitar las sedes de forma encubierta. ¿La hará el dueño antes del piloto? | Dueño y equipo | F0 |
| Q11 | Canal de mensajes con las familias (mensajería, correo, mensajes de texto, la propia app). | Equipo técnico | F1 |
| Q12 | Asesoría legal sobre datos de menores y por cuánto tiempo se conserva la información contable. | Equipo | Antes del piloto |
| Q13 | Precios, condiciones del piloto y relación societaria con Juan David (sección 15). | Equipo | F0 |
| Q14 | Nombre del producto y quién lo administra como plataforma. | Equipo | F1 |
| Q15 | Ingreso a mitad de mes (C9): por ahora se asume prorrateo según los días restantes del mes. ¿Se confirma, o se prefiere cobro completo o ciclo desde la fecha de ingreso? | Dueño y equipo | Diseño de cobros (F1, parte 2) |
| Q16 | Becas y descuentos a la vez (C14): ¿gana el mayor, se suman con tope o no se mezclan? Se pospone; mientras tanto un jugador tiene un solo beneficio activo. | Dueño y equipo | Antes de acumular beneficios (F1, parte 2) |

**Compromisos vigentes de la reunión del 24 de septiembre.**

- Juan David: compartir el enlace de Train and Play por el grupo y entregar la estadística de pagos en efectivo por sede (Q1).
- Gustavo: consolidar los requerimientos de ambas reuniones en una propuesta, que es este documento, para la siguiente reunión (jueves después de las 4 p. m.).

## 18. Glosario

| Término | Significado en este documento |
| --- | --- |
| Organización (tenant) | Una escuela, club o academia cliente. Sus datos están completamente separados de los de otras organizaciones. |
| Sede | Lugar físico donde entrena una parte de la organización; tiene un coordinador. |
| Programa | Deporte o línea de formación que ofrece la organización (fútbol, voleibol, baile). |
| Categoría | Nivel o rango de edad dentro de un programa (por ejemplo sub 15 o 2014). |
| Grupo | Conjunto de jugadores con un horario y un profesor, dentro de una categoría y una sede. |
| Jugador | Persona inscrita que entrena. Si es menor, tiene acudiente. |
| Acudiente | Adulto responsable de un jugador menor. Puede ser padre, madre, abuelo u otro. |
| Responsable de pago | Acudiente designado para pagar; otras personas autorizadas también pueden hacerlo. |
| Concepto | Tipo de cobro: matrícula, mensualidad, uniforme, póliza, torneo, traslado. |
| Tarifa | Valor de un concepto para una sede, categoría o plan en un periodo. |
| Descuento | Rebaja en porcentaje o valor sobre una tarifa (por parentesco, convenio, hermanos). |
| Beca | Descuento del 10 al 100 % con motivo y aprobación del dueño. |
| Plan | Forma de pago de un jugador, por ejemplo mensual o semestral. |
| Cuenta por cobrar | Cobro generado y aún no pagado. |
| Estado de cuenta | Resumen de cobros, pagos, abonos y saldo de un jugador o familia. |
| Abono | Pago parcial de un cobro. |
| Saldo a favor | Dinero pagado de más o por adelantado que se aplica a cobros futuros. |
| Mora | Cobro vencido más allá de los días de gracia. |
| Semáforo | Indicador de colores del estado de pago: al día, por vencer, en mora. |
| Comprobante | Soporte que sube la familia como evidencia de una transferencia o consignación. |
| Recibo | Documento numerado que la plataforma genera al registrar un pago en efectivo. |
| Cierre de caja | Corte en el que el coordinador cuadra el efectivo registrado con el efectivo entregado o consignado. |
| Conciliación | Cruce del extracto bancario con los pagos registrados en la plataforma. |
| Referencia de pago | Código único por jugador que identifica a quién pertenece un pago, aunque lo haga un tercero. |
| Póliza | Seguro del jugador que exige la liga; se asocia a una persona y tiene vigencia. |
| Carné digital | Identificación del jugador en el celular, con QR y estado de pago visible. |
| Bitácora | Registro que no se puede editar de quién hizo qué y cuándo. |
| Fase (F0 a F4) | Etapa del proyecto de construcción, definida en la sección 11. |
