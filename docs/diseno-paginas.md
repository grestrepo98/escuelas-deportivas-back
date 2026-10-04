# Guía de diseño de páginas — Plataforma de Escuelas Deportivas

Documento para quien diseña la interfaz (UI/UX). Complementa `docs/producto.md` (fuente de verdad del producto) y `docs/plan-tecnico.md`. Si algo aquí contradice a `producto.md`, gana `producto.md`.

> **Nombre del producto:** pendiente (Q14). En este documento se usa **[Nombre]** como marcador. El diseño del logo y del wordmark debe poder cambiar sin rehacer el sistema.

## Índice

1. [Introducción](#1-introducción)
2. [Sistema de diseño](#2-sistema-de-diseño-tokens-y-componentes)
3. [Navegación y mapa de sitio](#3-navegación-y-mapa-de-sitio)
4. [Sitio público](#4-sitio-público-marketing)
5. [Pantallas de la app](#5-pantallas-de-la-app)
6. [Flujos clave a prototipar](#6-flujos-clave-a-prototipar)
7. [Accesibilidad, contenido y calidad](#7-accesibilidad-contenido-y-calidad)
8. [Entregables esperados del diseñador](#8-entregables-esperados-del-diseñador)
9. [Anexo: trazabilidad pantalla ↔ módulo ↔ dolor](#9-anexo-trazabilidad-pantalla--módulo--dolor)

**Códigos de pantalla:** `WEB` sitio público · `COM` comunes · `DUE` dueño/auxiliar · `COO` coordinador · `PRO` profesor · `ACU` acudiente · `PLA` plataforma. Las marcadas *(soporte)* no están en `producto.md` §9.

---

## 1. Introducción

### 1.1 Qué se diseña
Una sola PWA (React) con tres superficies:

1. **Sitio público**: vende la plataforma a dueños de escuelas (§4 de este documento).
2. **App del dueño/auxiliar/plataforma**: computador primero, responsive hasta celular.
3. **App de coordinador, profesor y acudiente**: **celular primero**, poca conectividad.

### 1.2 Quién usa qué (y cómo)

| Rol | Dispositivo | Contexto real de uso | Prioridad de diseño |
| --- | --- | --- | --- |
| Dueño / Auxiliar | Computador (y celular para consultar) | Oficina o remoto; audita 4 sedes | Densidad de información, tablas, filtros, claridad de alertas |
| Coordinador | Celular | De pie en la sede, con prisa, a veces sin señal | Registrar un pago en < 1 min; botones grandes; una mano |
| Profesor | Celular | En la cancha/salón, sol, guantes, sin señal | Tomar asistencia en pocos minutos; legible al aire libre; offline |
| Acudiente / jugador adulto | Celular | Casa o trabajo; edad muy variable (de padres jóvenes a abuelos) | Lenguaje simple, letra grande, flujos cortos |
| Plataforma | Computador | Equipo del producto | Funcional, sin lujo |

### 1.3 Principios de UX (tomados de `producto.md` §4)
1. **El dueño manda**: lo que da control, claridad o ahorro al dueño tiene prioridad visual.
2. **Cada peso deja rastro**: siempre se ve quién, cuándo, dónde y cómo se pagó.
3. **Nada se borra, se anula con motivo**: no existe un botón "Eliminar" en datos de negocio; existe "Anular" y pide motivo.
4. **Efectivo permitido pero auditado**: el flujo de efectivo es de primera clase, no un camino secundario.
5. **Fricción mínima para quien paga**.
6. **Simple para coordinador y profesor**: si es más lento que el papel, no se usa.
7. **No es una red social**: sin "me gusta", feeds, comentarios ni fotos decorativas de menores.

### 1.4 Leyenda de fases
Cada página trae su fase de entrega. **F1** (MVP, piloto) se diseña primero y a máxima fidelidad. **F2/F3/F4** se diseñan después, pero el sistema de diseño y la navegación deben dejar el espacio listo (por ejemplo, el ítem "Conciliación" aparece en el menú del dueño como "Próximamente" hasta F2).

### 1.5 Decisiones abiertas que afectan el diseño
Diseñar con estas opciones previstas; no hardcodear una:

| Tema | Estado | Qué debe prever el diseño |
| --- | --- | --- |
| Mora: alertar o bloquear (Q3, C18) | Por ahora solo alerta; configurable | Dos variantes del resultado de escaneo y asistencia: **alerta** (amarillo/rojo, se puede continuar) y **bloqueo** (rojo, requiere excepción del coordinador con motivo y fecha prometida) |
| Prorrateo de ingreso a mitad de mes (Q15, C9) | Se asume prorrateo | Mostrar en inscripción el desglose "días restantes × tarifa" |
| Beneficios acumulados (Q16, C14) | Un solo beneficio activo por jugador | Selector de **un** beneficio; dejar el espacio para multi-selección futura |
| Recibo de efectivo (Q9) | Basta con que el acudiente lo vea | El recibo aparece en su perfil; **sin** botón "Confirmar recibido" |
| Canal de mensajes (Q11) | Por definir | Pantalla de avisos independiente del canal (correo/SMS/WhatsApp/in-app) |
| Marca por organización | F3 | Tokens de color y logo reemplazables |

---

## 2. Sistema de diseño (tokens y componentes)

### 2.1 Personalidad visual
**Moderna, confiable, energética sin ser infantil.** Es una herramienta de dinero y control: debe transmitir seguridad (como una fintech) con un toque de movimiento deportivo.

- **Multideporte**: ningún balón, verde cancha ni silueta de un solo deporte en la interfaz base. La identidad se apoya en **movimiento abstracto**: diagonales a ~12°, trazos de "velocidad" y formas en pastilla.
- **Referencias de tono**: fintech moderna (claridad, números grandes), apps de fitness (energía, progreso), no apps de gimnasio agresivas.
- **Ilustración/imagen**: ilustraciones abstractas y personas estilizadas (sin rostro identificable). **Nunca fotos de menores** en el sitio público.

### 2.2 Color

Valores de partida. **El diseñador debe verificar contraste con una herramienta** (los ratios indicados son aproximados).

**Marca**

| Token | Hex | Uso |
| --- | --- | --- |
| `primary-50` | `#EEF2FF` | Fondos suaves, hover de filas |
| `primary-100` | `#E0E7FF` | Chips seleccionados |
| `primary-500` | `#6366F1` | Íconos, gráficos |
| `primary-600` | `#4F46E5` | **Botón primario, enlaces** (texto blanco ≈ 6:1) |
| `primary-700` | `#4338CA` | Hover/pressed del primario |
| `primary-900` | `#312E81` | Fondos oscuros del hero |
| `accent-400` | `#FF7A59` | Acento "energía": ilustraciones, gráficos, subrayados, badges decorativos |
| `accent-600` | `#E5532F` | Acento sobre blanco cuando va un ícono (no texto largo) |

> El coral `#FF7A59` **no** pasa contraste como texto sobre blanco. Úsese como relleno con texto `slate-900` encima, o como elemento gráfico.

**Neutros (pizarra)**

| Token | Hex | Uso |
| --- | --- | --- |
| `slate-0` | `#FFFFFF` | Superficies |
| `slate-50` | `#F8FAFC` | Fondo de la app |
| `slate-100` | `#F1F5F9` | Fondos de tabla, inputs deshabilitados |
| `slate-200` | `#E2E8F0` | Bordes |
| `slate-400` | `#94A3B8` | Placeholder (solo decorativo, no texto esencial) |
| `slate-500` | `#64748B` | Texto secundario (≈ 4.8:1) |
| `slate-700` | `#334155` | Texto de cuerpo |
| `slate-900` | `#0F172A` | Títulos, cifras |

**Semánticos — el semáforo de pago** (siempre **color + ícono + texto**, nunca solo color: hay daltonismo y sol directo)

| Estado | Texto | Fondo | Borde/ícono | Ícono | Etiqueta |
| --- | --- | --- | --- | --- | --- |
| Al día | `#15803D` | `#DCFCE7` | `#16A34A` | check-circle | "Al día" |
| Por vencer | `#B45309` | `#FEF3C7` | `#D97706` | clock | "Por vencer" |
| En mora | `#B91C1C` | `#FEE2E2` | `#DC2626` | alert-triangle | "En mora" |
| Sin registrar | `#475569` | `#F1F5F9` | `#94A3B8` | help-circle | "Sin registrar" |
| Info / pendiente de validar | `#1D4ED8` | `#DBEAFE` | `#3B82F6` | info / hourglass | "Por validar" |
| Anulado | `#475569` | `#F1F5F9` | `#94A3B8` | ban | "Anulado" (con tachado en el monto) |

**Modo oscuro** (obligatorio desde F1 en app; opcional en sitio público)

| Token | Hex |
| --- | --- |
| `bg` | `#0B1020` |
| `surface` | `#131A2E` |
| `surface-2` | `#1B2440` |
| `border` | `#2A3558` |
| `text` | `#E6E9F5` |
| `text-muted` | `#9AA5C7` |
| `primary` | `#818CF8` (texto `#0B1020`) |

Los semánticos en oscuro: fondo = color al 16 % de opacidad sobre `surface`, texto = tono 300 del color.

**Paleta de gráficos** (separada de los semánticos, para no confundir "rojo = mora" con una serie de datos)

| Uso | Colores |
| --- | --- |
| Categórica (hasta 6 series) | `#4F46E5` · `#14B8A6` · `#FF7A59` · `#8B5CF6` · `#0EA5E9` · `#F59E0B` |
| Secuencial (intensidad) | `#EEF2FF` → `#C7D2FE` → `#818CF8` → `#4F46E5` → `#312E81` |
| Cartera vencida (aging) | `#FECACA` → `#F87171` → `#B91C1C` |

Máximo 3 series por gráfico cuando sea posible; diferenciar también por forma, patrón o etiqueta directa.

**Programas/deportes**: cada programa (fútbol, voleibol, baile…) tiene un **color de etiqueta** elegido de una paleta de 8 tonos (índigo, coral, turquesa `#14B8A6`, violeta `#8B5CF6`, rosa `#EC4899`, lima `#84CC16`, cielo `#0EA5E9`, ámbar `#F59E0B`) más un ícono. Se usa en chips y puntos de color, **no** como color de marca.

**Tematización por organización (F3)**: la escuela sube su logo y elige un color primario. El sistema genera la escala `50–900` y **rechaza** o ajusta el color si el texto blanco sobre `600` queda por debajo de 4.5:1.

### 2.3 Tipografía

| Rol | Fuente sugerida | Peso | Notas |
| --- | --- | --- | --- |
| Títulos y cifras grandes | **Manrope** | 700–800 | Geométrica, moderna, cifras claras |
| UI y cuerpo | **Inter** | 400/500/600 | Muy legible en pantallas pequeñas |
| Cifras de dinero | Inter con `font-variant-numeric: tabular-nums` | 600 | Alinear columnas de montos |

Escala (móvil / escritorio):

| Estilo | Móvil | Escritorio | Uso |
| --- | --- | --- | --- |
| Display | 36/40 | 56/60 | Hero del sitio, cifra principal del tablero |
| H1 | 28/34 | 36/44 | Título de página |
| H2 | 22/28 | 28/36 | Secciones |
| H3 | 18/24 | 20/28 | Tarjetas |
| Body L | 17/26 | 18/28 | **Acudiente** (base mayor para adultos mayores) |
| Body | 15/22 | 15/22 | Coordinador/profesor/dueño |
| Caption | 13/18 | 13/18 | Metadatos |

- Tamaño mínimo de texto en la app del **acudiente: 16 px**.
- **Formato de dinero**: `$ 157.500` (COP, sin decimales, punto de miles, símbolo con espacio). Montos grandes en `Manrope 800`.
- Fechas `dd/mm/aaaa`; horas en 12 h con a. m./p. m.; zona America/Bogota. Fechas relativas ("hace 2 días") con la fecha exacta en tooltip o debajo.

### 2.4 Forma, espaciado y elevación

- **Espaciado** en base 4: `4, 8, 12, 16, 24, 32, 48, 64`.
- **Radios**: botones/inputs `12 px`; tarjetas `16 px`; hojas inferiores `24 px` arriba; chips y avatares `999 px` (pastilla/círculo); imágenes de carné `20 px`.
- **Bordes**: `1 px slate-200`; tarjetas interactivas ganan borde `primary-200` y sombra al hover.
- **Sombras** (suaves, difusas, sin negro puro):
  - `sm`: `0 1px 2px rgba(15,23,42,.06)`
  - `md`: `0 6px 16px rgba(15,23,42,.08)`
  - `lg`: `0 16px 40px rgba(15,23,42,.12)` (modales y hojas)
- **Retícula**: móvil 4 col / margen 16; tablet 8 col / margen 24; escritorio 12 col / ancho máx. 1280 (app) y 1200 (sitio).
- **Breakpoints**: `360`, `640`, `1024`, `1440`.
- **Áreas táctiles**: mínimo **44×44 px**; en pantallas del profesor y el coordinador, botones de acción principal de **56 px** de alto.
- **Zona del pulgar**: acciones principales de coordinador/profesor/acudiente en la mitad inferior; barra de acción fija abajo (sticky) con sombra.
- **Forma distintiva**: una "diagonal" de ~12° como recorte en cabeceras de tarjetas destacadas y en el hero; patrón de líneas de velocidad en `primary-900` al 6 % de opacidad.

### 2.5 Iconografía
- Librería de trazo (Lucide o Phosphor), **2 px** de trazo, esquinas redondeadas, 20/24 px.
- Íconos de deporte intercambiables (fútbol, microfútbol, baloncesto, voleibol, baile, natación, tenis, artes marciales, atletismo, genérico). Si el programa no tiene ícono, ícono genérico "medalla".
- Los íconos nunca llevan significado solos: etiqueta de texto al lado (en móvil de acudiente siempre).

### 2.6 Movimiento y animación

Principios: **rápido, con propósito, sin bloquear**. Nada de animaciones que retrasen una tarea de coordinador o profesor.

| Token | Valor | Uso |
| --- | --- | --- |
| `dur-fast` | 120 ms | Hover, foco, toggles |
| `dur-base` | 200 ms | Aparición de chips, cambios de estado |
| `dur-slow` | 320 ms | Hojas inferiores, modales, transiciones de página |
| `dur-hero` | 600–900 ms | Solo sitio público |
| `ease-out` | `cubic-bezier(.2,.8,.2,1)` | Entradas |
| `ease-in-out` | `cubic-bezier(.4,0,.2,1)` | Transformaciones |
| `spring-soft` | stiffness 260, damping 24 | Confirmaciones y "pop" de éxito |

**Microinteracciones clave**

| Momento | Animación |
| --- | --- |
| Marcar asistencia (presente/ausente/tarde) | La fila hace un "tick": el chip cambia de color con un pulso de 200 ms y vibración háptica corta (si el dispositivo lo permite) |
| Escaneo de QR exitoso | Marco de cámara se contrae al QR, luego la tarjeta del jugador sube desde abajo (320 ms) con el semáforo ya visible |
| Aprobar comprobante | La tarjeta se desliza fuera hacia la derecha y la cola se recoloca (la siguiente sube) |
| Rechazar comprobante | Desliza a la izquierda y abre la hoja de motivo |
| Recibo generado | Check dibujado con trazo (stroke-draw 500 ms), el número del recibo aparece con fundido; confeti **no** (es dinero, no fiesta) |
| Cierre de caja aprobado | Sello "Aprobado" con ligera escala 1.1 → 1 |
| Cifras del tablero | Contador animado de 0 al valor (600 ms, una sola vez al cargar) |
| Barras/anillos de progreso | Se llenan de 0 al valor con `ease-out` (500 ms) |
| Carga de listas | **Skeletons** con brillo suave (shimmer 1.4 s), nunca spinners a pantalla completa |
| Sincronización offline | Ícono de nube con puntos animados mientras sube; check al terminar |
| Cambio de pantalla (móvil) | Deslizamiento horizontal 320 ms; en escritorio, fundido 160 ms |
| Estados de botón | Pressed: escala 0.98; cargando: spinner dentro del botón y texto "Guardando…" |

**Háptica y sonido**: la vibración (Vibration API) **no funciona en iOS Safari**; es solo una mejora progresiva y **nunca** la única señal. La señal principal siempre es visual (color + ícono + texto). Los sonidos, si existen, son opcionales y están desactivados por defecto.

**Accesibilidad del movimiento**: respetar `prefers-reduced-motion` (sustituir deslizamientos por fundidos, desactivar contadores y shimmer). Nada parpadea más de 3 veces por segundo.

**Sitio público**: entradas al hacer scroll (fade-up 24 px, escalonadas 80 ms), parallax muy sutil en el hero (máx. 16 px), tarjetas que se elevan al hover, un loop discreto de "líneas de velocidad" en el fondo del hero.

### 2.6b Tokens para el hand-off, capas y foco

- **Nombres de tokens** (CSS y JSON): `--color-primary-600`, `--color-slate-700`, `--color-status-ok-text`, `--color-status-ok-bg`, `--space-4`, `--radius-card`, `--shadow-md`, `--dur-base`, `--ease-out`. Mismos nombres en Figma (variables) y en código.
- **Capas (z-index)**: contenido 0 · barra fija 10 · dropdown 20 · drawer 30 · modal/hoja 40 · toast 50 · banner de sistema 60.
- **Anillo de foco**: `2 px primary-500` con separación de 2 px (en oscuro, `primary` `#818CF8`); nunca se elimina con `outline: none` sin reemplazo.

### 2.6c Patrones de formulario y confirmación

- **Validación**: al salir del campo y al enviar; el error se explica junto al campo y se enfoca el primero con error. No se valida mientras la persona aún escribe.
- **Obligatorios**: se marcan los **opcionales** con "(opcional)", no los obligatorios con asterisco.
- **Autoguardado**: inscripción, registro de pago y comprobante guardan **borrador** local; al volver se ofrece "Continuar donde quedaste".
- **Confirmaciones**: acciones **reversibles** → sin diálogo; acciones **irreversibles o de dinero** (aprobar cierre, anular, rechazar, retirar) → hoja de confirmación con resumen del efecto; acciones **que afectan auditoría** → además **motivo obligatorio**. Los botones llevan el verbo exacto, nunca "Aceptar".
- **Envío doble**: el botón queda en carga y se bloquea hasta la respuesta (evita pagos duplicados, C5).

### 2.6d Activos de marca y PWA

Favicon (SVG + 32 px), íconos de la app 192/512 px **y versión maskable**, splash screen, color de tema (`primary-600`) y de fondo, ícono monocromo para notificaciones, imagen para compartir (OG, 1200×630) y variantes del logo (completo, símbolo, claro/oscuro). Todo debe poder sustituirse por la marca de la organización (F3) sin afectar el contraste.

### 2.6e Documentos y mensajes imprimibles

Diseñar como plantillas (PDF/correo/mensaje), no solo pantallas:

| Pieza | Debe incluir |
| --- | --- |
| **Recibo de pago** (PDF y pantalla) | Logo de la escuela, número consecutivo, fecha/hora (America/Bogota), jugador, conceptos, valor en COP, sede, responsable que recibió, medio, **"No válido como factura"** |
| **Carné imprimible** | Foto, nombre, categoría, sede, QR grande, estado al momento de imprimir **con aviso de que el estado real se ve al escanear**; versión blanco y negro |
| **Lista de habilitados para la liga** | Tabla por categoría con póliza vigente y estado de pago; encabezado de la escuela y fecha |
| **Reportes PDF** | Cabecera con filtros aplicados, tablas legibles en A4, pie con fecha y quién exportó |
| **Correo/mensaje de recibo** | Asunto claro, monto, jugador, enlace al recibo |
| **Aviso de comprobante aprobado/rechazado** | Resultado, motivo si fue rechazado, botón para subir otro |
| **Recordatorio de vencimiento / mora / póliza por vencer** | Tono configurable (cordial · neutro · firme); sin avergonzar; límite de frecuencia (§7.15) |

### 2.6f Microcopy por rol (glosario de interfaz)

| Concepto | Dueño/Auxiliar | Coordinador/Profesor | Acudiente |
| --- | --- | --- | --- |
| Deuda | Cartera vencida | Debe / En mora | **Debes** $ 157.500 |
| Pago en efectivo | Pago en efectivo | Registrar efectivo | Pagar en la sede |
| Comprobante | Comprobante | Comprobante | Foto de tu transferencia |
| Estado del jugador | Estado | Semáforo | "Al día" / "Falta pagar" |
| Póliza | Póliza | Póliza | Seguro del jugador (póliza) |

Regla general: con acudientes, **frases cortas, verbos directos y sin jerga financiera**.

### 2.7 Biblioteca de componentes

Diseñar cada uno con estados: **default, hover, focus (anillo 2 px `primary-500` + offset 2), pressed, disabled, loading, error**.

| Componente | Variantes / notas |
| --- | --- |
| **Botón** | Primario (relleno `primary-600`), Secundario (borde), Terciario (texto), Peligro (rojo, solo para "Anular" y "Rechazar"), Icono. Tamaños 40 / 48 / 56 |
| **Input / Select / Date / Moneda** | Etiqueta siempre visible (no solo placeholder); ayuda y error debajo; el input de moneda formatea `$ 157.500` al escribir y usa teclado numérico |
| **Búsqueda de jugador** | Campo único, tolerante a errores de escritura (Fuse/MiniSearch); resultados mientras se escribe con foto, nombre, categoría, sede y semáforo; atajo `Ctrl/Cmd+K` en escritorio |
| **Tarjeta de jugador** | Avatar (foto o iniciales), nombre, programa (chip de color), categoría · sede, semáforo de pago, semáforo de póliza |
| **Chip de semáforo** | Tabla de §2.2; versión compacta (solo ícono + color, con `aria-label`) y versión completa |
| **Tabla de datos** (escritorio) | Cabecera fija, filas de 52 px, ordenable, filtros en barra superior, selección múltiple, paginación (no scroll infinito), exportar a Excel/PDF; columnas de montos alineadas a la derecha |
| **Lista tarjeta** (móvil) | Sustituye a la tabla en celular; cada fila es una tarjeta con acción principal |
| **Hoja inferior (bottom sheet)** | Para formularios cortos y confirmaciones en móvil; arrastrable; foco atrapado |
| **Modal / Drawer** | Escritorio; el drawer lateral (480 px) para ver detalle sin perder la tabla |
| **Stepper** | Inscripción y registro de pago: máx. 4 pasos, barra de progreso arriba, "Atrás" siempre disponible |
| **Selector de imputación** | Para un pago de varios hijos/conceptos (C3): tabla editable con total que debe cuadrar con el valor del comprobante; el botón "Aprobar" se habilita solo cuando cuadra |
| **Visor de comprobante** | Imagen con zoom y rotación junto a los datos extraídos; marca de "posible duplicado" (C5) |
| **Motivo obligatorio** | Hoja con lista de motivos frecuentes + texto libre; requerida para anular, rechazar, becas, excepciones, bajas de inventario |
| **Toast / Snackbar** | 4 s; las acciones deshacibles (solo en UI, no en datos contables) ofrecen "Deshacer" |
| **Estado vacío** | Ilustración abstracta + una frase + una acción ("Aún no hay comprobantes. Cuando una familia suba uno, aparecerá aquí.") |
| **Estado de error** | Mensaje humano + qué hacer + botón "Reintentar"; sin códigos técnicos visibles |
| **Banner sin conexión** | Franja superior fija "Sin conexión. Tus cambios se guardan y se enviarán al volver la señal." Con contador de pendientes |
| **Chip "Pendiente de sincronizar"** | En pagos en efectivo offline (C22): reloj + "Pendiente", con la hora original; no cuenta como registrado hasta sincronizar |
| **Sello "No válido como factura"** | Obligatorio en todo recibo (D-19): línea fija al pie, `Caption`, `slate-500` |
| **Avatar** | Foto o iniciales sobre color derivado del nombre; círculo |
| **Tarjeta de KPI** | Cifra grande (Display), etiqueta, variación vs. periodo anterior, mini-gráfico opcional |
| **Gráficos** | Barras horizontales y anillos de progreso; máx. 3 colores por gráfico; etiquetas directas, no solo leyenda; alternativa tabular accesible |
| **Línea de tiempo / bitácora** | Eventos con avatar, acción, objeto, valor anterior → nuevo, dispositivo y hora |
| **Skeleton** | Para cada componente grande |
| **Carné digital** | Tarjeta vertical 3:4 con diagonal de color de programa, foto, nombre, categoría, sede, QR grande y estado de pago en vivo (ver ACU-05) |

---

## 3. Navegación y mapa de sitio

### 3.1 Patrones por rol

| Rol | Navegación | Detalles |
| --- | --- | --- |
| Dueño / Auxiliar | **Sidebar izquierdo** (colapsable, 248 px) + barra superior | Barra: selector de organización/rol, búsqueda global, notificaciones (F2), perfil. En móvil: menú hamburguesa + bottom bar de 4 atajos (Tablero, Jugadores, Pagos, Más) |
| Coordinador | **Bottom tab bar** de 5 | Inicio · Jugadores · **[+ Registrar pago]** (botón central destacado) · Caja · Más |
| Profesor | **Bottom tab bar** de 3 | Hoy (Mis grupos) · Escanear · Más |
| Acudiente / adulto | **Bottom tab bar** de 4 | Inicio (Mis jugadores) · Pagar · Carné · Más |
| Plataforma | Sidebar | Organizaciones, Planes, Facturación, Soporte, Indicadores |

- **Cambio de organización/rol**: siempre accesible desde el avatar (COM-02).
- **Migas de pan** (breadcrumbs) en escritorio dentro de fichas profundas.
- **Botón Atrás** consistente; en móvil, gesto de deslizar.
- Ítems de fases futuras: visibles pero deshabilitados con etiqueta "Próximamente" **solo** para el dueño; para los demás roles se ocultan.

### 3.2 Mapa de sitio

```
SITIO PÚBLICO
├── WEB-01 Inicio
├── WEB-02 Funcionalidades
├── WEB-03 Para quién (dueños · coordinadores · familias)
├── WEB-04 Precios
├── WEB-05 Solicitar demo / Contacto
├── WEB-06 Legales (Privacidad · Tratamiento de datos · Términos)
├── WEB-07 Estado de la conexión / 404 / Mantenimiento
└── → COM-01 Iniciar sesión (entra a la app)

APP — COMUNES
├── COM-01 Iniciar sesión / recuperar acceso
├── COM-02 Elegir organización y rol
├── COM-03 Mi perfil
├── COM-04 Notificaciones (F2)
├── COM-05 Aceptar invitación / primer ingreso (soporte*)
└── COM-06 Estados globales del sistema (soporte*)

APP — DUEÑO / AUXILIAR (escritorio)
├── DUE-01 Tablero
├── DUE-02 Sedes, categorías y grupos
├── DUE-03 Jugadores (lista) → DUE-04 Ficha del jugador
├── DUE-05 Cobros y cartera
├── DUE-06 Pagos (cola · efectivo · por asignar)
├── DUE-07 Cajas
├── DUE-08 Conciliación bancaria (F2)
├── DUE-09 Tarifas, descuentos y becas
├── DUE-10 Auditoría (bitácora F1 · alertas F2)
├── DUE-11 Reportes
├── DUE-12 Inventario (F2)
├── DUE-13 Torneos y eventos (F2)
├── DUE-14 Usuarios y roles
├── DUE-15 Configuración
├── DUE-16 Importar y exportar
└── DUE-17 Configuración inicial guiada (soporte*)

APP — COORDINADOR (celular)
├── COO-01 Inicio de la sede
├── COO-02 Inscribir jugador
├── COO-03 Buscar jugador
├── COO-04 Registrar pago
├── COO-05 Validar comprobantes
├── COO-06 Por asignar
├── COO-07 Cierre de caja
├── COO-08 Asistencia de la sede
├── COO-09 Inventario de la sede (F2)
└── COO-10 Eventos de la sede (F2)

APP — PROFESOR (celular)
├── PRO-01 Mis grupos
├── PRO-02 Tomar asistencia
├── PRO-03 Escanear carné
├── PRO-04 Ficha rápida
├── PRO-05 Solicitar material (F2)
└── PRO-06 Evaluaciones y partidos (F4)

APP — ACUDIENTE / JUGADOR ADULTO (celular)
├── ACU-01 Mis jugadores
├── ACU-02 Estado de cuenta
├── ACU-03 Pagar o subir comprobante
├── ACU-04 Recibos e historial
├── ACU-05 Carné digital y póliza
├── ACU-06 Documentos del jugador
├── ACU-07 Datos y autorizaciones
├── ACU-08 Eventos y torneos (F2)
├── ACU-09 Avisos de la escuela (F2)
└── ACU-10 Boletín del jugador (F4)

APP — PLATAFORMA (escritorio)
├── PLA-01 Organizaciones
├── PLA-02 Planes y límites (F3)
├── PLA-03 Facturación de suscripciones (F3)
├── PLA-04 Soporte (F3)
└── PLA-05 Indicadores de uso (F3)
```

Total de pantallas de la app: **51** (4 + 16 + 10 + 6 + 10 + 5), idéntico a `producto.md` §9. Más 7 páginas del sitio público.

\* **Pantallas de soporte** (COM-05, COM-06, DUE-17): no están listadas en `producto.md` §9, pero se derivan de otros apartados (flujo 10.1, §5, §14) y son necesarias para que el producto funcione. Se diseñan igual; no cuentan en las 51.

### 3.3 Contenido de los menús "Más"

| Rol | Entradas del menú "Más" |
| --- | --- |
| Coordinador | Asistencia de la sede (COO-08) · Inventario (COO-09, F2) · Eventos (COO-10, F2) · Por asignar (COO-06) · Notificaciones (COM-04) · Mi perfil (COM-03) · Cambiar organización/rol (COM-02) · Ayuda |
| Profesor | Ficha rápida/buscar jugador (PRO-04) · Solicitar material (PRO-05, F2) · Evaluaciones y partidos (PRO-06, F4) · Notificaciones · Mi perfil · Cambiar organización/rol · Ayuda |
| Acudiente | Recibos e historial (ACU-04) · Documentos (ACU-06) · Datos y autorizaciones (ACU-07) · Eventos (ACU-08, F2) · Avisos (ACU-09, F2) · Boletín (ACU-10, F4) · Notificaciones · Mi perfil · Ayuda |

La entrada **Ayuda** abre una guía corta (§7.5 de este documento) y un contacto de soporte con horario definido (§14 de `producto.md`).

---

## 4. Sitio público (marketing)

**Objetivo del sitio:** que un dueño de escuela se reconozca en el problema ("¿cuánto efectivo entró en cada sede?") y pida una demo. **No** es para padres.

**Tono de voz:** directo, tranquilo, de "aliado que entiende tu operación". Tuteo o usted neutro, español de Colombia. Sin tecnicismos. Cifras concretas.

**Estructura global**
- **Header** (sticky, transparente sobre el hero y blanco con sombra al hacer scroll): logo · Funcionalidades · Para quién · Precios · [Iniciar sesión] (terciario) · **[Solicitar demo]** (primario).
- **Footer**: columnas Producto / Legal / Contacto; selector de idioma no necesario (solo español); aviso "Hecho en Colombia".
- **Móvil**: hamburguesa a pantalla completa; CTA "Solicitar demo" siempre visible como botón fijo inferior tras pasar el hero.

### WEB-01 · Inicio
- **Objetivo:** explicar la propuesta en 10 segundos y llevar a demo.
- **Secciones (de arriba a abajo):**
  1. **Hero** (fondo `primary-900` con líneas de velocidad): titular grande, p. ej. *"Sabe quién entrena, quién paga y cuánto efectivo hay en cada sede."* Subtítulo: *"La plataforma para dueños de escuelas deportivas: control de jugadores, pagos y caja, sin carpetas ni Excel."* CTA primario **Solicitar demo**, CTA secundario **Ver cómo funciona** (scroll). A la derecha: mockup del tablero del dueño y de la pantalla del coordinador flotando con parallax.
  2. **Franja de deportes**: íconos de fútbol, microfútbol, baloncesto, voleibol, baile, natación, artes marciales… con el texto *"Para cualquier deporte. El control administrativo es el mismo."*
  3. **El problema** (3–4 tarjetas con ícono): Efectivo sin rastro · Transferencias de terceros que no sabes de quién son · Comprobantes por WhatsApp · Jugadores que entrenan sin estar registrados.
  4. **Cómo funciona** (3 pasos con línea de progreso animada al hacer scroll): 1) Todo jugador existe en el sistema. 2) Cada pago queda identificado. 3) Tú ves todo desde el tablero.
  5. **Funciones clave** (bento grid de 6 tarjetas, cada una con mini-animación): Efectivo y cierre de caja · Comprobantes con validación · Asistencia con carné QR · Pólizas en segundos · Estado de cuenta por jugador · Auditoría que nadie puede borrar.
  6. **Para cada rol** (pestañas Dueño / Coordinador / Profesor / Familia con captura de pantalla de cada una).
  7. **Prueba social**: logo y cita de la escuela piloto (solo con su autorización) y 3 cifras (p. ej. "4 sedes · ~200 jugadores · 0 efectivo sin recibo" — **solo si se confirman**).
  8. **Seguridad y datos de menores**: tarjeta con candado: "Cada escuela es un espacio aislado. Datos de menores protegidos (Ley 1581 de 2012)". Enlace a WEB-06.
  9. **CTA final** (banda `primary-600` con diagonal): *"Mira tu operación en 20 minutos"* → **Solicitar demo**.
- **Lleva a:** WEB-05 (demo), WEB-02, WEB-03, WEB-04, COM-01.
- **Animación:** fade-up escalonado por sección; contador animado en cifras; hero con parallax ≤ 16 px; bento con elevación al hover.
- **Estados:** responsive completo; con `prefers-reduced-motion` sin parallax ni loops.

### WEB-02 · Funcionalidades
- **Objetivo:** detalle por módulo para quien compara.
- **Secciones:** cabecera con índice de anclas (Jugadores · Dinero · Cancha · Control · Más adelante) → bloques alternados texto/captura para: Estructura y jugadores, Cobros y tarifas, Pagos y comprobantes, Efectivo y cierre de caja, Asistencia y carné, Pólizas y documentos, Reportes y auditoría. Bloque "Próximamente": conciliación bancaria, pagos en línea, inventario, torneos, módulo deportivo (con etiqueta de fase, **sin prometer fechas**).
- **Lleva a:** WEB-05 en cada bloque ("Quiero ver esto").
- **Animación:** capturas que entran con zoom suave; pestañas internas con indicador deslizante.

### WEB-03 · Para quién
- **Objetivo:** mostrar que el producto sirve a cada rol y a cada tipo de escuela.
- **Secciones:** selector grande de tres perfiles (Dueño · Coordinador/Profesor · Familias) → cada uno con "Qué dolor resuelve", 3 beneficios, una captura. Bloque "Tu escuela, tu deporte": chips de deportes y ejemplo de terminología configurable (categoría/nivel/grupo). Bloque "No es para clubes profesionales; sí para escuelas de formación con 2 o más sedes."
- **Lleva a:** WEB-05, WEB-04.

### WEB-04 · Precios
- **Objetivo:** explicar el cobro por **jugadores activos** sin sorpresas.
- **Contenido:** tabla de 5 planes (Inicial hasta 50 · Crecimiento 51–150 · Escuela 151–300 · Club 301–500 · A la medida +500) con el texto *"Sedes y usuarios ilimitados. Profesores y familias no cuestan extra."* **Precios pendientes (§15 de `producto.md`)**: mostrar "Cotiza" o un marcador hasta que se definan; el diseño debe aceptar un precio mensual y un descuento anual. Calculadora simple: slider de "jugadores activos" que resalta el plan. FAQ (qué es un jugador activo, qué pasa si paso el límite, cómo migro mis datos, pago en efectivo de las familias).
- **Lleva a:** WEB-05.
- **Animación:** el slider mueve un resaltado animado entre planes.

### WEB-05 · Solicitar demo / Contacto
- **Objetivo:** capturar al dueño.
- **Contenido:** formulario corto (nombre, correo, celular, nombre de la escuela, número de sedes, jugadores aproximados, deporte, "¿qué te gustaría resolver primero?"), aceptación de tratamiento de datos, botón **Solicitar demo**. A un lado: 3 razones para pedir demo y alternativa de contacto por WhatsApp/correo.
- **Estados:** validación en línea; envío con botón en carga; éxito con check animado y mensaje "Te escribimos en menos de 1 día hábil" (ajustar a la promesa real); error con reintento.
- **Lleva a:** confirmación en la misma página; enlace a WEB-06.

### WEB-06 · Legales
- **Páginas:** Política de privacidad, Tratamiento de datos personales (con énfasis en menores), Términos del servicio. Diseño de documento largo: índice lateral fijo, tipografía de lectura (Body L, ancho de línea 68 caracteres), fecha de última actualización.
- **Nota:** el contenido legal depende de la asesoría pendiente (Q12). Diseñar la plantilla, no el texto.

### WEB-07 · 404, error y mantenimiento
- Ilustración abstracta, mensaje humano, botón "Ir al inicio". Variante "Estamos en mantenimiento" con hora estimada.

---

### 4.1 SEO, analítica y conversión (aplica a todo el sitio)

- **SEO**: cada página lleva `title` (≤ 60 caracteres), meta descripción (≤ 155), un solo `H1`, jerarquía de títulos correcta, texto alternativo en imágenes, URLs legibles (`/precios`, `/funcionalidades`) y datos estructurados de organización. Imagen para compartir (OG) por página.
- **Rendimiento**: imágenes en WebP/AVIF con tamaños responsivos, carga diferida bajo el pliegue, hero ligero (el video/animación es opcional y con alternativa estática). Objetivo: carga rápida en 4G.
- **Analítica** (eventos que el diseño debe poder disparar): clic en **Solicitar demo** (por ubicación), inicio y envío del formulario de WEB-05, clic en WhatsApp, uso del slider de precios, profundidad de scroll en WEB-01.
- **Contacto rápido**: botón flotante de **WhatsApp** del equipo comercial (solo en el sitio público, **no** dentro de la app: el principio 9 pide un único canal oficial con las familias).
- **Cookies y datos**: aviso breve y no intrusivo, con enlace a WEB-06; sin bloquear el contenido.
- **Confianza**: mostrar un solo lugar claro con "Datos de menores protegidos" y "Cada escuela es un espacio aislado" (sin prometer certificaciones que no existan).

## 5. Pantallas de la app

### 5.1 Formato de cada ficha
- **Fase · Rol · Dispositivo**
- **Objetivo**
- **Contenido** (de arriba hacia abajo)
- **Acciones → destino**
- **Estados** (vacío · cargando · error · offline · permisos)
- **Notas visuales y de animación**
- **Casos borde** (referencia a C1–C22 de `producto.md` §8)

Todas las pantallas heredan los estados globales: skeleton al cargar, estado de error con reintento, banner sin conexión.

---

### 5.2 Comunes a todos los roles

#### COM-01 · Iniciar sesión y recuperar acceso
- **Fase:** F1 · Todos · Móvil y escritorio
- **Objetivo:** entrar rápido y sin confusión.
- **Contenido:** logo; titular "Entra a tu escuela"; campo único "Correo o celular"; botón primario **Continuar**; paso 2: código o contraseña según método definido; enlace "¿No puedes entrar?" (recuperación); pie con enlace a privacidad.
- **Acciones →** Continuar → COM-02 (si hay varias organizaciones o roles) o la pantalla de inicio del rol (DUE-01, COO-01, PRO-01, ACU-01, PLA-01).
- **Estados:** error de credenciales con mensaje claro y sin revelar si la cuenta existe; bloqueo por intentos con tiempo de espera visible; offline: "Necesitas conexión para entrar".
- **Visual:** pantalla dividida en escritorio (izquierda formulario, derecha panel `primary-900` con ilustración de movimiento); en móvil, tarjeta única sobre fondo `slate-50`. Letra grande y campo de 56 px (lo usan abuelos).
- **Animación:** el paso 2 desliza desde la derecha; el botón muestra spinner interno.
- **Casos borde:** C16 (acudiente sin acceso digital: no necesita entrar para existir; ver aviso de que puede pagar en efectivo).

#### COM-02 · Elegir organización y rol
- **Fase:** F1 · Todos con más de una organización/rol · Móvil y escritorio
- **Objetivo:** que la persona trabaje en un único contexto a la vez.
- **Contenido:** lista de tarjetas "Organización · Rol" con logo, nombre y rol (p. ej. "Argentinos Juniors — Coordinador, Sede Suba"); la última usada primero y marcada.
- **Acciones →** elegir una → pantalla de inicio de ese rol. También accesible desde el avatar para cambiar sin cerrar sesión.
- **Estados:** si solo hay una opción, la pantalla se omite.
- **Visual:** tarjetas grandes de radio 16, avatar de la organización a la izquierda, chevron a la derecha.
- **Animación:** al elegir, la tarjeta se expande y se hace transición a la pantalla destino (320 ms).
- **Casos borde:** profesor que también es acudiente; acudiente con hijos en dos escuelas (§6 de `producto.md`).

#### COM-03 · Mi perfil
- **Fase:** F1 · Todos · Móvil y escritorio
- **Contenido:** avatar (cambiar foto), nombre, correo y celular, **contacto preferido** (selector), idioma fijo español, tema claro/oscuro/automático, tamaño de letra (normal/grande), organizaciones y roles, botón **Cerrar sesión**.
- **Acciones →** Cambiar organización → COM-02; Cerrar sesión → COM-01.
- **Notas:** el tamaño de letra "grande" es especialmente relevante para acudientes mayores.

#### COM-04 · Notificaciones
- **Fase:** F2 · Todos · Móvil y escritorio
- **Contenido:** lista cronológica agrupada por "Hoy / Esta semana / Antes"; cada ítem con ícono por tipo (pago, comprobante, póliza, aviso), título, texto corto, hora y punto azul si no se ha leído; filtro por tipo; "Marcar todo como leído".
- **Acciones →** tocar un ítem lleva a la pantalla relacionada (p. ej. comprobante rechazado → ACU-03; póliza por vencer → ACU-05).
- **Estados:** vacío ("Estás al día").
- **Animación:** al marcar leído, el punto se encoge y desaparece.

#### COM-05 · Aceptar invitación / primer ingreso *(pantalla de soporte)*
- **Fase:** F1 · Todos los invitados · Móvil y escritorio
- **Objetivo:** que la persona invitada active su cuenta sin ayuda (flujo 10.1 paso 5).
- **Contenido (3 pasos cortos):** 1) **Bienvenida**: "[Escuela] te invitó como [rol]" con logo y nombre de quien invita; 2) **Crear acceso** (método de COM-01); 3) **Tratamiento de datos**: resumen en lenguaje simple, enlace a la política completa y casilla de aceptación (obligatoria para acudientes; registra fecha y versión). Después, una **mini guía** de 3 tarjetas según el rol ("Así registras un pago", "Así tomas asistencia", "Así subes un comprobante").
- **Acciones →** Aceptar y continuar → COM-02 o pantalla de inicio del rol; invitación vencida o ya usada → mensaje con "Pide una nueva invitación".
- **Estados:** enlace inválido/vencido; teléfono o correo que no coincide.
- **Visual:** pantalla limpia, un solo botón primario, ilustración abstracta; letra grande para acudientes.
- **Casos borde:** C16 (acudiente que no usará la app: la escuela puede registrarlo sin acceso).

#### COM-06 · Estados globales del sistema *(pantalla de soporte)*
Pantallas y avisos transversales que el diseñador debe resolver una sola vez y reutilizar:

| Estado | Qué ve el usuario | Acción |
| --- | --- | --- |
| **Sin permiso (403)** | "No tienes acceso a esta sección" con ilustración sobria y el rol actual | Volver al inicio / Cambiar de rol |
| **Sesión expirada** | Hoja "Tu sesión terminó" que **conserva los datos del formulario** en curso | Entrar de nuevo y volver donde estaba |
| **Primera carga sin conexión** | "Necesitas conexión la primera vez" con reintento | Reintentar |
| **Hay una actualización** | Franja "Hay una versión nueva" | Actualizar (recarga) — nunca en medio de un formulario sin guardar |
| **Instalar la app (PWA)** | Tarjeta discreta "Agrega [Nombre] a tu pantalla de inicio" con instrucciones por sistema (Android/iOS) | Instalar / Ahora no (no reaparece por 30 días) |
| **Permiso de notificaciones (F2)** | Pre-pantalla que explica el beneficio **antes** del permiso del navegador | Activar / Ahora no |
| **Permiso de cámara** | Explica para qué se usa (comprobante, QR, foto) y cómo activarlo | Abrir ajustes / Alternativa manual |
| **Organización suspendida** | Banner rojo fijo: "Esta escuela está suspendida. Puedes consultar y exportar, pero no registrar movimientos." Botones de registro **ocultos** | Exportar / Contactar |
| **Soporte con acceso activo** (visible para el Dueño) | Banner fijo "El soporte de [Nombre] tiene acceso hasta hh:mm" con **Revocar** | Revocar |
| **Mantenimiento** | Ver WEB-07 | — |

---

### 5.3 Dueño o administrador (y auxiliar, sin configuración) — escritorio

> El **auxiliar** ve las mismas pantallas, pero sin Configuración, sin anular y con permisos limitados según la matriz de §6 de `producto.md`. Los botones no permitidos **no se muestran** (no se deshabilitan sin explicación).

#### DUE-01 · Tablero
- **Fase:** F1 (alertas F2) · Dueño/Auxiliar · Escritorio
- **Objetivo:** que el dueño audite sus sedes de un vistazo (flujo 10.10).
- **Contenido:**
  1. Cabecera: saludo, selector de periodo (mes actual por defecto), selector de sede ("Todas").
  2. **Fila de KPIs** (tarjetas): Recaudo del mes vs. esperado (barra de progreso + %), Jugadores activos, Jugadores en mora, Efectivo registrado, Comprobantes por validar, Cajas pendientes de aprobar.
  3. **Comparativo por sede**: barras horizontales (una por sede) con recaudo, activos y mora; clic en una sede filtra todo el tablero.
  4. **Alertas** (F2; en F1 espacio reservado con "Pronto"): lista priorizada (jugadores que asisten sin pago al día, cajas con diferencia, comprobantes repetidos, anulaciones por usuario, pagos sin asignar).
  5. **Pendientes de acción**: comprobantes por validar (con conteo), cierres por aprobar, **solicitudes** del coordinador (anulaciones, reembolsos, becas, excepciones de mora, reapertura de caja → DUE-06 pestaña *Solicitudes*).
  5b. **Primeros pasos** (hasta completar la configuración): checklist → DUE-17.
  6. **Actividad reciente** de la bitácora (últimos 10 eventos).
- **Acciones →** KPI Comprobantes → DUE-06 (pestaña Cola); Cajas → DUE-07; Jugadores en mora → DUE-05 filtrado; Sede (barra) → tablero filtrado; Alerta → pantalla relacionada; "Ver bitácora" → DUE-10.
- **Estados:** sin datos (primer día): tarjeta "Empieza cargando tus sedes y jugadores" con enlace a DUE-02/DUE-16; cargando: skeletons; error parcial: la tarjeta que falla muestra "No se pudo cargar" sin romper las demás.
- **Visual:** KPIs con cifra `Display`; el valor de **mora** en rojo solo si > 0; cada tarjeta clickeable con elevación al hover; en `dark` los gráficos usan tonos 300.
- **Animación:** contadores animados una vez; barras se llenan; tarjetas de pendientes con "latido" sutil (1 vez) si hay elementos nuevos.
- **Casos borde:** C20 (diferencia de caja visible y atribuida).

#### DUE-02 · Sedes, categorías y grupos
- **Fase:** F1 · Dueño (editar) / Auxiliar (ver) · Escritorio
- **Contenido:** **árbol** Organización → Programa/Deporte → Sede → Categoría → Grupo en panel izquierdo; panel derecho con el detalle del nodo: para sede (dirección, escenario, coordinador, horarios), para categoría (nombre, rango por año/nivel), para grupo (horario, profesor, cupo, jugadores). Botón **+ Agregar** contextual. Vista alterna "Calendario de temporada" con pausas (diciembre–enero, C13).
- **Acciones →** Grupo → lista de jugadores del grupo (DUE-03 filtrado); Coordinador/Profesor → DUE-14; Cerrar sede (conserva historial, pide confirmación y motivo).
- **Estados:** vacío con guía "Crea tu primera sede"; confirmaciones para cerrar sede.
- **Visual:** nodos con ícono de deporte y color de programa; arrastrar para reordenar; terminología editable (el rótulo "Categoría" puede cambiar a "Nivel" o "Grupo" por escuela — **usar siempre etiquetas desde configuración**).
- **Animación:** el árbol expande/colapsa con 200 ms; el panel derecho hace fundido al cambiar de nodo.
- **Casos borde:** un grupo pertenece a una sola sede.

#### DUE-03 · Jugadores (lista)
- **Fase:** F1 · Dueño/Auxiliar · Escritorio
- **Objetivo:** responder rápido "¿quién existe y en qué estado está?".
- **Contenido:** barra de búsqueda grande (tolerante a errores de escritura) con atajo `Ctrl+K`; filtros: sede, programa, categoría, grupo, estado (preinscrito/activo/en mora/pausado/retirado), mora, sin póliza, póliza por vencer; **tabla** (foto, nombre, documento, programa, categoría, sede, acudiente responsable, semáforo de pago, semáforo de póliza, estado); contador "N jugadores"; botones **+ Inscribir** (→ COO-02 versión escritorio) y **Exportar**.
- **Acciones →** fila → DUE-04; Inscribir → flujo de inscripción (§6.1); Exportar → descarga con vista previa de columnas.
- **Estados:** vacío con CTA a DUE-16 (importar); sin resultados ("No encontramos ese nombre. ¿Quisiste decir…?"); cargando con skeleton de filas.
- **Visual:** filas de 52 px; chips de color de programa; la fila de un jugador en mora lleva una línea roja de 3 px a la izquierda; selección múltiple para acciones masivas (exportar, cambiar de grupo).
- **Animación:** la lista filtra con fundido 120 ms (sin saltos); resaltar coincidencia de búsqueda.
- **Casos borde:** detección de duplicados al crear; C12 retirado conserva historial y aparece con filtro "Retirados".

#### DUE-04 · Ficha del jugador
- **Fase:** F1 · Dueño/Auxiliar · Escritorio (drawer o página)
- **Objetivo:** todo sobre un jugador en una sola vista; también responde "¿debe algo?" en < 15 s y "dame la póliza" en < 1 min.
- **Contenido:**
  - **Cabecera**: foto grande, nombre, documento, edad, programa/categoría/sede/grupo, estado, **semáforo de pago** y **semáforo de póliza** muy visibles; botones **Registrar pago**, **Editar**, **Más ▾** (pausar/congelar, retirar, cambiar de sede/categoría/grupo).
  - **Hojas de acción del menú Más**: *Congelar* (fechas de inicio y fin + motivo; no genera cobros en ese lapso, C13) · *Cambiar de sede o categoría* (muestra "El mes en curso conserva la tarifa de origen; el nuevo valor rige desde el [fecha]", C10) · *Retirar* (motivo; conserva deuda e historial, C12) · *Reingresar* (reactiva el mismo perfil y avisa si se cobra matrícula de nuevo).
  - **Pestañas**: *Resumen* · *Estado de cuenta* · *Acudientes* · *Documentos y póliza* · *Asistencia* · *Historial y bitácora*.
  - **Resumen**: saldo pendiente, último pago, próxima fecha de cobro, asistencia del mes, alertas.
  - **Estado de cuenta**: tabla de cobros (concepto, periodo, valor, abonos, saldo, estado) y de pagos aplicados; saldo a favor si existe (C2).
  - **Acudientes**: lista con parentesco, responsable de pago, personas autorizadas a pagar (C4, C17).
  - **Documentos y póliza**: tarjeta de póliza (número, aseguradora, vigencia, vista previa, **Descargar/Compartir**); otros documentos con estado.
  - **Asistencia**: calendario con puntos de colores y porcentaje.
  - **Historial y bitácora**: línea de tiempo de eventos del jugador.
- **Acciones →** Registrar pago → flujo COO-04 (versión escritorio); Ver comprobante → visor; Anular un pago → hoja de motivo (solo Dueño); Ver evento en bitácora → DUE-10 filtrado.
- **Estados:** jugador sin póliza: tarjeta roja "Sin póliza — Subir"; retirado: banner gris "Retirado el dd/mm/aaaa" con opción "Reingresar" (C12).
- **Visual:** cabecera con diagonal y color de programa; los montos en rojo solo si están en mora; **la póliza vencida aparece antes de que alguien la pida** (flujo 10.8) como banner rojo.
- **Animación:** cambio de pestaña con indicador deslizante y fundido; el semáforo "pulsa" una vez si cambia de estado.
- **Casos borde:** C1, C2, C4, C8, C9, C10, C12, C13, C15, C17, C19.

#### DUE-05 · Cobros y cartera
- **Fase:** F1 · Dueño/Auxiliar · Escritorio
- **Objetivo:** saber quién debe cuánto (D12).
- **Contenido:** KPIs (Por cobrar, Por vencer, Vencida, Recaudado del mes); pestañas **Cuentas por cobrar · Cartera vencida · Morosos por sede**; tabla (jugador, familia, concepto, vencimiento, valor, saldo, días de mora, semáforo); botón **Generar cobro** (manual: uniforme, torneo — a un jugador o a una categoría completa); agrupar por familia (hermanos, C15).
- **Acciones →** fila → DUE-04 pestaña Estado de cuenta; Generar cobro → hoja con concepto, alcance y valor; Exportar → Excel/PDF.
- **Estados:** vacío (texto sobrio "Cartera al día", sin emojis ni celebraciones); filtro por sede preseleccionado para Auxiliar si aplica.
- **Visual:** el aging (0–30, 31–60, 60+) como barra apilada de 3 tonos de la rampa roja; montos alineados a la derecha, tabulares.
- **Casos borde:** C1, C2, C9, C11, C13, C15.

#### DUE-06 · Pagos
- **Fase:** F1 · Dueño/Auxiliar · Escritorio
- **Objetivo:** gestionar todo lo que entra.
- **Contenido:** pestañas **Cola de comprobantes** (con conteo) · **Efectivo** · **Por asignar** (con conteo) · **Solicitudes** (con conteo) · **Todos**; la pestaña *Solicitudes* es la cola del Dueño para decidir lo que el coordinador **solicita** (anulación o reembolso con motivo, beca, excepción de mora con fecha prometida, reapertura de caja): cada tarjeta muestra quién, qué, por qué y el efecto, con **Aprobar / Rechazar (motivo)**; filtros por sede, medio, estado, fechas, monto; en *Cola*: lista a la izquierda y **visor de comprobante** a la derecha con datos (jugador sugerido, fecha, hora, valor, medio, referencia) y botones **Aprobar** / **Rechazar** (motivo). Marca visible "Posible duplicado" (C5).
- **Acciones →** Aprobar → pago aplicado al cobro más antiguo (C1) y recibo; Rechazar → hoja de motivo y notificación al acudiente; Reasignar → selector de jugador/sede; Anular un pago (solo Dueño) → hoja de motivo (C7); fila → DUE-04.
- **Estados:** cola vacía "Todo validado"; imágenes ilegibles: botón "Pedir otro comprobante".
- **Visual:** layout 40/60 (lista/visor); atajos de teclado (`A` aprobar, `R` rechazar, `↓` siguiente) con ayuda visible; selector de imputación para varios hijos (C3).
- **Animación:** al aprobar, la tarjeta sale a la derecha y la siguiente sube.
- **Casos borde:** C1, C3, C4, C5, C6, C7, C8, C20.

#### DUE-07 · Cajas
- **Fase:** F1 · Dueño/Auxiliar · Escritorio
- **Contenido:** pestañas **Pendientes de aprobar · Abiertas · Historial**; tabla por sede/periodo (coordinador responsable, total registrado, efectivo entregado/consignado, **diferencia**, estado, días abierta); al abrir un cierre: detalle de movimientos, soporte de consignación (imagen), diferencia con atribución al responsable y botones **Aprobar** / **Devolver con observación**.
- **Acciones →** Aprobar → sello "Aprobado" (inmutable; reabrir solo con el Dueño, C20); movimiento → detalle de pago → DUE-04; Alerta de caja abierta muchos días → resaltada.
- **Visual:** la diferencia ≠ 0 en rojo con ícono y texto "Faltante"/"Sobrante"; cajas con más de N días abiertas con borde ámbar.
- **Casos borde:** C7, C20, C21 (antes de desactivar un coordinador, caja cerrada o traspasada).

#### DUE-08 · Conciliación bancaria
- **Fase:** F2 · Dueño/Auxiliar · Escritorio
- **Contenido:** carga de extracto (arrastrar archivo, con vista previa); 3 columnas/pestañas: **Conciliados · Movimientos sin identificar · Pagos sin movimiento**; para cada movimiento sin identificar: asignación manual a jugador (el sistema "recuerda" al pagador, mostrar chip "Recordado"); reporte mensual.
- **Acciones →** Asignar → crea el vínculo; Cerrar mes → reporte PDF/Excel; diferencias abiertas hasta explicarse.
- **Visual:** vista de **dos paneles lado a lado** (banco vs. plataforma) con líneas de conexión animadas al cruzar.
- **Casos borde:** C4, C5; movimiento ya conciliado no se reutiliza.
- **En F1:** ítem de menú "Próximamente".

#### DUE-09 · Tarifas, descuentos y becas
- **Fase:** F1 · Dueño (editar/aprobar) / Auxiliar (ver) · Escritorio
- **Contenido:** pestañas **Conceptos y tarifas · Planes · Descuentos · Becas**; tabla de conceptos (matrícula, mensualidad, semestral, uniforme, póliza, torneo, traslado) con valor por sede/categoría y **vigencia**; **historial de versiones** (las tarifas son versionadas, C11); en Becas: lista con porcentaje (10/20/50/80/100), motivo, vigencia, estado y **solicitudes pendientes de aprobación**.
- **Acciones →** Nueva tarifa → hoja con "rige desde" (nunca retroactivo); Aprobar/Rechazar beca → hoja de motivo; ver jugadores con un beneficio → DUE-03 filtrado.
- **Visual:** línea de tiempo de versiones de tarifa; el selector de beneficio muestra **un solo** beneficio (Q16).
- **Casos borde:** C9, C10, C11, C14, C15.

#### DUE-10 · Auditoría
- **Fase:** F1 bitácora · F2 alertas · Dueño/Auxiliar (Auxiliar solo ve) · Escritorio
- **Contenido:** pestañas **Alertas** (F2) · **Bitácora**. *Bitácora*: filtros por usuario, sede, jugador, tipo de acción y fechas; tabla/línea de tiempo (quién, qué, cuándo, **valor anterior → nuevo**, dispositivo); exportar. *Alertas*: tarjetas priorizadas por severidad con la acción sugerida (jugadores que asisten sin pago al día, efectivo vs. activos por sede, cajas sin cerrar, comprobantes rechazados/repetidos, anulaciones por usuario, becas por sede, pagos sin asignar, jugadores con pagos pero sin asistencia).
- **Acciones →** cada evento/alerta enlaza al objeto (DUE-04, DUE-06, DUE-07).
- **Visual:** la bitácora es **solo lectura**; banner fijo "Este registro no se puede editar ni borrar". Diferencias en dos colores (anterior tachado en gris, nuevo en negrita).
- **Casos borde:** registra siempre anulaciones, aprobaciones, cambios de tarifa, becas, cambios de rol, accesos de soporte.

#### DUE-11 · Reportes
- **Fase:** F1 · Dueño / Auxiliar (financiero) · Escritorio
- **Contenido:** catálogo de reportes en tarjetas: Recaudo (por sede, concepto, medio, periodo), Jugadores activos (por sede y categoría), Morosos, Cierres de caja, Asistencia, **Pólizas por categoría** (jugador, aseguradora, número, vigencia, estado; **exportable para inscribir equipos en la liga**, §7.5; resalta vencidas y por vencer). Al abrir uno: filtros arriba, gráfico (barras/anillos) y tabla debajo, botones **Exportar Excel/PDF**.
- **Acciones →** puntos del gráfico filtran la tabla; filas enlazan a DUE-04/DUE-07.
- **Visual:** gráficos limpios, máx. 3 colores, etiquetas directas, tabla accesible alternativa.

#### DUE-12 · Inventario
- **Fase:** F2 · Dueño (editar) / Auxiliar (ver) · Escritorio
- **Contenido:** existencias por sede (balones, petos, conos, uniformes por talla), alerta de mínimo, movimientos (entradas, salidas a profesor/jugador, préstamos con responsable, bajas con motivo), **conteo físico** con diferencias.
- **Acciones →** Registrar entrada/salida/baja (hoja con responsable y motivo obligatorios); uniforme entregado enlaza a cobro del jugador → DUE-04.
- **Visual:** el nombre de artículo es genérico (no solo "balón"): ícono configurable por deporte (aros, conos, redes, colchonetas…).

#### DUE-13 · Torneos y eventos
- **Fase:** F2 · Dueño/Auxiliar · Escritorio
- **Contenido:** lista de eventos (tarjeta con fecha, sede, categorías, cupo ocupado, recaudo); crear evento (fecha, sede, categorías, cupo, costos de inscripción y traslado); detalle: inscritos con estado de pago y **lista de habilitados** (póliza vigente y pagos al día); botón **Cerrar inscripciones** y **Exportar lista para la liga**.
- **Acciones →** Inscrito → DUE-04; Crear cobro del evento (independiente de la mensualidad); Excepción por póliza vencida con motivo (C19).
- **Visual:** barra de cupo con porcentaje; chips verde "Habilitado" / rojo "No habilitado" con motivo.

#### DUE-14 · Usuarios y roles
- **Fase:** F1 · Dueño (editar) / Auxiliar (ver) · Escritorio
- **Contenido:** tabla de usuarios (nombre, rol, alcance —sedes/grupos—, estado, último acceso); **Invitar** (correo o celular, rol, alcance); desactivar (conserva historial; coordinador con caja abierta pide cerrar/traspasar, C21); cada cambio de rol queda en la bitácora.
- **Acciones →** Invitar → hoja de 3 pasos; Ver permisos del rol → panel con la matriz resumida.
- **Estados:** invitaciones pendientes con "Reenviar".

#### DUE-15 · Configuración
- **Fase:** F1 (marca F3) · Solo Dueño · Escritorio
- **Contenido:** secciones con navegación interna: **Organización** (datos, registro IDRD, contacto) · **Políticas** (efectivo: quién lo recibe y en qué fechas; mora: alerta o bloqueo, días de gracia; ciclo de cobro: mes calendario o desde ingreso; prorrateo; reingreso/matrícula; acumulación de beneficios) · **Calendario de temporada** · **Documentos requeridos** · **Plantillas de mensajes** (editor con vista previa de variables) · **Marca** (logo y color, F3) · **Terminología** (categoría/nivel/grupo).
- **Acciones →** guardar muestra resumen de cambios y los registra en bitácora.
- **Visual:** cada política con un **ejemplo en vivo** ("Con 5 días de gracia, un cobro del 5 se marca en mora el 10"); toggles claros y textos de ayuda.
- **Casos borde:** C9, C12, C13, C14, C18.

#### DUE-16 · Importar y exportar
- **Fase:** F1 asistida · F3 autoservicio · Dueño/Auxiliar · Escritorio
- **Contenido:** **Importar**: (F1) estado de la carga asistida (barra de progreso por paso: jugadores, acudientes, tarifas, saldos, pólizas) y **reporte de errores**; (F3) plantillas descargables, arrastrar archivo, **vista previa**, duplicados detectados antes de confirmar. **Exportar**: jugadores, pagos, asistencia (formato y rango), y copia completa de datos.
- **Acciones →** Confirmar importación solo tras la vista previa; errores enlazan a la fila de origen.
- **Visual:** estado paso a paso (stepper vertical) con colores del semáforo.

#### DUE-17 · Configuración inicial guiada *(pantalla de soporte)*
- **Fase:** F1 · Dueño · Escritorio
- **Objetivo:** que el dueño deje la escuela lista (flujo 10.1 pasos 2 y 3; §5 de `producto.md`).
- **Contenido:** asistente con **checklist lateral** y barra de progreso: 1) Sedes y coordinadores · 2) Programas, categorías y grupos · 3) Conceptos, tarifas y planes · 4) Políticas (efectivo, mora, ciclo de cobro) · 5) Usuarios (profesores, auxiliar) · 6) Carga de datos (→ DUE-16) · 7) Invitar a coordinadores, profesores y acudientes. Cada paso reutiliza el formulario de su pantalla definitiva (DUE-02, DUE-09, DUE-15, DUE-14).
- **Acciones →** cada paso lleva a su pantalla y regresa al asistente; al terminar, → DUE-01.
- **Estados:** progreso guardado; se puede salir y volver; pasos opcionales marcados.
- **Visual:** tarjeta de bienvenida amable; checks que se dibujan al completar; el checklist queda como tarjeta "Primeros pasos" en DUE-01 hasta que se complete.

---

### 5.4 Coordinador de sede — celular

> Usa **bottom tab bar**: Inicio · Jugadores · **[+ Pago]** · Caja · Más. Solo ve **su sede**. Nunca aprueba su propio cierre ni anula pagos (puede **solicitar** anulación con motivo).

#### COO-01 · Inicio de la sede
- **Fase:** F1 · Coordinador · Celular
- **Contenido:** saludo + nombre de la sede; **tarjeta de caja abierta** (monto registrado, días abierta, botón **Cerrar caja**); tarjetas de pendientes del día con contador: Comprobantes por validar, Por asignar, **Preinscripciones por aprobar** (jugadores que un acudiente inscribió desde ACU-01; al abrir: revisar datos, asignar grupo y plan, **Aprobar/Rechazar**), Morosos, Jugadores sin póliza, **Mis solicitudes** (anulaciones o excepciones enviadas al dueño y su estado); acciones rápidas (Registrar pago, Inscribir, Buscar); resumen de asistencia de hoy.
- **Acciones →** cada tarjeta → su pantalla (COO-05, COO-06, COO-03 filtrado, COO-07, COO-08).
- **Estados:** "Hoy no hay pendientes" con ilustración sobria.
- **Visual:** tarjetas de 72 px de alto, números grandes, color semántico solo en el contador; botón central **+ Pago** en `primary-600` con sombra `lg`, flotando sobre la barra.
- **Animación:** pull-to-refresh; contadores con "tick" al cambiar.
- **Casos borde:** C6 (comprobantes en bandeja única), C21.

#### COO-02 · Inscribir jugador
- **Fase:** F1 · Coordinador (y escritorio dueño/auxiliar) · Celular
- **Objetivo:** inscripción en pocos pasos (flujo 10.2).
- **Contenido (stepper de 4 pasos con barra de progreso):**
  1. **Jugador**: nombres, documento, fecha de nacimiento, foto (cámara), contacto de emergencia, datos médicos básicos. Al escribir el documento se **detecta duplicado** (aviso con tarjeta "¿Es este jugador?").
  2. **Acudiente**: buscar uno existente o crear; parentesco; responsable de pago; personas autorizadas a pagar.
  3. **Plan y grupo**: sede, programa, categoría, grupo, plan de pago, beneficio (un solo selector; las becas quedan "por aprobar" por el Dueño). Desglose del cobro (incluye prorrateo si entra a mitad de mes, C9).
  4. **Documentos y consentimiento**: tratamiento de datos (el acudiente acepta), subir póliza/documentos por foto. **Resumen** y botón **Inscribir**.
- **Acciones →** Inscribir → ficha del jugador (COO-03) con **carné digital creado** y **matrícula pendiente**; "Cobrar matrícula ahora" → COO-04 precargado.
- **Estados:** borrador guardado automáticamente; offline: no se puede finalizar (se guarda el borrador y avisa).
- **Visual:** una pregunta importante por pantalla, campos de 56 px, teclado correcto por campo, "Siguiente" fijo abajo.
- **Animación:** transición deslizante entre pasos; el check de cada paso se dibuja al completarse.
- **Casos borde:** C9, C14/Q16, C15 (descuento hermanos), C17.

#### COO-03 · Buscar jugador
- **Fase:** F1 · Coordinador · Celular
- **Contenido:** campo de búsqueda grande y autofoco (tolerante a errores: "Sanchés" encuentra "Sánchez"); chips de filtro rápido (Todos, En mora, Sin póliza); resultados como tarjetas de jugador; al abrir una: **ficha corta** con foto, semáforo de pago, estado de cuenta resumido, carné, póliza y botones **Registrar pago**, **Ver carné**, **Ver póliza**.
- **Acciones →** Registrar pago → COO-04 precargado; Ver póliza → visor + **Compartir** (flujo 10.8, objetivo < 1 min); excepción de mora → hoja con motivo y fecha prometida (C18); **Solicitar anulación** de un pago → hoja de motivo que crea una solicitud para el Dueño (el coordinador no anula); **Congelar** o **cambiar de grupo** (según permisos de su sede).
- **Estados:** sin resultado: "No está registrado. ¿Inscribirlo?" → COO-02 (principio "si no está en la app, no existe").
- **Casos borde:** C12, C16, C19.

#### COO-04 · Registrar pago
- **Fase:** F1 · Coordinador (y escritorio) · Celular
- **Objetivo:** pago registrado en < 1 min (flujo 10.5).
- **Contenido (3 pasos):**
  1. **¿Quién?**: buscar jugador (o familia con varios hijos).
  2. **¿Qué paga?**: conceptos pendientes con casillas (por defecto el más antiguo marcado, C1); opción "Abono" con valor libre; si es un solo pago para varios hijos, repartir (C3); saldo a favor si paga de más (C2).
  3. **¿Cómo?**: segmentado **Efectivo | Comprobante**. *Efectivo*: valor recibido y resumen; *Comprobante*: foto, fecha, hora, valor, medio, referencia y quién paga (tercero autorizado, C4).
  - **Confirmación**: resumen grande del monto y botón **Registrar pago**.
- **Salida:** pantalla de **recibo** (efectivo) con número consecutivo, jugador, conceptos, valor, fecha, sede, responsable y la línea **"No válido como factura"**; botones **Compartir/Imprimir** y **Nuevo pago**. Comprobante → entra a la cola y se muestra "Enviado a validación".
- **Estados:** offline: el pago en efectivo queda **"Pendiente de sincronizar"** con la hora original y **sin número de recibo** hasta sincronizar (C22); si el medio es transferencia y se detecta posible duplicado, aviso (C5).
- **Visual:** teclado numérico grande para valor, total siempre visible en una barra inferior pegajosa; el botón **Registrar** es de 56 px y solo se activa cuando todo cuadra.
- **Animación:** al registrar, check dibujado y el número de recibo aparece con fundido (sin celebraciones).
- **Casos borde:** C1, C2, C3, C4, C5, C16 (recibo impreso o a otro familiar), C22.

#### COO-05 · Validar comprobantes
- **Fase:** F1 · Coordinador (y escritorio) · Celular
- **Contenido:** contador "N por validar"; **cola** de tarjetas: foto del comprobante (toca para ampliar con zoom), datos extraídos, **jugador sugerido** (confirmable/cambiable), alertas ("Posible duplicado", "Valor distinto al cobro"); botones **Aprobar** (primario) y **Rechazar** (motivo obligatorio). Gestos: deslizar derecha = aprobar, izquierda = rechazar (con confirmación).
- **Acciones →** Aprobar → pago aplicado y notificación; Rechazar → hoja de motivo; "No es de mi sede" → reenvía a **Por asignar** (C6).
- **Estados:** cola vacía "Todo validado".
- **Casos borde:** C3, C4, C5, C6.

#### COO-06 · Por asignar
- **Fase:** F1 · Coordinador (cualquier coordinador autorizado) · Celular
- **Contenido:** bandeja **única de la organización** (C6) con comprobantes/pagos sin jugador identificado, antigüedad (alerta si supera N días), foto y datos; acción **Asignar a jugador** (buscador) y **Reasignar a otra sede**.
- **Visual:** chip de antigüedad (verde < 2 días, ámbar 2–N, rojo > N).
- **Casos borde:** C4, C6.

#### COO-07 · Cierre de caja
- **Fase:** F1 · Coordinador (registra) · Celular
- **Contenido:** periodo y sede; **lista de pagos en efectivo** del periodo (con anulaciones que entran en el siguiente cierre, C7); total registrado; campo **efectivo entregado/consignado**; adjuntar **soporte** (foto de consignación); **diferencia** calculada en grande con color; botón **Enviar cierre**.
- **Acciones →** Enviar → estado "En revisión por el dueño" (no se puede editar); si el Dueño lo devuelve, aparece la observación.
- **Estados:** sin pagos en efectivo: "No hay efectivo por cerrar"; diferencia ≠ 0: pide nota explicativa antes de enviar (queda atribuida al coordinador, C20).
- **Visual:** la diferencia en `Display`: verde si 0, rojo si ≠ 0.
- **Casos borde:** C7, C20, C21, C22 (los pendientes de sincronizar no entran hasta sincronizarse).

#### COO-08 · Asistencia de la sede
- **Fase:** F1 · Coordinador · Celular
- **Contenido:** selector de fecha/periodo; resumen por grupo (anillo de % asistencia y puntualidad); lista de jugadores con su asistencia; **marcas de mora** visibles en quienes asistieron en mora (nunca ocultas); editar asistencia de la sede (con motivo).
- **Acciones →** Grupo → lista detallada; Jugador → COO-03.
- **Casos borde:** C18.

#### COO-09 · Inventario de la sede
- **Fase:** F2 · Coordinador · Celular
- **Contenido:** existencias por artículo, alerta de mínimo; **Registrar entrega** (a profesor o jugador, con responsable), **Registrar baja** (motivo obligatorio), solicitudes de profesores pendientes.

#### COO-10 · Eventos de la sede
- **Fase:** F2 · Coordinador · Celular
- **Contenido:** eventos con su cupo y estado; lista de inscritos y quién ha pagado; registrar pago del evento (→ COO-04 precargado).

---

### 5.5 Profesor o entrenador — celular

> **Nunca ve montos ni datos bancarios.** Solo ve el **semáforo** de pago y de póliza. Pantallas pensadas para uso al aire libre, de pie, con una mano y a veces **sin conexión**.

#### PRO-01 · Mis grupos
- **Fase:** F1 · Profesor · Celular
- **Contenido:** "Hoy" con tarjetas de grupos del día (hora, lugar, categoría, nº de jugadores, estado: pendiente/en curso/asistencia tomada); luego "Próximos". Indicador de sincronización.
- **Acciones →** Tocar grupo → PRO-02; botón flotante **Escanear** → PRO-03.
- **Estados:** sin grupos hoy: "Hoy no tienes entrenamientos"; offline: funciona con la lista cacheada y lo indica en la franja superior.
- **Visual:** el grupo "en curso" se destaca con borde `primary-600` y chip "Ahora"; tarjetas grandes.

#### PRO-02 · Tomar asistencia
- **Fase:** F1 · Profesor · Celular
- **Objetivo:** asistencia de un grupo en pocos minutos, sin conexión (flujo 10.7).
- **Contenido:** cabecera con grupo, fecha y hora; lista de jugadores con **foto, nombre y semáforo de pago/póliza**; control de 3 estados por fila (**Presente · Tarde · Ausente**) con botones grandes; botón "Marcar todos presentes"; contador "18/22"; botón fijo inferior **Guardar asistencia**.
- **Acciones →** tocar jugador → PRO-04; **Escanear** → PRO-03; jugador no encontrado → "No está en la lista" → aviso y pedir al coordinador que lo registre.
- **Estados:** **offline**: franja "Sin conexión — se guardará y sincronizará"; al guardar, queda "Pendiente de sincronizar" y luego se confirma; jugador **en mora**: alerta (ámbar/rojo) pero se registra igual y queda marcado; si la política es **bloqueo**, la fila muestra "Requiere autorización del coordinador" (C18).
- **Visual:** filas de 64 px con avatar; los 3 estados como segmento de colores (verde/ámbar/gris) con ícono y texto; alto contraste para sol.
- **Animación:** el segmento hace "pop" al tocar + vibración háptica corta; al guardar, check y chip de sincronización.
- **Casos borde:** C18, C22.

#### PRO-03 · Escanear carné
- **Fase:** F1 · Profesor (y coordinador) · Celular
- **Contenido:** **cámara a pantalla completa** con marco guía y linterna; al leer un QR: **tarjeta inferior** con foto, nombre, categoría, **semáforo de pago** y **semáforo de póliza** y botón **Marcar presente**; si el jugador **no existe**: tarjeta roja "Este jugador no está registrado" con botón "Avisar al coordinador".
- **Acciones →** Marcar presente → registra asistencia y vuelve a escanear; "Ver ficha" → PRO-04.
- **Estados:** permiso de cámara denegado → pantalla guía con alternativa "Buscar por nombre"; QR ilegible → reintentar; offline: valida contra la caché local con la hora de la última sincronización visible.
- **Visual:** el resultado ocupa ≥ 40 % de la pantalla; **verde/ámbar/rojo** con ícono y mensaje claro ("Al día — Puede entrenar" / "En mora desde hace 12 días").
- **Animación:** marco se contrae al detectar; tarjeta sube 320 ms; vibración distinta por estado donde el dispositivo lo permita (corta=OK, doble=alerta); en iOS solo la señal visual.
- **Casos borde:** C18, C19, C22.

#### PRO-04 · Ficha rápida
- **Fase:** F1 · Profesor · Celular
- **Contenido:** foto, nombre, categoría, **acudiente de contacto** (botón llamar/mensaje), **semáforo** de pago y póliza (sin montos), alergias/datos médicos básicos si existen. **Ningún dato financiero.**
- **Acciones →** Llamar al acudiente; Volver a PRO-02.

#### PRO-05 · Solicitar material
- **Fase:** F2 · Profesor · Celular
- **Contenido:** catálogo de artículos disponibles en la sede (con ícono), cantidad, nota; solicitudes enviadas con estado (pendiente, entregada, rechazada).
- **Acciones →** Enviar solicitud → COO-09 del coordinador.

#### PRO-06 · Evaluaciones y partidos
- **Fase:** F4 · Profesor · Celular
- **Contenido:** calificación de entrenamiento por ítems (configurables por deporte), partidos (rival, marcador, tiempo jugado), planificación mensual vs. resultados.
- **Nota:** diseño posterior; los ítems son **configurables por deporte** (no asumir fútbol).

---

### 5.6 Acudiente y jugador adulto — celular

> Es el usuario con más variedad digital. **Letra base de 17 px**, botones de 56 px, textos simples, pocas decisiones por pantalla. El **efectivo siempre es una opción válida** y se comunica con respeto ("Puedes pagar en la sede").

#### ACU-01 · Mis jugadores
- **Fase:** F1 · Acudiente · Celular
- **Contenido:** saludo; **una tarjeta por hijo/representado** (foto, nombre, sede, categoría, programa con ícono, **estado de pago grande y legible** con el semáforo y el texto "Al día" / "Debes $ 157.500" / "Vence el 10"); acceso rápido **Pagar** y **Carné** en cada tarjeta; si hay varios hijos, un resumen de **cuenta familiar** arriba; botón secundario **Inscribir otro jugador** (el acudiente llena un formulario corto de 3 pasos —jugador, datos y documentos, consentimiento— y queda **preinscrito, pendiente de aprobación** del coordinador, §7.3 y flujo 10.2).
- **Acciones →** Tarjeta → ACU-02; **Pagar** → ACU-03; **Carné** → ACU-05.
- **Estados:** sin jugadores: "Aún no tienes jugadores asociados. Pídele a la sede que te vincule."; offline: muestra el último estado con la hora.
- **Visual:** tarjetas amplias con la diagonal de color del programa; el estado de pago es lo más grande de la tarjeta.
- **Animación:** tarjetas con entrada escalonada; el semáforo "late" una vez si cambió.

#### ACU-02 · Estado de cuenta
- **Fase:** F1 · Acudiente · Celular
- **Contenido:** selector Hijo / Familia; **saldo** en grande; lista de cobros pendientes (concepto, vencimiento, valor, abonos, saldo) con semáforo; lista de pagos aplicados; saldo a favor si hay (C2); botón fijo **Pagar** o **Subir comprobante**.
- **Acciones →** Pagar → ACU-03 precargado; Pago → ACU-04 (recibo).
- **Casos borde:** C1, C2, C3, C15, C17.

#### ACU-03 · Pagar o subir comprobante
- **Fase:** F1 comprobante · F2 pago en línea · Acudiente · Celular
- **Contenido (pasos simples):**
  1. **¿Por quién paga?** (uno o varios hijos).
  2. **¿Qué paga?** (conceptos pendientes marcados por defecto; opción de abono).
  3. **¿Cómo paga?** Tres opciones con ícono grande: **Pagar en línea** (F2: botón/QR con la **referencia única** visible y copiable), **Ya transferí — subir comprobante** (F1), **Pagaré en efectivo en la sede** (muestra dirección y horario; no genera pago hasta que el coordinador lo registre).
  4. *Comprobante*: tomar/subir foto, fecha, hora, valor y referencia (autocompletar con lo posible); botón **Enviar**.
- **Acciones →** Enviar → pantalla de confirmación "Recibimos tu comprobante. Te avisamos cuando se valide." → ACU-01; ver estado → ACU-04.
- **Estados:** foto borrosa → pide repetir; **si paga un tercero** (tío/abuelo), el pagador puede entrar con su propia cuenta o usar la referencia del jugador (C4); offline: "Necesitas conexión para enviar. Tu foto se conserva." (conserva el borrador).
- **Visual:** botones de opción de **56–72 px** con ícono y subtítulo; la **referencia** en una tarjeta con botón "Copiar"; mostrar el total "Vas a pagar **$ 157.500**" siempre visible.
- **Animación:** envío con barra de progreso y check final; sin tecnicismos.
- **Casos borde:** C1, C2, C3, C4, C8, C16.

#### ACU-04 · Recibos e historial
- **Fase:** F1 · Acudiente · Celular
- **Contenido:** lista cronológica de pagos con estado (**Aprobado · Por validar · Rechazado** con motivo · **Anulado**); al abrir: **recibo** (número, fecha, concepto, valor, sede, quién recibió, línea **"No válido como factura"**) con **Descargar PDF** y **Compartir**; los pagos en efectivo registrados por el coordinador aparecen aquí (el acudiente solo **ve**, no confirma, Q9).
- **Estados:** rechazado: muestra el motivo y botón **Subir otro comprobante** → ACU-03; vacío: "Aún no hay pagos".

#### ACU-05 · Carné digital y póliza
- **Fase:** F1 · Acudiente · Celular
- **Contenido:** **carné** grande (vertical 3:4): diagonal con color del programa, foto, nombre, categoría, sede, **QR único grande**, y **estado de pago en tiempo real** (verde/ámbar/rojo con texto); al abrir, **modo alto contraste** (fondo blanco, QR negro) y la pantalla se mantiene encendida con la Wake Lock API; una PWA **no puede** subir el brillo, así que se muestra la sugerencia "Sube el brillo para que lo lean mejor"; debajo: tarjeta de **póliza** (aseguradora, número, vigencia, estado) con **Ver documento**; botón **Imprimir carné** (para quien no use celular); selector si hay varios hijos (carrusel).
- **Estados:** sin póliza: tarjeta roja "Falta la póliza — Subir"; póliza por vencer: ámbar; offline: el carné **se muestra desde la caché** con la hora de la última actualización (el QR sigue siendo válido).
- **Visual:** el estado del carné **lo calcula el sistema y no se puede alterar**; no hay "sellos". Fondo con líneas de velocidad sutiles.
- **Animación:** al abrir, el carné entra con ligera rotación 3D (320 ms) y cambia a alto contraste; el QR nunca se anima (para no estorbar el escaneo).
- **Casos borde:** C22 (sin conexión).

#### ACU-06 · Documentos del jugador
- **Fase:** F1 · Acudiente · Celular
- **Contenido:** lista de documentos requeridos por la escuela (documento de identidad, póliza, autorización de datos, certificado médico) con estado (Recibido/Falta/Por vencer/Vencido); **Subir** con cámara y recorte automático; ver documentos ya cargados.
- **Visual:** lista tipo checklist con progreso "3 de 4 completos".

#### ACU-07 · Datos y autorizaciones
- **Fase:** F1 · Acudiente · Celular
- **Contenido:** datos de contacto y contacto preferido; **personas autorizadas a pagar** (tío, abuelo: nombre, documento, parentesco) con alta/baja; **tratamiento de datos** (ver política, aceptación vigente, y opciones de **consultar, corregir o pedir eliminación**, §14 de `producto.md`); datos de padres separados (C17).
- **Acciones →** Solicitar eliminación → hoja con explicación de consecuencias.

#### ACU-08 · Eventos y torneos
- **Fase:** F2 · Acudiente · Celular
- **Contenido:** tarjetas de eventos (nombre, fecha, lugar, categoría, costo de inscripción y traslado, cupo); **Inscribir** y **Pagar** desde la misma pantalla; estado ("Inscrito · Pagado", "Inscrito · Falta pagar", "Habilitado para la liga" si aplica).
- **Acciones →** Pagar → ACU-03 precargado.

#### ACU-09 · Avisos de la escuela
- **Fase:** F2 · Acudiente · Celular
- **Contenido:** lista de avisos oficiales (cambio de horario, recordatorios, póliza por vencer) con fecha y sede; sin respuestas ni "me gusta".
- **Visual:** tarjetas sobrias, fijar importantes arriba.

#### ACU-10 · Boletín del jugador
- **Fase:** F4 · Acudiente · Celular
- **Contenido:** evaluación del profesor por ítems y **asistencia/puntualidad** por periodo; presentación amable con barras y anillos. Los ítems dependen del deporte configurado.

---

### 5.7 Plataforma — escritorio (equipo del producto)

> Funcional y sobrio. **No muestra jugadores ni pagos de una escuela** salvo acceso autorizado por el dueño, con tiempo limitado y registro en bitácora.

#### PLA-01 · Organizaciones
- **Fase:** F1 mínimo · F3 completo · Super administrador · Escritorio
- **Contenido:** tabla de escuelas (nombre, plan, jugadores activos, estado, fecha de alta); **+ Nueva organización** (nombre, dueño, plan manual); detalle con estado y plan.
- **Acciones →** Alta (F1 asistida; F3 autoservicio); Suspender/Reactivar con motivo; Ver plan → PLA-02.

#### PLA-02 · Planes y límites
- **Fase:** F3 · Escritorio
- **Contenido:** tabla de planes por rango de jugadores activos (Inicial, Crecimiento, Escuela, Club, A la medida), precio, límites y qué ocurre al superar el límite (aviso/cambio/bloqueo — pendiente).

#### PLA-03 · Facturación de suscripciones
- **Fase:** F3 · Escritorio
- **Contenido:** cobro mensual a cada escuela, estado de pago, historial; suspensión por falta de pago (conserva datos, solo consulta y exportación).

#### PLA-04 · Soporte
- **Fase:** F3 · Escritorio
- **Contenido:** solicitudes de **acceso autorizado** (qué escuela, quién lo pidió, hasta cuándo), estado de la autorización del dueño, **bitácora de accesos** de soporte.
- **Visual:** banner fijo cuando se está dentro de una escuela: "Estás en [Escuela] con autorización hasta hh:mm", con cuenta regresiva y botón **Salir**.

#### PLA-05 · Indicadores de uso
- **Fase:** F3 · Escritorio
- **Contenido:** escuelas activas, jugadores activos, adopción de acudientes, pagos digitales vs. efectivo, tendencias; filtros por periodo y plan.

---

## 6. Flujos clave a prototipar

Prototipos navegables prioritarios (todos F1). El diseñador debe entregarlos de punta a punta:

### 6.1 Inscripción de un jugador (10.2)
`COO-01` → **+ Inscribir** → `COO-02` (4 pasos) → confirmación con carné creado y matrícula pendiente → `COO-04` (cobrar matrícula) → recibo.

### 6.2 Pago con comprobante (10.3)
`ACU-01` → **Pagar** → `ACU-03` (jugador → conceptos → "Ya transferí" → foto y datos → Enviar) → "Recibimos tu comprobante" → (coordinador) `COO-01` → `COO-05` (validar; alerta de duplicado) → **Aprobar** → (acudiente) notificación → `ACU-04` (recibo/estado "Aprobado").
- **Ramas:** Rechazar con motivo → `ACU-04` "Rechazado" → `ACU-03`; sin jugador → `COO-06`.

### 6.3 Pago en efectivo y cierre de caja (10.5)
`COO-04` (Efectivo) → recibo numerado → el acudiente lo ve en `ACU-04` → fin de periodo → `COO-07` (diferencia) → Enviar → (dueño) `DUE-07` → **Aprobar** o **Devolver**.
- **Rama offline (C22):** el pago queda "Pendiente de sincronizar" → al volver la señal se numera y se confirma.

### 6.4 Asistencia con alerta (10.7)
`PRO-01` → `PRO-02` o `PRO-03` → resultado con semáforo → (mora) alerta o bloqueo → (bloqueo) el coordinador autoriza excepción con motivo y fecha prometida → guardar → sincronizar.
- **Rama:** jugador inexistente → "Avisar al coordinador" → `COO-02`.

### 6.5 Consulta de póliza en un partido (10.8)
`COO-03` (búsqueda con error de escritura) → ficha → **Ver póliza** → **Compartir**. Meta: **< 1 minuto**.

### 6.6 Auditoría mensual del dueño (10.10)
`DUE-01` → alertas → `DUE-07` (cajas) → `DUE-09` (becas) → `DUE-06` (por asignar) → `DUE-05` (morosos) → `DUE-11` (exportar) → `DUE-10` (bitácora si algo no cuadra).

Los demás flujos (alta de organización 10.1, pago en línea 10.4, conciliación 10.6, torneo 10.9) se diseñan en sus fases (F1 asistida/F2/F3).

---

## 7. Accesibilidad, contenido y calidad

### 7.1 Accesibilidad
- **WCAG 2.2 AA** como mínimo: contraste de texto 4.5:1 (3:1 para texto grande y componentes de UI).
- Todo estado se comunica con **color + ícono + texto**.
- Foco visible siempre; orden de tabulación lógico; **todas** las acciones de escritorio disponibles con teclado.
- Etiquetas `aria-label` en íconos solos; chips de semáforo con texto accesible.
- Tamaño de letra "grande" en perfil; la app del acudiente parte de 16–17 px.
- Los gráficos tienen **alternativa en tabla**.
- `prefers-reduced-motion` y modo oscuro respetados.
- Formularios: errores explicados al lado del campo, no solo en rojo.

### 7.2 Contenido y lenguaje
- Español de Colombia, **simple y directo**: "Debes $ 157.500", no "Saldo pendiente por conciliar".
- Evitar jerga financiera con acudientes; con el dueño se permiten términos como "cartera" y "conciliación".
- Botones con verbos concretos: **Aprobar**, **Rechazar**, **Registrar pago**, **Subir comprobante**. Nunca "Aceptar/OK" ambiguo.
- Mensajes de error con solución: "No pudimos enviar la foto. Revisa tu conexión y vuelve a intentarlo."
- Tono de los cobros **configurable** por escuela (cordial / neutro / firme).
- **Dinero**: `$ 157.500` en COP sin decimales. **Fechas**: dd/mm/aaaa, zona America/Bogota.
- **Menores**: no usar fotos reales de menores en el sitio público ni en capturas de marketing; en la app solo las ven roles autorizados.

### 7.3 Rendimiento percibido
- Pantallas de coordinador y profesor **livianas** (pocas imágenes, listas paginadas).
- Skeletons en lugar de spinners.
- Estado de sincronización siempre visible en pantallas con datos offline.
- Picos: **primeros 10 días del mes** (~100 comprobantes por sede) y **fines de semana** (carné/póliza): la cola de comprobantes y la búsqueda deben seguir ágiles con muchos elementos.

### 7.4 Reglas que el diseño no puede romper
1. **No hay botón "Eliminar"** en pagos, cobros, jugadores ni bitácora: solo **Anular con motivo**, **Retirar** o **Desactivar**.
2. El **profesor nunca ve montos**.
3. El **coordinador no aprueba su propio cierre** ni anula (solo solicita).
4. El estado del carné **no se edita a mano**.
5. Los recibos siempre llevan **"No válido como factura"**.
6. La bitácora es **solo lectura**.
7. Las etiquetas de categoría/nivel/grupo y los textos de marca vienen de **configuración**, no se escriben a mano en el diseño final.

### 7.5 Ayuda y capacitación dentro de la app
`producto.md` §14 pide guía rápida y capacitación corta. Diseñar:
- **Entrada "Ayuda"** en el menú "Más" de cada rol: 5–7 tarjetas de "cómo hago…" con pasos ilustrados y video corto opcional (ej.: coordinador "Registrar un pago", "Cerrar caja"; profesor "Tomar asistencia sin conexión"; acudiente "Subir un comprobante", "Usar el carné").
- **Mini guía de primer ingreso** (COM-05) y **sugerencias contextuales** (tooltip de una sola vez) en la primera visita a pantallas clave.
- **Contacto de soporte** con horario visible.

---

## 8. Entregables esperados del diseñador

| # | Entregable | Prioridad |
| --- | --- | --- |
| 1 | **Moodboard** y propuesta de identidad (logo provisional, wordmark, ilustración, imágenes) coherente con §2.1 | F0 |
| 2 | **Librería de estilos en Figma**: color (claro/oscuro), tipografía, espaciado, radios, sombras, iconografía | F0 |
| 3 | **Librería de componentes** con todos los estados (§2.7) y variantes móvil/escritorio | F0–F1 |
| 4 | **Prototipo navegable de los 6 flujos** de §6 (alta fidelidad, móvil para coordinador/profesor/acudiente, escritorio para dueño) | F0 (validar con el dueño y un coordinador) |
| 5 | **Pantallas F1** (las marcadas F1 en §5, más estados vacío/error/offline) | F1 |
| 6 | **Sitio público** (WEB-01 a WEB-07), móvil y escritorio | F1–F2 |
| 7 | **Especificación de animaciones** (§2.6): tabla de tiempos/curvas y prototipos Lottie/Rive o videos de referencia de las microinteracciones clave | F1 |
| 8 | **Guía de tematización por organización** (F3): cómo se genera la escala de color y reglas de contraste | F3 |
| 9 | **Pantallas F2, F3 y F4** (con la misma librería) | Según fase |
| 10 | **Hand-off a desarrollo**: tokens exportados (JSON/CSS, nombres de §2.6b), nombres de componentes alineados con el código, notas de comportamiento y accesibilidad | Continuo |
| 11 | **Activos de marca y PWA** (§2.6d) y **plantillas de documentos y mensajes** (§2.6e): recibo, carné imprimible, lista de la liga, reportes, correos | F1 |
| 12 | **Pantallas de soporte**: COM-05, COM-06 (estados globales) y DUE-17 | F1 |
| 13 | **Contenido de ayuda** (§7.5) y microcopy por rol (§2.6f) | F1 |

### Criterios de aceptación del diseño
- Un coordinador puede **registrar un pago en menos de 1 minuto** en el prototipo.
- Un profesor puede **tomar asistencia de un grupo de 20 en pocos minutos** y entender el resultado de un escaneo en **menos de 3 segundos**.
- El dueño puede saber **si un jugador debe en menos de 15 segundos**.
- Se encuentra la **póliza** de un jugador en **menos de 1 minuto**.
- Un acudiente de prueba (incluyendo una persona mayor de 60 años) completa **subir un comprobante** sin ayuda.
- Todo cumple §7.1 (accesibilidad) y §7.4 (reglas que no se rompen).

---

## 9. Anexo: trazabilidad pantalla ↔ módulo ↔ dolor

Para que el diseñador entienda **por qué** existe cada pantalla. Módulos = `producto.md` §7; dolores D1–D14 = `producto.md` §2.

| Pantallas | Módulo(s) | Dolor(es) que resuelve | Qué debe lograr el diseño |
| --- | --- | --- | --- |
| COO-04, ACU-04, DUE-07, COO-07 | 7.9 Efectivo y cierre de caja | D1 | Que todo efectivo tenga recibo y entre a un cierre; diferencias visibles |
| ACU-03, COO-05, COO-06, DUE-06 | 7.8 Pagos | D2, D3, D4 | Que cada pago llegue identificado a un jugador y sin WhatsApp |
| DUE-08 | 7.10 Conciliación | D2, D3 | Cruce banco vs. plataforma sin Excel |
| COO-02, DUE-03, DUE-04, COO-03 | 7.3 Jugadores, 7.4 Familias | D5, D8 | Que todo jugador exista y se encuentre aun con errores de escritura |
| PRO-02, PRO-03, COO-08, ACU-05 | 7.11 Asistencia, 7.12 Carné | D6 | Asistencia rápida, carné no falsificable, semáforo claro |
| ACU-05, ACU-06, DUE-04, DUE-11 (pólizas) | 7.5 Documentos y pólizas | D7 | Póliza en < 1 minuto |
| DUE-09, DUE-05, ACU-02 | 7.6 Tarifas, 7.7 Cuentas por cobrar | D9, D10, D12 | Cobros sin Excel; saber quién debe en < 15 s |
| DUE-12, COO-09, PRO-05 | 7.13 Inventario | D11 | Quién tiene qué y qué se perdió |
| DUE-13, COO-10, ACU-08 | 7.14 Torneos y eventos | D10 | Cobro de torneos y lista de habilitados |
| DUE-01, DUE-10, DUE-11 | 7.16 Reportes, 7.17 Bitácora | D1, D13 | Auditar 4 sedes sin visitarlas |
| DUE-14, COM-01, COM-02, COM-05 | 7.2 Usuarios y roles | D13 | Cada persona ve solo lo suyo |
| DUE-16, DUE-17 | 7.18 Importación | D8 | Salir de Drive y Excel sin perder historia |
| DUE-15 | Configuración (políticas) | D1, D6, D9 | Políticas configurables, no hardcodeadas |
| COM-04, ACU-09 | 7.15 Notificaciones | D4 | Un solo canal oficial con las familias |
| PLA-01 a PLA-05 | 7.19 Administración de plataforma | — (negocio) | Operar la suscripción sin ver datos de la escuela |
| PRO-06, ACU-10 | 7.20 Módulo deportivo | — (valor agregado) | F4, sin desviar el foco del dueño |
