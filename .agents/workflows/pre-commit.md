---
description: Pre-commit quality check using Maintainer skill
---
// turbo-all

## Pre-Commit Quality Check

1. Run TypeScript type check:
```powershell
npx tsc --noEmit
```

2. Check for common column name errors:
```powershell
Select-String -Path "src/**/*.tsx","src/**/*.ts" -Pattern "\.eq\('id'," -Recurse | Select-Object Filename, LineNumber, Line
```

3. Check for hardcoded secrets:
```powershell
Select-String -Path "src/**/*.tsx","src/**/*.ts" -Pattern "(apikey|secret_key|password)\s*[:=]\s*[`"']" -Recurse | Select-Object Filename, LineNumber
```

4. If all checks pass, proceed with commit:
```powershell
git add .
git commit -m "{your message}"
git push
```
