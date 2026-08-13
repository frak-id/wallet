# Cross-platform parity & native↔web contract — audit

Worktree: `/home/dev/wallet-audit` @ `c0a0cec` (read-only). No toolchain; every claim below is from reading source.

## Summary

The two things that are *pinned by a shared corpus* — the FrakContext v2 binary codec and the identity proof
layout — are genuinely three-way byte-identical, and both native suites really do consume both fixture files
(`ProofCodecTest.kt:25`, `FrakContextCodecTest.kt:15`, `ProofCodecTests.swift:29`, `FrakContextCodecTests.swift:11`).
That part is alpha-ready and register §9.4's implied "Kotlin doesn't consume golden-proofs" worry is **false**.

Everything *around* the codec — URL query editing, percent-decoding, base64url tolerance, attribution merge —
is hand-ported three ways with no shared corpus, and the three implementations disagree on at least eight
inputs I can name concretely. The single worst thing is **F1: `FrakContextManager.update()` re-serialises the
merchant's entire query string**, so the web SDK and both native SDKs emit byte-different share links for the
same input, and `%20` silently becomes `+`. Register 9.11 is correct and, if anything, understated: the damage
is not only `%20`→`+` but `~`→`%7E` and IDN host punycoding. Register 9.2 is also a real defect but its stated
blast radius is **overstated** — the only two values the Android decoder is ever asked to decode (`fCtx`, `fmt`)
are ASCII by construction.

For an Android-first alpha with My Moulinex, none of these are ship-stoppers on their own; the exposure is that
a link built in the app and a link built by the same merchant's website will not be the same string, and nothing
in CI would ever notice.

---

## Findings

### F1. `FrakContextManager.update()` re-serialises the whole query; native never does — web and native emit different share links for identical input

- **Severity**: high
- **Axis**: parity
- **Complexity to fix**: small (<1d)
- **Evidence**:
  - `sdk/core/src/context/frakContext.ts:166-172` — `const urlObj = new URL(url); deleteQueryParamCaseInsensitive(...); urlObj.searchParams.set(contextKey, compressedContext); applyAttributionParams(urlObj, attribution); return urlObj.toString();`
    Any `searchParams` mutation re-runs the WHATWG *urlencoded serializer* over the whole list; `url.toString()` then emits that.
  - `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/net/UrlQuery.kt:10-13` — *"Existing parameters are never re-encoded, so links a merchant has already published are unchanged."*, and `UrlQuery.kt:51-60` re-emits the raw stored `key`/`value` substrings.
  - `sdk/ios/Sources/FrakSDK/Net/URLQuery.swift:10-13`, `:78-88` — same design.
  - Pinned on native, not on web: `SharingLinkBuilderTest.kt:29-41` asserts the *exact* string
    `https://acme.example/p?size=XL&utm_source=newsletter&fCtx=…#reviews`; `sdk/core/src/context/frakContext.test.ts:271-289` only reads values back through `new URL(...).searchParams`, so it passes either way.
- **What actually happens**: merchant base URL `https://acme.example/p?note=hello%20world&tilde=a~b&size=XL`
  - web SDK → `https://acme.example/p?note=hello+world&tilde=a%7Eb&size=XL&fCtx=…&utm_source=frak`
  - Android/iOS SDK → `https://acme.example/p?note=hello%20world&tilde=a~b&size=XL&fCtx=…&utm_source=frak`
  A merchant backend that reads `QUERY_STRING` with `rawurldecode` (PHP/WordPress/Magento plugins do) sees
  `hello+world` from web-shared links and `hello world` from app-shared links. Additionally `new URL()` punycodes
  a non-ASCII host (`https://müller.de/p` → `https://xn--mller-kva.de/p`) and percent-encodes non-ASCII path
  segments; native leaves both alone. Analytics dedupe, canonical-URL matching and A/B bucketing all split.
- **Fix sketch**: give TS a `UrlQuery`-shaped editor (splice `fCtx`/UTMs into the raw query string) instead of
  `URLSearchParams`, and add `golden-sharing-links.json` asserting the exact output string in all three.
- **Register status**: confirms 9.11 (§3.7). The register only names `%20`→`+`; `~`→`%7E` and IDN/path
  normalisation are additional and unfiled.

### F2. No shared corpus for URL editing / attribution merge — the three ports disagree on ≥8 named inputs

- **Severity**: high
- **Axis**: parity
- **Complexity to fix**: medium (few days)
- **Evidence**: the three hand-ported files, plus per-input divergences verified below.

| Input | TS (`frakContext.ts` + `queryParams.ts` + `b64.ts`) | Kotlin (`UrlQuery.kt`, `FrakContextCodec.kt`) | Swift (`URLQuery.swift`, `Base64URL.swift`) |
|---|---|---|---|
| `?fctx=stale&fCtx=real` (both casings) | **`real`** — exact-case match wins (`queryParams.ts:28-37`, doc at `:18-20`) | **`stale`** — first positional case-insensitive hit (`UrlQuery.kt:20-24`) | **`stale`** — `parameters.first { caseInsensitiveCompare }` (`URLQuery.swift:57-60`) |
| `?a=x+y` | `x y` — `URLSearchParams` form-decodes `+` | `x+y` — `percentDecode` never touches `+` (`UrlQuery.kt:88-105`) | `x+y` (`URLQuery.swift:91-109`) |
| value `%20é` (escape + raw non-ASCII) | `" é"` | **`" \uFFFD"`** — `out.write(char.code)` keeps low 8 bits only (`UrlQuery.kt:97`) | `" é"` — iterates `Array(value.utf8)` (`URLQuery.swift:93,104`) |
| value `%+1` | `%+1` (atob path n/a; `URLSearchParams` leaves malformed escapes) | **`\u0001`** — `"+1".toIntOrNull(16)` == 1, Kotlin accepts a sign (`UrlQuery.kt:95`) | `%+1` — `Hex.nibble('+')` is nil (`URLQuery.swift:99`) |
| value `%-1` | `%-1` | **`0xFF`** — `toIntOrNull(16)` == −1, `write(-1)` | `%-1` |
| `?a=` (empty value) on output | `?a=&…` | `?a&…` — `=` dropped (`UrlQuery.kt:57`) | `?a&…` (`URLQuery.swift:83-85`) |
| `fCtx` last char mutated (non-zero leftover bits) | **decodes** — `atob` ignores leftover bits (`b64.ts:18-29`) | **null** — `Base64Url.kt:73` rejects | **nil** — `Base64URL.swift:31` round-trip check rejects |
| `fCtx` with `=` padding or `+`/`/` | **decodes** (`atob` accepts) | null | nil (`URLQueryTests.swift:105-109` pins this) |
| relative base URL `"acme.example/p"` | **throws** — `new URL(url)` uncaught in `update()`/`parse()` (`frakContext.ts:89,168`) | `null` (`UrlQuery.kt:65`) | `nil` (`URLQuery.swift:21`) |
| `productUtmContent: ""` + `perCall.utmContent: "x"` | `utm_content` **deleted** (`mergeAttribution.ts:73-79`: `"" ?? x` is `""`) | `x` — `takeIf { isNotEmpty() } ?: perCall` (`AttributionParams.kt:85`) | `x` (`SharingLinkBuilder.swift:63`) |
| 7-field precedence (source/medium/campaign/content/term/via/ref) | perCall > defaults, gap-fill, `utm_source` default `"frak"` (`frakContext.ts:110-137`) | identical (`SharingLinkBuilder.kt:29-35`) | identical (`SharingLinkBuilder.swift:35-41`) |
| fragment vs query | preserved, query before fragment | same (`UrlQuery.kt:67-73`) | same (`URLQuery.swift:25-41`) |
| duplicate keys on the base URL | both kept, gap-fill skips | same | same |

- **What actually happens**: none of these are caught by any test. Each side's suite asserts its own port
  (`SharingLinkBuilderTest.kt`, `SharingLinkBuilderTests.swift`, `URLQueryTests.swift`, `frakContext.test.ts`) and
  the assertions were written independently, so they agree only where the authors happened to agree.
  Android additionally has **no dedicated `UrlQuery` test file at all** (`find sdk/android -name '*UrlQuery*'`
  returns only `main/…/UrlQuery.kt`) — which is exactly how F3/F4 survived.
- **Fix sketch**: `sdk/core/src/context/fixtures/golden-sharing-links.json` in the shape of `golden-context.json`
  (base URL + context + attribution → exact output string, plus a read-back table), consumed by all three suites.
- **Register status**: confirms §3.7. The register says "no golden corpus"; it does not enumerate a single
  concrete divergence. Rows 1, 2, 4, 5, 6, 7, 8, 9, 10 in the table above are **NEW**.

### F3. Android `percentDecode` truncates non-ASCII to one byte — real, but the register overstates the blast radius

- **Severity**: medium (code defect) / low (today's exposure)
- **Axis**: correctness
- **Complexity to fix**: trivial (<1h)
- **Evidence**: `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/net/UrlQuery.kt:90-104`
  ```kotlin
  val out = java.io.ByteArrayOutputStream(value.length)
  …
  if (byte == null) { out.write(char.code); index++ }   // char.code is a UTF-16 code unit
  …
  return out.toString(Charsets.UTF_8.name())
  ```
  `ByteArrayOutputStream.write(int)` keeps the low 8 bits. `é` (U+00E9) → `0xE9` (lone continuation-less byte →
  `U+FFFD`); `漢` (U+6F22) → `0x22` (`"`); an emoji's surrogate pair → `0x3D`,`0x00`. Guarded by the early return
  at `:89` (`if ('%' !in value) return value`), so it needs **at least one `%` escape plus one raw non-ASCII char**
  in the same value. iOS is byte-correct: `URLQuery.swift:93` `let characters = Array(value.utf8)`.
- **Exact diverging input**: `https://m.example/p?fmt=a%20é` → Kotlin `"a \uFFFD"`, Swift `"a é"`, TS `"a é"`.
- **What actually happens**: **nothing today.** The only two decoded values in the SDK are `fCtx`
  (`SharingLinkBuilder.kt:40`) and `fmt` (`IdentityMerge.kt:29`), both ASCII by construction (base64url / server
  token). `fillIfAbsent` calls `get(key)` (`UrlQuery.kt:38`) but only null-checks the result, so a corrupted
  decode is discarded. The bug is latent, not live — it fires the day anyone reads a human-readable param.
- **Fix sketch**: build a `ByteArray` from `value.toByteArray(UTF_8)` and index bytes, mirroring Swift; and while
  there, replace `hex.toIntOrNull(16)` with a two-nibble parse so `%+1`/`%-1` stop decoding (see F2).
- **Register status**: confirms 9.2 on the defect; **overstated in 9.2** on impact — "this feeds `fCtx` extraction
  and gap-fill" implies a live failure path, and neither path can carry non-ASCII.

### F4. `fCtx` case-insensitive lookup: native picks the *first* match, TS deliberately prefers the *exact* casing

- **Severity**: medium
- **Axis**: parity
- **Complexity to fix**: trivial (<1h)
- **Evidence**:
  - `sdk/core/src/utils/url/queryParams.ts:18-20` — *"An exact-case match wins when present, so a canonical link is never shadowed by a mangled duplicate (`?fctx=stale&fCtx=real` resolves to `real`)."* Implemented at `:28-29` (`searchParams.get(key)` first).
  - `sdk/android/…/net/UrlQuery.kt:20-24` — `parameters.firstOrNull { it.first.equals(key, ignoreCase = true) }`.
  - `sdk/ios/Sources/FrakSDK/Net/URLQuery.swift:57-60` — `parameters.first { $0.key.caseInsensitiveCompare(key) == .orderedSame }`.
- **What actually happens**: a link that picked up a lowercased `fctx` from an email channel and then had a fresh
  `fCtx` appended resolves to the **stale referrer** on native and the **fresh referrer** on web. Attribution goes
  to the wrong sharer, silently and permanently (the arrival is enqueued and delivered).
  Note the *write* path is safe on all three: `set`/`update` delete every casing first
  (`UrlQuery.kt:26-29`, `URLQuery.swift:62-64`, `frakContext.ts:169`).
- **Fix sketch**: in both native `value(for:)`/`get()`, try an exact-case match before the case-folded scan.
- **Register status**: **NEW**. §3.7 names `queryParams`/`UrlQuery`/`URLQuery` as un-pinned but does not identify
  this rule as diverging.

### F5. base64url strictness diverges: a one-character corruption of `fCtx` decodes on web and is dropped on native

- **Severity**: medium
- **Axis**: parity
- **Complexity to fix**: small (<1d) — mostly a decision
- **Evidence**:
  - `sdk/core/src/utils/compression/b64.ts:18-29` — `atob(...)` after `-`→`+`, `_`→`/`, `padEnd`. `atob` ignores
    leftover bits in the final group, strips ASCII whitespace, and accepts the standard alphabet.
  - `sdk/android/…/core/Base64Url.kt:73` — `if (bits > 0 && (accumulator and ((1 shl bits) - 1)) != 0) return null`.
  - `sdk/ios/Sources/FrakSDK/Core/Base64URL.swift:20,31` — alphabet allowlist plus `guard encode(decoded) == value`.
  - Pinned only on iOS: `URLQueryTests.swift:105-109` (`"____="` and `"+/+/"` → nil). No TS test asserts either way.
- **What actually happens**: a v2 `fCtx` is 50 or 55 base64url chars (`golden-context.json` `base64urlLength`), i.e.
  length % 4 ∈ {2, 3} → 4 or 2 leftover bits. Mutate the last character (link shortener, manual retype, a channel
  that lowercases) and 15 of 16 mutations set a leftover bit: the **web** page still resolves the referral to the
  exact same 37/41 bytes, the **native** SDK returns `null` and tracks an unattributed arrival. Same story for a
  channel that re-adds `=` padding, or converts `-`/`_` back to `+`/`/`.
- **Fix sketch**: pick one. Either loosen native to ignore leftover bits (matching web), or tighten `b64.ts` and
  add a `reject-decompress-noncanonical-trailing-bits` fixture to `golden-context.json` so all three agree.
- **Register status**: **NEW**. Not in §3.2, §3.7 or the fixture corpus.

### F6. The public SDK contract documents four attribution defaults that no implementation applies

- **Severity**: medium
- **Axis**: docs-accuracy
- **Complexity to fix**: trivial (<1h)
- **Evidence**:
  - `sdk/core/src/types/rpc/displaySharingPage.ts:50-57` (merchant-facing TSDoc, `@group RPC Schema`) —
    *"Frak adds standard affiliation params (`utm_source=frak`, `utm_medium=referral`, `utm_campaign=<merchantId>`, `ref=<clientId>`, `via=frak`)"*.
  - `sdk/core/src/context/mergeAttribution.ts:40-42` repeats it.
  - Actual implementation `sdk/core/src/context/frakContext.ts:110-121` — `resolveAttributionValues` returns
    `utm_source: overrides.utmSource ?? "frak"` and **`undefined` for every other field**; `:130-137` skips
    `undefined`. The TS test `frakContext.test.ts:290-310` explicitly asserts `utm_medium`, `utm_campaign`,
    `via`, `ref` are **absent**.
  - Native matches the code, not the doc: `SharingLinkBuilder.kt:12,29` / `SharingLinkBuilder.swift:12,35`
    (`DEFAULT_SOURCE = "frak"` only).
- **What actually happens**: a merchant reading the SDK reference builds an analytics view keyed on
  `utm_medium=referral` / `utm_campaign=<merchantId>` and sees zero rows. Three implementations agree with each
  other and disagree with the published contract, so nothing surfaces it.
- **Fix sketch**: delete the four phantom defaults from both doc blocks (and any merchant docs mirroring them),
  or implement them in `resolveAttributionValues` and mirror in both native builders.
- **Register status**: **NEW**.

### F7. The only uppercase-UUID vector in `golden-proofs.json` sits on an op both native suites skip

- **Severity**: low
- **Axis**: tests
- **Complexity to fix**: trivial (<1h)
- **Evidence**: `sdk/core/src/identity/fixtures/golden-proofs.json` fixture index 4 —
  `op = "frak-ensure-v1"`, `merchantId = "9C8B3E2A-1D4F-4A6B-8E2D-7F3A1B5C9D0E"` (the only non-lowercase id in
  the corpus). Both native message tests skip unmapped ops:
  `ProofCodecTest.kt:44` `val op = opOf(...) ?: continue` (enum has only `Install`/`Merge`, `ProofCodec.kt:14-17`),
  `ProofCodecTests.swift:77` `guard let op = fixture.op else { continue }` (`ProofCodec.swift:6-9`).
  So the corpus's uppercase → raw-bytes contract is never exercised natively.
- **What actually happens**: nothing today (see F8 — it is transitively pinned), but the corpus *looks* like it
  covers case-normalisation cross-platform and does not. Move the uppercase merchantId onto the
  `frak-install-v1` or `frak-merge-v1` fixture and it becomes a real cross-platform assertion for free.
- **Register status**: **NEW**.

### F8. UUID→bytes: Kotlin hex-parse and Swift `UUID(uuidString:)` + `withUnsafeBytes(of: uuid.uuid)` are byte-identical — CONFIRMED, including uppercase

- **Severity**: nit (informational; answers the brief's question definitively)
- **Axis**: correctness
- **Complexity to fix**: n/a
- **Evidence**:
  - Kotlin: `core/Uuid.kt:16-24` — regex `[0-9a-fA-F]` (case-insensitive by class), then
    `Hex.decodeOrNull(value.replace("-", ""))`; `Hex.nibble` (`Hex.kt:41-48`) accepts `a-f` and `A-F` identically.
    So bytes = the 16 hex-pairs of the string, in text order.
  - Swift: `Identity/ProofCodec.swift:31-36` — `UUID(uuidString:)` then `withUnsafeBytes(of: uuid.uuid) { Data($0) }`.
    `uuid_t` is `(UInt8 × 16)` in RFC-4122 network byte order, i.e. **the same order as the canonical text**, and
    `uuid_parse` is case-insensitive. So bytes = the 16 hex-pairs of the string, in text order. **Identical.**
  - TS: `canonical.ts:96-101` / `frakContextV2Codec.ts:53-59` — same, with `UUID_RE` carrying the `/i` flag.
  - Cross-checked by construction, not by inspection alone: all six lowercase corpus vectors assert
    `canonicalMsgHex` byte-for-byte on both platforms (`ProofCodecTest.kt:54-58`, `ProofCodecTests.swift:86`), and
    each platform separately proves `upper == lower` on itself (`ProofCodecTest.kt:116-120`,
    `ProofCodecTests.swift:136-153`). Lowercase equal cross-platform + uppercase equal to lowercase on each
    platform ⇒ uppercase equal cross-platform. **Definitively the same bytes.**
  - `FrakContextCodec` uses the same primitives on both sides (`FrakContextCodec.kt:63` `Hex.writeInto(m.replace("-",""))`
    vs `FrakContextCodec.swift:105` `ProofCodec.uuidBytes`), and the corpus has a dedicated
    `uppercase-uuid-normalised` fixture asserting byte-equality with `c-only`.
  - **Residual**: strictness, not bytes. Kotlin's regex demands exactly the 36-char hyphenated form; Swift's
    `UUID(uuidString:)` is the platform parser. Any form Foundation accepts that the regex rejects would let
    iOS mint an `fCtx` Android cannot. I could not execute Foundation to enumerate that set (see "Could not verify").

### F9. `/sharing` and `/install` param contracts: complete in both directions, with one asymmetry

- **Severity**: low
- **Axis**: merchant-setup / parity
- **Complexity to fix**: trivial (<1h)
- **Evidence** — every param sent is read, every param read is either sent or web-only:

| Param | Sent by Kotlin | Sent by Swift | Read by wallet |
|---|---|---|---|
| `embed=native` | `SharingPageUrl.kt:42,74` | `SharingPageURL.swift:44,73` | `table.ts:67` → `hostEmbed.ts:13` |
| `merchantId`, `clientId` | `:43-44,75-76` | `:45-46,74-75` | `table.ts:57-58` (query only) |
| `returnScheme` | `:45,77` | `:47,76` | `table.ts:70` → `sanitizeReturnScheme.ts:8` `^frak-[a-z0-9._-]{1,60}$` |
| `sid` | `:46,78` | `:48,77` | `table.ts:73` (both) |
| `sdkVersion` | `:50` via `FrakSdkVersion.QUERY_PARAMETER_NAME = "sdkVersion"` (`FrakSdkVersion.kt:20`) | `:49` | `table.ts:76` (query only) |
| `appName`, `logoUrl`, `link`, `products`, `seedReward` | `:53-57`, fragment `:104-108` | `:50-57`, fragment `:103-111` | `table.ts:59-62,79` |
| `state=warm` / `state=live` | `:74`, `:103` | `:73`, `:102` | `table.ts:86-90`, `fragmentDefault:"live"` |
| `view=confirmation` | `:58,109` | `:112` | `table.ts:93` |
| `checkoutToken`, `redirectUrl` | — | — | `table.ts:63-64` (Shopify/web-only, correctly unsent) |
| install `m`,`a`,`returnScheme`,`sid`,`#p=` | `InstallLinks.kt:61-66` | `InstallLinks.swift:42-48` | `install/params.ts:29-37,46-54` |
| Play referrer `merchantId`/`anonymousId`/`proof` | `InstallLinks.kt:40-42` | n/a | `buildInstallUrl.ts:45-47` (identical spelling) |
| result `action`/`sid`/`value`/`exp` | `SharingWebView.kt:53-68` (8 actions) | `SharingWebView.swift:20-38` (8 actions) | `bridge.ts:2-10,32-38` (8 actions) |

  `returnScheme` sanitisation round-trips: `SharingPageUrl.kt:16-23` / `SharingPageURL.swift:20-29` produce
  `frak-` + `[a-z0-9._-]{≤60}` with an `"app"` fallback, which always matches the wallet regex — including
  `com.groupeseb.moulinex.food` → `frak-com.groupeseb.moulinex.food`.
- **The asymmetry**: Swift `SharingPageURL.build` has no `confirmed:` parameter (`:32-42`, `view=confirmation`
  appended by `SharingSession.url(confirmed:)`); Kotlin has `confirmed: Boolean = false` inline (`:38,58`).
  Two different places to forget it. Also Swift exposes a `warmFragment` constant (`:15`) with no Kotlin twin
  because Android re-warms with a **full navigation** (`SharingWebViewPool.kt:100-110`) while iOS reclaims a
  pooled view with a **same-document fragment change** (`SharingWebView.swift:205`) — so an iOS reclaimed view
  keeps the previous document's React state where Android always gets a fresh one.
- **Fix sketch**: give Swift the same `confirmed:` parameter; decide whether iOS should also hard-reload on release.
- **Register status**: partially **NEW** (the reclaim-vs-reload asymmetry). The param table itself verifies clean.

### F10. `--frak-host-*` CSS-var contract: three hand-mirrored literals, and iOS silently depends on the TS fallbacks

- **Severity**: low
- **Axis**: parity
- **Complexity to fix**: trivial (<1h)
- **Evidence**:
  - TS names: `packages/design-system/src/hostSheet.ts:8,15` (`--frak-host-top-radius`, `--frak-host-surface`),
    consumed at `packages/wallet-shared/src/sharing/component/shared.css.ts:26` and
    `packages/design-system/src/defaults.css.ts:29` (`backgroundColor: hostSheet(hostSheetVar.surface, vars.surface.background2)`).
  - Kotlin names: `sdk/android/frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/SharingHostStyle.kt:16,19`, injected as a
    document-start script `:25-28` (`:root{--frak-host-top-radius:${dp}px;--frak-host-surface:transparent}`).
  - Swift: **nothing**. `grep -rn "WKUserScript" sdk/ios/Sources/FrakSDKUI` returns no hits; iOS only sets
    `view.isOpaque = false; view.backgroundColor = .clear` (`SharingWebView.swift:135-136`).
  - Each side asserts the other's spelling in its own suite with no compiler link:
    `packages/design-system/src/hostSheet.test.ts:8-9` vs `SharingHostStyleTest.kt:18-19`.
- **What actually happens**: iOS's chrome is *whatever the TS fallbacks happen to be* — `0px` radius
  (`hostSheet.ts:27-30`) and opaque `vars.surface.background2`. Change `defaults.css.ts:29`'s fallback to
  `transparent` for any web reason and the iOS sheet becomes see-through with no iOS change and no failing test.
  On Android, renaming either variable in `hostSheet.ts` passes both builds and ships a square-cornered sheet.
  Also note `SharingHostStyle.install` fails soft on WebViews without `DOCUMENT_START_SCRIPT` (`:40-47`), so the
  Android sheet degrades to iOS's appearance on old WebViews anyway.
- **Fix sketch**: emit the two names into a tiny generated JSON in `sdk/core/src/…/fixtures/` and assert both
  Kotlin and TS against it (the `golden-context.json` pattern); add a TS test pinning the two *fallback values*
  as iOS's contract.
- **Register status**: confirms §3.8. The iOS-fallback dependency is already noted there; the "fallbacks are
  unpinned" half is stated but not actionable — the fix sketch above is the missing part.

### F11. `frak-install-v1`/`frak-merge-v1` envelope: three-way byte-identical — VERIFIED

- **Severity**: nit (positive finding, recorded for coverage)
- **Axis**: parity
- **Complexity to fix**: n/a
- **Evidence**, field by field:

| Field | TS `canonical.ts` | Kotlin `ProofCodec.kt` | Swift `ProofCodec.swift` |
|---|---|---|---|
| `msg := op ‖ m(16) ‖ a(16) ‖ binding(32) ‖ ts(8 BE)` | `:136-153` | `:70-95` | `:59-77` |
| op bytes | `TextEncoder` (UTF-8) `:136` | `US_ASCII` `:82` | `Data(op.rawValue.utf8)` `:72` |
| empty binding → 32 zero bytes | zero-filled array `:137,149` | zero-filled array `:83,91` | explicit `Data(repeating:0,count:32)` `:75` |
| binding must be 0 or 32 | throws `:127-134` | `require` `:78-80` | throws `:69-71` |
| ts negative | throws `:104-106` | `require` `:120` | throws `:100-102` |
| `envelope := v(1) ‖ pk(65) ‖ ts(8) ‖ sig(64)` = 138 B | `:243-249` | `:104-113` | `:79-91` |
| version byte | **`envelope.v`, caller-supplied** `:244` | constant `1` `:107` | constant `1` `:86` |
| proof string | unpadded base64url, 184 chars | same | same, `ProofCodecTests.swift:103` pins 184 |

  Op strings match exactly (`ProofOp` in `ProofCodec.kt:11-16` / `ProofCodec.swift:6-9`) and the backend's
  freshness table names the same two (`services/backend/src/domain/identity/services/IdentityProofService.ts:22,24`).
  The `envelope.v` asymmetry in TS is the only difference and is unreachable from the SDK's own callers.

### F12. `?fmt=` merge token is read case-insensitively on native and case-sensitively on web

- **Severity**: nit
- **Axis**: parity
- **Complexity to fix**: trivial
- **Evidence**: `sdk/core/src/clients/createIFrameFrakClient.ts:437` `url.searchParams.get("fmt")` (exact key) vs
  `sdk/android/…/identity/IdentityMerge.kt:29` and `sdk/ios/…/Identity/IdentityMerge.swift:19`, both going
  through the case-insensitive `UrlQuery.get` / `URLQuery.value(for:)`.
- **What actually happens**: a channel that lowercases keys leaves `fmt` unchanged (it is already lowercase), so
  this is currently harmless — but the two surfaces have opposite tolerance rules for the same wire key, which is
  the same class of drift as F4.
- **Register status**: **NEW**.

### F13. iOS App Store link ignores the environment; Android's Play link does not

- **Severity**: nit
- **Axis**: merchant-setup
- **Complexity to fix**: trivial
- **Evidence**: `sdk/ios/Sources/FrakSDK/AppLink/InstallLinks.swift:4` — `appStoreURL = "https://apps.apple.com/app/id6759159306"`,
  a hardcoded **production** id used for `.development` too. Android derives the listing from
  `settings.env.walletPackageId` (`FrakEnvironment.kt:20,69` → `id.frak.wallet` / `id.frak.wallet.dev`) and
  `InstallLinks.kt:44`. Web mirrors Android: `packages/wallet-shared/src/common/utils/storeUrls.ts:6-15`.
- **What actually happens**: an iOS merchant testing against `.development` is sent to the production wallet
  listing. Defensible (no dev build on the App Store) but undocumented — the Swift comment at `:2-3` explains the
  missing storefront, not the missing environment split.
- **Register status**: **NEW**.

---

## Verified-OK

- **Both native suites really do consume both corpora.** `GoldenFixtures.load(IDENTITY_PROOFS)` at
  `ProofCodecTest.kt:25` and `ProofCodecTests.swift:29`; `load(CONTEXT_CODEC)` at `FrakContextCodecTest.kt:15`
  and `FrakContextCodecTests.swift:11`. Both loaders hard-fail on a missing/empty/wrong-`formatVersion` corpus
  (`GoldenFixtures.kt:57-120`, `GoldenFixtures.swift:47-135`) — no silent skip. The Kotlin `ProofCodec` header
  simply doesn't *name* the fixture path the way the Swift one does (`ProofCodec.swift:21`); that is a comment
  gap, not a coverage gap.
- **V1/V2 codec byte layout** — header nibble `0x2`, `FLAG_HAS_C = 1<<4`, `FLAG_HAS_W = 1<<5`, `RESERVED = 0xC0`,
  16-byte merchant UUID, uint32 **big-endian** ts, packed optional client UUID and 20-byte address, sizes
  37/41/57, V1 = bare 20 bytes: identical in `frakContextV2Codec.ts:35-47`, `FrakContextCodec.kt:20-33`,
  `FrakContextCodec.swift:19-31`. All three reject reserved bits, no-flags, and length≠expected.
- **Address casing** — all three normalise to lowercase on decode and accept any case on encode without EIP-55
  (`address.ts:15,68-75`, `FrakContextCodec.kt:35`+`Hex.kt:11`, `FrakContextCodec.swift:112-116`). Pinned by
  `mixed-case-wallet-normalised`.
- **`golden-context.json` failure coverage is good**: 11 encode vectors + 21 rejection vectors across
  encode / decode / decompress, including empty buffer, truncated-below-minimum, one-byte-short, one-byte-long,
  wrong version nibble, v1 nibble, reserved bits, no flags, flags-vs-length mismatch, garbage base64url, valid
  base64url of the wrong length, empty string, and the V1-vs-V2 disambiguation with `decompressesTo`. Both
  suites walk every rejection vector and both handle the `t: 1.5` vector that neither `Long` nor `Int64` can
  express (`FrakContextCodecTest.kt:69-71`, `FrakContextCodecTests.swift:87-88`).
- **Attribution 7-field precedence** — perCall > defaults per field, `utmContent` never from defaults, gap-fill
  never overwrites, `utm_source` defaults to `"frak"`: identical across `mergeAttribution.ts:57-81` +
  `frakContext.ts:110-137`, `AttributionParams.kt:76-89` + `SharingLinkBuilder.kt:29-35`, and
  `SharingLinkBuilder.swift:54-68,35-41`. Only the `productUtmContent === ""` edge diverges (F2).
- **Return-scheme handshake** — 8 actions, spelled identically in `bridge.ts:2-10`, `SharingWebView.kt:53-68`,
  `SharingWebView.swift:21-38`; `code` requires a non-empty `value` on both; `exp` parsed as integer seconds on
  both (`toLongOrNull` / `Int64.init`, with an explicit Swift comment pinning the agreement).
- **Deep-link/install contract** — `m`/`a`/`p` search + `#p=` fragment accepted from either carrier by
  `apps/wallet/app/utils/deepLink.ts:140-168` and `install/params.ts:61-66`; wallet schemes
  `frakwallet` / `frakwallet-dev` match `apps/wallet/src-tauri/tauri.conf.json:37` and
  `tauri.conf.dev.json:14`.
- **`products` JSON** — same key set and same null-omission semantics on both platforms
  (`SharingSessionBuilder.kt:155-177` vs `SharingSheetLogic.swift:184-208`), decodable by
  `sanitizeProducts.ts:129-140` via the string branch of `coerceProductCandidates`. iOS's `NSDecimalNumber`
  hop (`SharingSheetLogic.swift:210-214`) is what keeps `79.9` from becoming `79.900000000000006`.
- **Referral-arrival guards** — self-referral and foreign-merchant checks are the same shape and both
  case-insensitive (`ReferralArrival.kt:13-35`, `ReferralArrival.swift:10-27`). Kotlin's `trim()` strips all
  chars ≤ `' '` where Swift's `.whitespaces` does not strip `\n`/`\t`; immaterial for a UUID.
- **Sharing-link build inputs** — the same fallback chain (`request.link → first product link → resolved
  homepageLink → metadata.homepageLink`) and the same "never mint a wallet" rule on both
  (`DefaultFrakClient.kt:212-232`, `DefaultFrakClient.swift:262-281`); web adds `w` when a session exists
  (`buildSharingLink.ts:51-57`), which is a deliberate, documented difference.

## Could not verify

- Whether Foundation's `UUID(uuidString:)` accepts any non-canonical form that `Uuid.REGEX` rejects (braced
  GUIDs, surrounding whitespace, 32-char unhyphenated). No Swift toolchain here; `uuid_parse` semantics say no,
  but I cannot execute it. If it does, iOS can mint an `fCtx` Android refuses. A one-line corpus vector
  (`reject-encode-merchant-braced-guid`) would settle it in CI.
- The runtime behaviour of `%20`→`+` against a real merchant backend (Moulinex): the divergence is provable in
  source, the *consequence* depends on their query parsing, which I cannot see.
- Whether `atob` in the wallet's actual runtimes (Bun SSR vs. browser vs. Tauri WebView) strips whitespace
  identically — the F5 leniency argument assumes browser `atob` semantics.
- Anything requiring a device/emulator: the CSS-var injection actually landing (`SharingHostStyle.install`),
  the iOS fragment-reclaim reusing a mid-flow document, and whether the wallet's `/sharing` standalone bundle
  reads the fragment on a real `hashchange` in a WKWebView.
