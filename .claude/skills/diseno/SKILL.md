---
name: diseno
description: Diseñar, rediseñar, auditar o pulir la interfaz de esta plantilla de tienda + panel de gestión (EINA, Manojitos y futuras tiendas) siguiendo su DESIGN.md, con el método de getdesign.md y open-design.ai. Úsalo siempre que el usuario pida mejorar UX/UI, "que sea interactivo", "responsive", "vista móvil", modo claro/oscuro, aplicar una identidad o paleta, revisar una pantalla del panel admin o de la tienda, arreglar algo que "se ve mal" o "no funciona en el teléfono", o portar mejoras de diseño de una tienda a otra — aunque no diga "diseño" explícitamente.
---

# Diseño de la plantilla (tienda + panel)

Esta skill convierte "mejóralo" en un trabajo verificable. La idea de getdesign.md y
open-design.ai es la misma: **un DESIGN.md portátil es la fuente de verdad** (colores, tipos,
espaciado, componentes y el porqué), y el agente lo aplica, genera, revisa y vuelve a iterar.
Nada de gustos sueltos: cada decisión cae en el DESIGN.md para que la siguiente pantalla salga
igual.

## 0. Antes de tocar nada

1. Lee `DESIGN.md` en la raíz (tokens, principios, componentes y el **registro de mejoras**).
   Si el pedido trae una identidad nueva (PDF/RAR de marca), primero actualiza el frontmatter
   del DESIGN.md con esa paleta y tipografía; el código viene después.
2. Lee `references/patrones.md` para los patrones ya resueltos (barra inferior, KPIs, listas,
   pestañas, filtros en URL). Reutilízalos: reinventarlos crea inconsistencias.
3. Identifica la superficie: **tienda** (`src/pages/Store*`, `src/components/store`) o
   **panel** (`AppLayout`, `src/pages/{Dashboard,Sales,Products,...}`).

## 1. Mirar antes de opinar (captura real)

No diagnostiques leyendo JSX: la mitad de los fallos solo se ven renderizados (clases de
Tailwind inexistentes, `justify-center` que gana a tu clase, íconos tapados por un input).
Usa `scripts/capturas.mjs` (instrucciones en su cabecera): levanta Vite, simula productos,
tasa y —para el panel— una sesión admin, y guarda capturas a 390 px y 1366 px, en claro y
oscuro. Revisa cada captura y anota problemas concretos ("el ícono de búsqueda no aparece",
"los 5 KPIs ocupan toda la pantalla"), no impresiones.

## 2. Auditoría de lógica (lo que "no funciona")

"Que todo sea interactivo y tenga lógica" casi siempre esconde bugs, no estilos. Revisa:

- `npx tsc -p tsconfig.app.json --noEmit | grep -E "TS2304|TS2552|TS2686|TS2339"`: nombres
  sin importar o propiedades inexistentes **rompen la pantalla en ejecución** aunque el build
  pase. Arréglalos primero.
- Imports duplicados (`Gallery, Image as Gallery`) tumban el módulo entero.
- Acciones solo en `:hover` (editar/eliminar sobre la foto): en el teléfono no existen.
- Enlaces a rutas o filtros que no existen (`?category=destacados`), estado que se pisa entre
  URL y `useState`, `confirm()` nativo, fechas con `toISOString()` (UTC: en Venezuela el día
  cambia a las 8 p. m.; usa `localDateISO()` de `src/lib/dates.ts`).
- Persistencia que se guarda antes de cargar (el carrito se vaciaba al recargar).

Detalle y ejemplos en `references/auditoria.md`.

## 3. Aplicar

Reglas que más valor dan (el porqué está en DESIGN.md):

- **Tokens, no colores sueltos.** Nada de `pink-500`, `amber-*` ni hex en componentes. Si falta
  un color, crea el token en `src/index.css` (claro y `.dark`) y en `tailwind.config.ts`.
- **Contraste AA** en claro y oscuro. En oscuro el primario puede cambiar de tono (EINA: vino
  → nude) porque el color de marca oscuro no se lee sobre fondo oscuro.
- **Móvil primero**: objetivos de 44 px, barra inferior, nada que dependa de hover, tablas →
  tarjetas o listas por debajo de `md`, pestañas en una fila deslizable (`.admin-tabs`).
- **Estado en la URL** para filtros, pestañas y búsquedas: los KPIs y enlaces pueden abrir la
  vista exacta y "atrás" funciona.
- **Una acción primaria por vista**, pill, sin glow/shimmer/gradientes en texto.
- **Datos siempre visibles**: nombre, precio, detalle del KPI; el hover solo agrega extras.
- Respeta `prefers-reduced-motion` (`useReducedMotion()`).
- Reportes, PDF, Excel o "que la asistente mande el reporte": usa la skill `reportes-pdf` (familia de PDF en `src/lib/pdfBrand.ts`).

## 4. Verificar y registrar

1. Repite las capturas y compáralas con las de antes.
2. Si hubo flujos (buscar, filtrar, carrito, login), corre un recorrido con Playwright que
   haga clic de verdad y falle si algo no responde (ver `references/auditoria.md`).
3. `npm run build`, `npx vitest run` y el conteo de `tsc` no debe subir.
4. **Registra cada mejora en DESIGN.md → "Registro de mejoras"** (qué, por qué, archivo).
   Así otra tienda de la plantilla (p. ej. Manojitos) puede portarla tal cual. Marca con
   **[marca]** lo que es propio de una identidad.

## Qué entregar al usuario

Resumen corto en español: qué estaba roto (con la causa en una frase), qué mejoró por
pantalla, capturas antes/después de móvil y escritorio, y lo que queda pendiente o requiere
datos reales para verificar.
