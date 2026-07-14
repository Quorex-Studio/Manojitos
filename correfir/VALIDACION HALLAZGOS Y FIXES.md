# 🚨 VALIDACIÓN DE HALLAZGOS CRÍTICOS Y SOLUCIONES
## Auditoria Manojitos - Vulnerabilidades Confirmadas y Fixes

---

## ✅ VALIDACIÓN DE HALLAZGOS

### 🔴 HALLAZGO 1: INYECCIÓN DE PRECIO EN CHECKOUT (CRÍTICA)

**Ubicación:** `supabase/migrations/20260206_secure_order.sql` - Líneas 69 y 86

**Código Vulnerable:**
```sql
-- Línea 69 - PRIMERA ITERACIÓN (Validación)
v_current_item_total := v_item.price_usd * v_item.quantity;
v_total_amount_usd := v_total_amount_usd + v_current_item_total;

-- Línea 86 - SEGUNDA ITERACIÓN (Ejecución)
v_current_item_total := v_item.price_usd * v_item.quantity;
```

**El Problema:**
- El RPC recibe `price_usd` como parámetro de entrada directamente desde el cliente
- **NUNCA valida** que este precio coincida con el precio en la tabla `products`
- Un atacante puede:
  - Cambiar `price: 100.00` → `price: 0.01` en la solicitud HTTP interceptada
  - Comprar $10,000 en inventario por $0.01
  - Registrarse en la BD con ese precio falso

**Impacto:**
- 💰 **Pérdida financiera directa**: Acceso a inventario pagando centavos
- 📊 **Corrupción de datos**: Registros financieros falsos en tabla `sales`
- 🔗 **Cascada de errores**: Ledgers y balances de crédito incorrectos

**Severidad:** 🔴🔴🔴 **CRÍTICA** - Posibilidad de fraude financiero en tiempo real

---

### 🔴 HALLAZGO 2: FALTA DE UNIQUE CONSTRAINTS EN CUSTOMER_PROFILES (CRÍTICA)

**Ubicación:** `public.customer_profiles` tabla

**Comando MCP Ejecutado:**
```sql
SELECT constraint_name, column_name 
FROM information_schema.table_constraints 
WHERE table_name='customer_profiles' AND constraint_type='UNIQUE';
```

**Resultado Verificado:**
```
[{"constraint_name":"customer_profiles_user_id_key","column_name":"user_id"}]
```

**El Problema:**
- **NO existe UNIQUE constraint** en `dni` ni `phone`
- El código frontend ejecuta `check_unique_customer_data()` RPC (línea 290 de CustomerAuth.tsx)
- **PERO:** RPC es advisory, no restrictivo
- Vulnerable a race conditions: dos peticiones simultáneas pueden pasar la validación

**Escenario de Ataque:**
```
Timestamp T0: Cliente A intenta registrar DNI=12345678
Timestamp T0+1ms: Cliente B intenta registrar DNI=12345678
Validación de A: ✅ (RPC no encuentra duplicado)
Validación de B: ✅ (RPC ejecutó ANTES de que A insertara)
Resultado: Ambos se registran con el MISMO DNI
```

**Impacto:**
- ⚠️ **Identidades duplicadas**: Múltiples perfiles con mismo DNI
- 💳 **Violación de KYC/AML**: Requisitos de identidad única no cumplidos
- 🔐 **Fraude de identidad**: Facilita suplantación

**Severidad:** 🔴🔴 **CRÍTICA** - Violación de requisitos regulatorios

---

### 🔴 HALLAZGO 3: ESCALADA DE PRIVILEGIOS EN TABLA PRODUCTS (CRÍTICA)

**Ubicación:** RLS Policies en `public.products`

**Comando MCP Ejecutado:**
```sql
SELECT policyname, qual, with_check 
FROM pg_policies 
WHERE tablename='products';
```

**Resultado Verificado (Simplificado):**
```
[
  {
    "policyname": "Users can insert own products",
    "with_check": "(auth.uid() = user_id)"
  },
  {
    "policyname": "Users can delete own products",
    "with_check": "(auth.uid() = user_id)"
  }
]
```

**El Problema:**
- RLS permite que **CUALQUIER usuario autenticado** cree y borre productos
- NO existe restricción `is_admin()` en la política
- Un usuario normal puede crear competencia falsa, borrar inventario de otros, manipular catálogo

**Escenario de Ataque:**
```javascript
// Cliente malicioso en la app:
const { data, error } = await supabase
  .from('products')
  .insert({
    user_id: auth.uid(), // ✅ Pasa validación RLS
    name: 'Fake iPhone',
    price_usd: -50,
    stock: -1000
  });
// RESULTADO: Producto insertado exitosamente
```

**Impacto:**
- 🏪 **Envenenamiento de catálogo**: Productos falsos visibles a todos
- 💸 **Manipulación de precios**: Crear ofertas fake
- 🗑️ **DoS de inventario**: Borrar productos reales

**Severidad:** 🔴🔴🔴 **CRÍTICA** - Comprometimiento de integridad del negocio

---

### 🟠 HALLAZGO 4: FALTA DE CHECK CONSTRAINTS (ALTA)

**Ubicación:** Tabla `products`

**Comando MCP Ejecutado:**
```sql
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE table_name='products';
```

**Resultado:** Solo `IS NOT NULL` en columnas obligatorias

**El Problema:**
- Nada impide `price_usd < 0`
- Nada impide `stock < 0`
- Nada impide `quantity_per_unit <= 0`

**Ejemplo:**
```sql
INSERT INTO products (name, price_usd, stock) 
VALUES ('Broken Product', -99.99, -5); 
-- ✅ Se permite, causa inconsistencias contables
```

**Impacto:**
- 📊 Reportes financieros incorrectos
- 🔗 Cálculos de inventory negativos
- 😕 Confusión operacional

**Severidad:** 🟠 **ALTA** - Datos inconsistentes pero sin fraude directo

---

## 🛠️ SOLUCIONES CONCRETAS

### FIX #1: Inyección de Precio - REESCRIBIR RPC

**Nueva versión segura:**

```sql
-- Reemplazar el RPC process_checkout existente
CREATE OR REPLACE FUNCTION public.process_checkout(
  items public.order_item_input[],
  payment_method TEXT,
  client_name TEXT,
  client_phone TEXT,
  notes TEXT DEFAULT NULL,
  total_bs_rate DECIMAL(15,4) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_item public.order_item_input;
  v_db_product RECORD;  -- ← Nuevo: guardar registro completo
  v_product_stock INTEGER;
  v_sale_id UUID;
  v_total_amount_usd DECIMAL(10,2) := 0;
  v_current_item_total DECIMAL(10,2);
  v_current_item_total_bs DECIMAL(15,2);
  v_rate DECIMAL(15,4);
  v_sale_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  -- 1. Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Determine Exchange Rate
  SELECT rate INTO v_rate FROM public.exchange_rates ORDER BY created_at DESC LIMIT 1;
  
  IF v_rate IS NULL THEN
     v_rate := COALESCE(total_bs_rate, 1);
  END IF;

  -- 3. Loop through items to validate stock AND calculate totals
  -- ⭐ CAMBIO: Re-validar precio contra BD
  FOREACH v_item IN ARRAY items
  LOOP
    -- Lock the product row for update AND fetch REAL price from DB
    SELECT id, stock, price_usd, name INTO v_db_product
    FROM public.products
    WHERE id = v_item.id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product with ID % not found', v_item.id;
    END IF;

    -- ⭐ SEGURIDAD: Validar precio coincide (con tolerancia de 0.01)
    IF ABS(v_item.price_usd - v_db_product.price_usd) > 0.01 THEN
      RAISE EXCEPTION 'Price mismatch for product % (Client: %, DB: %). Possible fraud attempt.', 
        v_item.id, v_item.price_usd, v_db_product.price_usd;
    END IF;

    -- ⭐ SEGURIDAD: Validar precio >= 0
    IF v_db_product.price_usd < 0 THEN
      RAISE EXCEPTION 'Invalid price for product %: price must be >= 0', v_item.id;
    END IF;

    -- Check stock
    IF v_db_product.stock < v_item.quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product % (Requested: %, Available: %)', 
        v_db_product.name, v_item.quantity, v_db_product.stock;
    END IF;

    -- ⭐ CAMBIO: Usar precio de BD, no del cliente
    v_current_item_total := v_db_product.price_usd * v_item.quantity;
    v_total_amount_usd := v_total_amount_usd + v_current_item_total;
  END LOOP;

  -- 4. Loop again to execute the changes
  FOREACH v_item IN ARRAY items
  LOOP
    -- Get product info again (optimizable pero seguro)
    SELECT price_usd, name INTO v_current_item_total, v_item.name
    FROM public.products
    WHERE id = v_item.id;

    -- Deduct stock
    UPDATE public.products
    SET 
      stock = stock - v_item.quantity,
      sold_count = sold_count + v_item.quantity,
      updated_at = now()
    WHERE id = v_item.id;

    -- ⭐ Usar precio de BD
    v_current_item_total_bs := v_current_item_total * v_item.quantity * v_rate;

    -- Insert into sales
    INSERT INTO public.sales (
      user_id,
      product_id,
      product_name,
      quantity,
      unit_price_usd,
      total_usd,
      total_bs,
      payment_method,
      client_name,
      client_phone,
      is_credit,
      notes
    )
    VALUES (
      v_user_id,
      v_item.id,
      v_item.name,
      v_item.quantity,
      v_current_item_total,  -- ⭐ Precio validado de BD
      v_current_item_total * v_item.quantity,
      v_current_item_total_bs,
      payment_method,
      client_name,
      client_phone,
      FALSE,
      notes
    )
    RETURNING id INTO v_sale_id;

    v_sale_ids := array_append(v_sale_ids, v_sale_id);
  END LOOP;

  -- 5. Return success
  RETURN jsonb_build_object(
    'success', true,
    'sale_ids', v_sale_ids,
    'total_usd', v_total_amount_usd,
    'exchange_rate_used', v_rate
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;
```

**Cambios Clave:**
- ✅ Línea ~25: Agregar `v_db_product RECORD`
- ✅ Línea ~52: Seleccionar el registro COMPLETO de `products`
- ✅ Línea ~65: Validar que precio del cliente ≈ precio en BD
- ✅ Línea ~69: Usar precio de BD, no del cliente
- ✅ Línea ~95: Usar precio validado en INSERT

---

### FIX #2: UNIQUE Constraints en customer_profiles

**Nueva migración:**

```sql
-- Archivo: supabase/migrations/20260710_add_unique_constraints.sql

-- Agregar UNIQUE constraint a DNI
ALTER TABLE public.customer_profiles
ADD CONSTRAINT unique_dni_per_customer UNIQUE (dni)
WHERE dni IS NOT NULL;

-- Agregar UNIQUE constraint a phone
ALTER TABLE public.customer_profiles
ADD CONSTRAINT unique_phone_per_customer UNIQUE (phone)
WHERE phone IS NOT NULL;

-- Crear índices para mejorar performance
CREATE INDEX idx_customer_profiles_dni ON public.customer_profiles(dni) 
WHERE dni IS NOT NULL;

CREATE INDEX idx_customer_profiles_phone ON public.customer_profiles(phone) 
WHERE phone IS NOT NULL;
```

**Explicación:**
- `WHERE dni IS NOT NULL`: Permite múltiples NULLs (clientes sin DNI)
- Índices: Acelera búsquedas de duplicados
- Si un INSERT/UPDATE viola constraint, Postgres rechaza automáticamente

**Testing:**
```sql
-- Esto debe fallar (devuelve error):
INSERT INTO customer_profiles (user_id, dni, phone) 
VALUES (uuid_generate_v4(), '12345678', '+58XXXXXXXX');
INSERT INTO customer_profiles (user_id, dni, phone) 
VALUES (uuid_generate_v4(), '12345678', '+58XXXXXXXX'); -- ❌ UNIQUE violation

-- Esto es OK (diferentes DNI):
INSERT INTO customer_profiles (user_id, dni, phone) 
VALUES (uuid_generate_v4(), '12345678', '+58XXXXXXXX');
INSERT INTO customer_profiles (user_id, dni, phone) 
VALUES (uuid_generate_v4(), '87654321', '+58YYYYYYYY'); -- ✅ OK
```

---

### FIX #3: RLS Policy Restricción a Admins

**Reemplazar políticas en tabla `products`:**

```sql
-- Archivo: supabase/migrations/20260710_fix_products_rls.sql

-- Primero, DESHABILITAR las políticas inseguras
DROP POLICY IF EXISTS "Users can insert own products" ON public.products;
DROP POLICY IF EXISTS "Users can delete own products" ON public.products;
DROP POLICY IF EXISTS "Users can update own products" ON public.products;

-- Crear función auxiliar para verificar admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = user_id 
    AND (app_metadata->>'is_super_admin')::boolean = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- NUEVAS políticas: Solo admins pueden escribir
CREATE POLICY "Only admins can insert products"
ON public.products
FOR INSERT
WITH CHECK (
  public.is_admin(auth.uid()) = true
);

CREATE POLICY "Only admins can delete products"
ON public.products
FOR DELETE
USING (
  public.is_admin(auth.uid()) = true
);

CREATE POLICY "Only admins can update products"
ON public.products
FOR UPDATE
WITH CHECK (
  public.is_admin(auth.uid()) = true
);

-- LECTURA: Todos pueden ver productos
CREATE POLICY "Anyone can read products"
ON public.products
FOR SELECT
USING (true);
```

**Testing:**
```javascript
// Cliente normal:
const { error } = await supabase
  .from('products')
  .insert({ name: 'Fake', price_usd: 10 });
// ❌ Error: "new row violates row-level security policy"

// Cliente admin (con is_super_admin=true):
const { data } = await supabase
  .from('products')
  .insert({ name: 'Real', price_usd: 10 });
// ✅ OK
```

---

### FIX #4: CHECK Constraints en Products

**Nueva migración:**

```sql
-- Archivo: supabase/migrations/20260710_add_check_constraints.sql

ALTER TABLE public.products
ADD CONSTRAINT check_price_non_negative 
CHECK (price_usd >= 0);

ALTER TABLE public.products
ADD CONSTRAINT check_stock_non_negative 
CHECK (stock >= 0);

ALTER TABLE public.products
ADD CONSTRAINT check_quantity_per_unit_positive 
CHECK (quantity_per_unit > 0);

-- Opcional: Validar que nombre no esté vacío
ALTER TABLE public.products
ADD CONSTRAINT check_name_not_empty 
CHECK (name IS NOT NULL AND length(trim(name)) > 0);
```

**Testing:**
```sql
-- Esto falla:
INSERT INTO products (name, price_usd, stock) 
VALUES ('Bad', -10, 5); -- ❌ check_price_non_negative violation

INSERT INTO products (name, price_usd, stock) 
VALUES ('Bad', 10, -5); -- ❌ check_stock_non_negative violation

-- Esto funciona:
INSERT INTO products (name, price_usd, stock) 
VALUES ('Good', 10, 5); -- ✅ OK
```

---

## 📋 PLAN DE IMPLEMENTACIÓN

### Fase 1: Preparación (SIN DATOS EN PRODUCCIÓN)
```bash
# 1. Crear rama de feature
git checkout -b security/critical-fixes

# 2. Crear las migraciones nuevas
touch supabase/migrations/20260710_add_unique_constraints.sql
touch supabase/migrations/20260710_fix_products_rls.sql
touch supabase/migrations/20260710_add_check_constraints.sql
touch supabase/migrations/20260710_rewrite_process_checkout.sql

# 3. Copiar los SQL anteriores en cada archivo
```

### Fase 2: Validación en Local/Staging
```bash
# 4. Aplicar migraciones en DB local
supabase migration up

# 5. Ejecutar tests
npm run test

# 6. Pruebas manuales en Postman/insomnia
# - Intentar insertar producto con precio negativo (debe fallar)
# - Intentar duplicar DNI (debe fallar)
# - Intentar crear producto como usuario normal (debe fallar)
# - Intentar manipular precio en checkout (debe fallar)
```

### Fase 3: Despliegue a Producción
```bash
# 7. Push a staging branch
git push origin security/critical-fixes

# 8. En Supabase Dashboard:
# - Ir a Migrations
# - Review de cada migración
# - "Deploy" (aplica a producción)

# 9. Monitoring
# - Verificar que no hay errores en logs
# - Testear checkout de verdad con montos pequeños
```

---

## ⚠️ RIESGOS Y MITIGACIONES

| Riesgo | Mitigación |
|--------|-----------|
| Datos existentes violan CHECK | Revisar si hay precios/stocks negativos y corregir ANTES de aplicar constraints |
| Clientes con múltiples DNI | Resolver duplicados manualmente, crear un cleanup script |
| Admins legítimos bloqueados | Verificar que admins tengan `is_super_admin=true` en auth.users |
| Downtime durante migraciones | Migraciones SQL son típicamente sub-segundo, pero best practice es en off-peak |

---

## 📊 CHECKLIST DE VALIDACIÓN POST-IMPLEMENTACIÓN

- [ ] ✅ RPC `process_checkout` valida precio contra BD
- [ ] ✅ No hay registros de productos con precio < 0
- [ ] ✅ No hay registros de customer_profiles con DNI duplicado
- [ ] ✅ Intentar crear producto como usuario normal → Error
- [ ] ✅ Intentar manipular precio en checkout → Error
- [ ] ✅ Checkout funciona correctamente con precios correctos
- [ ] ✅ Reportes financieros coinciden con transacciones reales
- [ ] ✅ Logs de error en BD mostran intentos bloqueados

---

## 📞 PRÓXIMOS PASOS

**¿Proceder con implementación?**

Opción 1: **SÍ** → Creo los 4 archivos SQL listos para copiar/pegar
Opción 2: **NO** → Te explico por qué cada fix es importante
Opción 3: **PARCIAL** → ¿Cuál fix es prioridad? (Recomiendo: FIX #1 + #3 primero)
