# components/ — Polaris UI Components

29 files across 14 feature directories. All use Shopify Polaris v13. No custom design system.

## STRUCTURE

```
components/
├── Stepper/              # 6-step onboarding wizard (9 files, largest)
│   ├── index.tsx         # Orchestrator: Suspense/Await, step validation
│   ├── CollapsibleStep.tsx
│   └── Step1–6.tsx
├── Campaign/             # Campaign creation + status table
├── Funding/              # Bank display + Purchase creation
│   ├── Bank.tsx
│   └── Purchase.tsx
├── Appearance/           # Theme customization tabs
│   ├── ButtonTab.tsx
│   ├── CustomizationsTab.tsx
│   └── WalletButtonTab.tsx
├── Customizations/       # i18n field editors
│   ├── Field.tsx         # Language-aware input
│   ├── Section.tsx       # Modal/sharing/social sections
│   └── LanguageSelector.tsx
├── ModalPreview/         # Markdown → React preview (uses CSS modules)
├── SocialPreview/        # Social media preview (uses CSS modules)
├── WalletGated/          # Wallet connection gate + timeout error
├── Webhook/              # Webhook status + create/delete
├── Pixel/                # Web pixel create/delete
├── Instructions/         # Reusable instruction card
├── ConnectedShopInfo/    # Read-only shop info display
├── Activated/            # Success badge
└── Skeleton/             # Polaris skeleton loader
```

## CONVENTIONS

- **Entry point**: Always `index.tsx`. No barrel files.
- **Feature isolation**: Each dir = one feature. Cross-imports between features are rare.
- **CSS Modules**: Only `ModalPreview/` and `SocialPreview/`. Everything else is Polaris-only.
- **Props**: Prefer `type {ComponentName}Props` aliases.
- **Types over interfaces**: Prefer `type` aliases. Use `interface` only when declaration merging is required.

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

6-step onboarding wizard. Each step wraps in `CollapsibleStep`.

**Data flow**: Route loader → `fetchAllOnboardingData()` → `<Suspense><Await>` → `validateCompleteOnboarding()` → render steps with enable/disable.

**Auto-open**: Steps open when `!completed && currentStep === step`.

**Window polling**: Steps 1 + Campaign use `window.open()` → poll `openedWindow.closed` at 500ms → `refresh()` on close.

## ANTI-PATTERNS

- **No bare `<a>` tags** — use Polaris `Link` or React Router `Link`. Embedded app loses session.
- **No custom CSS** unless absolutely necessary — Polaris handles styling.
- **No `useEffect` for derived state** — use `useMemo`.
