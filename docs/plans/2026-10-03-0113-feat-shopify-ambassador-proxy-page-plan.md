# Shopify: ambassador page served through the app proxy

Status: prototype on `feat/shopify-ambassador-proxy-page`. Supersedes the page-template flow of
`2026-09-29-1047-feat-shopify-one-click-ambassador-page-plan.md` (one-click create on the narrow
default template, then a 5-step theme-editor guide for full width).

## Why

Product requirements: the storefront ambassador page is **full width** (at least the theme's
normal content width) and shows **no theme page title**, and a merchant with no technical
background sets it up without help.

A Shopify `/pages/` page cannot meet both without theme-editor work: apps cannot create theme
templates (`write_themes` exemptions go to page builders only), the `addAppBlockId` deep link
fails in Safari, and the Shopify mobile app cannot add blocks. An **app proxy** page can:
Shopify renders our Liquid inside the theme layout (header, footer, fonts, colours, app embeds)
with no template section, so there is no title and no narrow column. Research behind this
(32-theme lab, 26 live proxy pages, competitor review, two designs and two reviews) is
summarised in the PR; Smile.io moved its loyalty page to a proxy in 2026.

What the merchant gives up compared with a `/pages/` page: a row in Online Store > Pages, a
`/pages/` address, sitemap and Shopify-search presence. Text and photo were never edited in
Shopify; they stay in the Frak dashboard.

## Architecture

```
visitor ─GET shop.com/apps/ambassador─▶ Shopify ─signed GET─▶ proxy origin ─▶ ambassador.liquid
                                         ◀──── Liquid rendered inside the theme layout ────┘
```

- **One Liquid file**, `apps/shopify/proxy/ambassador.liquid`, identical for every shop. All
  shop state is read by Shopify's Liquid from the shop metafield `frak.ambassador_page`, so a
  publish or hide applies on the next request with nothing to invalidate.
- **Production origin: `sdk.frak.id`** (CloudFront + S3, `infra/sdk-pointer.ts`), at
  `https://sdk.frak.id/shopify/ambassador`. The object is uploaded with
  `Content-Type: application/liquid`. A viewer-request rule rewrites every
  `/shopify/ambassador*` URI to that one key and drops the query string (Shopify adds a unique
  `timestamp`/`signature` per request, which would otherwise make every request a cache miss).
  Storefronts already depend on this domain for `components.js`, so the page adds no new
  dependency.
- **Every other stage: the app server**, route `app/routes/proxy.ambassador.tsx` (+ splat), which
  verifies the proxy signature (`authenticate.public.appProxy`) and returns the same file
  through the `liquid()` helper. The file is imported with Vite `?raw`, so it is inlined at
  build time. The prod app server keeps the route too, as a fallback origin.
- **TOML**
  - production: `[app_proxy] url = "https://sdk.frak.id/shopify/ambassador"`, `prefix = "apps"`,
    `subpath = "ambassador"`.
  - development: `url = "/proxy/ambassador"` (Shopify prepends the app URL; `shopify app dev`
    swaps in the tunnel), `prefix = "apps"`, `subpath = "ambassador-dev"`, so a store with both
    apps installed gets two distinct paths.
  - both: add `write_app_proxy` and `write_online_store_navigation` to `optional_scopes`; keep
    the page scopes (used by the switch from an old `/pages/` page). Required `scopes` are
    unchanged, so existing installs are never asked to re-approve.
- **Deploy order for production**: deploy the `sdk-pointer` stack first (file live on the CDN),
  then `shopify app deploy`. A dedicated workflow redeploys the stack when the Liquid file
  changes on `main`, pinning `SDK_POINTER_VERSION` to the version `sdk.frak.id/components.js`
  serves at that moment, so it never moves the SDK pointer.

### `write_app_proxy`

Shopify's docs say configuring a proxy requires `write_app_proxy`; a Sept 2026 community test
(community.shopify.dev t/37388) shows proxies work without it and that the grant changes
nothing observable. We declare it optional and request it with the Publish click, so merchants
who use the page consent to it and nobody else is prompted. Publishing requires the grant.

## Shop record (metafield `frak.ambassador_page`, type json)

```ts
type AmbassadorPageRecordV2 = {
    v: 2;
    published: boolean;
    publishedAt?: string;            // first publish, ISO
    // Every menu item pointing at the page: the link we added and the links a
    // switch repointed from the old page. All removed on hide.
    menuLinks?: Array<{ menuId: string; itemId: string }>;
    // handle: from the v1 url (or the page) when known.
    legacy?: { pageId: string; handle?: string; redirectId?: string; switchedAt: string };
};
type AmbassadorPageRecordV1 = { pageId: string; url: string | null; standardLayoutKept?: boolean };
```

Liquid shows the page only when `v == 2 and published`. A v1 record means the merchant has an
old `/pages/` ambassador page that keeps working until they switch.

- Menu state on the screen: `added` while any recorded link is still in a menu, `missing` when
  links are recorded but none is left, `none` when none is recorded or the menu permission is
  not granted. Publish and "Add to my menu" add no link while a recorded one is still present.
- The switch's first write already holds `legacy` (page id, handle from the v1 url, time); if it
  fails nothing on the shop is touched. Later steps only refine it (`redirectId`, `menuLinks`).
- A failed record, scope or menu read never reads as "no page": the status is unknown, the
  action fails with `failed`, and no link is added.

## Merchant experience

Entry points: a new **Ambassador page** nav item (`/app/ambassador`, between Appearance and
Funding) and the Home "Finish your setup" card. The Appearance section and the
`/app/ambassador-guide` route go away. Works on every theme generation and in the Shopify
mobile app; no theme-editor step.

### Screen states

1. **Ready to publish** (no record, or v2 never published)
   - One-line pitch, three outcome bullets (your store's look, full width with nothing to set
     up in the theme, text and photo editable in the Frak dashboard), and the page address.
   - Checkbox, ticked by default: add a link to the main menu. Its label shows the exact title
     the link gets ("Become an ambassador" / "Devenir ambassadeur", from the admin language).
   - A subdued line just above the button saying Shopify will ask for permission.
   - Primary **Publish my page**. One `shopify.scopes.request` for `write_app_proxy` (+
     `write_online_store_navigation` when the box is ticked), skipped when already granted.
   - Declined permission: a toast only ("Nothing was changed…"); nothing is written.
   - Menu link that could not be added after publishing: a non-error toast; the page is live.
2. **Live** (`published`)
   - "Published" badge (also on a password-protected store), the address, **See my page** (new
     tab), **Copy address**.
   - Menu row: in the main menu / link removed → **Add the link back** / none → **Add to my
     menu**, with a subdued permission line while the menu permission is not granted.
   - **Edit the text and photo** → business dashboard customise screen (SSO URL); the section is
     hidden when that URL cannot be built.
   - Health banners, each with one action: Frak switched off in the theme (embed deep link),
     no active campaign (→ Campaigns), page not found at the address (Settings > Apps), store
     password-protected (info only). The storefront probe caches only a `live` result (60s), so
     a fixed problem clears on the next visit.
   - **Hide my page** (with a confirmation): the address shows "Page not found" in the theme and
     every recorded menu link is removed. Publish again at any time.
3. **Hidden** (v2, `published: false`, `publishedAt` set): same as 1, primary **Publish again**.
4. **Old page** (v1 record): a section with heading and body offering **Switch to the
   full-width page**, the same "add a link to my main menu" checkbox (ticked by default), and a
   link to the current page. Switching requests proxy + navigation + page scopes, then: write
   the v2 record with `legacy`, re-point every menu link to the old page, rename and hide the
   old page to `<handle>-previous-<id>` (never delete), redirect `/pages/<old-handle>` to the
   proxy path (an existing redirect counts only if it already targets the proxy path), add a
   main-menu link only when no link was re-pointed and the box is ticked, then record the
   links. A partial re-point warns and records what changed.

Home card: shown while the page was never published (or a v1 page awaits the switch), one
sentence and one secondary button to the screen. Hidden once published.

### Copy rules

Outcome-first, no Shopify jargon (no "template", "app proxy", "block"), French written for
French merchants (no English Shopify labels). All strings in `app/i18n/locales/{en,fr}`.

## Storefront component

`useHostTheme` prefers the hidden `[data-frak-amb-ref]` headings the Liquid file renders: a
proxy page has no theme heading of its own to sample (31/32 themes in the lab).

## Out of scope (follow-ups)

- Sending the page URL to the backend for the frak.id brand CTA (open item from FRA-329).
- Merchant-editable SEO title/description; undo of the switch; a CDN-side failure page.
- Menu link title in the shop's primary language: it follows the admin language until the app
  can read the primary locale (`shopLocales` needs `read_locales` or `read_markets_home`).
- Component polish from the storefront report: loading skeleton, hero height cap, dark-theme
  reward tag colour, no impressions in theme-editor design mode.

## Verification still needed on a dev store

1. Proxy route live with `write_app_proxy` only optional; scope prompt wording.
2. Liquid render on Dawn, Horizon, a paid theme and a vintage theme with the built component.
3. `page_title` / `page_description` picked up by the theme head.
4. Menu edit keeps translations; HTTP menu item with a relative `/apps/...` URL.
5. Switch: redirect fires for the renamed old handle; menu links re-pointed.
6. CDN path, by pointing the dev app's proxy URL at `sdk-dev.frak.id` once.
