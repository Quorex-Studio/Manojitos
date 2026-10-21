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

## 21-10-2026: compras, gastos y cuentas por pagar desde EINA

| Archivo del repo | Versión en Supabase | Qué hizo en Manojitos |
|---|---|---|
| `20261016020000_purchases_expenses_payables.sql` (secciones 1 a 5) | `20261021215400` | Columnas nuevas en `purchases` (las 6 compras viejas, pagadas, quedaron saldadas); tablas `purchase_items`, `purchase_payments`, `expense_categories` (9 categorías) y `expenses` con RLS solo para administración; RPC `register_purchase` y `pay_purchase` |
| `20261016020000_purchases_expenses_payables.sql` (sección 6: `delete_purchase` y permiso de borrar) | **pendiente** | Quedó esperando la confirmación que pide Supabase para sentencias con `delete`. Sin esto, **borrar una compra** muestra «No se pudo eliminar»; registrar, abonar, gastos y cuentas funcionan |

Se aplicó en dos partes por ese motivo. La parte 1 se probó después, como administración, en una
transacción que se deshizo: una compra de 18 unidades a $4 con 7 % de tax y $5 de envío dio $82,04, el
stock subió 9 → 27 y **el costo del producto no cambió** (el costeo de Manojitos queda igual).

**Para aplicar la parte pendiente**: en el SQL Editor de Supabase de Manojitos, ejecutar desde la
sección «6. Borrar una compra» del archivo hasta el final, más esta línea:

```sql
grant delete on public.purchase_items, public.purchase_payments, public.expense_categories, public.expenses to authenticated;
```

## 21-10-2026: empleados desde EINA

| Archivo del repo | Versión en Supabase | Qué hizo en Manojitos |
|---|---|---|
| `20261016030000_employees.sql` (secciones 1 a 5, salvo «no borran ventas») | `20261021220013` | `is_staff()` e `is_employee()`; `confirm_pos_sale`, `process_group_abono` y `create_ledger_entry` aceptan empleados activos (`recalculate_sale_group` no tenía chequeo); políticas «Empleados ven clientes», «Empleados no editan ventas» y «Empleados leen la regla de precios» |
| `20261016030000_employees.sql` (política «Empleados no borran ventas») | `employees_no_delete_sales` | Política restrictiva: el empleado no borra ventas |

Prueba (en una transacción que se deshizo, con una cuenta de clienta convertida en vendedor por un
momento): el vendedor registró y confirmó una venta fiada (stock 5 → 4), abonó, **no pudo editarla**
(0 filas) y **no pudo anularla** («No autorizado»). Después se verificó que no quedó nada.

En el archivo de Manojitos los `drop policy if exists` + `create policy` de EINA se cambiaron por
«crear solo si no existe» (mismo resultado y se puede reaplicar), porque Supabase pide confirmación
para las sentencias destructivas.

**Edge function** `admin-actions` desplegada (versión 10, `verify_jwt = false` como antes): agrega
`list_employees` y `create_employee` (solo administración) y deja que un empleado use
`create_customer`; ninguna acción toca una cuenta de administración.
