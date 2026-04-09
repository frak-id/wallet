---
name: frak-orchestrator
description: "Orchestrate development tasks across the Frak Wallet monorepo. Routes feature implementation, bug fixes, refactoring, SDK work, backend changes, and infrastructure tasks to the right specialist agent(s). Use this skill whenever a development task spans multiple areas of the codebase, requires expert analysis, or needs coordinated multi-agent work. Also triggers on: implement feature, fix bug, add endpoint, refactor, optimize performance, deploy, update SDK, code review, architecture review, re-run, update previous result, improve, redo, partial re-run."
---

# Frak Dev Orchestrator

Routes development tasks to the right specialist agent(s) in the Frak Wallet monorepo.

## Execution Mode: Sub-agent (Expert Pool)

## Agent Roster

| Agent | Domain | When to Route |
|-------|--------|---------------|
| react-performance-expert | Frontend apps (wallet, business, listener) | React components, hooks, state management, CSS Modules, performance, iframe/postMessage |
| sdk-architect | SDK packages (sdk/core, react, components, legacy) | SDK features, API design, framework abstractions, package exports |
| backend-architect | Backend (services/backend/) | API endpoints, Drizzle schemas, domain services, database queries |
| shopify-developer | Shopify app (apps/shopify/) | Routes, extensions (post-purchase, web pixel, theme), Shopify GraphQL API, metafields, App Bridge |
| magento-developer | Magento plugin (plugins/magento/) | PHP Blocks, Observers, Models, XML config, .phtml templates, webhook HMAC signing |
| infra-engineer | Infrastructure (infra/) | SST v3, Pulumi, deployments, environment config |
| codebase-analyzer | Cross-cutting analysis | Architecture review, pattern analysis, onboarding docs |
| feature-plan-analyzer | Plan tracking | Compare implementation against spec, identify remaining work |

## Workflow

### Phase 0: Context Check

1. Check if `_workspace/` exists in the project root
2. Determine execution mode:
   - **No `_workspace/`** → Initial run, proceed to Phase 1
   - **`_workspace/` exists + user requests modification** → Partial re-run, route only to affected agent(s)
   - **`_workspace/` exists + new input** → New run, move `_workspace/` to `_workspace_{timestamp}/`

### Phase 1: Task Analysis

Analyze the user's request to determine:

1. **Scope** — which parts of the codebase are affected?
   - `apps/wallet/`, `apps/business/`, `apps/listener/` → frontend
   - `apps/shopify/` → Shopify app
   - `plugins/magento/` → Magento plugin
   - `packages/wallet-shared/` → shared wallet/listener code
   - `packages/ui/` → UI components
   - `sdk/` → SDK packages
   - `services/backend/` → backend
   - `infra/` → infrastructure
   - Multiple areas → cross-cutting

2. **Task type** — what kind of work?
   - Feature implementation
   - Bug investigation & fix
   - Performance optimization
   - Refactoring
   - Code review / architecture analysis
   - SDK development
   - Database schema change
   - Infrastructure / deployment

3. **Complexity** — how many agents needed?
   - Single domain → 1 agent
   - Cross-cutting (e.g., new API + frontend hook) → 2+ agents in parallel

### Phase 2: Agent Routing

Based on the analysis, invoke the right agent(s):

**Single-domain task:**
```
Agent(
    description: "{task summary}",
    subagent_type: "{agent-name}",
    model: "opus",
    prompt: "{detailed task with context}"
)
```

**Cross-cutting task (parallel execution):**
Launch multiple agents in a single message with `run_in_background: true`:

```
Agent(agent-1, run_in_background: true)
Agent(agent-2, run_in_background: true)
```

Wait for all agents to complete, then integrate results.

**Common routing patterns:**

| Request Pattern | Agent(s) | Parallel? |
|----------------|----------|-----------|
| "Add feature X to wallet" | react-performance-expert | No |
| "Add API endpoint for Y" | backend-architect | No |
| "Add feature with new API + frontend" | backend-architect + react-performance-expert | Yes |
| "Update SDK to support Z" | sdk-architect | No |
| "Add Shopify extension / route / metafield" | shopify-developer | No |
| "Shopify feature with new backend webhook" | shopify-developer + backend-architect | Yes |
| "Update Magento module / observer / block" | magento-developer | No |
| "Magento webhook change" | magento-developer + backend-architect | Yes |
| "Review architecture of module X" | codebase-analyzer | No |
| "Check progress on plan X" | feature-plan-analyzer | No |
| "Deploy to production" | infra-engineer | No |
| "Optimize performance of page X" | react-performance-expert | No |
| "New feature end-to-end" | backend-architect + react-performance-expert + sdk-architect | Yes |

### Phase 3: Integration (cross-cutting only)

When multiple agents ran in parallel:
1. Collect all agent outputs
2. Check for conflicts (e.g., type mismatches between API response and frontend hook)
3. Verify cross-boundary consistency (Eden Treaty types, shared types in packages/)
4. Report integrated result to user

### Phase 4: Quality Gate

After implementation, suggest running the code-quality skill:
- `bun run typecheck` — type safety across the monorepo
- `bun run format:check` — Biome formatting
- `bun run lint` — linting rules

## Agent Invocation Rules

1. **Always use `model: "opus"`** for all agent calls
2. **Provide full context** in the agent prompt — the agent has no conversation history
3. **Include file paths** when known — saves the agent exploration time
4. **Specify output expectations** — what files to create/modify, what format
5. **For cross-cutting tasks** — tell each agent what the other agent is handling to avoid duplication

## Error Handling

| Situation | Strategy |
|-----------|----------|
| Agent fails | Retry once with more context. If still fails, report to user |
| Cross-boundary type mismatch | Flag to user, suggest which side to adjust |
| Unclear routing | Ask user to clarify which area of the codebase is involved |
| Task too large | Break into subtasks, route each separately |

## Test Scenarios

### Normal Flow
1. User asks "Add a new referral tracking endpoint and display it in the wallet"
2. Phase 1 identifies: backend (new endpoint) + frontend (new UI)
3. Phase 2 launches backend-architect + react-performance-expert in parallel
4. Phase 3 integrates results, checks Eden Treaty type consistency
5. Phase 4 suggests running code-quality checks

### Error Flow
1. User asks "Fix the login bug"
2. Phase 1 identifies: unclear scope (could be frontend, backend, or WebAuthn)
3. Orchestrator uses codebase-analyzer to investigate first
4. Based on findings, routes to the appropriate specialist
5. If fix spans multiple domains, launches parallel agents
