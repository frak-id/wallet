/**
 * Iframe entry point — pure TS, no Preact, no i18next, no react-query.
 *
 * Runs synchronously on iframe load, in this exact order:
 *  1. BigInt serialization polyfill (required by zustand persist).
 *  2. Analytics init (OpenPanel + crashlytics globals).
 *  3. `bootstrap()` — creates the RPC listener, wires every handler,
 *     emits `iframeLifecycle: "connected"`, and arms the `?preload=...`
 *     hint. The Preact UI runtime is only loaded later, lazily, when a
 *     partner site triggers a UI-displaying RPC.
 */

import { initAnalytics } from "@frak-labs/wallet-shared/common/analytics";
import { setupBigIntSerialization } from "@frak-labs/wallet-shared/polyfills/bigint-serialization";
import { bootstrap } from "@/bootstrap";

// Setup BigInt serialization polyfill
setupBigIntSerialization();

// Initialise analytics (OpenPanel + crashlytics globals) once at bootstrap.
// Side-effect was previously triggered by importing the analytics module;
// the explicit call keeps tree-shaking honest in the listener bundle.
initAnalytics();

// Wire the RPC listener and signal readiness to the SDK.
bootstrap();
