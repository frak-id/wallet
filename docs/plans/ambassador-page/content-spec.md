---
title: Ambassador Page — Content Spec
type: spec
date: 2026-09-22
topic: ambassador-page
status: active
---

# Ambassador Page — Content Spec

## What this pins

`example/vanilla-js/frak-ambassador-inject.js` is the **canonical content** of the
ambassador page. Copy, heading structure, region order, token names and FAQ wording
are settled there first; the SDK component is a port of it, not a parallel draft.

This note owns **content**. It does not own product behaviour or implementation
mechanism — those belong to
`docs/plans/2026-09-15-1424-feat-ambassador-page-component-plan.md` (R1–R18,
KTD1–KTD8). Where this note and that plan disagree, the plan wins on behaviour and
this note wins on wording. One discrepancy is open, recorded below.

## Why the snippet and not the component

The snippet is iterated against real merchant storefronts by pasting it into a
console, so a copy change costs one paste instead of a build, a publish and a CDN
cache. That loop is the reason the content is good. It stops being the source the
day `<frak-ambassador>` ships — at which point this file gets a closing entry and
`sdk/components` takes over.

## Content contract

Measured on the canon file at the time of writing: 1 `h1`, 6 `h2`, 6 `h3`,
7 `section`s, 5 FAQ pairs, 6 merchant-brand mentions, 7 "Frak" mentions, and
roughly 540 visible words — word count is tokenizer-dependent and ±20 is noise,
so treat it as scale, not a threshold.

### Tokens

Five tokens; nothing else is substituted. `{BRAND}`, `{INSTALL_URL}`, `{SHOP_URL}`
and `{FRAK_URL}` are replaced on the HTML string before parse. `{REWARD}` is
replaced in the DOM, because it alone has a removal path.

| Token | Snippet source | Port source |
|---|---|---|
| `{BRAND}` | `FrakSetup.config.metadata.name` → `og:site_name` → hostname minus `www.` | SDK config metadata |
| `{REWARD}` | `DEMO.reward` / `DEMO.rewardReferee` | resolved campaign reward (KTD6) |
| `{INSTALL_URL}` | `https://wallet.frak.id/install` | `buildWalletInstallUrl()` (KTD2) |
| `{SHOP_URL}` | `` `${location.origin}/` `` | merchant prop, defaulting to origin |
| `{FRAK_URL}` | `https://frak.id` | same constant |

**The hero art is chosen, never sniffed.** It comes from `DEMO.heroImage` or the
`image` knob (`__frakAmb.image(url)` → `--frak-amb-image` on `.frak-art`).

**Absent both, the frame goes with the image.** Removing only the `<img>` leaves
`.frak-art`'s `aspect-ratio:4/5` reserving a panel of empty tint taller than the
copy beside it — measured on loulenn and saintlazare, where it read as a broken
layout and pushed the reward tag out of the first viewport. `.frak-art-empty`
drops the ratio and un-absolutes `.frak-tag`, collapsing the frame to the reward
card; the `image` knob removes the class when art arrives later. So the three
states are art, no art, and never a void.

Resolving it automatically from the page's `og:image` was tried on 2026-09-22 and
reverted the same day. On a product page — which is where the snippet is pasted
for a demo — `og:image` is the *product*, so saintlazare rendered a cut-out
backpack under "Devenez ambassadeur", beside copy inviting people to join the
brand's ambassadors, with `alt="Ambassadrices et ambassadeurs {BRAND}"` describing
it. Worse, the brand most in need of art had none to sniff: saintlazare's home
page carries no `og:image` at all, only its product pages do. An automatic source
that picks the wrong kind of image where it fires and nothing where it does not is
not a fallback.

The hero wants people, not products — the `alt` says so, and so does the
`.frak-faces` line under the CTA. No storefront exposes that reliably, which is
precisely why R13 makes every image merchant-set.

**The QR encodes the install URL, and a QR that does not decode is a defect, not a
decoration.** The one that shipped until 2026-09-22 was unscannable: its three
finder patterns were drawn as `M0 0h7v7H0z M2 2h3v3H2z`, two clockwise subpaths
that the default nonzero fill rule unions into a solid 7×7 block, so no scanner
could even locate the symbol — and it carried no quiet zone. Any change to it must
be verified by decoding a render, not by looking at it. Check: render the `<svg>`
straight out of the template and decode; it must return
`https://wallet.frak.id/install`.

**No amount is ever written in the markup.** `DEMO` exists so the demo renders a
number while the template carries only a token. A literal amount in a template is
an amount that ships.

**A reward that will not resolve falls back to wording, never to a gap.** Plan
AE2 requires all regions to render with *reward-free wording*, so a node whose
sentence needs a subject carries `data-frak-no-reward` ("Une récompense") and
swaps to it; only a node whose whole sentence lives inside the token — the
referee pill — is removed. Removing the others instead leaves `<h2>pour vous,
à chaque ami qui commande.</h2>`, which is exactly the subject-less heading the
reward path exists to avoid.

The merchant name is HTML-escaped and substituted through a replacement
*function*: it reaches an `alt` attribute, and a name containing `$&` would
otherwise be read as a back-reference.

### Rules the port must not regress

1. The merchant's brand appears six times in visible text — `h1`, hero lede, two
   `h2`s, the "C'est quoi Frak ?" answer and the closing shop link — plus the hero
   image `alt`, which is an attribute and so does not count toward the six.
   Brand-to-Frak ratio stays near 1:1. This page exists to rank for the merchant's
   brand; generic copy ranks for nothing.
   **Every one of them is `{BRAND}`. A merchant name must never appear as a
   literal.** The FAQ answer held a hardcoded "Vanilla JS" through the whole
   11-brand sweep, naming the demo fixture on ten real storefronts and shipping
   that name inside the FAQPage schema. A `{TOKEN}`-leak check does not catch
   this; assert the absence of the demo name instead.
2. Every FAQ answer stays a direct answer to its question. It is the only part of
   the page an LLM can quote verbatim, and the source the FAQPage schema is built
   from.
3. Both store badges point at one destination (plan KTD1/R15), as real anchors
   with a real `href`. The `role="link" tabindex="0"` workaround existed only to
   make an hrefless anchor reachable; it is gone and must not return. This does
   not contradict plan AE6: the snippet resolves its URL from a constant and is
   never hrefless, while the component resolves it asynchronously, and AE6/KTD8
   cover the window before it lands. Rendering KTD2's credential-free `?m=`
   fallback immediately and upgrading in place would close that window — worth
   considering at port time, not decided here.
   **The badge art is Apple's and Google's own, inlined unmodified, and must never
   be redrawn.** Until 2026-09-22 the page carried a hand-built lockup — a redrawn
   glyph beside our own "Télécharger dans / App Store" text in a black pill — which
   both vendors' guidelines forbid, and whose Play triangle rendered with a white
   seam and a detached yellow wedge. Sources: Apple's Marketing Tools badge API
   (`toolbox.marketingtools.apple.com`, localized SVG) and Google's own badge PNG,
   trimmed of its transparent padding so the two share a 40px height. Because the
   art is now an image, the accessible name lives on the anchor's `aria-label` —
   the badge text is no longer selectable text, so dropping that label makes the
   link nameless.
   The 22-brand sweep's "badge lockup black/white" row below predates this and
   describes the lockup it replaced; a re-sweep should assert the official art
   renders at a matching height instead.
4. The page links out: two badges to the wallet install page, one CTA back to the
   merchant's shop, and two `.frak-link` anchors to `frak.id` — the "Frak" in the
   "C'est quoi Frak ?" answer, and the "propulsé par Frak" attribution. An
   ambassador page that links nowhere is a crawl dead end.
   Both wrap words that were already there, so neither the Frak mention count nor
   the FAQPage answer text moves; a diff that moves either has flattened them.
   **They are markup inside otherwise-plain copy, which is the shape a port drops
   silently** — `ComponentCopy` entries are plain strings and an anchor cannot
   survive as one. Give them their own copy keys or render the link around a
   token; do not flatten them to text. `.frak-link` sets `text-decoration:
   underline` on purpose: a merchant theme that strips underlines would otherwise
   leave a link distinguishable by colour alone, against body text it inherits
   its colour from.
5. `lang` is pinned on the page root. The copy is French; the host document
   frequently is not — 3 of 22 swept merchant pages declare `en`/`en-US` while
   serving French. **The pin is snippet-only.** The canon is French because the
   snippet is pasted by hand on French storefronts; the component follows the
   *merchant's* language (plan R19) via `useLang()` — SDK/backend `lang`, then
   `<html lang>`, then the browser, then `en` — and sets the root `lang` to
   whatever that resolves to. Porting the literal `lang="fr"` would hardcode a
   French page for every English merchant.
6. Headings are self-contained sentences. The reward amount is a `span` inside its
   `h2`, not a sibling `p` — a heading that starts mid-sentence has no subject.
7. `cashback`, one word, matching frak.id and `/brands/[slug]`.

## SEO ownership boundary — settled

Settled 2026-09-22: **the merchant page receives the visit; it does not compete for
the search.** `frak.id/brands/[slug]` ranks, then hands off to it.

```text
Google "devenir ambassadeur de {brand}"
  └─► frak.id/brands/{slug}              ranking surface — SSR, sitemapped, schema
        └─ CTA ─► {merchant}/ambassadeur  the visit lands here
                    └─► sharing overlay   the conversion, in place
```

**Traffic flows frak.id → merchant, one way.** The merchant page redirects nowhere
and links to no frak.id ranking surface — `/brands/` appears nowhere in it. Its
only outbound links are the two store badges to `wallet.frak.id/install`, the
closing CTA back to the merchant's own shop, and two `frak.id` text links that open
in a new tab for trust rather than traffic; the two share CTAs do not navigate at
all. Read "destination" as terminus, never as redirect target. The plan carries the
matching decision entry.

Two facts bound this, and both are worth re-reading before anyone reopens it:

- Content generated by JS is visible to Googlebot after a render delay and to
  essentially nothing else. GPTBot, ClaudeBot, PerplexityBot and every social
  scraper read the server response only.
- `frak.id/brands/[slug]` already targets "devenir ambassadeur de {brand}" with a
  fully server-rendered, sitemapped, schema-bearing page — **and its primary CTA
  already routes into the merchant's domain**, as `{website}?frakAction=share`
  (`ambassadorUrl`, `packages/landing/src/data/brands.ts` in the `static-web`
  repo). The two were never rivals for the conversion; they were a funnel missing
  its middle. What is wrong is the destination: that CTA lands on the merchant
  *homepage* with the sharing overlay opening over it, while the page built to
  answer exactly that click sits unlinked.

What follows from the decision:

- **The FAQPage injection is deleted, not ported.** It exists today only to give
  the port an object shape to render server-side; under this decision there is
  nothing to render it into. Deleting it also removes the last thing on the page
  implying an SEO claim nobody holds. Until that lands, `mountFaqSchema` and the
  FAQPage rows in the verification table below still describe the snippet as it
  stands — they retire with it.
- `<title>`, meta description, canonical and `hreflang` stay outside the
  component's reach — they always were — but they are now the *merchant's* concern
  for their own brand traffic, not a gap this plan waits on. Nothing here is
  blocked on plugin templates any more.
- **Not optimising is not suppressing.** The page stays an ordinary indexable page
  on the merchant's site; no `noindex`. If it ranks for their own brand that is
  their win, and the goal this feature started from — it is simply not engineered
  for, nor measured.
- The landing-side follow-up — letting `frak.id/brands/[slug]` point its CTA at a
  merchant's real ambassador page when one is configured, falling back to today's
  `?frakAction=share` when not — is `static-web` work and is not covered by this
  plan.

Reopening this is a real option, not a dead end. The trigger is evidence: a
merchant page ranking for their brand + "ambassadeur" unaided means the
brand-navigational intent is worth owning, and that is when server-rendered plugin
templates earn their cost. Before that they would be built on a hypothesis, and
against `SEO_CONTENT_IDEAS.md`'s own pSEO gate (three uniqueness vectors per page)
which this page meets with the brand token and the premise section and little
else — the steps, payout cards and FAQ read near-identically on every merchant.

## Seven regions — settled

Settled 2026-09-22: the page is seven regions, not six. The plan was updated to
match — R5, R12, AE2, the region diagram and U4 — with a superseding decision entry
recording why.

| # | Region | Heading in canon |
|---|---|---|
| 1 | Hero | Devenez ambassadeur de {BRAND}. |
| 2 | Reward amount | {REWARD} pour vous, à chaque ami qui commande. |
| 3 | **Recommendation premise** | Vous recommandez déjà {BRAND}. Il manque juste le lien. |
| 4 | Three-step explainer | Comment devenir ambassadeur {BRAND} |
| 5 | Payout reassurance cards | Comment vous êtes payé |
| 6 | Store download block | Suivez vos gains en temps réel |
| 7 | FAQ | Questions fréquentes |

The seventh — the premise, at position 3 — was added to the canon in `8374beba7`
after the six-region list was recorded. It is kept because it is the least
boilerplate-like copy on the page: the steps, the payout cards and the FAQ read
near-identically on every merchant's ambassador page, and this section is the one
that does not. Cut it and the page has no uniqueness vector left beyond the brand
token — which is the whole exposure described under the SEO boundary above.

## The demo variants are not canon

`example/vanilla-js/ambassador-{a,b,c,d,f,h,j,k,k-min,l}.html` are the ten design
directions built and reviewed on 2026-09-21. They share `src/ambassador.ts` for
behaviour — that file holds no copy — and each carries its own. K won.

They are exploration artifacts, kept as a record of what was compared. They were
deliberately **not** updated with the fixes applied to the canon file, so every one
of them still shows 2 brand mentions and hrefless store badges (`src/ambassador.ts`
never sets an `href`). Do not read `ambassador-k.html` as the current content and do
not port from it.

Now that K is settled and the canon lives in the snippet, the variants have served
their purpose. Retiring them is a pending cleanup, not a decision this note takes.

## Branch divergence — read before rebasing

`feat/ambassador-page-component` carries its own content in
`sdk/components/src/i18n/defaults.ts`, and it is **not** this spec:

| | canon (`dev`) | branch defaults |
|---|---|---|
| Visible words | 542 | 89 |
| Merchant brand mentions | 6 | 0 |
| FAQ pairs | 5 | 0 |
| Payout reassurance cards | 3 | 0 |
| Step titles | `h3` | `p` |

Nothing flags this at merge time. `defaults.ts` is a source file, the canon is an
HTML string inside an example, and the two never touch — so a rebase merges cleanly
and the 89-word version silently becomes what ships. The plan already settled that
the branch is revived rather than restarted; reviving the code does not mean
reviving its copy.

**Decide explicitly at port time whether the branch's `ambassador` copy block is
discarded wholesale.** The recommendation here is that it is.

Known gaps in the branch, on top of the copy: step titles are `p` not headings, so
the explainer has no heading at all; `alt=""` is hardcoded on the hero and step
images with no prop to set it; both badges take `href={installUrl}` which is
`undefined` until an async resolve lands, reproducing the hrefless anchor this spec
just removed.

## English has no canon source

The canon is French only. The component ships `en` and `fr` (plan R20), so the
English defaults have to come from somewhere, and this file is not it.

They must be **translated from the canon at port time, not authored separately**.
The branch is the counter-example already: its `en` and `fr` ambassador blocks
were written as an independent 89-word pair rather than derived from the 542-word
canon, which is how the two ended up with no FAQ, no payout cards and no merchant
name in either language.

Nothing enforces this. `Record<Language, ComponentCopy>` fails a *missing* key,
never a *stale* one, so an English default left behind when the French canon
moves is silent — the same shape as the branch divergence below and the stale
"Vanilla JS" literal above. When canon copy changes, the English default is part
of that change, not a follow-up.

## Site chrome is never replaced (snippet-only)

The snippet picks a host — `#main`, then `main`, then `<body>` — and hides that
host's children. On a theme shipping neither (Elementor/Hello, measured on
accalmie 2026-09-22) it lands on `<body>`, where the header and footer are
siblings of the content rather than of the host, so hiding every sibling took the
whole site with it. `CHROME` now exempts `header, footer, [role=banner],
[role=contentinfo], .skip-link` from hiding, and `anchorFor` places the block
where the content began — the first hidden node following the site banner, or
the first hidden node when there is none — rather than appending, so it cannot
land under a footer that was just kept.

`nav` is deliberately **not** exempt: a nav inside the content area is content
(loulenn's carousel pagination), and site nav lives inside `<header>`.

None of this transfers to the port. The component renders inside the
`<frak-ambassador>` element on a page the merchant builds (plan R1), so it never
chooses a host and never hides anything.

## Verification

No test harness exists in `example/vanilla-js` and none was added — it is a demo
package. Two layers, both run 2026-09-22.

**jsdom:** happy path (6 brand mentions, 5 FAQPage entries, 2 badges sharing one
href, no token leaked) · no-reward (reward-free wording, no invented amount,
7 regions intact) · hero image (kept, alt carries brand) · brand fallback
(hostname, `www.` stripped) · brand escaping (`$&`, `$$`, quotes and markup in
the name) · `<main>` theme · body fallback · Divi nested chrome · harmo's wrapped
footer · `frak-*` never hidden · teardown across a descended tree.

**Assert the rendered text of every heading, in both reward states.** Four
defects in this file were text, not structure, and every structural check passed
over all of them: a glued `7,20 €pour vous`, a hardcoded "Vanilla JS" that
survived an 11-brand sweep, a subject-less no-reward heading, and a glued hero
tag. A token-leak boolean and a region count cannot see any of them. The
standing checks are therefore: no heading begins with `pour|de|à|et|,`; no
heading contains the demo brand; and both reward states are exercised.

**Live storefronts: all 11 brands on `frak.id/brands`, product page and homepage,
22 runs.** jsdom has no cascade and no layout, so it proves nothing about the
sampler or the host cascade; these do.

| Invariant | Result |
|---|---|
| mounted | 22/22 |
| site chrome survived | 22/22 |
| badge lockup black/white + real `href` | 22/22 |
| `a.frak-cta` paints as `button.frak-cta` | 22/22 |
| FAQPage emitted with 5 entries | 22/22 |
| no `{TOKEN}` leaked into text | 22/22 |
| no horizontal overflow | 22/22 |

Mount host: `<main>` 14 · `body` fallback 5 · content wrapper 2 · `section#main` 1.
The `body` fallback is real and common — roughly a quarter of runs — which is why
the chrome rule above is load-bearing rather than defensive.

Three things this settled:

- **KTD8's trap is gone.** The badges keep their lockup on the PrestaShop store
  where `a:not([href]):not([tabindex])` was measured forcing `color: inherit`;
  a real `href` stops that selector matching at all.
- **The anchor-cascade risk did not materialise.** Putting `.frak-cta` on an
  `<a>` for the first time paints identically to the `<button>` on all 22.
- **`{BRAND}` never reached the hostname fallback.** Every Frak merchant carries
  the SDK, so `FrakSetup.config.metadata.name` resolves first — including on
  oolution and saintlazare, whose pages ship no `og:site_name` at all. The
  hostname tier fired zero times in production; keep it, but it is a backstop
  for a page without the SDK, not a path merchants travel.

The `lang="fr"` pin earns its keep on 3 of 22 pages, which declare `en-US` or
`en` while serving French copy.

`bunx biome check` passes on the file.

When the port lands, the content cases become real ones in
`sdk/components/src/components/Ambassador/Ambassador.test.tsx`. The host/chrome
cases do not port — see the section above.
