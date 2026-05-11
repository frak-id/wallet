---
"@frak-labs/core-sdk": patch
"@frak-labs/components": patch
---

Replace runtime `viem` imports with in-house equivalents in the four files that pulled viem into the SDK bundle. No public API change — these are all internal implementations, the `viem` peer dependency is still used for `Address` / `Hex` type imports.

**Why**: `viem` v2's `BaseError` machinery (six `Object.defineProperty` calls per error subclass × ~5 sub-errors) plus its keccak/checksum/encoding stack was bleeding into the SDK bundle even though the SDK only needed a handful of helpers. Combined with rolldown's lazy-init treeshaking on the IIFE format, the leaked viem code also caused runtime crashes when calling `FrakSDK.processReferral` or `FrakSDK.computeLegacyProductId` from the CDN bundle (uninitialized `var Pe, Fe; ...` referenced by surviving consumer functions).

**Changes**:

- `sdk/core/src/utils/address.ts` (new) — minimal, dependency-free address helpers:
  - `isAddress` (regex shape check, no EIP-55 checksum — SDK never produces checksum-cased payloads, downstream consumers treat addresses case-insensitively)
  - `areAddressesEqual` (lowercase compare)
  - `addressToBytes` / `bytesToAddress` (fixed 20-byte conversion with a precomputed hex lookup table for the encode hot path)
- `sdk/core/src/utils/FrakContext.ts` — swap `viem` `bytesToHex` / `hexToBytes` / `isAddress` → in-house `bytesToAddress` / `addressToBytes` / `isAddress`.
- `sdk/core/src/utils/frakContextV2Codec.ts` — same swap (kept the `Address` type-only import).
- `sdk/core/src/actions/referral/processReferral.ts` — swap `viem` `isAddressEqual` → `areAddressesEqual`.
- `sdk/core/src/actions/wrapper/siweAuthenticate.ts` — drop `viem/siwe` `generateSiweNonce` import, inline a 96-hex-char nonce generator using `crypto.getRandomValues` (with a `Math.random` fallback for the rare environment without WebCrypto). Matches viem's nonce shape exactly.
- `sdk/core/src/actions/wrapper/siweAuthenticate.test.ts` — drop the `viem/siwe` mock, assert nonce shape via `expect.stringMatching(/^[0-9a-f]{96}$/)`.

**Bundle impact** (CDN, raw / gzip), from baseline before this trim → final:

| Bundle | Before | After | Δ raw | Δ gzip |
|---|---:|---:|---:|---:|
| `sdk/core/cdn/bundle.js` (`window.FrakSDK`) | 46.7 KB / 15.9 KB | 41.1 KB / 13.9 KB | **−5.7 KB (−12%)** | **−2.1 KB (−13%)** |
| `sdk/components/cdn/loader.js` (always-loaded entry) | 60.3 KB / 20.0 KB | 49.5 KB / 16.2 KB | **−10.8 KB (−18%)** | **−3.8 KB (−19%)** |

After this change, **zero** `viem` runtime code ships in either CDN bundle (verified: 0 hits for `BaseError`, `isAddress`, `keccak`, `@noble`, etc.). The `viem` peer dep is now type-only for SDK CDN consumers.

**Side effect — IIFE crash fix**: The `window.FrakSDK.processReferral(...)` call previously threw `TypeError: Cannot read properties of undefined (reading 'has')` due to rolldown tree-shaking viem's lazy-init closures while keeping the consumer functions. Verified post-trim: `processReferral` / `FrakContextManager.parse` / `compressJsonToB64` / `getClientId` all work correctly when invoked from the IIFE bundle.
