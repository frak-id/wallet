# components/ — Polaris Web Components UI

Feature-organized UI on Polaris web components (`<s-*>`, Polaris 2; see the parent AGENTS.md for how the runtime loads). No React Polaris, no custom design system. `Stepper/` is the
largest feature (the onboarding wizard); `ui/` holds the shared primitives.

## CONVENTIONS

- **Entry point**: Always `index.tsx`. No barrel files.
- **Feature isolation**: Each dir = one feature. Cross-imports between features are rare.
- **Custom CSS** (rare — Polaris handles most styling): vanilla-extract `*.css.ts` only, mostly the `ui/` skeletons and layout helpers.
  There are no CSS Modules in this app; do not add `.module.css`.
- **Props**: Prefer `type {ComponentName}Props` aliases.

## UI PATTERNS

### Loading

- Placeholders are local: `ui/Skeleton{Page,BodyText,DisplayText}` and `Skeleton/` (Polaris has no skeleton element).
- `loading={fetcher.state !== "idle"}` on `<s-button>`.

### Errors

- `shopify.toast.show(message, { isError: true })` for transient errors.
- `<s-banner tone="warning">` (or `info`) for persistent state; `<s-badge tone="critical">` for a failed status inline.

### Forms

- `useFetcher<typeof action>()` for all mutations (no `<Form/>`).
- `useState` per field, `useMemo` for derived/computed values.

### Data Access

- `useRouteLoaderData<typeof loader>("routes/app")` for parent route data.
- `useTranslation()` for i18n strings.
- `useWalletStatus()` from the Frak React SDK (`Funding/Bank.tsx`).

## STEPPER ARCHITECTURE

One `StepN` component per key in `utils/onboarding.ts`'s `stepValidations`. Each wraps in `CollapsibleStep`.

**Data flow**: Route loader → `fetchAllOnboardingData()` → `<Suspense><Await>` → `validateCompleteOnboarding()` → render steps with enable/disable.

**Auto-open**: Steps open when `!completed && currentStep === step`.

**Step 1 registers inline**: one POST to `/api/register` from the embedded app, no wallet popup.

## ANTI-PATTERNS

- **No bare `<a>` tags** — use `<s-link>`, React Router `Link`, or `ui/ExternalLink` for a new tab. Embedded app loses session.
- **No custom CSS** unless absolutely necessary — Polaris handles styling.
- **No `useEffect` for derived state** — use `useMemo`.
