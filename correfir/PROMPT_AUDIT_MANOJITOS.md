# 🔍 AUDITORÍA FUNCIONAL EXHAUSTIVA - MANOJITOS
## Modo Crítico | Verificación contra BD Real

**INSTRUCCIONES CRÍTICAS - SIGUE ESTO AL PIE DE LA LETRA:**
- ❌ NO responder "parece correcto" sin evidencia específica
- 🔴 Si algo NO está implementado, dirlo explícitamente: **"NO ENCONTRADO"** o **"FALTA IMPLEMENTACIÓN"**
- 📍 Revisar LÍNEA POR LÍNEA en secciones críticas
- ✅ Responder SOLO con hechos verificables en el código
- 🔗 **USAR MCP DE SUPABASE** para verificar la BD directamente y comparar contra lo que hace el código

---

## 📊 INFORMACIÓN DEL PROYECTO

**Stack Confirmado:**
```
Frontend:  React 18.3.1 + TypeScript 5.8.3 + Vite
Backend:   Supabase (PostgreSQL) + Edge Functions (Deno)
Auth:      Supabase Auth (user login/signup)
ORM:       @supabase/supabase-js (cliente directo)
Llamadas:  HTTP/RPC via supabase.from(), supabase.rpc()
```

**Ubicaciones Críticas:**
- Auth Hook: `src/hooks/useAuth.tsx`
- Supabase Client: `src/integrations/supabase/client.ts`
- Migrations: `supabase/migrations/` (PostgreSQL)
- Edge Functions: `supabase/functions/`

---

## 🎯 SECCIÓN 1: VALIDACIÓN DE USUARIOS - CRÍTICA

### A. Duplicados de Correo Electrónico

**LO QUE DEBE CUMPLIRSE:**
- ✅ No se puede registrar dos veces con el MISMO email
- ✅ Si email existe, mostrar error ANTES de intentar insertar
- ✅ Validar en FRONTEND + BACKEND (no solo uno)

**BÚSQUEDA A HACER:**

1. **En Frontend (`src/pages/CustomerAuth.tsx` o `Auth.tsx`):**
   - ¿Existe validación de email duplicado antes de llamar `signUp()`?
   - ¿Qué línea exacta? (ruta + línea)
   - ¿Usa `async` check contra BD o es solo regex?

2. **En Hook (`src/hooks/useAuth.tsx` línea 85-119):**
   - ¿Existe validación que evite email duplicado en `signUp()`?
   - ¿O Supabase lo rechaza y catch error?
   - ¿Qué error específico retorna? (mostrar)

3. **En BD (Migrations - VERIFICAR CON MCP SUPABASE):**
   - ¿Tabla `auth.users` tiene UNIQUE constraint en email?
   - ¿Existe trigger o check que evite duplicados?
   - **COMANDO MCP:** 
     ```sql
     SELECT constraint_name, constraint_type 
     FROM information_schema.table_constraints 
     WHERE table_name='users' AND constraint_type='UNIQUE';
     ```

**REPORTE ESPERADO:**
```
Email Duplicado:
├─ Frontend Validation: [SÍ/NO] - Línea X de archivo.tsx
├─ Backend Check: [SÍ/NO] - Línea X de useAuth.tsx
├─ BD Constraint: [SÍ/NO] - UNIQUE en email columna: ___
└─ Resultado: [PROTEGIDO/VULNERABLE]
```

---

### B. Campos de Usuario - Tipos de Dato y Validaciones

**PARA CADA CAMPO QUE EXISTA EN signup, COMPLETA ESTO:**

```
CAMPO: [nombre]
├─ Tipo de Dato en BD: [text/uuid/timestamp/numeric/etc]
├─ Nullable: [true/false]
├─ Validación Frontend: [regex/zod/custom] o [NINGUNA]
├─ Validación Backend: [trigger/function/check] o [NINGUNA]
├─ Formato Aceptado: [ejemplo: "12345-678", "+58XXXXXXXXX"]
├─ Dónde se Valida: [archivo.tsx línea X, migration Y]
└─ ¿Evita Duplicados?: [sí/no/no aplicable]
```

**CAMPOS A AUDITAR (del código y BD):**
- `email` → ¿Es unique? ¿Validación regex?
- `password` → ¿Min length? ¿Complejidad requerida?
- `full_name` → ¿Max length? ¿Permite caracteres especiales?
- `phone` → ¿Formato? ¿País específico (+58)?
- `dni` → ¿Formato? ¿Unique? ¿Validación numérica?
- `address` → ¿Max length? ¿Validación?
- `avatar_url` → ¿URL válida? ¿HTTPS obligatorio?
- `dni_photo_url`, `face_photo_url`, `verification_photo_url` → ¿Validación?
- `location_coords` → ¿Formato? ¿Valida coordenadas reales?

---

### C. Recuperación de Contraseña - Flujo Completo

**CUESTIONES CRÍTICAS:**

1. **Generación de Token:**
   - ¿Dónde está el código? (archivo + línea)
   - ¿Tipo de token? (JWT, UUID, custom)
   - ¿Duración de expiración? (ej: 1 hora, 24 horas)

2. **Almacenamiento:**
   - ¿Se guarda en tabla? ¿Cuál? ¿Columna?
   - ¿O se envía por email sin guardar?
   - ¿Se hash el token antes de guardar?

3. **Validación:**
   - ¿Se valida que token no esté expirado?
   - ¿Se usa una sola vez y se invalida?
   - ¿O se puede reutilizar?

4. **Implementación:**
   - Buscar en: `src/pages/CustomerResetPassword.tsx` o `CustomerAuth.tsx`
   - Buscar en: `supabase/functions/send-email/` (si existe)
   - Buscar en: migrations (si existe tabla reset_tokens)

**BÚSQUEDA MCP SUPABASE:**
```sql
-- Ver si existe tabla para reset tokens
SELECT table_name FROM information_schema.tables 
WHERE table_schema='public' AND table_name LIKE '%reset%' OR table_name LIKE '%token%';

-- Ver estructura si existe
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name='password_reset_tokens' OR table_name='reset_tokens';
```

---

## 📦 SECCIÓN 2: MÓDULOS - VALIDACIÓN CAMPO POR CAMPO

### MÓDULO: Autenticación (Auth)
```
ENDPOINTS:
├─ signUp (Frontend hook → Supabase)
│  ├─ Parámetros: email (string), password (string), metadata (object)
│  ├─ Validaciones Implementadas: [listar o NO ENCONTRADO]
│  ├─ Respuesta Éxito (200): [ejemplo de body]
│  └─ Respuesta Error (4xx): [qué errores específicos? email_exists? weak_password?]
│
├─ signIn (Frontend hook → Supabase)
│  ├─ Parámetros: email, password
│  ├─ Validaciones: [listar]
│  └─ Respuesta: [ejemplo]
│
└─ signOut
   ├─ Parámetros: none
   └─ Respuesta: [ok]
```

### MÓDULO: Productos (si existe)
```
ENDPOINTS:
├─ GET /products
│  ├─ Parámetros: [page, limit, filter]
│  ├─ Validaciones: [¿valida page >= 1? ¿limite máximo?]
│  └─ Campos retornados: [nombre, precio, descripción, etc.]
│
├─ GET /products/:id
│  └─ ¿Valida que ID existe antes de retornar?
│
├─ POST /products (admin)
│  ├─ Parámetros: [nombre, precio, etc.]
│  ├─ Validaciones: [¿valida precio >= 0? ¿nombre vacío?]
│  └─ ¿Quién puede crear? [solo admin, validación cómo?]
│
└─ PUT /products/:id
   ├─ Parámetros: [campos editables]
   └─ Validaciones: [¿precio negativo es rechazado?]
```

### MÓDULO: Órdenes (si existe)
```
ENDPOINTS:
├─ POST /orders
│  ├─ Parámetros: [items[], total, customer_id]
│  ├─ Validaciones: 
│  │  ├─ ¿Items array vacío es rechazado?
│  │  ├─ ¿Valida total >= 0?
│  │  ├─ ¿Verifica stock disponible?
│  │  └─ ¿Valida que customer_id es del usuario logueado?
│  └─ Respuesta: [example order object]
│
├─ GET /orders/:id
│  ├─ ¿Solo el propietario puede verla?
│  └─ ¿Cómo se valida? [RLS policy, backend check]
│
└─ PUT /orders/:id/status
   ├─ Estados permitidos: [pending, approved, shipped, delivered, cancelled]
   ├─ ¿Transiciones están validadas? (no pasar de delivered a pending)
   └─ ¿Solo admin puede cambiar estado?
```

### MÓDULO: Créditos (si existe)
```
ENDPOINTS:
├─ GET /customer/:id/credits
│  └─ Retorna: [saldo, límite, usado]
│
├─ POST /customer/:id/credit-transaction
│  ├─ Parámetros: [amount, type: 'add'|'use', reason]
│  ├─ Validaciones:
│  │  ├─ ¿Monto positivo?
│  │  ├─ ¿No permite usar más de lo disponible?
│  │  └─ ¿Registra auditoría de transacción?
│  └─ Respuesta: [nuevo saldo]
│
└─ Saldo de Crédito
   ├─ ¿Se actualiza en tiempo real?
   └─ ¿Se usa para limitar compras?
```

---

## 🔐 SECCIÓN 3: TECNOLOGÍAS - ESPECIFICAR POR CADA COMPONENTE

### BASE DE DATOS

**Conexión:**
- Motor: PostgreSQL (Supabase)
- Cliente: `@supabase/supabase-js` v2.87.1
- Configuración: `src/integrations/supabase/client.ts`

**VERIFICAR CON MCP:**
```sql
-- Listar todas las tablas
SELECT table_name FROM information_schema.tables 
WHERE table_schema='public' ORDER BY table_name;

-- Ver constraints de autenticación
SELECT * FROM information_schema.table_constraints 
WHERE table_schema='public' AND constraint_type='UNIQUE';
```

### LLAMADAS API/RPC

**Método:** Supabase JavaScript SDK
- Formato: `supabase.from('table_name').select()`, `.insert()`, `.update()`
- RPC: `supabase.rpc('function_name', { params })`
- Autenticación: Bearer token (Supabase Session)

**DÓNDE ESTÁN:**
- Hooks: `src/hooks/*.tsx` (todos los `useProducts`, `useCustomers`, etc.)
- Búsqueda específica: grep -r "supabase.from" src/

### EDGE FUNCTIONS / BACKEND

**Ubicación:** `supabase/functions/`
- Lenguaje: TypeScript/Deno
- Ejemplos:
  - `send-email/index.ts` (envía correos)
  - `get-bcv-rate/index.ts` (tasa de cambio)
  - `admin-actions/index.ts` (acciones admin)
  - `send-credit-notifications/index.ts`

**VERIFICAR:**
- ¿Validan headers auth?
- ¿Validan parámetros de entrada?
- ¿Tienen rate limiting?

### BLOCKCHAIN/RPC (si aplica)

**Buscar en el código:** grep -r "ethers\|web3\|wagmi\|viem" src/
- Si retorna nada: **NO IMPLEMENTADO**
- Si retorna algo: Auditar integraciones

---

## 📅 SECCIÓN 4: VALIDACIÓN DE FECHAS

**BUSCAR EN CÓDIGO:**

```
Todas las columnas de fecha en supabase/:
SELECT column_name, data_type FROM information_schema.columns 
WHERE data_type IN ('timestamp without time zone', 'timestamp with time zone', 'date')
ORDER BY table_name;
```

**PARA CADA CAMPO DE FECHA, AUDITAR:**

```
CAMPO: [table.column]
├─ Tipo BD: [timestamp, date, etc]
├─ Formato JS: [ISO 8601? timestamp? otra?]
├─ Validación: [¿se rechaza fecha futura? ¿pasada?]
├─ Timezone: [UTC, local, cual?]
├─ Conversión: [¿usa date-fns? moment? custom?]
└─ Ubicación: [archivo.tsx línea X]
```

**FECHAS CRÍTICAS A AUDITAR:**
- `created_at` → ¿Auto-populated por BD? ¿No se puede editar?
- `updated_at` → ¿Auto-updated por trigger?
- `expires_at` (si existe) → ¿Validación de vigencia?
- Cualquier fecha de nacimiento → ¿Valida edad mínima?
- Fecha de pedido → ¿No permite futuro?

---

## 💰 SECCIÓN 5: PRECIOS Y TRANSACCIONES

### BÚSQUEDAS EN CÓDIGO:

```bash
grep -r "price\|precio\|amount\|monto" src/hooks src/pages --include="*.tsx"
grep -r "price\|amount" supabase/migrations --include="*.sql"
```

### AUDITAR:

```
CAMPOS DE PRECIO ENCONTRADOS:
├─ Campo: [nombre]
├─ Tipo Dato: [numeric(10,2)? decimal? float?]  ⚠️ float = MALO para dinero
├─ ¿Validación >= 0?: [sí/no]
├─ ¿Validación máximo?: [límite?]
├─ Redondeo: [¿a 2 decimales?]
├─ Moneda: [especificada donde? código: VES, USD?]
├─ Conversión: [¿usa tasa de cambio? ¿cómo?]
├─ Auditoría: [¿registra quién cambió precio?]
└─ Ubicación de validación: [archivo.tsx línea X]
```

### TRANSACCIONES MONETARIAS:

```
¿Existen transacciones?
├─ ¿Tabla de transacciones?
├─ ¿Cada transacción es atómica (ACID)?
├─ ¿Se registran cambios de saldo?
├─ ¿Hay auditoría de quién hizo qué?
└─ Búsqueda: grep -r "transaction\|BEGIN\|COMMIT" supabase/
```

---

## 🔗 SECCIÓN 6: RELACIONALES E INTEGRIDAD REFERENCIAL

### VERIFICAR FOREIGN KEYS:

**MCP SUPABASE:**
```sql
SELECT constraint_name, table_name, column_name, 
       referenced_table_name, referenced_column_name
FROM information_schema.referential_constraints
WHERE constraint_schema='public';
```

**AUDITAR:**
```
FK Encontrada: [customer_id en orders tabla]
├─ ¿Ondelete: CASCADE/RESTRICT/SET NULL?
├─ ¿Valida referencia existe antes de insertar?
└─ ¿Orden de inserción correcto en migraciones?
```

---

## 📋 SECCIÓN 7: RESUMEN DE HALLAZGOS

**TABLA RESUMIDA:**

| Aspecto | Estado | Archivo/Línea | Severidad | Acción Necesaria |
|---------|--------|---------------|-----------|-----------------|
| Email único validado | ✅/❌ | useAuth.tsx:XX | CRÍTICA | Implementar si falta |
| Password requisitos | ✅/❌ | useAuth.tsx:XX | ALTA | Validar complejidad |
| DNI duplicados bloqueados | ✅/❌ | migrations/XX | CRÍTICA | Agregar constraint UNIQUE |
| Precios validados >= 0 | ✅/❌ | useProducts.tsx:XX | MEDIA | Validar input |
| Fechas no futuras | ✅/❌ | - | MEDIA | Validar en formularios |
| Créditos atómicos | ✅/❌ | migrations/XX | CRÍTICA | Usar transaction |
| RLS activo en BD | ✅/❌ | - | CRÍTICA | Verificar con SELECT * FROM pg_policies |
| Rate limiting | ✅/❌ | supabase/functions/XX | MEDIA | Implementar si falta |

---

## 📝 INSTRUCCIONES FINALES

1. **NO ASUMIR nada.** Si no ves el código, marca como "NO ENCONTRADO"
2. **CITA LÍNEAS ESPECÍFICAS** donde valides cada cosa
3. **USA MCP DE SUPABASE** para verificar:
   - Estructura de tablas
   - Constraints y triggers
   - RLS policies
   - Datos reales (si necesitas confirmar validaciones)
4. **SI GEMINI DICE "PARECE BIEN", PREGUNTA:** 
   - "¿En qué línea específica ves esa validación?"
   - "¿Qué comando MCP SQL usaste para verificar?"
5. **CATEGORIZA SEVERIDAD:**
   - 🔴 CRÍTICA (seguridad, datos)
   - 🟠 ALTA (funcionalidad)
   - 🟡 MEDIA (UX/performance)

---

## 🎯 FLUJO DE AUDITORÍA RECOMENDADO

```
1. Pasa TODO el código del proyecto (src/ + supabase/)
2. Ejecuta las queries MCP Supabase para estructura
3. Rellena cada sección metodicamente
4. Compara código frontend vs backend vs BD
5. Identifica gaps y vulnerabilidades
6. Propón fixes específicas (líneas concretas)
```

---

**¿Listo? Adjunta el código y ejecuta esta auditoría como si fueras un crítico de seguridad.**
