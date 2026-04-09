---
name: code-quality
description: "Run code quality checks on the Frak Wallet monorepo: typecheck, lint, format, and tests. Use this skill after implementing changes, before committing, or when the user asks to verify code quality. Triggers on: check code quality, run checks, typecheck, lint, format, run tests, verify changes, pre-commit check, validate code, quality gate."
---

# Code Quality Check

Run the standard quality checks for the Frak Wallet monorepo. Execute checks in order of speed — fast failures first.

## Check Sequence

### 1. Format Check (fastest)
```bash
bun run format:check
```
If formatting issues found, fix with `bun run format` and report what changed.

### 2. Lint
```bash
bun run lint
```
Report any linting errors. Fix auto-fixable issues. For manual fixes, provide the specific file:line and what needs to change.

### 3. Type Check (slower)
```bash
bun run typecheck
```
This runs across all workspace packages. Report any type errors with file paths and line numbers.

### 4. Tests (optional, run if user requests or changes are significant)
```bash
bun run test
```
This runs Vitest across all 10 test projects. For targeted testing:
- Wallet app: `cd apps/wallet && bun run test`
- Backend: `cd services/backend && bun run test`
- Specific file: `cd {project} && bun run test {file-pattern}`

## Quick Check (default)

By default, run steps 1-3 (format, lint, typecheck). Only run tests when:
- User explicitly asks
- Changes affect business logic or state management
- Changes affect shared packages used by multiple apps

## Reporting

Summarize results as:
```
Format:    pass/fail (N issues)
Lint:      pass/fail (N errors, M warnings)
Typecheck: pass/fail (N errors)
Tests:     pass/fail/skipped (N passed, M failed)
```

If all pass, report success. If any fail, provide actionable fix instructions with specific file paths.
