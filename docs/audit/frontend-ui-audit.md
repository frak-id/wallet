# Frontend UI/UX Audit — Frak Wallet

**Scope:** `apps/wallet` (31k), `apps/business` (36k), `apps/listener` (5k), `apps/shopify` (7k), `packages/design-system` (18k), `packages/wallet-shared`, `sdk/components`
**Dimensions:** Accessibility · Performance & Loading · Responsive & Layout · Design System & Aesthetics
**Method:** read-only static analysis. Contrast ratios computed from `tokens.css.ts`. Every finding cites a `path:line` that was read. No files modified.

---

## Verdict

The **build engineering is excellent and the design system is well-architected** — vanilla-extract with a real `createThemeContract`, per-component subpath exports (no barrel leak), `autoCodeSplitting` in both TanStack apps, and a hard 32 KB gzip budget on the listener. Route splitting and chart quarantine came back **verifiably clean**.

The defects concentrate in three places:

1. **Keyboard accessibility** — the dominant failure mode. Several primitives remove focus rings with no substitute, and two primary flows are entirely keyboard-unreachable.
2. **Dark theme** — `semanticDark` contains copy-pasted light-ramp values that fail WCAG outright.
3. **Boundary discipline** — z-index literals, off-grid breakpoints, and hardcoded colors accumulate where the DS conventions stop being enforced (`apps/shopify` imports zero DS tokens).

The repo consistently **contains the correct pattern already** — `Balance/index.css.ts` has the right focus ring, `ExplorerDetail` has the right image priority hints, `Navigation` has the right breakpoint mirror. Most fixes are propagating an in-house convention, not inventing one.

---

# P0 — Blocking

### 1. `GlassButton` erases keyboard focus across the entire wallet

**Location:** `packages/design-system/src/components/GlassButton/index.css.ts:18-22`

`outline: none` at base **and** on `:focus` **and** on `:focus-visible`, with no replacement. This is the wallet's universal close/share/sort/back affordance — a keyboard user has zero indication of where focus is across `GlassCloseButton`, `Back/index.tsx:48,70`, `ExplorerDetail/index.tsx:247`, `ExplorerSortButton/index.tsx:37`, `WelcomeDetail.tsx:58`, `MoneriumScreen.tsx:57`. WCAG 2.4.7 failure.

```ts
export const glassCircle = style({
    /* …unchanged… */
    outline: "none",
    selectors: {
        "&:focus": { outline: "none" },
        "&:focus-visible": {
            outline: `2px solid ${vars.border.focus}`,
            outlineOffset: "2px",
        },
    },
});
```

### 2. Campaign wizard territory field is keyboard-unreachable

**Location:** `apps/business/src/module/campaigns/component/Creation/TerritoryCampaign/CountrySelect.tsx:114-118`

`PopoverTrigger asChild` merges `onClick`/`aria-expanded` onto a plain `<div>` — no `tabIndex`, no `role`, no key handler. This is a **required** field in the campaign creation wizard, so the flow cannot be completed by keyboard at all.

```tsx
<PopoverTrigger asChild>
    <button
        type="button"
        aria-label={t("campaigns.create.territory.card.placeholder")}
        className={`${styles.trigger}${error ? ` ${styles.triggerError}` : ""}`}
    >
```

The nested chip-remove (`:144`) and clear-all (`:169`) buttons must move **outside** the trigger — nested `<button>` is invalid HTML.

### 3. Embedded wallet CTAs have an empty accessible name

**Location:** `apps/listener/app/module/embedded/component/ButtonWallet/index.tsx:25-33`

`children` (the visible label) renders as a **sibling outside** the `<button>`; the button's only content is `icon`. The embedded wallet's primary Copy (`WalletLoggedIn/index.tsx:143`) and Share (`:199`) actions announce as an unnamed button.

```tsx
<button className={clsx(styles.button({ variant }), className)} ref={ref} type="button" {...props}>
    {isLoading ? <Spinner /> : icon}
    <span className={styles.visuallyHidden}>{children}</span>
</button>
<span aria-hidden="true">{children}</span>
```

### 4. `DetailOverlay` is a bare portal — no dialog semantics on six wallet modals

**Location:** `apps/wallet/app/module/common/component/DetailOverlay/index.tsx:53-59`

No `role="dialog"`, no `aria-modal`, no accessible name, no focus trap, no Escape. Routes six modals via `ModalOutlet/index.tsx`: ExplorerDetail (`:117`), WelcomeDetail (`:127`), MoneriumBankFlow (`:135`), RewardDetail (`:145`), MoneriumOrderDetail (`:155`), EditReferralCodeSheet (`:167`). Focus stays behind the overlay on the inert page.

The Radix path in the same repo is correct (`SheetToolbar` wires `RadixDialog.Title`). **Retire the bespoke portal in favour of the DS `Dialog`** rather than patching it. Minimum viable patch:

```tsx
<div
    role="dialog"
    aria-modal="true"
    aria-label={label}
    tabIndex={-1}
    ref={overlayRef}
    onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
>
```

### 5. Dark theme ships light-ramp values that fail WCAG

**Location:** `packages/design-system/src/tokens.css.ts:249-293`

Computed against the dark background (`grey800 #000000`):

| Token | Value | Ratio | Status |
|---|---|---|---|
| `semanticDark.text.actionHover` | `primary[700]` | **2.28:1** | FAIL — *darker than its own `primary[400]` base (6.75:1)*, so hovering a link **reduces** contrast |
| `semanticDark.icon.action` | `primary[600]` | **3.05:1** bg / **2.20:1** elevated | FAIL — verbatim light copy; icon and its label render different blues in the same control |
| `semanticDark.surface.secondaryHover` | `primary[100]` | **1.18:1** w/ white text | FAIL — a light-ramp value left in the dark theme |
| `semanticDark.text.success` / `.warning` | `600` | 1.78–2.46:1 on their dark surfaces | FAIL — `error` was correctly lightened to `500`, these were missed |

`defaults.css.ts:13-23` applies the `text.action` → `actionHover` pair to **every global anchor**, so the inverted hover affects every link in the product.

```ts
export const semanticDark = {
    text: {
        action: brand.colors.primary[400],
        actionHover: brand.colors.primary[300],  // was primary[700] — lighter, not darker
        success: brand.colors.success[400],       // was 600
        warning: brand.colors.warning[400],       // was 600
    },
    surface: {
        secondaryHover: brand.colors.primary[700],   // was primary[100]
        secondaryPressed: brand.colors.primary[600], // was primary[200]
        disabled: brand.colors.neutral.grey600,      // was grey250 (light value)
    },
    icon: {
        action: brand.colors.primary[400],       // was primary[600]
        actionHover: brand.colors.primary[300],  // was primary[700]
    },
};
```

> `packages/design-system/src/tokens.test.ts:197,213,238` currently **asserts** the broken values — update alongside.

### 6. `FieldError` is silent, and `aria-describedby` dangles across 11 call sites

**Location:** `packages/design-system/src/components/FieldError/index.tsx:19-37`

Renders a plain `<span>` — no `role="alert"`, no `aria-live`. Validation errors are **never announced**. Compounding: `Form/index.tsx:135-145` sets `aria-describedby="…-form-item-message"` but 11 sites render bare `<FieldError>` without that id — a dangling reference. Representatives: `NewCampaign/FormTitle.tsx:45`, `MerchantWizard/MerchantDetailsStep.tsx:87`, `BudgetCampaign/index.tsx:274`, `TerritoryCampaign/index.tsx:108`, `GoalsCampaign/index.tsx:174`.

```tsx
export function FieldError({ id, children }: FieldErrorProps) {
    if (!children) return null;
    return <span id={id} role="alert" className={styles.fieldError}>{children}</span>;
}
```

Then swap `FormControl`-wrapped sites to `<FormMessage />` (it already supplies `formMessageId`), and make `FormControl` emit `aria-describedby={error ? formMessageId : undefined}` so the optional description id stops dangling (`Form/index.tsx:135-145`, affects every `EditField`-based sheet).

### 7. Embedded listener wallet paints over every modal

**Location:** `apps/listener/app/module/embedded/component/Wallet/index.css.ts:40`

`zIndex: 1001` sits **exactly 1 above** `zIndex.modal` (1000), so the embedded wallet renders over every DS Dialog and Drawer overlay — trapping focus behind an un-dismissable panel. Verified against `tokens.css.ts:296-303`.

Three more live layering collisions:

| Location | Value | Problem |
|---|---|---|
| `apps/wallet/…/FullScreenGate/index.css.ts:13` | `9999` | Exactly ties `zIndex.toast` — resolves by DOM order. If the gate wins, the error toasts explaining why it is up become invisible |
| `apps/listener/…/ToastLoading.css.ts:13` | `1000` | Ties `zIndex.modal` while being a toast — a modal opened during a stuck mutation hides it |
| `apps/listener/…/modal/component/Modal/index.css.ts:47,66` | `210`/`220` | Far **below** `zIndex.modal`, so any DS Sheet/Toast paints over the listener's own modal |
| `apps/business/…/DateRangePopover/…:9` | `50` | `zIndex.popover` is 1100 — inside a Sheet this popover renders behind its own trigger |

Import the token in all five: `zIndex.modal + 1` is not a fix — give the embedded wallet `zIndex.fixed` and the gate/toast their semantic tokens.

---

# P1 — Major

### 8. Dev tools ship in the business production bundle

**Location:** `apps/business/src/module/common/provider/RootProvider.tsx:6,92` and `apps/business/src/routes/__root.tsx:3,5`

`ReactQueryDevtools` is statically imported **and rendered with no `import.meta.env.DEV` guard** (verified at `:92`). `TanStackDevtools` + `TanStackRouterDevtoolsPanel` are statically imported into the root route — the guards on their render sites are defeated by the top-level import.

Both are `devDependencies` (`package.json:67,70`), confirming they were never meant to ship. `RootProvider` is rendered by `__root.tsx:46`, so both sit unconditionally in the `$initial` `app-shell` closure. **~75-90 KB gzipped — roughly a third of the 275 KB eager budget** declared at `vite.config.ts:29` (which is `enforce: false`, which is why this survived).

The wallet already does it correctly at `apps/wallet/app/module/common/provider/RootProvider.tsx:15-19`:

```tsx
const ReactQueryDevtools = lazy(() =>
    import("@tanstack/react-query-devtools").then((m) => ({ default: m.ReactQueryDevtools }))
);
// …
{import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
```

### 9. `ResponsiveModal` switches layout at the wrong breakpoint

**Location:** `packages/design-system/src/components/ResponsiveModal/index.tsx:63`

Gates on `tablet` (768) while **every style dressing the surface flips at `desktop` (1024)** — `detailOverlay.css.ts:19,34,69,97` and `detailSheet.css.ts:11`. In the 768–1023px window React mounts a centred desktop Dialog while CSS still paints the mobile full-bleed sheet: `minHeight: 100dvh` inside a centred dialog, no 560px cap, and a `position: fixed` action bar escaping to the viewport corner. The local variable is even named `isDesktop`.

```ts
import { desktop } from "../../breakpoints";
const isDesktop = useMediaQuery(`(min-width: ${desktop}px)`);
```

### 10. Business sidebar collides with content at exactly 768px

**Location:** `apps/business/src/module/common/component/Header/header.css.ts:20,46,94,111` and `apps/business/src/routes/_restricted.css.ts:6`

`Navigation` collapses the sidebar at `max-width: 767px` (the **correct** 768−1 mirror, used 9× in `navigation.css.ts`), but Header and the route shell use `max-width: 768px`. At exactly 768px the sidebar is still 240px wide while the header sets `left: 64px` and content sets `padding-left: 76px` — **header and content slide 176px under the sidebar.**

Sprinkles is min-width-only (`sprinkles.css.ts:33-34`), so 12 sites use `max-width: 768px` and 3 use `max-width: 1024px` — right value, wrong operator. Root cause: `breakpoints.ts` exports only raw numbers.

```ts
// packages/design-system/src/breakpoints.ts
export const up = {
    tablet: `screen and (min-width: ${tablet}px)`,
    desktop: `screen and (min-width: ${desktop}px)`,
} as const;
export const below = {
    tablet: `screen and (max-width: ${tablet - 1}px)`,
    desktop: `screen and (max-width: ${desktop - 1}px)`,
} as const;
```

Then replace all 15 max-width literals with `below.tablet` / `below.desktop`. (`login/breakpoints.ts:12` already derives `1024-1` by hand and would collapse to `below.desktop`.)

### 11. Campaigns table re-renders every cell on each checkbox click

**Location:** `apps/business/src/module/campaigns/component/TableCampaigns/columns.tsx:293-299`

`useCampaignColumns` lists `selectedIds` in its `useMemo` deps, and `campaignSelectionStore.ts:13-21` allocates a **new `Set` on every mutation**. One checkbox click → new `columns` array → TanStack Table treats it as a full column-model rebuild → every `<td>` re-renders plus re-derivation of the sorted/filtered models.

**10 columns × 50 rows = ~500 `flexRender` calls per single toggle**; bulk-selecting 10 campaigns costs ~5,000 cell renders. Only 2 of the 10 columns actually read `selectedIds`.

```tsx
function SelectCell({ row }) {
    const checked = campaignSelectionStore((s) => s.selectedIds.has(row.original.id));
    const toggle = campaignSelectionStore((s) => s.toggle);
    /* …existing cell body… */
}
// then: cell: SelectCell, and reduce the dep array to [t, merchantId]
```

### 12. `key={index}` corrupts form state in the products campaign

**Location:** `apps/business/src/module/campaigns/component/Creation/ProductsCampaign/index.tsx:259-260`

The list is removable (`:296` `values.filter((_, i) => i !== index)`) and appendable (`:311`). With `key={index}`, deleting element *i* shifts every subsequent index; React reuses the DOM nodes in place and rebinds them to different data. Each row hosts a react-hook-form `<Controller name={\`values.${index}\`}>` (`:261-263`), so **field registration, uncontrolled input state, focus, and validation state bleed onto the wrong row**. Deleting "A" from `["A","B","C"]` visibly leaves the deleted value behind.

This is a correctness bug, not a perf issue.

```tsx
const { fields, append, remove } = useFieldArray({ control, name: "values" });
{fields.map((field, index) => (
    <div key={field.id} className={styles.valueRow}>
))}
```

### 13. Shopify blocks first paint on a third-party font stylesheet

**Location:** `apps/shopify/app/root.tsx:69-71`

```tsx
<link rel="stylesheet" href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css" />
```

Render-blocking cross-origin CSS that **chains** the woff2 fetch behind it (HTML → CSS → woff2), inside an already latency-sensitive embedded admin iframe. This is the exact anti-pattern the in-house `inlineFontFaces` plugin exists to kill — its docblock at `packages/dev-tooling/src/vite.ts:136-140` quantifies it at **150–450 ms of FCP/LCP**. `apps/shopify/vite.config.ts:76` registers only `[reactRouter(), vanillaExtractPlugin()]`, unlike all three sibling apps.

Copy `apps/business/public/fonts/*` into `apps/shopify/public/fonts/`, delete the `<link>`, and add:

```ts
inlineFontFaces({ cssFiles: ["public/fonts/inter.css"], preload: ["/fonts/inter-latin.woff2"] }),
```

### 14. Listener context provider re-renders every consumer on every tick

**Location:** `apps/listener/app/ui/ListenerUiProvider.tsx:346-357`

The `value` is an inline object literal, so context propagation (`Object.is`) fires for **all** consumers on every provider render — despite three of the four fields already being stabilized (`setRequest` `useCallback []` at `:170`, `clearRequest` at `:182`, and a large `translation` `useMemo` at `:279-345` that clones an i18next instance). The provider re-renders on every store update, reward-format settle, and `setCurrentRequest`.

```tsx
const contextValue = useMemo(
    () => ({ currentRequest, setRequest, clearRequest, translation }),
    [currentRequest, setRequest, clearRequest, translation]
);
return <ListenerUiContext.Provider value={contextValue}>{children}</ListenerUiContext.Provider>;
```

`charts/chart-context.tsx:196-262` already demonstrates the stable/volatile split this should adopt.

### 15. `Table` primitive clips its rightmost columns on mobile

**Location:** `packages/design-system/src/components/Table/table.css.ts:13-19`

The wrapper sets `overflow: "hidden"` with **no `overflowX`**, while the sibling `DataTable` correctly sets `overflowX: "auto"` (`data-table.css.ts:7-13`). Aggravated by forced `white-space: nowrap` on `<th>`. Every `Table` consumer silently truncates — including `TableTeam`'s action column (resend/delete) and `BillingTable`'s PDF-download cell, making those actions unreachable on mobile.

```ts
export const wrapper = style({ width: "100%", overflowX: "auto", overflowY: "hidden" });
```

### 16. Keyboard-unreachable click targets

Interactive elements with `onClick` on non-interactive nodes — no `role`, `tabIndex`, or key handler:

| Location | Element | Consequence |
|---|---|---|
| `apps/wallet/…/ExplorerCard/index.tsx:88-93` | `<Box as="article" onClick>` | Every merchant card in the wallet Explorer is mouse-only |
| `packages/design-system/…/DataTable/index.tsx:232-242` | `<tr onClick>` | Campaign details sheet unreachable (`TableCampaigns/index.tsx:79`) |
| `apps/business/…/MultiHeroImagesField/index.tsx:111-117` | `onMouseEnter`/`Leave` only | Image preview never appears for keyboard or touch |

The correct idiom is already in-repo at `AddEmailCard/index.tsx:48-52` and `WelcomeCard/index.tsx:129-140`:

```tsx
<Box as="article" role="button" tabIndex={0} onClick={handleOpen}
    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleOpen(); } }}>
```

### 17. Wallet close button is 16px — 13% of the minimum touch target

**Location:** `apps/wallet/app/module/common/component/CloseButton/index.css.ts:5-15`

`padding: 0` with **no `width`/`height`**, so it renders at exactly the 16px default icon size (`index.tsx:13`) — pinned 8px into the screen corner by the floating variant. WCAG 2.5.5 requires 44×44.

`GlassButton/index.css.ts:5-7` already models the fix (44px box around a smaller glyph). Five more sub-44px targets: `RowMenu` kebab 28px (also `opacity: 0` until `tr:hover`, so on touch it is both undersized *and* invisible), `BillingTable` PDF 24px, `Pagination` 32px, and two 28px banner dismissers.

```ts
export const closeButton = style({ width: 44, height: 44, display: "inline-flex",
    alignItems: "center", justifyContent: "center", padding: 0 });
```

### 18. Animations ignore `prefers-reduced-motion`

**Location:** `packages/design-system/src/keyframes.css.ts:1-27`

The shared `fadeIn`/`fadeOut`/`fadeInDown` keyframes have no guard, and 11 DS files animate without one — including two **infinite** animations (`Skeleton/skeleton.css.ts:14-17` pulse, `Spinner/spinner.css.ts:38` spin) plus Sheet, Drawer, Popover, Dialog, AlertDialog, Overlay, Tooltip, Accordion, AlertMessage. Only 4 components guard themselves (`ConfirmationTooltip:45`, `Stepper:130,161`, `progressCheckIconAnimated:28`). WCAG 2.3.3 / vestibular-disorder risk.

Separately, `MotionConfig`/`useReducedMotion` returns **zero matches repo-wide**, so the 11 framer-driven chart animations (`pie-slice.tsx:132,234,386,415`, `bar.tsx:88,119`, `chart-reveal-clip.tsx:34`, …) are unaffected by any CSS rule.

```ts
// packages/design-system/src/reset.css.ts
globalStyle("@media (prefers-reduced-motion: reduce)", {});
globalStyle("*, *::before, *::after", {
    "@media": {
        "(prefers-reduced-motion: reduce)": {
            animationDuration: "0.01ms !important",
            animationIterationCount: "1 !important",
            transitionDuration: "0.01ms !important",
        },
    },
});
```

Plus wrap the chart shell: `<MotionConfig transition={useReducedMotion() ? { duration: 0 } : undefined}>`.

### 19. Wallet ships 131 KB of fonts with zero consumers

**Location:** `apps/wallet/vite.config.ts:411-417`

Inlines both `inter.css` and `inter-tight.css` into a single render-blocking `<style>`. **`interTight` has exactly one reference repo-wide — its own definition** at `tokens.css.ts:84` (verified by grep across `apps`, `packages`, `sdk`). On disk: `inter-tight-latin.woff2` 43.8 KB + `inter-tight-latin-ext.woff2` 87.7 KB = **131.5 KB of unreachable binaries**, embedded in the Tauri app binary, with their `@font-face` blocks bloating the blocking inline style on every boot.

```ts
inlineFontFaces({ cssFiles: ["public/fonts/inter.css"], preload: ["/fonts/inter-latin.woff2"] }),
```

Then delete the three `inter-tight*` files, the `interTight` token, and update the stale comment at `apps/wallet/index.html:92`.

---

# P2 — Moderate

### 20. Unlabelled form controls

| Location | Problem | Fix |
|---|---|---|
| `AllowedDomainsSheet/index.tsx:157-168` (+ `AllowedPackageIdsSheet:203`) | A styled `<Text>` (renders `<span>`) fakes a label above an Input with no `label`/`id`/`aria-label` — zero programmatic association | Delete the fake Text, pass the composed `label` prop DS Input already supports (`Input/index.tsx:96-100`) |
| `TableCampaigns/columns.tsx:73-77,94-99` | Selection checkboxes have ids but no matching `<label>` anywhere and no `aria-label` | `aria-label={t("campaigns.table.selectRow", { name })}` |
| `CountrySelect.tsx:270-278` | Continent bulk-select Checkbox has no id and no wrapping label — unlike the country checkboxes at `:219`/`:306` which are correct | Add `id` + `aria-label` naming the continent |
| `forms/InputSearch/index.tsx:12-19` | Named only by placeholder (not a name; vanishes on input) | Accept and default an `aria-label` |

### 21. Icon-only buttons with no accessible name

7 instances. Representatives: `apps/wallet/app/routes/install.tsx:325-333`, `PostShareConfirmation/index.tsx:78-84`, `ConnectedDevicesPage/DeviceCard.tsx:55-71`, `MultiHeroImagesField/index.tsx:127-133` (name computes to the literal glyph `✕`).

```tsx
<button type="button" aria-label={t("common.close")} onClick={onClose}>
    <CloseIcon aria-hidden="true" />
</button>
```

### 22. `Input` `bare`/`soft` variants have no focus indication

**Location:** `packages/design-system/src/components/Input/input.css.ts:166,180`

Both strip the inner `outline` but — unlike `default`, which compensates via `&:focus-within` `borderColor` at `:31-35` — define **no `:focus-within` rule at all**. These are the wallet's and the business wizard's primary field styles.

```ts
soft: { /* … */ ":focus-within": { boxShadow: `0 0 0 2px ${vars.border.focus}` } },
```

Three more unsubstituted `outline: none`: `ButtonWallet/index.css.ts:35`, `MoneriumBankFlow/index.css.ts:102` (transfer amount input), `Tabs/tabs.css.ts:114` (a Radix-focusable panel). *Note: the `outline: none` on dialog **containers** (`Dialog:28`, `AlertDialog:41`, `Sheet:56`) is correct — Radix focuses those programmatically.*

### 23. Escape is dead on the sharing modals

**Location:** `packages/wallet-shared/src/sharing/component/SharingPage/index.tsx:384-397`

The Escape handler is attached to a non-focusable backdrop `<div>` (no `tabIndex`), so it only fires when focus is already inside — and the inner container at `:391-397` then calls `e.stopPropagation()` on `onKeyDown`, killing it there too. No dialog semantics either. Same structure at `PostShareConfirmation/index.tsx:53-59`.

Move the listener to `document` in a `useEffect`, add `role="dialog" aria-modal="true" aria-label`, and delete the no-op `onKeyDown` pair.

### 24. Missing safe-area insets on mobile CTAs

`tokens.css.ts:388-392` documents that **raw `env()` returns 0 on Android Tauri** (the `safeArea` token exists precisely for this), yet 4 sites use raw `env()` and one uses nothing:

- `DetailSheet/detailSheet.css.ts:62` — the primary CTA row
- `Drawer/drawer.css.ts:31` — what `ResponsiveModal` renders on **every** mobile device (the same file uses the token correctly at `:56`)
- `styles/inAppBanner.css.ts:19`, `FullScreenGate/index.css.ts:19` (line 20 uses the token correctly — inconsistent within two adjacent lines)
- `business/…/FloatingFooter/floating-footer.css.ts:15-29` — `fixed bottom: 0`, 96px tall, **no inset at all**; the primary CTA sits under the iOS home indicator

```ts
paddingBottom: `calc(${alias.spacing.m} + ${safeArea.bottom})`,
```

### 25. Fixed widths overflow a 320px viewport

| Location | Value | Overflow |
|---|---|---|
| `forms/MultiSelect/multi-select.css.ts:8` | `minWidth: 320px` | +88px past the ~232px content budget set by `_restricted.css.ts:6` — chevron and clear-action unreachable |
| `TableCampaigns/filter.css.ts:14` | `width: 343px` on a flex-wrap child | +111px; wrap moves it to a new line but never shrinks it |
| `FunnelChart/funnelChart.css.ts:35` | `gridTemplateColumns: "120px 1fr 96px"` | 248px of fixed tracks before the `1fr` bar gets a pixel — **the chart disappears** inside a Card at 320px |

All three are masked rather than surfaced by `overflowX: hidden` on `<html>` (`global.css.ts:18`).

```ts
gridTemplateColumns: "minmax(0, 120px) minmax(0, 1fr) minmax(0, 96px)",
```

### 26. Wallet address truncates the checksum users verify

**Location:** `apps/business/src/module/settings/WalletAddressCard/index.tsx:33-35`

Renders the full 42-char `0x` address into an ellipsis-only container (`wallet-address-card.css.ts:11-18`), cutting **exactly the trailing checksum characters** used for verification. The wallet app already solves this correctly with `formatHash({ start: 8, end: 6 })` at `ProfileIdentityCard/index.tsx:33-35,166`.

Use middle-truncation, or `overflowWrap: "anywhere"` + `userSelect: "all"` to match `CopyableValue`.

### 27. Unoptimized and unhinted images

- **`welcome_logos_detail.webp` is 183 KB** — 6.7× the next-largest asset — and `preloadModalChunks.ts:26` unconditionally idle-prefetches it within 2s of first paint on **every** boot, for a modal most users never open. Re-encode at 2× the 280px display box (`cwebp -q 78 -resize 860 0`) → expect 40–55 KB.
- `apps/shopify/app/assets/share-button.png` **38.6 KB PNG** (+ `frak-listener.png` 7.2 KB) — the only non-WebP rasters in the repo; the wallet is 100% WebP. Compounded by `assetsInlineLimit: 0` (`vite.config.ts:81`), so each is a full round-trip.
- Missing `width`/`height` → guaranteed CLS: `shopify/…/Instructions/index.tsx:22`, `Stepper/Step5.tsx:35`, `Step6.tsx:38`.
- `WelcomeCard` carousel (`IntroSlide.tsx:26`, `InviteSlide.tsx:26`) eagerly decodes every slide on mount, though `ExplorerDetail/index.tsx:225-232` in the same app already implements per-slide `loading`/`decoding`/`fetchPriority`.

### 28. Unvirtualized history list with index-derived keys

**Location:** `apps/wallet/app/routes/_wallet/_protected/history.tsx:22` and `DayGroup/index.tsx:36`

`useHistory` merges two unbounded remote sources with no slice or limit (`useHistory.ts:30-39`), and every entry renders — on mobile, in a Tauri WebView. This route is explicitly the "see all" destination from the correctly-bounded `RewardHistory/index.tsx:39` (`entries.slice(0, 5)`).

`key={`${day}-${index}`}` is a day-scoped array index over a timestamp-sorted merged list, so a late-arriving entry mis-reconciles every subsequent row — each containing a lazily-loaded `<MerchantLogo>`, causing image re-fetch churn. `entry.id` is available and already used correctly at `RewardHistory/index.tsx:39`.

### 29. Duplicated design-system components

| Duplicate | Should use | Problem |
|---|---|---|
| `business/…/Badge/badge.css.ts` | DS `Badge` | Same recipe name, all colors via raw `brand.colors.*` → frozen to light theme; variants diverge (`danger` vs `error`) |
| `listener/…/modal/component/Modal/index.css.ts` | DS `Dialog` + `Overlay` | Own keyframes, own z-index (below `zIndex.modal`), re-types `textStyles.body` verbatim |
| `shopify/…/ui/skeleton.css.ts` | DS `Skeleton` | Re-declares the pulse keyframe and a `#e4e5e7` fill, without the DS dark-mode branch or variants |
| `shopify/…/ui/ProgressBar.css.ts` | DS `ProgressBar` | Hardcodes Polaris green `#008060` |
| `wallet/…/BiometricSettings/index.css.ts` | DS `Select` | Bare `<select>`; also the wallet's only hardcoded hex (`#e0e0e0`/`#ffffff`, breaks in dark mode) |

### 30. Incomplete interactive states in DS form controls

`Button/button.css.ts:47-53` is the reference — `(hover: hover)`-gated hover + active, focus-visible ring, disabled. The Radix-wrapped controls consistently ship default/focus-visible/disabled and omit the rest:

| Component | Missing |
|---|---|
| `Accordion/accordion.css.ts:27-40` | **`:focus-visible` entirely** (a real `<button>` with zero focus indication), plus hover and disabled |
| `Slider/slider.css.ts:31-44` | hover, `:active` (a drag handle with no pressed feedback), **and disabled** |
| `Checkbox/checkbox.css.ts:15-30` | hover, active |
| `RadioGroup/radioGroup.css.ts:31-42` | hover, active |
| `Switch/switch.css.ts:17-30` | hover, active — and `switchThumb:37` hardcodes `"white"`, the only color literal left in an interactive DS component; blows out against the grey400 track in dark mode |
| `TimeInput/time-input.css.ts:9-21` | Never sets `aria-invalid`, so Input's `:has([aria-invalid="true"])` error fill never fires — **an invalid time renders as valid** |

### 31. `html { height: 100vh }` reintroduces the iOS URL-bar bug

**Location:** `packages/design-system/src/reset-globals.css.ts:37-38`

The last `100vh` in the wallet path (everything downstream migrated to `dvh`), and it fights `AppShell`'s `--viewport-height` keyboard mirror — the custom property that exists specifically because WKWebView honours neither `dvh`-on-keyboard nor `adjustResize`. Change to `100dvh`. Related: `business/…/Login/login.css.ts:10` uses `minHeight: 100vh` while its own override at `:20` uses `100dvh` and its halves target `50dvh`.

---

# P3 — Polish

### 32. Token drift — quantified

| Metric | Count | Worst offenders |
|---|---|---|
| Hardcoded colors in `*.css.ts` | **77** genuine (84 total − 7 documented escape hatches) | shopify 20, wallet-shared 17, listener 16, business 11, DS 9, wallet 4 |
| Off-scale spacing values | **58** | 10px ×11, 6px ×9, 5px ×7, 14px ×6, 3px ×5 — plus `13.11px` (`push-preview.css.ts:59`, a fractional Figma export) |
| Raw `zIndex` literals | **43** across 35 files | `zIndex` token imported in only 9 files |
| Raw `boxShadow` strings | **17** | vs 9 correct `shadow.*` uses |
| Off-grid breakpoints | **14** across 5 files | 900, 960, 1200, 1263/1264, 819/820, 431 |

Notable: `apps/shopify` imports **zero** DS tokens, so `[data-theme='dark']` is a complete no-op there — one architectural decision (Polaris vs Frak) resolves ~26% of all color drift. `wallet-shared/…/SharingPage/sharingPage.css.ts` is the worst single file (9 hardcoded colors, including invented greys `#979797`/`#BBC4CD` matching no token, and rules that use `alias.cornerRadius` correctly three lines before hardcoding `#fff`).

`shared.css.ts:16` hardcodes `0 20px 50px rgba(0,0,0,0.35)` — **character-for-character `shadow.overlay`**, which the wallet imports correctly at `detailOverlay.css.ts:41`. Four independently re-derived grey menu shadows exist for the same visual intent, two byte-identical but re-typed.

### 33. Typography inconsistency across apps

`apps/business/src/styles/global.css.ts:13` sets a **global `html { fontWeight: 500 }`**, so every unstyled element in business renders Medium while wallet and listener default to 400 — the same semantic role renders differently per app. Line `:11` also duplicates `"Inter"` since the token already expands to it.

Three identical dialog title blocks (`Dialog/dialog.css.ts:34-35`, AlertDialog, Sheet) inline `fontWeight: 600` + `fontSize: "18px"` **with no `lineHeight`**, while `Text/text.css.ts:9-105` pairs every size with an explicit line-height. Collapse them onto `textStyles.heading3`.

### 34. Heading structure

`forms/Form/index.tsx:169-171` emits an `<h3>` for its section label while page shells render `<Text as="h1">` (`PageShell/index.tsx:22`, `WizardLayout/index.tsx:73`) with no intervening `h2` — every form section jumps h1 → h3. Change to `<h2>`; `formTitle` sets its own size so the visual result is unchanged.

`listener/…/WalletHeader/index.tsx:39-49` renders an `<h1>` whose only content is `<img alt="">` — announced as "heading level 1, blank".

### 35. Alt-text inversion

`PostShareConfirmation/index.tsx:91-95` gives a decorative phone-mockup frame `alt="iPhone"` (should be `alt=""`); `shopify/app/routes/purchase.tsx:42-45` uses `alt="Logo"` (non-descriptive and untranslated); `wallet-shared/…/MerchantLogo.tsx:24-30` sets `alt={appName}`, duplicating the visible name rendered beside it.

### 36. Micro-optimizations

- `FunnelChart/index.tsx:126` — `Math.max(...steps.map(…))` spreads into the argument list in a render body; `FunnelBar` constructs a fresh `scaleLinear` on every render inside a `ResizeObserver` callback, and `onHover` is an inline arrow on an unmemoized row, so hovering one row rebuilds all N scales. The sibling `charts/` directory is carefully memoized; `FunnelChart` sits outside it and never got the treatment.
- `CampaignDetailsSheet/parts.tsx:24-51` — `useDetailFormatters` constructs **6 `Intl.NumberFormat` objects** per cache miss (~1–3 ms) and is called twice in the same subtree (`AmbassadorsTab.tsx:13`, `TopAmbassadorsTable.tsx:37`) = 12 duplicate objects per tab. `intlCache.ts` already has `getDateTimeFormat`; add a `getNumberFormat` twin.
- `packages/dev-tooling/src/vite.ts:409` — font preload `<link>` uses `injectTo: "head"`, which lands **after** the module scripts and their `modulepreload` links. The sibling `preconnectOrigins` in the same file documents this exact hazard and uses `head-prepend`. The font preload did not get the fix.

---

## Verified clean

Worth recording so these are not re-audited:

- **Route code splitting** — `autoCodeSplitting: true` in both TanStack apps; `apps/wallet/vite.config.ts:44-50` even suppresses splitting for 5 pure-`<Outlet/>` parents where a lazy chunk would be pure overhead. Eager route count effectively 0.
- **Chart quarantine** — `design-system/package.json` has no root `.` export, so no barrel can leak `@visx`/`d3`/`motion`. Only 4 files import `./components/charts`, all inside the lazy `feature-restricted` chunk. Grep for `import * as` against heavy deps returns **zero matches**.
- **Listener 32 KB budget** — eager path traced and confirmed React-free; all `viem` references near it are type-only. Three enforcement layers verified (`stripOrphanCrossChunkImports`, `stripEagerLazyCss` + `assertNoLazyCssLeak`, `modulePreload.resolveDependencies`). *One hardening note: `LAZY_CHUNK_NAMES` (`:61-72`) is a hand-maintained array feeding all three — derive it from the groups instead.*
- **Fonts** — all subsets are variable (`font-weight: 100 900`) with `font-display: swap`; no unused static weights anywhere.
- **Radix a11y** — DS icons ship `aria-hidden`; every business Sheet gets a name via `SheetToolbar`'s `RadixDialog.Title`; `ResponsiveModal`/`ExplorerSortSheet` correctly pair a hidden title with `aria-describedby={undefined}`; `CodeInput` is correctly labelled; Button/Checkbox/RadioGroup/Tabs/Slider define real `:focus-visible` rings.
- **Truncation idiom** — `min-width: 0` + `overflow: hidden` + ellipsis applied correctly in ~15 places, with `@supports(-webkit-line-clamp)` two-line upgrades on both Title components.

---

## Recommended sequence

1. **Six DS files close the majority of a11y instances** — `GlassButton/index.css.ts`, `FieldError/index.tsx`, `Input/input.css.ts`, `DataTable/index.tsx`, `keyframes.css.ts`, `Table/table.css.ts`. Highest leverage in the report.
2. **One token file fixes dark mode product-wide** — the `semanticDark` edits in P0-5 (plus `tokens.test.ts`).
3. **Two unblocking fixes** — `CountrySelect` trigger and `ButtonWallet` label; both are single flows that are currently impossible to complete.
4. **Add `up`/`below` to `breakpoints.ts`** — removes the 768px collision class structurally rather than site by site.
5. **Add CI gates** for what static review cannot hold: an `enforce: true` eager budget on business (it is currently warn-only, which is why ~90 KB of devtools shipped), plus axe-core on the wallet and business route smoke tests.

The `assertComponentRegistrations` / 32 KB budget reflex already in this repo is exactly right — extend it to the token and a11y boundaries, which currently have nothing.
