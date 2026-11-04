# Frak referral demo

An installable, fully offline prototype of the Frak referral flow, for demos on a phone, a tablet or
a projector. Nothing talks to a backend: the merchant site, Safari, Instagram, the Frak sharing page
and the Frak wallet are all mocked, in French (default) and English.

## The story

| Scenario | Persona | Path |
| --- | --- | --- |
| 1 | **Léa**, the referrer | `maisonlune.fr` → product page → cart → Apple Pay → thank-you page with the Frak post-purchase card → Frak sharing page → iOS share sheet → Instagram story → back on the thank-you page, the card offers to collect → Frak install page → App Store → onboarding → passkey → wallet, **10 € pending** |
| 2 | **Chloé**, the referee | Instagram feed → Léa's story → link sticker → product page with the Frak referral banner → express Apple Pay → thank-you card with **5 €** → Safari, `wallet.frak.id`: Face ID, no app to install → web wallet, **5 € collected** → first transfer to her bank: Monerium checks her ID on the spot → amount, recap, Face ID → her bank app shows **+5,00 € from FRAK LABS** |
| Finale | both | Léa is notified that Chloé ordered and her 10 € become collectable; both wallets side by side, Chloé's showing the transfer |

## Run it

```bash
bun run --cwd example/referral-demo dev       # http://localhost:3014 (also on the LAN, --host)
bun run --cwd example/referral-demo build     # dist/, relative paths, works from any folder
bun run --cwd example/referral-demo preview   # serve the build; the service worker only runs here
```

Deployed by `bun run deploy:example` to `referral-demo.frak-labs.com` (`infra/example.ts`).

## Install it on a phone

Open the deployed URL once while online. When the launcher shows **Prête hors-ligne / Ready offline**,
every asset is cached: install it (iOS: Share → *Add to Home Screen*; Android/desktop Chrome: the
*Install the demo* button) and it runs in airplane mode. A new deploy is picked up on the next
launch with network; the presenter panel offers a reload when it lands.

## Presenting

- On a laptop or tablet the phone is drawn in a frame; on wide screens the presenter panel sits next
  to it with the current step, what to say, and every step to jump to. The finale splits into the
  two personas' phones.
- On a phone the demo runs edge to edge; the panel opens from the small tab on the left edge.
- Keys (and presentation clickers): `→`/`PageDown` next, `←`/`PageUp` previous, `Home` restart,
  `L` language, `F` frame mode (auto / frame / full screen).
- Tapping the obvious primary action on each screen moves the story forward; state persists across
  reloads.

## How it is built

- `src/core/steps.tsx` is the script: every step names its persona, its chrome (Safari, Instagram's
  in-app browser, a native app or the stage) and the screen it renders. `src/core/store.ts` holds the
  current step (persisted), language and frame mode.
- `src/surfaces/{merchant,social,wallet}` implement the screens behind the typed props in
  `src/surfaces/contracts.ts`; `src/art` is the inline-SVG illustration kit (`src/art/contracts.ts`).
  Frak surfaces use `@frak-labs/design-system` and mirror the real wallet, SDK components and sharing
  page; nothing imports `wallet-shared`.
- `src/shell` draws the phone, status bar, browser chromes, transitions and presenter controls;
  `src/stage` holds the launcher, persona intros and finale. System sheets (share sheet, Apple Pay,
  App Store) render through `src/shell/DeviceOverlay` so they cover the browser toolbars, as on iOS.
- `vite-plugins/offlineServiceWorker.ts` emits `sw.js`, precaching every built file under a cache name
  hashed from their content.
- `bun run --cwd example/referral-demo snap -- --steps referrer.thankYou,finale [--lang en] [--desk]`
  screenshots steps into `/tmp/referral-demo-snaps` for visual review.
- `bun run --cwd example/referral-demo walk [-- --lang en] [--desk]` plays the whole demo with
  on-screen taps only, failing on a stuck or skipped step, a console error or a failed request.
