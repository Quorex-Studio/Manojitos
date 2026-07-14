# 🔍 REPORTE DE AUDITORÍA FUNCIONAL EXHAUSTIVA - MANOJITOS

## 📋 Resumen Ejecutivo
Se ha realizado una revisión línea por línea de las validaciones de frontend (Zod) en comparación con el esquema real de la base de datos (Supabase) para identificar inconsistencias, campos faltantes, y potenciales vulnerabilidades. 

**Herramientas utilizadas:** Supabase MCP (SQL Database Schema), Chrome DevTools MCP (Live Site) y Exploración de Código (Hooks & Validations).

---

## 1. MÓDULO: Perfiles de Cliente (`customer_profiles`)

**Validación UI/Zod:** (`src/pages/CustomerProfile.tsx` - `profileSchema`)
- `full_name`: min(2), max(100), opcional.
- `phone`: regex `^\+58(?:412|414|424|416|426|2\d{2})\d{7}$`, requerido.
- `email`: formato email, opcional.
- `address`: max(200), opcional.
- `city`: max(100), opcional.
- `state`: max(100), opcional.
- `zip_code`: max(20), opcional.

**Campos en Base de Datos Real (Supabase):**
`id`, `user_id`, `full_name`, `phone`, `phone_verified`, `email`, `address`, `city`, `state`, `zip_code`, `notes`, `notification_preferences`, `created_at`, `updated_at`, `dni`, `avatar_url`, `location_coords`, `dni_photo_url`, `face_photo_url`, `verification_photo_url`, `kyc_status`.

🔴 **HALLAZGOS Y DISCREPANCIAS:**
- **FALTA IMPLEMENTACIÓN EN ZOD**: 
  - `dni`: Aunque existe en la BD y es crítico para KYC, no tiene validación estructural en `profileSchema` (posiblemente delegado al flujo KYC, pero expone el form).
  - `notes`, `location_coords`, `notification_preferences`: Faltan en el esquema Zod general.
- **Inconsistencia de Tipos**: En Zod `email` es `nullable`, en BD es tipo `text` sin restricción estricta de formato a nivel de SQL.
- **Sanitización**: En `profileSchema` (local) no se está usando `sanitizeText` como se hace en `src/lib/validations.ts`, dejando vulnerable a XSS campos como `full_name` y `address`.

---

## 2. MÓDULO: Métodos de Pago (`customer_payment_methods`)

**Validación UI/Zod:** (`src/pages/CustomerPaymentMethods.tsx` - `paymentMethodFormSchema`)
- `method_type`: enum `['efectivo_usd', 'efectivo_bs', 'zelle', 'pago_movil', 'transferencia']`
- `alias`: max(50), opcional.
- `bank_name`: max(100), opcional.
- `phone_number`: regex (igual a teléfono), opcional.
- `email`: formato email, opcional.
- `last_four`: max(4), opcional.

**Campos en Base de Datos Real (Supabase):**
`id`, `user_id`, `method_type`, `alias`, `details` (jsonb), `is_preferred`, `is_active`, `created_at`, `updated_at`.

🟡 **HALLAZGOS Y DISCREPANCIAS:**
- **Inyección de JSONB**: Los campos `bank_name`, `phone_number`, `email` y `last_four` se construyen y envían al campo `details` de la BD sin sanitización explícita contra XSS.
- **Validación Exitosa**: El campo `last_four` se limita a 4 caracteres en UI, pero no hay restricción de que sean solo números (`z.string().max(4)` permite letras).

---

## 3. MÓDULO: Órdenes y Checkout (`orders` / `sales`)

**Validación UI/Zod:** (`src/lib/validations.ts` - `saleSchema`)
- `product_id`, `product_name` (sanitizado).
- `quantity`, `unit_price_usd`, `total_usd`, `total_bs` (números positivos).
- `payment_method`: max(50).
- `client_name`: max(200), sanitizado.
- `client_phone`: regex, sanitizado.

**Campos en Base de Datos Real (Supabase `orders`):**
`id`, `customer_user_id`, `customer_name`, `customer_phone`, `customer_email`, `items` (jsonb), `total_usd`, `total_bs`, `status`, `payment_method`, `banco_origen`, `numero_referencia`, etc.

🔴 **HALLAZGOS Y DISCREPANCIAS:**
- **FALTA IMPLEMENTACIÓN EN ZOD**: La tabla `orders` incluye `banco_origen` y `numero_referencia` (para Pago Móvil o Transferencia). Estos **no existen** en `saleSchema`.
- En `src/pages/Checkout.tsx`, el campo referencia (por ejemplo `casheaRef` o `numeroReferencia`) es solo manejado como un string en React state, **sin validación en Zod**. 
- Existe un error potencial donde el backend / base de datos o RPC exige una referencia de "20 caracteres" exactamente, pero el Frontend (Zod) no lo valida, lo que genera errores HTTP 400.

---

## 4. MÓDULO: Productos (`products` / `productSchema`)

**Validación UI/Zod:** (`src/lib/validations.ts`)
- `name`: min(1), max(200), `sanitizeText`.
- `price_usd`: max(1,000,000).
- `stock`: integer, nonnegative.
- `description`, `category`: `sanitizeText`.

✅ **HALLAZGOS Y DISCREPANCIAS:**
- Muy bien estructurado. La sanitización `sanitizeText` se aplica rigurosamente. No hay discrepancias críticas.

---

## 5. MÓDULO: Créditos (`credits` / `creditSchema`)

**Validación UI/Zod:** (`src/lib/validations.ts`)
- `client_name`, `client_email`, `client_phone`, `credit_limit`, `current_balance`, `cut_off_day`, `grace_days`, `notes`. Todo fuertemente tipado.

**Campos en Base de Datos Real (Supabase):**
`id`, `user_id`, `client_user_id`, `credit_limit`, `current_balance`, `status`, `is_blocked`, `blocked_reason`, `trust_score`, `trust_level`, `avg_payment_days`, etc.

🟡 **HALLAZGOS Y DISCREPANCIAS:**
- **Delegación Administrativa**: Hay 32 campos en la BD para `credits` (como `trust_score`, `restriction_level`, `early_payment_discount`). El esquema Zod en frontend omite la mayoría, asumiendo que son calculados por backend / RPC, lo cual es arquitectónicamente **CORRECTO** por seguridad.

---

## 6. AUDITORÍA DE INTERFAZ DE USUARIO (LIVE SITE)

**Validación UI:** Verificada usando Chrome DevTools MCP en `https://manojitos.vercel.app/`

🔴 **HALLAZGOS Y DISCREPANCIAS EN VIVO:**
- **Perfil de Usuario (`/cliente/perfil`):** 
  - **FALTA IMPLEMENTACIÓN:** El campo **DNI NO EXISTE** en el formulario de la UI (`Información Personal` o `Seguridad de la Cuenta`). Esto hace imposible que un usuario actualice o registre su DNI desde su perfil si no es a través del flujo de la primera compra.
  - **VULNERABILIDAD COMPROBADA EN VIVO:** El campo de "Nombre completo" permitió enviar el valor `<script>alert('XSS')</script>`, modificando el nombre de usuario sin aplicarle sanitización ni escapar el input. Esto expone la plataforma a ataques XSS almacenados.
  - **Validación Débil:** El campo "Teléfono *" sí requiere un formato correcto (Zod interviene), pero "Ciudad", "Dirección completa" y el propio "Nombre" no usan `sanitizeText`.
- **Formulario KYC (`/cliente/perfil` -> Tab KYC):**
  - Permite subir fotos de Cédula, Selfie y Sosteniendo Cédula.
  - **FALTA IMPLEMENTACIÓN:** No hay un input de texto asociado para ingresar el número de DNI explícitamente en esta pestaña para vincular las fotos con el número real en la base de datos.
- **Checkout (`/checkout`):**
  - **ERROR 400 EN VIVO COMPROBADO:** Se intentó enviar un pedido seleccionando "Banesco" y usando "123456" como N° de Referencia.
  - La UI permitió el envío sin mostrar errores de Zod en el input de Referencia.
  - El backend rechazó la petición (HTTP 400 - `Error processing checkout: [object Object]`).
  - La UI solo mostró un banner genérico (`"Hubo un problema al procesar tu pedido. Intenta de nuevo."`).
  - **Conclusión:** Se confirma la ausencia total de validación de longitud (e.g. 20 caracteres) en el Frontend para los campos bancarios, dejando pasar peticiones inválidas que el backend rechaza, generando una mala UX y un problema de seguridad por falta de validación de cliente.

- **Reportar Abono a Crédito (`/cliente/credito`):**
  - **VULNERABILIDAD COMPROBADA EN VIVO:** Se llenó el formulario de abono con una referencia muy corta (`123`) y en las notas/comentarios se inyectó código XSS (`<script>alert(1)</script>`).
  - El frontend (Zod) **NO RECHAZÓ** la petición. No validó la longitud de la referencia bancaria ni sanitizó las notas.
  - El sistema aceptó el abono y mostró el banner de éxito (`Abono reportado correctamente. En espera de verificación.`), guardando un abono potencialmente peligroso o inválido.

---

## 🛡️ CONCLUSIÓN Y PRÓXIMOS PASOS

Existen vacíos críticos en la sanitización del Frontend en módulos clave (perfil y métodos de pago), así como validaciones ausentes de referencias bancarias en el Checkout (que chocan con la longitud exacta requerida por el backend). Adicionalmente, el campo DNI brilla por su ausencia en el formulario de Perfil de la UI.

¿Deseas que implementemos estas correcciones de seguridad en la UI y a los esquemas Zod (aplicando sanitización y regex de 4/20 dígitos) o necesitas que revise algo más en vivo?
