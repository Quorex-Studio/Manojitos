# Importación de datos de Treinta (10-09-2026)

Datos cargados desde las exportaciones de la app Treinta (inventario, reporte de deudas y
estado de resultados 2026). Todo lo importado lleva `[Treinta]` en `notes` para poder
identificarlo.

| Qué | Dónde | Cantidad | Control |
|---|---|---|---|
| Inventario | `products` | 255 productos · 579 unidades | costo inventario $2.296,62 (igual a Treinta) |
| Ventas 2026 con detalle | `sales` (contado, pagadas) | 140 ventas · 232 líneas | $2.834,90 |
| Deudas pendientes | `sales` (fiado) | 26 ventas · 60 líneas | **por cobrar $601,90** (igual a Treinta) |
| Abonos de ventas sin detalle (2025) | `sales` "Venta anterior: …" | 49 | $824,80 |
| Pagos y abonos | `sale_payments` (con fecha y método reales) | 269 | $4.001,70 |
| Gastos (compras de mercancía) | `purchases` | 2 | $222,39 |

Reglas usadas:
- El stock viene del inventario de Treinta (ya descontado); las ventas históricas **no** vuelven a descontarlo.
- Cada abono de Treinta se emparejó con su venta por clienta y descripción; lo que ya habían
  abonado en las deudas se registró como pago para que el saldo quede igual a Treinta.
- Métodos: Pago móvil → `pago_movil`, Efectivo → `efectivo_usd`, Transferencia → `transferencia`, Zelle, Binance.
- Categorías: se normalizaron las de Treinta (p. ej. SKIN CARE → Skincare) y a los 114 productos
  sin categoría se les asignó una por el nombre (Maquillaje, Skincare, Accesorios…). Se pueden
  cambiar desde Productos.
- `sold_count` de cada producto = unidades vendidas en 2026 según Treinta.

Para deshacer (en orden): borrar `sale_payments`, `sales` y `purchases` con `notes like '[Treinta]%'`
y luego los productos creados en la importación.
