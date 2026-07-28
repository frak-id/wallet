# DB migration request — identity proof-of-possession (Phase 1)

Per `services/backend/AGENTS.md`: migrations are never authored by application code — this
file specifies the exact DDL for the db team to apply. Nothing under
`services/bootstrap/drizzle/` has been touched.

Both columns are declared in `services/backend/src/domain/identity/db/schema.ts` already
(the domain's Drizzle source of truth); `db:generate` should derive the same DDL from that
file. This document exists so the db team has the intent and the exact SQL up front,
without needing to reverse-engineer it from the schema diff.

**Requested at the start of Phase 1**, not Phase 4a, because both columns are inert until
written, and Phase 4a enforcement (the `proofSeenAt` latch) is otherwise blocked on
db-team lead time.

---

## 1. `identity_nodes.proof_seen_at`

```sql
ALTER TABLE identity_nodes ADD COLUMN proof_seen_at timestamp;
```

- **Nullable, no default, no index.** `NULL` means "not latched" — a legacy id, or a
  derived id that has simply never presented a proof yet. Both read identically as
  "proof not required," which is the pre-existing (fail-open) behaviour. No backfill
  needed; every existing row is correctly `NULL`.
- **Blocks:** Phase 4a enforcement (the §4.6 one-way latch). Until this column exists,
  enforcement code must not be deployed — it would either no-op (harmless) or fail at
  runtime depending on how it's written; the intent is to land the column well ahead of
  the enforcement code, not to race them.
- **Rationale:** a timestamp rather than a boolean, at the same storage cost, so the
  §2.6 conflicting-migration alarm (two different derived ids racing to claim the same
  legacy id) is investigable — "when did this first latch" rather than a bare yes/no.
  Matches the table's existing idiom: `unlinked_at` and `verified_at` are both nullable
  timestamps for the same reason.
- **Backwards compatible.** Purely additive; no existing query references this column;
  no application code reads it until the Phase 4a enforcement commit lands.

## 2. `install_codes.attempts`

```sql
ALTER TABLE install_codes ADD COLUMN attempts integer NOT NULL DEFAULT 0;
```

- **Not null, default 0.** Every existing row starts at 0 — correct, since no row has
  been resolved-against under the new counting logic yet.
- **Blocks:** `POST /install-code/resolve` will fail (the UPDATE targets a column that
  doesn't exist) the moment the corresponding backend code deploys. **This DDL must be
  applied before that deploy goes out**, not after.
- **Rationale:** durable, per-code resolve-attempt counter (README §3.3), mirroring the
  precedent already in this file — `email_verification_codes.attempts`, with the
  identical `"attempts caps brute-force"` intent. Caps repeated hammering of one
  already-minted code (e.g. discovered via a screenshot or log leak) independently of
  source IP, and correctly across pod replicas — unlike `rateLimitMiddleware`'s
  in-memory-per-pod store, which is N× too permissive behind N replicas.
- **Scope limitation, stated plainly:** this does **not** cap enumeration of the
  ~887M-code keyspace (31⁶, `CODE_ALPHABET` in `src/utils/sixDigitCode.ts`). Most wrong
  guesses match zero rows, so there is no row to increment — the counter only bounds
  repeat attempts against a code that actually exists. Enumeration is still bounded only
  by: the existing IP rate limit (10/min on `/resolve`), the 72h code TTL, and the
  keyspace-vs-realistic-attacker-volume math. The real fix for the harvesting oracle
  itself is §3.2/§5's ticket redesign (out of scope for phases 0–4a) — see
  `DECISIONS.md` §1.3.
- **Backwards compatible.** Additive column with a default; `InstallCodeRepository.create`
  is updated to read the new column back from its `RETURNING *`, so no other call site
  needs to change.

---

## Summary for the db team

| Column | Table | Type | Nullable | Default | Blocks |
|---|---|---|---|---|---|
| `proof_seen_at` | `identity_nodes` | `timestamp` | yes | none | Phase 4a enforcement |
| `attempts` | `install_codes` | `integer` | no | `0` | `install-code/resolve` deploy |

Both are additive, backwards-compatible, and require no backfill. Please confirm once
applied so the corresponding backend deploys (already merged in code, gated behind these
columns existing) can go out.
