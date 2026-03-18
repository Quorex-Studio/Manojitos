-----

## name: supabase-db-first
description: Use this skill whenever working on a React/TypeScript frontend that connects to a Supabase backend. Ensures all code is grounded in the real DB schema and types, preventing hallucinated fields, wrong IDs, and invented logic.

# Supabase DB-First Development Skill

## OBJETIVO

Garantizar que todo codigo frontend este 100% alineado con el schema real de la base de datos. Cero campos inventados, cero tipos incorrectos, cero logica de negocio adivinada.

-----

## PASO 1 - ANTES DE ESCRIBIR CUALQUIER CODIGO

Lee estos dos archivos del proyecto:

1. `src/types/index.ts` - tipos canonicos del frontend
1. El schema de la DB (se proporciona al final de este documento)

Si no tienes acceso a esos archivos, PIDE al usuario que los pegue antes de continuar.

Nunca inventes un campo. Nunca asumas que existe una columna. Si no lo ves en el schema o en index.ts, PREGUNTA.

-----

## PASO 2 - REGLAS DE IDs (LA MAS CRITICA)

La DB tiene DOS identificadores distintos en profiles:

- `profiles.id` = UUID interno de la tabla profiles
- `profiles.user_id` = FK hacia auth.users.id (el ID de sesion)

Cuando el usuario hace login, `supabase.auth.getUser()` devuelve `auth.users.id`.
Para buscar su perfil: `WHERE user_id = auth.uid()`, NO `WHERE id = auth.uid()`.

Las siguientes tablas usan `user_id` = FK hacia `auth.users.id`:

- transactions.user_id
- investments.user_id
- capital_locks.user_id
- referrals.referrer_id / referred_id
- user_roles.user_id

Las siguientes usan IDs de profiles.id (NO auth):

- referral_commissions.referrer_id -> profiles.id
- referral_commissions.referee_id -> profiles.id
- referral_reward_claims.user_id -> profiles.id

Mezclar estos IDs es el error mas comun y el mas destructivo.

-----

## PASO 3 - ENUMS EXACTOS

Siempre usar estos valores exactos, sin variaciones:

```typescript
type TransactionStatus = 'pending' | 'completed' | 'failed' | 'processing'
type TransactionType   = 'deposit' | 'withdrawal' | 'quantification' | 'commission' | 'investment'
type InvestmentStatus  = 'active' | 'completed' | 'canceled'  // una sola L
type AppRole           = 'admin' | 'moderator' | 'user'
type DepositType       = 'quantification' | 'staking'
```

-----

## PASO 4 - BALANCES

Nunca mostrar un solo balance como “total”. Siempre sumar los 4:

```typescript
const total = profile.balance + profile.trading_balance + profile.profit_balance + profile.staking_balance
```

Cada balance tiene un proposito:

- `balance` - saldo principal retirable
- `trading_balance` - capital bloqueado en planes quantification
- `profit_balance` - ganancias, de aqui se retira
- `staking_balance` - capital bloqueado en planes staking

-----

## PASO 5 - REGLAS DE NEGOCIO (NO INVENTAR)

### Retiros:

- Solo de `profit_balance`
- Solo lunes a viernes
- Max 1 por dia por usuario
- Min 3 USDT
- Fee = 1 USDT + 6% del monto
- Total descontado = monto + fee
- Mostrar desglose antes de confirmar
- RPC: `withdraw_funds(p_amount, p_password, p_address)`

### Depositos:

- Via OxaPay
- El trigger acredita automaticamente en `balance`
- Solo el PRIMER deposito genera comisiones de referido
- Comisiones: L1=5%, L2=3%, L3=1% en `profit_balance` del referidor

### Planes de inversion:

- RPC: `create_investment(p_plan_id, p_amount)`
- Capital pasa de `balance` a `trading_balance` o `staking_balance`
- Al vencer: capital + ganancias van a `profit_balance`
- Planes disponibles en tabla `investment_plans`

### Quantification:

- Solo si `vip_level >= 1`
- Max 1 vez por dia
- Ganancia va a `profit_balance`
- RPC: `execute_quantification()`

### VIP:

- 0: sin deposito
- 1: >= 10 USDT depositados
- 2: >= 100 USDT + 3 refs activos
- 3: >= 200 USDT + 10 refs activos
- 4: >= 500 USDT + 20 refs activos

### Registro:

- Max 1 cuenta por IP
- Max 1 cuenta por dispositivo
- Validar antes: `check_registration_allowed(p_ip_address, p_device_fingerprint)`
- Pasar en signUp: `{ username, referral_code, withdraw_password, registration_ip, device_fingerprint }`

### Admin:

- Verificar: `supabase.rpc('is_admin')`
- Stats: `supabase.rpc('get_admin_dashboard_stats')`
- Retiros pendientes: `supabase.rpc('get_pending_withdrawals')`
- Aprobar: `supabase.rpc('approve_withdrawal', { p_transaction_id })`
- Rechazar: `supabase.rpc('reject_withdrawal', { p_transaction_id, p_reason })`
- Ajustar balance: `supabase.rpc('admin_adjust_balance', { p_target_user_id, p_field, p_amount, p_reason })`

-----

## PASO 6 - FLUJO OBLIGATORIO POR COMPONENTE

Para cada componente o funcion que vayas a crear:

1. Declara que tabla(s) usas
1. Declara que columnas exactas lees o escribes
1. Declara que RPC o query usas
1. Muestra el codigo
1. Espera confirmacion antes del siguiente

NO hagas cambios masivos de multiples componentes sin confirmacion.
NO combines varios cambios en un solo bloque de codigo sin explicar cada uno.

-----

## PASO 7 - VERIFICACION ANTES DE ENTREGAR

Antes de dar por terminado cualquier componente, verifica:

- [ ] Todos los campos usados existen en el schema
- [ ] Los IDs son correctos (user_id vs id)
- [ ] Los enums usan los valores exactos
- [ ] El total de activos suma los 4 balances
- [ ] Los retiros salen de profit_balance
- [ ] Las comisiones van a profit_balance del referidor
- [ ] No hay tipos creados fuera de src/types/index.ts

-----

## SCHEMA DE LA DB

### profiles

|campo             |tipo       |null|
|------------------|-----------|----|
|id                |uuid       |NO  |
|user_id           |uuid       |NO  |
|username          |text       |SI  |
|email             |text       |SI  |
|wallet_address    |text       |SI  |
|balance           |numeric    |NO  |
|trading_balance   |numeric    |NO  |
|profit_balance    |numeric    |NO  |
|staking_balance   |numeric    |SI  |
|vip_level         |int4       |NO  |
|referral_code     |text       |SI  |
|referrer_id       |uuid       |SI  |
|withdraw_password |text       |SI  |
|is_address_bound  |bool       |SI  |
|withdrawal_address|text       |SI  |
|is_admin          |bool       |SI  |
|is_banned         |bool       |SI  |
|last_quantified_at|timestamptz|SI  |
|total_deposited   |numeric    |SI  |
|total_withdrawn   |numeric    |SI  |
|referral_count    |int4       |SI  |
|registration_ip   |text       |SI  |
|device_fingerprint|text       |SI  |
|created_at        |timestamptz|NO  |
|updated_at        |timestamptz|NO  |

### transactions

|campo           |tipo              |null|
|----------------|------------------|----|
|id              |uuid              |NO  |
|user_id         |uuid              |NO  |
|type            |transaction_type  |NO  |
|amount          |numeric           |NO  |
|status          |transaction_status|NO  |
|wallet_address  |text              |SI  |
|tx_hash         |text              |SI  |
|network         |text              |SI  |
|created_at      |timestamptz       |NO  |
|updated_at      |timestamptz       |NO  |
|description     |text              |SI  |
|oxapay_track_id |text              |SI  |
|oxapay_pay_link |text              |SI  |
|oxapay_address  |text              |SI  |
|oxapay_tx_hash  |text              |SI  |
|webhook_verified|bool              |SI  |
|deposit_type    |text              |SI  |

### investments

|campo       |tipo             |null|
|------------|-----------------|----|
|id          |uuid             |NO  |
|user_id     |uuid             |NO  |
|plan_id     |int4             |SI  |
|plan_name   |text             |NO  |
|amount      |numeric          |NO  |
|daily_rate  |numeric          |NO  |
|cycle_days  |int4             |NO  |
|status      |investment_status|NO  |
|started_at  |timestamptz      |NO  |
|ends_at     |timestamptz      |SI  |
|total_earned|numeric          |NO  |
|created_at  |timestamptz      |NO  |

### investment_plans

|campo            |tipo       |null|
|-----------------|-----------|----|
|id               |int4       |NO  |
|name             |text       |NO  |
|description      |text       |SI  |
|daily_rate       |numeric    |NO  |
|cycle_days       |int4       |NO  |
|min_amount       |numeric    |NO  |
|max_amount       |numeric    |SI  |
|deposit_type     |text       |NO  |
|is_active        |bool       |NO  |
|min_refs_required|int4       |NO  |
|created_at       |timestamptz|NO  |
|updated_at       |timestamptz|NO  |

### referrals

|campo           |tipo       |null|
|----------------|-----------|----|
|id              |uuid       |NO  |
|referrer_id     |uuid       |NO  |
|referred_id     |uuid       |NO  |
|level           |int4       |NO  |
|commission_rate |numeric    |NO  |
|total_commission|numeric    |NO  |
|created_at      |timestamptz|NO  |

### referral_commissions

|campo         |tipo       |null|
|--------------|-----------|----|
|id            |uuid       |NO  |
|referrer_id   |uuid       |NO  |
|referee_id    |uuid       |NO  |
|transaction_id|uuid       |NO  |
|level         |int4       |NO  |
|amount        |numeric    |NO  |
|created_at    |timestamptz|NO  |

### referral_reward_claims

|campo     |tipo       |null|
|----------|-----------|----|
|id        |uuid       |NO  |
|user_id   |uuid       |NO  |
|tier      |int4       |NO  |
|amount    |numeric    |NO  |
|claimed_at|timestamptz|NO  |

### capital_locks

|campo       |tipo       |null|
|------------|-----------|----|
|id          |uuid       |NO  |
|user_id     |uuid       |NO  |
|amount      |numeric    |NO  |
|vip_level   |int4       |NO  |
|locked_until|timestamptz|NO  |
|created_at  |timestamptz|SI  |
|released    |bool       |SI  |

### user_roles

|campo  |tipo    |null|
|-------|--------|----|
|id     |uuid    |NO  |
|user_id|uuid    |NO  |
|role   |app_role|NO  |

### audit_logs

|campo       |tipo       |null|
|------------|-----------|----|
|id          |uuid       |NO  |
|table_name  |text       |NO  |
|record_id   |uuid       |SI  |
|user_id     |uuid       |SI  |
|action      |text       |NO  |
|changed_data|jsonb      |SI  |
|old_data    |jsonb      |SI  |
|performed_by|uuid       |SI  |
|created_at  |timestamptz|NO  |