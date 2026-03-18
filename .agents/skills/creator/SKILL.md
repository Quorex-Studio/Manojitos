---
name: creator
description: Auto-generate new SKILL.md files by detecting repetitive patterns in code, instructions, or workflows
---

# Creator Skill

## Purpose
Enable self-replication of capabilities. When the AI detects a repetitive task pattern or the user requests a new specialized behavior, Creator generates a properly-formatted SKILL.md with scripts, examples, and integration hooks.

## When to Use
- User says: "Create a skill for X" or "Make a skill that does Y"
- AI detects it has performed the same multi-step workflow 3+ times
- A new integration or tool needs to be standardized (e.g., OXAPAY API patterns)
- Domain-specific knowledge needs to be preserved for future conversations

## Skill Template

Every generated skill MUST follow this structure:

```markdown
---
name: {skill_name}
description: {one-line description}
---

# {Skill Name} Skill

## Purpose
{What this skill does and why it exists}

## When to Use
{Bullet list of trigger conditions}

## Capabilities
{Numbered list of what the skill can do, with code examples}

## Workflow
{Step-by-step execution procedure}

## Project-Specific Patterns
{Patterns specific to this project's stack}

## Output Format
{How results should be reported}
```

## Creation Workflow

### Step 1: Identify the Pattern
Analyze the user's request or detect repetition:
- What task is being repeated?
- What tools are used?
- What decisions are made?
- What project-specific knowledge is required?

### Step 2: Extract Knowledge
From the pattern, extract:
- **Trigger conditions** → When should this skill activate?
- **Input parameters** → What information does it need?
- **Execution steps** → What does it do, in order?
- **Output format** → What does it return?
- **Edge cases** → What can go wrong?

### Step 3: Generate SKILL.md
Write the SKILL.md file following the template above. Place it in:
```
.agents/skills/{skill_name}/SKILL.md
```

### Step 4: Generate Supporting Files (if needed)
For complex skills, create:
- `scripts/` — Helper scripts (PowerShell, SQL, etc.)
- `examples/` — Reference implementations
- `resources/` — Templates, schemas, configs

### Step 5: Register the Skill
Update `.agents/config/settings.json` to include the new skill in `active_skills`.

### Step 6: Announce
Report to the user:
```
✅ New Skill Created: {name}
📂 Location: .agents/skills/{name}/
📋 Capabilities: {list}
🔗 Trigger: {when it activates}
```

## Auto-Detection Rules
The Creator skill should suggest creating a new skill when:
1. The same file types are edited in the same pattern 3+ times
2. The same SQL migration pattern is applied repeatedly
3. The same debugging workflow is followed repeatedly
4. A new API integration is completed (to preserve the knowledge)
5. The user establishes a new convention or rule

## Examples of Skills to Create

| Pattern Detected | Suggested Skill |
|---|---|
| Repeated SQL migration + RPC creation | `db-migrator` |
| Repeated Edge Function deployment | `deployer` |
| Repeated admin panel column additions | `admin-extender` |
| Repeated balance calculation fixes | `balance-auditor` |
| Repeated OXAPAY webhook debugging | `payment-debugger` |

## Quality Standards
- Every skill MUST have at least 3 "When to Use" triggers
- Every skill MUST include project-specific code examples
- Every skill MUST define an output format
- Scripts MUST include error handling
- No placeholder logic — everything must be production-ready
