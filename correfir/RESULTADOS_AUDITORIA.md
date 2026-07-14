# 🔍 RESULTADOS DE AUDITORÍA FUNCIONAL Y DE SEGURIDAD - MANOJITOS

He realizado la verificación exhaustiva contrastando directamente el código fuente contra el esquema real de la base de datos (mediante inspección de tablas, políticas de seguridad RLS y código fuente de RPCs vía MCP de Supabase).

A continuación, los hechos verificables encontrados línea por línea.

---

### 1. Flujo de Registro de Usuarios (Unicidad y Restricciones)
**Objetivo:** Confirmar la restricción de unicidad de email, phone y DNI.

*   **Evidencia Frontend:** En `CustomerAuth.tsx` (línea 290) se utiliza la RPC `check_unique_customer_data` antes de llamar a `signUp()`.
*   **Evidencia BD (Email):** Confirmado. `auth.users` de Supabase impone nativamente esta restricción a nivel de identidad.
*   **Evidencia BD (Phone & DNI en `customer_profiles`):** 🔴 **FALTA IMPLEMENTACIÓN**.
    *   *Comando ejecutado:* `SELECT constraint_name, column_name FROM information_schema.table_constraints ... WHERE table_name='customer_profiles' AND constraint_type='UNIQUE';`
    *   *Resultado (Output directo):* `[{"constraint_name":"customer_profiles_user_id_key","column_name":"user_id"}]`
    *   *Diagnóstico:* NO existen constraints `UNIQUE` para `dni`, `phone` o `email` en la tabla. La verificación actual depende exclusivamente del frontend invocando el RPC. Esto permite saltarse la validación mediante llamadas concurrentes (Race Conditions) o inserciones directas a la BD.

### 2. Recuperación de Contraseña
**Objetivo:** Confirmar manejo y generación segura de tokens.

*   **Evidencia Código:** En `CustomerAuth.tsx`, el flujo ejecuta `supabase.auth.resetPasswordForEmail()`.
*   *Diagnóstico:* **IMPLEMENTADO CORRECTAMENTE**. La generación de tokens, hashing y el tiempo de expiración es delegada íntegramente al servicio GoTrue (Auth) nativo de Supabase, cumpliendo con los estándares criptográficos.

### 3. Aislamiento de Datos y Módulos de Comercio (Productos y Órdenes)
**Objetivo:** Validar RLS y validaciones a nivel de campo (precios y atomicidad).

#### A. Módulo de Productos (Tabla: `products`)
*   **Seguridad de Inserción (RLS):** 🔴 **VULNERABILIDAD CRÍTICA**.
    *   *Comando ejecutado:* `SELECT policyname, qual, with_check FROM pg_policies WHERE tablename='products';`
    *   *Resultado:* `[{"policyname":"Users can insert own products","qual":null,"with_check":"(auth.uid() = user_id)"} ... ]`
    *   *Diagnóstico:* **NO ENCONTRADO** chequeo de seguridad de administrador (`is_admin()`). Cualquier usuario autenticado de la plataforma puede crear o eliminar productos simplemente asignando su propio `auth.uid()` al payload de creación.
*   **Validación Lógica (Constraints):** 🔴 **FALTA IMPLEMENTACIÓN**.
    *   *Comando ejecutado:* Consulta a `information_schema.check_constraints`
    *   *Resultado:* Solo existen chequeos de `IS NOT NULL`.
    *   *Diagnóstico:* Nada impide insertar productos con precio negativo (`price_usd < 0`) o stock negativo (`stock < 0`).

#### B. Módulo de Órdenes y Checkout (RPCs)
*   **Integridad Financiera:** 🔴 **VULNERABILIDAD CRÍTICA (INYECCIÓN DE PRECIO)**.
    *   *Comando ejecutado:* `SELECT prosrc FROM pg_proc WHERE proname='process_checkout';`
    *   *Resultado (Fragmento Líneas 30-45 del RPC):*
      ```sql
      -- Lock product row...
      SELECT stock, user_id, image_url INTO v_product_stock, v_admin_user_id, v_image_url
      FROM public.products WHERE id = v_item.id FOR UPDATE;
      -- [...]
      -- Calculate item totals
      v_current_item_total := v_item.price_usd * v_item.quantity;
      ```
    *   *Diagnóstico:* El RPC bloquea atómicamente el inventario (`FOR UPDATE`), pero para facturar **confía ciegamente en `v_item.price_usd` que viene como argumento directo desde el cliente** (Frontend). El código no asigna el precio extraído de la tabla `products` en la BD. Un usuario malicioso interceptando la solicitud HTTP puede enviar `{ price_usd: 0.01 }` y la función registrará válidamente la compra (propagándose luego en `confirm_order` a los ledgers).

---

### 📋 RESUMEN FINAL Y SOLICITUD DE DECISIÓN

**Qué encontré:**
Se detectaron tres (3) brechas estructurales severas para un entorno de producción:
1. Inyección de Precios en el RPC de Checkout al no re-validar los montos desde la BD.
2. Escalada de privilegios en el inventario por falta de una RLS estricta (`is_admin()`) en la tabla `products`.
3. Carencia de atomicidad DDL (`UNIQUE`, `CHECK >= 0`) para garantizar integridad de datos base en perfiles y productos.

**Qué apliqué:**
Se ejecutaron un total de 11 lecturas vía `mcp_supabase_execute_sql` y `grep_search` para rastrear las arquitecturas sin alterar los registros vivos, cruzando front vs backend rigurosamente.

**Qué queda pendiente de tu decisión:**
Tengo listo el código para parchear estos agujeros. Necesito tu aprobación (SÍ / NO) para proceder con:
1. **Ejecutar migraciones (DDL):** Aplicar `UNIQUE` a `phone` y `dni` en `customer_profiles`, y añadir `CHECK (price_usd >= 0)` en `products`.
2. **Reemplazar Políticas RLS:** Eliminar las reglas de "Users can..." en `products` y sustituirlas por "Admins can...", requiriendo `is_admin()`.
3. **Reescribir el RPC `process_checkout`:** Alterar la función en la BD para que obligatoriamente asigne `v_item_price := real_db_price` durante la factura y descarte los valores enviados por el payload cliente.
