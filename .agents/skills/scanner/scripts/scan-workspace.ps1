# Workspace Scanner Script
# Scans sibling projects for .agents/skills, .cursorrules, and .agent/workflows

param(
    [string]$BasePath = (Split-Path -Parent (Get-Location))
)

Write-Host "`n🔍 WORKSPACE SKILL SCANNER" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan
Write-Host "Base: $BasePath`n" -ForegroundColor DarkGray

$currentProject = Split-Path -Leaf (Get-Location)
$projects = Get-ChildItem -Path $BasePath -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne $currentProject }

$totalSkills = 0
$totalProjects = 0

foreach ($project in $projects) {
    $agentDir = Join-Path $project.FullName ".agents" "skills"
    $cursorRules = Join-Path $project.FullName ".cursorrules"
    $agentWorkflows = Join-Path $project.FullName ".agent" "workflows"
    $agentsWorkflows = Join-Path $project.FullName ".agents" "workflows"
    
    $skills = @()
    $hasConfig = $false
    
    # Check .agents/skills/
    if (Test-Path $agentDir) {
        $skills = Get-ChildItem -Path $agentDir -Directory -ErrorAction SilentlyContinue | ForEach-Object { $_.Name }
    }
    
    # Check .cursorrules
    $hasCursorRules = Test-Path $cursorRules
    
    # Check workflows
    $workflows = @()
    foreach ($wfDir in @($agentWorkflows, $agentsWorkflows)) {
        if (Test-Path $wfDir) {
            $workflows += Get-ChildItem -Path $wfDir -Filter "*.md" -ErrorAction SilentlyContinue | ForEach-Object { $_.BaseName }
        }
    }
    
    # Check .agents/config/
    $configFile = Join-Path $project.FullName ".agents" "config" "settings.json"
    $hasConfig = Test-Path $configFile
    
    # Only show projects with agent infrastructure
    if ($skills.Count -gt 0 -or $hasCursorRules -or $workflows.Count -gt 0 -or $hasConfig) {
        $totalProjects++
        Write-Host "📂 $($project.Name)" -ForegroundColor White
        
        if ($hasConfig) {
            Write-Host "   ⚙️  Config: .agents/config/settings.json" -ForegroundColor DarkGray
        }
        
        if ($skills.Count -gt 0) {
            $totalSkills += $skills.Count
            Write-Host "   🧩 Skills: $($skills -join ', ')" -ForegroundColor Green
        }
        
        if ($hasCursorRules) {
            $lineCount = (Get-Content $cursorRules -ErrorAction SilentlyContinue).Count
            Write-Host "   📜 .cursorrules: $lineCount lines" -ForegroundColor Yellow
        }
        
        if ($workflows.Count -gt 0) {
            Write-Host "   🔄 Workflows: $($workflows -join ', ')" -ForegroundColor Magenta
        }
        
        Write-Host ""
    }
}

Write-Host "=========================" -ForegroundColor Cyan
Write-Host "📊 Summary:" -ForegroundColor White
Write-Host "   Projects scanned: $($projects.Count)" -ForegroundColor DarkGray
Write-Host "   With agent infra: $totalProjects" -ForegroundColor DarkGray
Write-Host "   Total skills found: $totalSkills" -ForegroundColor Green
Write-Host ""
