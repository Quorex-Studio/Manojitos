---
name: reportes-pdf
description: Crear, modificar o revisar los reportes PDF "estilo factura" del panel de esta plantilla de tienda (EINA, Manojitos y futuras tiendas) — Cuentas por cobrar / estado de cuenta, Reporte de ventas y cualquier reporte nuevo (inventario, compras, créditos, cierre de caja) — y hacer que la asistente (Ina / Ángela) los entregue como PDF adjunto en el chat. Úsala siempre que pidan "un PDF", "imprimir el reporte", "exportar", "estado de cuenta", "que la asistente me mande el reporte", mejorar el módulo Reportes o un Excel/CSV del panel, aunque no digan "PDF".
---

# Reportes PDF del panel

Todos los reportes del panel son de la **misma familia**: A4, banda de marca arriba (nombre,
rubro, tipo de documento, N° y fecha de emisión), recuadros de datos como el "Facturar a" de una
factura, mosaicos de resumen (el primero en el color de marca: el número que importa), tablas con
encabezado de marca, notas de "Cómo leer este reporte" y pie con "Página X de Y". Una persona que
imprimió uno reconoce el siguiente. Por eso no se dibuja un PDF desde cero: se arma con las piezas
compartidas.

## Mapa del código

| Archivo | Qué hace |
|---|---|
| `src/lib/pdfBrand.ts` | Piezas comunes: `PDF` (colores = tokens de DESIGN.md), `drawPdfHeader`, `drawInfoBox`, `drawTiles`, `drawSectionTitle`, `drawPdfFooter`, `pdfMoney`, `pdfBs`, fechas y `pdfLastY` |
| `src/lib/receivablesReport.ts` | Cuentas por cobrar: `buildReceivablesReport` (datos puros) y `buildReceivablesPdf` (general o estado de cuenta de una clienta) |
| `src/lib/receivablesData.ts` | Lee Supabase con la sesión de quien pide (RLS decide) y arma el reporte; `pdfActions` / `receivablesPdfActions` = descargar · enviar · imprimir |
| `src/lib/salesReport.ts` | Reportes: filtros, resumen, comparación con el período anterior y `buildSalesPdf` |
| `src/components/reports/ReceivablesReportDialog.tsx` | Vista previa + acciones (se abre desde Por cobrar, la tarjeta de una clienta y Reportes) |
| `src/components/AngelaChat.tsx` → `ReportAttachmentCard` | Tarjeta del PDF que entrega la asistente |
| `supabase/functions/ai-assistant/index.ts` | Herramienta `generar_reporte_cxc`, tipo `Attachment` y respaldo por intención (`wantsCxcReport`) |

## Reglas que evitan los errores de siempre

1. **Datos puros primero, PDF después.** Una función `buildXReport(filas, opciones)` sin
   Supabase ni React produce el objeto; la pantalla, el PDF, el Excel y la asistente usan ese
   objeto. Así "la pantalla dice $640 y el PDF $655" no pasa, y se puede probar con Vitest.
2. **La misma regla de negocio que la pantalla.** Por cobrar = grupos de venta
   (`sale_group_id` o `id`) con total − abonado > 0,009, **sin** ventas `cancelled`; abonos
   `void` no cuentan; clientas agrupadas por nombre normalizado. Si cambias la regla, cámbiala en
   `Sales.tsx` y en `receivablesSummary` del edge function también.
3. **Fechas locales** (`localDateISO`), nunca `toISOString().slice(0,10)`: en Venezuela el día
   cambia a las 8 p. m.
4. **Fuente estándar de jsPDF = WinAnsi.** `× · – — • ° ñ á` sí; `− ≥ → ✓` y emojis salen
   como basura. Usa `-` para negativos.
5. **Tablas largas**: `showHead: 'everyPage'`, `showFoot: 'lastPage'` (si no, el TOTAL se repite
   en cada página), `margin.bottom: 18` para no pisar el pie, y salta de página a mano antes de
   un bloque que no quieras partir (`if (y > H - 55) { doc.addPage(); y = 20; }`).
6. **Encabezado corto desde la página 2** (`drawRunningHeader`) y tablas con `PDF_TABLE_MARGIN`
   (arriba deja lugar a ese encabezado). Al abrir página a mano, sigue en `PDF_PAGE_TOP`.
   Cierra el reporte con una **lectura automática** (prioridades y metas en frases), no solo tablas.
7. **Mide texto con la fuente con que lo pintas** (`getTextWidth` después de `setFont`/
   `setFontSize`), si no, el texto de al lado se monta.
8. **Estado de cada cuenta a la vista.** Toda tabla de deuda lleva la columna "Estado" con la
   pastilla de `paymentState` (Sin abono · Abonó X% · Pagada) y los montos coloreados con
   `stateColumns()`: la dueña lee el PDF buscando quién no ha pagado nada.
9. **Color con significado, nunca solo color.** Antigüedad: verde 0–15, dorado 16–30, cobre
   31–60, rojo +60 (rojo = dinero en riesgo, DESIGN.md §4) y siempre con su etiqueta o días.
10. **Compartir e imprimir dentro del clic.** El navegador bloquea `navigator.share` y
   `window.open` si antes se espera la red: precarga los datos (react-query) y deja los botones
   síncronos.
11. **No cargues jsPDF en la tienda.** Lo que se monta para clientas (el chat) importa el
   generador con `await import(...)`.

## Hacer que la asistente entregue un PDF

El PDF **no** se genera en el edge function: se arma en el navegador con la sesión de la
administradora y el mismo código del botón, así ambos PDF son idénticos y RLS protege los datos.

1. En `index.ts`, la herramienta (solo admin, en `ADMIN_ONLY_TOOLS`) calcula un resumen corto y
   empuja un `Attachment` a `ctx.attachments` (`{ id, type, title, lines, ...filtros }`). Devuelve
   al modelo el resumen y la instrucción "el PDF ya está adjunto; dilo en una frase".
2. Agrega un respaldo determinista por intención (como `wantsCxcReport`) para cuando el modelo
   no llama la herramienta o no hay clave de IA.
3. La respuesta JSON lleva `attachments`; en `AngelaChat.tsx` se filtra por `type` conocido y se
   pinta una tarjeta con Imprimir · Enviar · PDF.
4. Menciona la herramienta en las instrucciones del prompt ("Nunca digas que no puedes generar
   PDF").
5. Tras cambiar el edge function, hay que **desplegarlo** en cada tienda (EF en la guía de
   portado).

## Reporte nuevo, paso a paso

1. `src/lib/<x>Report.ts`: tipos de fila mínimos, `build<X>Report` puro y `build<X>Pdf` con las
   piezas de `pdfBrand.ts`. Número `XXX-AAAAMMDD-HHMM`.
2. `src/lib/<x>Report.test.ts`: agrupación, exclusiones, totales y que el PDF se arma vacío.
3. Botón en la pantalla (pill, ícono `FileText`), con vista previa si el reporte tiene más de un
   número importante.
4. Revisa el PDF **renderizado**: `node .claude/skills/reportes-pdf/scripts/ver-pdf.mjs <dir>
   [cxc|cxc-categoria|cxc-clienta|ventas]` (amplía el script si agregas un tipo) y mira las PNG: montajes,
   cortes de página, TOTAL repetido, caracteres raros.
5. `npx vitest run`, `npm run build`, el conteo de `npx tsc -p tsconfig.app.json --noEmit` no sube.
6. Registra el cambio en `DESIGN.md` (§11 y §12, igual que pide la skill `diseno`) y, si toca la
   asistente, en `docs/ASISTENTE-VIRTUAL-INA-ANGELA.md`.
