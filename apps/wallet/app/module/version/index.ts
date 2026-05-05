/**
 * Version module — soft + hard app-update gating for the wallet (Tauri only).
 *
 * Soft updates: `frak-updater` Tauri plugin (iTunes Lookup on iOS, Play
 * Core FLEXIBLE flow on Android). Hard updates: backend `minVersion` floor
 * exposed at `GET /common/version`.
 */
export { VersionGate } from "./component/VersionGate";
export { useVersionGate } from "./hook/useVersionGate";
