---
name: find
description: Advanced file and code search across the project using glob, regex, and semantic patterns
---

# Find Skill

## Purpose
Provide powerful, context-aware search capabilities to navigate large codebases efficiently. This is the foundational skill — without precise search, all other skills operate blind.

## When to Use
- Before modifying any file: verify its current state and location
- When debugging: trace data flow across files
- When the user references a component, hook, or function by name
- Before creating new files: check for existing implementations to avoid duplication

## Capabilities

### 1. File Discovery
```
# Find files by name pattern
find_by_name(Pattern="*.tsx", SearchDirectory="src/")

# Find by extension
find_by_name(Extensions=["ts", "tsx"], SearchDirectory="src/")

# Find specific component
find_by_name(Pattern="*Modal*", Extensions=["tsx"])
```

### 2. Code Search (Exact)
```
# Find exact string matches
grep_search(Query="from('profiles')", SearchPath="src/", Includes=["*.tsx"])

# Find function definitions
grep_search(Query="export function", SearchPath="src/hooks/")

# Find RPC calls
grep_search(Query=".rpc('", SearchPath="src/", MatchPerLine=true)
```

### 3. Code Search (Regex)
```
# Find all Supabase queries with wrong column
grep_search(Query=".eq\\('id',", IsRegex=true, SearchPath="src/")

# Find unused imports
grep_search(Query="^import.*from.*(?!.*used)", IsRegex=true)
```

### 4. Structural Analysis
```
# View file outline (functions, classes)
view_file_outline(AbsolutePath="/path/to/file.tsx")

# View specific code items
view_code_item(File="/path/to/file.tsx", NodePaths=["ComponentName"])
```

## Search Strategy
1. **Start broad** → `find_by_name` to locate relevant files
2. **Narrow down** → `grep_search` with specific queries
3. **Deep dive** → `view_file_outline` then `view_code_item` for structure
4. **Cross-reference** → Search for usages across the codebase

## Project-Specific Patterns
- **Supabase RPCs**: `grep_search(Query=".rpc('", Includes=["*.tsx", "*.ts"])`
- **DB Queries**: `grep_search(Query="from('", Includes=["*.tsx", "*.ts"])`
- **SQL Functions**: `grep_search(Query="CREATE.*FUNCTION", Includes=["*.sql"])`
- **React Hooks**: `find_by_name(Pattern="use*", SearchDirectory="src/hooks/")`
- **Components**: `find_by_name(Pattern="*", SearchDirectory="src/components/")`
- **Edge Functions**: `find_by_name(Pattern="index.ts", SearchDirectory="supabase/functions/")`

## Output Format
Always report findings as:
```
📁 Found N results
├── file1.tsx:L42 — description
├── file2.tsx:L15 — description
└── file3.sql:L8  — description
```
