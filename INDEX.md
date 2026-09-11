# Manojitos - Índice del Proyecto

## 1. Mapa de Archivos (Frontend)
El proyecto es una aplicación React (Vite) en TypeScript. La estructura principal incluye:

- `src/components/`: Componentes UI reutilizables (shadcn/ui en `src/components/ui/`), layout, y modales de uso compartido.
- `src/hooks/`: Custom hooks principales (e.g., `useProducts.tsx`, `useSales.tsx`, `useCustomerProfile.tsx`, `useLedger.tsx`, `useExchangeRate.tsx`, `useBusinessRules.tsx`).
- `src/pages/`: Vistas de la aplicación (e.g., `Sales.tsx`, `Customers.tsx`, `Products.tsx`, `Checkout.tsx`, `Credits.tsx`, `BusinessRules.tsx`).
- `src/integrations/supabase/`: Integración con Supabase. `types.ts` contiene las definiciones exportadas de la base de datos.
- `src/types/index.ts`: Interfaces internas para tipado a nivel de la UI.
- `src/contexts/`: Contextos de React (`CartContext.tsx`, `AuthContext.tsx`).

## 2. Esquema de Base de Datos

- **products**: Catálogo (`id`, `name`, `sku`, `price_usd`, `price_bs_usd`, `cost_usd`, `stock`, `sold_count`, `minimum_stock`).
- **customer_profiles**: Perfiles de clientes (`id`, `user_id` [NOT NULL, sin FK a auth.users], `full_name`, `email`, `phone` [UNIQUE], `dni` [UNIQUE, formato `V-XXXXXXXX` mayúsculas], `address`, campos KYC). RLS: admin gestiona todo; usuario ve/edita su propio perfil; admin puede insertar perfiles sin cuenta auth (policy `Admins can insert customer profiles` WITH CHECK is_admin()).
- **orders**: Pedidos online (`id`, `customer_user_id`, `status`, `total_usd`, `banco_origen`, `numero_referencia`, `payment_method`). RLS: lectura propia (`customer_user_id = auth.uid()`), gestión admin (`is_admin()`), inserción cliente autenticado.
- **sales**: Ventas POS desde panel admin (`id`, `user_id` [staff que procesó], `customer_user_id` [vinculado por trigger `trg_sales_autolink_customer` via `normalize_ve_phone()`], `product_id`, `quantity`, `unit_price_usd`, `total_usd`, `total_bs`, `client_name`, `client_phone`, `payment_method`, `is_credit`, `status`, `amount_paid`, `payment_status`). **`confirmSale()` usa la RPC atómica `confirm_pos_sale()` — NO operar stock directamente desde React.**
- **sale_payments**: Pagos parciales de ventas POS (`id`, `sale_id`, `amount_usd`, `amount_bs`, `exchange_rate`, `payment_method`). RLS restrictivo: admin ve/inserta/elimina todo; staff ve/inserta pagos de sus propias ventas; cliente ve sus propios pagos. Principal creación via `process_pos_abono()`.
- **ledger_entries**: Libro contable (ingresos/egresos). Solo se escribe via RPC interna `create_ledger_entry()`.
- **credits**: Líneas de crédito (`id`, `client_user_id`, `client_name`, `credit_limit`, `current_balance`, `cut_off_day` [15], `grace_days` [3], `status`). RLS: admin gestiona; cliente ve solo su crédito por `client_user_id`.
- **credit_transactions**: Historial ABONO/CARGO (`id`, `credit_id`, `amount`, `type`). RLS: admin gestiona; cliente ve sus transacciones via JOIN a credits.
- **payment_promises**: Promesas de pago. RLS: admin gestiona; cliente ve las propias via JOIN a credits.
- **business_rules**: Reglas de negocio (`id`, `name`, `rule_type`, `conditions`, `actions`).

## 3. RPCs Principales (Supabase)

| Función | Requiere | Descripción |
|---------|----------|-------------|
| `process_checkout(items, payment_method, client_name, client_phone, notes, rate, banco_origen, referencia, delivery_fee)` | `auth.uid()` (cliente) | Crea pedido online. Valida precios contra DB. 4 sobrecargas con parámetros opcionales. |
| `confirm_pos_sale(p_sale_id)` | `is_admin()` | **[NUEVA]** Confirma venta POS atómica: bloquea venta → valida estado → descuenta stock (FOR UPDATE) → sold_count → ledger. Reemplaza lógica multi-paso anterior de React. |
| `process_pos_abono(p_sale_id, p_amount_usd, p_amount_bs, p_exchange_rate, p_usdt_rate, p_usdt_bought, p_payment_method, p_notes)` | `is_admin()` | Registra abono POS atómico: bloquea venta → crea sale_payment → actualiza amount_paid/payment_status → ledger. |
| `create_ledger_entry(p_user_id, p_entry_type, p_amount_usd, p_amount_bs, p_reference_type, p_reference_id, p_description, p_metadata)` | Interno (postgres/service_role) | Función interna contable. **EXECUTE revocado de PUBLIC/anon/authenticated.** Protección de concurrencia via `pg_advisory_xact_lock`. Si `auth.uid()` no es NULL, exige `is_admin()`. |
| `confirm_order(p_order_id)` | `is_admin()` | Confirma pedido online: bloquea order y productos, valida stock, descuenta, crea ventas, ledger. |
| `reject_order(p_order_id)` | `is_admin()` | Rechaza pedido pendiente. No permite cancelar pedidos ya confirmados. |
| `rpc_register_credit_payment(p_credit_id, p_user_id, p_amount, p_description, p_is_on_time)` | `is_admin()` | Abono a crédito. Actualiza trust_score, paid_on_time/late. |
| `rpc_register_credit_charge(p_credit_id, p_user_id, p_amount, p_description, p_sale_id)` | `is_admin()` | Cargo a crédito. Valida límite. |
| `rpc_register_abono(p_debt_id, p_amount, p_notes, p_rate)` | `is_admin()` | Abono a deuda (tabla debts). |
| `check_unique_customer_data(...)` | Cualquiera | Validación de unicidad en registro de clientes. |

## 4. Convenciones

### Seguridad
- **Autorización en PostgreSQL**: Nunca confiar en `user_id`, `is_admin`, precios o cantidades enviados desde el cliente. Toda autorización sensible se verifica en PostgreSQL.
- **Precio contra DB**: `process_checkout` valida `price_usd` enviado por el cliente contra el precio real en `products`. Si difieren, lanza excepción.
- **is_admin()**: Valida `(raw_app_meta_data->>'is_super_admin')::boolean = true` en `auth.users`.

### Atomicidad
- Toda operación multi-tabla (Venta → Stock → Ledger) debe ir en RPC. **Nunca mutar múltiples tablas independientemente desde React.**
- `confirmSale()` en `useSales.tsx` usa `supabase.rpc('confirm_pos_sale', ...)` — NO reimplementar lógica de stock en React.

### DNI / Clientes
- Formato estándar: `V-XXXXXXXX` (mayúsculas, con guión). Input normalizado a `toUpperCase()` en frontend.
- Búsqueda en `customer_profiles` usa `.eq('dni', dniRaw)` (exacto), con fallback de prefijos `V-/J-/E-/G-` si el usuario ingresa solo dígitos.
- Al registrar "Cliente Nuevo" desde Ventas, se hace upsert a `customer_profiles` post-venta para que pueda encontrarse en búsquedas futuras.

### Regla de Gracia de Créditos
- `cut_off_day = 15` (o 30), `grace_days = 3` almacenados en `credits`.
- Un pago "a tiempo" (`p_is_on_time = true`) debe calcularse en el frontend considerando: `today <= due_date + grace_days`.

### Tipado
- Fuente de verdad de tipos: `src/integrations/supabase/types.ts` → `src/types/index.ts`.
- Usar coalescencia nula (`?? ''` o `?? 0`) cuando un valor nullable de DB se envía a un parámetro no-nullable de RPC.
- No usar `any` para silenciar errores de tipo — resolver la causa.

### XSS
- Toda entrada de texto libre DEBE pasar por `sanitizeText` de `src/lib/validations.ts` antes de enviarse a Supabase.
