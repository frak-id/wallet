/**
 * dependency-cruiser configuration for `services/backend`.
 *
 * Enforces the Flow Rules documented in `services/backend/AGENTS.md`:
 *
 *   Simple:  api → service → repository
 *   Complex: api → orchestrator → (services | repositories)
 *
 *   FORBIDDEN:
 *     - service → service (cross-domain)
 *     - service → orchestrator
 *     - repository → service
 *     - repository → orchestrator
 *     - any domain reaching into api
 *     - any infrastructure reaching into domain business logic / orchestration
 *
 * Layer hierarchy (top to bottom — imports flow DOWN, never UP):
 *
 *   src/api/            — BFF handlers (user / business / external / common)
 *   src/jobs/           — cron entry points (same layer as api)
 *   src/orchestration/  — cross-domain orchestrators
 *   src/domain/{X}/     — 12 single-domain modules (auth, identity, pairing, …)
 *   src/infrastructure/ — DB, blockchain, external clients, Elysia macros
 *   src/utils/          — pure utilities
 *
 * Severity convention:
 *   error — zero current violations; prevents future regression
 *   warn  — existing violations to clean up over time
 *   info  — surfaced but not actionable yet
 *
 * Run:  bun run arch:check
 * Graph: bun run arch:graph  (requires graphviz: `brew install graphviz`)
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
    forbidden: [
        /* ────────────────────────────────────────────────────────────────────────
         * Section A — Generic hygiene (tuned from the depcruise init template)
         * ──────────────────────────────────────────────────────────────────── */
        {
            name: "no-circular",
            severity: "warn", // Currently a symptom of the Section B layering
            // warnings (MerchantResolveService → api/schemas + the infra macro
            // → orchestration loop drag the whole graph into one giant cycle).
            // Bump to `error` once the no-domain-to-api and no-infra-to-orchestration
            // counts hit zero.
            comment:
                "Circular import — the pairing repo↔orchestrator inversion that " +
                "commit 82b332186 untangled was exactly this. Break the cycle via " +
                "constructor injection (DI) or by moving the shared type up a layer.",
            from: {},
            to: { circular: true },
        },
        {
            name: "no-orphans",
            severity: "info",
            comment:
                "Likely-unused module. The backend has many legitimate entry " +
                "points (cron jobs registered by side-effect, Elysia routes " +
                "mounted via .use()), so this is informational only.",
            from: {
                orphan: true,
                pathNot: [
                    "(^|/)[.][^/]+[.](?:js|cjs|mjs|ts|cts|mts|json)$",
                    "[.]d[.]ts$",
                    "(^|/)tsconfig[.]json$",
                    "(^|/)(?:babel|webpack|vitest|biome)[.]config[.](?:js|cjs|mjs|ts|cts|mts|json)$",
                    "^src/index[.]ts$",
                    "^src/legacyRoutes[.]ts$",
                    "^src/debug[.]ts$",
                    "^src/global[.]d[.]ts$",
                    "^src/jobs/", // jobs self-register via side-effect imports
                    "^scripts/",
                    "^build[.]ts$",
                ],
            },
            to: {},
        },
        {
            name: "not-to-unresolvable",
            severity: "error",
            comment:
                "Module cannot be resolved. If it's an npm package, add it to " +
                "package.json. Otherwise check the path / tsconfig alias. " +
                "`bun` is whitelisted as a runtime built-in (Bun's stdlib).",
            from: {},
            to: {
                couldNotResolve: true,
                pathNot: "^bun$",
            },
        },
        {
            name: "no-non-package-json",
            severity: "error",
            comment:
                "Importing an npm package not declared in package.json. It " +
                "will not be available in production. Test files + the " +
                "`test/` fixtures dir are exempt — they import vitest from " +
                "the workspace root.",
            from: {
                pathNot: [
                    "[.](?:spec|test)[.](?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$",
                    "^test/",
                ],
            },
            to: { dependencyTypes: ["npm-no-pkg", "npm-unknown"] },
        },
        {
            name: "not-to-dev-dep",
            severity: "error",
            comment:
                "Production code depends on a devDependency. Move the package " +
                "to `dependencies` or refactor the import out of `src/`.",
            from: {
                path: "^src/",
                pathNot:
                    "[.](?:spec|test)[.](?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$",
            },
            to: {
                dependencyTypes: ["npm-dev"],
                dependencyTypesNot: ["type-only"],
                pathNot: ["node_modules/@types/", "node_modules/bun-types"],
            },
        },
        {
            name: "no-duplicate-dep-types",
            severity: "warn",
            comment:
                "Package listed in multiple sections of package.json (e.g. both " +
                "dependencies and devDependencies). Pick one.",
            from: {},
            to: {
                moreThanOneDependencyType: true,
                dependencyTypesNot: ["type-only"],
            },
        },
        {
            name: "not-to-spec",
            severity: "error",
            comment:
                "Production code imports a *.test.ts / *.spec.ts file. Tests " +
                "should only be imported by other tests.",
            from: {
                pathNot:
                    "[.](?:spec|test)[.](?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$",
            },
            to: {
                path: "[.](?:spec|test)[.](?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$",
            },
        },

        /* ────────────────────────────────────────────────────────────────────────
         * Section B — Frak architectural layering rules
         *
         * Implements the AGENTS.md Flow Rules. Rules using
         * `dependencyTypesNot: ["type-only"]` only fire on RUNTIME imports;
         * `import type { ... }` lines are erased at compile and pass.
         * ──────────────────────────────────────────────────────────────────── */

        /* ── Downward inversions (highest severity — top layer reached down to) ── */

        {
            name: "no-domain-to-api",
            severity: "warn", // 1 known violation: MerchantResolveService → api/schemas
            comment:
                "A domain module imports from `src/api/`. The domain layer must " +
                "never know about the BFF layer above it. Move the shared DTO " +
                "DOWN into the domain (api re-imports), not the other way around.",
            from: {
                path: "^src/domain/",
                pathNot: "[.](?:spec|test)[.]tsx?$",
            },
            to: { path: "^src/api/" },
        },
        {
            name: "no-orchestration-to-api",
            severity: "error",
            comment:
                "An orchestrator imports from `src/api/`. Orchestrators sit BELOW " +
                "the API layer — they cannot reference handlers or api-only DTOs.",
            from: {
                path: "^src/orchestration/",
                pathNot: "[.](?:spec|test)[.]tsx?$",
            },
            to: { path: "^src/api/" },
        },
        {
            name: "no-infra-to-api",
            severity: "error",
            comment:
                "Infrastructure imports from `src/api/`. Infra is the deepest " +
                "layer; api should consume infra, not the inverse.",
            from: {
                path: "^src/infrastructure/",
                pathNot: "[.](?:spec|test)[.]tsx?$",
            },
            to: { path: "^src/api/" },
        },
        {
            name: "no-infra-to-orchestration",
            severity: "warn", // 1 known violation: infrastructure/macro/identity.ts
            comment:
                "Infrastructure imports from `src/orchestration/`. Macros that " +
                "need orchestrators (e.g. identity resolution) should live in " +
                "`src/api/middleware/` or the cross-domain logic should move to " +
                "a domain service. Known violation: src/infrastructure/macro/identity.ts.",
            from: {
                path: "^src/infrastructure/",
                pathNot: "[.](?:spec|test)[.]tsx?$",
            },
            to: { path: "^src/orchestration/" },
        },
        {
            name: "no-infra-to-domain-logic",
            severity: "error",
            comment:
                "Infrastructure imports a domain service or repository. Infra " +
                "may only import domain DB schemas (drizzle aggregation) and " +
                "domain DTOs/models (JWT payload typing) — NOT business logic.",
            from: {
                path: "^src/infrastructure/",
                pathNot: "[.](?:spec|test)[.]tsx?$",
            },
            to: {
                path: "^src/domain/[^/]+/(?:services|repositories|context|index)\\.ts$",
            },
        },
        {
            name: "no-utils-to-higher",
            severity: "error",
            comment:
                "`src/utils/` is a peer of `src/infrastructure/` (both house " +
                "low-level primitives; utils for pure helpers, infra for I/O " +
                "clients). Utils may import infrastructure for cross-cutting " +
                "primitives like log + eventEmitter (see mutexCron.ts), but " +
                "must NOT depend on domain / orchestration / api / jobs. " +
                "Type-only imports from those layers are allowed.",
            from: {
                path: "^src/utils/",
                pathNot: "[.](?:spec|test)[.]tsx?$",
            },
            to: {
                path: "^src/(?:api|jobs|orchestration|domain)/",
                dependencyTypesNot: ["type-only"],
            },
        },

        /* ── Domain isolation ── */

        {
            name: "no-cross-domain-runtime",
            severity: "warn", // ~8 known violations: campaign↔rewards, campaign-bank↔merchant
            comment:
                "Domain X runtime-imports from domain Y. Cross-domain logic " +
                "belongs in an orchestrator. Type-only imports (`import type`) " +
                "are allowed for shared shape contracts. Known violations live " +
                "in campaign↔rewards, campaign-bank↔merchant, and several " +
                "*/schemas → */schemas runtime imports.",
            from: {
                path: "^src/domain/([^/]+)/",
                pathNot: "[.](?:spec|test)[.]tsx?$",
            },
            to: {
                path: "^src/domain/",
                pathNot: "^src/domain/$1/",
                dependencyTypesNot: ["type-only"],
            },
        },
        {
            name: "no-cross-domain-context-import",
            severity: "warn", // 2 known violations: campaign/context, campaign-bank/context
            comment:
                "`domain/X/context.ts` imports `domain/Y/context.ts` or " +
                "`domain/Y/index.ts`. Cross-domain context wiring belongs in " +
                "`orchestration/context.ts`. Known violations: campaign/context " +
                "(imports RewardsContext), campaign-bank/context (imports MerchantContext).",
            from: {
                path: "^src/domain/([^/]+)/(?:context|index)\\.ts$",
            },
            to: {
                path: "^src/domain/(?!$1/)[^/]+/(?:context|index)\\.ts$",
            },
        },
        {
            name: "no-domain-to-orchestration-runtime",
            severity: "error",
            comment:
                "A domain module runtime-imports from `src/orchestration/`. " +
                "The known type-only exception (`IdentityNode` re-export, tracked " +
                "in docs/wallet-merge-followups.md) passes via " +
                "`dependencyTypesNot: type-only`. Runtime imports are blocked.",
            from: {
                path: "^src/domain/",
                pathNot: "[.](?:spec|test)[.]tsx?$",
            },
            to: {
                path: "^src/orchestration/",
                dependencyTypesNot: ["type-only"],
            },
        },

        /* ── Repository / service flow rules within a domain ── */

        {
            name: "no-repository-to-service",
            severity: "error",
            comment:
                "A repository imports from a service. Per AGENTS.md, repositories " +
                "are pure data access — they cannot call services (which would " +
                "create a service↔repository cycle).",
            from: {
                path: "^src/domain/[^/]+/repositories/",
                pathNot: "[.](?:spec|test)[.]tsx?$",
            },
            to: { path: "^src/domain/[^/]+/services/" },
        },
        {
            name: "no-repository-to-orchestrator",
            severity: "error",
            comment:
                "A repository runtime-imports an orchestrator. This was the " +
                "exact smell commit 82b332186 untangled (PairingConnectionRepository " +
                "and PairingRouterRepository were orchestrators in disguise). " +
                "Type-only imports remain allowed for IdentityNode-style carve-outs.",
            from: {
                path: "^src/domain/[^/]+/repositories/",
                pathNot: "[.](?:spec|test)[.]tsx?$",
            },
            to: {
                path: "^src/orchestration/",
                dependencyTypesNot: ["type-only"],
            },
        },
        {
            name: "no-service-to-orchestrator",
            severity: "error",
            comment:
                "A service runtime-imports an orchestrator. Services live BELOW " +
                "the orchestration layer and must not call up into it.",
            from: {
                path: "^src/domain/[^/]+/services/",
                pathNot: "[.](?:spec|test)[.]tsx?$",
            },
            to: {
                path: "^src/orchestration/",
                dependencyTypesNot: ["type-only"],
            },
        },

        /* ── API hygiene ── */

        {
            name: "no-api-direct-drizzle",
            severity: "warn", // 3 known violators: webhooks.ts, tokens.ts, management.ts
            comment:
                "API handler imports drizzle-orm helpers directly (eq, count, " +
                "etc.). Raw DB queries belong in repositories. Move the call to " +
                "{Domain}Context.repositories.X and import only the repo helper.",
            from: {
                path: "^src/api/",
                pathNot: "[.](?:spec|test)[.]tsx?$",
            },
            to: { path: "^node_modules/drizzle-orm/" },
        },
        {
            name: "no-api-direct-domain-schema",
            severity: "warn",
            comment:
                "API handler imports a domain `db/schema.ts` table directly. " +
                "This usually indicates a raw drizzle query in the handler. " +
                "Move the query into a repository and have the handler call " +
                "`{Domain}Context.repositories.X` instead.",
            from: {
                path: "^src/api/",
                pathNot: "[.](?:spec|test)[.]tsx?$",
            },
            to: { path: "^src/domain/[^/]+/db/schema\\.ts$" },
        },
    ],

    options: {
        doNotFollow: { path: "node_modules" },

        /* Distinguish `import type` from runtime imports so the
         * `dependencyTypesNot: ["type-only"]` filter works. Required for
         * the IdentityNode carve-out and the cross-domain type sharing. */
        tsPreCompilationDeps: "specify",

        moduleSystems: ["es6"],

        detectProcessBuiltinModuleCalls: true,

        /* Resolve via the repo's tsconfig path aliases:
         *   @backend-utils          → src/utils/index.ts
         *   @backend-infrastructure → src/infrastructure/index.ts
         *   @backend-domain/*       → src/domain/* */
        tsConfig: { fileName: "tsconfig.json" },

        /* Test files import vitest from the workspace root; exempt them
         * from the not-to-dev-dep / no-non-package-json rules via the
         * per-rule from.pathNot patterns above rather than enabling the
         * monorepo-wide `combinedDependencies` (which trips on workspace
         * source packages without their own dist build). */

        enhancedResolveOptions: {
            exportsFields: ["exports"],
            conditionNames: ["import", "require", "node", "default", "types"],
            extensions: [".ts", ".tsx", ".d.ts", ".js"],
            mainFields: ["module", "main", "types", "typings"],
        },

        /* Big speed-up: only analyse dependencies needed for the rule set
         * (skips orphan + reachable analyses unless those rules are active). */
        skipAnalysisNotInRules: true,

        cache: {
            folder: "node_modules/.cache/dependency-cruiser",
            strategy: "metadata",
        },

        reporterOptions: {
            dot: {
                collapsePattern: "node_modules/(?:@[^/]+/[^/]+|[^/]+)",
            },
            archi: {
                /* Collapse to one node per logical layer / domain so the
                 * architecture diagram reads:
                 *   src/api  ─→  src/orchestration  ─→  src/domain/auth, …
                 *   src/jobs ─→  src/orchestration  ─→  src/infrastructure
                 * (12 domain nodes, plus api/jobs/orchestration/infra/utils). */
                collapsePattern:
                    "^src/(?:domain/[^/]+|orchestration|api|jobs|infrastructure|utils)",
            },
            text: { highlightFocused: true },
        },
    },
};
// frak-layering config — see services/backend/AGENTS.md for the canonical rules
