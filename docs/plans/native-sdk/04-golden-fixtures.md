# Golden fixtures — the cross-platform conformance corpus

Committed language-agnostic JSON vectors that TypeScript, Kotlin and Swift must reproduce
byte for byte — the named alternative to a shared core: vectors are the contract, the
implementation is not. iOS and Android emit different output for identical locale/currency
input (`"CHF 10.00"` vs `"CHF10.00"`), and ICU version skew diverges within one platform
family, so "just use the platform formatter" is not available.

## 1. What it covers

| Concern | File (under `sdk/core/src/`) | Generator | Entries |
|---|---|---|---|
| Identity — signed byte layout | `identity/fixtures/golden-proofs.json` | `scripts/generate-golden-proofs.ts` | 6 |
| FrakContext v2 codec | `context/fixtures/golden-context.json` | `scripts/generate-golden-context.ts` | 32 (11 encode, 21 reject) |
| Reward selection + currency formatting | `rewards/fixtures/golden-rewards.json` | `scripts/generate-golden-rewards.ts` | 67 across 6 kinds |

Identity is `op ‖ merchantId(16) ‖ anonymousId(16) ‖ binding(32) ‖ ts(8)`, fixed width, UUIDs
as raw 16 bytes, from the crypto-free `identity/canonical.ts` so signer and verifier build on
one artifact. Codec entries are normalise-on-decode, not reject: UUIDs are case-insensitive
and decode always emits lowercase canonical. Rewards spans 6 kinds — `format-amount`,
`format-estimated-reward`, `reward-value`, `select-display-campaign`, `select-best-reward`,
`format-reward-or-hide` — and the `format-*` kinds carry the ICU hazard in §4. One corpus,
not three: files split by concern, one envelope, one loader per platform.

## 2. Envelope and regeneration

```json
{ "formatVersion": 1, "fixtures": [ { "name": "...", "description": "...", "kind": "...", "…": "payload" } ] }
```

`formatVersion` is identical across all three files; `fixtures` is a non-empty array.
Everything inside an entry is payload, and both loaders treat it as opaque — bump
`formatVersion` only when the envelope shape changes, not for a payload gaining a field.

```bash
bun run --cwd sdk/core fixtures:generate           # identity
bun run --cwd sdk/core fixtures:generate:context   # codec
bun run --cwd sdk/core fixtures:generate:rewards   # rewards
```

Each generator is a package export, so the TypeScript suite consumes the same bytes the
native suites do.

## 3. Rules for adding to it

- Generated, never hand-edited — if a fixture is wrong, the generator or the frozen module is
  wrong, not the JSON.
- Byte-deterministic: regenerating with no semantic change is a zero diff — no timestamps, no
  paths, no randomness, no locale-dependent host state.
- No round-trip tests (`encode(decode(x)) == x`): that proves internal consistency, not
  conformance across an implementation boundary.
- Fail loudly, never skip: both loaders throw — naming the missing path, resolved repo root
  and regeneration command — on an absent/invalid file, wrong `formatVersion`, or an empty
  `fixtures` array. Both test that failure path.

To add a group: freeze the module first; add a generator at
`sdk/core/scripts/generate-golden-<concern>.ts` writing to `src/<concern>/fixtures/` plus a
`fixtures:generate:<concern>` script and package export; match the envelope (kebab-case
`name`, `kind` discriminator, 4-space indent, trailing newline); prove determinism twice;
escape non-ASCII with a `…Codepoints` sibling wherever invisible characters are possible
(§4); add a loader constant and a conformance suite next to the platform code it covers; and
prove it fails by breaking one byte on one platform first.

## 4. The ICU and invisible-character hazard

Currency output carries characters invisible in every diff viewer: `U+00A0`/`U+202F` (fr-FR
thousands separators), `U+2212` (minus, not ASCII `-`), `U+200E`/`U+200F` (directional marks).
The corpus file is pure ASCII — every codepoint above `U+007F` is escaped as `\uXXXX` — and
every expected string is recorded twice: as the escaped literal and as an explicit codepoint
array under the same name plus a `Codepoints` suffix. Assert the codepoint array first: a
`U+202F`→`U+00A0` substitution is invisible in a literal-only diff but reads as
`-"U+202F" / +"U+00A0"` against the codepoints. Nine of the 43 pairs are nested, so the
corpus-wide walker pairing any `X` with a sibling `XCodepoints` must recurse.

Covered locales: `eur`→fr-FR, `usd`→en-US, `gbp`→en-GB, all LTR; only fr-FR above 1000 is at
risk. Generated under ICU 74.2 / CLDR 44 (fr-FR's `U+202F`, arrived CLDR 34 / ICU 63); Android
below roughly API 28 ships pre-ICU-63 CLDR and emits `U+00A0` instead, for a reason that is
nobody's bug. Exactly six entries carry a `U+202F`; treat a mismatch elsewhere as an
environment finding and report the runtime ICU/CLDR version. No negative-amount fixtures and
no RTL locales, both deliberately excluded.

## 5. How each platform consumes it

The corpus lives in `sdk/core`, outside both native projects, so both loaders walk up to the
repo root, identified by `sdk/core` plus a repo marker (`.git` or `package.json`) together.

| | Android | iOS |
|---|---|---|
| Loader | `frak-sdk/src/test/kotlin/id/frak/sdk/fixtures/GoldenFixtures.kt` | `Tests/FrakSDKTests/Fixtures/GoldenFixtures.swift` |
| Parser | `org.json`, test scope only | `JSONSerialization` |
| Framework | JUnit 4 | Swift Testing |

`JSONSerialization`/`org.json` over `Codable`/kotlinx-serialization is deliberate: typing the
payload would make every payload change a loader change. `org.json` needs a real
`testImplementation` dependency (the stubbed test `android.jar` throws on every call) but,
being test-scoped, never reaches the published POM.

## 6. Status

| | State |
|---|---|
| Envelope | locked across all three files |
| Loaders | green on both platforms, with a deliberate failure-path test |
| Identity conformance | asserted on both platforms |
| Codec conformance | asserted on both platforms |
| Rewards conformance | absent — `GoldenFixtures.REWARDS`/`.rewards` are loaded by nobody; reward decoding is asserted against hand-written literals instead. 67 entries, the largest file, asserting nothing |
| Caught a real divergence? | No — the deliberate-injection test remains unrun |
