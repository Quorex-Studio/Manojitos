---
name: maintainer
description: Code review, technical debt detection, and pre-commit quality gates
---

# Maintainer Skill

## Purpose
Act as an automated code health guardian. Before every important commit, Maintainer runs a series of checks to catch bugs, inconsistencies, and technical debt. This prevents shipping broken code and maintains codebase integrity over time.

## When to Use
- **Pre-commit** (MANDATORY): Before every git commit that modifies logic
- **Post-feature**: After completing a feature, audit the changed files
- **On-demand**: When user says "review", "audit", "check", or "clean up"
- **Debt detection**: When the codebase shows signs of accumulated shortcuts

## Pre-Commit Checklist

### 1. Type Safety Check
```powershell
# Run TypeScript compiler in check mode
npx tsc --noEmit 2>&1
```
- ✅ PASS: No type errors
- ❌ FAIL: List errors, fix before commit

### 2. Column Name Consistency
```
# Verify DB queries use correct column names
grep_search(Query=".eq('id',", SearchPath="src/", Includes=["*.tsx", "*.ts"])
```
- **Rule**: `profiles` table → always use `user_id`, never `id` alone
- **Rule**: All DB columns are `snake_case`
- **Rule**: Frontend interfaces matching DB tables MUST use `snake_case`

### 3. SQL Function Audit
```
# Check all RPCs reference correct columns
grep_search(Query="where id = ", SearchPath="supabase/", Includes=["*.sql"])
```
- **Rule**: In `profiles` table, always use `WHERE user_id = ` not `WHERE id = `
- **Exception**: When explicitly querying the profiles primary key

### 4. Import Hygiene
```
# Check for unused imports (manual scan of changed files)
view_file_outline(AbsolutePath="/path/to/changed/file.tsx")
```
- Remove unused imports
- Ensure no circular dependencies

### 5. Security Scan
```
# Check for exposed secrets or credentials
grep_search(Query="(apikey|secret|password|token)\\s*[:=]\\s*['\"]", IsRegex=true, SearchPath="src/")
```
- **Rule**: No hardcoded API keys, passwords, or tokens in source code
- **Rule**: All secrets must be in Supabase environment variables
- **Exception**: Public anon key (by design)

### 6. Balance Calculation Integrity
```
# When modifying any balance-related code, verify:
grep_search(Query="(balance|profit_balance|trading_balance|staking_balance)", SearchPath="src/", IsRegex=true)
```
- **Rule**: Withdrawals deduct from `profit_balance` first, then `balance`
- **Rule**: Never modify `trading_balance` during withdrawals
- **Rule**: `total_deposited` and `total_withdrawn` are cumulative, never decrease

### 7. RPC Parameter Matching
```
# Verify frontend RPC calls match backend function signatures
grep_search(Query=".rpc('", SearchPath="src/", MatchPerLine=true)
```
- Cross-reference each `.rpc()` call with its SQL function signature
- Verify parameter names match exactly

## Technical Debt Indicators

### 🔴 Critical Debt
- `.eq('id', ...)` on profiles table (should be `user_id`)
- Missing error handling on Supabase calls
- Hardcoded values that should be configurable
- Functions with `any` type (violates project rules)

### 🟡 Medium Debt
- SQL files in project root (should be in migrations/)
- Multiple versions of the same RPC across migrations
- Console.log statements in production code
- Components with 300+ lines (should be decomposed)

### 🟢 Low Debt (Track but don't block)
- Missing JSDoc comments on complex functions
- Inline styles instead of Tailwind classes
- Magic numbers without constants

## Refactoring Rules

### When to Refactor
1. **Same bug fixed 3+ times** → Extract to shared utility
2. **File exceeds 400 lines** → Decompose into smaller modules
3. **Same SQL pattern in 5+ migrations** → Create a consolidated migration
4. **Duplicated logic across components** → Extract to custom hook

### How to Refactor
1. Use **Find** skill to locate all instances
2. Create consolidated version
3. Update all references
4. Run type check
5. Verify no regressions

## SQL Migration Hygiene
```
# Count SQL fix files in project root
find_by_name(Pattern="FIX_*.sql", SearchDirectory="./")
find_by_name(Pattern="TEMP_*.sql", SearchDirectory="./")
```
- **Rule**: After user executes a FIX_*.sql, document in task.md
- **Recommendation**: Periodically consolidate root SQL files into proper migrations

## Output Format
```
🔍 MAINTAINER REPORT

✅ Type Safety: PASS
✅ Column Consistency: PASS  
⚠️ SQL Audit: 1 warning — is_user_active uses profiles.id
❌ Security: FAIL — hardcoded key in src/config.ts
✅ Balance Integrity: PASS
✅ RPC Matching: PASS

📊 Technical Debt Score: 7/10 (Good)
🔧 Recommended Actions:
  1. Fix is_user_active column reference
  2. Remove hardcoded key from config.ts
  3. Consolidate 8 root SQL files into migrations
```
