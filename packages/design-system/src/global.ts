// VE global styles — coexists with existing CSS cascade
// Import design-system theme to inject :root VE vars
import "./theme.css.ts";

// Import global page-level reset (`* { margin: 0 }`, `html`, `ul`, …).
// Wallet app only — must NOT be imported from SDK bundles.
import "./reset-globals.css.ts";

// Import per-element scoped resets (safe for any consumer).
import "./reset.css.ts";

// Import global defaults
import "./defaults.css.js";
