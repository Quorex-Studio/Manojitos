# 🛠️ GUÍA PASO A PASO: IMPLEMENTAR FIXES DE SEGURIDAD
## Manojitos - Corrección de Vulnerabilidades Críticas

---

## 📋 PREPARACIÓN (Leer Primero)

Antes de empezar, lee estos documentos en orden:
1. ✅ `RESUMEN_EJECUTIVO_VULNERABILIDADES.md` (1 min)
2. ✅ `VALIDACION_HALLAZGOS_Y_FIXES.md` (5 min)
3. ⬅️ Este documento (10 min)

---

## ✅ PRE-REQUISITOS

Verifica que tienes:
- [ ] Acceso a Supabase Dashboard (Admin)
- [ ] Git instalado y acceso al repo
- [ ] Línea de comandos (Terminal/PowerShell)
- [ ] Un backup de BD listo (recomendado)
- [ ] 2 horas de tiempo sin interrupciones

---

## 🚀 FASE 1: VERIFICACIÓN DE DATOS ACTUALES (15 min)

### Paso 1.1: Buscar Duplicados de DNI

**En Supabase Dashboard → SQL Editor:**

```sql
-- Ejecuta esta query
SELECT 
  dni, 
  COUNT(*) as count,
  STRING_AGG(id::text, ', ') as user_ids
FROM public.customer_profiles
WHERE dni IS NOT NULL
GROUP BY dni
HAVING COUNT(*) > 1
ORDER BY count DESC;
```

**Resultado esperado:**
- **Nada encontrado** ✅ → Proceder
- **Filas con count > 1** ❌ → Ver sección "Limpiar Datos Duplicados" abajo

### Paso 1.2: Buscar Duplicados de Phone

```sql
-- Ejecuta esta query
SELECT 
  phone, 
  COUNT(*) as count,
  STRING_AGG(id::text, ', ') as user_ids
FROM public.customer_profiles
WHERE phone IS NOT NULL
GROUP BY phone
HAVING COUNT(*) > 1
ORDER BY count DESC;
```

**Resultado esperado:**
- **Nada encontrado** ✅ → Proceder
- **Filas con count > 1** ❌ → Ver sección "Limpiar Datos Duplicados" abajo

### Paso 1.3: Buscar Productos con Precio/Stock Negativo

```sql
-- Ejecuta esta query
SELECT 
  id, 
  name, 
  price_usd, 
  stock,
  COUNT(*) 
FROM public.products
WHERE price_usd < 0 OR stock < 0
GROUP BY id, name, price_usd, stock;
```

**Resultado esperado:**
- **Nada encontrado** ✅ → Proceder
- **Filas encontradas** ❌ → Ver sección "Limpiar Datos Negativos" abajo

---

## 🧹 LIMPIAR DATOS DUPLICADOS (Si Fue Necesario)

### Si hay DNI duplicados:

```sql
-- ⚠️ PELIGRO: Esta query ELIMINA registros
-- 1. Primero, VERIFICA que estos son registros falsos/antiguos:
SELECT id, user_id, dni, created_at 
FROM customer_profiles
WHERE dni = 'VALOR_DUPLICADO'  -- Reemplaza con el DNI duplicado
ORDER BY created_at;

-- 2. Luego, DELETE el más viejo (o el más nuevo, según negocio):
DELETE FROM customer_profiles
WHERE id IN (
  SELECT id FROM customer_profiles
  WHERE dni = 'VALOR_DUPLICADO'  -- Reemplaza
  ORDER BY created_at DESC
  LIMIT 1  -- Elimina solo el más viejo, mantiene el más nuevo
);

-- 3. VERIFICA que solo quedó uno:
SELECT COUNT(*) FROM customer_profiles WHERE dni = 'VALOR_DUPLICADO';
```

### Si hay teléfonos duplicados:
Repite el patrón anterior, pero con `phone` en lugar de `dni`.

### Si hay productos negativos:

```sql
-- Opción 1: Fijar precios negativos a 0
UPDATE public.products SET price_usd = 0 WHERE price_usd < 0;

-- Opción 2: Fijar stock negativo a 0
UPDATE public.products SET stock = 0 WHERE stock < 0;

-- Verifica:
SELECT COUNT(*) FROM products WHERE price_usd < 0 OR stock < 0; -- Debe retornar 0
```

---

## 🔧 FASE 2: COPIAR MIGRATIONS A PROYECTO (5 min)

### Paso 2.1: Crear rama de Git

```bash
# En Terminal/PowerShell dentro del repo
git checkout -b security/critical-fixes-2025-07-10
git status  # Verifica que está en la rama correcta
```

### Paso 2.2: Copiar los 4 archivos SQL

Descargaste 4 archivos `.sql`. Cópialos aquí:

```
Manojitos-main/supabase/migrations/
├── 20260710_001_fix_checkout_price_injection.sql         ← Nuevo
├── 20260710_002_add_unique_customer_constraints.sql      ← Nuevo
├── 20260710_003_fix_products_rls_admin_only.sql          ← Nuevo
├── 20260710_004_add_products_check_constraints.sql       ← Nuevo
└── (otros archivos existentes)
```

### Paso 2.3: Verificar que se copió bien

```bash
# En Terminal
ls -la supabase/migrations/20260710* 

# Debe mostrar 4 archivos:
# -rw-r--r--  ... 20260710_001_fix_checkout_price_injection.sql
# -rw-r--r--  ... 20260710_002_add_unique_customer_constraints.sql
# -rw-r--r--  ... 20260710_003_fix_products_rls_admin_only.sql
# -rw-r--r--  ... 20260710_004_add_products_check_constraints.sql
```

---

## ✅ FASE 3: TESTING EN STAGING/LOCAL (60 min)

### Paso 3.1: Aplicar migraciones localmente

```bash
# En Terminal, dentro del repo:
supabase migration up

# Debe mostrar:
# Applying migration 20260710_001_fix_checkout_price_injection
# Applying migration 20260710_002_add_unique_customer_constraints
# Applying migration 20260710_003_fix_products_rls_admin_only
# Applying migration 20260710_004_add_products_check_constraints
# Done!
```

**Si hay error:**
- Leer mensaje de error completo
- Buscar en los comentarios del archivo .sql si hay instrucciones especiales
- Ejemplo: Posible conflicto de constraint si ya existe

### Paso 3.2: Test 1 - Validar Constraints Funcionan

**En Supabase SQL Editor:**

#### Test 1A: Intentar insertar producto con precio negativo (DEBE FALLAR)

```sql
INSERT INTO public.products 
(name, price_usd, stock, quantity_per_unit, user_id)
VALUES ('Test Negative Price', -10.00, 5, 1, auth.uid());

-- Resultado esperado: ❌ ERROR
-- "new row for relation "products" violates check constraint "check_price_non_negative""
```

#### Test 1B: Intentar insertar producto con stock negativo (DEBE FALLAR)

```sql
INSERT INTO public.products 
(name, price_usd, stock, quantity_per_unit, user_id)
VALUES ('Test Negative Stock', 10.00, -5, 1, auth.uid());

-- Resultado esperado: ❌ ERROR
-- "new row for relation "products" violates check constraint "check_stock_non_negative""
```

#### Test 1C: Insertar producto válido (DEBE FUNCIONAR)

```sql
INSERT INTO public.products 
(name, price_usd, stock, quantity_per_unit, user_id)
VALUES ('Test Valid Product', 10.00, 5, 1, auth.uid())
RETURNING id;

-- Resultado esperado: ✅ ID de nuevo producto
-- Por ejemplo: "550e8400-e29b-41d4-a716-446655440000"
```

### Paso 3.3: Test 2 - Validar RLS de Productos

#### Test 2A: Usuario normal intenta crear producto (DEBE FALLAR)

**Como usuario NO admin:**
```javascript
// En React app o Postman
const { data, error } = await supabase
  .from('products')
  .insert({ 
    name: 'Should Fail', 
    price_usd: 100, 
    stock: 10,
    user_id: auth.uid()
  });

// Resultado esperado: ❌ ERROR
// "new row violates row-level security policy"
```

#### Test 2B: Admin puede crear producto (DEBE FUNCIONAR)

**Como usuario admin (con is_super_admin=true):**
```javascript
// Mismo código anterior
// Resultado esperado: ✅ Producto creado exitosamente
```

### Paso 3.4: Test 3 - Validar UNIQUE Constraints

#### Test 3A: Intentar duplicar DNI (DEBE FALLAR)

```sql
-- Primero crea un profile con DNI
INSERT INTO public.customer_profiles 
(user_id, dni)
VALUES (auth.uid(), '12345678')
RETURNING id;

-- Intenta crear otro con el mismo DNI (sin parar la tx anterior)
INSERT INTO public.customer_profiles 
(user_id, dni)
VALUES (uuid_generate_v4(), '12345678');

-- Resultado esperado en el segundo INSERT: ❌ ERROR
-- "duplicate key value violates unique constraint "unique_dni_per_customer""
```

#### Test 3B: Intentar duplicar Phone (DEBE FALLAR)

```sql
-- Repite el patrón anterior con phone en lugar de dni
```

### Paso 3.5: Test 4 - Validar Price Injection Fix

#### Setup: Crear producto con precio conocido

```sql
INSERT INTO public.products 
(name, price_usd, stock, user_id)
VALUES ('Test Price Product', 100.00, 10, auth.uuid())
RETURNING id;

-- Guarda el ID: por ej. "aaaaa-bbbb-cccc-dddd"
```

#### Test 4A: Checkout con precio CORRECTO (DEBE FUNCIONAR)

```javascript
// En aplicación o Postman
const { data, error } = await supabase.rpc('process_checkout', {
  items: [
    {
      id: 'aaaaa-bbbb-cccc-dddd',  // Producto creado arriba
      name: 'Test Price Product',
      quantity: 1,
      price_usd: 100.00  // ✅ Precio CORRECTO
    }
  ],
  payment_method: 'credit_card',
  client_name: 'Test',
  client_phone: '1234567890'
});

// Resultado esperado: ✅ 
// { success: true, sale_ids: [...], total_usd: 100.00, ... }
```

#### Test 4B: Checkout con precio INCORRECTO (DEBE FALLAR)

```javascript
// Mismo código, pero precio falso:
const { data, error } = await supabase.rpc('process_checkout', {
  items: [
    {
      id: 'aaaaa-bbbb-cccc-dddd',
      name: 'Test Price Product',
      quantity: 1,
      price_usd: 0.01  // ❌ Precio FALSO
    }
  ],
  // ... rest igual
});

// Resultado esperado: ❌ ERROR
// "Price mismatch for product ... (Client: 0.01, DB: 100.00)"
```

---

## ✅ Si TODOS los tests pasaron ✅

Continúa a FASE 4. Si alguno falló, revisa el error y reporta.

---

## 🚀 FASE 4: DESPLIEGUE A PRODUCCIÓN (30 min)

### Paso 4.1: Hacer Backup de Producción

**En Supabase Dashboard:**
1. Ir a: Settings → Database → Backups
2. Click en "Back up now"
3. Esperar confirmación (típicamente 5-10 min)

### Paso 4.2: Commit y Push de Código

```bash
# En Terminal:
git add supabase/migrations/20260710*.sql
git commit -m "Security: Fix critical vulnerabilities in checkout, products RLS, and customer constraints"
git push origin security/critical-fixes-2025-07-10
```

### Paso 4.3: Aplicar Migraciones en Producción

**Opción A: Supabase Dashboard (Recomendado)**

1. Ir a: Supabase Dashboard → Project → Migrations
2. Ver lista de migraciones pendientes (los 4 archivos nuevos)
3. Click en "Deploy" para cada uno (o "Deploy All")
4. Esperar confirmación (~5-30 segundos por migration)

**Opción B: Línea de Comandos**

```bash
supabase db push  # Aplica migraciones a BD remota (producción)
```

### Paso 4.4: Verificar Aplicación Correcta

```sql
-- En Supabase SQL Editor (conectado a PRODUCCIÓN):

-- Verifica que constraints existen:
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name='customer_profiles' 
AND constraint_type='UNIQUE';
-- Debe mostrar: unique_dni_per_customer, unique_phone_per_customer

-- Verifica que CHECK constraints existen:
SELECT constraint_name FROM information_schema.check_constraints 
WHERE table_name='products' AND constraint_name LIKE 'check_%';
-- Debe mostrar: check_price_non_negative, check_stock_non_negative, etc.

-- Verifica que RLS policies están correctas:
SELECT policyname FROM pg_policies WHERE tablename='products';
-- Debe mostrar: "Only admins can insert products", "Only admins can update products", etc.
```

### Paso 4.5: Testing en Producción (Quick Smoke Test)

```javascript
// En aplicación de producción (como admin):

// 1. Intentar crear producto (debe funcionar)
const { data, error } = await supabase
  .from('products')
  .insert({ name: 'Smoke Test', price_usd: 10, stock: 5 });
console.log('✅ Product creation:', error ? '❌ FAILED' : '✅ PASSED');

// 2. Intentar checkout con precio correcto (debe funcionar)
const { data: result, error: checkoutError } = await supabase.rpc('process_checkout', {...});
console.log('✅ Checkout validation:', checkoutError ? '❌ FAILED' : '✅ PASSED');

// 3. Monitorear logs por errores nuevos
// En Supabase Dashboard → Logs → Edge Functions / Database
```

---

## 📊 CHECKLIST FINAL

Marca cada item cuando esté completado:

- [ ] ✅ Leí RESUMEN_EJECUTIVO_VULNERABILIDADES.md
- [ ] ✅ Leí VALIDACION_HALLAZGOS_Y_FIXES.md
- [ ] ✅ Verifiqué que no hay datos duplicados (Fase 1)
- [ ] ✅ Copié los 4 archivos SQL a supabase/migrations/ (Fase 2)
- [ ] ✅ Apliqué migraciones localmente (Fase 3.1)
- [ ] ✅ Pasé Test 1 - Constraints (Fase 3.2)
- [ ] ✅ Pasé Test 2 - RLS (Fase 3.3)
- [ ] ✅ Pasé Test 3 - UNIQUE (Fase 3.4)
- [ ] ✅ Pasé Test 4 - Price Injection (Fase 3.5)
- [ ] ✅ Hice backup de producción (Fase 4.1)
- [ ] ✅ Hice push de código (Fase 4.2)
- [ ] ✅ Apliqué migraciones en producción (Fase 4.3)
- [ ] ✅ Verifiqué aplicación correcta (Fase 4.4)
- [ ] ✅ Pasé smoke test en producción (Fase 4.5)

**Si TODO está marcado ✅:**
🎉 **¡IMPLEMENTACIÓN EXITOSA!** 🎉

---

## 🆘 TROUBLESHOOTING

### Error: "Constraint already exists"
```
Solución: La migration ya fue aplicada. 
Verificar que no se duplicaron los archivos.
```

### Error: "Foreign key violation"
```
Solución: Hay datos que violan las constraints nuevas.
Ver sección "Limpiar Datos Duplicados" arriba.
```

### Error: "RLS policy prevents operation"
```
Solución: Usuario no es admin. 
Verificar que user.app_metadata.is_super_admin = true
```

### Checkout falla después de implementar
```
Solución: Verificar que price_usd en cliente coincide con BD.
Debug: SELECT price_usd FROM products WHERE id = ?
```

---

## 📞 SOPORTE

Si tienes problemas:

1. **Revisa este documento** (Ctrl+F busca tu error)
2. **Revisa el archivo SQL** (tiene comentarios de troubleshooting)
3. **Verifica logs en Supabase Dashboard**
4. **Rollback:** `supabase migration down` (solo en staging)

---

**Tiempo estimado total:** 2 horas  
**Complejidad:** Intermedia (SQL + Supabase)  
**Riesgo:** Bajo (no se pierden datos, solo restricciones)

**¡Adelante! Esto es crítico para seguridad de producción.**
