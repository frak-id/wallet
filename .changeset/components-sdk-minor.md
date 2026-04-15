---
"@frak-labs/components": minor
---

### New features

- **`Banner` component** — New web component for displaying referral reward banners and in-app browser escape prompts. Supports placement-based customization, interaction type filtering, and preview mode for theme editors.
- **`PostPurchase` component** — New web component for post-checkout referral sharing with referrer/referee variants, purchase tracking fallback, and reward display with `{REWARD}` template placeholders.
- **New hooks**: `useGlobalComponents` (manages global component registration), `useLightDomStyles` (injects styles into the Light DOM), `usePlacement` (resolves backend-driven placement config).
- **Enhanced `useReward`** — Extended with richer reward data and interaction type filtering.
- **Enhanced `useClientReady`** — Improved readiness detection with backend config awareness.
- **New utilities**: `embeddedWallet` (embedded wallet helpers), `sharedCss` (shared CSS-in-TS styles), `sharingPage` (sharing page integration), `styleManager` (Light DOM style injection), `onDocumentReady` (DOM readiness helper).
- **`GiftIcon` SVG component** added.
