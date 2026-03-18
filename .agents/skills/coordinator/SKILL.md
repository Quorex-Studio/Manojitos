---
name: coordinator
description: Decompose complex tasks into ordered steps, assign appropriate skills, and orchestrate execution
---

# Coordinator Skill

## Purpose
Prevent the AI from diving into micro-details without macro-planning. Before executing any complex task, Coordinator decomposes it into discrete steps and assigns the optimal skill for each step. This creates a clear execution plan that the user can review.

## When to Use
- Task involves 3+ files or components
- Task spans frontend + backend + database
- Task requires sequential dependencies (step B depends on step A)
- User requests a "feature" (not a simple fix)
- Debugging involves unknown root cause across multiple layers

## Decomposition Framework

### Step 1: Classify the Task
```
📋 Task Classification:
├── Type: [Feature | Fix | Refactor | Debug | Deploy | Audit]
├── Scope: [Single File | Component | Full Stack | Infrastructure]
├── Complexity: [Simple (1-2 steps) | Medium (3-5) | Complex (6+)]
└── Risk: [Low | Medium | High (touches balances/auth/payments)]
```

### Step 2: Identify Layers
For full-stack tasks, identify which layers are involved:

| Layer | Example | Skill |
|---|---|---|
| Database Schema | New columns, tables | Find → manual SQL |
| Database Functions | RPCs, triggers | Find → manual SQL |
| Edge Functions | Webhooks, APIs | Find → manual code |
| Frontend Hooks | useProfile, useTransactions | Find → manual code |
| Frontend Components | DepositModal, Admin.tsx | Find → manual code |
| Frontend Pages | Recharge, Profile, Admin | Find → manual code |
| Deployment | Supabase deploy, Vercel | manual commands |
| Testing | SQL verification, UI check | manual verification |

### Step 3: Generate Execution Plan
```
🎯 Execution Plan: {Task Name}

Phase 1: Research [Skill: Find]
  └── Step 1.1: Search for existing implementations
  └── Step 1.2: Identify dependencies and constraints

Phase 2: Database [Skill: Manual]
  └── Step 2.1: Create migration SQL
  └── Step 2.2: User executes in Supabase SQL Editor

Phase 3: Backend [Skill: Manual]
  └── Step 3.1: Update Edge Function
  └── Step 3.2: Deploy via npx supabase functions deploy

Phase 4: Frontend [Skill: Manual]
  └── Step 4.1: Update hooks/components
  └── Step 4.2: Git commit + push (auto-deploys to Vercel)

Phase 5: Verification [Skill: Maintainer]
  └── Step 5.1: Run type checks
  └── Step 5.2: Verify in browser
  └── Step 5.3: Check database state
```

### Step 4: Identify Risks & Dependencies
```
⚠️ Dependencies:
├── Step 2.2 BLOCKS Step 3.1 (backend needs DB schema)
├── Step 3.2 BLOCKS Step 5.2 (testing needs deployed function)
└── Step 4.2 BLOCKS Step 5.2 (testing needs deployed frontend)

🔴 Risk Points:
├── Balance calculations — double-check math
├── RPC parameter types — must match frontend calls
└── Column names — snake_case in DB, verify in frontend
```

## Project-Specific Coordination Patterns

### Pattern: New Feature
```
1. Find → Check existing code for similar patterns
2. Plan → Create implementation_plan.md
3. SQL → Write migration (schema + RPCs)
4. Edge Function → Update/create if needed
5. Frontend → Hooks → Components → Pages
6. Maintainer → Pre-commit check
7. Deploy → Push + deploy functions
8. Verify → Test in browser + check DB
```

### Pattern: Bug Fix
```
1. Find → Locate error source (grep logs, search code)
2. Diagnose → Identify root cause vs symptom
3. Fix → Apply minimal change
4. Maintainer → Check for similar bugs elsewhere
5. Deploy → Push fix
6. Verify → Confirm fix + no regressions
```

### Pattern: Admin Panel Enhancement
```
1. Find → Check get_admin_users_paginated RPC
2. SQL → Update RPC to return new columns
3. Frontend → Update Admin.tsx interface + UI
4. Deploy → Push frontend + user executes SQL
5. Verify → Check admin panel displays correctly
```

## Decision Rules
- **If task is Simple** → Skip coordination, execute directly
- **If task is Medium** → Brief inline plan, then execute
- **If task is Complex** → Full decomposition with implementation_plan.md
- **If task is Risky** → Full decomposition + user review before execution

## Output Format
```
🎯 COORDINATOR: {Task Name}
📊 Classification: {Type} | {Scope} | {Complexity} | {Risk}

📋 Plan:
1. [Skill: Find] — {description}
2. [Skill: Manual] — {description}
3. [Skill: Maintainer] — {description}

⚠️ Risks: {list}
⏱️ Estimated Steps: {N}
```
