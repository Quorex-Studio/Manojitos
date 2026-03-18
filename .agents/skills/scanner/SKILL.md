---
name: scanner
description: Explore sibling project directories for .agents/skills configurations to inherit capabilities
---

# Scanner Skill

## Purpose
Enable cross-project knowledge inheritance. By scanning sibling directories (`../`) for `.agents/skills/` or `.cursorrules` configurations, the AI can discover and import proven capabilities from other projects without starting from zero.

## When to Use
- When starting a new type of task not covered by existing skills
- When the user says "check other projects" or "see if we've done this before"
- Before creating a new skill (check if a similar one exists in another project)
- When the user references another project's functionality

## Scanning Workflow

### Step 1: Discover Sibling Projects
```
# List all sibling directories
list_dir(DirectoryPath="c:/Users/Mich/Documents/antigravity/")
```

### Step 2: Check for Agent Configurations
For each sibling project found:
```
# Check for .agents/skills/
find_by_name(Pattern="SKILL.md", SearchDirectory="../{project}/.agents/skills/", MaxDepth=2)

# Check for .cursorrules
find_by_name(Pattern=".cursorrules", SearchDirectory="../{project}/", MaxDepth=1)

# Check for .agent/workflows/
find_by_name(Pattern="*.md", SearchDirectory="../{project}/.agent/workflows/", MaxDepth=1)
```

### Step 3: Catalog Discovered Skills
```
📂 Workspace Scan Results
├── topgpt42/ (current project)
│   └── .agents/skills/: find, creator, coordinator, maintainer, scanner
├── project-x/
│   └── .agents/skills/: docker-deployer, api-tester, log-analyzer
│   └── .cursorrules: Found (235 lines)
└── project-y/
    └── .agents/skills/: none found
    └── .agent/workflows/: deploy.md, test.md
```

### Step 4: Evaluate Relevance
For each discovered skill, evaluate:
- **Compatibility**: Does it apply to this project's stack?
- **Quality**: Does it follow the SKILL.md template?
- **Freshness**: When was it last modified?
- **Dependencies**: Does it require tools/services we don't have?

### Step 5: Import or Adapt
If a skill is relevant:
```
1. Read the source SKILL.md
2. Adapt project-specific patterns to this project
3. Create a new skill using Creator
4. Register in settings.json
```

## Safety Rules

### ✅ ALLOWED
- Read SKILL.md files from sibling projects
- Read .cursorrules from sibling projects
- Read workflow .md files from sibling projects
- Copy and adapt skill templates

### ❌ NOT ALLOWED
- Read source code from other projects (privacy)
- Modify files in other projects
- Read secrets, .env files, or credentials from other projects
- Execute scripts from other projects
- Access directories outside the user's workspace

## Scan Script

### PowerShell Discovery Script
```powershell
# scripts/scan-workspace.ps1
# Scans sibling projects for agent configurations

param(
    [string]$BasePath = (Split-Path -Parent (Get-Location))
)

$projects = Get-ChildItem -Path $BasePath -Directory | Where-Object { $_.Name -ne (Split-Path -Leaf (Get-Location)) }

foreach ($project in $projects) {
    $agentDir = Join-Path $project.FullName ".agents/skills"
    $cursorRules = Join-Path $project.FullName ".cursorrules"
    $workflows = Join-Path $project.FullName ".agent/workflows"
    
    $skills = @()
    if (Test-Path $agentDir) {
        $skills = Get-ChildItem -Path $agentDir -Directory | ForEach-Object { $_.Name }
    }
    
    $hasCursorRules = Test-Path $cursorRules
    $hasWorkflows = Test-Path $workflows
    
    if ($skills.Count -gt 0 -or $hasCursorRules -or $hasWorkflows) {
        Write-Host ""
        Write-Host "📂 $($project.Name)" -ForegroundColor Cyan
        if ($skills.Count -gt 0) {
            Write-Host "   Skills: $($skills -join ', ')" -ForegroundColor Green
        }
        if ($hasCursorRules) {
            $lineCount = (Get-Content $cursorRules).Count
            Write-Host "   .cursorrules: Found ($lineCount lines)" -ForegroundColor Yellow
        }
        if ($hasWorkflows) {
            $wfFiles = Get-ChildItem -Path $workflows -Filter "*.md" | ForEach-Object { $_.BaseName }
            Write-Host "   Workflows: $($wfFiles -join ', ')" -ForegroundColor Magenta
        }
    }
}
```

## Cross-Project Skill Examples

### Skills Worth Inheriting
| Skill Name | Source Project | Applicability |
|---|---|---|
| `docker-deployer` | DevOps project | Low (we use Supabase) |
| `api-tester` | API project | High (test Edge Functions) |
| `log-analyzer` | Any project | High (debug webhooks) |
| `db-migrator` | Any Supabase project | Very High |
| `auth-auditor` | Any auth project | High (RLS policies) |

## Output Format
```
🔍 WORKSPACE SCAN COMPLETE

📂 Scanned: 5 sibling projects
🧩 Skills Found: 12 across 3 projects
✅ Compatible: 4 skills can be adapted
📝 Recommendations:
  1. Import 'api-tester' from project-x (test Edge Functions)
  2. Import 'log-analyzer' from project-y (debug webhooks)
  3. Adapt 'db-migrator' from project-z (Supabase migrations)
```
