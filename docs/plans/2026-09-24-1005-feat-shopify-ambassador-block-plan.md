---
title: Shopify Ambassador Block - Plan
type: feat
date: 2026-09-24
topic: shopify-ambassador-block
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
---

# Shopify Ambassador Block - Plan

## Goal Capsule

- **Objective:** A Shopify merchant on an Online Store 2.0 theme can publish the Frak ambassador page on their own storefront by following the Frak app's setup guidance, without writing code.
- **Means:** A "Frak Ambassador" app block in the theme extension that renders `<frak-ambassador>`, plus a third card in the Frak app's "finish your setup" area (KTD1, KTD2).
- **Product authority:** What the page says and does stays governed by `docs/plans/2026-09-15-1424-feat-ambassador-page-component-plan.md` and `docs/plans/2026-09-23-1130-feat-ambassador-page-l-composition-plan.md`. This plan covers only how a Shopify merchant places the page. Customisation from the business dashboard and capturing the page URL are not active scope.
- **Open blockers:** None. R8 is a release-order dependency, checked before the production extension deploy.
- **Stop conditions:** stop and ask if the block needs any setting or element attribute to render, or if tracking ambassador presence would change the onboarding step count or the "setup complete" state.

---

## Product Contract

### Summary

Shopify merchants get a "Frak Ambassador" block they add to a page of their own, and the block ships with no settings. The Frak app shows a setup card that walks them through creating the page and adding the block. The card goes away once the block is live in their theme.

### Problem Frame

`<frak-ambassador>` exists as a web component, but a Shopify merchant today can only place it by pasting markup into a Custom Liquid section. No merchant would find that on their own. Every other Frak storefront surface on Shopify reaches merchants in two ways: an app block in `extensions/theme-components`, and a card in the Frak app that detects whether the block is in place. The ambassador page has neither.

The merchant will later customise the page's texts and images from the business dashboard. Any customisation surface added on Shopify now would compete with that one. `apps/shopify/extensions/AGENTS.md` already documents this failure for banner colours: the Liquid settings and the dashboard CSS target the same elements, and one silently overrides the other.

### Key Decisions

- **An app block on a page the merchant creates.** (session-settled: user-directed — chosen over a page served automatically through an app proxy, a page the Frak app creates in one click via a new scope, and documenting a Custom Liquid paste: it reuses the existing block pattern, the merchant owns the page, its URL and its meta tags, it needs no new scope, and no Frak server sits on the page's request path.) Governs R1, R2.
- **The block has no content settings.** (session-settled: user-directed — chosen over exposing images and hero copy, images only, or a curated set of about 20 text fields: the business dashboard will become the single place to customise the page, so a second surface would need a precedence rule or a migration later.) Governs R3.
- **No hero photo source on Shopify for now.** (session-settled: user-directed — chosen over falling back to the merchant's Shopify brand cover image: brand covers are composed wide, and wide images lose about half their width at the hero's 4:5 crop (commit `f43b3de22`), while the collapsed frame is L's designed no-photo state. The photo arrives with the dashboard work.) Governs R3.
- **Guidance lives in the "finish your setup" card set.** (session-settled: user-directed — chosen over a new onboarding wizard step, which would hold back "setup complete" for merchants who do not want the page, and over no app UI, where merchants would never find the block.) Governs R4–R7.
- **Only a custom page template counts, and the card leads with the page.** (session-settled: user-directed — chosen over counting any page template and over keeping the card until dismissed: detection cannot see whether a page uses the template, so the card must be read in full before it hides, and the default page template renders on every page, so a block there is a mistake rather than a finished setup.) Governs R5, R6.
- **The page URL is not captured.** (session-settled: user-directed — chosen over looking up the page through a new `read_online_store_pages` scope, which forces every installed merchant to re-approve the app, and over asking the merchant to paste the URL, which goes stale when the page handle changes.) No requirement; see Scope Boundaries.

### Requirements

**Theme block**

- R1. The theme extension offers a "Frak Ambassador" block that a merchant can add to a section of any page template from the theme editor.
- R2. The block renders the ambassador page for the shop's Frak merchant, using the configuration the Frak listener embed already provides, with nothing else to set.
- R3. The block exposes no content settings: every text and image falls back to the component's built-in defaults, in the storefront's language.

**Setup guidance in the Frak app**

- R4. The "finish your setup" area gains an ambassador-page card next to the share-button and banner cards, shown under the same conditions as those cards.
- R5. The card lists three steps, in order: create a Shopify page; in the theme editor, create a custom page template and add the Frak Ambassador block to it; select that template on the page. It links to the Shopify admin screen for the first two steps and warns against the default page template.
- R6. The card is hidden while an enabled Frak Ambassador block exists in a custom page template of the published theme, and it shows otherwise. The default page template never counts.
- R7. The card's state refreshes when the merchant returns to the Frak app tab, as the other setup cards' state does.

**Release**

- R8. The block reaches merchants only after a components CDN release that registers `<frak-ambassador>` is live as `latest`.

### Key Flows

- F1. Merchant publishes the ambassador page
  - **Trigger:** The merchant opens the Frak app after completing the required onboarding steps, on an Online Store 2.0 theme.
  - **Steps:** The merchant sees the ambassador-page card. They create a page in the Shopify admin. In the theme editor they create a custom page template, add the Frak Ambassador block to it and save. Back on the page, they select that template. In the Frak app, the card is gone.
  - **Outcome:** The page is live at a URL the merchant chose. It shows the default ambassador content in the storefront's language.
  - **Covered by:** R1–R7

### Acceptance Examples

- AE1. **Covers R6, R7.** Given the merchant has added and saved the block in a page template of the published theme, when they return to the Frak app tab, then the ambassador-page card is gone.
- AE2. **Covers R6.** Given the block is in a page template but disabled, or sits in a section the merchant hid, when the Frak app loads, then the card shows.
- AE3. **Covers R6.** Given the block exists only in an unpublished theme, or only in the default page template, when the Frak app loads, then the card shows.
- AE4. **Covers R4.** Given a vintage theme that cannot host app blocks, when the Frak app loads, then no ambassador-page card shows, as with the share-button and banner cards.
- AE5. **Covers R3.** Given a French storefront, when a visitor opens the page, then all copy is the French default and the hero frame is collapsed around the reward card.

### Scope Boundaries

**Deferred for later**

- Customising the page's texts and images from the business dashboard.
- A hero photo source: a dashboard upload, seeded for existing merchants with the frames hand-picked in `f43b3de22`. The Shopify brand cover image stays rejected as a fallback, per Key Decisions.
- Capturing the page URL, and pointing the `frak.id/brands/[slug]` CTA at it (`static-web` work).

**Not part of this work**

- A page that Frak creates or serves (app proxy, or `pageCreate`).
- Any settings on the block, including colours and images.
- Vintage themes. They cannot host app blocks, and the other setup cards already skip them.
- The page's `<title>`, meta description and canonical tag. These stay the merchant's concern, per the SEO boundary in `docs/plans/ambassador-page/content-spec.md`.

<!-- ce-section: work-relationships -->
### How This Work Fits Together

This plan covers placing the ambassador page on Shopify. The breakdown below reflects current understanding, not a committed roadmap.

- Dashboard customisation of texts and images. Depends on this block and on the component accepting backend-served content. Once it ships, it becomes the only customisation surface for the Shopify page.
  - Hero photo upload. Shares the dashboard surface above.
- frak.id brand CTA pointing at the merchant page. Depends on some way of knowing the page URL. Still to decide where that URL comes from.
- WordPress and PrestaShop placement. Can proceed independently of this plan.

### Dependencies / Assumptions

- `<frak-ambassador>` is not yet released: `.changeset/ambassador-page-component.md` is still pending. R8 orders the two releases.
- The page renders only when the Frak listener embed is active, as every Frak block does. The card's display conditions (R4) already follow the onboarding steps that activate it.
- Because the block has no settings, it passes no content attributes to the element. Shipping it therefore freezes none of the component's override attributes as a published integration surface.
- Assumption, unverified: `<frak-ambassador>` reads correctly inside a typical theme's app section, whose width and margins the theme controls. Checked on Dawn and one other theme in the Verification Contract.

### Sources / Research

- Block and detection patterns: `apps/shopify/extensions/theme-components/blocks/banner.liquid`; `doesThemeHasFrakBanner` in `apps/shopify/app/services.server/theme.ts`, which already scans `templates/*.json` for an enabled block.
- Setup cards: `apps/shopify/app/components/OptionalSetup/index.tsx`, rendered only for Online Store 2.0 themes in `apps/shopify/app/routes/app._index.tsx`.
- Two-surface trap: "Two style surfaces, kept on purpose" in `apps/shopify/extensions/AGENTS.md`.
- Shopify limits: app blocks cap interactive settings at 25, which the component's roughly 64 override attributes could not fit anyway ([theme app extension configuration](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration)). Deep links can add an app block to an existing JSON template only.
- Hero crop evidence: commit `f43b3de22` (wide brand art at 4:5, with the reward card drawn over it).

**Product Contract preservation:** changed: R5, R6 — three steps page first, and only a custom page template counts, because the card hides before the merchant can see a page use the template and a block on the default template renders everywhere (user-directed after code review). F1 and AE3 follow. The deferred card-copy question is answered by U3.

---

## Planning Contract

### Key Technical Decisions

- KTD1. **The block is restricted to page templates.** Its schema declares `enabled_on` with the `page` template, so the theme editor refuses to place it on product, collection or home templates. Detection then only needs to tell a custom page template (`templates/page.<suffix>.json`) from the default one. Governs R1, R6.
- KTD2. **One theme scan answers both banner and ambassador presence.** The banner check already pages through `sections/*.json`, `templates/*.json` and `config/settings_data.json`. It becomes a presence check that reports both block types from that single read. The existing banner-only function stays as a thin wrapper, because the appearance route calls it on its own. Governs R6.
- KTD3. **A hidden section counts as "block absent", for every block this scan checks.** (session-settled: user-approved — chosen over matching only the block's own `disabled` flag: a block inside a hidden section never renders, and the banner check inherits the fix through the shared detector.) Governs R6.
- KTD4. **Ambassador presence travels in the onboarding data but is not an onboarding step.** It is an optional field beside `isThemeHasFrakBanner`, filled by the step 7 fetcher, and absent from `stepValidations`. So `MAX_STEP`, `applicableStepCount` and the critical steps do not change (see Stop conditions). Governs R4.
- KTD5. **The card uses no "add block" deep link.** (session-settled: user-approved — chosen over an `addAppBlockId` link: it can only target a template that already exists, which here is the default page template, so the ambassador page would land on every page.) The card links to the theme editor opened on page templates, where "Create template" lives, and to the Shopify admin's new-page screen. Governs R5.
- KTD6. **The release order is a manual pre-deploy check.** (session-settled: user-approved — chosen over a guard script in the deploy command: the order only has to be right once, before the first production extension deploy that carries the block.) Governs R8.

---

## Implementation Units

### U1. Frak Ambassador theme block

**Goal:** Merchants can add the Frak Ambassador block to a page template.
**Requirements:** R1, R2, R3; AE5.
**Dependencies:** none.
**Files:** `apps/shopify/extensions/theme-components/blocks/ambassador.liquid` (new), `apps/shopify/extensions/AGENTS.md`.
**Approach:**
1. Add a block whose markup is the bare `<frak-ambassador>` element with no attributes (R3), a `section` target, an empty settings list and the `enabled_on` restriction of KTD1.
2. Name it "Frak Ambassador" in the schema. The file name, not the display name, gives the block type `/blocks/ambassador/`, which is the pattern U2 matches.
3. Add the block to the structure, data-flow and "Block types" lists in `apps/shopify/extensions/AGENTS.md`.
**Patterns to follow:** `apps/shopify/extensions/theme-components/blocks/banner.liquid` for the schema shape. It does not need that file's `{% style %}` block, locale-fallback chain or preview settings.
**Test expectation:** none. It is a Liquid file with no logic, and the dev-store check in the Verification Contract proves it.
**Verification:** In a dev store, the theme editor offers the block on a page template, does not offer it on the product template, and the saved page renders the ambassador page in the storefront's language with a collapsed hero frame.

### U2. Detect the block in the published theme

**Goal:** The Frak app knows whether an enabled ambassador block exists, from the same theme read that already detects the banner.
**Requirements:** R6, R4; AE1, AE2, AE3.
**Dependencies:** none. U1 fixes the block handle this unit matches on.
**Files:** `apps/shopify/app/services.server/theme.ts`, `apps/shopify/app/services.server/theme.test.ts`, `apps/shopify/app/utils/onboarding.ts`, `apps/shopify/app/utils/onboarding.server.ts`, `apps/shopify/app/utils/onboarding.test.ts`.
**Approach:**
1. Turn the banner section detector into one that takes the block-type pattern, and make it skip sections marked disabled (KTD3).
2. Replace the body of the banner theme check with a presence check that returns both flags from one scan (KTD2). Keep the banner function as a wrapper over it, for `app.appearance.tsx`.
3. Add the optional ambassador flag to `OnboardingStepData` and return it from the step 7 fetcher, leaving `stepValidations` untouched (KTD4).
**Patterns to follow:** the existing `detectFrakBannerInSections` tests in `theme.test.ts`, and the `settings_data.json` vs template `sections` split in `doesThemeHasFrakBanner`.
**Test scenarios:**
- Covers AE1. A template whose sections hold an enabled `shopify://apps/frak/blocks/ambassador/<uuid>` block is detected as present.
- Covers AE2. The same block with `disabled: true` is detected as absent.
- Covers AE2. An enabled ambassador block inside a section with `disabled: true` is detected as absent.
- Covers AE3. An enabled ambassador block in `templates/page.json` is detected as absent, and one in `templates/page.ambassador.json` as present.
- A template body Shopify returns as base64 is decoded before detection.
- A banner block inside a hidden section is detected as absent (the KTD3 change for banner).
- An ambassador block does not count as a banner, and a banner does not count as an ambassador.
- Sections that are strings, empty, `undefined`, or sections without blocks detect as absent for both patterns.
- Every existing banner detector test passes against the parameterised detector.
- `validateCompleteOnboarding` gives the same result with the ambassador flag true, false or absent, and `MAX_STEP` stays 7.
**Verification:** Existing `theme.test.ts` and `onboarding.test.ts` cases pass unchanged apart from the renamed detector. AE3's unpublished-theme case holds by construction, since the scan reads only the main theme.

### U3. Ambassador-page setup card

**Goal:** Merchants on Online Store 2.0 themes see a card that walks them through publishing the page, until the block is detected.
**Requirements:** R4, R5, R6, R7; F1; AE1, AE4.
**Dependencies:** U2.
**Files:** `apps/shopify/app/components/OptionalSetup/index.tsx`, `apps/shopify/app/i18n/locales/en/translation.json`, `apps/shopify/app/i18n/locales/fr/translation.json`.
**Approach:**
1. Add an ambassador card, shown while U2's flag is falsy, and let `OptionalSetup` return nothing only when all three cards are hidden.
2. Show R5's three steps, the first two with a link (KTD5): the admin's new-page screen on the shop's myshopify domain, and the theme editor opened on page templates.
3. Add `optionalSetup.ambassador` copy in en and fr, text only, with no illustration. It tells the merchant to remove the template's default page-content section if they want the ambassador page alone.
4. Reword `optionalSetup.title` and `optionalSetup.description` in both languages, since they currently say "two" components.
**Patterns to follow:** `BannerCard` and `useThemeEditorUrl` in the same file. Links use `ExternalButton`, never a bare `<a>` (Shopify session-loss trap). R7 comes from the existing `useVisibilityChange` refresh, with no new code.
**Test expectation:** none. `apps/shopify` runs only node `.test.ts` suites, with no React component harness, and the card's only logic is the flag check covered in U2. The dev-store check proves the card.
**Verification:** In a dev store, the card shows, both links open the right admin screens, and after F1 the card disappears when the merchant returns to the tab. The en and fr keys match.

---

## Verification Contract

| Gate | Command or check | Proves |
|---|---|---|
| Unit tests | `bun run --cwd apps/shopify test` | U2 scenarios |
| Types | `bun run --cwd apps/shopify typecheck` | U2, U3 |
| Repo gate | `bun run format && bun run lint && bun run typecheck && bun run test` | Biome, comment budget, `check:shopify-stage` (generated stage artifacts still hold the prod table) |
| Dev store | `bun run --cwd apps/shopify shopify:dev`, then F1 end to end on Dawn and one other Online Store 2.0 theme | U1, U3, AE1, AE2, AE5, and the app-section width assumption |
| Pre-prod-deploy (KTD6) | Before `shopify:deploy:prod`: follow `https://sdk.frak.id/components.js` to the loader it imports and confirm it contains `frak-ambassador` | R8 |

The dev store needs a components build that registers `<frak-ambassador>` behind the `sdk-dev` pointer, which means a beta release. The current `sdk-dev` beta predates the component. `bun run --cwd sdk/components try:merchant` is no substitute: it injects the element in place of a page's content, so it never exercises the block.

## Definition of Done

- R1–R8 hold, and AE1–AE5 each have a named test or dev-store observation.
- The block has no settings, and the element it renders carries no attributes.
- `stepValidations`, `MAX_STEP` and the critical steps are unchanged.
- The Verification Contract gates pass, and the KTD6 check is recorded before the first production extension deploy that includes the block.
- The plan changes nothing under `sdk/`, and no abandoned code stays in the diff.
