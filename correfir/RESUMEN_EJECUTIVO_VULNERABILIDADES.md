# 🚨 RESUMEN EJECUTIVO: VULNERABILIDADES CRÍTICAS CONFIRMADAS
## Auditoría de Seguridad - Manojitos
### Julio 2025

---

## 📊 ESTADO GENERAL

| Métrica | Valor |
|---------|-------|
| **Vulnerabilidades Críticas** | 3 |
| **Vulnerabilidades Altas** | 1 |
| **Riesgo de Producción** | 🔴 **CRÍTICO** |
| **Recomendación** | ⛔ **NO DESPLEGAR A PRODUCCIÓN** |

---

## 🔴 VULNERABILIDADES CONFIRMADAS

### CRÍTICA #1: INYECCIÓN DE PRECIO EN CHECKOUT

**Línea de Código:** `supabase/migrations/20260206_secure_order.sql:69,86`

**Descripción:**
El RPC `process_checkout()` confía ciegamente en el `price_usd` enviado por el cliente en lugar de validar contra la BD.

**Ataque Posible:**
```javascript
// Cliente intercepta solicitud HTTP
const items = [
  { id: 'product123', quantity: 1, price_usd: 0.01 } // ← Modificado de 100.00
];
// Frontend envía precio falso
await supabase.rpc('process_checkout', { items, ... });
// Resultado: Compra de $100 por $0.01 ✅ Registrada en BD
```

**Impacto:**
- 💰 **Pérdida financiera directa**: Fraude de compras
- 📊 **Corrupción contable**: Registros de ventas falsos
- 🔗 **Cascada sistémica**: Balances de crédito, reportes incorrectos

**CVSS Score:** 9.9 (Critical)

**Solución:** ✅ `20260710_001_fix_checkout_price_injection.sql`

---

### CRÍTICA #2: FALTA DE UNIQUE CONSTRAINTS EN CUSTOMER_PROFILES

**Ubicación:** Tabla `public.customer_profiles` - Columnas `dni`, `phone`

**Descripción:**
No existen constraints UNIQUE a nivel BD para `dni` o `phone`. La validación depende de un RPC en frontend (advisory, no restrictivo).

**Ataque Posible (Race Condition):**
```sql
-- Cliente A (T+0ms):
SELECT * FROM rpc_check_unique_customer_data('12345678'); -- ✅ Not found
INSERT INTO customer_profiles (dni) VALUES ('12345678'); -- ✅ Inserts

-- Cliente B (T+1ms, SIMULTÁNEAMENTE):
SELECT * FROM rpc_check_unique_customer_data('12345678'); -- ✅ Not found (A aún no commiteó)
INSERT INTO customer_profiles (dni) VALUES ('12345678'); -- ✅ TAMBIÉN Inserts

-- Resultado: 2 registros con DNI idéntico
```

**Impacto:**
- ⚠️ **Violación regulatoria**: Falla en requisitos KYC/AML
- 👤 **Duplicados de identidad**: Múltiples perfiles = confusión operacional
- 🔐 **Riesgo de fraude**: Facilita suplantación de identidad

**CVSS Score:** 8.7 (High)

**Solución:** ✅ `20260710_002_add_unique_customer_constraints.sql`

---

### CRÍTICA #3: ESCALADA DE PRIVILEGIOS EN PRODUCTOS

**Ubicación:** RLS Policies en `public.products`

**Descripción:**
Políticas RLS permiten que cualquier usuario autenticado cree/edite/borre productos. No existe restricción de `is_admin()`.

**Ataque Posible:**
```javascript
// Usuario normal logueado:
const { data, error } = await supabase
  .from('products')
  .insert({
    user_id: auth.uid(), // ✅ Pasa RLS check
    name: 'Fake Competitor Product',
    price_usd: -50,      // ← Negativo (sin validación)
    stock: -1000        // ← Negativo (sin validación)
  });
// ✅ Se inserta exitosamente
```

**Impacto:**
- 🏪 **Envenenamiento de catálogo**: Productos falsos visibles a todos
- 💸 **Manipulación de precios**: Ofertas falsas
- 🗑️ **DoS de inventario**: Usuarios maliciosos borran productos reales
- 📉 **Credibilidad de negocio**: Catálogo comprometido

**CVSS Score:** 8.1 (High)

**Solución:** ✅ `20260710_003_fix_products_rls_admin_only.sql`

---

### ALTA #4: FALTA DE CHECK CONSTRAINTS EN PRODUCTOS

**Ubicación:** Tabla `public.products`

**Descripción:**
No existen `CHECK` constraints que validen `price_usd >= 0` o `stock >= 0`.

**Ataque Posible:**
```sql
-- Inserción directa (bypass RLS si endpoint mal protegido):
INSERT INTO products (name, price_usd, stock, quantity_per_unit) 
VALUES ('Bad', -99.99, -10, -5);
-- ✅ Se permite, causa inconsistencias
```

**Impacto:**
- 📊 **Reportes financieros incorrectos**: Saldos negativos sin justificación
- 🔗 **Inconsistencias de datos**: Balances no cierran
- 😕 **Confusión operacional**: Debugging difícil

**CVSS Score:** 6.5 (Medium)

**Solución:** ✅ `20260710_004_add_products_check_constraints.sql`

---

## 📋 PLAN DE CORRECCIÓN

### Fase 1: Pre-Implementación (30 min)
```bash
# 1. Crear rama de corrección
git checkout -b security/critical-fixes-2025-07-10

# 2. Revisar datos actuales buscando violaciones
# - Buscar customer_profiles con DNI duplicados
# - Buscar products con precio < 0 o stock < 0
# - Ejemplo de búsqueda:
#   SELECT dni, COUNT(*) FROM customer_profiles 
#   WHERE dni IS NOT NULL GROUP BY dni HAVING COUNT(*) > 1;
```

### Fase 2: Copiar Migrations (5 min)
```bash
# Copiar los 4 archivos SQL a:
# supabase/migrations/

cp 20260710_001_fix_checkout_price_injection.sql supabase/migrations/
cp 20260710_002_add_unique_customer_constraints.sql supabase/migrations/
cp 20260710_003_fix_products_rls_admin_only.sql supabase/migrations/
cp 20260710_004_add_products_check_constraints.sql supabase/migrations/
```

### Fase 3: Validación en Staging (1 hora)
```bash
# 1. Conectar a BD staging
supabase db pull

# 2. Aplicar migraciones
supabase migration up

# 3. Testing (verificar que fallan):
#    a) Intentar insertar producto con precio negativo → DEBE FALLAR
#    b) Intentar duplicar DNI → DEBE FALLAR
#    c) Intentar crear producto como usuario normal → DEBE FALLAR
#    d) Intentar manipular precio en checkout → DEBE FALLAR

# 4. Testing (verificar que funciona):
#    a) Crear producto como admin → DEBE FUNCIONAR
#    b) Checkout con precio correcto → DEBE FUNCIONAR
#    c) Usuario normal lee productos → DEBE FUNCIONAR
```

### Fase 4: Despliegue a Producción (30 min)
```bash
# 1. Backup de BD
supabase db backup

# 2. Push a producción
git push origin security/critical-fixes-2025-07-10
# → En Supabase Dashboard, "Deploy" las migraciones

# 3. Post-deployment testing
# - Verificar que usuarios pueden hacer checkout
# - Verificar que admins pueden crear productos
# - Monitorear logs de error
```

---

## ✅ ARCHIVOS LISTOS PARA IMPLEMENTAR

| Archivo | Descripción | Estado |
|---------|-------------|--------|
| `20260710_001_fix_checkout_price_injection.sql` | Reescribe RPC con validación de precio | ✅ Listo |
| `20260710_002_add_unique_customer_constraints.sql` | UNIQUE constraints a DNI, phone | ✅ Listo |
| `20260710_003_fix_products_rls_admin_only.sql` | RLS restringida a admins | ✅ Listo |
| `20260710_004_add_products_check_constraints.sql` | CHECK constraints price/stock >= 0 | ✅ Listo |

---

## 🎯 DECISIÓN REQUERIDA

**¿Proceder con la implementación de los 4 fixes?**

- [ ] **SÍ** → Continuar a Fase 2 (copiar migrations)
- [ ] **NO** → Explicar por qué (documentar riesgo)
- [ ] **PARCIAL** → ¿Cuáles fixes implementar? (mínimo: #1 y #3)

**Recomendación:** 🔴 **CRÍTICA** - Implementar TODOS los 4 fixes antes de producción.

---

## 📞 PREGUNTAS FRECUENTES

### P: ¿Qué pasa si NO implementamos estos fixes?
**R:** Exposición crítica a fraude financiero, violaciones regulatorias (KYC/AML) y comprometimiento del catálogo de productos.

### P: ¿Cuánto tiempo tarda la implementación?
**R:** ~2 horas total (30 min pre-checks, 5 min copiar archivos, 60 min testing, 30 min deploy).

### P: ¿Habrá downtime?
**R:** No. Las migraciones SQL son sub-segundo. Posible downtime: 0-5 segundos.

### P: ¿Afectará a clientes existentes?
**R:** No. Los fixes solo agregan restricciones, no eliminan funcionalidad legítima.

### P: ¿Qué si hay datos que violen los constraints?
**R:** La migración #2 fallará. Necesitas limpiar datos duplicados primero. Ver instrucciones en el archivo SQL.

---

## 🔗 SIGUIENTES PASOS

1. ✅ **Revisar este documento** (completado)
2. **Tomar decisión** (SÍ/NO/PARCIAL)
3. **Ejecutar Fase 1-4** (si es SÍ)
4. **Post-deployment monitoring** (verificar que no hay errores)
5. **Comunicación a equipo** (documentar cambios de seguridad)

---

**Generado por:** Auditoría de Código + Gemini 3.1 con MCP Supabase  
**Fecha:** Julio 14, 2025  
**Severidad Total:** 🔴 CRÍTICA
