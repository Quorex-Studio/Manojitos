# Reportes PDF estilo factura, Cuentas por cobrar y módulo Reportes

Registro completo de las mejoras de **diseño**, **visuales** y **lógicas**: qué había, qué cambió,
por qué, y dónde está en el código. Método: DESIGN.md como fuente de verdad (getdesign.md /
open-design.ai), skill `diseno` para auditar y verificar, y la nueva skill `reportes-pdf` para
repetir el patrón en cualquier reporte futuro.

## 1. Qué pidió la dueña y qué se entregó

| Pedido | Entregado |
|---|---|
| Botón en Cuentas por cobrar para imprimir un PDF "bien chévere", explicado, ordenado, estilo factura | Botón **Reporte PDF** en Ventas → Por cobrar (todas las clientas) y **Estado de cuenta PDF** dentro de la ficha de cada clienta. Vista previa con total, antigüedad y quién debe más; acciones Imprimir · Enviar · PDF |
| Que Ina / Ángela entregue el reporte también en PDF | Nueva herramienta `generar_reporte_cxc`: la asistente responde con una **tarjeta PDF** (Imprimir · Enviar · PDF) debajo de su mensaje, general o de una clienta. Si el modelo no llama la herramienta, un respaldo por intención adjunta el PDF igual |
| Mejorar el módulo Reportes: "ni práctico ni interactivo" | Reportes rehecho: filtros en la URL, búsqueda, KPIs con comparación, gráfico tocable, métodos de pago como filtros, rankings de productos y clientas, detalle ordenable y paginado, acceso directo al PDF de Por cobrar, PDF/Excel/CSV que respetan los filtros |

## 2. El PDF de Cuentas por cobrar (`src/lib/receivablesReport.ts`)

### Estructura (de arriba abajo)

1. **Banda de marca** (vino): nombre en serif, rubro, dominio y correo; a la derecha el tipo de
   documento (CUENTAS POR COBRAR / ESTADO DE CUENTA), **N° CXC-AAAAMMDD-HHMM** y fecha/hora de emisión.
2. **Dos recuadros tipo factura**: *Alcance* (o *Clienta* con su teléfono) y *Corte* (fecha
   larga, tasa BCV del día, antigüedad promedio).
3. **Tres mosaicos**: Total por cobrar (en vino, con su equivalente en Bs), Facturado y Abonado
   (con % ya cobrado).
4. **Antigüedad de la deuda**: barra apilada + leyenda con monto, número de facturas y %.
   Verde 0–15 días · dorado 16–30 · cobre 31–60 · rojo más de 60.
5. **Resumen por clienta** (solo el general): #, clienta, teléfono, facturas, facturado, abonado,
   saldo y días de la más antigua (coloreado por tramo) con fila TOTAL.
6. **Detalle por clienta**: franja con nombre, teléfono, n.º de facturas y "Debe $X"; tabla de
   facturas (N°, fecha, productos con cantidades, días, total, abonado, saldo) y, debajo de cada
   una, sus **abonos** (fecha · método · Bs · monto) en verde. Subtotal por clienta.
7. **Cómo leer este reporte**: 4 notas en lenguaje simple.
8. **Firmas** (solo estado de cuenta): "Por EINA" y "Conforme (clienta)".
9. **Pie** en cada página: marca · ubicación · dominio y "Página X de Y".

### Lógica

- Factura = grupo de venta (`sale_group_id` o `id`). Debe si total − abonado > 0,009.
- **Ventas anuladas (`status = cancelled`) no cuentan** (antes aparecían como deuda en Por
  cobrar; se corrigió también en `Sales.tsx`).
- Abonos anulados (`void`) no se muestran; un abono se asigna por `sale_group_id` o, si no
  tiene, por `sale_id`; duplicados (por grupo y por línea) se descartan.
- Clientas agrupadas por nombre normalizado (espacios y mayúsculas), igual que las tarjetas.
- Días calendario por fecha local (no UTC). Antigüedad promedio **ponderada por saldo**.
- Nombre parcial ("maría") → si coincide con una sola clienta, sale su estado de cuenta.
- El orden del PDF sigue el orden elegido en Por cobrar (deuda, antigüedad o A–Z).
- Ventas paginadas de 1000 en 1000 (PostgREST corta en 1000 filas).

### Segunda versión: lo que se tomó del reporte de referencia

La dueña compartió un "Control de Cuentas por Cobrar" como modelo. Se comparó página por página y
se incorporó lo que le faltaba al nuestro:

| Del modelo | Cómo quedó en EINA | Dónde |
|---|---|---|
| Columna **Estado** ("Sin abono" / "Abonó 50%") | Pastilla por fila en el resumen por clienta, en cada factura y en cada categoría: rojo = sin abono, cobre = abonó una parte, verde = pagada (`paymentState`) | `stateColumns()` en `receivablesReport.ts` |
| Colores por fila | Abonado en verde si hubo pago; saldo en rojo si no abonó nada y en cobre si abonó una parte | ídem |
| Secciones **por categoría de producto** con "N registros · N unidades", subtotal y **% cobrado** | Selector **Detalle del PDF por: Clienta / Categoría** en la vista previa; Ina también ("el reporte por categoría"). La categoría sale de `products.category` | `ReceivablesReportDialog.tsx`, `receivablesData.ts` |
| **Nota operativa** por sección | Frase automática: qué % de clientas de la categoría no ha abonado nada y qué conviene hacer | `buildReceivablesPdf` |
| **Balance general consolidado** por categoría | Tabla con artículos, facturado, abonos, saldo y % de recaudación, y fila TOTAL CONSOLIDADO | ídem |
| **Cuentas prioritarias** y **Estado de recaudación** | Recuadros al final: las 3 deudas más altas (unidades, % abonado, días) y cuántas tienen abono parcial, cuántas ninguno (y cuánto suman) y la meta inmediata (cuentas de más de 30 días o saldos mayores a $10) | `insights` en `buildReceivablesReport` |
| Unidades y % pendiente en el resumen | Mosaicos: "90,2% pendiente · Bs …", "14 unidades · 5 clientas", "9,8% ya cobrado" | `drawTiles` |
| Encabezado corto en las páginas siguientes | "CUENTAS POR COBRAR · EINA — N° … · Corte …" desde la página 2 (también en el de ventas si se usa `drawRunningHeader`) | `pdfBrand.ts` |

Lo que **no** se copió porque en el modelo estaba mal: la fila TOTAL CONSOLIDADO en blanco sobre
blanco (ilegible), "3 clientes" con 4 nombres, "16,3% del total cobrado" (era % recaudado) y la
fecha sin rellenar ("[Fecha Actual]").

## 3. Módulo Reportes (`src/pages/Reports.tsx` + `src/lib/salesReport.ts`)

| Antes | Ahora | Por qué |
|---|---|---|
| Fechas en `useState`: al volver atrás se perdían | Todo en la URL: `?desde&hasta&vista&metodo&dia&q` | Un enlace abre la vista exacta; "atrás" funciona (DESIGN.md) |
| 4 tarjetas, una repetía el conteo ("Período") | Total vendido (+Bs), **Ventas (tickets reales)**, **Ticket promedio**, A crédito (%) | "Ventas" contaba líneas de producto, no ventas |
| Sin contexto | **+X% vs. los N días anteriores** con flecha y texto | Saber si voy mejor o peor sin hacer cuentas |
| Tabla fija de 50 filas | Pestañas Resumen · Productos · Clientas · Detalle (n) | Cada pregunta tiene su vista |
| Sin gráfico | **Ventas por día** (por mes si el rango pasa de 3 meses) con tooltip; **tocar una barra filtra ese día** (tocar un mes abre sus días); mejor día destacado | Interactivo y rápido de leer |
| Métodos de pago como cajitas | Filas con barra relativa; **tocar filtra todo el reporte** | Del resumen al detalle en un toque |
| — | **Lo más vendido** y **Mejores clientas** (top 5, "Ver todo") — tocar abre el detalle filtrado | Lo que la dueña pregunta más |
| Buscar no existía | Búsqueda por producto o clienta **sin acentos** ("serum" = "Sérum") | Práctico en el teléfono |
| — | Chips "Filtrando: …" con ✕ y "Quitar todos" | Siempre se sabe qué se está viendo |
| 50 filas y "exporta para ver más" | Orden (reciente, antigua, mayor, menor) y **Ver 50 más**; en el teléfono lista, en escritorio tabla con método y clienta tocables | Nada queda escondido |
| Ventas anuladas sumaban | Se excluyen | Totales reales |
| Excel con dorado y rosa de otra marca | Excel con color de marca, hoja **Resumen** (KPIs, métodos, productos) + hoja **Ventas** | Consistencia de marca |
| PDF simple de tabla | **PDF estilo factura** (mismo encabezado): período, comparación, 4 mosaicos, gráfico de barras por día, métodos y productos lado a lado, detalle con TOTAL | Misma familia que Por cobrar |
| — | Tarjeta **Cuentas por cobrar** con el total en vivo que abre el reporte PDF | Los dos reportes que más se usan, juntos |
| Exportaba todo el rango | PDF/Excel/CSV **respetan los filtros** (método, día, búsqueda) | Lo que ves es lo que imprimes |

Rangos rápidos: Hoy, 7 días, 30 días, Este mes, Mes pasado y **Este año**. Nada antes del
lanzamiento (2026-01-01) ni fechas futuras.

## 4. Diseño y visual (tokens de DESIGN.md)

- PDF: vino = acento único (banda, mosaico principal, saldos); crema y lienzo para superficies;
  tinta `#252024` para texto; rojo solo para deuda de más de 60 días (dinero en riesgo).
- Piezas compartidas en `src/lib/pdfBrand.ts`: cualquier reporte nuevo se ve de la misma familia.
- Pantalla: botones pill de 44 px en móvil, una acción primaria por vista (en Por cobrar el botón
  de reporte es contorno para no competir con el selector Por cobrar/Pagadas), color nunca solo
  (antigüedad con etiqueta; variación con flecha y texto), modo oscuro verificado.
- Gráfico: una sola serie → sin leyenda, barras con esquinas de 4 px, cuadrícula tenue, tooltip
  con fecha, monto y n.º de ventas; barras no elegidas al 30% cuando hay un día filtrado.

## 5. Asistente (Ina / Ángela)

Ver `docs/ASISTENTE-VIRTUAL-INA-ANGELA.md` §2.9. En corto: el PDF se arma en el navegador con la
sesión de la administradora y el mismo código del botón (mismas cifras, RLS protege los datos);
el generador de PDF se carga solo cuando aparece la tarjeta (la tienda no lo descarga).

## 6. Verificación hecha

- Pruebas nuevas: `receivablesReport.test.ts` (6) y `salesReport.test.ts` (4); total 76/76.
- `npm run build` OK; el conteo de `tsc -p tsconfig.app.json` no subió (46, todos previos).
- Capturas con Playwright (390 px y 1366 px, claro y oscuro) de Reportes, Por cobrar, vista
  previa, estado de cuenta y chat de Ina; descarga real del PDF desde el botón y desde la tarjeta
  de Ina; clic en barra y en método de pago; sin errores de página.
- PDFs renderizados a imagen y revisados (encabezado, cortes de página, TOTAL solo al final).

## 7. Para portar a Manojitos

Archivos: `src/lib/{pdfBrand,receivablesReport,receivablesData,salesReport}.ts` (+ tests),
`src/components/reports/ReceivablesReportDialog.tsx`, `src/pages/{Reports,Sales}.tsx`,
`src/components/AngelaChat.tsx`, `supabase/functions/ai-assistant/index.ts` (**EF: redesplegar**),
`.claude/skills/reportes-pdf/`. Sin migraciones de BD. La marca sale de `src/config/brand.ts`.
