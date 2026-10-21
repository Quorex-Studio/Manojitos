# Despliegue en la base de datos de Manojitos

Registro de lo que se aplica en Supabase de **Manojitos** (ref `utfoempgdbhhikpvbvir`). **Solo
Manojitos**: EINA es otro proyecto y tiene su propio registro.

Cada migración del repo (`supabase/migrations/`) se aplica una vez y se anota aquí con la versión que
le dio Supabase (la fecha en que se aplicó, no la del nombre del archivo).

## 21-10-2026: ventas desde EINA

| Archivo del repo | Versión en Supabase | Qué hizo en Manojitos |
|---|---|---|
| `20261016010000_sales_edit_and_clients.sql` | `20261021214407` | Política «Admins can update sales» (antes solo se podía editar la venta propia). Vinculación de ventas viejas a su cuenta: **1 venta** (por cédula) |

Antes de aplicarla se probó en una transacción que se deshizo y se verificó que no quedara nada.

**No se vincularon 3 ventas** porque su cédula coincide con **dos cuentas** distintas (fichas
duplicadas). Para no adivinar, la migración solo vincula cuando coincide una sola cuenta. Se pueden
vincular a mano desde Clientes → Sin cuenta o desde «Editar venta», después de decidir cuál de las
dos fichas es la correcta.
