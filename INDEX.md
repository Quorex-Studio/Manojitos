# Manojitos - Índice del Proyecto

## 1. Mapa de Archivos (Frontend)
El proyecto es una aplicación React (Vite) en TypeScript. La estructura principal incluye:

- `src/components/`: Componentes UI reutilizables (shadcn/ui en `src/components/ui/`), layout, y modales de uso compartido.
- `src/hooks/`: Custom hooks principales para interactuar con la base de datos (e.g., `useProducts.tsx`, `useSales.tsx`, `useCustomerProfile.tsx`, `useLedger.tsx`, `useExchangeRate.tsx`, `useBusinessRules.tsx`).
- `src/pages/`: Vistas de la aplicación (e.g., `Sales.tsx`, `Customers.tsx`, `Products.tsx`, `Checkout.tsx`, `Credits.tsx`, `BusinessRules.tsx`).
- `src/integrations/supabase/`: Archivos para la integración con Supabase. `types.ts` contiene las definiciones exportadas de la base de datos.
- `src/types/index.ts`: Definiciones de interfaces internas para el tipado a nivel de la UI.
- `src/contexts/`: Contextos de React como `CartContext.tsx` y `AuthContext.tsx`.

## 2. Esquema de Base de Datos
Las tablas clave para el negocio, manejadas a través de Supabase:

- **products**: Catálogo principal de productos (`id`, `name`, `sku`, `price`, `cost`, `stock`, `stock_min`, `stock_max`).
- **customer_profiles**: Perfiles de clientes (`id`, `user_id`, `full_name`, `email`, `phone`, y campos KYC como `avatar_url`, `dni_photo_url`, `rif_photo_url`, `kyc_status`).
- **orders**: Pedidos de compras o ventas (`id`, `customer_user_id`, `status`, `total_usd`, `banco_origen`, `numero_referencia`, `payment_method`). Cuenta con políticas RLS para lectura propia (`customer_user_id = auth.uid()`), gestión total por admins (`is_admin()`), e inserción por clientes autenticados (`Customers can insert own orders`).
- **order_items**: Detalle de productos por pedido.
- **ledger**: Libro contable con ingresos, egresos y movimientos de la caja.
- **credits**: Líneas de crédito (`id`, `client_user_id`, `client_name`, `credit_limit`, `current_balance`, `cut_off_day`, `status`).
- **credit_transactions**: Historial de abonos y recargos (`id`, `credit_id`, `amount`, `type` [ABONO|CARGO]).
- **business_rules**: Reglas de negocio (lealtad, descuentos) configuradas en la plataforma (`id`, `name`, `rule_type`, `conditions`, `actions`).
- **sales**: Ventas presenciales registradas desde el panel admin (`id`, `user_id` [quien procesó], `customer_user_id` [cliente real, vinculado por trigger `trg_sales_autolink_customer` vía `normalize_ve_phone()`], `product_id`, `product_name`, `quantity`, `unit_price_usd`, `total_usd`, `total_bs`, `client_name`, `client_phone`, `payment_method`, `is_credit`, `status`, `notes`). RLS: SELECT por `user_id` (staff) o `customer_user_id` (cliente).

## 3. RPCs (Remote Procedure Calls) de Supabase
Las RPCs principales usadas para aislar la lógica compleja y asegurar consistencia:

- `process_checkout(p_customer_id, p_items, p_payment_method, p_banco_origen, p_numero_referencia, ...)`: Procesa ventas de forma atómica (crea la orden, inserta `order_items`, actualiza `stock` y asienta el ingreso en el `ledger`).
- `process_inventory_adjustment(...)`: Ajusta los niveles de stock registrando las salidas contables o ajustes correspondientes.
- `register_credit_payment(...)`: Registra un abono (ABONO) para un crédito y asienta automáticamente el ingreso al `ledger`.
- `check_unique_customer_data(...)`: Utilizado durante el registro para garantizar que DNI, RIF, teléfono y correo electrónico no se dupliquen.
- `confirm_order(order_id)` / `reject_order(order_id)`: Utilizado para transiciones de estado de pedidos online que requieren validación.

## 4. Convenciones

### Tipado Estricto (Frontend)
- Los tipos generados automáticamente (`Database` en `src/integrations/supabase/types.ts`) dictan el contrato de base de datos.
- Las interfaces de la aplicación (`src/types/index.ts`) deben mantenerse sincronizadas con los tipos de la BD pero proveer flexibilidad (e.g. propiedades opcionales o anidadas).
- Cuando los parámetros de una RPC esperan una cadena (String) pero un valor es anulable desde la DB/interfaz, se debe usar coalescencia nula (`?? ''` o `?? 0`) antes de enviar el valor.

### Seguridad y Validaciones (Frontend)
- **Prevención XSS (Cross-Site Scripting)**: Toda entrada de texto libre capturada en formularios (ej. direcciones, referencias de pago, alias) DEBE ser procesada a través de `sanitizeText` de `src/lib/validations.ts` junto con `zod` antes de enviarse al backend o base de datos.
- **KYC y DNI**: El campo `DNI` es obligatorio en el perfil del cliente para cumplir con políticas KYC.

### Llamadas a Base de Datos
- **Mutaciones Atómicas**: Toda operación que involucre múltiples tablas (por ejemplo: Venta -> Disminuir Stock -> Actualizar Libro Mayor) debe estar encapsulada en una función de PostgREST (RPC). Nunca mutar múltiples tablas de manera independiente desde el frontend para evitar inconsistencias en la base de datos si ocurre un fallo a mitad del proceso.
- **Consultas**: Las consultas simples o filtradas pueden realizarse desde el frontend (vía el cliente estándar de `supabase`), mientras que las transacciones y agregaciones complejas pertenecen a RPCs.

### Estado y Renderizado
- Se utiliza React Query (implícito en los custom hooks creados sobre Supabase) u otros mecanismos de estado locales en combinación con contexto global (`CartContext`, `AuthContext`).
- Nunca usar variables de estado no exportadas (como errores de validación sin exportar explícitamente desde sus archivos de origen).
