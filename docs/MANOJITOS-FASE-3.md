# Manojitos · Fase 3: mejoras con base de datos (04-10-2026)

Tercera entrega de las mejoras traídas de la plantilla (EINA), ahora con acceso a la base de
Manojitos (proyecto Supabase `utfoempgdbhhikpvbvir`). **Manojitos conserva su identidad**: rosa y
dorado, su logo, Ángela, sus categorías de boutique y sus textos. **El costeo no se tocó**: la
calculadora de precios de Manojitos es la suya (no se portaron `da1ce30` ni `82461d6` de EINA).

## 1. Qué mejora para la dueña y las clientas

| Mejora | Qué cambia | Dónde |
|---|---|---|
| **Categorías configurables** | Configuración → Categorías: crear, renombrar (mueve sus productos), ordenar y borrar (solo si está vacía). Cada categoría pide su detalle: tallas, contenido (ml), medidas, tonos o nada | `CategoriesSettings.tsx`, `CategoryDetailFields.tsx` |
| **Stock por talla** | Un producto puede tener variantes (S, M, L, "Única", 50 ml…) con su propio stock y, si hace falta, su precio. El stock del producto es la suma; el checkout, Nueva venta, devoluciones y Ángela descuentan la talla exacta | `product_variants`, `apply_stock_change` |
| **Imágenes desde Drive o Dropbox** | Pegar el enlace de compartir y se convierte solo en imagen directa, con vista previa | `lib/imageUrl.ts` |
| **Foto de perfil y documentos privados** | Se creó el almacenamiento privado `customer-kyc`: cédula, rostro y selfie ya no quedan públicos; se ven con enlaces firmados que vencen. La foto se comprime antes de subir | `lib/customerFiles.ts`, `useKycUrl.ts` |
| **Por cobrar por clienta** | Una tarjeta por clienta con su deuda total, fecha y número de facturas; orden por deuda, antigüedad o A–Z | `Sales.tsx` |
| **Editar precios sin sorpresas** | La calculadora de Manojitos ya no pisa el precio, no borra el costo ni suma stock al editar; errores en español | `Products.tsx`, `lib/validations.ts` |
| **Marcar pagado pide el método** | Igual que un abono: monto fijo y método obligatorio | `Sales.tsx` |
| **Recibo con cada abono** | El recibo (PDF 80 mm y WhatsApp) lista cada abono; botón de recibo en Por cobrar | `lib/receipt.ts`, `ReceiptDialog.tsx` |
| **Mis pedidos (clienta)** | Las compras hechas en la tienda física aparecen agrupadas, con deuda visible y recibo con abonos. La clienta ahora ve también los abonos registrados al grupo de la venta | `useCustomerOrders.tsx`, migración `20260926000000` |
| **Envío nacional** | En el checkout: "Otra ciudad de Venezuela (MRW, Zoom o Tealca)"; el envío lo cobra la agencia; aviso si falta el municipio | `Checkout.tsx` |
| **Métodos de pago reales** | Atención anuncia los métodos activos en Configuración; si no hay WhatsApp ofrece Instagram; 404 en español | `usePaymentMethods.tsx`, `Atencion.tsx`, `NotFound.tsx` |
| **Correos automáticos** | Cada notificación y cada factura (venta y abono) sale por correo desde una cola; el aviso de pedido nuevo a la dueña sale de ahí | `email_outbox`, `send-email/outbox.ts` |
| **Notificaciones que se abren** | Tocar una notificación la abre completa con botón a su pantalla; nueva página del panel `/notificaciones` | `NotificationDetailDialog.tsx`, `AdminNotifications.tsx` |
| **Factura en el checkout** | Al terminar la compra, la clienta ve su factura con PDF, compartir e imprimir | `Checkout.tsx`, `ReceiptView` |
| **"Lo quiero"** | En productos agotados la clienta pide que le avisen; panel **Productos pedidos** (`/solicitudes`); al reponer stock le llega "¡Volvió lo que querías!" | `product_requests`, `RequestProductButton.tsx`, `ProductRequests.tsx` |
| **Avisos a la dueña por WhatsApp** | Configuración → Preferencias: número y clave de CallMeBot, con botón de prueba | `OwnerAlertsSettings.tsx` |
| **Clienta nueva con cuenta** | En Nueva venta (y con Ángela) una clienta nueva necesita correo: se le crea su cuenta sin contraseña; entra con "Olvidé mi contraseña" y completa su perfil | `admin-actions`, `customerAccounts.ts`, `ProfileCompletionGate.tsx` |
| **Ángela con acciones** | Prepara compras (clienta) y ventas, compras a proveedor, abonos y entradas de stock (administración); nada se registra sin tocar "Confirmar" | `ai-assistant/actions.ts`, `AngelaChat.tsx` |
| **Reportes PDF estilo factura** | Por cobrar y estado de cuenta en PDF (con estado de cada cuenta, antigüedad, detalle por clienta o por categoría, cuentas prioritarias); Ángela lo entrega como adjunto; módulo Reportes interactivo | `lib/receivablesReport.ts`, `pdfBrand.ts`, `Reports.tsx` (ver `REPORTES-PDF.md`) |

## 2. Base de datos (aplicado en producción)

Todas las migraciones son **idempotentes y sin `DROP`** (el conector pide aprobación para cada
sentencia destructiva). Cada archivo del repo coincide con lo aplicado.

| Archivo | Qué hace | Adaptación a Manojitos |
|---|---|---|
| `20260924000000_security_hardening.sql` | Ninguna función `SECURITY DEFINER` se ejecuta sin sesión; `create_ledger_entry` solo admin; nadie registra auditoría a nombre de otra persona | `pg_net` no se movió de schema (se bloquea con su worker en producción); `check_unique_customer_data` conserva su acceso (ya estaba sin acceso anónimo); políticas con `ALTER` |
| `20260924000100_cron_secret.sql` | `cron_secret` y `project_url` en el Vault; `verify_cron_secret()` | No se programan las alertas horarias de Ángela (sus tablas se quitaron en `drop_angela_tables`) |
| `20260925010000_email_secrets_reader.sql` | `get_email_secret()` para leer claves de correo del Vault (solo servidor) | — |
| `20260925020000_product_categories.sql` | Tabla de categorías, `products.presentation`, renombrar/borrar seguro | Categorías iniciales de la boutique: Ropa, Pantalones, Deportivo, Ropa Interior, Ropa de Baño, Playa, Calzado (tallas), Accesorios, Perfumes (ml), Otros |
| `20260925030000_product_variants.sql` | Variantes con stock, `apply_stock_change`, checkout, confirmar pedido, venta de mostrador y devoluciones por variante | Se agregó `orders.delivery_fee` (no existía); `process_checkout` conserva la firma de Manojitos |
| `20260925040000_customer_storage_buckets.sql` | `customer-kyc` privado y políticas por carpeta | Se conservan las políticas de avatar que ya tenía Manojitos |
| `20260926000000_customer_group_payments_read.sql` | La clienta lee los abonos de grupo de sus compras | Nueva (Manojitos solo permitía los de una línea) |
| `20260927010000_email_outbox.sql` | Cola de correos, disparadores y cron cada 20 s | El cron se programó después de desplegar `send-email` |
| `20260927020000_customer_uniqueness.sql` | Cuentas únicas por dígitos | **Aplicado**: `check_unique_customer_data`. **Pendiente** (ver §4): `handle_new_user` y quitar las restricciones repetidas |
| `20260927040000_product_requests.sql` | "Lo quiero" y aviso al reponer | — |
| `20260927050000_admin_created_accounts.sql` | `profile_pending`, `admin_find_user_by_email` | **Pendiente** (ver §4): `handle_new_user` |

## 3. Edge functions desplegadas

| Función | Versión | Comprobado |
|---|---|---|
| `admin-actions` | 9 | Responde 401 sin sesión |
| `send-email` | 14 | Cola procesada con el secreto del cron: 200 `{sent:0, skipped:0, failed:0}`; Resend ya estaba configurado |
| `ai-assistant` | 51 | Responde 401 sin sesión |

`send-credit-notifications` no se redesplegó: solo cambia el diseño del correo de recordatorio y la
versión actual funciona. Se puede desplegar cuando se quiera (usa `../send-email/templates.ts`).

## 4. Pendiente de tu aprobación (una sola vez)

El conector de Supabase pide confirmar las sentencias `DROP`/`DELETE`, así que esto quedó **sin
aplicar** (la base está consistente sin ello). Ejecutarlo en el editor SQL de Supabase:

1. `handle_new_user` nuevo (está en `20260927050000_admin_created_accounts.sql`): reemplaza el
   perfil provisional que deja una venta del panel, guarda teléfono/cédula vacíos como `NULL` y, si
   la cuenta la creó la tienda, le pasa sus compras y créditos anteriores y marca el perfil por completar.
2. Quitar `unique_dni_per_customer` y `unique_phone_per_customer` (quedan los índices únicos
   parciales `idx_customer_profiles_unique_dni/_phone`). Hoy, dos cuentas sin teléfono chocan.
3. `20260927030000_owner_sale_alerts.sql`: permite el aviso "Venta registrada · $X" a la dueña por
   cada venta del panel (cambia la restricción de `email_outbox.kind`).

Hasta entonces: crear clientas desde Nueva venta funciona, pero sus compras anteriores no se le
pasan solas y el aviso de cada venta del panel no sale (el de pedido nuevo sí).

## 5. Lo que no se portó y por qué

- **Costeo de EINA** (`da1ce30`, `82461d6`): Manojitos costea distinto y conserva su calculadora.
- **Dominio** (`88aadfe`) y **política de 72 horas** (`7cf6d7c`): son de EINA.
- **Avisos push**: la tabla `push_subscriptions` nunca se creó en Manojitos (su migración apunta a
  una tabla `admin_users` que no existe) y faltan las claves VAPID. Queda para otra fase.

## 6. Para revisar en el panel

- Categorías repetidas que ya usaban los productos: **Pantalon / Pantalones**, **Accesorio /
  Accesorios**, **Perfume / Perfumes**. En Configuración → Categorías, renombrar una al nombre de
  la otra mueve sus productos.
- Productos con tallas: hoy usan la lista de tallas sin stock propio. Para llevar stock por talla,
  editar el producto y cargar las unidades de cada talla.

## 7. Verificación

- `npx vitest run`: 74/74. `npm run build`: OK. `tsc -p tsconfig.app.json`: 46 errores (antes 49, todos previos).
- PDF de Por cobrar renderizado y revisado con los datos de ejemplo de la boutique.
- `postcss.config.js` limpio (81 bytes): el commit `121bbb1` de EINA traía otra vez el malware y se descartó.
