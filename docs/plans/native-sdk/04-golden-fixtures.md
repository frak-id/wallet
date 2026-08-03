# Golden fixtures — the cross-platform conformance corpus

Committed language-agnostic JSON vectors that three independent implementations —
TypeScript, Kotlin, Swift — must reproduce byte for byte. This is the **named alternative to
a shared core** ([`05-build-and-release.md`](./05-build-and-release.md) §1): vectors are the
contract, the implementation is not. Prior art: Slack's post-LibSlack conformance suite and
`twitter-text`.

The failure it prevents is not hypothetical — iOS and Android emit *different output for
identical locale and currency input* (`"CHF 10.00"` vs `"CHF10.00"` for the same en-US/CHF
pair), and ICU version skew diverges within one platform family. "Just use the platform
formatter" is not available to us.

## 1. What it covers

| Concern | File (under `sdk/core/src/`) | Generator | Entries |
|---|---|---|---|
| Identity — the signed byte layout | `identity/fixtures/golden-proofs.json` | `scripts/generate-golden-proofs.ts` | 6 |
| FrakContext v2 codec | `context/fixtures/golden-context.json` | `scripts/generate-golden-context.ts` | 32 (11 encode, 21 reject) |
| Reward selection + currency formatting | `rewards/fixtures/golden-rewards.json` | `scripts/generate-golden-rewards.ts` | 67 across 6 kinds, 43 literal/codepoint pairs |

**Identity** covers `op ‖ merchantId(16) ‖ anonymousId(16) ‖ binding(32) ‖ ts(8)` — fixed
width, no length prefixes, UUIDs as raw 16 bytes rather than their 36-character text form,
`ts` as `uint64be`, and a `binding` that is always exactly 32 bytes (zero-filled when the op
does not use it) so the layout never varies by op. The frozen module is
`identity/canonical.ts`, deliberately crypto-free so the SDK signer and the backend verifier
build on one artifact.

**Codec** covers big-endian `uint32` timestamps, unpadded base64url and length-based version
disambiguation (V1 is exactly 20 bytes; V2 is 37/41/57). Entries carry `kind: "encode" |
"reject"`, with `direction` and `reason` on the negative ones.

> The codec is **normalise-on-decode, not reject**. Its UUID regex is case-insensitive, so
> an uppercase merchant or client id encodes byte-identically and decode always emits
> lowercase canonical; mixed-case wallet hex is accepted and normalised too. Pinned by the
> `uppercase-uuid-normalised` fixture. The identity corpus carries the same lesson
> independently — two concerns landing on normalise-not-reject is the corpus doing its job.

**Rewards** kinds: `format-amount` (16), `format-estimated-reward` (14), `reward-value` (11),
`select-display-campaign` (10), `select-best-reward` (9), `format-reward-or-hide` (7). The
three `format-*` kinds carry the hazard in §4.

**One corpus, not three.** Files split by concern, but one envelope, one set of generator
conventions, one loader per platform. Three separately-invented corpora would be three
chances to disagree about exactly what the mechanism exists to prevent.

## 2. Envelope and regeneration

```json
{ "formatVersion": 1, "fixtures": [ { "name": "...", "description": "...", "kind": "...", "…": "payload" } ] }
```

`formatVersion` is a JSON integer, identical across all three files. `fixtures` is a
non-empty array. **Nothing else is required at the top level** — everything inside an entry
is payload owned by its concern, and both loaders treat it as opaque. That is what lets the
rewards corpus add a `kind` without touching a line of Kotlin or Swift, and it is why `name`
is a payload field: making it envelope-level would break `golden-proofs.json`, which predates
the convention and gains a `name` when it is next regenerated.

Bump `formatVersion` only when the *envelope* changes shape. A payload gaining a field is
routine.

```bash
bun run --cwd sdk/core fixtures:generate           # identity
bun run --cwd sdk/core fixtures:generate:context   # codec
bun run --cwd sdk/core fixtures:generate:rewards   # rewards
```

Each generator derives its vectors from the frozen `sdk/core` module it covers, and each is a
package export so the TypeScript suite consumes the same bytes the native suites do rather
than a parallel copy.

## 3. The rules that make it worth having

**Generated, never hand-edited.** A hand-edited fixture is indistinguishable from a generated
one by inspection and converts the corpus from "what the reference implementation does" into
"what someone once believed it should do". The failure mode is specific: a native suite
fails, the expected value looks slightly off, someone edits the JSON until it passes — and
now all three platforms go green while being wrong together. If a fixture is wrong, the
*generator* or the *frozen module* is wrong.

**Byte-deterministic.** Regenerating with no semantic change must produce a zero diff: no
timestamps, no paths, no randomness, no locale-dependent host state. This is not tidiness — a
readable diff is the only review signal that exists here, and a one-byte change to an
expected value is exactly the event the corpus exists to catch. (Verified: the rewards corpus
regenerated 20 consecutive times, and once more after deleting the file, byte-identical.)

**Why not round-trip tests.** `encode(decode(x)) == x` holds perfectly for an implementation
that reads *and writes* the timestamp little-endian, or pads its base64url, or uppercases on
the way in and lowercases on the way out. The property proves internal consistency — exactly
the property that does not transfer across an implementation boundary. The corpus asserts
against externally fixed expected bytes, which is what makes it a conformance suite rather
than a self-check. It also means generators must not derive expected values by running the
code path the tests will run.

**Fail loudly, never skip.** Both loaders throw — naming the missing path, the resolved repo
root and the regeneration command — when a file is absent, is invalid JSON, has the wrong
`formatVersion`, or has an **empty** `fixtures` array. A suite that silently passes when the
corpus is absent is worse than no suite: a corpus deleted by a bad merge looks identical to
one that passes. Both loaders test that failure path deliberately.

## 4. The ICU and invisible-character hazard

Currency output is full of characters invisible in every diff viewer: `U+00A0` (fr-FR, before
the `€`), `U+202F` (fr-FR thousands separator on modern ICU), `U+2212` (minus, not ASCII
`-`), `U+200E`/`U+200F` (directional marks). A single fr-FR string above 1000 contains **two
different invisible spaces**, and they are not interchangeable.

**The corpus file is pure ASCII** — the generator escapes every codepoint above `U+007F` as
`\uXXXX`. Any future generator must preserve that; it is what makes the file safe to open in
any editor and impossible for a whitespace-trimming editor to corrupt.

**Every expected string is recorded twice**, as the escaped literal and as an explicit
codepoint array under the same name plus a `Codepoints` suffix:

```json
{ "name": "format-amount-eur-decimals", "amount": 1234.56, "currency": "eur", "locale": "fr-FR",
  "formatted": "1\u202f234,56\u00a0\u20ac",
  "formattedCodepoints": ["U+0031","U+202F","U+0032","U+0033","U+0034","U+002C","U+0035","U+0036","U+00A0","U+20AC"] }
```

**Assert the codepoint array *before* the literal.** With a `U+202F` → `U+00A0` substitution
injected into `formatAmount`, the literal assertion reports `expected '1 000 €' to be
'1 000 €'` — two visually identical strings, the afternoon-losing failure. The codepoint
assertion reports `- "U+202F" / + "U+00A0"`. That transcript is the argument against any
future "delete the duplicate field" cleanup.

Nine of the 43 pairs are **nested** (including `minPurchaseAmount` on `best-reward-tiered`,
the fr-FR `1 500 €`, which is both at-risk and the least likely to be noticed), so anything
walking pairs must recurse. The pairing is a generator invariant with no representation in
the artifact, so a corpus-wide test walks the whole tree, pairs any `X` with a sibling
`XCodepoints` at any depth, and asserts a floor on the count so the walker cannot silently
match nothing.

### fr-FR fragility, concretely

Covered locales are exactly three, all LTR: `eur`→fr-FR, `usd`→en-US, `gbp`→en-GB
(`getSupportedCurrency` falls everything else back to `eur`). Only fr-FR is at risk, and only
for values ≥ 1000.

The corpus was generated under **ICU 74.2 / CLDR 44**, where fr-FR uses `U+202F` as the
thousands separator. That separator arrived in CLDR 34 / ICU 63; older data emits `U+00A0`
instead, and **Android below roughly API 28 ships pre-ICU-63 CLDR**. So an old device fails
for a reason that is nobody's bug.

**Exactly six entries carry a `U+202F`** — `format-amount-eur-decimals`,
`format-amount-eur-large`, `format-amount-eur-rounds`, `format-amount-default-currency`,
`estimated-fixed-large`, `best-reward-tiered` — verified by scanning the committed file. If a
failure names anything else, the group-separator hypothesis is wrong and it is a real bug.
Treat a `U+202F`/`U+00A0` group-separator mismatch as an **environment** finding and report
the runtime ICU/CLDR version.

> This is the moment the temptation to hand-edit arrives, and the worst possible moment to
> give in: the natural wrong move updates the literal and not the codepoint array, silently
> destroying the one diagnostic that makes these failures readable.

Two deliberate exclusions: **no negative-amount fixtures** (fr-FR negatives are an
independent axis of ICU drift, ASCII `U+002D` vs `U+2212`) and **no RTL locales** (which
would introduce directional marks and need this section revisited first). The ICU baseline
lives in a generator comment, never in the JSON, which would break byte-determinism.

## 5. How each platform consumes it

The corpus lives in `sdk/core`, outside both native projects, so neither Gradle test
resources nor `Bundle.module` can reach it: both loaders walk up to the repo root, identified
by `sdk/core` **plus** a repo marker (`.git` or `package.json`) together — `sdk/core` alone
would match a stray directory, `.git` alone breaks in a worktree or a trimmed CI checkout.

| | Android | iOS |
|---|---|---|
| Loader | `frak-sdk/src/test/kotlin/id/frak/sdk/fixtures/GoldenFixtures.kt` | `Tests/FrakSDKTests/Fixtures/GoldenFixtures.swift` |
| Parser | `org.json`, **test scope only** | `JSONSerialization` |
| Walk starts at | the class's `codeSource` | `#filePath` |
| Framework | JUnit 4 | Swift Testing |

`JSONSerialization` rather than `JSONDecoder` is deliberate: `Codable` structs would type the
payload, and typing the payload is what makes every payload change a loader change.

**The `org.json` trap.** "It ships with Android, so no dependency is needed" is wrong in a
way that compiles: for local unit tests the classpath is the stubbed `android.jar`, whose
every method body throws `Method getInt in org.json.JSONObject not mocked`. The real
`org.json:json` artifact in `testImplementation` shadows the stub, and being test-scoped it
never reaches the published POM (verified — `generatePomFileForReleasePublication` contains
no `org.json` entry). kotlinx-serialization was rejected as a dependency *plus* a Gradle
plugin applying a compiler plugin module-wide; hand-rolled parsing was rejected because
hand-written parsers get `\u` escapes wrong and this corpus is *specifically about invisible
characters*.

### Adding a new fixture group

1. **Freeze the module first** — a corpus over moving logic generates churn, not a contract.
2. Generator at `sdk/core/scripts/generate-golden-<concern>.ts` → `src/<concern>/fixtures/`,
   plus a `fixtures:generate:<concern>` script and a package export.
3. Match the envelope; unique kebab-case `name`, human `description`, a `kind` discriminator,
   4-space indent, trailing newline.
4. Prove determinism: run it twice, expect a zero diff.
5. Escape non-ASCII, and add a `…Codepoints` sibling to any string where invisible characters
   are possible — the corpus-wide invariant picks it up automatically, including nested ones.
6. Assert `name` uniqueness in your own suite; loaders validate the envelope only.
7. Add a constant to both loaders and write the conformance suite alongside the platform code
   it covers.
8. **Prove it fails.** Break one byte in one platform deliberately and watch it go red.

## 6. Status

| | State |
|---|---|
| Envelope | locked across all three files |
| Loaders | green on both platforms, with a deliberate failure-path test |
| Identity conformance | asserted on both platforms (`ProofCodecTest` / `ProofCodecTests`) |
| Codec conformance | asserted on both platforms (`FrakContextCodecTest` / `FrakContextCodecTests`) |
| **Rewards conformance** | **absent.** `GoldenFixtures.REWARDS` / `.rewards` are declared and loaded by nobody; reward decoding is asserted against hand-written literals on both platforms. 67 entries, the largest file, asserting nothing (`06-open-findings.md` T4) |
| Has the corpus ever caught a real divergence? | **No.** The deliberate-injection test remains unrun (`05` §6) |

The last two rows are the honest ones. The mechanism is wired end to end and proven to load
real data on both platforms; two thirds of it is enforcing something, and it has never been
shown to catch the thing it was built to catch.
