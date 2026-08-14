/**
 * Version module — soft + hard app-update gating for the wallet (Tauri only).
 *
 * Soft updates: `frak-updater` Tauri plugin (iTunes Lookup on iOS, Play
 * Core FLEXIBLE flow on Android). Hard updates: backend `minVersion` floor
 * exposed at `GET /common/version`. OTA: CrabNebula `ota-updater` plugin
 * swaps the web assets without a store release.
 */
export { VersionGate } from "./component/VersionGate";
