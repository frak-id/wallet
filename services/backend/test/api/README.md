# API route tests

Route modules are exported Elysia instances, so a test imports the module and
calls `.handle(new Request(...))` directly — no full app, no middleware stack.
Mocks come from `test/mock/` (`common.ts`, `viem.ts`).

## Two traps

**Elysia answers 422, not 400, for schema validation failures.** A 400 only
comes from an explicit `status(400, ...)` in the route, so asserting 400 on a
malformed body silently tests the wrong branch.

**`mockResolvedValue(null)` does not typecheck** against a repository whose
return type excludes `null`. Write `mockResolvedValue(null as never)` — likewise
for any fixture that is narrower than the declared return type.
