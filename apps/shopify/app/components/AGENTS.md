# components/ — Polaris UI Components

Feature-organized Polaris v13 UI. No custom design system. `Stepper/` is the
largest feature (the onboarding wizard); `ui/` holds the shared primitives.

## CONVENTIONS

- **Entry point**: Always `index.tsx`. No barrel files.
- **Feature isolation**: Each dir = one feature. Cross-imports between features are rare.
- **Custom CSS** (rare — Polaris handles most styling): vanilla-extract `*.css.ts` only.
  There are no CSS Modules in this app; do not add `.module.css`.
- **Props**: Prefer `type {ComponentName}Props` aliases.

## UI PATTERNS

### Loading

- `<SkeletonDisplayText size="small" />` for text placeholders.
- `<Spinner size="small" />` with `<Text>` for inline loading.
- `loading={fetcher.state !== "idle"}` on buttons.

### Errors

- `shopify.toast.show(message, { isError: true })` for transient errors.
- `<Banner tone="critical">` for persistent errors.
- Timeout pattern: `useState(false)` + 10s `setTimeout` → show error banner.

### Forms

- `useFetcher<typeof action>()` for all mutations (no `<Form/>`).
- `useState` per field, `useMemo` for derived/computed values.
- `isDisabled` via `useMemo` combining multiple field validations.

### Data Access

- `useRouteLoaderData<typeof loader>("routes/app")` for parent route data.
- `useTranslation()` for i18n strings.
- `useWalletStatus()` / `useDisplayModal()` from Frak SDK.

## STEPPER ARCHITECTURE

One `StepN` component per key in `utils/onboarding.ts`'s `stepValidations`. Each wraps in `CollapsibleStep`.

**Data flow**: Route loader → `fetchAllOnboardingData()` → `<Suspense><Await>` → `validateCompleteOnboarding()` → render steps with enable/disable.

**Auto-open**: Steps open when `!completed && currentStep === step`.

**Window polling**: Steps 1 + Campaign use `window.open()` → poll `openedWindow.closed` at 500ms → `refresh()` on close.

## ANTI-PATTERNS

- **No bare `<a>` tags** — use Polaris `Link` or React Router `Link`. Embedded app loses session.
- **No custom CSS** unless absolutely necessary — Polaris handles styling.
- **No `useEffect` for derived state** — use `useMemo`.
