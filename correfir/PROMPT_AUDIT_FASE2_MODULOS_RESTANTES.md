# 🔍 AUDITORÍA FASE 2: MÓDULOS RESTANTES
## Créditos, Deudas, Métodos de Pago, Edge Functions y Storage
### Con MCP Supabase

---

## 📋 CONTEXTO

**Status Actual:**
- ✅ Fase 1 completada: Autenticación, Checkout, Productos
- 🔴 4 vulnerabilidades críticas encontradas (con fixes listos)
- ✅ XSS sanitization: Implementada y confirmada

**Fase 2 Objetivo:**
Auditar exhaustivamente los módulos que quedaron como "⚠️ NO AUDITADO":
- Créditos y su gestión
- Deudas y cálculos de interés
- Métodos de Pago de cliente
- Edge Functions (seguridad y rate limiting)
- Storage de archivos (control de acceso)

---

## 🎯 MÓDULO 1: GESTIÓN DE CRÉDITOS
### `src/pages/Credits.tsx` + `src/hooks/useCredits.tsx`

**Objetivo:** Verificar que los créditos son atómicos y no permiten double-spending

### BÚSQUEDAS A HACER:

#### 1.1 Estructura de Datos de Créditos

**Comando MCP:**
```sql
-- Ver tabla de créditos
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name='credits' OR table_name='customer_credits'
ORDER BY table_name, ordinal_position;

-- Ver si existen triggers
SELECT tgname, tgfoid, tgdeferrable, tginitdeferred
FROM pg_trigger 
WHERE tgrelid = 'public.credits'::regclass;
```

**Auditar:**
- ¿Existen columnas: `customer_id`, `amount`, `used`, `balance`?
- ¿Tipo de dato es `DECIMAL` o `NUMERIC`? (NO float)
- ¿`balance` es calculado o almacenado?
- ¿Existen triggers que actualicen balance automáticamente?

#### 1.2 Operaciones de Crédito - Atomicidad

**Búsqueda en Código:**
```bash
grep -r "supabase.from('credits')" src/hooks/ --include="*.tsx"
grep -r "BEGIN\|COMMIT\|ROLLBACK" supabase/migrations --include="*.sql"
```

**Auditar:**
- ¿Existe RPC `add_credit()` que es atómico?
- ¿Existe RPC `use_credit()` que es atómico?
- ¿O son operaciones separadas que pueden fallar a mitad?

**Código a Revisar:** `useCredits.tsx`
- Líneas donde se ADD créditos
- Líneas donde se USE créditos
- ¿Se envuelven en transacción?

#### 1.3 Prevención de Double-Spending

**Escenario de Ataque:**
```
Usuario A tiene 100 créditos disponibles
User A abre 2 pestañas simultáneamente
Pestaña 1: Intenta usar 80 créditos
Pestaña 2: Intenta usar 80 créditos
¿Resultado?
├─ Correcto: Una falla (balance = 20 después)
└─ Vulnerable: Ambas suceden (balance = -60 después)
```

**Auditar:**
```sql
-- Ver si existe constraint de balance no negativo
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name='credits' AND constraint_type='CHECK';

-- Ver si existen locks para transacciones concurrentes
SELECT indexname FROM pg_indexes 
WHERE tablename='credits' AND indexname LIKE '%balance%' OR indexname LIKE '%customer%';
```

**En Código:**
```bash
grep -r "FOR UPDATE\|LOCK" supabase/functions --include="*.ts"
```

**Auditar:**
- ¿RPC usa `FOR UPDATE` en row de créditos?
- ¿Se valida `balance >= amount` ANTES de restar?
- ¿O permite balances negativos?

#### 1.4 Auditoría de Transacciones

**Comando MCP:**
```sql
-- Ver si existen logs de transacciones de crédito
SELECT table_name FROM information_schema.tables 
WHERE table_name LIKE '%credit%log%' OR table_name LIKE '%audit%';

-- Ver estructura si existe
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name='credit_transactions' OR table_name='credit_audit_log';
```

**Auditar:**
- ¿Existe tabla de auditoría de créditos?
- ¿Se registra: usuario, monto, tipo (add/use), timestamp, balance_before, balance_after?
- ¿O solo se registra operación sin contexto?

---

## 🎯 MÓDULO 2: GESTIÓN DE DEUDAS
### `src/pages/Debts.tsx` + `src/hooks/useDebts.tsx`

**Objetivo:** Verificar cálculos de interés y validación de abonos

### BÚSQUEDAS A HACER:

#### 2.1 Estructura de Deudas

**Comando MCP:**
```sql
-- Ver tabla de deudas
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name='debts' OR table_name='customer_debts'
ORDER BY ordinal_position;

-- Ver si hay campos de interés
SELECT * FROM information_schema.columns 
WHERE table_name LIKE '%debt%' AND column_name LIKE '%interest%' OR column_name LIKE '%rate%';
```

**Auditar:**
- ¿Columnas: `customer_id`, `principal`, `interest_rate`, `interest_accumulated`, `total_owed`, `paid`, `balance`?
- ¿`interest_rate` es `DECIMAL` y está en rango válido (0-100%)?
- ¿`interest_accumulated` se recalcula automáticamente o es manual?
- ¿`total_owed = principal + interest_accumulated`?

#### 2.2 Cálculo de Interés - Precisionista

**Búsqueda en Código:**
```bash
grep -r "interest\|interes" src/hooks/useDebts.tsx -i
grep -r "Math.round\|Math.ceil\|Math.floor" src/hooks/useDebts.tsx
```

**Auditar:**
```typescript
// Buscar patrón peligroso:
const interest = principal * rate / 100;  // ❌ PELIGROSO (float)

// Buscar patrón seguro:
const interest = (principal * rate * 100n) / 10000n;  // ✅ SEGURO (BigInt)
// O en SQL:
const interest = principal * rate / 100.00;  // ✅ SEGURO (DECIMAL)
```

**Auditar:**
- ¿Usa números flotantes para dinero? → PROBLEMA
- ¿Redondea a 2 decimales correctamente?
- ¿Redondea HACIA EL USUARIO (ceiling) o HACIA EL SISTEMA (floor)?

#### 2.3 Validación de Abonos

**Escenario:**
```
Deuda: Principal=1000, Interés=50, Adeuda=1050
Usuario paga 1050
¿Qué pasa?
├─ Correcto: balance = 0, debt marcada como paid
└─ Vulnerable: balance < 0 (overpayment) o no se marca como paid
```

**Auditar en Código:** `Debts.tsx`
- ¿Valida que `pago >= balance_minimo`?
- ¿Valida que `pago <= total_owed`?
- ¿Qué sucede con overpayment (pago > adeuda)?
  - ¿Se devuelve crédito al usuario?
  - ¿Se descuenta de siguiente deuda?
  - ¿Genera inconsistencia?

#### 2.4 Fórmula de Interés - Validar Matemática

**Búsqueda:**
```sql
-- Ver si existe función de cálculo de interés
SELECT prosrc FROM pg_proc 
WHERE proname LIKE '%interest%' OR proname LIKE '%interes%' OR proname LIKE '%calc%';

-- Si existe, ver si usa precisión decimal
SELECT * FROM pg_proc 
WHERE prosrc LIKE '%DECIMAL%' OR prosrc LIKE '%NUMERIC%';
```

**Auditar Manualmente:**

```typescript
// Fórmula peligrosa (en frontend):
const interestMonthly = (principal * monthlyRate) / 100; // ❌ Float error

// Fórmula segura (en BD como DECIMAL):
-- SELECT principal * monthly_rate / 100.00::DECIMAL(15,4) as interest
```

**Test Case:**
```
Principal: 1000.00
Tasa Mensual: 3.5%
Meses: 12

Cálculo:
Mes 1: Interés = 1000 * 0.035 = 35.00 → Balance = 1035.00
Mes 2: Interés = 1035 * 0.035 = 36.225 → Balance = 1071.225

¿Qué hace el sistema?
├─ Redondea a 1071.23 (correcto)
├─ Redondea a 1071.22 (incorrecto, favorece usuario)
├─ Mantiene 1071.225 (imprecisión)
└─ O calcula diferente (validar fórmula)
```

---

## 🎯 MÓDULO 3: MÉTODOS DE PAGO
### `src/pages/CustomerPaymentMethods.tsx` + hooks

**Objetivo:** Verificar que métodos de pago no permiten manipulación de datos bancarios

### BÚSQUEDAS A HACER:

#### 3.1 Estructura de Métodos de Pago

**Comando MCP:**
```sql
-- Ver tabla
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name='customer_payment_methods' OR table_name='payment_methods'
ORDER BY ordinal_position;

-- Ver si hay RLS
SELECT policyname, qual, with_check 
FROM pg_policies 
WHERE tablename LIKE '%payment%';
```

**Auditar:**
- ¿Campos: `customer_id`, `alias`, `bank`, `account_number`, `holder_name`, `holder_id`, `phone`?
- ¿`account_number` se encripta en tránsito y en reposo?
- ¿`holder_id` (DNI) se valida contra `customer_profiles.dni`?
- ¿`phone` se valida que es del cliente?

#### 3.2 Validación de Datos Bancarios

**Búsqueda:**
```bash
grep -r "account_number\|numero_cuenta\|holder_id" src/pages/CustomerPaymentMethods.tsx
grep -r "supabase.from('customer_payment_methods')" src/ --include="*.tsx"
```

**Auditar:**
```typescript
// Validaciones que DEBEN existir:

✅ Validar holder_id coincide con customer DNI:
   IF holder_id != customer.dni THEN ERROR

✅ Validar phone es del cliente:
   IF phone != customer.phone THEN ERROR

✅ Validar número de cuenta es válido:
   - Longitud correcta para banco
   - Formato correcto para país

✅ No permitir múltiples métodos con:
   - Mismo account_number
   - Mismo titular pero diferente cuenta
```

**Test Case:**
```
Usuario A intenta crear método de pago:
├─ holder_name: "Juan Pérez"
├─ holder_id: "12345678" (DNI válido pero de User B)
├─ account_number: "0102-1234567"
├─ phone: "+58 4121234567" (teléfono de User B)

¿Qué sucede?
├─ Correcto: ERROR - "holder_id no coincide con tu DNI"
└─ Vulnerable: Se crea (fraude = User A usa datos de User B)
```

#### 3.3 Encriptación de Datos Sensibles

**Comando MCP:**
```sql
-- Ver si existen campos encriptados
SELECT column_name, col_description 
FROM pg_description 
JOIN pg_class ON pg_class.oid = objoid 
WHERE relname = 'customer_payment_methods';

-- Ver si usa pgcrypto
SELECT extname FROM pg_extension WHERE extname = 'pgcrypto';
```

**Auditar:**
- ¿`account_number` se encripta con `pgcrypto.encrypt()`?
- ¿Solo el cliente puede ver su propio `account_number`?
- ¿Hay una columna `account_number_last_4` sin encriptar para display?

#### 3.4 RLS de Payment Methods

**Auditar:**
```sql
-- Ver políticas de RLS
SELECT policyname, qual, with_check 
FROM pg_policies 
WHERE tablename='customer_payment_methods';

-- Debe retornar algo como:
-- SELECT: (auth.uid() = customer_id)  ← Solo propietario ve sus métodos
-- INSERT: (auth.uid() = customer_id)  ← Solo propietario crea sus métodos
-- DELETE: (auth.uid() = customer_id)  ← Solo propietario borra sus métodos
```

**Test:**
```
Usuario A intenta:
├─ Ver métodos de pago de User B: ❌ DEBE FALLAR (RLS)
├─ Crear método a nombre de User B: ❌ DEBE FALLAR (RLS)
└─ Ver sus propios métodos: ✅ DEBE FUNCIONAR
```

---

## 🎯 MÓDULO 4: EDGE FUNCTIONS
### `supabase/functions/`

**Objetivo:** Verificar validación de entrada y rate limiting

### BÚSQUEDAS A HACER:

#### 4.1 Inventario de Edge Functions

**Comando:**
```bash
ls -la supabase/functions/ | grep -E "^d" | awk '{print $NF}'
```

**Debería retornar:**
```
send-email/
get-bcv-rate/
admin-actions/
send-credit-notifications/
(y otras)
```

**Para CADA function, auditar:**

#### 4.2 Validación de Entrada

**Patrón a buscar en cada `index.ts`:**

```typescript
// ❌ VULNERABLE: No valida entrada
export default async (req: Request) => {
  const data = await req.json();
  // Usa data directamente sin validación
  return await supabase.from('table').insert(data);
}

// ✅ SEGURO: Valida entrada
export default async (req: Request) => {
  const data = await req.json();
  
  // Validar tipo
  if (typeof data.name !== 'string') throw new Error('name must be string');
  
  // Validar longitud
  if (data.name.length > 255) throw new Error('name too long');
  
  // Validar patrón
  if (!/^[a-zA-Z0-9\s-]+$/.test(data.name)) throw new Error('invalid characters');
  
  return await supabase.from('table').insert({ name: data.name });
}
```

**Auditar en cada function:**
- ¿Valida que campos requeridos existen?
- ¿Valida tipo de dato?
- ¿Valida longitud?
- ¿Valida formato/patrón?

#### 4.3 Rate Limiting

**Patrón a buscar:**

```typescript
// ❌ SIN RATE LIMITING: Vulnerable a DoS
export default async (req: Request) => {
  // Sin límite de llamadas
  return await sendEmail(...);
}

// ✅ CON RATE LIMITING: Protegido
const rateLimit = new Map(); // userId -> count

export default async (req: Request) => {
  const userId = req.headers.get('x-user-id');
  const count = rateLimit.get(userId) || 0;
  
  if (count > 10) throw new Error('Rate limit exceeded'); // Max 10/min
  
  rateLimit.set(userId, count + 1);
  setTimeout(() => rateLimit.set(userId, 0), 60000); // Reset cada minuto
  
  return await sendEmail(...);
}
```

**Auditar:**
```bash
grep -r "rateLimit\|rate.limit\|throttle" supabase/functions --include="*.ts"
```

- ¿Existe rate limiting?
- ¿Está por usuario o global?
- ¿Está por minuto, hora o request?
- ¿Qué sucede cuando se excede?

#### 4.4 Autenticación en Functions

**Patrón a buscar:**

```typescript
// ❌ SIN AUTENTICACIÓN: Vulnerable a acceso público
export default async (req: Request) => {
  return await deleteAdmin(...); // Cualquiera puede ejecutar
}

// ✅ CON AUTENTICACIÓN: Protegido
export default async (req: Request) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Unauthorized');
  
  const token = authHeader.slice(7);
  const user = await supabase.auth.getUser(token);
  
  if (!user.data.user) throw new Error('Invalid token');
  if (user.data.user.app_metadata?.is_super_admin !== true) {
    throw new Error('Admin only');
  }
  
  return await deleteAdmin(...);
}
```

**Auditar:**
- ¿Valida token de autenticación?
- ¿Valida permisos (admin, customer, etc)?
- ¿Qué functions son públicas vs privadas?

#### 4.5 Logging y Monitoreo

**Auditar:**
```bash
grep -r "console.log\|console.error" supabase/functions --include="*.ts" | head -20
```

**Auditar:**
- ¿Se registran intentos fallidos?
- ¿Se registran parámetros de entrada (cuidado con PII)?
- ¿Se registra user_id de quién ejecutó?
- ¿Se registran errores?

---

## 🎯 MÓDULO 5: STORAGE DE ARCHIVOS
### Supabase Storage (documentos KYC, fotos, etc)

**Objetivo:** Verificar control de acceso y validación de archivos

### BÚSQUEDAS A HACER:

#### 5.1 Inventario de Buckets

**Comando MCP:**
```sql
-- Ver buckets en storage
SELECT id, name, public, created_at 
FROM storage.buckets 
ORDER BY name;
```

**Auditar:**
- ¿Buckets: `customers-documents`, `customer-avatars`, `product-images`, etc?
- ¿Cuáles son públicos vs privados?

#### 5.2 RLS en Storage

**Comando MCP:**
```sql
-- Ver policies en storage
SELECT name, definition 
FROM storage.objects 
WHERE bucket_id = 'bucket_name'; -- Reemplaza con nombre real

-- Ver RLS policies
SELECT policyname 
FROM pg_policies 
WHERE tablename LIKE 'objects';
```

**Auditar:**
```
KYC Documents (dni_photo, face_photo, verification_photo):
├─ Public: ❌ DEBE SER PRIVADO
├─ RLS: ✅ DEBE estar restringido al propietario
└─ Solo owner puede: read, no write, no delete

Product Images:
├─ Public: ✅ PUEDE ser público (imagenes de producto)
└─ RLS: ✅ Solo admin puede write/delete

Avatar de Cliente:
├─ Public: ✅ PUEDE ser público para display
├─ RLS: Solo propietario puede escribir
└─ Solo admin puede deletear
```

#### 5.3 Validación de Tipo de Archivo

**Búsqueda en Código:**
```bash
grep -r "file\|upload\|.pdf\|.jpg\|.png" src/pages/CustomerAuth.tsx
grep -r "supabase.storage.from" src/ --include="*.tsx"
```

**Auditar:**
```typescript
// ❌ VULNERABLE: Sin validación de tipo
const uploadFile = async (file) => {
  const { data } = await supabase.storage
    .from('documents')
    .upload(`${userId}/${file.name}`, file); // Cualquier archivo se permite
}

// ✅ SEGURO: Valida tipo y tamaño
const uploadFile = async (file) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  if (!allowedTypes.includes(file.type)) throw new Error('Invalid file type');
  
  if (file.size > 5 * 1024 * 1024) throw new Error('File too large'); // 5MB max
  
  const { data } = await supabase.storage
    .from('documents')
    .upload(`${userId}/${Date.now()}-${file.name}`, file);
}
```

**Auditar:**
- ¿Valida MIME type?
- ¿Valida tamaño máximo?
- ¿Valida extensión de archivo?
- ¿Valida que archivo no es malware (puede usar ClamAV)?

#### 5.4 Nombres de Archivo

**Auditar:**
```typescript
// ❌ VULNERABLE: Usa nombre original
.upload(`${userId}/${file.name}`, file) // Si file.name="/../../admin/secret.txt" 

// ✅ SEGURO: Genera nombre seguro
.upload(`${userId}/${Date.now()}-${crypto.randomUUID()}`, file)
```

**Auditar en código:**
- ¿Usa nombre de archivo original o generado?
- ¿Hay protección contra path traversal?

#### 5.5 Expiración de URLs

**Auditar:**
```typescript
// Ver si genera URLs con expiración
const { data: { publicUrl } } = supabase.storage
  .from('documents')
  .getPublicUrl(`${userId}/dni.pdf`); // ❌ URL pública permanente

// Debe ser con expiración:
const { data, error } = await supabase.storage
  .from('documents')
  .createSignedUrl(`${userId}/dni.pdf`, 3600); // ✅ Expira en 1 hora
```

**Auditar:**
- ¿URLs de documentos KYC tienen expiración?
- ¿Expiración es razonable (15 min - 1 hora)?

---

## 📋 REPORTE A GENERAR

Para CADA módulo, reporta:

```markdown
## MÓDULO: [Nombre]

### VULNERABILIDADES ENCONTRADAS: [Número]

#### Vulnerabilidad 1: [Nombre]
- **Severidad:** [1-10]
- **Ubicación:** [archivo.tsx o migration/table]
- **Problema:** [Descripción]
- **Impacto:** [Qué sucede si se explota]
- **Recomendación:** [Cómo arreglarlo]

### SCORE FINAL: [X/10]
```

---

## 🎯 INSTRUCCIONES FINALES

1. **Ejecuta las búsquedas MCP** en orden
2. **Revisa el código** correspondiente
3. **Test los escenarios** de ataque propuestos
4. **Reporta hallazgos** con línea exacta y severidad
5. **Si vulnerabilidad:** genera SQL fix
6. **Si OK:** reporta como "SEGURO"

---

## 📞 DECISIÓN REQUERIDA

¿Proceder con auditoría Fase 2 de estos 5 módulos?

- [ ] **SÍ** → Ejecutar auditoría completa
- [ ] **NO** → Mantener focus en Fase 1 (fixes críticos)
- [ ] **PARCIAL** → Auditar solo [cuáles módulos]

**Recomendación:** Hacer Fase 1 (fixes) en paralelo, después Fase 2 (auditoría restante)
