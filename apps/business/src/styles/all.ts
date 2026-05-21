// Vanilla Extract globals entry — replaces the legacy all.css @import chain.
// Order matters: design-system theme injects DS CSS vars first, then app
// globals + page-scoped overrides.
import "@frak-labs/design-system/theme";
import "./global.css";
import "./authentication.css";
import "./restricted.css";
