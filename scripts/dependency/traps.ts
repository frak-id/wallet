/**
 * Repo knowledge the collectors attach to items: the gated floors an upgrade
 * can cross, and the rules that make a specific bump cost more here than its
 * changelog suggests.
 */
import type { Flag, Floor } from "./types";

export const FLOORS: Floor[] = [
    {
        id: "browser-es",
        value: "es2022 / safari15.4",
        gate: "bun run check:es-output",
        why: "BROWSER_TARGET_ECMA in packages/dev-tooling/src/es-version.ts. A bundler or transpiler bump that emits an above-floor construct fails this gate, and for vite apps assertBundleEsVersion fails the build.",
    },
    {
        id: "cdn-bundle",
        value: "EAGER_JS_BUDGET_GZIP (apps/wallet/vite.standalone.config.ts)",
        gate: "bun run --cwd apps/wallet build",
        why: "sharing.html and install.html are opened as full-page loads by the web, iOS and Android SDKs. A dependency that grows the eager closure fails the build.",
    },
    {
        id: "cdn-parse-unit",
        value: "deps.alwaysBundle: [/.*/]",
        gate: "bun run check:es-output",
        why: "The CDN bundles are one parse unit, so a single above-floor construct anywhere in the dependency graph makes the whole bundle unparseable.",
    },
    {
        id: "ios-app",
        value: "16.0",
        gate: "bun run check:ios-floor",
        why: "Passkeys are the only entry path into the Tauri wallet and ASAuthorizationPlatformPublicKeyCredential needs iOS 16. Twelve sites move as a set, seven of them Tauri plugin `ios/Package.swift` manifests.",
    },
    {
        id: "bun",
        value: "packageManager in the root package.json",
        gate: "bun run check:bun-version",
        why: "The truth for seven Dockerfile ARG BUN_VERSION sites and for what setup-bun resolves in CI. Drift is already gated; only the upstream delta is a finding.",
    },
];

/** A workflow referencing any of these signs or publishes a release artifact. */
export const PUBLISH_SECRET =
    /secrets\.(NPM_TOKEN|CENTRAL_PORTAL_\w+|ORG_GRADLE_PROJECT_SIGNING\w+|ANDROID_KEY\w+|APPSTORE_\w+|GOOGLE_PLAY_\w+|IOS_MIRROR_\w+)/;

type Trap = { match: RegExp; flags?: Flag[]; why: string };

/**
 * Matched against an item name. First match wins, so order narrow before wide.
 * Only rules that change the upgrade decision belong here.
 */
const TRAPS: Trap[] = [
    {
        match: /^@typescript\/native$/,
        why: "The TS 7 compiler, consumed only by the `typecheck` scripts. It is deliberately paired with `typescript` below, not a replacement for it.",
    },
    {
        match: /^typescript$/,
        why: "TS 6 stays alongside @typescript/native (TS 7) on purpose: tsdown, rolldown-plugin-dts and tsserver peer on TS <= 6. Do not unify them.",
    },
    {
        match: /^es-check$/,
        flags: ["floor-coupled"],
        why: "Pinned exact rather than caret. 9.7.1 added Uint8ArrayFromHex detection which fires on @noble/hashes' guarded feature test.",
    },
    {
        match: /^(vite|rolldown|tsdown|@rolldown\/plugin-node-polyfills)$/,
        flags: ["floor-coupled"],
        why: "Decides what syntax is emitted. A bump can put an above-floor construct into a shipped chunk, which only check:es-output and assertBundleEsVersion catch.",
    },
    {
        match: /^(@vitejs\/plugin-react|@preact\/preset-vite|preact)$/,
        flags: ["floor-coupled"],
        why: "In the eager closure of sharing.html and install.html, which carry a gzip budget enforced at build time.",
    },
    {
        match: /^@vanilla-extract\//,
        flags: ["floor-coupled"],
        why: "Every style in the repo is a .css.ts compiled at build time; the integration package runs inside the bundler.",
    },
    {
        match: /^@pulumi\/kubernetes$/,
        flags: ["paired"],
        why: "Must move in lockstep with the `kubernetes` entry in this repo's own sst.config.ts `providers` block, which SST never bumps from package.json.",
    },
    {
        match: /^sst$/,
        flags: ["paired"],
        why: "Pinned exact in the catalog. SST carries its own Pulumi provider plugin versions, which package.json never bumps.",
    },
    {
        match: /^@tanstack\/(react-)?(query|router)/,
        why: "Pinned exact and installed as a set — the query and router families each have to move together across every workspace.",
    },
    {
        match: /^bun-types$/,
        why: "Cannot be dropped from the four apps or wallet-shared: their @backend-* path mappings pull real backend source (Bun.serve, Bun.password, bun:jsc) into each app's compilation.",
    },
    {
        match: /^(react|react-dom|@types\/react(-dom)?)$/,
        why: "@types/react and @types/react-dom are pinned exact against the caret-ranged runtime; move all four together.",
    },
    {
        match: /^(tauri|tauri-build|tauri-utils|tauri-codegen)$/,
        flags: ["paired"],
        why: "The Tauri crates are released as a set and share an internal ABI; `tauri` and `tauri-build` in particular must carry the same version or the build script and the runtime disagree.",
    },
    {
        match: /^(wry|tao)$/,
        flags: ["floor-coupled"],
        why: "Tauri's webview and windowing layer. A bump moves the WKWebView and WebView2 surface under the wallet, which is where the iOS floor and the passkey path live.",
    },
    {
        match: /^tauri-plugin-/,
        why: "Seven of these are first-party crates under src-tauri/plugins consumed by path, not from crates.io. A published crate of the same name is a different dependency.",
    },
];

export function trapFor(name: string): { trap?: string; flags: Flag[] } {
    const hit = TRAPS.find((entry) => entry.match.test(name));
    return hit ? { trap: hit.why, flags: hit.flags ?? [] } : { flags: [] };
}
