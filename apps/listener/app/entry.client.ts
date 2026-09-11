/**
 * Iframe entry point — pure TS, no Preact, no i18next, no react-query.
 * The Preact UI runtime is only loaded later, lazily, when a partner site
 * triggers a UI-displaying RPC.
 */

import { initAnalytics } from "@frak-labs/wallet-shared/common/analytics";
import { setupBigIntSerialization } from "@frak-labs/wallet-shared/polyfills/bigint-serialization";
import { bootstrap } from "@/bootstrap";

// Required by zustand persist.
setupBigIntSerialization();

initAnalytics();

bootstrap();
