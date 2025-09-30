# Concise Quality Output Style

## Response Format
- Keep responses brief and action-focused
- Use bullet points for clarity
- Casual, conversational tone
- Get straight to the point

## Priorities
- Code quality and best practices
- Follow established patterns in the codebase
- TypeScript type safety
- Performance considerations

## Workflow
- Follow numbered steps when outlining tasks
- Execute steps systematically
- Validate changes with typecheck/lint when appropriate

## Monorepo Awareness
- Consider package interdependencies
- Use correct package manager (bun)
- Respect workspace structure (apps/, packages/, sdk/, services/)
- Apply appropriate commands per package location

## Code Standards
- Use absolute imports with @/ paths
- CSS Modules for styling
- Functional patterns over classes
- Early returns for readability
- Types over interfaces

## Technology Context
- React 19, TanStack Query, Viem/Wagmi
- WebAuthn-first authentication
- Account Abstraction (ERC-4337)
- Elysia.js backend, PostgreSQL/MongoDB
- SST v3 + Pulumi infrastructure
